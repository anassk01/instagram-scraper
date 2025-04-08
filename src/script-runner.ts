import { Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { transformSync } from 'esbuild';

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
      
      // Transpile TypeScript to JavaScript using esbuild
      const transpileResult = transformSync(scriptContent, {
        loader: 'ts',
        target: 'es2015'
      });
      const jsScriptContent = transpileResult.code;
      
      // Extract the function name from the script
      const functionNameMatch = scriptContent.match(/function\s+(extractPost)\s*\(/);
      const functionName = functionNameMatch ? functionNameMatch[1] : null;
      
      if (!functionName) {
        throw new Error(`Could not find extraction function in script: ${scriptPath}`);
      }
      
      // Execute the script in the page context using dynamic script injection
      const result = await page.evaluate(async ({ scriptCode, targetFunctionName }) => {
        // Remove export statements as they are not needed/allowed in this context
        const cleanedCode = scriptCode.replace(/^export\s+/gm, '');
        
        const scriptElement = document.createElement('script');
        scriptElement.textContent = cleanedCode;
        scriptElement.id = '__temp_scraper_script__'; // Add an ID for easy removal
        document.body.appendChild(scriptElement);
        
        // Ensure the function is available on the window object
        // Need to wait briefly for the script to parse and execute
        await new Promise(resolve => setTimeout(resolve, 50)); 

        let data = null;
        if (typeof (window as any)[targetFunctionName] === 'function') {
          // Call the function
          data = await (window as any)[targetFunctionName]();
        } else {
          console.error(`Scraper function ${targetFunctionName} not found on window after script injection.`);
          throw new Error(`Scraper function ${targetFunctionName} not found.`);
        }
        
        // Clean up the added script tag
        document.getElementById(scriptElement.id)?.remove();
        
        return data;
      }, { scriptCode: jsScriptContent, targetFunctionName: functionName }) as T;
      
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