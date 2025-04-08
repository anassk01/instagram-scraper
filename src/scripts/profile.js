/**
 * Instagram Profile Extractor
 * 
 * This script extracts profile information from an Instagram profile page.
 * It can be used directly in the browser console or via automation.
 * This is a simplified JavaScript version to avoid transpilation issues.
 */

/**
 * Main function to extract profile data from an Instagram profile page
 * @returns Object containing the profile data
 */
function extractProfile() {
    console.log('🔍 Instagram Profile Scraper - Starting...');
    
    // Single collection of profile data
    const profileData = {
      username: '',
      fullName: 'Not found',
      bio: 'Not found',
      followers: 'Not found',
      following: 'Not found',
      posts: 'Not found',
      profileImageUrl: 'Not found',
      isVerified: false,
      category: 'Not found',
      externalLink: 'Not found',
      externalLinkUrl: 'Not found',
      scrapedAt: new Date().toISOString()
    };
    
    try {
      // Username - from h2 element or fallback to URL path
      const usernameElement = document.querySelector('h2');
      profileData.username = usernameElement && usernameElement.textContent 
        ? usernameElement.textContent.trim() 
        : window.location.pathname.replace(/\//g, '');
      
      // Check if verified
      const verifiedBadge = document.querySelector('svg[aria-label="Verified"]');
      profileData.isVerified = verifiedBadge ? true : false;
      
      // Profile image - img with alt text containing "profile picture"
      const profileImg = document.querySelector('img[alt*="profile picture"]');
      profileData.profileImageUrl = profileImg && profileImg.src ? profileImg.src : 'Not found';
      
      // Category - specifically using the class pattern found in the HTML
      const categoryDivs = document.querySelectorAll('div[dir="auto"]');
      let foundCategory = 'Not found';
      
      categoryDivs.forEach(div => {
        if (div.className.includes('_aaco') && div.className.includes('_aacu') && div.className.includes('_aacy')) {
          foundCategory = div.textContent ? div.textContent.trim() : 'Not found';
        }
      });
      profileData.category = foundCategory;
      
      // Bio text
      const bioSpans = document.querySelectorAll('span[dir="auto"]');
      let foundBio = 'Not found';
      
      bioSpans.forEach(span => {
        if (span.className.includes('_aaco') && span.className.includes('_aacu') && span.className.includes('_aacx')) {
          foundBio = span.textContent ? span.textContent.trim() : 'Not found';
        }
      });
      profileData.bio = foundBio;
      
      // External link
      const linkElement = document.querySelector('a[href^="https://l.instagram.com"]');
      if (linkElement) {
        const linkTextElement = linkElement.querySelector('span span');
        profileData.externalLink = linkTextElement && linkTextElement.textContent 
          ? linkTextElement.textContent.trim() 
          : linkElement.textContent 
            ? linkElement.textContent.trim() 
            : 'Not found';
        
        profileData.externalLinkUrl = linkElement.href;
      }
      
      // Full name
      const fullNameSpans = document.querySelectorAll('span[style*="line-height: 18px"]');
      let foundName = 'Not found';
      
      fullNameSpans.forEach(span => {
        if (foundName === 'Not found' && span.textContent && 
            !span.textContent.includes('www.') && 
            !span.textContent.includes('http')) {
          foundName = span.textContent.trim();
        }
      });
      profileData.fullName = foundName;
      
      // Stats (followers, following, posts)
      const statElements = document.querySelectorAll('li');
      statElements.forEach(li => {
        const text = li.textContent || '';
        if (text.includes('followers')) {
          profileData.followers = text.split(' ')[0];
        } else if (text.includes('following')) {
          profileData.following = text.split(' ')[0];
        } else if (text.includes('posts')) {
          profileData.posts = text.split(' ')[0];
        }
      });
      
      console.log('✅ Profile data extracted successfully');
      return profileData;
    } catch (error) {
      console.error('❌ Error extracting profile data:', error);
      return profileData;
    }
  }
  
  // Function to execute the extraction and return the result
  function executeExtraction() {
    const result = extractProfile();
    console.log('Profile data:', result);
    
    // Store the result on window for potential access from outside
    window.instagramProfileData = result;
    
    return result;
  }
  
  // The script will run automatically through the directInjectionRunner