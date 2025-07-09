import fs from 'fs/promises';
import { join, basename } from 'path';
import { ReportData, ScreenshotResult } from './types';

export class HtmlGenerator {
    async generateReport(data: ReportData, outputPath: string): Promise<string> {
        const template = await this.getTemplate();

        // Determine if outputPath is a full file path or a directory
        const isFilePath = outputPath.endsWith('.html');
        const reportPath = isFilePath ? outputPath : join(outputPath, 'report.html');
        const baseDir = isFilePath ? outputPath.replace(/[^/\\]*\.html$/, '') : outputPath;

        const html = await this.populateTemplate(template, data, baseDir);
        await fs.writeFile(reportPath, html, 'utf-8');

        return reportPath;
    }

    private async getTemplate(): Promise<string> {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Screenshot Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0d1117;
            color: #e6edf3;
            line-height: 1.6;
        }

        .container {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        header {
            text-align: center;
            margin-bottom: 3rem;
            padding: 2rem;
            background: #161b22;
            border-radius: 12px;
            border: 1px solid #30363d;
            position: relative;
        }

        h1 {
            color: #f0f6fc;
            font-size: 2.5rem;
            margin-bottom: 1rem;
        }

        .view-toggle {
            position: absolute;
            top: 2rem;
            right: 2rem;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            background: #21262d;
            padding: 0.75rem 1rem;
            border-radius: 8px;
            border: 1px solid #30363d;
        }

        .view-toggle label {
            color: #8b949e;
            font-size: 0.9rem;
            cursor: pointer;
        }

        .toggle-switch {
            position: relative;
            width: 44px;
            height: 24px;
            background: #30363d;
            border-radius: 12px;
            cursor: pointer;
            transition: background-color 0.3s;
        }

        .toggle-switch.active {
            background: #58a6ff;
        }

        .toggle-slider {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: #f0f6fc;
            border-radius: 50%;
            transition: transform 0.3s;
        }

        .toggle-switch.active .toggle-slider {
            transform: translateX(20px);
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }

        .stat-card {
            background: #21262d;
            padding: 1.5rem;
            border-radius: 8px;
            border: 1px solid #30363d;
            text-align: center;
        }

        .stat-number {
            font-size: 2rem;
            font-weight: bold;
            color: #58a6ff;
        }

        .stat-label {
            color: #8b949e;
            font-size: 0.9rem;
        }

        .results {
            margin-top: 3rem;
        }

        .result-item {
            background: #161b22;
            border: 1px solid #30363d;
            border-radius: 12px;
            margin-bottom: 2rem;
            overflow: hidden;
        }

        /* Fit-to-height mode */
        body.fit-height .result-item {
            margin-bottom: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        body.fit-height .results {
            margin-top: 0;
        }

        body.fit-height .container {
            max-width: 100%;
            padding: 0;
        }

        body.fit-height header {
            margin-bottom: 0;
            border-radius: 0;
        }

        .result-header {
            padding: 1.5rem;
            background: #21262d;
            border-bottom: 1px solid #30363d;
        }

        body.fit-height .result-header {
            padding: 1rem 1.5rem;
        }

        .url {
            font-size: 1.1rem;
            color: #58a6ff;
            text-decoration: none;
            word-break: break-all;
        }

        .url:hover {
            text-decoration: underline;
        }

        .timestamp {
            color: #8b949e;
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }

        .screenshots {
            padding: 1.5rem;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        body.fit-height .screenshots {
            padding: 1rem;
        }

        .screenshot-container {
            display: grid;
            gap: 2rem;
            width: 100%;
        }

        .before-after {
            grid-template-columns: 1fr 1fr;
        }

        .single {
            grid-template-columns: 1fr;
        }

        .screenshot-section {
            text-align: center;
        }

        .screenshot-label {
            font-size: 1.1rem;
            color: #f0f6fc;
            margin-bottom: 1rem;
            font-weight: 600;
        }

        body.fit-height .screenshot-label {
            font-size: 1rem;
            margin-bottom: 0.5rem;
        }

        .screenshot-img {
            max-width: 100%;
            border-radius: 8px;
            border: 1px solid #30363d;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        /* Fit-to-height mode image sizing */
        body.fit-height .screenshot-img {
            max-height: calc(100vh - 200px);
            width: auto;
            object-fit: contain;
        }

        body.fit-height .before-after .screenshot-img {
            max-height: calc(100vh - 220px);
        }

        .error {
            background: #2d1b20;
            border: 1px solid #f85149;
            color: #ffa7a3;
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
        }

        .success-count { color: #56d364; }
        .error-count { color: #f85149; }
        .total-count { color: #58a6ff; }

        /* Navigation instructions */
        .nav-instructions {
            position: fixed;
            bottom: 1rem;
            right: 1rem;
            background: #21262d;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            font-size: 0.85rem;
            color: #8b949e;
            opacity: 0;
            transition: opacity 0.3s;
        }

        body.fit-height .nav-instructions {
            opacity: 1;
        }

        @media (max-width: 768px) {
            .before-after {
                grid-template-columns: 1fr;
            }
            
            .container {
                padding: 1rem;
            }
            
            h1 {
                font-size: 2rem;
            }

            .view-toggle {
                position: relative;
                top: auto;
                right: auto;
                margin-top: 1rem;
                justify-content: center;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="view-toggle">
                <label for="viewToggle">Fit to Height</label>
                <div class="toggle-switch" id="viewToggle">
                    <div class="toggle-slider"></div>
                </div>
            </div>
            <h1>📸 Screenshot Report</h1>
            <p>Generated on {{generatedAt}}</p>
            <div class="stats">
                <div class="stat-card">
                    <div class="stat-number total-count">{{totalUrls}}</div>
                    <div class="stat-label">Total URLs</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number success-count">{{successCount}}</div>
                    <div class="stat-label">Successful</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number error-count">{{errorCount}}</div>
                    <div class="stat-label">Errors</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">{{mode}}</div>
                    <div class="stat-label">Mode</div>
                </div>
            </div>
        </header>

        <div class="results">
            {{results}}
        </div>
    </div>

    <div class="nav-instructions">
        Press Page Up/Down to navigate between screenshots
    </div>

    <script>
        // Toggle functionality
        const toggle = document.getElementById('viewToggle');
        const body = document.body;
        
        // Load saved preference
        const savedMode = localStorage.getItem('screenshotViewMode');
        if (savedMode === 'fit-height') {
            body.classList.add('fit-height');
            toggle.classList.add('active');
        }
        
        toggle.addEventListener('click', function() {
            body.classList.toggle('fit-height');
            toggle.classList.toggle('active');
            
            // Save preference
            const mode = body.classList.contains('fit-height') ? 'fit-height' : 'normal';
            localStorage.setItem('screenshotViewMode', mode);
        });

        // Smooth scrolling for fit-height mode
        document.addEventListener('keydown', function(e) {
            if (!body.classList.contains('fit-height')) return;
            
            if (e.key === 'PageDown' || e.key === 'PageUp') {
                e.preventDefault();
                
                const items = document.querySelectorAll('.result-item');
                const currentScroll = window.scrollY;
                let targetItem = null;
                
                if (e.key === 'PageDown') {
                    // Find next item
                    for (let item of items) {
                        if (item.offsetTop > currentScroll + 100) {
                            targetItem = item;
                            break;
                        }
                    }
                } else {
                    // Find previous item
                    for (let i = items.length - 1; i >= 0; i--) {
                        if (items[i].offsetTop < currentScroll - 100) {
                            targetItem = items[i];
                            break;
                        }
                    }
                }
                
                if (targetItem) {
                    targetItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        });
    </script>
</body>
</html>`;
    }

    private async populateTemplate(
        template: string,
        data: ReportData,
        outputPath: string
    ): Promise<string> {
        let html = template;

        // Replace basic placeholders
        html = html.replace('{{generatedAt}}', data.generatedAt.toLocaleString());
        html = html.replace('{{totalUrls}}', data.totalUrls.toString());
        html = html.replace('{{successCount}}', data.successCount.toString());
        html = html.replace('{{errorCount}}', data.errorCount.toString());
        html = html.replace(
            '{{mode}}',
            data.mode === 'before-after' ? 'Before/After' : 'Single'
        );

        // Generate results HTML
        const resultsHtml = await this.generateResultsHtml(
            data.results,
            data.mode,
            outputPath
        );
        html = html.replace('{{results}}', resultsHtml);

        return html;
    }

    private async generateResultsHtml(
        results: ScreenshotResult[],
        mode: string,
        outputPath: string
    ): Promise<string> {
        const resultItems = results.map((result) => {
            if (result.error) {
                return `
          <div class="result-item">
            <div class="result-header">
              <a href="${result.url}" class="url" target="_blank">${result.url
                    }</a>
              <div class="timestamp">${result.timestamp.toLocaleString()}</div>
            </div>
            <div class="error">
              <strong>Error:</strong> ${result.error}
            </div>
          </div>
        `;
            }

            if (mode === 'before-after') {
                const beforeImg = result.beforePath
                    ? `
          <div class="screenshot-section">
            <div class="screenshot-label">Before</div>
            <img src="screenshots/${basename(
                        result.beforePath
                    )}" alt="Before screenshot" class="screenshot-img">
          </div>
        `
                    : '<div class="screenshot-section"><div class="screenshot-label">Before</div><p>No screenshot available</p></div>';

                const afterImg = result.afterPath
                    ? `
          <div class="screenshot-section">
            <div class="screenshot-label">After</div>
            <img src="screenshots/${basename(
                        result.afterPath
                    )}" alt="After screenshot" class="screenshot-img">
          </div>
        `
                    : '<div class="screenshot-section"><div class="screenshot-label">After</div><p>No screenshot available</p></div>';

                return `
          <div class="result-item">
            <div class="result-header">
              <a href="${result.url}" class="url" target="_blank">${result.url
                    }</a>
              <div class="timestamp">${result.timestamp.toLocaleString()}</div>
            </div>
            <div class="screenshots">
              <div class="screenshot-container before-after">
                ${beforeImg}
                ${afterImg}
              </div>
            </div>
          </div>
        `;
            } else {
                const singleImg = result.singlePath
                    ? `
          <div class="screenshot-section">
            <img src="screenshots/${basename(
                        result.singlePath
                    )}" alt="Screenshot" class="screenshot-img">
          </div>
        `
                    : '<div class="screenshot-section"><p>No screenshot available</p></div>';

                return `
          <div class="result-item">
            <div class="result-header">
              <a href="${result.url}" class="url" target="_blank">${result.url
                    }</a>
              <div class="timestamp">${result.timestamp.toLocaleString()}</div>
            </div>
            <div class="screenshots">
              <div class="screenshot-container single">
                ${singleImg}
              </div>
            </div>
          </div>
        `;
            }
        });

        return resultItems.join('\n');
    }
} 