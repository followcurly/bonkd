// Bonkd Background Script
console.log('Bonkd background script loaded');

importScripts('config.js');

const activeTabs = new Set();
let currentBonkLevel = 2; // Default to "bonk"

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  try {
    if (request.action === 'bonk') {
      currentBonkLevel = request.bonkLevel || 2;
      const isReBonk = request.isReBonk || false;
      
      chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
        if (tabs.length > 0) {
          const tabId = tabs[0].id;
          
          if (isReBonk) {
            chrome.tabs.sendMessage(tabId, { 
              action: 'startReBonking',
              bonkLevel: currentBonkLevel 
            }, (response) => {
              if (chrome.runtime.lastError) {
                console.error('Failed to send re-bonk message:', chrome.runtime.lastError);
                injectAndStart(tabId, currentBonkLevel, false);
              }
            });
          } else {
            injectAndStart(tabId, currentBonkLevel, false);
          }
        }
      });
      sendResponse({ success: true });
      
    } else if (request.action === 'processText') {
      handleAsyncProcessing(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    }
  } catch (error) {
    console.error('Error in message listener:', error);
    sendResponse({ error: error.message });
  }
});

function getBonkLevelName(level) {
  const names = { 1: 'Little Bonk', 2: 'Bonk', 3: 'Big Bonk' };
  return names[level] || 'Bonk';
}

async function handleAsyncProcessing(request, sender, sendResponse) {
  try {
    await processWithAI(request.text, sender.tab?.id, request.chunkIndex, request.context, request.previousSummary);
    sendResponse({ received: true });
  } catch (error) {
    console.error('Async processing failed:', error);
    sendResponse({ error: error.message });
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    activeTabs.delete(tabId);
  }
});

async function processWithAI(text, tabId, chunkIndex = 0, context = null, previousSummary = null) {
  return await processWithAIFallback(text, tabId, chunkIndex, context, previousSummary);
}

