/**
 * Instagram Carousel Media Extractor
 */
window.instagramCarouselExtractor = (function() {
    console.log("🎠 Instagram Carousel Extractor script loaded.");

    const safeGet = (element, type = 'text', attribute = null) => {
        if (!element) return null;
        try {
            if (type === 'text') return element.innerText.trim();
            if (type === 'attr' && attribute) return element.getAttribute(attribute);
        } catch (e) { return null; }
        return null;
    };

    // ASYNC Function specifically for extracting carousel media
    async function extractCarouselMedia(context = document) {
        console.log("🎠 Attempting Carousel Extraction...");
        const results = {
            type: 'carousel', // Assume carousel since this function is called
            items: []
        };

        // --- Selectors ---
        const dotsContainerSelector = "div._acnb"; // Simpler selector for dots container
        const dotSelector = "div._acnb > div"; // Individual dot element
        const activeMediaSelector = "ul._acay > li._acaz:not([aria-hidden='true']) img.x5yr21d, ul._acay > li._acaz:not([aria-hidden='true']) video.x5yr21d"; // Active item
        const nextButtonSelector = "button[aria-label='Next']";
        const prevButtonSelector = "button[aria-label='Previous']";
        const carouselItemSelector = "ul._acay > li._acaz"; // ALL individual <li> items
        const mediaInsideItemSelector = "img.x5yr21d, video.x5yr21d"; // Media within an item

        const mediaItems = []; // Temp array to hold found items before finalizing
        const uniqueUrls = new Set();

        // --- Helper: Get current visible media item ---
        function getCurrentMediaItem(scope = document) {
            const mediaElement = scope.querySelector(activeMediaSelector);
            if (!mediaElement) return null;
            const url = safeGet(mediaElement, 'attr', 'src');
            if (!url) return null;
            const type = mediaElement.tagName === 'IMG' ? 'image' : 'video';
            const alt = type === 'image' ? safeGet(mediaElement, 'attr', 'alt') : 'Video content';
            return { url, alt, type };
        }

        // --- Estimate total items ---
        const dotsContainer = context.querySelector(dotsContainerSelector);
        let expectedTotal = 0;
        if (dotsContainer) {
            expectedTotal = dotsContainer.querySelectorAll(dotSelector).length;
            console.log(`Found ${expectedTotal} dots.`);
        } else {
            const listItems = context.querySelectorAll(carouselItemSelector);
             // Only count if more than 1, otherwise it's likely not a carousel handled here
            if (listItems.length > 1) {
                 expectedTotal = listItems.length;
                 console.log(`No dots found, estimated ${expectedTotal} items from list item count.`);
            } else {
                console.log("No dots and less than 2 list items found. Carousel extraction might fail.");
                // Fallback to 0 or 1? Let's try based on buttons.
                if(context.querySelector(nextButtonSelector)) expectedTotal = 2; // Guess at least 2 if next exists
                else expectedTotal = 0; // Give up estimation
            }

        }
        if (expectedTotal === 0 && context.querySelector(nextButtonSelector)) {
             console.warn("Next button found, but couldn't estimate total items. Will click until button disappears.");
             expectedTotal = 100; // Set a high artificial limit for clicking loop
        } else if (expectedTotal === 0) {
            console.warn("Could not determine number of carousel items. DOM scan will be primary method.");
        }


        // --- Rewind to Start ---
        const prevButton = context.querySelector(prevButtonSelector);
        if (prevButton && prevButton.offsetParent) {
            console.log("Attempting to rewind to the first item...");
            let rewindCount = 0;
            const maxRewinds = (expectedTotal > 0 && expectedTotal < 50) ? expectedTotal + 2 : 15; // Safety limit
            while (prevButton && prevButton.offsetParent && rewindCount < maxRewinds) {
                prevButton.click();
                await new Promise(resolve => setTimeout(resolve, 150));
                rewindCount++;
            }
            console.log(`Clicked previous ${rewindCount} times.`);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // --- Click through items ---
        const nextButton = context.querySelector(nextButtonSelector);
        let clickCount = 0;
        const maxClicks = (expectedTotal > 0 && expectedTotal < 50) ? expectedTotal - 1 : 15; // Limit clicks

        // Get initial item *after* rewinding
        let currentMedia = getCurrentMediaItem(context);
        if (currentMedia && !uniqueUrls.has(currentMedia.url)) {
            mediaItems.push(currentMedia);
            uniqueUrls.add(currentMedia.url);
            console.log(`[${uniqueUrls.size}/${expectedTotal || '?'}] Captured initial ${currentMedia.type}: ${currentMedia.url.substring(0, 50)}...`);
        }

        if (nextButton) {
             console.log(`Attempting to click 'Next' up to ${maxClicks} times.`);
             while(clickCount < maxClicks) {
                  if (!nextButton || !nextButton.offsetParent) {
                       console.log(`'Next' button disappeared after ${clickCount} clicks.`);
                       break;
                  }
                  try {
                       nextButton.click();
                       clickCount++;
                       await new Promise(resolve => setTimeout(resolve, 750)); // Wait

                       currentMedia = getCurrentMediaItem(context);
                       if (currentMedia && !uniqueUrls.has(currentMedia.url)) {
                            mediaItems.push(currentMedia);
                            uniqueUrls.add(currentMedia.url);
                            console.log(`[${uniqueUrls.size}/${expectedTotal || '?'}] Captured ${currentMedia.type} after click ${clickCount}: ${currentMedia.url.substring(0, 50)}...`);
                       }
                       // Safety break if we collect the expected number
                       if (uniqueUrls.size >= expectedTotal && expectedTotal > 0 && expectedTotal < 50) break;
                  } catch (e) {
                       console.error(`Error clicking 'Next' on iteration ${clickCount + 1}:`, e);
                       break;
                  }
             }
        } else {
             console.log("'Next' button not found. Relying on DOM scan.");
        }

        // --- Fallback/Verification DOM Scan ---
        console.log("Performing final DOM scan...");
        const allListItems = context.querySelectorAll(carouselItemSelector);
        if (allListItems.length > uniqueUrls.size || uniqueUrls.size === 0) {
            console.log(`Found ${allListItems.length} list items. Checking for new media...`);
            allListItems.forEach((item, index) => {
                const mediaElement = item.querySelector(mediaInsideItemSelector);
                if (mediaElement) {
                    const url = safeGet(mediaElement, 'attr', 'src');
                    if (url && !uniqueUrls.has(url)) {
                        const type = mediaElement.tagName === 'IMG' ? 'image' : 'video';
                        const alt = type === 'image' ? safeGet(mediaElement, 'attr', 'alt') : 'Video content';
                        const newItem = { url, alt, type };
                        mediaItems.push(newItem);
                        uniqueUrls.add(url);
                        console.log(`[DOM Scan] Found new ${newItem.type} in item ${index + 1}: ${url.substring(0, 50)}...`);
                    }
                }
            });
        }

        console.log(`🎠 Carousel extraction finished. Found ${uniqueUrls.size} unique media items.`);

        // Populate final results ensuring uniqueness
        uniqueUrls.forEach(url => {
            const foundItem = mediaItems.find(item => item.url === url);
            if (foundItem) results.items.push(foundItem);
        });

         if (results.items.length === 0) {
             console.error("Carousel extraction failed to find any items.");
             results.type = 'unknown'; // Update type if nothing found
         } else if (expectedTotal > 0 && expectedTotal < 50 && results.items.length < expectedTotal) {
             console.warn(`Expected ${expectedTotal} items based on dots/estimate, but only found ${results.items.length}.`);
         }


        return results;
    }

    // Expose the async function globally
    return {
        extractCarouselMedia: extractCarouselMedia
    };

})();

window.extractCarouselMedia = window.instagramCarouselExtractor.extractCarouselMedia;
console.log("carousel-extractor.js: extractCarouselMedia async function attached to window.");