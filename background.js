// Simple Bonkd Background Script - Dumbed Down Version!
console.log('🚀 Bonkd background script loaded');

// Import configuration
importScripts('config.js');

// Simple state tracking
const activeTabs = new Set();

// Store the current bonk level
let currentBonkLevel = 2; // Default to "bonk"

// Listen for messages from popup and content scripts
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  console.log('📨 Background received message:', request.action, request);
  
  try {
    if (request.action === 'bonk') {
      // Store the bonk level from the request
      currentBonkLevel = request.bonkLevel || 2;
      const isReBonk = request.isReBonk || false;
      console.log(`🎯 User clicked bonk button with level ${currentBonkLevel} (${getBonkLevelName(currentBonkLevel)})${isReBonk ? ' - RE-BONK' : ''}`);
      
      // User clicked the bonk button in popup
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          console.log(`💉 ${isReBonk ? 'Re-injecting' : 'Injecting'} script into tab ${tabId}`);
          
          // For re-bonking, we don't need to inject the script again if it's already there
          // But we need to send the start message with the new bonk level
          if (isReBonk) {
            // Send re-bonk message directly
            chrome.tabs.sendMessage(tabId, { 
              action: 'startReBonking',
              bonkLevel: currentBonkLevel 
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('❌ Failed to send re-bonk message:', chrome.runtime.lastError);
                // If content script not available, inject and start normally
                injectAndStart(tabId, currentBonkLevel, false);
              } else {
                console.log('✅ Re-bonk message sent successfully');
              }
            });
          } else {
            // Normal bonking - inject script
            injectAndStart(tabId, currentBonkLevel, false);
          }
        }
      });
      sendResponse({ success: true });
      
    } else if (request.action === 'processText') {
      // Content script wants to process text - handle async
      console.log(`🎯 Processing text request for chunk ${request.chunkIndex + 1}`);
      console.log(`📄 Text length: ${request.text?.length || 0} chars`);
      if (request.context) {
        console.log(`🧠 Context: ${request.context.types?.join(', ')} (avg: ${request.context.avgLength} chars)`);
      }
      
      // Handle async processing
      handleAsyncProcessing(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    }
  } catch (error) {
    console.error('❌ Error in message listener:', error);
    sendResponse({ error: error.message });
  }
});

// Get bonk level name for logging
function getBonkLevelName(level) {
  const names = { 1: 'Little Bonk', 2: 'Bonk', 3: 'Big Bonk' };
  return names[level] || 'Bonk';
}

// Handle async processing properly - NO CALLBACK RESPONSE
async function handleAsyncProcessing(request, sender, sendResponse) {
  try {
          console.log(`🔄 Starting async processing for chunk ${request.chunkIndex + 1} with bonk level ${currentBonkLevel}`);
      // Just process - don't use sendResponse, let processWithAI handle the messaging
      await processWithAI(request.text, sender.tab?.id, request.chunkIndex, request.context, request.previousSummary);
      console.log(`✅ Async processing complete for chunk ${request.chunkIndex + 1}`);
    // Send simple acknowledgment 
    sendResponse({ received: true });
  } catch (error) {
    console.error(`❌ Async processing failed for chunk ${request.chunkIndex + 1}:`, error);
    sendResponse({ error: error.message });
  }
}

// Clean up when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log(`🗑️ Tab ${tabId} removed, cleaning up`);
  activeTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    console.log(`🔄 Tab ${tabId} reloading, cleaning up`);
    activeTabs.delete(tabId);
  }
});

// Smart AI processing function with context awareness and fallbacks
async function processWithAI(text, tabId, chunkIndex = 0, context = null, previousSummary = null) {
  console.log(`🤖 Starting smart AI processing for chunk ${chunkIndex + 1}:`);
  console.log(`   📊 Tab ID: ${tabId}`);
  console.log(`   📄 Text length: ${text?.length || 0} chars`);
  console.log(`   📝 Text preview: "${text?.substring(0, 100)}..."`);
  if (context) {
    console.log(`   🧠 Context types: ${context.types?.join(', ')}`);
    console.log(`   🎯 Avg length: ${context.avgLength} chars`);
  }
  if (previousSummary) {
    console.log(`   📜 Previous summary: "${previousSummary}"`);
  }
  
  return await processWithAIFallback(text, tabId, chunkIndex, context, previousSummary);
}

