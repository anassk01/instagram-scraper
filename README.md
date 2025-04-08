# Instagram Scraper

A modular Instagram scraper that uses Playwright to extract various data while maintaining your login session through Firefox cookies.

## Features

- 🔐 **Cookie-based Authentication**: Uses your existing Firefox cookies to maintain login state
- 🔄 **Modular Architecture**: Components can be updated independently
- 🛡️ **Anti-Detection**: Minimizes bot detection risk
- 📊 **Flexible Data Extraction**: Extracts profile information, posts, followers, and more (extendable)
- 📸 **Screenshot Capture**: Takes screenshots for verification

## Prerequisites

- Node.js (v16+)
- Firefox browser with an active Instagram login
- npm or yarn package manager

## Installation

```bash
# Clone the repository
git clone https://github.com/anassk01/instagram-scraper.git
cd instagram-scraper

# Install dependencies
npm install

# Build the project
npm run build
```

## Usage

```bash
# Example: Run the profile scraper
FIREFOX_PROFILE_PATH="/path/to/firefox/profile" npm start https://www.instagram.com/username profile

# Example: Run a different scraper (if implemented)
# FIREFOX_PROFILE_PATH="/path/to/firefox/profile" npm start <target_url_or_id> <script_name>
```

Replace the profile path with your Firefox profile location:
- Linux: `~/.mozilla/firefox/your_profile.default-release`
- Windows: `C:\Users\YourUser\AppData\Roaming\Mozilla\Firefox\Profiles\your_profile.default-release`
- macOS: `~/Library/Application Support/Firefox/Profiles/your_profile.default`

You also need to specify the target URL or ID and the name of the script you want to run (e.g., 'profile').

## Configuration

Create a `.env` file in the project root with the following variables:

```
# Firefox Profile Path
FIREFOX_PROFILE_PATH="/path/to/firefox/profile"

# Output Directory (optional)
OUTPUT_DIR="output"

# Default Script Name (optional, defaults to 'profile' if not provided via command line)
SCRIPT_NAME="profile"
```

## Project Structure

```
instagram-scraper/
├── src/
│   ├── browser.ts       # Browser controller
│   ├── index.ts         # Main entry point
│   ├── script-runner.ts # Script injection & execution logic
│   └── scripts/         # Extraction scripts
│       └── profile.ts   # Example: Profile data extractor
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

1. Edit or create a script in `src/scripts/` directory
2. Update `script-runner.ts` if adding a new script type
3. Build with `npm run build`
4. Test with `npm start <target> <script_name>`

### Adding New Scripts

1. Create a new script file in `src/scripts/` (e.g., `posts.ts`). Use existing scripts as a template for the structure.
2. Define the main extraction logic within your new script file.
3. Import and add your new script's execution function to the `runScript` function in `src/script-runner.ts`, associating it with a script name (e.g., 'posts').
4. Build the project: `npm run build`
5. Run your new script: `npm start <target_url_or_id> posts`

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 