// src/direct-injection-runner.js (Modified)

import * as fs from 'fs';
import * as path from 'path';

/**
 * A script runner that injects scripts directly
 */
export class DirectInjectionRunner {
  /**
   * Injects and runs helper scripts and then the main script in the page context
   * @param {import('playwright').Page} page - The Playwright page to inject into
   * @param {string} scriptPath - Path to the main script file to run
   * @param {string[]} [helperScriptPaths=[]] - Optional array of paths to helper scripts to load first
   * @returns {Promise<any>} The data returned by the main script's execution function
   */
  async runScript(page, scriptPath, helperScriptPaths = []) {
    try {
      // Get the main script name without extension
      const scriptName = path.basename(scriptPath, path.extname(scriptPath));
      console.log(`[Runner] Preparing to run script: ${scriptName}`);

      // --- Load Helper Scripts FIRST ---
      if (helperScriptPaths.length > 0) {
        console.log(`[Runner] Loading ${helperScriptPaths.length} helper script(s)...`);
        for (const helperPath of helperScriptPaths) {
          const helperScriptName = path.basename(helperPath);
          try {
            if (fs.existsSync(helperPath)) {
                const helperContent = fs.readFileSync(helperPath, 'utf8');
                console.log(`[Runner] Injecting helper: ${helperScriptName}`);

                // ** Enhanced Evaluate for Helpers **
                await page.evaluate(async ({ code, scriptNameForLog }) => {
                  let errorOccurred = false;
                  try {
                    console.log(`[Page Context] Executing helper script: ${scriptNameForLog}...`);
                    // Create and execute the function from script code
                    const helperFn = new Function(code);
                    helperFn(); // Execute the helper script code
                    console.log(`[Page Context] Finished executing helper script: ${scriptNameForLog}.`);

                    // *** ADDED CHECK ***
                    // Check specifically for known functions from our extractors
                    const expectedFunctions = {
                        'comment-extractor.js': 'extractCommentsFromPost',
                        'image-extractor.js': 'extractSingleImage',
                        'video-extractor.js': 'extractSingleVideo',
                        'carousel-extractor.js': 'extractCarouselMedia'
                    };
                    const expectedFnName = expectedFunctions[scriptNameForLog];
                    if (expectedFnName) {
                        if (typeof window[expectedFnName] === 'function') {
                            console.log(`[Page Context] SUCCESS: Function 'window.${expectedFnName}' is available after running ${scriptNameForLog}.`);
                        } else {
                            console.error(`[Page Context] ERROR: Function 'window.${expectedFnName}' is NOT available after running ${scriptNameForLog}!`);
                            errorOccurred = true; // Mark error for outside
                        }
                    } else {
                         console.log(`[Page Context] No specific function check defined for ${scriptNameForLog}.`);
                    }
                    // *** END ADDED CHECK ***

                  } catch (error) {
                    console.error(`[Page Context] Error EXECUTING helper script ${scriptNameForLog} in page:`, error.message, error.stack);
                    errorOccurred = true; // Mark error for outside
                  }
                  // Return status (optional, might not be easily accessible outside evaluate)
                  return !errorOccurred;

                }, { code: helperContent, scriptNameForLog: helperScriptName });

                console.log(`[Runner] Injection attempted for ${helperScriptName}. Check Page Context logs above for success/failure.`);
                await page.waitForTimeout(150); // Slightly reduced delay

            } else {
                console.warn(`[Runner] Helper script specified but not found at execution time: ${helperPath}`);
            }
          } catch (helperError) {
            // This catches errors during file read or the evaluate call itself
            console.error(`[Runner] Error processing helper script ${helperScriptName}:`, helperError);
          }
        }
         console.log("[Runner] Finished processing helper scripts.");
      }
      // --- End of Helper Scripts Loading ---


      // Read the main script
      const scriptContent = fs.readFileSync(scriptPath, 'utf8');

      // Execute the main script directly with evaluate
      console.log(`[Runner] Executing main script: ${scriptName}`);
      const result = await page.evaluate(async (code) => {
         // Added check before main execution
         console.log("[Page Context] Checking for expected functions BEFORE running main script:");
         console.log(`  - window.extractCommentsFromPost?`, typeof window.extractCommentsFromPost);
         console.log(`  - window.extractSingleImage?`, typeof window.extractSingleImage);
         console.log(`  - window.extractSingleVideo?`, typeof window.extractSingleVideo);
         console.log(`  - window.extractCarouselMedia?`, typeof window.extractCarouselMedia);

        try {
          // Create and execute the main script's code (which should define functions like executeExtraction)
          const scriptFn = new Function(code);
          scriptFn(); // Run the main script code (post.js, profile.js etc.)

          // Try to call the designated extraction function (now likely async)
          if (typeof window.executeExtraction === 'function') {
            console.log("[Page Context] Calling executeExtraction function...");
            try {
              // Await the result as executeExtraction is now async for posts
              const data = await window.executeExtraction();
              console.log("[Page Context] executeExtraction returned:", typeof data);
              // Add more detailed logging if needed
              if (data && data.media && data.media.error) {
                 console.warn("[Page Context] executeExtraction result contains a media error:", data.media.error);
              }
               if (data && data.error) {
                 console.warn("[Page Context] executeExtraction result contains a top-level error:", data.error);
              }
              return data; // Return the data
            } catch (error) {
              console.error("[Page Context] Error calling executeExtraction:", error.message, error.stack);
              return { error: `Error in executeExtraction: ${error.message}` };
            }
          } else {
             console.error("[Page Context] executeExtraction function not found on window after running main script.");
             return { error: "No executeExtraction function found." };
          }

        } catch (error) {
          console.error("[Page Context] Error during main script execution (evaluate):", error.message, error.stack);
          return {
            error: `Main script execution error: ${error.message}`,
            url: window.location.href,
            timestamp: new Date().toISOString()
          };
        }
      }, scriptContent);

      console.log(`[Runner] Main script execution complete: ${scriptName}`);

      // Log final result details from runner perspective
      if (result && result.error) {
        console.error(`[Runner] Main script returned an error: ${result.error}`);
      }
      if (result && result.media && result.media.error) {
         console.warn(`[Runner] Main script result includes a media error: ${result.media.error}`);
      }


      return result;
    } catch (error) {
      console.error(`[Runner] Error running script ${scriptPath}:`, error);
      throw error; // Rethrow error to be caught by index.js
    }
  }
}

// Export a singleton instance
export const directInjectionRunner = new DirectInjectionRunner();