// Multi-tier fallback processing system
async function processWithAIFallback(text, tabId, chunkIndex, context, previousSummary, attemptLevel = 1) {
  const maxAttempts = 3;
  console.log(`🎯 Processing attempt ${attemptLevel}/${maxAttempts} for chunk ${chunkIndex + 1}`);
  
  try {
    // Get API key
    const apiKey = self.BONKD_CONFIG?.GEMINI_API_KEY;
    console.log(`🔑 API key check: ${apiKey ? `Present (${apiKey.substring(0, 10)}...)` : 'MISSING'}`);
    
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
      const errorMsg = 'API key not configured!';
      console.error(`❌ ${errorMsg}`);
      sendErrorToTab(tabId, errorMsg, chunkIndex);
      throw new Error(errorMsg);
    }
    
    // Check text length
    if (!text || text.length === 0) {
      const errorMsg = 'No text provided!';
      console.error(`❌ ${errorMsg}`);
      sendErrorToTab(tabId, errorMsg, chunkIndex);
      throw new Error(errorMsg);
    }
    
    // Check text length - increased limit
    if (text.length > 30000) {
      const errorMsg = `Text too long! (${text.length} chars, max 30000)`;
      console.error(`❌ ${errorMsg}`);
      sendErrorToTab(tabId, errorMsg, chunkIndex);
      throw new Error(errorMsg);
    }
    
    // Create the appropriate prompt based on attempt level
    const textParts = text.split('---TEXT_SEPARATOR---');
    console.log(`📋 Text has ${textParts.length} parts`);
    
    let prompt;
    if (attemptLevel === 1) {
      prompt = createContextAwarePrompt(text, textParts.length, context, previousSummary, currentBonkLevel);
      console.log(`💭 Primary prompt created (${prompt.length} chars) for bonk level ${currentBonkLevel}`);
    } else if (attemptLevel === 2) {
      prompt = createSimplePrompt(text, textParts.length, currentBonkLevel);
      console.log(`💭 Simple fallback prompt created (${prompt.length} chars) for bonk level ${currentBonkLevel}`);
    } else {
      // attemptLevel === 3: Basic word substitution fallback
      console.log(`🔧 Using basic word substitution fallback with bonk level ${currentBonkLevel}`);
      const simplifiedSections = textParts.map(part => basicWordSubstitution(part.trim(), currentBonkLevel));
      const bonkedData = {
        bonkedSections: simplifiedSections,
        summary: "Content simplified using basic word substitution"
      };
      console.log(`✅ Word substitution fallback complete for chunk ${chunkIndex + 1}`);
      sendSuccessToTab(tabId, bonkedData.bonkedSections.join('---TEXT_SEPARATOR---'), bonkedData.summary, chunkIndex);
      return bonkedData;
    }
    
    // Call Gemini API
    console.log(`🚀 Making API call to Gemini (attempt ${attemptLevel})...`);
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json", // Enable JSON output mode
        temperature: attemptLevel === 1 ? 0.7 : 0.3, // Lower temperature for fallbacks
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 4096 // Increased output tokens for larger chunks
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };
    
    console.log(`📤 Request body:`, {
      promptLength: prompt.length,
      maxTokens: 4096,
      temperature: requestBody.generationConfig.temperature,
      attempt: attemptLevel
    });
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    console.log(`📥 API response status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error response:`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`📋 Raw API response:`, data);
    
    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      console.error(`❌ No text in API response:`, data);
      throw new Error('No parsable text in AI response');
    }

    let bonkedData;
    try {
      bonkedData = JSON.parse(responseText);
      if (!bonkedData.bonkedSections || !bonkedData.summary) {
        throw new Error("Missing 'bonkedSections' or 'summary' in JSON response.");
      }
    } catch (e) {
      console.error(`❌ Failed to parse JSON response (attempt ${attemptLevel}):`, responseText, e);
      throw new Error('AI response was not valid JSON');
    }
    
    let { bonkedSections, summary } = bonkedData;
    console.log(`📝 Raw bonked text (${bonkedSections.length} parts):`, bonkedSections);
    console.log(`📜 New summary: "${summary}"`);
    
    // Simple cleanup
    bonkedSections = bonkedSections.map((section) => cleanupText(section, 1));
    console.log(`🧹 Cleaned bonked text (${bonkedSections.length} parts):`, bonkedSections);
    
    console.log(`✅ Successfully bonked chunk ${chunkIndex + 1} (attempt ${attemptLevel})`);
    
    // Send back to content script
    sendSuccessToTab(tabId, bonkedSections.join('---TEXT_SEPARATOR---'), summary, chunkIndex);
    
    return bonkedData;
    
  } catch (error) {
    console.error(`❌ Error processing chunk ${chunkIndex + 1} (attempt ${attemptLevel}):`, {
      error: error.message,
      stack: error.stack,
      tabId: tabId,
      chunkIndex: chunkIndex,
      attemptLevel: attemptLevel,
      textLength: text?.length || 0
    });
    
    // Try fallback if we haven't reached max attempts
    if (attemptLevel < maxAttempts) {
      console.log(`🔄 Trying fallback method ${attemptLevel + 1} for chunk ${chunkIndex + 1}`);
      return await processWithAIFallback(text, tabId, chunkIndex, context, previousSummary, attemptLevel + 1);
    }
    
    // Send error back to content script
    sendErrorToTab(tabId, 'AI processing failed after all fallback attempts: ' + error.message, chunkIndex);
    throw error;
  }
}

