/**
 * Instagram Post Metadata Extractor
 * 
 * This script extracts post metadata from an Instagram post page.
 * It can be used directly in the browser console or via automation.
 */

// Type definitions for browser environment
interface Window {
  instagramPostData: any;
  __SCRAPER_IMPORT__?: boolean;
}

// Type definitions for post data
interface TaggedUser {
  username: string;
  profileUrl: string | null;
  profileImageUrl?: string | null;
}

interface Hashtag {
  tag: string;
  tagUrl: string | null;
}

interface Comment {
  username: string | null;
  profileImageUrl: string | null;
  commentText: string | null;
  timestamp: string | null;
  relativeTime: string | null;
  likesCount: number;
  replyCount: number;
}

interface PostData {
  posterUsername: string | null;
  posterImageUrl: string | null;
  isPosterVerified: boolean;
  isEdited: boolean;
  posterBlockRelativeTime: string | null;
  caption: string | null;
  mentionedUsersInCaption: TaggedUser[];
  hashtags: Hashtag[];
  taggedUsersInHeader: TaggedUser[];
  likesCount: number | null;
  postTimestamp: string | null;
  postRelativeTime: string | null;
  postAbsoluteDateText: string | null;
  comments: Comment[];
  scrapedAt: string;
}

/**
* Helper function to safely get text or attribute from an element
* @param element The DOM element to extract data from
* @param type Type of data to extract (text, attr, html)
* @param attribute Optional attribute name when type is 'attr'
* @returns The extracted data or null if element is not found
*/
function safeGet(element: Element | null, type = 'text', attribute: string | null = null): string | null {
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

/**
* Helper function to extract numbers from text
* @param text The text to extract numbers from
* @returns The extracted number or null if not found
*/
function extractNumber(text: string | null): number | null {
  if (!text) return null;
  const match = text.replace(/,/g, '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

/**
* Function to extract mentions and hashtags from an element
* @param element The DOM element to extract from
* @param posterUsername The username of the poster to exclude from mentions
* @returns Object containing arrays of mentions and hashtags
*/
function extractTagsMentions(element: Element | null, posterUsername: string | null): { mentions: TaggedUser[], hashtags: Hashtag[] } {
  const results = { mentions: [] as TaggedUser[], hashtags: [] as Hashtag[] };
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

/**
* Main function to extract post data from an Instagram post page
* @returns Object containing the post data
*/
function extractPost(): PostData {
  console.log('🔍 Instagram Post Metadata Scraper - Starting...');
  
  // Initialize post data with default values
  const postData: PostData = {
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
                  let prefixParts: string[] = [];
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
          const tagsMentions = extractTagsMentions(captionSourceElement, postData.posterUsername);
          postData.mentionedUsersInCaption = tagsMentions.mentions;
          postData.hashtags = tagsMentions.hashtags;
          console.log(`Extracted ${postData.hashtags.length} hashtags and ${postData.mentionedUsersInCaption.length} mentions (excluding poster) from caption.`);
      }

      // --- Likes Count (Post) ---
      const likesSelector = 'section.x12nagc a[href$="/liked_by/"] span > span.html-span';
      const likesElement = context.querySelector(likesSelector);
      if (likesElement) {
          postData.likesCount = extractNumber(safeGet(likesElement, 'text'));
          console.log("Found post likes count (Specific Selector):", postData.likesCount);
      } else {
          console.warn("Specific selector failed for Post Likes Count:", likesSelector);
          const heuristicLikesSelector = 'section a[href$="/liked_by/"], section button[type="button"] span';
          const heuristicLikesLink = context.querySelector(heuristicLikesSelector);
          if (heuristicLikesLink) {
              console.log("Using heuristic fallback for Post Likes Count.");
              postData.likesCount = extractNumber(safeGet(heuristicLikesLink, 'text'));
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
              const comment: Comment = {
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
                              const likesCount = extractNumber(buttonText);
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
                          const replyCount = extractNumber(replyText);
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

/**
* Function to execute extraction and return the result
* @returns The extracted post data
*/
function executeExtraction(): PostData {
  const result = extractPost();
  console.log('Post metadata:', result);
  
  // Log the key fields in an organized way
  console.log("\n--- Extracted Post Information ---");
  console.log("Poster Username:", result.posterUsername);
  console.log("Poster Image URL:", result.posterImageUrl);
  console.log("Poster Verified:", result.isPosterVerified);
  console.log("Post Edited:", result.isEdited);
  console.log("Poster Block Time:", result.posterBlockRelativeTime);
  console.log("Tagged Users (Header):", result.taggedUsersInHeader?.map(u => u.username).join(', ') || 'None');
  console.log("Caption:", result.caption);
  console.log("Likes Count:", result.likesCount);
  console.log("Post Timestamp:", result.postTimestamp);
  console.log("Post Text Time (Bottom):", result.postRelativeTime);
  console.log("Post Absolute Date (Bottom):", result.postAbsoluteDateText);
  console.log(`Comments: ${result.comments.length}`);
  
  return result;
}

// Auto-execute when run directly in browser console
if (typeof window !== 'undefined' && (window as any).__SCRAPER_IMPORT__ !== true) {
  console.log('Running post extractor in browser console mode');
  const result = executeExtraction();
  (window as any).instagramPostData = result;
}

// Make sure extraction function is exported for use with the script runner
export { extractPost };