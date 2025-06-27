// Bonkd Extension Configuration
// Replace YOUR_API_KEY_HERE with your actual Gemini API key
// Get your API key from: https://aistudio.google.com/app/apikey
const CONFIG = {
  GEMINI_API_KEY: "YOUR_API_KEY_HERE"
};

// Make config available globally
if (typeof window !== 'undefined') {
  window.BONKD_CONFIG = CONFIG;
} else if (typeof self !== 'undefined') {
  self.BONKD_CONFIG = CONFIG;
} 