// Create a simple, reliable prompt for fallback
function createSimplePrompt(text, expectedParts, bonkLevel = 2) {
  console.log(`💭 Creating simple fallback prompt for ${expectedParts} parts with bonk level ${bonkLevel}`);
  
  // Adjust instructions based on bonk level
  let instruction;
  if (bonkLevel === 1) {
    instruction = "Make this text a bit simpler and clearer. Keep most of the original style and complexity.";
  } else if (bonkLevel === 3) {
    instruction = "Make this text much simpler and shorter. Use very easy words that a child could understand. Explain like I'm 5 years old.";
  } else {
    instruction = "Make this text much simpler and shorter. Use easy words that anyone can understand.";
  }
  
  const jsonInstruction = `
Your response must be a valid JSON object with:
1. "bonkedSections": An array of ${expectedParts} simplified strings
2. "summary": A short summary

Example:
{
  "bonkedSections": ["simple text 1", "simple text 2"],
  "summary": "summary of content"
}`;

  if (expectedParts === 1) {
    return `${instruction}

Text to simplify:
${text}

${jsonInstruction}`;
  } else {
    return `${instruction}

Sections to simplify:
${text}

${jsonInstruction}`;
  }
}

// Basic word substitution fallback
function basicWordSubstitution(text, bonkLevel = 2) {
  console.log(`🔧 Applying basic word substitution to: "${text.substring(0, 50)}..." with bonk level ${bonkLevel}`);
  
  const substitutions = {
    // Complex -> Simple word mappings
    'utilize': 'use',
    'commence': 'start',
    'terminate': 'end',
    'subsequently': 'then',
    'approximately': 'about',
    'demonstrate': 'show',
    'establish': 'set up',
    'fundamental': 'basic',
    'significant': 'important',
    'consequence': 'result',
    'therefore': 'so',
    'however': 'but',
    'furthermore': 'also',
    'nevertheless': 'but',
    'consequently': 'so',
    'accordingly': 'so',
    'specifically': 'exactly',
    'particularly': 'especially',
    'essentially': 'basically',
    'primarily': 'mainly',
    'initially': 'first',
    'subsequently': 'later',
    'ultimately': 'finally',
    'comprehensive': 'complete',
    'substantial': 'large',
    'adequate': 'enough',
    'sufficient': 'enough',
    'exceptional': 'special',
    'considerable': 'large',
    'numerous': 'many',
    'various': 'different',
    'alternative': 'other',
    'additional': 'more',
    'particular': 'special',
    'individual': 'single',
    'specific': 'exact',
    'general': 'basic',
    'typical': 'normal',
    'standard': 'normal',
    'traditional': 'old',
    'contemporary': 'modern',
    'previous': 'last',
    'subsequent': 'next',
    'preceding': 'before',
    'following': 'after',
    'adjacent': 'next to',
    'equivalent': 'equal',
    'similar': 'like',
    'identical': 'same',
    'different': 'other',
    'opposite': 'reverse',
    'contrary': 'opposite',
    'consistent': 'steady',
    'constant': 'steady',
    'variable': 'changing',
    'temporary': 'short',
    'permanent': 'lasting',
    'immediate': 'instant',
    'gradual': 'slow',
    'rapid': 'fast',
    'accelerate': 'speed up',
    'decelerate': 'slow down',
    'maintain': 'keep',
    'preserve': 'keep',
    'eliminate': 'remove',
    'reduce': 'lower',
    'increase': 'raise',
    'enhance': 'improve',
    'minimize': 'reduce',
    'maximize': 'increase',
    'optimize': 'improve',
    'facilitate': 'help',
    'accommodate': 'fit',
    'implement': 'use',
    'execute': 'do',
    'perform': 'do',
    'conduct': 'do',
    'accomplish': 'finish',
    'achieve': 'reach',
    'obtain': 'get',
    'acquire': 'get',
    'receive': 'get',
    'provide': 'give',
    'supply': 'give',
    'deliver': 'bring',
    'transmit': 'send',
    'communicate': 'talk',
    'indicate': 'show',
    'reveal': 'show',
    'display': 'show',
    'illustrate': 'show',
    'represent': 'show',
    'constitute': 'make up',
    'comprise': 'include',
    'contain': 'have',
    'possess': 'have',
    'retain': 'keep',
    'sustain': 'keep up',
    'support': 'help',
    'assist': 'help',
    'contribute': 'help',
    'participate': 'join',
    'collaborate': 'work together',
    'cooperate': 'work together',
    'coordinate': 'organize',
    'organize': 'set up',
    'arrange': 'set up',
    'prepare': 'get ready',
    'anticipate': 'expect',
    'predict': 'guess',
    'estimate': 'guess',
    'calculate': 'figure out',
    'determine': 'find out',
    'investigate': 'look into',
    'examine': 'check',
    'analyze': 'study',
    'evaluate': 'judge',
    'assess': 'check',
    'consider': 'think about',
    'contemplate': 'think about',
    'deliberate': 'think carefully',
    'conclude': 'decide',
    'determine': 'decide',
    'resolve': 'solve',
    'address': 'deal with',
    'approach': 'method',
    'strategy': 'plan',
    'technique': 'way',
    'procedure': 'steps',
    'process': 'steps',
    'mechanism': 'way',
    'phenomenon': 'thing',
    'occurrence': 'event',
    'situation': 'case',
    'circumstance': 'case',
    'condition': 'state',
    'requirement': 'need',
    'necessity': 'need',
    'obligation': 'duty',
    'responsibility': 'job',
    'opportunity': 'chance',
    'possibility': 'chance',
    'probability': 'chance',
    'likelihood': 'chance',
    'potential': 'possible',
    'capacity': 'ability',
    'capability': 'ability',
    'competence': 'skill',
    'proficiency': 'skill',
    'expertise': 'skill',
    'knowledge': 'facts',
    'information': 'facts',
    'understanding': 'knowledge',
    'comprehension': 'understanding',
    'awareness': 'knowing',
    'recognition': 'knowing',
    'identification': 'naming',
    'classification': 'grouping',
    'categorization': 'grouping',
    'organization': 'setup',
    'structure': 'setup',
    'arrangement': 'order',
    'configuration': 'setup',
    'formation': 'making',
    'construction': 'building',
    'development': 'growth',
    'evolution': 'change',
    'transformation': 'change',
    'modification': 'change',
    'alteration': 'change',
    'adjustment': 'change',
    'adaptation': 'change',
    'improvement': 'better',
    'advancement': 'progress',
    'progress': 'moving forward',
    'achievement': 'success',
    'accomplishment': 'success',
    'success': 'win',
    'failure': 'loss',
    'difficulty': 'problem',
    'challenge': 'problem',
    'obstacle': 'block',
    'barrier': 'block',
    'impediment': 'block',
    'restriction': 'limit',
    'limitation': 'limit',
    'constraint': 'limit',
    'boundary': 'edge',
    'perimeter': 'edge',
    'vicinity': 'area',
    'proximity': 'nearness',
    'distance': 'space',
    'location': 'place',
    'position': 'place',
    'destination': 'target',
    'origin': 'start',
    'source': 'start',
    'beginning': 'start',
    'commencement': 'start',
    'initiation': 'start',
    'conclusion': 'end',
    'termination': 'end',
    'completion': 'finish',
    'finalization': 'finish'
  };
  
  let simplified = text;
  
  // Apply substitutions (case-insensitive)
  for (const [complex, simple] of Object.entries(substitutions)) {
    const regex = new RegExp(`\\b${complex}\\b`, 'gi');
    simplified = simplified.replace(regex, simple);
  }
  
  // Adjust processing based on bonk level
  if (bonkLevel === 1) {
    // Little bonk - minimal changes
    // Just do word substitutions, keep original structure
  } else if (bonkLevel === 3) {
    // Big bonk - more aggressive simplification
    // Basic sentence shortening - split long sentences
    simplified = simplified.replace(/([.!?]\s+)([A-Z])/g, '$1\n$2');
    const sentences = simplified.split('\n');
    
    if (sentences.length > 1) {
      // Keep only the first 2 sentences for big bonk
      simplified = sentences.slice(0, Math.min(2, sentences.length)).join(' ');
    }
    
    // Add more casual language for big bonk
    simplified = simplified.replace(/\b(this|that|these|those)\b/gi, 'this thing');
    simplified = simplified.replace(/\b(complex|complicated)\b/gi, 'hard');
    simplified = simplified.replace(/\b(simple|easy)\b/gi, 'easy');
  } else {
    // Regular bonk - moderate simplification
    simplified = simplified.replace(/([.!?]\s+)([A-Z])/g, '$1\n$2');
    const sentences = simplified.split('\n');
    
    if (sentences.length > 1) {
      // Keep only the first 2-3 sentences
      simplified = sentences.slice(0, Math.min(3, sentences.length)).join(' ');
    }
  }
  
  // Clean up extra whitespace
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  console.log(`🔧 Word substitution result (level ${bonkLevel}): "${simplified.substring(0, 50)}..."`);
  return simplified;
}

