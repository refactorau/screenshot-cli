# Screenshot CLI Tool

A TypeScript CLI tool that takes screenshots of web pages and generates styled HTML and PDF reports with before/after comparison capabilities.

## Features

- 📸 Take full-page screenshots of websites
- 🔄 Before/after comparison mode with real-time image analysis
- 🆕 Independent before/after capture - capture at different times
- 📊 Beautiful HTML and PDF reports with dark theme
- 📁 Multiple input methods (URLs, text files, JS files)
- 🎨 Responsive design with modern UI
- ⚡ Fast and efficient using Playwright
- 🔧 Configurable viewport sizes and timeouts
- 🔄 Automatic retry mechanism for network errors
- 📋 Comprehensive error reporting and logging
- 🚀 Intelligent wait strategies for different site types
- 🕐 Automatic timeout adjustment for staging/WordPress sites
- 💾 Data persistence with `.jsonc` files for report regeneration (or plain `.json` files)
- 🔍 Image comparison performed during capture with persistent storage
- 🔄 Separate report generation from existing data files
- 🔁 Smart data merging for re-capturing and partial updates

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

The CLI has three main commands: `capture` for taking screenshots, `compare` for adding comparison data to existing before/after data files, and `generate` for creating reports from existing data.

**For regular usage** (after building), use:

- `pnpm capture` - Take screenshots
- `pnpm compare` - Add comparison data to existing before/after data files
- `pnpm generate` - Generate reports from existing data

**For development** (when working on the tool), use:

- `pnpm dev capture` - Run capture in development mode
- `pnpm dev compare` - Run compare in development mode
- `pnpm dev generate` - Run generate in development mode

### Command Overview

- **`capture`** - Takes screenshots with flexible modes:
  - Default: Single screenshots with smart merging
  - `--before-after`: Sequential before/after with immediate comparison
  - `--before`: Independent before screenshots
  - `--after`: Independent after screenshots
- **`compare`** - Adds or updates image comparison data in existing before/after data files
- **`generate`** - Creates HTML/PDF reports from data files (uses existing comparison data, no image processing)

### Screenshot Capture

```bash
# Take screenshots of URLs
pnpm capture --urls "https://example.com,https://google.com"

# Use a text file with URLs
pnpm capture --file urls.txt

# Use a JavaScript file with URLs
pnpm capture --file urls.js
```

### Before/After Comparison Modes

#### Traditional Before/After Mode

```bash
# Enable sequential before/after comparison
pnpm capture --file urls.txt --before-after

# The tool will:
# 1. Take "before" screenshots
# 2. Ask you to confirm when ready for "after" screenshots
# 3. Take "after" screenshots
# 4. Perform real-time image comparison analysis
# 5. Store comparison data (diff %, change level, diff images) in .jsonc file
# 6. Generate comparison report

# You'll see comparison progress during capture:
# ✅ Image comparison complete: 3 changed, 7 unchanged
```

#### Independent Before/After Capture

Capture before and after screenshots at different times - perfect for deployments, A/B testing, or long-term monitoring:

```bash
# Step 1: Capture "before" screenshots (e.g., before deployment)
pnpm capture --before --file urls.txt --title "Pre-Deploy"

# Step 2: Later, capture "after" screenshots (e.g., after deployment)
pnpm capture --after --file urls.txt --title "Pre-Deploy"

# Step 3: Add comparison data
pnpm compare pre-deploy-data.jsonc

# Step 4: Generate final report
pnpm generate pre-deploy-data.jsonc
```

**Using JSON instead of JSONC:**

If you prefer plain JSON files without comments, use the `--json-only` flag consistently:

```bash
# Step 1: Create JSON data file (no comments)
pnpm capture --before --json-only --file urls.txt --title "Pre-Deploy"

# Step 2: Update the same JSON file (must use --json-only again)
pnpm capture --after --json-only --file urls.txt --title "Pre-Deploy"

# Step 3: Compare and generate (works with both .json and .jsonc files)
pnpm compare pre-deploy-data.json
pnpm generate pre-deploy-data.json
```

**Key Benefits:**

- 🕐 **Flexible Timing**: Capture before/after at any interval (minutes, hours, days)
- 🔄 **Re-capturable**: Update either before or after screenshots independently
- 📊 **Data Preservation**: Original timestamps and data are preserved
- 🔁 **Smart Merging**: Automatically merges new captures with existing data

### Compare Mode

The `compare` command adds image comparison data to existing before/after data files:

```bash
# Add comparison data to existing data file (if not done during capture)
pnpm compare report-data.jsonc

# Works with both JSONC and JSON files
pnpm compare report-data.json

# Customize comparison sensitivity
pnpm compare --comparison-threshold 0.05 --min-change-threshold 1.0 report-data.jsonc

# Skip generating diff images to save space
pnpm compare --skip-diff-images report-data.jsonc

# Update comparison data with different settings
pnpm compare --ignore-antialiasing report-data.jsonc
```

