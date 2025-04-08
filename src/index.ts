import 'dotenv/config';
import { browserController } from './browser';
import { scriptRunner } from './script-runner';
import * as path from 'path';
import * as fs from 'fs';

// Instagram scraper main orchestrator

/**
 * Main function to run the Instagram scraper
 * @param options Configuration options
 */
async function run(options: {
  profilePath: string;
  targetUrl: string;
  outputDir?: string;
  scriptName?: string;
}) {
  const { profilePath, targetUrl, outputDir = 'output', scriptName = 'profile' } = options;
  
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
    
    // Determine which script to run
    const scriptsDir = path.join(__dirname, 'scripts');
    const scriptPath = path.join(scriptsDir, `${scriptName}.js`);
    
    if (!fs.existsSync(scriptPath)) {
      throw new Error(`Script not found: ${scriptPath}`);
    }
    
    // Run the requested script
    console.log(`Starting ${scriptName} extraction...`);
    const data = await scriptRunner.injectAndRun(page, scriptPath);
    
    // Save results to file
    const outputPath = path.join(outputDir, `${scriptName}_${new Date().toISOString().replace(/:/g, '-')}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
    console.log(`Data saved to: ${outputPath}`);
    
    // Display results
    console.log('\nExtracted Data:');
    console.log(JSON.stringify(data, null, 2));
    
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
if (require.main === module) {
  const profilePath = process.env.FIREFOX_PROFILE_PATH || '';
  if (!profilePath) {
    console.error('ERROR: Please set FIREFOX_PROFILE_PATH environment variable');
    process.exit(1);
  }

  const targetUrl = process.argv[2] || 'https://www.instagram.com/instagram/';
  const scriptName = process.argv[3] || 'profile';
  
  run({
    profilePath,
    targetUrl,
    scriptName
  }).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

// Export for programmatic usage
export { run };