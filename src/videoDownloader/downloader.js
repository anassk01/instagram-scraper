import 'dotenv/config'; // For FIREFOX_PROFILE_PATH
import { BrowserController } from '../browser.js'; // Assuming browser.js is in the same dir
import * as fs from 'fs';
import * as path from 'path';
import { resolve } from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { URL } from 'url';
import fetch from 'node-fetch';

// --- Configuration ---
const OUTPUT_DIR = 'output';        // Directory for temp files and final video
const MAX_RETRIES = 3;              // Retries for downloading a single chunk
const RETRY_DELAY_MS = 1000;        // Delay between download retries
const TEMP_FILE_PREFIX = 'temp_dl_'; // Prefix for temporary files

// Define __filename and __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Helper Functions (Adapted from previous scripts) ---

/**
 * Parses the 'efg' parameter from a URL.
 * Uses corrected keys: xpv_asset_id, vencode_tag.
 */
function parseEfgParameter(urlStr) {
    try {
        const parsedUrl = new URL(urlStr);
        const efgParam = parsedUrl.searchParams.get('efg');
        if (!efgParam) return null;

        const decodedEfg = Buffer.from(efgParam, 'base64').toString('utf-8');
        const efgData = JSON.parse(decodedEfg);

        const assetIdKey = 'xpv_asset_id';
        const assetId = efgData[assetIdKey] || null;
        if (!assetId) return null; // Asset ID is crucial

        const encodeTagKey = 'vencode_tag';
        const encodeTag = efgData[encodeTagKey] || '';

        let type = 'unknown';
        if (encodeTag.includes('_audio') || encodeTag.includes('audio')) {
            type = 'audio';
        } else if (encodeTag.includes('dash_baseline') || encodeTag.includes('dash_main') || encodeTag.includes('progressive')) {
            type = 'video';
        }
        // Note: We might capture 'unknown' types initially if they have an assetId,
        // but we'll likely filter them out later if they aren't video/audio for the target.

        return { assetId: String(assetId), type: type, encodeTag: encodeTag }; // Return encodeTag for potential debugging

    } catch (error) {
        // console.warn(`[WARN] Failed to parse efg for ${urlStr.substring(0, 80)}...: ${error.message}`);
        return null;
    }
}

/**
 * Downloads a single chunk with retries.
 */
async function downloadChunk(url, chunkIndex, type, assetId) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                // Handle common transient errors like 403/404 if URL expired
                if ((response.status === 403 || response.status === 404) && attempt < MAX_RETRIES) {
                     console.warn(`[WARN] Attempt ${attempt}: Status ${response.status} for ${type} chunk ${chunkIndex} (Asset ${assetId}). Retrying...`);
                     await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
                     continue; // Go to next attempt
                }
                throw new Error(`HTTP error! status: ${response.status} for ${type} chunk ${chunkIndex} (Asset ${assetId})`);
            }
            const buffer = await response.buffer();
            return buffer;
        } catch (error) {
            console.warn(`[WARN] Attempt ${attempt} failed for ${type} chunk ${chunkIndex} (Asset ${assetId}): ${error.message}`);
            if (attempt === MAX_RETRIES) {
                console.error(`[ERROR] Download failed for ${type} chunk ${chunkIndex} (Asset ${assetId}) after ${MAX_RETRIES} attempts.`);
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
    throw new Error(`Download loop failed unexpectedly for ${type} chunk ${chunkIndex} (Asset ${assetId})`);
}

/**
 * Downloads all chunks for a stream and appends them to a file.
 */
async function downloadStream(chunks, tempFilePath, type, assetId) {
    console.log(`Starting download for ${chunks.length} ${type} chunks (Asset ${assetId}) to ${tempFilePath}...`);
    if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
    }

    let totalBytes = 0;
    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        process.stdout.write(`  Downloading ${type} chunk ${i + 1}/${chunks.length} (bytes ${chunk.bytestart}-${chunk.byteend})... `);
        try {
            const buffer = await downloadChunk(chunk.url, i + 1, type, assetId);
            await fs.promises.appendFile(tempFilePath, buffer);
            totalBytes += buffer.length;
            process.stdout.write(`Done (${(buffer.length / 1024).toFixed(1)} KB)\n`);
        } catch (error) {
            process.stdout.write(`FAILED\n`);
            console.error(`[FATAL] Failed to download or write ${type} chunk ${i + 1} (Asset ${assetId}). Aborting stream download.`);
            throw error;
        }
    }
    console.log(`Finished downloading all ${type} chunks. Total size: ${(totalBytes / (1024 * 1024)).toFixed(2)} MB`);
}

