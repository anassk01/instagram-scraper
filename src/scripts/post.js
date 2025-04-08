/**
 * Instagram Post Metadata Extractor
 * This is a plain JavaScript version to avoid transpilation issues
 */

// Helper function to safely get text or attribute from an element
function safeGet(element, type = 'text', attribute = null) {
    if (!element) return null;
    try {
      if (type === 'text') return element.textContent?.trim() || null;
      if (type === 'attr' && attribute) return element.getAttribute(attribute);
      if (type === 'html') return element.innerHTML;
    } catch (e) { 
      return null; 
    }
    return null;
  }
  
  // Helper function to extract numbers from text
  function getNumberFromText(text) {
    if (!text) return null;
    const match = text.replace(/,/g, '').match(/\d+/);
    return match ? parseInt(match[0], 10) : null;
  }
  
  // Extract mentions and hashtags from an element
  function getTagsAndMentions(element, posterUsername) {
    const results = { mentions: [], hashtags: [] };
    if (!element) return results;
    
    Array.from(element.querySelectorAll('a[href^="/explore/tags/"]')).forEach(hashtagLink => {
      const tag = safeGet(hashtagLink, 'text');
      if (tag && tag.startsWith('#')) {
        results.hashtags.push({ 
          tag: tag, 
          tagUrl: safeGet(hashtagLink, 'attr', 'href') 
        });
      }
    });
    
    Array.from(element.querySelectorAll('a[href^="/"]:not([href*="/explore/tags/"])')).forEach(mentionLink => {
      const username = safeGet(mentionLink, 'text')?.replace('@', '');
      const href = safeGet(mentionLink, 'attr', 'href');
      // Basic validation + Exclude poster's own username
      if (username && href && href !== '/' && !username.includes('\n') && username !== posterUsername) {
        results.mentions.push({ 
          username: username, 
          profileUrl: href 
        });
      }
    });
    
    return results;
  }
  
  // Main extraction function
  function extractPost() {
    console.log('🔍 Instagram Post Metadata Scraper - Starting...');
    
    // Initialize post data with default values
    const postData = {
      posterUsername: null,
      posterImageUrl: null,
      isPosterVerified: false,
      isEdited: false,
      posterBlockRelativeTime: null,
      caption: null,
      mentionedUsersInCaption: [],
      hashtags: [],
      taggedUsersInHeader: [],
      likesCount: null,
      postTimestamp: null,
      postRelativeTime: null,
      postAbsoluteDateText: null,
      comments: [],
      scrapedAt: new Date().toISOString()
    };
    
    try {
      const context = document;
      console.log("Using document as context.");
  
      // --- Header Info - Tagged Users ---
      const headerMentionBlockSelector = '.xyinxu5 > div:nth-child(1)';
      const headerMentionBlock = context.querySelector(headerMentionBlockSelector);
      if (headerMentionBlock) {
        console.log("Found header mention block:", headerMentionBlockSelector);
        Array.from(headerMentionBlock.querySelectorAll('a[role="link"]')).forEach(link => {
          const username = safeGet(link.querySelector('span[dir="auto"]') || null, 'text') || safeGet(link, 'text');
          const img = link.closest('div')?.querySelector('img[alt*="profile picture"]');
          if (username) {
            postData.taggedUsersInHeader.push({
              username: username, 
              profileUrl: safeGet(link, 'attr', 'href'),
              profileImageUrl: safeGet(img || null, 'attr', 'src')
            });
          }
        });
      } else {
        console.warn("Selector failed for Header Mention Block:", headerMentionBlockSelector);
      }
  
      // --- Poster Info Block ---
      const posterDetailsSelector = '.x1l90r2v > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span:nth-child(1)';
      const posterDetailsContainer = context.querySelector(posterDetailsSelector);
      if (posterDetailsContainer) {
        console.log("Found Poster Details Container:", posterDetailsSelector);
        const posterLink = posterDetailsContainer.querySelector('a[role="link"]');
        const posterNameSpan = posterLink?.querySelector('span._ap3a');
        const timeElement = posterDetailsContainer.querySelector('time');
        const verifiedIcon = posterLink?.querySelector('svg[aria-label="Verified"]');
        const editedSpan = Array.from(posterDetailsContainer.querySelectorAll('span')).find(span => 
          span.textContent === 'Edited');
        
        postData.posterUsername = safeGet(posterNameSpan || null, 'text') || safeGet(posterLink || null, 'text');
        postData.posterBlockRelativeTime = safeGet(timeElement, 'text');
        postData.isPosterVerified = !!verifiedIcon;
        postData.isEdited = !!editedSpan;
        
        const imageContainer = posterDetailsContainer.closest('.x1l90r2v > div:nth-child(1) > div:nth-child(1)')?.querySelector('div:nth-child(1)');
        const posterImg = imageContainer?.querySelector('img[alt*="profile picture"]');
        postData.posterImageUrl = safeGet(posterImg || null, 'attr', 'src');
      } else {
        console.warn("Selector failed for Poster Details Container:", posterDetailsSelector);
      }
  
      // --- Caption ---
      const captionSelector = '.x1l90r2v > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span:nth-child(1) > span:nth-child(2)';
      let captionElement = context.querySelector(captionSelector);
      let captionSourceElement = null;
      
      if (captionElement) {
        console.log("Found Caption Element (Refined Selector):", captionSelector);
        postData.caption = safeGet(captionElement, 'text');
        captionSourceElement = captionElement;
      } else {
        console.warn("Refined selector failed for Caption:", captionSelector);
        const broaderCaptionContainerSelector = '.x1l90r2v > div:nth-child(1) > div:nth-child(1) > div:nth-child(2) > div:nth-child(1) > span:nth-child(1)';
        const broaderCaptionContainer = context.querySelector(broaderCaptionContainerSelector);
        
        if (broaderCaptionContainer) {
          console.log("Using broader caption container for text extraction fallback:", broaderCaptionContainerSelector);
          let fullText = safeGet(broaderCaptionContainer, 'text');
  
          if (fullText !== null) {
            let prefixParts = [];
            if (postData.posterUsername) prefixParts.push(postData.posterUsername);
            if (postData.isEdited) prefixParts.push('Edited');
            if (postData.posterBlockRelativeTime) prefixParts.push(postData.posterBlockRelativeTime);
            
            let cleanedText = fullText;
            if (prefixParts.length > 0) {
              let prefixRegexStr = '^\\s*' + prefixParts.map(part => part.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')).join('\\s*[•\\s]*\\s*') + '\\s*';
              const prefixRegex = new RegExp(prefixRegexStr, 'i');
              cleanedText = fullText.replace(prefixRegex, '');
              console.log(`Attempting to remove prefix matching: ${prefixRegexStr} from "${fullText}"`);
            }
            
            if (cleanedText.startsWith('.')) {
              cleanedText = cleanedText.substring(1).trim();
            }
            
            postData.caption = cleanedText.trim();
            console.log("Fallback caption attempt (cleaned):", postData.caption);
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
      
      // Extract mentions and hashtags from the caption
      if (captionSourceElement) {
        const tagsMentions = getTagsAndMentions(captionSourceElement, postData.posterUsername);
        postData.mentionedUsersInCaption = tagsMentions.mentions;
        postData.hashtags = tagsMentions.hashtags;
        console.log(`Extracted ${postData.hashtags.length} hashtags and ${postData.mentionedUsersInCaption.length} mentions (excluding poster) from caption.`);
      }
  
      // --- Likes Count (Post) ---
      const likesSelector = 'section.x12nagc a[href$="/liked_by/"] span > span.html-span';
      const likesElement = context.querySelector(likesSelector);
      if (likesElement) {
        postData.likesCount = getNumberFromText(safeGet(likesElement, 'text'));
        console.log("Found post likes count (Specific Selector):", postData.likesCount);
      } else {
        console.warn("Specific selector failed for Post Likes Count:", likesSelector);
        const heuristicLikesSelector = 'section a[href$="/liked_by/"], section button[type="button"] span';
        const heuristicLikesLink = context.querySelector(heuristicLikesSelector);
        if (heuristicLikesLink) {
          console.log("Using heuristic fallback for Post Likes Count.");
          postData.likesCount = getNumberFromText(safeGet(heuristicLikesLink, 'text'));
        } else {
          console.warn("Heuristic selector also failed for Likes Count.");
        }
      }
  
      // --- Post Date/Time (Bottom) ---
      const postTimeSelector = '.x1l90r2v > div:nth-child(3) time[datetime]';
      const postTimeElement = context.querySelector(postTimeSelector);
      if (postTimeElement) {
        postData.postTimestamp = safeGet(postTimeElement, 'attr', 'datetime');
        postData.postRelativeTime = safeGet(postTimeElement, 'text');
        postData.postAbsoluteDateText = safeGet(postTimeElement, 'title');
        console.log("Found post time element (bottom):", postTimeElement);
      } else {
        console.warn("Selector failed for Post Time (bottom):", postTimeSelector);
        const fallbackTimeSelector = 'a[href*="/p/"] > span > time[datetime], div > div > time[datetime]:not(:has(a[role="link"]))';
        const fallbackPostTimeElement = context.querySelector(fallbackTimeSelector);
        if (fallbackPostTimeElement && 
            !fallbackPostTimeElement.closest('ul') && 
            !fallbackPostTimeElement.closest('.x1l90r2v > div:nth-child(2)')) {
          console.log("Using fallback heuristic for Post Time.");
          postData.postTimestamp = safeGet(fallbackPostTimeElement, 'attr', 'datetime');
          postData.postRelativeTime = safeGet(fallbackPostTimeElement, 'text');
          postData.postAbsoluteDateText = safeGet(fallbackPostTimeElement, 'title');
        } else {
          console.warn("Fallback heuristic also failed for Post Time.");
        }
      }
  
      // --- Comments ---
      const commentContainerSelector = '.x1l90r2v > div:nth-child(2)';
      const commentListContainer = context.querySelector(commentContainerSelector);
  
      if (commentListContainer) {
        console.log("Found Comment Container:", commentContainerSelector);
        const commentElements = commentListContainer.querySelectorAll(':scope > div.x1uhb9sk');
        console.log(`Found ${commentElements.length} potential comment elements.`);
  
        Array.from(commentElements).forEach((commentEl, index) => {
          const comment = {
            username: null,
            profileImageUrl: null,
            commentText: null,
            timestamp: null,
            relativeTime: null,
            likesCount: 0,
            replyCount: 0
          };
  
          try {
            // --- Basic Comment Info (User, Time, Image) ---
            const contentBlock = commentEl.querySelector(':scope > div > div > div:nth-child(2)');
            if (!contentBlock) { 
              console.warn(`Comment ${index}: Could not find standard content block.`);
              return;
            }
            
            const userLink = contentBlock.querySelector('a[role="link"][href^="/"]');
            const timeElement = contentBlock.querySelector('a[href*="/c/"] > time');
            const imageBlock = commentEl.querySelector(':scope > div > div > div:nth-child(1)');
            const img = imageBlock?.querySelector('img[alt*="profile picture"]');
            
            const userNameSpan = userLink ? userLink.querySelector('span._ap3a') : null;
            comment.username = safeGet(userNameSpan || null, 'text') || safeGet(userLink || null, 'text');
            comment.timestamp = safeGet(timeElement, 'attr', 'datetime');
            comment.relativeTime = safeGet(timeElement, 'text');
            comment.profileImageUrl = safeGet(img || null, 'attr', 'src');
  
            // --- Comment Text Extraction ---
            let commentTextSpan = null;
            const userTimeDiv = contentBlock.querySelector(':scope > div:has(a[role="link"])');
            const textDiv = userTimeDiv?.nextElementSibling;
            
            if (textDiv) { 
              commentTextSpan = textDiv.querySelector(':scope > span[dir="auto"]');
            }
            
            if (!commentTextSpan) {
              const potentialTextSpans = contentBlock.querySelectorAll(':scope span[dir="auto"]');
              for (const span of Array.from(potentialTextSpans)) {
                if (!span.querySelector('a[role="link"]') && 
                    !span.querySelector('time') && 
                    safeGet(span, 'text')) {
                  commentTextSpan = span;
                  break;
                }
              }
            }
            
            comment.commentText = safeGet(commentTextSpan, 'text');
  
            // --- Comment Likes and Replies ---
            const actionButtons = commentEl.querySelectorAll(':scope div[role="button"]');
            Array.from(actionButtons).forEach(button => {
              const buttonText = safeGet(button, 'text');
              if (buttonText) {
                if (buttonText.match(/like[s]?/i) && !buttonText.match(/repl(y|ies)/i)) {
                  const likesCount = getNumberFromText(buttonText);
                  if (likesCount !== null) {
                    comment.likesCount = likesCount;
                  }
                }
              }
            });
            
            const repliesContainer = commentEl.querySelector(':scope > div.x540dpk');
            if (repliesContainer) {
              const replyButtonSpan = repliesContainer.querySelector('span[dir="auto"]');
              const replyText = safeGet(replyButtonSpan, 'text');
              if (replyText && replyText.match(/repl(y|ies)/i)) {
                const replyCount = getNumberFromText(replyText);
                if (replyCount !== null) {
                  comment.replyCount = replyCount;
                }
              }
            }
  
            // Validate and add comment
            if (comment.username) {
              postData.comments.push(comment);
            } else {
              console.warn(`Comment ${index}: Skipping potential comment element, missing username.`);
            }
          } catch (commentError) {
            console.error(`Error processing comment ${index}:`, commentError);
          }
        });
      } else {
        console.warn("Selector failed for Comment Container:", commentContainerSelector);
      }
  
      console.log('✅ Post metadata extracted successfully');
      return postData;
    } catch (error) {
      console.error('❌ Error extracting post metadata:', error);
      return postData; // Return partially filled or empty data on error
    }
  }
  
  // Execute function when run in browser
  function executeExtraction() {
    console.log('🚀 Executing Instagram Post extraction...');
    return extractPost();
  }
  
  // The script will run automatically through the directInjectionRunner