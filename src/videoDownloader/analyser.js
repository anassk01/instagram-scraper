import 'dotenv/config';
import { BrowserController } from '../browser.js';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';
import { fileURLToPath } from 'url';

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Attempts to decode the efg parameter and extract relevant info.
 * CORRECTED VERSION using xpv_asset_id and vencode_tag
 * @param {string} urlStr The URL string containing the efg parameter.
 * @returns {object|null} An object with { assetId, type } or null if failed.
 */
function parseEfgParameter(urlStr) {
    // [DEBUG] console.log(`[DEBUG] Attempting to parse efg for: ${urlStr.substring(0, 100)}...`);
    try {
        const parsedUrl = new URL(urlStr);
        const efgParam = parsedUrl.searchParams.get('efg');
        if (!efgParam) {
            // [DEBUG] console.log(`[DEBUG] No 'efg' parameter found.`);
            return null;
        }
        // [DEBUG] console.log(`[DEBUG] Raw efgParam: ${efgParam.substring(0, 50)}...`);

        let decodedEfg;
        try {
            decodedEfg = Buffer.from(efgParam, 'base64').toString('utf-8');
            // [DEBUG] console.log(`[DEBUG] Decoded efg: ${decodedEfg.substring(0, 100)}...`);
        } catch (decodeError) {
            console.warn(`[WARN] Base64 decode failed for efg: ${decodeError.message}`);
            return null;
        }

        let efgData;
        try {
            efgData = JSON.parse(decodedEfg);
            // [DEBUG] console.log(`[DEBUG] Parsed efgData keys: ${Object.keys(efgData).join(', ')}`);
        } catch (parseError) {
             console.warn(`[WARN] JSON parse failed for decoded efg: ${parseError.message}`);
             return null;
        }

        // --- *** CORRECTED KEY FOR ASSET ID *** ---
        const assetIdKey = 'xpv_asset_id';
        const assetId = efgData[assetIdKey] || null;
        if (!assetId) {
            console.log(`[DEBUG] Asset ID key '${assetIdKey}' not found or null in efgData.`);
            // [DEBUG] console.log(`[DEBUG] Full efgData:`, efgData); // Keep this commented unless needed again
            return null;
        }
        // [DEBUG] console.log(`[DEBUG] Found assetId: ${assetId}`);

        // --- *** CORRECTED KEY FOR ENCODE TAG *** ---
        let type = 'unknown';
        const encodeTagKey = 'vencode_tag'; // Corrected key name
        const encodeTag = efgData[encodeTagKey] || ''; // Use the corrected key
         // [DEBUG] console.log(`[DEBUG] Found encodeTag: ${encodeTag}`);

        // Determine Type based on the encode tag
        if (encodeTag.includes('_audio') || encodeTag.includes('audio')) { // Check in the correct tag value
            type = 'audio';
        } else if (encodeTag.includes('dash_baseline') || encodeTag.includes('dash_main') || encodeTag.includes('progressive')) {
            type = 'video';
        }
         // [DEBUG] console.log(`[DEBUG] Determined type: ${type} for assetId: ${assetId}`);

        if (type === 'unknown') {
             console.log(`[DEBUG] Type determined as 'unknown'. Full encodeTag was: ${encodeTag}`);
        }

        return { assetId: String(assetId), type: type };

    } catch (error) {
        console.warn(`[WARN] Unexpected error in parseEfgParameter for URL ${urlStr}: ${error.message}`);
        return null;
    }
}


// --- The rest of the script (collectVideoUrlsEnhancedDebug, handleResponse, etc.) ---
// --- remains the same as the previous DEBUG version. ---
// --- Just make sure the parseEfgParameter function above replaces the old one. ---


/**
 * Collects video and audio chunk URLs from a target Instagram URL indefinitely,
 * attempting to classify them using the 'efg' parameter.
 * Includes extensive debugging logs. Corrected efg key parsing.
 * @param {string} targetUrl The URL of the Instagram post/reel.
 * @param {string} profilePath Path to the Firefox profile.
 * @param {string} outputDir Directory to save the results.
 */