/**
 * Merges temporary video and audio files using FFmpeg.
 */
function mergeWithFFmpeg(tempVideoPath, tempAudioPath, finalOutputPath) {
    return new Promise((resolve, reject) => {
        console.log(`\nMerging files with FFmpeg...`);
        console.log(`  Video: ${tempVideoPath}`);
        console.log(`  Audio: ${tempAudioPath}`);
        console.log(`  Output: ${finalOutputPath}`);

        const ffmpegArgs = [
            '-i', tempVideoPath,
            '-i', tempAudioPath,
            '-c:v', 'copy',
            '-c:a', 'copy',
            '-loglevel', 'warning', // Less verbose output
            '-y',
            finalOutputPath
        ];

        try {
             const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);
             let stderrOutput = '';
             ffmpegProcess.stderr.on('data', (data) => { stderrOutput += data.toString(); });

             ffmpegProcess.on('close', (code) => {
                if (code === 0) {
                    console.log('FFmpeg merging completed successfully.');
                    resolve();
                } else {
                    console.error(`[ERROR] FFmpeg process exited with code ${code}.`);
                    console.error('FFmpeg stderr:', stderrOutput || '(No stderr output)');
                    reject(new Error(`FFmpeg failed with code ${code}`));
                }
             });

             ffmpegProcess.on('error', (err) => {
                 // Handle common case where ffmpeg is not installed/found
                 if (err.code === 'ENOENT') {
                     console.error('[ERROR] Failed to start FFmpeg process. Command "ffmpeg" not found.');
                     console.error('Please ensure FFmpeg is installed and accessible in your system PATH.');
                 } else {
                    console.error('[ERROR] Failed to start FFmpeg process:', err);
                 }
                 reject(err);
             });
        } catch (spawnError) {
             console.error('[ERROR] Error spawning FFmpeg process:', spawnError);
             reject(spawnError);
        }
    });
}


// --- Main Function ---

/**
 * Downloads an Instagram Reel video.
 * @param {string} targetUrl URL of the Instagram Reel.
 * @param {string} profilePath Path to the Firefox profile directory.
 * @param {string} outputFilename Desired output filename (e.g., video.mp4).
 */
