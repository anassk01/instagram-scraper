# Instagram Profile Scraper

A modular Instagram scraper that uses Playwright to extract profile data while maintaining your login session through Firefox cookies.

## Features

- 🔐 **Cookie-based Authentication**: Uses your existing Firefox cookies to maintain login state
- 🔄 **Modular Architecture**: Components can be updated independently
- 🛡️ **Anti-Detection**: Minimizes bot detection risk
- 📊 **Complete Data Extraction**: Extracts profile information, bio, stats, and more
- 📸 **Screenshot Capture**: Takes screenshots for verification

## Prerequisites

- Node.js (v16+)
- Firefox browser with an active Instagram login
- npm or yarn package manager

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/instagram-scraper.git
cd instagram-scraper

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

```bash
# Run the scraper (profile extraction)
FIREFOX_PROFILE_PATH="/path/to/firefox/profile" npm start https://www.instagram.com/username
```

Replace the profile path with your Firefox profile location:
- Linux: `~/.mozilla/firefox/your_profile.default-release`
- Windows: `C:\Users\YourUser\AppData\Roaming\Mozilla\Firefox\Profiles\your_profile.default-release`
- macOS: `~/Library/Application Support/Firefox/Profiles/your_profile.default`

## Configuration

Create a `.env` file in the project root with the following variables:

```
# Firefox Profile Path
FIREFOX_PROFILE_PATH="/path/to/firefox/profile"

# Output Directory (optional)
OUTPUT_DIR="output"

# Default Script Name (optional)
SCRIPT_NAME="profile"
```

## Project Structure

```
instagram-scraper/
├── src/
│   ├── browser.ts       # Browser controller
│   ├── index.ts         # Main entry point
│   ├── script-runner.ts # Script injection
│   └── scripts/         # Extraction scripts
│       └── profile.ts   # Profile data extractor
├── dist/                # Compiled JavaScript
├── output/              # Scraped data and screenshots
├── .env                 # Environment variables
├── .gitignore           # Git ignore file
├── package.json         # Dependencies and scripts
├── README.md            # Documentation
└── tsconfig.json        # TypeScript configuration
```

## Development

### Workflow

1. Edit script in `src/scripts/` directory
2. Build with `npm run build`
3. Test with `npm start`

### Adding New Scripts

1. Create new script in `src/scripts/` (use existing as template)
2. Add the extraction function to `script-runner.ts`
3. Build and test

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 