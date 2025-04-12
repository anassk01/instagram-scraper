/**
 * Instagram Post Metadata Extractor (Main Orchestrator)
 * Detects post type and calls specific media/comment extractors.
 *
 * Note: Expects comment/image/video/carousel extractors to be loaded first.
 */

// --- Helper Functions (keep locally scoped or ensure global availability) ---
const safeGet = (element, type = 'text', attribute = null) => {
    // ... (implementation as before)
    if (!element) return null;
    try {
        if (type === 'text') return element.innerText.trim();
        if (type === 'attr' && attribute) return element.getAttribute(attribute);
        if (type === 'html') return element.innerHTML;
    } catch (e) { return null; }
    return null;
};
const extractNumber = (text) => {
    // ... (implementation as before)
     if (!text) return null;
     const match = text.replace(/,/g, '').match(/\d+/);
     return match ? parseInt(match[0], 10) : null;
};
const extractTagsMentions = (element, posterUsername) => {
    // ... (implementation as before)
     const results = { mentions: [], hashtags: [] };
     if (!element) return results;
     element.querySelectorAll('a[href^="/explore/tags/"]').forEach(hashtagLink => {
         const tag = safeGet(hashtagLink, 'text');
         if (tag && tag.startsWith('#')) {
             results.hashtags.push({ tag: tag, tagUrl: safeGet(hashtagLink, 'attr', 'href') });
         }
     });
     element.querySelectorAll('a[href^="/"]:not([href*="/explore/tags/"])').forEach(mentionLink => {
         const username = safeGet(mentionLink, 'text')?.replace('@', '');
         const href = safeGet(mentionLink, 'attr', 'href');
         // Basic validation + Exclude poster's own username
         if (username && href && href !== '/' && !username.includes('\n') && username !== posterUsername) {
              results.mentions.push({ username: username, profileUrl: href });
         }
     });
     return results;
};