async function downloadInstagramReel(targetUrl, profilePath, outputFilename) {
    console.log(`--- Instagram Reel Downloader ---`);
    console.log(`Target URL: ${targetUrl}`);
    console.log(`Output File: ${outputFilename}`);
    console.log(`Using Profile: ${profilePath || 'Default (none specified)'}`);

    const browserController = new BrowserController();
    const chunksByAssetId = {}; // Store collected chunks here { assetId: { video: [], audio: [] } }
    const collectedUrls = new Set(); // Avoid processing the same URL multiple times
    let targetAssetId = null; // Will be determined after collection
    let tempVideoPath = '';
    let tempAudioPath = '';
    let pageClosedManually = false;

    // --- Network Response Handler ---
    const handleResponse = async (response) => {
        const urlStr = response.url();
        const status = response.status();

        // Basic filtering for potential chunks
        if (urlStr.includes('.mp4') && urlStr.includes('bytestart=') && status >= 200 && status < 300) {
            if (collectedUrls.has(urlStr)) return; // Already seen

            const parsedUrl = new URL(urlStr);
            const bytestartStr = parsedUrl.searchParams.get('bytestart');
            const byteendStr = parsedUrl.searchParams.get('byteend');
            if (bytestartStr === null || byteendStr === null) return;

            const bytestart = parseInt(bytestartStr, 10);
            const byteend = parseInt(byteendStr, 10);
            if (isNaN(bytestart) || isNaN(byteend)) return;

            const efgInfo = parseEfgParameter(urlStr);
            if (!efgInfo || !efgInfo.assetId) return; // Need assetId

            const { assetId, type } = efgInfo;

            // Ignore chunks classified as 'unknown' type here
            if (type !== 'video' && type !== 'audio') {
                 // console.log(`[DEBUG] Skipping chunk for Asset ${assetId}: type is '${type}' (Tag: ${efgInfo.encodeTag})`);
                return;
            }

            const chunkInfo = {
                url: urlStr,
                bytestart: bytestart,
                byteend: byteend,
                size: byteend - bytestart + 1,
                timestamp: Date.now()
            };
            collectedUrls.add(urlStr);

            if (!chunksByAssetId[assetId]) {
                chunksByAssetId[assetId] = { video: [], audio: [] };
                console.log(`[*] Collector: Detected new asset ID: ${assetId}`);
            }

            if (type === 'video') {
                chunksByAssetId[assetId].video.push(chunkInfo);
                // console.log(`[+] Collector: Captured VIDEO chunk for Asset ${assetId}`);
            } else if (type === 'audio') {
                chunksByAssetId[assetId].audio.push(chunkInfo);
                // console.log(`[+] Collector: Captured AUDIO chunk for Asset ${assetId}`);
            }
        }
    }; // End handleResponse


    try {
        // --- Step 1: Launch Browser and Collect URLs ---
        console.log("\nStep 1: Launching browser and collecting URLs...");
        await browserController.launch(profilePath);
        const page = browserController.getPage();
        const context = page.context();

        page.on('response', handleResponse);

        const closedPromise = new Promise(resolve => context.on('close', () => {
             pageClosedManually = true; // Flag that it was closed externally
             resolve();
         }));

        console.log(`Navigating to ${targetUrl}...`);
        await browserController.navigateTo(targetUrl); // Use navigateTo from controller
        console.log("Navigation complete. Listening for video chunks...");
        console.log(">>> Please interact with the page if necessary (e.g., scroll, ensure video plays). <<<");
        console.log(">>> Close the browser window manually when you think the video has fully loaded/played. <<<");

        await closedPromise; // Wait for manual browser close
        console.log("\nBrowser closed. Processing collected data...");
        page.off('response', handleResponse); // Stop listening

        // --- Step 2: Identify Target Asset ---
        console.log("\nStep 2: Identifying target video asset...");
        let largestVideoSize = -1;
        for (const assetId in chunksByAssetId) {
             const videoChunks = chunksByAssetId[assetId].video;
             const totalVideoBytes = videoChunks.reduce((sum, c) => sum + c.size, 0);
             console.log(`  - Asset ${assetId}: ${videoChunks.length} video chunks (${(totalVideoBytes / (1024*1024)).toFixed(2)} MB), ${chunksByAssetId[assetId].audio.length} audio chunks.`);
             if (totalVideoBytes > largestVideoSize) {
                 largestVideoSize = totalVideoBytes;
                 targetAssetId = assetId;
             }
        }

        if (!targetAssetId || largestVideoSize <= 0) {
            throw new Error(`Could not identify a target video asset with significant size. Assets found: ${Object.keys(chunksByAssetId).join(', ') || 'None'}`);
        }
        console.log(`Selected Asset ID ${targetAssetId} as target (largest video size).`);

        const assetData = chunksByAssetId[targetAssetId];
        const videoChunks = assetData.video;
        const audioChunks = assetData.audio;

        if (videoChunks.length === 0) {
            throw new Error(`No video chunks captured for the selected target asset ${targetAssetId}.`);
        }
        if (audioChunks.length === 0) {
            console.warn(`[WARN] No audio chunks captured for target asset ${targetAssetId}. The final video will be silent.`);
            // We'll proceed but skip audio download/merge later
        }

        // Sort chunks by starting byte
        videoChunks.sort((a, b) => a.bytestart - b.bytestart);
        audioChunks.sort((a, b) => a.bytestart - b.bytestart);

        // Check for obvious gaps after sorting (optional, but good sanity check)
        let lastVideoEnd = -1, videoGaps = 0;
        for(const chunk of videoChunks) {
            if(chunk.bytestart !== 0 && lastVideoEnd !== -1 && chunk.bytestart !== lastVideoEnd + 1) videoGaps++;
            lastVideoEnd = Math.max(lastVideoEnd, chunk.byteend);
        }
        if (videoGaps > 0) console.log(`[INFO] Detected ${videoGaps} potential gap(s) in video sequence for target asset.`);

        // --- Step 3: Prepare Download Paths ---
        const baseFilename = path.parse(outputFilename).name;
        tempVideoPath = path.join(OUTPUT_DIR, `${TEMP_FILE_PREFIX}${baseFilename}_${targetAssetId}_video.mp4`);
        tempAudioPath = path.join(OUTPUT_DIR, `${TEMP_FILE_PREFIX}${baseFilename}_${targetAssetId}_audio.m4a`);
        const finalOutputPath = path.join(OUTPUT_DIR, outputFilename);

        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }

        // --- Step 4: Download Streams ---
        console.log("\nStep 3: Downloading video stream...");
        await downloadStream(videoChunks, tempVideoPath, 'video', targetAssetId);

        if (audioChunks.length > 0) {
            console.log("\nStep 4: Downloading audio stream...");
            await downloadStream(audioChunks, tempAudioPath, 'audio', targetAssetId);
        } else {
            console.log("\nStep 4: Skipping audio download (no chunks found).");
        }

        // --- Step 5: Merge Streams ---
        if (audioChunks.length > 0) {
            console.log("\nStep 5: Merging video and audio...");
            await mergeWithFFmpeg(tempVideoPath, tempAudioPath, finalOutputPath);
        } else {
            // If no audio, just rename the temp video file
            console.log("\nStep 5: Renaming temporary video file (no audio to merge)...");
            fs.renameSync(tempVideoPath, finalOutputPath);
            tempVideoPath = ''; // Prevent deletion in finally block
        }

        console.log(`\n--- Success! ---`);
        console.log(`Final video saved to: ${finalOutputPath}`);

    } catch (error) {
        console.error('\n--- Download Failed ---');
        // Check if error is likely due to premature browser close before navigation/loading finished
        if (pageClosedManually && !targetAssetId && Object.keys(chunksByAssetId).length === 0) {
             console.error("Error: Browser was closed before significant video data could be collected.");
        } else if (error.message?.includes('ffmpeg') && error.message?.includes('ENOENT')) {
             // Specific FFmpeg not found message handled in merge function
        }
         else {
            console.error('Error:', error.message);
             if (error.stack && !error.message?.includes(error.stack.split('\n')[0])) {
                 console.error(error.stack);
             }
        }
        process.exitCode = 1; // Indicate failure

    } finally {
        // --- Step 6: Cleanup ---
        console.log('\nStep 6: Cleaning up...');
        // Ensure browser is closed if script failed before manual close
        if (browserController && !pageClosedManually) {
            console.log("Attempting to close browser...")
            await browserController.close();
        }
        // Delete temporary files
        try {
            if (tempVideoPath && fs.existsSync(tempVideoPath)) {
                fs.unlinkSync(tempVideoPath);
                console.log(`Deleted temp file: ${tempVideoPath}`);
            }
            if (tempAudioPath && fs.existsSync(tempAudioPath)) {
                fs.unlinkSync(tempAudioPath);
                console.log(`Deleted temp file: ${tempAudioPath}`);
            }
        } catch (cleanupError) {
            console.warn(`[WARN] Failed to delete temporary files: ${cleanupError.message}`);
        }
        console.log('--- Downloader Finished ---');
    }
}

