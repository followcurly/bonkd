# Bonkd Chrome Extension

**Make any webpage simple to read with AI-powered text simplification.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)

Transform complex articles, news, and web content into easy-to-read text with one click.

## Features

- **3 Simplification Levels**: Little Bonk (light), Bonk (balanced), Big Bonk (ELI5)
- **Toggle View**: Switch between original and simplified text instantly
- **Smart Detection**: Automatically finds main content, ignores ads and navigation
- **Remembers Settings**: Saves your preferences
- **Works Offline**: Uses word substitution fallback when API is unavailable

## How to Use

1. Navigate to any text-heavy webpage
2. Click the Bonkd icon in your toolbar  
3. Choose your simplification level
4. Click "Simplify Page"
5. Toggle between original and simplified text anytime

## Quick Setup

### Prerequisites
- Google Chrome browser
- Gemini API key (free tier available)

### Installation
1. Clone this repository
2. Get a Gemini API key at [Google AI Studio](https://aistudio.google.com/app/apikey)
3. Replace `YOUR_API_KEY_HERE` in `config.js` with your actual key
4. Load the extension in Chrome (see [SETUP.md](SETUP.md) for details)

## Perfect For

- Students struggling with complex papers
- Non-native English speakers
- Quick content summaries
- Accessibility needs
- Anyone who wants simpler content

## Privacy & Security

- No data collection
- No account required
- API key stays on your computer
- Original content always preserved

## For Developers

### Project Structure
```
bonkd/
├── manifest.json      # Extension configuration
├── popup.html/css/js  # User interface
├── background.js      # AI processing & API communication
├── content.js         # Content detection & replacement
├── config.js          # Configuration (API key)
└── icons/             # Extension icons
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details. 