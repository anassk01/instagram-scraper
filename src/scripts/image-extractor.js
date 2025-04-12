/**
 * Instagram Single Image Extractor
 */
window.instagramImageExtractor = (function() {
    console.log("🖼️ Instagram Single Image Extractor script loaded.");

    const safeGet = (element, type = 'text', attribute = null) => {
        if (!element) return null;
        try {
            if (type === 'text') return element.innerText.trim();
            if (type === 'attr' && attribute) return element.getAttribute(attribute);
        } catch (e) { return null; }
        return null;
    };

    // Function specifically for extracting single image data
    function extractSingleImage(context = document) {
        console.log("🖼️ Attempting Single Image Extraction...");
        const results = {
            type: 'image',
            items: []
        };

        // Selectors targeting the main image container in single image posts
        const mainImageSelectors = [
            'main[role="main"] article ._aatk ._aatl img.x5yr21d',          // Common path
            'main[role="main"] article div[role="presentation"] img.x5yr21d', // Alt structure
            'div._aagv img.x5yr21d',                                     // Another common container
            '.x1qjc9v5 .x5yr21d.x1ey2m1c.xds687c.x5yr21d.x10l6tqk.x17qophe.x13vifvy.xh8yej3' // Specific fallback
            // Add more selectors here if needed based on observation
        ];

        let foundImage = null;

        for (const selector of mainImageSelectors) {
            const imgElement = context.querySelector(selector);
            // Ensure it's not inside a list (carousel item) and not a tiny profile pic
            if (imgElement && !imgElement.closest('ul') && !imgElement.closest('li') && imgElement.width > 100 ) { // Basic sanity checks
                 console.log(`Found potential image element using selector: ${selector}`);
                 const url = safeGet(imgElement, 'attr', 'src');
                 const alt = safeGet(imgElement, 'attr', 'alt');
                 if (url) {
                    foundImage = { url: url, alt: alt, type: "image" };
                    break; // Stop searching once a likely main image is found
                 }
            }
        }

        if (foundImage) {
            results.items.push(foundImage);
            console.log(`🖼️ Single Image extraction finished. Found: ${foundImage.url.substring(0, 50)}...`);
        } else {
            console.log("🖼️ Single Image extraction failed to find a primary image using known selectors.");
            results.type = 'unknown'; // Indicate failure if no image found
        }
        return results;
    }

    // Expose the function globally
    return {
        extractSingleImage: extractSingleImage
    };
})();

window.extractSingleImage = window.instagramImageExtractor.extractSingleImage;
console.log("image-extractor.js: extractSingleImage function attached to window.");