// --- Execution ---
if (process.argv[1] && resolve(process.argv[1]) === __filename) { // Use path comparison
    const profilePath = process.env.FIREFOX_PROFILE_PATH || null; // Use null if not set
    const targetUrlArg = process.argv[2];
    let outputFilenameArg = process.argv[3] || `insta_reel_${Date.now()}.mp4`; // Default filename

    if (!targetUrlArg) {
        console.error('Usage: node src/instaReelDownloader.js <instagram_reel_url> [output_filename.mp4]');
        console.error('Example: node src/instaReelDownloader.js https://www.instagram.com/reel/C1abcDeFghI/ my_video.mp4');
        console.error('\nOptional: Set FIREFOX_PROFILE_PATH environment variable to use a specific Firefox profile for login.');
        process.exit(1);
    }

    if (!targetUrlArg.includes('instagram.com/reel/')) {
         console.warn("Warning: URL doesn't look like a standard Instagram Reel URL.");
    }

     // Basic validation for output filename
    if (!outputFilenameArg.toLowerCase().endsWith('.mp4')) {
         console.warn(`Warning: Output filename "${outputFilenameArg}" doesn't end with .mp4. Appending .mp4`);
         outputFilenameArg += '.mp4';
    }


    downloadInstagramReel(targetUrlArg, profilePath, outputFilenameArg)
        .catch(error => {
            // Catch potential top-level unhandled rejections
             console.error('Fatal error during script execution:', error);
            process.exit(1);
        });
}