async function processWithAIFallback(text, tabId, chunkIndex, context, previousSummary, attemptLevel = 1) {
  const maxAttempts = 3;
  
  try {
    const apiKey = self.BONKD_CONFIG?.GEMINI_API_KEY;
    
    if (!apiKey || apiKey === "YOUR_API_KEY_HERE") {
      const errorMsg = 'API key not configured!';
      console.error(errorMsg);
      sendErrorToTab(tabId, errorMsg, chunkIndex);
      throw new Error(errorMsg);
    }
    
    if (!text || text.length === 0) {
      const errorMsg = 'No text provided!';
      console.error(errorMsg);
      sendErrorToTab(tabId, errorMsg, chunkIndex);
      throw new Error(errorMsg);
    }
    
    if (text.length > 30000) {
      const errorMsg = `Text too long! (${text.length} chars, max 30000)`;
      console.error(errorMsg);
      sendErrorToTab(tabId, errorMsg, chunkIndex);
      throw new Error(errorMsg);
    }
    
    const textParts = text.split('---TEXT_SEPARATOR---');
    
    let prompt;
    if (attemptLevel === 1) {
      prompt = createContextAwarePrompt(text, textParts.length, context, previousSummary, currentBonkLevel);
    } else if (attemptLevel === 2) {
      prompt = createSimplePrompt(text, textParts.length, currentBonkLevel);
    } else {
      // Basic word substitution fallback
      const simplifiedSections = textParts.map(part => basicWordSubstitution(part.trim(), currentBonkLevel));
      const bonkedData = {
        bonkedSections: simplifiedSections,
        summary: "Content simplified using basic word substitution"
      };
      sendSuccessToTab(tabId, bonkedData.bonkedSections.join('---TEXT_SEPARATOR---'), bonkedData.summary, chunkIndex);
      return bonkedData;
    }
    
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-8b:generateContent?key=${apiKey}`;
    
    const requestBody = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: attemptLevel === 1 ? 0.7 : 0.3,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 4096
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
      ]
    };
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error response:', errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!responseText) {
      console.error('No text in API response:', data);
      throw new Error('No parsable text in AI response');
    }

    let bonkedData;
    try {
      bonkedData = JSON.parse(responseText);
      if (!bonkedData.bonkedSections || !bonkedData.summary) {
        throw new Error("Missing 'bonkedSections' or 'summary' in JSON response.");
      }
    } catch (e) {
      console.error('Failed to parse JSON response:', e);
      throw new Error('AI response was not valid JSON');
    }
    
    let { bonkedSections, summary } = bonkedData;
    bonkedSections = bonkedSections.map((section) => cleanupText(section, 1));
    
    sendSuccessToTab(tabId, bonkedSections.join('---TEXT_SEPARATOR---'), summary, chunkIndex);
    
    return bonkedData;
    
  } catch (error) {
    console.error('Error processing chunk:', error.message);
    
    if (attemptLevel < maxAttempts) {
      return await processWithAIFallback(text, tabId, chunkIndex, context, previousSummary, attemptLevel + 1);
    }
    
    sendErrorToTab(tabId, 'AI processing failed after all fallback attempts: ' + error.message, chunkIndex);
    throw error;
  }
}

function createSimplePrompt(text, expectedParts, bonkLevel = 2) {
  let instruction;
  if (bonkLevel === 1) {
    instruction = "Make this text a bit simpler and clearer. Keep most of the original style and complexity.";
  } else if (bonkLevel === 3) {
    instruction = "Make this text much simpler and shorter. Use very easy words that a child could understand. Explain like I'm 5 years old.";
  } else {
    instruction = "Make this text much simpler and shorter. Use veryeasy words that anyone can understand.";
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

function basicWordSubstitution(text, bonkLevel = 2) {
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
  
  simplified = simplified.replace(/\s+/g, ' ').trim();
  
  return simplified;
}

function sendSuccessToTab(tabId, bonkedText, summary, chunkIndex) {
  sendToTab(tabId, { 
    action: 'replaceText', 
    text: bonkedText,
    summary: summary,
    chunkIndex: chunkIndex
  });
}

function sendErrorToTab(tabId, errorMessage, chunkIndex) {
  sendToTab(tabId, { 
    action: 'error', 
    text: errorMessage,
    chunkIndex: chunkIndex
  });
}

function createContextAwarePrompt(text, expectedParts, context = null, previousSummary = null, bonkLevel = 2) {
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

function cleanupText(text, expectedParts) {
  text = text.replace(/^["']|["']$/g, '').trim();
  text = text.replace(/\s+/g, ' ');
  
  if (expectedParts === 1) {
    text = text.replace(/---TEXT_SEPARATOR---/g, ' ').trim();
    if (text && !text.match(/[.!?]$/)) {
      text += '.';
    }
  } else {
    const parts = text.split('---TEXT_SEPARATOR---');
    
    if (parts.length !== expectedParts) {
      if (parts.length < expectedParts) {
        while (parts.length < expectedParts) {
          parts.push('__BONKD_SKIP__');
        }
      } else {
        parts.splice(expectedParts);
      }
    }
    
    text = parts.map((part) => {
      part = part.trim();
      if (part && part !== '__BONKD_SKIP__' && !part.match(/[.!?]$/)) {
        part += '.';
      }
      return part;
    }).join('---TEXT_SEPARATOR---');
  }
  
  return text;
}

function sendToTab(tabId, message) {
  if (!tabId) {
    console.error('No tab ID provided for message');
    return;
  }
  
  try {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send message to tab:', chrome.runtime.lastError.message);
      }
    });
  } catch (error) {
    console.error('Error sending message to tab:', error);
  }
}

function injectAndStart(tabId, bonkLevel, isReBonk) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ['content.js']
  }).then(() => {
    chrome.tabs.sendMessage(tabId, { 
      action: 'startBonking',
      bonkLevel: bonkLevel,
      isReBonk: isReBonk
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Failed to send start message:', chrome.runtime.lastError);
      }
    });
  }).catch(error => {
    console.error('Failed to inject script:', error);
  });
} 