### Report Generation

```bash
# Generate HTML report from existing data file
pnpm generate report-data.jsonc

# Works with both JSONC and JSON files
pnpm generate report-data.json

# Generate PDF report from existing data file
pnpm generate --report-type pdf report-data.jsonc

# Generate both HTML and PDF reports
pnpm generate --report-type all report-data.jsonc
```

### Comparison Data Storage

When using before/after mode, image comparison data is automatically calculated during capture and stored in the `.jsonc` data file:

```json
{
  "comparison": {
    "diffPixels": 192764,
    "totalPixels": 21897600,
    "diffPercentage": 0.88,
    "changeLevel": "minimal",
    "hasSignificantChange": true,
    "diffImagePath": "screenshots/example.com_before_diff.png"
  }
}
```

This enables:

- **Consistent reports**: Same comparison data across multiple report generations
- **Faster report generation**: No need to re-calculate image differences
- **Data persistence**: Comparison results are preserved for future analysis

### Capture Options

#### Basic Options

- `-u, --urls <urls>` - Comma-separated list of URLs
- `-f, --file <file>` - Path to file containing URLs
- `-o, --output <directory>` - Output directory (default: output)
- `--title <title>` - Report title (used for filenames) (default: Report)

#### Capture Modes

- `-b, --before-after` - Enable sequential before/after comparison mode
- `--before` - Capture only before screenshots (for independent workflow)
- `--after` - Capture only after screenshots (for independent workflow)

**Note:** Only one of `--before-after`, `--before`, or `--after` can be used at a time.

#### Browser Configuration

- `-w, --width <width>` - Viewport width (default: 1920)
- `-h, --height <height>` - Viewport height (default: 1080)
- `-t, --timeout <timeout>` - Page load timeout in milliseconds (default: 30000)
- `--wait-strategy <strategy>` - Page load wait strategy: networkidle, load, domcontentloaded (default: load)

#### Network & Reliability

- `-r, --max-retries <retries>` - Maximum retry attempts for network errors (default: 3)
- `--retry-delay <delay>` - Delay between retries in milliseconds (default: 2000)

#### Report Generation

- `--report-type <type>` - Report type: html, pdf, all (default: html)

#### Comparison Settings

- `--comparison-threshold <threshold>` - Pixelmatch threshold for comparison (0-1) (default: 0.1)
- `--min-change-threshold <threshold>` - Minimum change percentage to highlight (0-100) (default: 0.5)
- `--skip-diff-images` - Skip generating diff images for unchanged pages
- `--comparison-only` - Only show pages with changes in reports

#### Data File Format

- `--json-only` - Save data file as plain JSON instead of JSONC (JSON with comments)

### Generate Options

- `--report-type <type>` - Report type: html, pdf, all (default: html)

### Compare Options

The `compare` command adds or updates image comparison data in existing before/after data files:

```bash
# Add comparison data to existing data file
pnpm compare report-data.jsonc

# Customize comparison settings
pnpm compare --comparison-threshold 0.05 --min-change-threshold 1.0 report-data.jsonc
```

- `--comparison-threshold <threshold>` - Pixelmatch threshold for comparison (0-1) (default: 0.1)
- `--min-change-threshold <threshold>` - Minimum change percentage to highlight (0-100) (default: 0.5)
- `--skip-diff-images` - Skip generating diff images for unchanged pages
- `--ignore-antialiasing` - Ignore anti-aliased pixels in comparison

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
- **Data File**: JSON file with metadata and results (`title-data.jsonc` or `title-data.json` with `--json-only`)
- **HTML Report**: Styled report with screenshot gallery (`title.html`)
- **PDF Report**: Formatted PDF report (`title.pdf`)
- **Comparison View**: Side-by-side before/after images (in comparison mode)

## Examples

### Single Mode

```bash
pnpm capture --urls "https://example.com" --output ./screenshots --title "Example Site"
```

### Traditional Before/After Mode

```bash
pnpm capture --file urls.txt --before-after --output ./comparison --title "Site Comparison"
```

### Independent Before/After Workflow

