# Bonkd Extension Setup Guide

## Setup (5 minutes)

### 1. Get Your API Key
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy your API key

### 2. Configure the Extension
1. Open `config.js` 
2. Replace `"YOUR_API_KEY_HERE"` with your actual API key:
```javascript
const CONFIG = {
  GEMINI_API_KEY: "your-actual-api-key-here"
};
```
3. Save the file

### 3. Install in Chrome
1. Open Chrome and go to `chrome://extensions`
2. Turn on "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `bonkd` folder
5. The Bonkd icon should appear in your toolbar

### 4. Test It Out
1. Go to any article or webpage (try Wikipedia, news sites, blogs)
2. Click the Bonkd extension icon
3. Choose your simplification level:
   - **Little Bonk**: Light simplification
   - **Bonk**: Balanced simplification  
   - **Big Bonk**: Explain like I'm 5
4. Click "Simplify Page"

## Security Notes

- Keep your API key private - don't share it or commit it to Git
- Monitor your API usage - Gemini API has free tier with limits
- Your API key stays on your computer only

## Troubleshooting

**Extension won't load?**
- Make sure you've replaced the API key in `config.js`
- Check Chrome Developer Console for errors
- Verify you're in Developer Mode

**Not working on a page?**
- Try refreshing the page first
- Some sites block content modification
- Check if the page has much text content

**API errors?**
- Verify your API key is correct
- Check your Gemini API quota
- Make sure you have internet connection

## Updates

To update the extension:
1. Pull latest changes: `git pull origin main`
2. Go to `chrome://extensions`
3. Click the refresh icon on Bonkd extension
4. Test the new features

## Tips

- Works best on articles, blogs, Wikipedia, news sites
- Use toggle feature to switch between original and simplified text
- Change simplification levels and reprocess content anytime
- Extension automatically finds main content and ignores ads/navigation

---

**Need help?** Open an issue on GitHub or check the README for more details! 