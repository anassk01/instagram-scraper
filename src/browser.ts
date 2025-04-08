import { firefox, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as sqlite3 from 'sqlite3';
import { open } from 'sqlite';

/**
 * Controls browser operations using Playwright
 * Handles Firefox profile for maintaining Instagram sessions
 */
export class BrowserController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;

  /**
   * Extracts cookies from Firefox profile
   * @param profilePath Path to Firefox profile directory
   * @returns Array of cookies
   */
  private async extractCookies(profilePath: string): Promise<any[]> {
    const cookiesPath = path.join(profilePath, 'cookies.sqlite');
    
    if (!fs.existsSync(cookiesPath)) {
      console.warn('Cookies file not found:', cookiesPath);
      return [];
    }
    
    try {
      // Open the cookies database
      const db = await open({
        filename: cookiesPath,
        driver: sqlite3.Database
      });
      
      // Query for Instagram cookies
      const cookies = await db.all(`
        SELECT host, path, name, value, expiry, isSecure, isHttpOnly, sameSite
        FROM moz_cookies
        WHERE host LIKE '%instagram.com'
      `);
      
      await db.close();
      
      console.log(`Extracted ${cookies.length} Instagram cookies`);
      return cookies;
    } catch (error) {
      console.error('Error extracting cookies:', error);
      return [];
    }
  }

  /**
   * Launches a browser session with cookies from an existing Firefox profile
   * @param profilePath Path to Firefox profile directory
   */
  async launch(profilePath: string): Promise<void> {
    try {
      // Validate profile path
      if (!fs.existsSync(profilePath)) {
        throw new Error(`Firefox profile path not found: ${profilePath}`);
      }

      console.log(`Extracting cookies from: ${profilePath}`);
      
      // Extract cookies from Firefox profile
      const cookies = await this.extractCookies(profilePath);
      
      // Launch browser with a clean context
      this.context = await firefox.launchPersistentContext(os.tmpdir(), {
        // Set Firefox preferences to avoid bot detection
        firefoxUserPrefs: {
          'dom.webdriver.enabled': false,
          'useAutomationExtension': false,
          'browser.cache.disk.enable': false,
          'browser.cache.memory.enable': false,
          'browser.cache.offline.enable': false,
          'network.cookie.cookieBehavior': 0,
          'security.enterprise_roots.enabled': true,
          'security.cert_pinning.enforcement_level': 0
        },
        viewport: { width: 1280, height: 800 },
        timeout: 60000,
        headless: false // Run in non-headless mode to avoid profile version issues
      });
      
      // Get the first page or create one
      const pages = this.context.pages();
      this.page = pages.length > 0 ? pages[0] : await this.context.newPage();
      
      // Add cookies to the page
      if (cookies.length > 0) {
        console.log('Adding cookies to browser session');
        await this.context.addCookies(cookies.map(cookie => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.host,
          path: cookie.path,
          expires: cookie.expiry,
          secure: cookie.isSecure === 1,
          httpOnly: cookie.isHttpOnly === 1,
          sameSite: cookie.sameSite === 0 ? 'Lax' : cookie.sameSite === 1 ? 'Strict' : 'None'
        })));
      }
      
      console.log('Browser initialized successfully');
    } catch (error) {
      console.error('Error launching browser:', error);
      await this.close();
      throw error;
    }
  }

  /**
   * Navigates to a URL and waits for content to load
   * @param url URL to navigate to
   */
  async navigateTo(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    console.log(`Navigating to: ${url}`);
    
    try {
      // Navigate to the URL
      await this.page.goto(url, { waitUntil: 'networkidle' });
      
      // Wait for universal Instagram page elements that exist on all page types
      await this.page.waitForSelector('body', { timeout: 15000 });
      
      // Wait for the main content container - this selector is more universal than h2
      // Most Instagram pages (profile, post, etc.) have a main content section 
      await this.page.waitForSelector('main[role="main"]', { timeout: 15000 });
      
      // Check if the page content has loaded by looking for common Instagram elements
      // This is more reliable than looking for specific elements that might only exist on certain page types
      await this.page.waitForSelector('section', { timeout: 15000 });
      
      // Additional wait to ensure dynamic content loads
      await this.page.waitForTimeout(3000);
      
      console.log('Navigation complete');
    } catch (error) {
      console.error('Error during navigation:', error);
      
      // Try to capture a screenshot on navigation error to help with debugging
      try {
        if (this.page) {
          const errorScreenshotPath = `navigation-error-${Date.now()}.png`;
          await this.page.screenshot({ path: errorScreenshotPath });
          console.error(`Error screenshot saved to: ${errorScreenshotPath}`);
        }
      } catch (screenshotError) {
        console.error('Failed to capture error screenshot:', screenshotError);
      }
      
      throw error;
    }
  }

  /**
   * Gets the current page instance
   * @returns Playwright Page instance
   */
  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }
    return this.page;
  }

  /**
   * Takes a screenshot of the current page
   * @param filePath Path to save the screenshot
   */
  async takeScreenshot(filePath: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      await this.page.screenshot({ path: filePath, fullPage: true });
    } catch (error) {
      console.error('Error taking screenshot:', error);
      throw error;
    }
  }

  /**
   * Closes the browser session
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
      this.page = null;
      console.log('Browser closed');
    }
  }
}

// Export singleton instance
export const browserController = new BrowserController();