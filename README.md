# Screenshot CLI Tool

A TypeScript CLI tool that takes screenshots of web pages and generates styled HTML and PDF reports with before/after comparison capabilities.

## Features

- 📸 Take full-page screenshots of websites
- 🔄 Before/after comparison mode
- 📊 Beautiful HTML and PDF reports with dark theme
- 📁 Multiple input methods (URLs, text files, JS files)
- 🎨 Responsive design with modern UI
- ⚡ Fast and efficient using Playwright
- 🔧 Configurable viewport sizes and timeouts
- 🔄 Automatic retry mechanism for network errors
- 📋 Comprehensive error reporting and logging
- 🚀 Intelligent wait strategies for different site types
- 🕐 Automatic timeout adjustment for staging/WordPress sites
- 💾 Data persistence with `.jsonc` files for report regeneration
- 🔄 Separate report generation from existing data files

## Installation

```bash
# Clone and install dependencies
git clone <git@github.com:refactorau/screenshot-cli.git>
cd screenshot-cli
pnpm install

# Install Playwright browsers
pnpx playwright install chromium

# Build the project
pnpm build
```

## Usage

The CLI has two main commands: `capture` for taking screenshots and `generate` for creating reports from existing data.

**For regular usage** (after building), use:

- `pnpm capture` - Take screenshots
- `pnpm generate` - Generate reports from existing data

**For development** (when working on the tool), use:

- `pnpm dev capture` - Run capture in development mode
- `pnpm dev generate` - Run generate in development mode

### Screenshot Capture

```bash
# Take screenshots of URLs
pnpm capture --urls "https://example.com,https://google.com"

# Use a text file with URLs
pnpm capture --file urls.txt

# Use a JavaScript file with URLs
pnpm capture --file urls.js
```

### Before/After Mode

```bash
# Enable before/after comparison
pnpm capture --file urls.txt --before-after

# The tool will:
# 1. Take "before" screenshots
# 2. Ask you to confirm when ready for "after" screenshots
# 3. Take "after" screenshots
# 4. Generate comparison report
```

### Report Generation

```bash
# Generate HTML report from existing data file
pnpm generate report-data.jsonc

# Generate PDF report from existing data file
pnpm generate --report-type pdf report-data.jsonc

# Generate both HTML and PDF reports
pnpm generate --report-type all report-data.jsonc
```

### Capture Options

- `-u, --urls <urls>` - Comma-separated list of URLs
- `-f, --file <file>` - Path to file containing URLs
- `-o, --output <directory>` - Output directory (default: output)
- `-b, --before-after` - Enable before/after comparison mode
- `-w, --width <width>` - Viewport width (default: 1920)
- `-h, --height <height>` - Viewport height (default: 1080)
- `-t, --timeout <timeout>` - Page load timeout in milliseconds (default: 30000)
- `-r, --max-retries <retries>` - Maximum retry attempts for network errors (default: 3)
- `--retry-delay <delay>` - Delay between retries in milliseconds (default: 2000)
- `--wait-strategy <strategy>` - Page load wait strategy: networkidle, load, domcontentloaded (default: load)
- `--report-type <type>` - Report type: html, pdf, all (default: html)
- `--title <title>` - Report title (used for filenames) (default: Report)

### Generate Options

- `--report-type <type>` - Report type: html, pdf, all (default: html)

### Input File Formats

#### Text File (`urls.txt`)

```
https://example.com
https://google.com
# Comments are ignored
https://github.com
```

#### JavaScript File (`urls.js`)

```javascript
module.exports = [
  'https://example.com',
  'https://google.com',
  'https://github.com',
];
```

## Output

The tool generates:

- **Screenshots**: PNG files for each URL in `output/screenshots/`
- **Data File**: JSON file with metadata and results (`title-data.jsonc`)
- **HTML Report**: Styled report with screenshot gallery (`title.html`)
- **PDF Report**: Formatted PDF report (`title.pdf`)
- **Comparison View**: Side-by-side before/after images (in comparison mode)

## Examples

### Single Mode

```bash
pnpm capture --urls "https://example.com" --output ./screenshots --title "Example Site"
```

### Before/After Mode

```bash
pnpm capture --file urls.txt --before-after --output ./comparison --title "Site Comparison"
```

### Custom Viewport and PDF Report

```bash
pnpm capture --file urls.txt --width 1440 --height 900 --report-type pdf --title "Mobile View"
```

### Generate Reports from Existing Data

```bash
# Generate HTML report from existing data
pnpm generate ./output/site-comparison-data.jsonc

# Generate both HTML and PDF reports
pnpm generate --report-type all ./output/site-comparison-data.jsonc
```

### Error Resilience

```bash
# Increase retry attempts for unreliable networks
pnpm capture --file urls.txt --max-retries 5 --retry-delay 3000

# Disable retries for faster execution
pnpm capture --file urls.txt --max-retries 1
```

### Wait Strategies

```bash
# Default: Reliable for most modern websites (recommended)
pnpm capture --file urls.txt --wait-strategy load

# For sites with critical late-loading content (slower, may timeout)
pnpm capture --file urls.txt --wait-strategy networkidle

# For fastest execution (may miss some images/styles)
pnpm capture --file urls.txt --wait-strategy domcontentloaded
```

## Project Structure

```
screenshot-cli/
├── src/
│   ├── index.ts             # Main CLI entry point
│   ├── screenshotter.ts     # Screenshot capture logic
│   ├── html-generator.ts    # HTML report generation
│   ├── pdf-generator.ts     # PDF report generation
│   ├── data-persistence.ts  # Data file management
│   ├── types.ts             # TypeScript type definitions
│   └── utils.ts             # Utility functions
├── bin/
│   └── screenshot-cli.js    # Executable script
├── dist/                    # Built JavaScript files
└── output/                  # Generated screenshots and reports
```

## Development

```bash
# For new users - build first, then use the tool
pnpm build
pnpm capture --help
pnpm generate --help

# For developers working on the tool - use dev commands
pnpm dev capture --help
pnpm dev generate --help
```

## Data Persistence

The tool saves all screenshot data and metadata to `.jsonc` files, allowing you to:

- Regenerate reports without retaking screenshots
- Switch between HTML and PDF formats
- Share data files for collaborative reporting
- Archive screenshot sessions with full metadata

This separation of capture and generation phases makes the tool more efficient and flexible for different workflows.
