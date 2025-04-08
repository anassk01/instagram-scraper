import * as fs from 'fs';
import * as path from 'path';

/**
 * A completely redesigned script runner that injects scripts directly
 * without relying on TypeScript transpilation and explicit function exports
 */
export class DirectInjectionRunner {
  /**
   * Injects and runs a script in the page context
   * @param {import('playwright').Page} page - The Playwright page to inject into
   * @param {string} scriptPath - Path to the script file (JavaScript, not TypeScript)
   * @returns {Promise<any>} The data returned by the script
   */
  async runScript(page, scriptPath) {
    try {
      // Get the script name without extension
      const scriptName = path.basename(scriptPath, path.extname(scriptPath));
      console.log(`Preparing to run script: ${scriptName}`);
      
      // For simplicity, we'll expect ready-to-use JavaScript files
      // This avoids the issues with TypeScript transpilation
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');
      
      // Execute the script directly with a custom wrapper
      const result = await page.evaluate(async ({ code, scriptName }) => {
        // Create a unique result identifier for this execution
        const resultId = `__SCRAPER_RESULT_${Date.now()}`;
        
        // Create a wrapper that runs the script and captures its output
        const wrappedCode = `
          // Create a result container
          window["${resultId}"] = null;
          
          try {
            // Run the script inside a function to create its own scope
            (function() {
              ${code}
              
              console.log('[Browser] Checking for extraction functions...');
              
              // Find the main extraction function by convention (if it exists)
              // This is just a fallback mechanism
              if (typeof window["extract" + scriptName.charAt(0).toUpperCase() + scriptName.slice(1)] === 'function') {
                console.log('[Browser] Found convention function: extract' + scriptName.charAt(0).toUpperCase() + scriptName.slice(1));
                const conventionResult = window["extract" + scriptName.charAt(0).toUpperCase() + scriptName.slice(1)]();
                console.log('[Browser] Convention function returned:', conventionResult);
                window["${resultId}"] = conventionResult;
              }
              // Otherwise, if executeExtraction exists, call that
              else if (typeof executeExtraction === 'function') {
                console.log('[Browser] Found executeExtraction function.');
                const extractionResult = executeExtraction();
                console.log('[Browser] executeExtraction returned:', typeof extractionResult, extractionResult);
                window["${resultId}"] = extractionResult;
              }
              // If the script already set instagramData, use that
              else if (window["instagram" + scriptName.charAt(0).toUpperCase() + scriptName.slice(1) + "Data"]) {
                console.log('[Browser] Found instagramData variable.');
                window["${resultId}"] = window["instagram" + scriptName.charAt(0).toUpperCase() + scriptName.slice(1) + "Data"];
              } else {
                console.log('[Browser] No extraction method found.');
              }
              
              console.log('[Browser] Value assigned to window["${resultId}"]:', window["${resultId}"]);
              
            })();
          } catch (error) {
            console.error("Error executing script:", error);
            // Store the error so we can detect it
            window["${resultId}_error"] = error.message;
          }
        `;
        
        // Run the wrapped code
        const scriptElement = document.createElement('script');
        scriptElement.textContent = wrappedCode;
        scriptElement.id = '__temp_scraper_script__';
        document.body.appendChild(scriptElement);
        
        // Wait a moment for script execution
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Check for errors
        if (window[`${resultId}_error`]) {
          throw new Error(`Script execution error: ${window[`${resultId}_error`]}`);
        }
        
        // Get the result
        const result = window[resultId];
        
        // Clean up
        document.getElementById('__temp_scraper_script__')?.remove();
        delete window[resultId];
        delete window[`${resultId}_error`];
        
        // Return the result
        return result;
      }, { code: scriptContent, scriptName });
      
      console.log(`Script execution complete: ${scriptName}`);
      return result;
    } catch (error) {
      console.error(`Error running script ${scriptPath}:`, error);
      throw error;
    }
  }
}

// Export a singleton instance
export const directInjectionRunner = new DirectInjectionRunner();