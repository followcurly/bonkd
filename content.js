// Enhanced Bonkd Content Script
console.log('🚀 Bonkd starting...');

// Prevent multiple injections
if (window.bonkdActive) {
  console.log('❌ Already processed or active on this page, stopping');
} else {
  window.bonkdActive = true;

  // Content script wrapper to avoid variable conflicts
  (function() {
    // Extension context check
    console.log('🔧 Extension context check: Valid');

    // Global variables
    let isProcessing = false;
    let bonkedElements = new Set();
    let isBonkedVersion = true;
    let allChunks = [];
    let totalChunks = 0;
    let processedChunks = 0;
    let processingTimeout = null;
    let chunkResponsePromises = new Map();
    let currentBonkLevel = 2; // Track the bonk level used for current content

    // Check if page already has bonked content on load
    function checkExistingBonkedContent() {
      const existingBonked = document.querySelectorAll('[data-bonkd-done]');
      if (existingBonked.length > 0) {
        console.log(`📋 Found ${existingBonked.length} existing bonked elements`);
        // Add them to our tracking set
        existingBonked.forEach(element => bonkedElements.add(element));
        
        // Try to determine the bonk level used (default to 2 if unknown)
        currentBonkLevel = 2; // Could be enhanced to store/retrieve this
        
        return true;
      }
      return false;
    }

    // Initialize existing content check
    checkExistingBonkedContent();

    // Cleanup function to reset state
    function cleanup(fullCleanup = true) {
      console.log(`🧹 Cleaning up content script state (full: ${fullCleanup})`);
      isProcessing = false;
      window.bonkdActive = false;
      if (processingTimeout) {
        clearTimeout(processingTimeout);
        processingTimeout = null;
      }
      chunkResponsePromises.clear();
      
      if (fullCleanup) {
        bonkedElements.clear();
        isBonkedVersion = true;
      }
      
      // Remove indicators
      const toggleIndicator = document.getElementById('bonkd-toggle-indicator');
      if (toggleIndicator) toggleIndicator.remove();
      
      const notifier = document.getElementById('bonkd-notifier');
      if (notifier) notifier.remove();
    }

    // Auto cleanup after 10 minutes (increased) - but preserve bonked elements
    setTimeout(() => cleanup(false), 600000);

    // Clean up on page navigation
    window.addEventListener('beforeunload', () => cleanup(true));
    window.addEventListener('pagehide', () => cleanup(true));

    // Simple function to check if extension is working
    function isExtensionWorking() {
      try {
        const isValid = !!(chrome && chrome.runtime && chrome.runtime.id);
        console.log(`🔧 Extension context check: ${isValid ? 'Valid' : 'Invalid'}`);
        return isValid;
      } catch (error) {
        console.error('❌ Extension context check failed:', error);
        return false;
      }
    }

    // Toggle between bonked and original text
    function toggleBonkedText() {
      if (bonkedElements.size === 0) {
        console.log('⚠️ No bonked elements found to toggle');
        return false;
      }

      isBonkedVersion = !isBonkedVersion;
      console.log(`🔄 Toggling to ${isBonkedVersion ? 'bonked' : 'original'} version`);
      
      const toggleMessage = isBonkedVersion ? 'Showing bonked text' : 'Showing original text';
      updateBonkdNotifier(toggleMessage, 'default', 2000);

      bonkedElements.forEach(element => {
        try {
          const originalText = element.getAttribute('data-bonkd-original');
          const bonkedText = element.getAttribute('data-bonkd-bonked');
          
          if (originalText && bonkedText) {
            // Add transition effect
            element.style.transition = 'opacity 0.3s ease';
            element.style.opacity = '0.5';
            
            setTimeout(() => {
              element.textContent = isBonkedVersion ? bonkedText : originalText;
              element.style.opacity = '1';
              
              // Update visual indicator
              if (isBonkedVersion) {
                element.style.fontFamily = 'Comic Sans MS, cursive, sans-serif';
                element.style.backgroundColor = '#fff9c4';
                element.style.color = '#2c3e50';
                
                // Remove highlight after a moment
                setTimeout(() => {
                  element.style.backgroundColor = '';
                  element.style.color = '';
                }, 1500);
              } else {
                // Reset to original styling
                element.style.fontFamily = '';
                element.style.backgroundColor = '#f0f0f0';
                element.style.color = '';
                
                // Remove highlight after a moment
                setTimeout(() => {
                  element.style.backgroundColor = '';
                }, 1500);
              }
            }, 150);
          }
        } catch (error) {
          console.error('❌ Error toggling element:', error);
        }
      });
      
      // Show floating toggle indicator
      showToggleIndicator();
      
      return true;
    }

    // Show a floating indicator of current state
    function showToggleIndicator() {
      // Remove existing indicator
      const existingIndicator = document.getElementById('bonkd-toggle-indicator');
      if (existingIndicator) existingIndicator.remove();

      const indicator = document.createElement('div');
      indicator.id = 'bonkd-toggle-indicator';
      indicator.textContent = isBonkedVersion ? '🤪 BONKED' : '📄 ORIGINAL';
      indicator.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background-color: ${isBonkedVersion ? '#ff6b6b' : '#4CAF50'};
        color: white;
        padding: 12px 24px;
        border-radius: 25px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 16px;
        font-weight: bold;
        z-index: 2147483647;
        box-shadow: 0 8px 25px rgba(0,0,0,0.3);
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      `;
      
      document.body.appendChild(indicator);
      
      // Animate in
      setTimeout(() => indicator.style.opacity = '1', 10);
      
      // Animate out and remove
      setTimeout(() => {
        indicator.style.opacity = '0';
        setTimeout(() => {
          if (indicator.parentNode) indicator.remove();
        }, 300);
      }, 1500);
    }

    // Clear existing bonked content for re-bonking
    function clearBonkedContent() {
      console.log('🧹 Clearing existing bonked content for re-bonking...');
      
      bonkedElements.forEach(element => {
        try {
          // Restore original text
          const originalText = element.getAttribute('data-bonkd-original');
          if (originalText) {
            element.textContent = originalText;
          }
          
          // Remove bonkd attributes
          element.removeAttribute('data-bonkd-done');
          element.removeAttribute('data-bonkd-original');
          element.removeAttribute('data-bonkd-bonked');
          
          // Reset styling
          element.style.fontFamily = '';
          element.style.backgroundColor = '';
          element.style.color = '';
          element.style.transition = '';
        } catch (error) {
          console.error('❌ Error clearing bonked element:', error);
        }
      });
      
      // Clear the set
      bonkedElements.clear();
      isBonkedVersion = true;
      
      console.log('✅ Bonked content cleared successfully');
    }

    // Smart content detection - avoid UI elements and preserve layout
    function findTextElements(allowReprocessing = false) {
      console.log('🧠 Finding content with smart detection...');
      
      // First, find main content areas
      const mainAreas = findMainContentAreas();
      console.log(`📍 Found ${mainAreas.length} main content areas`);
      
      const elements = [];
      let totalScanned = 0;
      let contentElements = 0;
      let uiElementsSkipped = 0;
      
      mainAreas.forEach(area => {
        // Smart selectors focused on actual content
        const contentSelectors = [
          'p', 'div.content p', 'div.entry-content p', 'div.post-content p',
          'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'blockquote', 'li'
        ];
        
        contentSelectors.forEach(selector => {
          try {
            const found = area.querySelectorAll(selector);
            totalScanned += found.length;
            
            found.forEach(element => {
              if (isValidContentElement(element, allowReprocessing)) {
                const text = extractCleanText(element);
                
                if (isQualityContent(text, element)) {
                  elements.push({
                    element: element,
                    text: text,
                    selector: selector,
                    tagName: element.tagName.toLowerCase(),
                    contentType: classifyContent(element, text),
                    priority: calculateContentPriority(element, text)
                  });
                  contentElements++;
                } else {
                  uiElementsSkipped++;
                }
              } else {
                uiElementsSkipped++;
              }
            });
          } catch (error) {
            console.warn(`⚠️ Selector "${selector}" failed:`, error);
          }
        });
      });
      
      // Sort by priority and content quality
      elements.sort((a, b) => b.priority - a.priority);
      
      console.log(`📊 Smart content analysis:`);
      console.log(`   🎯 Quality content: ${contentElements}`);
      console.log(`   🚫 UI elements skipped: ${uiElementsSkipped}`);
      console.log(`   📝 Total scanned: ${totalScanned}`);
      console.log(`   ✅ Final selection: ${elements.length}`);
      
      return elements;
    }

    // Find main content areas using a scoring algorithm instead of a fixed list of selectors
    function findMainContentAreas() {
      console.log('🧐 Scoring potential content areas to find the core content...');

      // Helper to check if an element is likely visible and large enough to be content
      const isElementVisible = (el) => {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }
        // Element must have some dimensions to be considered a main content container
        const rect = el.getBoundingClientRect();
        return rect.width > 100 && rect.height > 50;
      };

      // Calculate a "content score" for an element to find the best candidate
      const calculateContentScore = (element) => {
        let score = 0;
        const tagName = element.tagName.toLowerCase();

        // Heavily boost score for semantic tags
        if (tagName === 'article') score += 50;
        if (tagName === 'main') score += 40;

        // Boost or penalize based on class names and IDs
        const classAndId = `${element.className} ${element.id}`;
        if (/(article|content|post|body|story|main)/i.test(classAndId)) {
          score += 25;
        }
        if (/(comment|ad|promo|disqus|sidebar|footer|nav|menu|related|share|social|popup)/i.test(classAndId)) {
          score -= 50;
        }
        
        if (score < 0) return score;

        // More points for paragraphs
        score += element.querySelectorAll('p').length * 10;

        // Link density check
        const textLength = element.textContent.length;
        if (textLength > 200) {
          const links = element.querySelectorAll('a');
          if (links.length > 2) {
              const linkTextLength = Array.from(links).reduce((len, link) => len + link.textContent.length, 0);
              const linkDensity = linkTextLength / textLength;
              if (linkDensity > 0.3) score -= (linkDensity * 50);
          }
        }

        // Penalize for UI elements
        score -= element.querySelectorAll('input, button, select, form').length * 3;

        return score;
      };
      
      const candidates = document.querySelectorAll('main, article, section, div');
      let bestCandidate = null;
      let highScore = 0;

      candidates.forEach(candidate => {
        if (!isElementVisible(candidate)) {
          return;
        }

        const score = calculateContentScore(candidate);
        
        if (score > highScore) {
          highScore = score;
          bestCandidate = candidate;
        }
      });
      
      // A score threshold to ensure we don't pick a random div
      if (bestCandidate && highScore > 20) {
        console.log(`🏆 Best content area found with score ${highScore}:`, bestCandidate);
        return [bestCandidate];
      }
      
      console.log('📄 No specific high-scoring content area found, falling back to body.');
      return [document.body];
    }

    // Check if element is valid content (not UI, navigation, etc.) - MODIFIED for re-bonking
    function isValidContentElement(element, allowReprocessing = false) {
      // For re-bonking, allow reprocessing of previously bonked elements
      if (!allowReprocessing && element.hasAttribute('data-bonkd-done')) {
        return false;
      }
      
      // Skip UI and navigation elements
      const forbiddenSelectors = [
        'nav', 'header', 'footer', 'aside', 'menu',
        '.nav', '.navigation', '.menu', '.sidebar', '.header', '.footer',
        '.breadcrumb', '.pagination', '.social', '.share', '.comments',
        '.advertisement', '.ad', '.promo', '.banner',
        'button', 'input', 'select', 'textarea', 'form',
        '.button', '.btn', '.link', '.tag', '.label',
        '.meta', '.byline', '.date', '.author', '.source',
        '.related', '.recommended', '.trending', '.popular'
      ];
      
      // Check if element or any parent matches forbidden selectors
      for (const selector of forbiddenSelectors) {
        try {
          if (element.matches(selector) || element.closest(selector)) {
            return false;
          }
        } catch (e) {
          // Invalid selector, skip
        }
      }
      
      // Skip if element is hidden or very small
      const styles = window.getComputedStyle(element);
      if (styles.display === 'none' || 
          styles.visibility === 'hidden' || 
          styles.opacity === '0') {
        return false;
      }
      
      // Skip tiny elements (likely UI)
      const rect = element.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 20) {
        return false;
      }
      
      return true;
    }

    // Extract clean text from element
    function extractCleanText(element) {
      let text = element.textContent || '';
      
      // Clean up whitespace and special characters
      text = text.replace(/\s+/g, ' ').trim();
      
      // Remove common UI text patterns and artifacts
      const uiPatterns = [
        /^(click|tap|press|select|choose|toggle)\s/i,
        /^(menu|navigation|nav|home|back|next|previous)\s/i,
        /^(share|like|comment|subscribe|follow|login|signup)\s/i,
        /^(continue reading|read more|load more|see more)\s*$/i,
        /^\d+\s*(comments?|likes?|shares?|views?)\s*$/i,
        /^(advertisement|sponsored|promoted)\s/i,
        /^(edit|view|print|save|download)\s/i,
        /^(copyright|©|\(c\))/i,
        /^(terms|privacy|policy|disclaimer)/i,
        /^\d{4}[-\/]\d{1,2}[-\/]\d{1,2}/i, // Dates
        /^\d+:\d+\s*(am|pm)/i, // Times
        /^[\d\s\-\+\(\)\.]+$/, // Only numbers and punctuation
        /^[^\w]{3,}$/, // Only special characters
        /^(loading|please wait|error)/i
      ];
      
      for (const pattern of uiPatterns) {
        if (pattern.test(text)) {
          return ''; // Mark as invalid
        }
      }
      
      // Remove excessive punctuation and symbols
      const cleanedText = text.replace(/[^\w\s\.\!\?\,\;\:\-\'\"\(\)]/g, ' ').replace(/\s+/g, ' ').trim();
      
      return cleanedText;
    }

    // Check if text is quality content worth bonking
    function isQualityContent(text, element) {
      // The chunking mechanism will handle long text, so we only check for a minimum length.
      if (!text || text.length < 40) {
        return false;
      }
      
      // Skip content that's mostly numbers, dates, or special characters
      const alphaRatio = (text.match(/[a-zA-Z]/g) || []).length / text.length;
      if (alphaRatio < 0.5) { // Lowered threshold for more inclusive content
        return false;
      }
      
      // Skip content with too many capital letters (likely headers or UI)
      const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
      if (capsRatio > 0.6) { // Slightly more lenient
        return false;
      }
      
      // Must have reasonable sentence structure
      const sentenceCount = text.split(/[.!?]+/).filter(s => s.trim().length > 5).length;
      if (sentenceCount === 0) {
        return false;
      }
      
      // Check for common content indicators
      const contentIndicators = [
        /\b(the|and|or|but|if|when|where|how|why|what|who)\b/i,
        /\b(is|are|was|were|have|has|had|will|would|could|should)\b/i,
        /\b(this|that|these|those|some|any|all|most|many|few)\b/i
      ];
      
      const hasContentWords = contentIndicators.some(pattern => pattern.test(text));
      if (!hasContentWords && text.length < 150) {
        return false; // Short text without common content words is likely UI
      }
      
      // Additional checks for specific element types
      const tagName = element.tagName.toLowerCase();
      if (tagName === 'span' && text.length < 100) {
        // Spans are often UI elements, be more strict
        return /\b(said|says|according|reported|announced|explained|described)\b/i.test(text);
      }
      
      return true;
    }

    // Classify content type for better AI processing
    function classifyContent(element, text) {
      const tagName = element.tagName.toLowerCase();
      
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        return 'heading';
      }
      
      if (tagName === 'blockquote') {
        return 'quote';
      }
      
      if (tagName === 'li') {
        return 'list-item';
      }
      
      if (text.length > 500) {
        return 'long-form';
      }
      
      return 'paragraph';
    }

    // Calculate content priority for processing order
    function calculateContentPriority(element, text) {
      let priority = 1;
      
      // Prioritize based on content location
      if (element.closest('main, article, [role="main"]')) {
        priority += 2;
      }
      
      // Prioritize based on content length (sweet spot)
      if (text.length > 100 && text.length < 800) {
        priority += 1;
      }
      
      // Prioritize headings but not too much
      if (['h1', 'h2', 'h3'].includes(element.tagName.toLowerCase())) {
        priority += 0.5;
      }
      
      // Deprioritize content near the end of page
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      if (rect.top > viewportHeight * 3) {
        priority -= 0.5;
      }
      
      return priority;
    }

    // Create simple chunks (no complex algorithms)
    function createChunks(elements) {
      console.log('📦 Creating chunks...');
      
      const chunks = [];
      let currentChunk = [];
      let currentLength = 0;
      const maxChunkLength = 12000; // Increased for larger context
      
      elements.forEach((item, index) => {
        // Start new chunk if current one is getting too big
        if (currentLength + item.text.length > maxChunkLength && currentChunk.length > 0) {
          console.log(`   📦 Chunk ${chunks.length + 1}: ${currentChunk.length} elements, ${currentLength} chars`);
          chunks.push(currentChunk);
          currentChunk = [];
          currentLength = 0;
        }
        
        currentChunk.push(item);
        currentLength += item.text.length;
      });
      
      // Add the last chunk
      if (currentChunk.length > 0) {
        console.log(`   📦 Final chunk: ${currentChunk.length} elements, ${currentLength} chars`);
        chunks.push(currentChunk);
      }
      
      console.log(`✅ Created ${chunks.length} chunks total`);
      return chunks;
    }

    // --- NEW UNIFIED NOTIFIER ---
    function updateBonkdNotifier(text, state = 'loading', duration = null) {
      let notifier = document.getElementById('bonkd-notifier');
      if (!notifier) {
        notifier = document.createElement('div');
        notifier.id = 'bonkd-notifier';
        document.body.appendChild(notifier);

        const style = document.createElement('style');
        style.textContent = `
          #bonkd-notifier {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background-color: #2c3e50;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            font-size: 14px;
            z-index: 2147483647;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            display: flex;
            align-items: center;
            opacity: 0;
            transform: translateY(20px);
            transition: opacity 0.3s ease, transform 0.3s ease;
          }
          #bonkd-notifier.visible {
            opacity: 1;
            transform: translateY(0);
          }
          #bonkd-notifier.error { background-color: #c0392b; }
          #bonkd-notifier.success { background-color: #27ae60; }
          #bonkd-notifier .loader {
            border: 2px solid rgba(255, 255, 255, 0.3);
            border-radius: 50%;
            border-top: 2px solid #fff;
            width: 16px;
            height: 16px;
            animation: bonkd-spin 1s linear infinite;
            margin-right: 10px;
          }
          @keyframes bonkd-spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `;
        document.head.appendChild(style);
      }

      // Update state and content
      notifier.className = ''; // Reset classes
      if (state !== 'default') {
        notifier.classList.add(state);
      }

      let content = '';
      if (state === 'loading') {
        content = '<div class="loader"></div>';
      }
      content += `<span>${text}</span>`;
      notifier.innerHTML = content;

      // Make it visible
      setTimeout(() => notifier.classList.add('visible'), 10);

      if (duration) {
        setTimeout(() => {
          notifier.classList.remove('visible');
        }, duration);
      }
    }

    function hideBonkdNotifier() {
      let notifier = document.getElementById('bonkd-notifier');
      if (notifier) {
        notifier.classList.remove('visible');
      }
    }

    // Process a chunk of text - MODIFIED FOR PROMISE-BASED, SEQUENTIAL HANDLING
    async function processChunk(chunk, chunkIndex, previousSummary = null) {
      console.log(`🎯 Processing chunk ${chunkIndex + 1}/${totalChunks}`);
      
      return new Promise((resolve, reject) => {
        // Store the promise resolvers
        chunkResponsePromises.set(chunkIndex, { resolve, reject });

        // Timeout for each chunk
        setTimeout(() => {
          if (chunkResponsePromises.has(chunkIndex)) {
            reject(new Error(`Timeout waiting for response for chunk ${chunkIndex + 1}`));
            chunkResponsePromises.delete(chunkIndex);
          }
        }, 60000); // 60-second timeout per chunk

        try {
          // Combine all text from this chunk
          const texts = chunk.map(item => item.text);
          const combinedText = texts.join('---TEXT_SEPARATOR---');
          
          console.log(`📤 Sending to background: ${combinedText.length} chars, ${texts.length} parts`);
          
          // Send to background script with context and summary
          chrome.runtime.sendMessage({
            action: 'processText',
            text: combinedText,
            chunkIndex: chunkIndex,
            previousSummary: previousSummary,
            context: {
              types: chunk.map(item => item.contentType),
              priorities: chunk.map(item => item.priority),
              hasCode: chunk.some(item => item.text.includes('function') || item.text.includes('class ')),
              hasQuotes: chunk.some(item => item.contentType === 'quote'),
              avgLength: Math.round(chunk.reduce((sum, item) => sum + item.text.length, 0) / chunk.length)
            }
          });
          
          console.log(`✅ Message sent for chunk ${chunkIndex + 1}`);
          
        } catch (error) {
          console.error(`❌ Error processing chunk ${chunkIndex + 1}:`, error);
          updateBonkdNotifier(`😅 Chunk ${chunkIndex + 1} failed: ${error.message}`, 'error', 4000);
          reject(error);
          chunkResponsePromises.delete(chunkIndex);
        }
      });
    }

    // --- NEW: Process chunk with retries ---
    async function processChunkWithRetries(chunk, chunkIndex, previousSummary) {
      const MAX_RETRIES = 3;
      let lastError = null;

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const result = await processChunk(chunk, chunkIndex, previousSummary);
          return result; // Success
        } catch (error) {
          lastError = error;
          console.warn(`Attempt ${attempt} for chunk ${chunkIndex + 1} failed. Retrying in ${attempt * 2}s...`, error);
          
          let retryMessage;
          if (attempt === 1) {
            retryMessage = `Primary processing failed. Trying simple approach... (${attempt}/${MAX_RETRIES})`;
          } else if (attempt === 2) {
            retryMessage = `Simple approach failed. Trying word substitution... (${attempt}/${MAX_RETRIES})`;
          } else {
            retryMessage = `Retrying with fallback methods... (${attempt}/${MAX_RETRIES})`;
          }
          
          updateBonkdNotifier(retryMessage, 'error');
          chrome.runtime.sendMessage({ action: 'updateStatus', message: retryMessage });

          // Exponential backoff delay
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
        }
      }

      console.error(`Chunk ${chunkIndex + 1} failed after ${MAX_RETRIES} attempts.`);
      throw lastError; // Throw the last captured error if all retries fail
    }

    // Layout-preserving text replacement - NO layout changes!
    function replaceText(element, newText, elementInfo) {
      console.log(`✏️ Layout-safe replacement in ${elementInfo.tagName}: "${newText.substring(0, 50)}..."`);
      
      try {
        // Mark as processed
        element.setAttribute('data-bonkd-done', 'true');
        
        // Store both original and bonked text
        element.setAttribute('data-bonkd-original', elementInfo.text);
        element.setAttribute('data-bonkd-bonked', newText.trim());
        
        // Add to bonked elements set for toggling
        bonkedElements.add(element);
        
        // Determine replacement style based on processing method
        let bgColor = '#fff9c4'; // Default yellow
        if (newText.includes('word substitution')) {
          bgColor = '#e8f4f8'; // Light blue for word substitution
        } else if (newText.length < elementInfo.text.length * 0.3) {
          bgColor = '#f0f8e8'; // Light green for heavily simplified
        }
        
        // LAYOUT-SAFE styling - no transforms or size changes!
        element.style.fontFamily = 'Comic Sans MS, cursive, sans-serif';
        element.style.transition = 'background-color 0.3s ease, color 0.3s ease';
        element.style.backgroundColor = bgColor;
        element.style.color = '#2c3e50';
        
        // Remove context prefix if present (from AI processing)
        let cleanText = newText.trim();
        cleanText = cleanText.replace(/^\[(HEADING|QUOTE|LIST)\]\s*/, '');
        
        // Replace the text content only - preserves all layout
        element.textContent = cleanText;
        
        // Remove highlight after a moment - NO layout changes!
        setTimeout(() => {
          element.style.backgroundColor = '';
          element.style.color = '';
        }, 2500);
        
        console.log(`✅ Layout-safe replacement complete for ${elementInfo.tagName}`);
        
      } catch (error) {
        console.error(`❌ Error in layout-safe replacement:`, error);
        // Restore original if replacement failed
        try {
          element.textContent = elementInfo.text;
          element.removeAttribute('data-bonkd-done');
          element.removeAttribute('data-bonkd-original');
          element.removeAttribute('data-bonkd-bonked');
          bonkedElements.delete(element);
        } catch (restoreError) {
          console.error(`❌ Failed to restore original text:`, restoreError);
        }
        throw error;
      }
    }

    // Handle messages from background script - IMPROVED with better error handling
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Content received message:', request.action, request.chunkIndex);
      
      // Wrap everything in try-catch to prevent uncaught errors
      const handleMessage = async () => {
        try {
          // Promise resolver
          const promise = chunkResponsePromises.get(request.chunkIndex);

          if (request.action === 'startBonking') {
            console.log(`🎬 Starting bonking with level ${request.bonkLevel}${request.isReBonk ? ' (re-bonk)' : ''}`);
            startBonking(request.bonkLevel || 2, request.isReBonk || false);
            sendResponse({ success: true });
            return;
          }

          if (request.action === 'startReBonking') {
            console.log(`🔄 Starting re-bonking with level ${request.bonkLevel}`);
            startBonking(request.bonkLevel || 2, true);
            sendResponse({ success: true });
            return;
          }

          if (request.action === 'queryState') {
            sendResponse({ isActive: isProcessing });
            return;
          }

          if (request.action === 'queryBonkedState') {
            sendResponse({ 
              elementCount: bonkedElements.size,
              isBonkedVersion: isBonkedVersion,
              hasBonkedContent: bonkedElements.size > 0,
              currentBonkLevel: currentBonkLevel
            });
            return;
          }

          if (request.action === 'toggleText') {
            const success = toggleBonkedText();
            // Improved response handling with error catching
            const response = { 
              success: success,
              isBonkedVersion: isBonkedVersion,
              elementCount: bonkedElements.size
            };
            
            // Send response with timeout to prevent hanging
            const sendSafeResponse = () => {
              try {
                sendResponse(response);
              } catch (error) {
                console.log('📨 Popup closed during toggle response, that\'s okay');
              }
            };
            
            // Small delay to ensure toggle animation completes
            setTimeout(sendSafeResponse, 50);
            return true; // Keep channel open
          }

          if (request.action === 'replaceText') {
            if (promise) {
              promise.resolve(request);
              chunkResponsePromises.delete(request.chunkIndex);
            }

            console.log(`📥 Replace text for chunk ${request.chunkIndex + 1}`);
            
            const chunkIndex = request.chunkIndex;
            const bonkedTexts = request.text.split('---TEXT_SEPARATOR---');
            const chunk = allChunks[chunkIndex];
            
            if (!chunk) {
              console.error(`❌ No chunk found for index ${chunkIndex}`);
              sendResponse({ error: 'Chunk not found' });
              return;
            }
            
            console.log(`📊 Replacing ${bonkedTexts.length} texts in ${chunk.length} elements`);
            
            // Track processing method used
            let processingMethod = 'AI';
            if (request.summary && request.summary.includes('word substitution')) {
              processingMethod = 'Word Substitution';
            } else if (bonkedTexts.some(text => text && text.length < 100)) {
              processingMethod = 'Bonk AI';
            }
            
            // Replace each element's text
            let successful = 0;
            chunk.forEach((item, index) => {
              const newText = bonkedTexts[index] ? bonkedTexts[index].trim() : '';
              if (newText && newText !== '__BONKD_SKIP__') {
                try {
                  replaceText(item.element, newText, item);
                  successful++;
                } catch (error) {
                  console.error(`❌ Failed to replace element ${index}:`, error);
                }
              } else {
                console.log(`Skipping replacement for element ${index} due to failed simplification.`);
              }
            });
            
            processedChunks++;
            const progressMessage = `Bonking... ${processedChunks}/${totalChunks} (${processingMethod})`;
            updateBonkdNotifier(progressMessage, 'loading');
            
            // Safe message sending
            try {
              chrome.runtime.sendMessage({ action: 'updateStatus', message: progressMessage });
            } catch (error) {
              console.log('📨 Could not send progress update (popup may be closed)');
            }

            console.log(`✅ Chunk ${chunkIndex + 1} complete: ${successful}/${chunk.length} successful (${processingMethod})`);
            
            sendResponse({ success: true });
            
          } else if (request.action === 'error') {
            if (promise) {
              promise.reject(new Error(request.text));
              chunkResponsePromises.delete(request.chunkIndex);
            }

            console.error(`❌ Background error for chunk ${(request.chunkIndex || 0) + 1}:`, request.text);
            processedChunks++;
            const errorMsg = `😅 Bonking failed: ${request.text}`;
            updateBonkdNotifier(errorMsg, 'error', 4000);
            
            // Safe message sending
            try {
              chrome.runtime.sendMessage({ action: 'bonkError', message: errorMsg });
            } catch (error) {
              console.log('📨 Could not send error message (popup may be closed)');
            }
            
            sendResponse({ error: 'received' });
          }
          
        } catch (error) {
          console.error('❌ Error in message listener:', error);
          try {
            sendResponse({ error: error.message });
          } catch (responseError) {
            console.log('📨 Could not send error response, popup may be closed');
          }
        }
      };
      
      // Execute the handler
      handleMessage();
      return true; // Keep channel open for async responses
    });

    // Main function to start the bonking process - MODIFIED for re-bonking support
    async function startBonking(bonkLevel = 2, isReBonk = false) {
      console.log(`🚀 Starting bonking process with level ${bonkLevel}${isReBonk ? ' (re-bonk)' : ''}...`);
      
      if (isProcessing) {
        console.warn('⚠️ Already processing, stopping');
        return;
      }
      
      if (!isExtensionWorking()) {
        console.error('❌ Extension not working');
        updateBonkdNotifier('🔄 Extension not ready. Try refreshing the page.', 'error', 4000);
        return;
      }
      
      // Store the bonk level being used
      currentBonkLevel = bonkLevel;
      
      // If this is a re-bonk, clear existing content first
      if (isReBonk && bonkedElements.size > 0) {
        console.log('🔄 Re-bonking: clearing existing content...');
        clearBonkedContent();
        updateBonkdNotifier(`Re-bonking with ${getBonkLevelName(bonkLevel)}...`, 'loading');
      } else {
        updateBonkdNotifier('Starting to bonk...', 'loading');
      }
      
      isProcessing = true;
      chrome.runtime.sendMessage({ action: 'updateStatus', message: 'Finding content...' });
      
      // Set overall timeout - increased to 10 minutes
      processingTimeout = setTimeout(() => {
        console.error('⏰ Overall processing timeout after 10 minutes');
        const errorMsg = '😅 Processing timed out!';
        hideBonkdNotifier();
        updateBonkdNotifier(errorMsg, 'error', 4000);
        chrome.runtime.sendMessage({ action: 'bonkError', message: errorMsg });
        cleanup(true);
      }, 600000);
      
      try {
        // Find all text elements (skip already processed elements unless re-bonking)
        const elements = findTextElements(isReBonk);
        
        if (elements.length === 0) {
          console.warn('⚠️ No text elements found');
          hideBonkdNotifier();
          const errorMsg = '😔 No text found to bonk!';
          updateBonkdNotifier(errorMsg, 'error', 3000);
          chrome.runtime.sendMessage({ action: 'bonkError', message: errorMsg });
          cleanup(true);
          return;
        }
        
        // Create chunks
        const chunks = createChunks(elements);
        allChunks = chunks; // Store for message handling
        totalChunks = chunks.length;
        processedChunks = 0;
        
        const actionText = isReBonk ? 're-bonking' : 'bonking';
        console.log(`📊 Plan: ${elements.length} elements in ${chunks.length} chunks for ${actionText}`);
        const planMessage = `Found ${elements.length} text blocks. Preparing to ${actionText}...`;
        updateBonkdNotifier(planMessage, 'loading');
        chrome.runtime.sendMessage({ action: 'updateStatus', message: planMessage });
        
        // Process each chunk sequentially with retries
        let previousSummary = null;
        let failedChunks = 0;
        for (let i = 0; i < chunks.length; i++) {
          try {
            console.log(`🎬 Starting chunk ${i + 1}/${chunks.length}`);
            const result = await processChunkWithRetries(chunks[i], i, previousSummary);
            previousSummary = result.summary; // Pass summary to the next iteration
          } catch (error) {
            console.error(`💔 Chunk ${i + 1} failed permanently and will be skipped.`, error);
            failedChunks++;
            previousSummary = null; // Reset summary for the next chunk
          }
        }
        
        console.log('🎉 All chunks processing attempted.');
        hideBonkdNotifier();
        
        if (failedChunks > 0) {
          const errorMsg = `😬 Finished, but ${failedChunks} part(s) needed fallback processing.`;
          updateBonkdNotifier(errorMsg, 'error', 5000);
          chrome.runtime.sendMessage({ action: 'bonkError', message: errorMsg });
        } else {
          const totalElements = allChunks.reduce((sum, chunk) => sum + chunk.length, 0);
          const levelName = getBonkLevelName(bonkLevel);
          const successMsg = isReBonk ? 
            `Re-bonked ${totalElements} elements with ${levelName}!` : 
            `Smartly bonked ${totalElements} elements!`;
          updateBonkdNotifier(successMsg, 'success', 5000);
          chrome.runtime.sendMessage({ action: 'bonkComplete', message: successMsg });
        }
        
        // Don't cleanup after success - keep elements available for toggling
        isProcessing = false;
        window.bonkdActive = false;
        if (processingTimeout) {
          clearTimeout(processingTimeout);
          processingTimeout = null;
        }
        // Keep bonkedElements and other state for toggling
        
      } catch (error) {
        console.error('❌ Critical error in bonking process:', error);
        hideBonkdNotifier();
        const errorMsg = '😅 Something went wrong!';
        updateBonkdNotifier(errorMsg, 'error', 4000);
        chrome.runtime.sendMessage({ action: 'bonkError', message: errorMsg });
        cleanup(true);
      }
    }

    // Get bonk level name for display
    function getBonkLevelName(level) {
      const names = { 1: 'Little Bonk', 2: 'Bonk', 3: 'Big Bonk' };
      return names[level] || 'Bonk';
    }

    // Content script is ready and waiting for bonking commands
    console.log('🎬 Bonkd content script loaded and ready');
  })(); 
} 