```bash
# Capture before screenshots (e.g., before deployment)
pnpm capture --before --file urls.txt --output ./deploy-comparison --title "Deploy-Check"

# Later: capture after screenshots (e.g., after deployment)
pnpm capture --after --file urls.txt --output ./deploy-comparison --title "Deploy-Check"

# Add comparison data and generate report
pnpm compare ./deploy-comparison/deploy-check-data.jsonc
pnpm generate ./deploy-comparison/deploy-check-data.jsonc
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

## Data Persistence & Smart Merging

The tool saves all screenshot data and metadata to data files with intelligent merging capabilities:

### Data File Formats

The tool supports two data file formats:

#### JSONC (Default) - JSON with Comments

- **Extension**: `.jsonc`
- **Features**: Rich comments explaining data structure and metadata
- **Use case**: Human-readable files for documentation and understanding
- **Example**: `report-data.jsonc`

#### JSON - Plain JSON

- **Extension**: `.json`
- **Features**: Clean JSON without comments, smaller file size
- **Use case**: Automated processing, CI/CD pipelines, minimal storage
- **Flag**: Use `--json-only` flag during capture
- **Example**: `report-data.json`

**Important:** When using independent before/after capture modes (`--before`/`--after`), be consistent with the `--json-only` flag:

```bash
# ✅ Correct - consistent flag usage
pnpm capture --before --json-only --title "test" -u "https://example.com"
pnpm capture --after --json-only --title "test" -u "https://example.com"

# ❌ Problematic - inconsistent flag usage creates separate files
pnpm capture --before --json-only --title "test" -u "https://example.com"  # Creates test-data.json
pnpm capture --after --title "test" -u "https://example.com"              # Creates test-data.jsonc
```

### Core Features

- Regenerate reports without retaking screenshots
- Switch between HTML and PDF formats
- Share data files for collaborative reporting
- Archive screenshot sessions with full metadata
- Both JSONC and JSON formats supported by all commands (`compare`, `generate`)

### Smart Data Merging

- **Re-capturing**: Update specific URLs without losing other data
- **Independent Workflows**: Merge before/after captures taken at different times
- **Timestamp Preservation**: Original capture times are never overwritten
- **Partial Updates**: Add new URLs to existing datasets
- **Data Integrity**: Automatic conflict resolution and data validation

### Examples

```bash
# Initial capture of multiple URLs
pnpm capture --urls "https://site1.com,https://site2.com,https://site3.com" --title "Multi-Site"

# Later: re-capture only one URL (others are preserved)
pnpm capture --urls "https://site2.com" --title "Multi-Site"

# Result: site1.com and site3.com keep original data, site2.com gets updated
```

This separation of capture and generation phases, combined with smart merging, makes the tool highly efficient and flexible for different workflows.

## Common Workflow Patterns

### 1. Deployment Verification

```bash
# Before deployment
pnpm capture --before --file production-urls.txt --title "Deploy-v2.1"

# Deploy your changes...

# After deployment
pnpm capture --after --file production-urls.txt --title "Deploy-v2.1"

# Generate comparison report
pnpm compare deploy-v2.1-data.jsonc
pnpm generate --report-type all deploy-v2.1-data.jsonc
```

**Using JSON format:**

```bash
# Before deployment (creates .json file)
pnpm capture --before --json-only --file production-urls.txt --title "Deploy-v2.1"

# After deployment (updates same .json file)
pnpm capture --after --json-only --file production-urls.txt --title "Deploy-v2.1"

# Generate comparison report
pnpm compare deploy-v2.1-data.json
pnpm generate --report-type all deploy-v2.1-data.json
```

### 2. A/B Testing

```bash
# Capture variant A
pnpm capture --before --urls "https://mysite.com/landing-a" --title "AB-Test"

# Switch to variant B and capture
pnpm capture --after --urls "https://mysite.com/landing-b" --title "AB-Test"

# Compare variants
pnpm compare ab-test-data.jsonc
```

### 3. Long-term Monitoring

```bash
# Weekly screenshots
pnpm capture --before --file monitoring-urls.txt --title "Weekly-$(date +%Y-%m-%d)"

# Next week
pnpm capture --after --file monitoring-urls.txt --title "Weekly-$(date +%Y-%m-%d)"

# Generate trend report
pnpm compare weekly-*-data.jsonc
```

### 4. Progressive Capture

```bash
# Start with a few critical pages
pnpm capture --urls "https://site.com,https://site.com/pricing" --title "Site-Check"

# Later, add more pages to the same dataset
pnpm capture --urls "https://site.com/about,https://site.com/contact" --title "Site-Check"

# All pages are now in one report
pnpm generate site-check-data.jsonc
```

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

- **v1.2.1** - Added `--json-only` flag for plain JSON output (without comments) as an alternative to JSONC format
- **v1.2.0** - Added independent before/after capture modes (`--before`, `--after`), smart data merging for re-capturing, timestamp preservation, and enhanced data persistence
- **v1.1.0** - Added real-time image comparison, persistent comparison data storage, dedicated `compare` command, enhanced reports with comparison badges and statistics, change level classification, and improved PDF reports with comparison view
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