// Helper function to send success to tab
function sendSuccessToTab(tabId, bonkedText, summary, chunkIndex) {
  console.log(`📤 Sending success to tab ${tabId} for chunk ${chunkIndex + 1}`);
  sendToTab(tabId, { 
    action: 'replaceText', 
    text: bonkedText,
    summary: summary,
    chunkIndex: chunkIndex
  });
}

// Helper function to send error to tab
function sendErrorToTab(tabId, errorMessage, chunkIndex) {
  console.log(`📤 Sending error to tab ${tabId} for chunk ${chunkIndex + 1}: ${errorMessage}`);
  sendToTab(tabId, { 
    action: 'error', 
    text: errorMessage,
    chunkIndex: chunkIndex
  });
}

// Create context-aware prompts for better AI processing
function createContextAwarePrompt(text, expectedParts, context = null, previousSummary = null, bonkLevel = 2) {
  console.log(`💭 Creating context-aware prompt for ${expectedParts} parts with bonk level ${bonkLevel}`);
  
  // Analyze context if provided
  let contextInstructions = '';
  if (context) {
    const types = context.types || [];
    if (types.includes('heading')) {
      contextInstructions += '\n- For headings, keep them short and punchy';
    }
    if (types.includes('quote')) {
      contextInstructions += '\n- For quotes, maintain the quote-like feel but simplify';
    }
    if (types.includes('list-item')) {
      contextInstructions += '\n- For list items, keep them brief and clear';
    }
    if (context.hasCode) {
      contextInstructions += '\n- Avoid changing any code-like content';
    }
  }
  
  const summaryInstruction = previousSummary 
    ? `The following is a summary of the content that came just before this section. Use it for context to ensure a smooth transition and consistent style, but DO NOT mention the summary in your output.\nPREVIOUS SUMMARY: "${previousSummary}"\n\n`
    : '';

  // Adjust main instruction based on bonk level
  let mainInstruction;
  let styleInstructions;
  
  if (bonkLevel === 1) {
    // Little bonk - light touch
    mainInstruction = "Transform the following content into a slightly simpler version. Keep most of the original style and complexity, but make it a bit more accessible.";
    styleInstructions = `- Keep it mostly the same length as original
- Use slightly simpler words where possible
- Maintain the professional tone
- Keep the main information intact without major changes${contextInstructions}`;
  } else if (bonkLevel === 3) {
    // Big bonk - explain like I'm 5
    mainInstruction = "Transform the following content into a very simple version that a child could understand. Use the simplest possible words and explanations.";
    styleInstructions = `- Much shorter than original
- Use very simple, everyday words (like a children's book)
- Explain complex ideas in the simplest way possible
- Add casual explanations like "this means..." or "basically..."
- Make it fun and easy to understand${contextInstructions}`;
  } else {
    // Regular bonk - balanced approach
    mainInstruction = "Transform the following content into a simpler, more entertaining version. Write like someone explaining complex stuff in everyday language with casual mistakes but keep it informative and readable.";
    styleInstructions = `- Much shorter than original
- Use simple, everyday words
- Add some casual spelling/grammar mistakes but keep readable
- Keep the main information intact
- Make it slightly amusing but still informative${contextInstructions}`;
  }

  const jsonInstruction = `
CRITICAL: Your entire response must be a single, valid JSON object. It must contain two keys:
1. "bonkedSections": An array of strings. Each string in the array must be a simplified version of the corresponding input section. You must return exactly as many strings in the array as there were input sections.
2. "summary": A very short, one-sentence summary of ALL the content you just processed.

Example response format:
{
  "bonkedSections": [
    "simplified text for section 1",
    "simplified text for section 2"
  ],
  "summary": "a brief one-sentence summary of all the processed text"
}`;
  
  if (expectedParts === 1) {
    return `${summaryInstruction}${mainInstruction}

Focus on making it shorter and more accessible while preserving the main ideas.

Content to transform:
${text}

Instructions:
${styleInstructions}
${jsonInstruction}`;
  } else {
    return `${summaryInstruction}You will be given ${expectedParts} content sections separated by "---TEXT_SEPARATOR---".
Your task is to individually transform each section into a simpler version.

After transforming ALL sections, your response must be a single JSON object as described below.

Content sections to process:
${text}

Instructions for transforming each section:
${styleInstructions}

${jsonInstruction}`;
  }
}

