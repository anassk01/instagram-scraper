import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Handles script injection into the browser context
 * Allows running the same scripts used for console testing in automation
 */
export class ScriptRunner {
  /**
   * Injects and runs a script in the page context
   * @param page The Playwright page to inject into
   * @param scriptPath Path to the script file
   * @returns The data returned by the script
   */
  async injectAndRun<T>(page: Page, scriptPath: string): Promise<T> {
    try {
      // Read the script file
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      console.log(`Injecting script: ${path.basename(scriptPath)}`);
      
      // Extract the function name from the script
      // This regex finds "extractXXX" function declarations
      const functionNameMatch = scriptContent.match(/function\s+(extract\w+)\s*\(/);
      const functionName = functionNameMatch ? functionNameMatch[1] : null;
      
      if (!functionName) {
        throw new Error(`Could not find extraction function in script: ${scriptPath}`);
      }
      
      // Wrap the script to set a flag that prevents auto-execution
      // and returns the data instead
      const wrappedScript = `
        // Set flag to prevent auto-execution
        window.__SCRAPER_IMPORT__ = true;
        
        ${scriptContent}
        
        // Return the extracted data by calling the extraction function
        ${functionName}();
      `;
      
      // Execute the script in the page context
      const result = await page.evaluate(wrappedScript) as T;
      console.log(`Script execution complete: ${path.basename(scriptPath)}`);
      
      return result;
    } catch (error) {
      console.error(`Error running script ${scriptPath}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const scriptRunner = new ScriptRunner();