async function collectVideoUrlsCorrectedDebug(targetUrl, profilePath, outputDir = 'output') {
    console.log(`Starting Corrected URL collection (DEBUG MODE) for: ${targetUrl}`);
    console.log("The script will keep running and collecting URLs.");
    console.log(">>> Manually close the browser window when you think the video has fully loaded or played. <<<");
    console.log("Data will be saved after the browser is closed.");

    const browserController = new BrowserController();
    const chunksByAssetId = {};
    const collectedUrls = new Set();


    const handleResponse = async (response) => {
        const urlStr = response.url();
        const status = response.status();

        if (urlStr.includes('.mp4') && urlStr.includes('bytestart=')) {
             // [DEBUG] console.log(`[DEBUG] Passed basic filter: ${urlStr.substring(0, 100)}... (Status: ${status})`);
             if (status >= 200 && status < 300) {
                 if (collectedUrls.has(urlStr)) return;

                const parsedUrl = new URL(urlStr);
                const bytestartStr = parsedUrl.searchParams.get('bytestart');
                const byteendStr = parsedUrl.searchParams.get('byteend');

                if (bytestartStr === null || byteendStr === null) return;
                const bytestart = parseInt(bytestartStr, 10);
                const byteend = parseInt(byteendStr, 10);
                 if (isNaN(bytestart) || isNaN(byteend)) {
                     console.warn(`[WARN] Failed to parse byte range in URL: ${urlStr}`);
                     return;
                 }

                 // [DEBUG] console.log(`[DEBUG] Calling parseEfgParameter for: ${urlStr.substring(0, 80)}...`);
                 const efgInfo = parseEfgParameter(urlStr); // Calls the corrected function
                 // [DEBUG] console.log(`[DEBUG] efgInfo result:`, efgInfo);


                 if (!efgInfo) {
                     // [DEBUG] console.log(`[DEBUG] Skipping URL because efgInfo is null.`);
                     return;
                 }

                 const { assetId, type } = efgInfo;

                 if (type === 'unknown') {
                    console.log(`[DEBUG] Type remains 'unknown' for Asset ${assetId}. Skipping storage.`);
                    return;
                 }

                 const chunkInfo = {
                    url: urlStr,
                    bytestart: bytestart,
                    byteend: byteend,
                    size: byteend - bytestart + 1,
                    efg: parsedUrl.searchParams.get('efg'),
                    timestamp: Date.now()
                 };
                 collectedUrls.add(urlStr);

                 if (!chunksByAssetId[assetId]) {
                     chunksByAssetId[assetId] = { video: [], audio: [] };
                     console.log(`[*] Detected new asset ID: ${assetId}`);
                 }

                 if (type === 'video') {
                     chunksByAssetId[assetId].video.push(chunkInfo);
                     console.log(`[+] Captured VIDEO chunk for Asset ${assetId}: start=${bytestart}, size=${chunkInfo.size}`);
                 } else if (type === 'audio') {
                     chunksByAssetId[assetId].audio.push(chunkInfo);
                     console.log(`[+] Captured AUDIO chunk for Asset ${assetId}: start=${bytestart}, size=${chunkInfo.size}`);
                 }
             }
        }
    }; // End handleResponse


    // --- processAndSaveData function remains the same ---
    const processAndSaveData = () => {
        console.log("\nBrowser closed. Processing collected data...");

        if (browserController.page && !browserController.page.isClosed()) {
             browserController.page.off('response', handleResponse);
             console.log("Network listener removed.");
        } else {
             console.log("Page already closed, listener implicitly removed.");
        }


        console.log(`\n--- Analysis ---`);
        const finalOutput = {
            targetUrl: targetUrl,
            collectionTime: new Date().toISOString(),
            assets: {}
        };

        let totalVideoChunks = 0;
        let totalAudioChunks = 0;

        for (const assetId in chunksByAssetId) {
            const videoChunks = chunksByAssetId[assetId].video;
            const audioChunks = chunksByAssetId[assetId].audio;

            totalVideoChunks += videoChunks.length;
            totalAudioChunks += audioChunks.length;

            videoChunks.sort((a, b) => a.bytestart - b.bytestart);
            audioChunks.sort((a, b) => a.bytestart - b.bytestart);

            let lastVideoEnd = -1;
            let videoGaps = 0;
            for (const chunk of videoChunks) {
                if (chunk.bytestart !== 0 && lastVideoEnd !== -1 && chunk.bytestart !== lastVideoEnd + 1) {
                    videoGaps++;
                }
                lastVideoEnd = Math.max(lastVideoEnd, chunk.byteend);
            }
            if (videoGaps > 0) console.log(`[WARN] Asset ${assetId}: Detected ${videoGaps} potential gap(s) in VIDEO sequence.`);

            let lastAudioEnd = -1;
            let audioGaps = 0;
            for (const chunk of audioChunks) {
                 if (chunk.bytestart !== 0 && lastAudioEnd !== -1 && chunk.bytestart !== lastAudioEnd + 1) {
                     audioGaps++;
                 }
                 lastAudioEnd = Math.max(lastAudioEnd, chunk.byteend);
            }
            if (audioGaps > 0) console.log(`[WARN] Asset ${assetId}: Detected ${audioGaps} potential gap(s) in AUDIO sequence.`);


            finalOutput.assets[assetId] = {
                videoChunkCount: videoChunks.length,
                audioChunkCount: audioChunks.length,
                analysis: {
                    potentialVideoGaps: videoGaps,
                    potentialAudioGaps: audioGaps,
                    lastVideoByte: lastVideoEnd,
                    lastAudioByte: lastAudioEnd,
                    totalVideoBytes: videoChunks.reduce((sum, c) => sum + c.size, 0),
                    totalAudioBytes: audioChunks.reduce((sum, c) => sum + c.size, 0)
                },
                videoChunks: videoChunks,
                audioChunks: audioChunks
            };
        }

        console.log(`Total assets detected: ${Object.keys(chunksByAssetId).length}`);
        console.log(`Total video chunks captured (all assets): ${totalVideoChunks}`);
        console.log(`Total audio chunks captured (all assets): ${totalAudioChunks}`);


        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Save with a new name to indicate correction
        const filename = `collected_urls_corrected_debug_${new Date().toISOString().replace(/:/g, '-')}.json`;
        const outputPath = path.join(outputDir, filename);
        try {
            fs.writeFileSync(outputPath, JSON.stringify(finalOutput, null, 2));
            console.log(`\nCollected and grouped chunk URLs saved to: ${outputPath}`);
        } catch (saveError) {
            console.error(`[ERROR] Failed to save results to ${outputPath}:`, saveError);
        }
    };


    // --- try/catch/finally block remains the same ---
    try {
        await browserController.launch(profilePath);
        const page = browserController.getPage();
        const context = page.context();

        console.log("Setting up corrected network response listener (DEBUG MODE)...");
        page.on('response', handleResponse);

        const closedPromise = new Promise(resolve => context.on('close', resolve));
        console.log("Listener for browser close event is active.");

        await browserController.navigateTo(targetUrl);
        console.log(`Navigation complete. Actively listening for network requests...`);
        console.log(">>> Close the browser window manually when ready. <<<");

        await closedPromise;

        processAndSaveData();

    } catch (error) {
       if (error.message.includes('Target closed') || error.message.includes('Protocol error')) {
            console.warn("Browser closed during operation, attempting to save any collected data...");
            processAndSaveData();
        } else {
            console.error('An error occurred during URL collection setup or navigation:', error);
             try {
                 if (browserController.page && !browserController.page.isClosed()) {
                    await browserController.takeScreenshot(path.join(outputDir, `error_screenshot_corrected_debug_${Date.now()}.png`));
                 }
            } catch (screenshotError) {
                console.error("Failed to take error screenshot:", screenshotError);
            }
        }
    } finally {
        console.log('Collection process finished.');
    }

} // End collectVideoUrlsCorrectedDebug


// --- Execution ---
if (__filename === process.argv[1]) {
    const profilePath = process.env.FIREFOX_PROFILE_PATH || '';
    if (!profilePath) {
        console.error('ERROR: Please set FIREFOX_PROFILE_PATH environment variable');
        process.exit(1);
    }
    const targetUrl = process.argv[2] || 'https://www.instagram.com/gothamchess/reel/DISJal7soa_/';

    // Call the CORRECTED DEBUG version of the function
    collectVideoUrlsCorrectedDebug(targetUrl, profilePath)
        .catch(error => {
            console.error('Fatal error in collection script execution:', error);
            process.exit(1);
        });
}

// Export the corrected debug version if needed
// export { collectVideoUrlsCorrectedDebug };