// Simple text cleanup with detailed logging
function cleanupText(text, expectedParts) {
  console.log(`🧹 Cleaning up text for ${expectedParts} expected parts`);
  console.log(`🧹 Input text: "${text}"`);
  
  // Remove quotes and cleanup
  text = text.replace(/^["']|["']$/g, '').trim();
  
  // Fix spacing
  text = text.replace(/\s+/g, ' ');
  
  if (expectedParts === 1) {
    // Single chunk - remove any separators
    text = text.replace(/---TEXT_SEPARATOR---/g, ' ').trim();
    if (text && !text.match(/[.!?]$/)) {
      text += '.';
    }
    console.log(`🧹 Single part result: "${text}"`);
  } else {
    // Multiple chunks - validate separators
    const parts = text.split('---TEXT_SEPARATOR---');
    console.log(`🧹 Found ${parts.length} parts, expected ${expectedParts}`);
    
    if (parts.length !== expectedParts) {
      console.warn(`⚠️ Part count mismatch! Expected ${expectedParts}, got ${parts.length}`);
      
      // Fix mismatch
      if (parts.length < expectedParts) {
        console.log(`➕ Padding with ${expectedParts - parts.length} fallback parts`);
        while (parts.length < expectedParts) {
          parts.push('__BONKD_SKIP__');
        }
      } else {
        console.log(`✂️ Trimming to ${expectedParts} parts`);
        parts.splice(expectedParts);
      }
    }
    
    // Clean each part
    text = parts.map((part, index) => {
      part = part.trim();
      // Do not add punctuation to the skip marker
      if (part && part !== '__BONKD_SKIP__' && !part.match(/[.!?]$/)) {
        part += '.';
      }
      console.log(`🧹 Part ${index + 1}: "${part}"`);
      return part;
    }).join('---TEXT_SEPARATOR---');
  }
  
  console.log(`🧹 Final cleaned text: "${text}"`);
  return text;
}

// Simple function to send messages to tabs with detailed logging
function sendToTab(tabId, message) {
  if (!tabId) {
    console.error('❌ No tab ID provided for message');
    return;
  }
  
  console.log(`📤 Sending message to tab ${tabId}:`, message);
  
  try {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error(`❌ Failed to send message to tab ${tabId}:`, chrome.runtime.lastError.message);
      } else {
        console.log(`✅ Message sent successfully to tab ${tabId}`, response);
      }
    });
  } catch (error) {
    console.error(`❌ Error sending message to tab ${tabId}:`, error);
  }
}

// Helper function to inject script and start bonking
function injectAndStart(tabId, bonkLevel, isReBonk) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }).then(() => {
    console.log('✅ Script injection successful');
    
    // Send start message to content script with bonk level
    chrome.tabs.sendMessage(tabId, { 
      action: 'startBonking',
      bonkLevel: bonkLevel,
      isReBonk: isReBonk
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Failed to send start message:', chrome.runtime.lastError);
      } else {
        console.log('✅ Start message sent successfully');
      }
    });
  }).catch(error => {
    console.error('❌ Failed to inject script:', error);
  });
} 