/**
 * Instagram Single Video Extractor
 */
window.instagramVideoExtractor = (function() {
    console.log("🎬 Instagram Single Video Extractor script loaded.");

    const safeGet = (element, type = 'text', attribute = null) => {
        if (!element) return null;
        try {
            if (type === 'text') return element.innerText.trim();
            if (type === 'attr' && attribute) return element.getAttribute(attribute);
        } catch (e) { return null; }
        return null;
    };

    // Function specifically for extracting single video data
    function extractSingleVideo(context = document) {
        console.log("🎬 Attempting Single Video Extraction...");
        const results = {
            type: 'video',
            items: []
        };

        // Selectors targeting the main video element in single video posts
        const mainVideoSelectors = [
            'main[role="main"] article ._aatk ._aatl video.x5yr21d', // Common path
            'main[role="main"] article div[role="presentation"] video.x5yr21d', // Alt structure
            'main[role="main"] article video[preload="auto"]',     // More general
            '.x1qjc9v5 video.x5yr21d'                             // Another container
        ];

        let foundVideo = null;

        for (const selector of mainVideoSelectors) {
            const videoElement = context.querySelector(selector);
            // Ensure it's not inside a list (carousel item)
            if (videoElement && !videoElement.closest('ul') && !videoElement.closest('li')) {
                console.log(`Found potential video element using selector: ${selector}`);
                const url = safeGet(videoElement, 'attr', 'src'); // Often a blob URL
                if (url) {
                    foundVideo = { url: url, alt: "Video content", type: "video", posterUrl: null };

                    // Attempt to find the associated poster image
                    const videoContainer = videoElement.closest('._aatk') || // Common parent div
                                           videoElement.closest('div[role="presentation"]') ||
                                           videoElement.parentElement;
                    // Common poster image classes/selectors relative to video container
                    const posterSelectors = ['img._aagt', 'img[style*="object-fit: cover"]', 'img.x5yr21d'];
                    if(videoContainer) {
                        for (const posterSel of posterSelectors) {
                            const posterImg = videoContainer.querySelector(posterSel);
                            // Make sure poster is not the video element itself (if selector is too broad)
                            // and it looks like an image src
                            if (posterImg && posterImg.tagName === 'IMG' && posterImg.src && posterImg.src.startsWith('http')) {
                                const posterUrl = safeGet(posterImg, 'attr', 'src');
                                // Avoid assigning the video blob url as poster
                                if (posterUrl && !posterUrl.startsWith('blob:')) {
                                     foundVideo.posterUrl = posterUrl;
                                     console.log("Found associated video poster:", posterUrl.substring(0,50)+"...");
                                     break; // Found poster
                                }
                            }
                        }
                    }
                    if (!foundVideo.posterUrl) console.log("Could not find associated poster image.");
                    break; // Stop searching once a likely main video is found
                }
            }
        }

        if (foundVideo) {
            results.items.push(foundVideo);
            console.log(`🎬 Single Video extraction finished. Found src: ${foundVideo.url.substring(0, 50)}...`);
        } else {
            console.log("🎬 Single Video extraction failed to find a primary video using known selectors.");
            results.type = 'unknown'; // Indicate failure
        }
        return results;
    }

    // Expose the function globally
    return {
        extractSingleVideo: extractSingleVideo
    };
})();

window.extractSingleVideo = window.instagramVideoExtractor.extractSingleVideo;
console.log("video-extractor.js: extractSingleVideo function attached to window.");