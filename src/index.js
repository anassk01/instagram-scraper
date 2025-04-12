import 'dotenv/config';
import { browserController } from './browser.js';
import { directInjectionRunner } from './direct-injection-runner.js';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Instagram scraper main orchestrator

/**
 * Main function to run the Instagram scraper
 * @param options Configuration options
 */
async function run(options) {
  const { profilePath, targetUrl, outputDir = 'output', scriptName = 'profile', includeComments = true } = options;
  
  try {
    console.log('Instagram Scraper Starting...');
    console.log(`Target URL: ${targetUrl}`);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Launch browser
    await browserController.launch(profilePath);
    
    // Navigate to target URL
    await browserController.navigateTo(targetUrl);
    
    // Get the Playwright page
    const page = browserController.getPage();
    
    // Determine which script to run - pointing to src/scripts directly
    const scriptsDir = path.join(__dirname, 'scripts');
    
    // Make sure we're using the correct script extension (.js)
    const scriptPath = path.join(scriptsDir, `${scriptName}.js`);
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }
    
    // Load necessary helper scripts based on the main script
    let helperScripts = [];
    const helperNames = [];

    // Common helpers needed by 'post' script
    if (scriptName === 'post') {
        helperNames.push('image-extractor', 'video-extractor', 'carousel-extractor');
        // Conditionally add comment extractor
        if (includeComments) {
            helperNames.push('comment-extractor');
        }
    }
    // Add other script-specific helpers here if needed in the future

    // Load the specified helpers
    for (const helperName of helperNames) {
        const helperPath = path.join(scriptsDir, `${helperName}.js`);
        const exists = fs.existsSync(helperPath);
        console.log(`[Index Check] Checking for helper: ${helperPath} - Exists: ${exists}`); // Added check log
        if (exists) {
            console.log(`[Index Check] Including helper module: ${helperName}.js`);
            helperScripts.push(helperPath);
        } else {
            // Log a warning if a required helper is missing
            console.warn(`[Index Check] Helper module not found, execution might fail: ${helperPath}`);
        }
    }
    
    // Run the requested script using our direct injection runner
    console.log(`Starting ${scriptName} extraction...`);
    const data = await directInjectionRunner.runScript(page, scriptPath, helperScripts);
    
    // Save results to file
    const outputPath = path.join(outputDir, `${scriptName}_${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to: ${outputPath}`);
    
    // Display results
    console.log('\nExtracted Data:');
    console.log(JSON.stringify(data, null, 2));
    
    // If we included comments, show comment count
    if (scriptName === 'post' && includeComments && data.comments) {
      console.log(`\nExtracted ${data.comments.length} comments from the post`);
    }
    
    // Take a screenshot for verification (optional)
    await browserController.takeScreenshot(path.join(outputDir, `${scriptName}_screenshot.png`));
    
    return data;
  } catch (error) {
    console.error('An error occurred during scraping:', error);
    throw error;
  } finally {
    // Ensure browser is closed
    await browserController.close();
    console.log('Scraping complete!');
  }
}

// Execute when run directly
if (__filename === process.argv[1]) {
  const profilePath = process.env.FIREFOX_PROFILE_PATH || '';
  if (!profilePath) {
    console.error('ERROR: Please set FIREFOX_PROFILE_PATH environment variable');
    process.exit(1);
  }

  const targetUrl = process.argv[2] || 'https://www.instagram.com/instagram/';
  const scriptName = process.argv[3] || 'profile';
  
  // Check if --no-comments flag is provided
  const includeComments = !process.argv.includes('--no-comments');
  
  run({
    profilePath,
    targetUrl,
    scriptName,
    includeComments
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic usage
export { run };