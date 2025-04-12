/**
 * Instagram Post Comments Extractor
 * Using the validated logic from the working console script.
 */

// Comments extraction function - will be available globally
function extractCommentsFromPost(context = document) {
    console.log('📝 Starting comments extraction...');

    // --- Helper functions ---
    function safeGet(element, type = 'text', attribute = null) {
      if (!element) return null;
      try {
        if (type === 'text') return element.innerText.trim();
        if (type === 'attr' && attribute) return element.getAttribute(attribute);
        if (type === 'html') return element.innerHTML;
      } catch (e) { return null; }
      return null;
    }

    function extractNumber(text) {
      if (!text) return null;
      const match = text.replace(/,/g, '').match(/\d+/);
      return match ? parseInt(match[0], 10) : null;
    }

    // Initialize comments array
    const comments = [];

    // --- Comments ---
    const commentContainerSelector = '.x1l90r2v > div:nth-child(2)'; // Selector for the main comments container
    const commentListContainer = context.querySelector(commentContainerSelector);

    if (commentListContainer) {
      console.log("Found Comment Container:", commentContainerSelector);
      const commentElements = commentListContainer.querySelectorAll(':scope > div.x1uhb9sk');
      console.log(`Found ${commentElements.length} potential comment elements.`);

      commentElements.forEach((commentEl, index) => {
        const comment = {
          username: null,
          profileImageUrl: null,
          commentText: null, // Initialize as null
          timestamp: null,
          relativeTime: null,
          likesCount: 0,
          replyCount: 0
        };

        try { // Process each comment individually
          // --- Basic Comment Info (User, Time, Image) ---
          const contentBlock = commentEl.querySelector(':scope > div > div > div:nth-child(2)');
          const userLink = contentBlock.querySelector('a[role="link"][href^="/"]');
          const timeElement = contentBlock.querySelector('a[href*="/c/"] > time');
          const imageBlock = commentEl.querySelector(':scope > div > div > div:nth-child(1)');
          const img = imageBlock?.querySelector('img[alt*="profile picture"]');

          const userNameSpan = userLink?.querySelector('span._ap3a');
          comment.username = safeGet(userNameSpan, 'text') || safeGet(userLink, 'text');
          comment.timestamp = safeGet(timeElement, 'attr', 'datetime');
          comment.relativeTime = safeGet(timeElement, 'text');
          comment.profileImageUrl = safeGet(img, 'attr', 'src');

          // --- Comment Text Extraction (Using the specific selector that worked in Console V4) ---
                  const specificTextSelector = ':scope > div:nth-child(1) > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > span:nth-child(1)';
                  // We need contentBlock first, which is selected earlier (around line 53)
                  if (!contentBlock) {
                      console.warn(`Comment ${index}: Could not find standard content block.`);
                      comment.commentText = null; // Ensure it's null if block is missing
                  } else {
                      // Try to find the span using the specific selector relative to the contentBlock
                      console.log(`Comment ${index} (${comment.username}): Attempting specific selector relative to contentBlock: ${specificTextSelector}`);
                      const commentTextSpan = contentBlock.querySelector(specificTextSelector);

                      if (commentTextSpan) {
                          comment.commentText = safeGet(commentTextSpan, 'text');
                          console.log(`Comment ${index} (${comment.username}): SUCCESS - Found text via specific selector: "${comment.commentText}"`);
                      } else {
                          // If the specific selector fails, set text to null and log the HTML for debugging
                          comment.commentText = null;
                          console.warn(`Comment ${index} (${comment.username}): FAILED - Specific selector did not find the span within contentBlock.`);
                          console.warn(`Comment ${index} (${comment.username}): HTML of contentBlock:`, contentBlock.innerHTML);
                      }
                  }
                  // --- End of Comment Text Extraction ---


          // --- Comment Likes and Replies ---
          const actionButtons = commentEl.querySelectorAll(':scope div[role="button"]');
          actionButtons.forEach(button => {
            const buttonText = safeGet(button, 'text');
            if (buttonText) {
              if (buttonText.match(/like[s]?/i) && !buttonText.match(/repl(y|ies)/i)) {
                comment.likesCount = extractNumber(buttonText) ?? comment.likesCount;
              }
            }
          });

          const repliesContainer = commentEl.querySelector(':scope > div.x540dpk');
          if (repliesContainer) {
            const replyButtonSpan = repliesContainer.querySelector('span[dir="auto"]');
            const replyText = safeGet(replyButtonSpan, 'text');
            if (replyText && replyText.match(/repl(y|ies)/i)) {
              comment.replyCount = extractNumber(replyText) ?? comment.replyCount;
            }
          }

          // --- Add Comment to List ---
          if (comment.username) {
            comments.push(comment);
          } else {
            console.warn(`Comment ${index}: Skipping potential comment element, missing username.`);
          }
        } catch (commentError) {
          console.error(`Error processing comment ${index}:`, commentError, commentEl);
        }
      });
    } else {
      console.warn("Selector failed for Comment Container:", commentContainerSelector);
    }

    console.log(`✅ Extracted ${comments.length} comments successfully`);
    return comments;
}

// Make the function available globally
window.extractCommentsFromPost = extractCommentsFromPost;
console.log("comment-extractor.js: extractCommentsFromPost function attached to window.");