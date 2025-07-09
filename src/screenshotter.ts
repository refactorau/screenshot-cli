import { chromium, Browser, Page } from 'playwright';
import { join } from 'path';
import chalk from 'chalk';
import ora from 'ora';
import { ScreenshotOptions, ScreenshotResult } from './types';
import { sanitizeFilename, ensureDirectory } from './utils';

export class Screenshotter {
  private browser: Browser | null = null;
  async initialize(): Promise<void> {
    const spinner = ora('Launching browser...').start();
    try {
      this.browser = await chromium.launch();
      spinner.succeed('Browser launched');
    } catch (error) {
      spinner.fail('Failed to launch browser');
      throw error;
    }
  }

  async takeScreenshots(
    urls: string[],
    options: ScreenshotOptions,
    mode: 'before' | 'after' | 'single' = 'single'
  ): Promise<ScreenshotResult[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    // Ensure both output directory and screenshots subdirectory exist
    await ensureDirectory(options.output);
    const screenshotsDir = join(options.output, 'screenshots');
    await ensureDirectory(screenshotsDir);

    const results: ScreenshotResult[] = [];

    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];

      // Check if this is a staging/WordPress site for display purposes
      const isStaging = url.includes('staging.') || url.includes('dev.') || url.includes('test.');
      const isWordPress = url.includes('wp-') || url.includes('wordpress');
      const stagingInfo = (isStaging || isWordPress) ? ' (60s timeout)' : '';

      const spinner = ora(
        `Taking screenshot ${i + 1}/${urls.length}: ${url}${stagingInfo}`
      ).start();

      try {
        const result = await this.takeScreenshot(url, options, mode);
        results.push(result);
        spinner.succeed(`Screenshot saved: ${url}`);
      } catch (error) {
        const errorResult: ScreenshotResult = {
          url,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date(),
        };
        results.push(errorResult);
        spinner.fail(`Failed: ${url} - ${errorResult.error}`);
      }
    }

    return results;
  }

  private async takeScreenshot(
    url: string,
    options: ScreenshotOptions,
    mode: 'before' | 'after' | 'single'
  ): Promise<ScreenshotResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 2000;
    let lastError: Error | null = null;

    try {
      await page.setViewportSize({
        width: options.width,
        height: options.height,
      });

      // Retry logic for network issues
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          // Increase timeout for staging environments or WordPress sites
          const isStaging = url.includes('staging.') || url.includes('dev.') || url.includes('test.');
          const isWordPress = url.includes('wp-') || url.includes('wordpress');
          const adjustedTimeout = (isStaging || isWordPress) ? Math.max(options.timeout, 60000) : options.timeout;

          await page.goto(url, {
            waitUntil: options.waitStrategy || 'load',
            timeout: adjustedTimeout,
          });
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');

          // Check if it's a network-related error that we should retry
          const isNetworkError = lastError.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
            lastError.message.includes('net::ERR_CONNECTION_REFUSED') ||
            lastError.message.includes('net::ERR_TIMEOUT') ||
            lastError.message.includes('Timeout');

          if (isNetworkError && attempt < maxRetries) {
            console.log(`  ⚠️  Network error on attempt ${attempt}/${maxRetries}, retrying in ${retryDelay / 1000}s...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }

          // If not a network error or max retries reached, throw the error
          throw lastError;
        }
      }

      // Wait a bit more for dynamic content
      await page.waitForTimeout(2000);

      const filename = sanitizeFilename(url);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      let screenshotPath: string;
      const screenshotsDir = join(options.output, 'screenshots');

      if (mode === 'single') {
        screenshotPath = join(screenshotsDir, `${filename}.png`);
      } else {
        screenshotPath = join(
          screenshotsDir,
          `${filename}_${mode}.png`
        );
      }

      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      const result: ScreenshotResult = {
        url,
        timestamp: new Date(),
      };

      if (mode === 'single') {
        result.singlePath = screenshotPath;
      } else if (mode === 'before') {
        result.beforePath = screenshotPath;
      } else {
        result.afterPath = screenshotPath;
      }

      return result;
    } finally {
      await page.close();
    }
  }

  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
} 