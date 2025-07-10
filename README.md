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
git clone git@github.com:refactorau/screenshot-cli.git
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
module.exports = ['https://example.com', 'https://google.com', 'https://github.com'];
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

### Code Formatting

This project uses [Prettier](https://prettier.io/) for consistent code formatting:

```bash
# Format all files
pnpm format

# Check formatting (useful for CI)
pnpm format --check
```

**Prettier Configuration:**

- **Tab Width**: 2 spaces
- **Quotes**: Single quotes preferred
- **Print Width**: 120 characters
- **Semicolons**: Always required
- **Trailing Commas**: All where valid
- **Line Endings**: LF (Unix-style)

**VS Code Setup:**

If you're using VS Code, the project includes recommended settings that will:

- Automatically format code on save
- Suggest installing the Prettier extension
- Organize imports and fix linting issues automatically

Simply open the project in VS Code and accept the extension recommendations for the best development experience.

## Data Persistence

The tool saves all screenshot data and metadata to `.jsonc` files, allowing you to:

- Regenerate reports without retaking screenshots
- Switch between HTML and PDF formats
- Share data files for collaborative reporting
- Archive screenshot sessions with full metadata

This separation of capture and generation phases makes the tool more efficient and flexible for different workflows.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**MIT License Summary:**

- ✅ Commercial use allowed
- ✅ Private use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ❌ No warranty provided
- ❌ No liability assumed

## Versioning

This project follows [Semantic Versioning (SemVer)](https://semver.org/) guidelines:

- **MAJOR** version for incompatible API changes
- **MINOR** version for backward-compatible functionality additions
- **PATCH** version for backward-compatible bug fixes

### Version History

- **v1.0.0** - Initial stable release with full feature set

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

When contributing:

- **Code Style**: Run `pnpm format` before committing to ensure consistent formatting
- **Commit Messages**: Use [Conventional Commits](https://www.conventionalcommits.org/) specification
- **Testing**: Ensure all functionality works as expected
- **Documentation**: Update README and comments for significant changes
- **TypeScript**: Maintain strict type checking and proper interfaces

### Development Workflow

```bash
# 1. Install dependencies
pnpm install

# 2. Make your changes
# ... edit files ...

# 3. Format code
pnpm format

# 4. Build and test
pnpm build
pnpm capture --help  # Test CLI works

# 5. Commit with conventional format
git commit -m "feat: add new feature description"
```

## Support

For issues and questions, please use the [GitHub Issues](https://github.com/refactorau/screenshot-cli/issues) page.