// --- Main Scraper Function (Now Async) ---
async function scrapePostInfo() { // Marked async
    const context = document;
    console.log("🚀 Starting Post Info Scraping (Orchestrator)...");

    const postData = {
        // --- Basic Info ---
        posterUsername: null,
        posterImageUrl: null,
        isPosterVerified: false,
        isEdited: false,
        posterBlockRelativeTime: null,
        // --- Caption ---
        caption: null,
        mentionedUsersInCaption: [],
        hashtags: [],
        // --- Tags/Header ---
        taggedUsersInHeader: [],
        // --- Stats ---
        likesCount: null,
        // --- Timing ---
        postTimestamp: null,
        postRelativeTime: null,
        postAbsoluteDateText: null,
        // --- Extracted Content ---
        media: { type: 'unknown', items: [] }, // Initialize media object
        comments: [], // Initialize comments array
        // --- Meta ---
        scrapedAt: new Date().toISOString(),
        url: window.location.href
    };

    try { // Wrap main scraping logic in try-catch
        // --- Header Info ---
        const headerMentionBlockSelector = '.xyinxu5 > div:nth-child(1)';
        // ... (rest of header info extraction logic as before) ...
        const headerMentionBlock = context.querySelector(headerMentionBlockSelector);
        if (headerMentionBlock) {
            // console.log("Found header mention block:", headerMentionBlockSelector);
            headerMentionBlock.querySelectorAll('a[role="link"]').forEach(link => {
                const username = safeGet(link.querySelector('span[dir="auto"]'), 'text') || safeGet(link, 'text');
                const img = link.closest('div')?.querySelector('img[alt*="profile picture"]');
                if (username) {
                    postData.taggedUsersInHeader.push({
                        username: username, profileUrl: safeGet(link, 'attr', 'href'),
                        profileImageUrl: safeGet(img, 'attr', 'src')
                    });
                }
            });
        } else {
            console.warn("Selector failed for Header Mention Block:", headerMentionBlockSelector);
        }


        // --- Poster Info Block ---
        const posterDetailsSelector = '.x1l90r2v > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span:nth-child(1)';
        // ... (rest of poster info extraction logic as before) ...
         const posterDetailsContainer = context.querySelector(posterDetailsSelector);
         if (posterDetailsContainer) {
              // console.log("Found Poster Details Container:", posterDetailsSelector);
              const posterLink = posterDetailsContainer.querySelector('a[role="link"]');
              const posterNameSpan = posterLink?.querySelector('span._ap3a');
              const timeElement = posterDetailsContainer.querySelector('time');
              const verifiedIcon = posterLink?.querySelector('svg[aria-label="Verified"]');
              const editedSpan = Array.from(posterDetailsContainer.querySelectorAll('span')).find(span => span.innerText === 'Edited');
              postData.posterUsername = safeGet(posterNameSpan, 'text') || safeGet(posterLink, 'text'); // Store posterUsername
              postData.posterBlockRelativeTime = safeGet(timeElement, 'text');
              postData.isPosterVerified = !!verifiedIcon;
              postData.isEdited = !!editedSpan;
              const imageContainer = posterDetailsContainer.closest('.x1l90r2v > div:nth-child(1) > div:nth-child(1)')?.querySelector('div:nth-child(1)');
              const posterImg = imageContainer?.querySelector('img[alt*="profile picture"]');
              postData.posterImageUrl = safeGet(posterImg, 'attr', 'src');
         } else {
             console.warn("Selector failed for Poster Details Container:", posterDetailsSelector);
         }

        // --- Caption ---
        const captionSelector = '.x1l90r2v > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span:nth-child(1) > span:nth-child(2)';
        // ... (rest of caption extraction logic + fallback as before) ...
         let captionElement = context.querySelector(captionSelector);
         let captionSourceElement = null;
         if (captionElement) {
             // console.log("Found Caption Element (Refined Selector):", captionSelector);
             postData.caption = safeGet(captionElement, 'text');
             captionSourceElement = captionElement;
         } else {
             // console.warn("Refined selector failed for Caption:", captionSelector);
             const broaderCaptionContainerSelector = '.x1l90r2v > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span:nth-child(1)';
             const broaderCaptionContainer = context.querySelector(broaderCaptionContainerSelector);
             if (broaderCaptionContainer) {
                 // console.log("Using broader caption container for text extraction fallback:", broaderCaptionContainerSelector);
                 let fullText = safeGet(broaderCaptionContainer, 'text'); // Use 'text' (trimmed innerText)

                 if (fullText !== null) { // Check needed here
                     let prefixParts = [];
                     if (postData.posterUsername) prefixParts.push(postData.posterUsername);
                     if (postData.isEdited) prefixParts.push('Edited');
                     if (postData.posterBlockRelativeTime) prefixParts.push(postData.posterBlockRelativeTime);
                     let cleanedText = fullText;
                     if (prefixParts.length > 0) {
                         let prefixRegexStr = '^\\s*' + prefixParts.map(part => part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('\\s*[•\\s]*\\s*') + '\\s*';
                         const prefixRegex = new RegExp(prefixRegexStr, 'i');
                         cleanedText = fullText.replace(prefixRegex, '');
                         // console.log(`Attempting to remove prefix matching: ${prefixRegexStr} from "${fullText}"`);
                     }
                     if (cleanedText.startsWith('.')) {
                         cleanedText = cleanedText.substring(1).trim();
                     }
                     postData.caption = cleanedText.trim();
                     // console.log("Fallback caption attempt (cleaned):", postData.caption);
                     captionSourceElement = broaderCaptionContainer;
                 } else {
                      console.warn("Failed to get text from broader caption container.");
                      postData.caption = null;
                      captionSourceElement = null;
                 }
             } else {
                 console.warn("Broad fallback selector also failed for Caption:", broaderCaptionContainerSelector);
             }
         }

         // Pass posterUsername to filter mentions
         if (captionSourceElement) {
             const tagsMentions = extractTagsMentions(captionSourceElement, postData.posterUsername);
             postData.mentionedUsersInCaption = tagsMentions.mentions;
             postData.hashtags = tagsMentions.hashtags;
             // console.log(`Extracted ${postData.hashtags.length} hashtags and ${postData.mentionedUsersInCaption.length} mentions (excluding poster) from caption.`);
         }

        // --- Likes Count ---
        const likesSelector = 'section.x12nagc a[href$="/liked_by/"] span > span.html-span';
        // ... (rest of likes extraction logic as before) ...
        const likesElement = context.querySelector(likesSelector);
        if (likesElement) {
            postData.likesCount = extractNumber(safeGet(likesElement, 'text'));
            // console.log("Found post likes count (Specific Selector):", postData.likesCount);
        } else {
            // console.warn("Specific selector failed for Post Likes Count:", likesSelector);
            const heuristicLikesSelector = 'section a[href$="/liked_by/"], section button[type="button"] span'; // Broader selector
            const heuristicLikesElements = context.querySelectorAll(heuristicLikesSelector);
            // Find the element that likely contains the number
            let foundLikesText = null;
            heuristicLikesElements.forEach(el => {
                const text = safeGet(el, 'text');
                if(text && text.match(/\d/)) { // Check if text contains a digit
                    // Prefer spans, or links containing 'liked_by'
                    if(el.tagName === 'SPAN' || (el.tagName === 'A' && el.href.includes('liked_by'))) {
                         foundLikesText = text;
                    }
                }
            });

            if (foundLikesText) {
                 console.log("Using heuristic fallback for Post Likes Count.");
                 postData.likesCount = extractNumber(foundLikesText);
            } else {
                  console.warn("Heuristic selector also failed for Likes Count.");
            }
        }


        // --- Post Date/Time ---
        const postTimeSelector = '.x1l90r2v > div:nth-child(3) time[datetime]';
        // ... (rest of post time extraction logic as before) ...
        const postTimeElement = context.querySelector(postTimeSelector);
        if (postTimeElement) {
            postData.postTimestamp = safeGet(postTimeElement, 'attr', 'datetime');
            postData.postRelativeTime = safeGet(postTimeElement, 'text');
            postData.postAbsoluteDateText = safeGet(postTimeElement, 'title');
            // console.log("Found post time element (bottom):", postTimeElement);
        } else {
            // console.warn("Selector failed for Post Time (bottom):", postTimeSelector);
            // Simpler fallback: Find any time element within the main article, not in comments/header
            const fallbackTimeSelector = 'main[role="main"] article time[datetime]';
            const fallbackPostTimeElements = context.querySelectorAll(fallbackTimeSelector);
             // Find the one that's likely the main post time (often the last one, or one with a title attribute)
            let chosenTimeElement = null;
            fallbackPostTimeElements.forEach(el => {
                 // Avoid times inside comments or user blocks
                 if (!el.closest('.x1l90r2v > div:nth-child(2)') && !el.closest('.x1l90r2v > div:nth-child(1) > div:nth-child(1)')) {
                      // Prefer elements with a 'title' (absolute date) or just take the last valid one
                      if(el.hasAttribute('title')) chosenTimeElement = el;
                      else if (!chosenTimeElement) chosenTimeElement = el; // Take first valid if no title found yet
                 }
            });

            if (chosenTimeElement) {
                 console.log("Using fallback heuristic for Post Time.");
                 postData.postTimestamp = safeGet(chosenTimeElement, 'attr', 'datetime');
                 postData.postRelativeTime = safeGet(chosenTimeElement, 'text');
                 postData.postAbsoluteDateText = safeGet(chosenTimeElement, 'title');
            } else {
                  console.warn("Fallback heuristic also failed for Post Time.");
            }
        }


        // --- Detect Post Type & Extract Media ---
        console.log("🕵️ Detecting post media type...");
        const hasCarouselDots = !!context.querySelector("div._acnb");
        const hasCarouselNextButton = !!context.querySelector("button[aria-label='Next']");
        // Check specifically for VIDEO tag in main content area, avoiding carousel lists
        const hasPrimaryVideo = !!context.querySelector('main[role="main"] article video.x5yr21d:not(li video)');

        if (hasCarouselDots || hasCarouselNextButton) {
            console.log("Carousel indicators detected. Calling extractCarouselMedia...");
            if (typeof window.extractCarouselMedia === 'function') {
                try {
                    postData.media = await window.extractCarouselMedia(context); // Await async function
                } catch (e) {
                     console.error("Error calling extractCarouselMedia:", e);
                     postData.media = { type: 'carousel', items: [], error: e.message };
                }
            } else {
                 console.error("Carousel detected, but extractCarouselMedia function not found!");
                 postData.media = { type: 'carousel', items: [], error: 'Extractor function missing' };
            }
        } else if (hasPrimaryVideo) {
            console.log("Primary video element detected. Calling extractSingleVideo...");
            if (typeof window.extractSingleVideo === 'function') {
                 try {
                    postData.media = window.extractSingleVideo(context);
                 } catch (e) {
                     console.error("Error calling extractSingleVideo:", e);
                     postData.media = { type: 'video', items: [], error: e.message };
                 }
            } else {
                 console.error("Video detected, but extractSingleVideo function not found!");
                 postData.media = { type: 'video', items: [], error: 'Extractor function missing' };
            }
        } else {
            console.log("Assuming single image post. Calling extractSingleImage...");
            if (typeof window.extractSingleImage === 'function') {
                 try {
                    postData.media = window.extractSingleImage(context);
                 } catch (e) {
                     console.error("Error calling extractSingleImage:", e);
                     postData.media = { type: 'image', items: [], error: e.message };
                 }
            } else {
                 console.error("Image post assumed, but extractSingleImage function not found!");
                 postData.media = { type: 'image', items: [], error: 'Extractor function missing' };
            }
        }
        console.log(`Media extraction result: Type=${postData.media.type}, Items=${postData.media.items?.length ?? 0}`);


        // --- Comments ---
        if (typeof window.extractCommentsFromPost === 'function') {
            try {
                console.log("Calling extractCommentsFromPost...");
                postData.comments = window.extractCommentsFromPost(context); // Call the separate comments extractor
                console.log(`Comment extraction result: Count=${postData.comments.length}`);
            } catch (e) {
                console.error("Error calling extractCommentsFromPost:", e);
                postData.comments = []; // Ensure it's an empty array on error
            }
        } else {
            console.warn("extractCommentsFromPost function not found! Ensure comment-extractor.js is loaded.");
            postData.comments = [];
        }

    } catch (error) {
        console.error("A critical error occurred during main scraping function:", error);
        // Add error info to the data object itself
        postData.error = `Critical scraping error: ${error.message}`;
        postData.errorStack = error.stack;
    }

    // Clean up potentially undefined values before returning
    for (const key in postData) {
        if (postData[key] === undefined) {
            postData[key] = null;
        }
    }
    // Ensure nested objects also exist
    if (!postData.media) postData.media = { type: 'unknown', items: [] };
    if (!postData.comments) postData.comments = [];


    console.log("✅ Post data scraping complete!");
    return postData;
}

// --- Function to execute the extraction and return the result (Now Async) ---
async function executeExtraction() { // Marked async
    console.log("🚀 Starting extraction execution...");
    try {
        // Execute async extraction and store globally
        const data = await scrapePostInfo(); // Await the async scraping function
        window.instagramPostData = data;
        console.log("📊 Extraction complete! Data stored in window.instagramPostData.");
        return window.instagramPostData;
    } catch (error) {
        console.error("Error during executeExtraction:", error);
        const errorData = {
            error: `ExecuteExtraction Error: ${error.message}`,
            stack: error.stack,
            url: window.location.href,
            timestamp: new Date().toISOString()
        };
        window.instagramPostData = errorData;
        return errorData;
    }
}

// Make the main execution function globally available
window.executeExtraction = executeExtraction; // Overwrite previous definition if any
console.log("post.js: executeExtraction async function attached to window.");