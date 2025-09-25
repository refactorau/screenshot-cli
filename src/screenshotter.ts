import ora from 'ora';
import { join } from 'path';
import { Browser, chromium } from 'playwright';
import { ScreenshotOptions, ScreenshotResult } from './types';
import { ensureDirectory, sanitizeFilename } from './utils';

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
    mode: 'before' | 'after' | 'single' = 'single',
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
      const stagingInfo = isStaging || isWordPress ? ' (60s timeout)' : '';

      const spinner = ora(`Taking screenshot ${i + 1}/${urls.length}: ${url}${stagingInfo}`).start();

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

  private async waitForImages(page: any, timeout: number = 10000): Promise<void> {
    console.log(`🖼️  Starting image loading detection with ${timeout}ms timeout...`);

    try {
      // First, get initial image status for logging
      const initialStatus = await page.evaluate(`
        (function() {
          const images = Array.from(document.querySelectorAll('img'));
          const backgroundImages = Array.from(document.querySelectorAll('*')).filter(el => {
            const style = window.getComputedStyle(el);
            return style.backgroundImage && style.backgroundImage !== 'none';
          });
          
          return {
            totalImages: images.length,
            totalBackgroundImages: backgroundImages.length,
            images: images.map((img, index) => ({
              index: index + 1,
              src: img.src,
              complete: img.complete,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              loading: img.loading,
              lazyLoading: img.hasAttribute('data-src') || img.hasAttribute('data-lazy') || img.classList.contains('lazy'),
              visible: img.offsetWidth > 0 && img.offsetHeight > 0
            })),
            backgroundImages: backgroundImages.map((el, index) => ({
              index: index + 1,
              backgroundImage: window.getComputedStyle(el).backgroundImage,
              tagName: el.tagName,
              className: el.className
            }))
          };
        })()
      `);

      console.log(`📊 Image analysis:`);
      console.log(`   • Found ${initialStatus.totalImages} <img> elements`);
      console.log(`   • Found ${initialStatus.totalBackgroundImages} elements with background images`);

      // Log details of each image
      initialStatus.images.forEach((img: any) => {
        const status = img.complete && img.naturalHeight > 0 ? '✅ Loaded' : '⏳ Loading';
        const lazyInfo = img.lazyLoading ? ' (LAZY)' : '';
        const visibleInfo = img.visible ? '' : ' (HIDDEN)';
        console.log(`   ${status} Image ${img.index}: ${img.src.substring(0, 80)}...${lazyInfo}${visibleInfo}`);
        if (!img.complete || img.naturalHeight === 0) {
          console.log(`     ↳ Dimensions: ${img.naturalWidth}x${img.naturalHeight}, Loading: ${img.loading}`);
        }
      });

      // Log background images
      if (initialStatus.backgroundImages.length > 0) {
        console.log(`🎨 Background images found:`);
        initialStatus.backgroundImages.forEach((bg: any) => {
          console.log(`   • ${bg.tagName}.${bg.className}: ${bg.backgroundImage.substring(0, 80)}...`);
        });
      }

      // Scroll through page to trigger lazy loading
      console.log(`📜 Scrolling through page to trigger lazy loading...`);
      await page.evaluate(`
        (function() {
          return new Promise((resolve) => {
            let scrollTop = 0;
            const scrollHeight = document.body.scrollHeight;
            const viewportHeight = window.innerHeight;
            
            const scrollStep = () => {
              window.scrollTo(0, scrollTop);
              scrollTop += viewportHeight / 2; // Scroll half viewport at a time
              
              if (scrollTop >= scrollHeight) {
                // Scroll back to top
                window.scrollTo(0, 0);
                setTimeout(resolve, 500); // Wait a bit after scrolling
              } else {
                setTimeout(scrollStep, 200); // Small delay between scrolls
              }
            };
            
            scrollStep();
          });
        })()
      `);

      // Now wait for images to load with enhanced logging
      const result = await page.evaluate(`
        (async function(imageTimeout) {
          const startTime = Date.now();
          const images = Array.from(document.querySelectorAll('img'));
          let loadedCount = 0;
          let errorCount = 0;
          let timeoutCount = 0;
          
          console.log('🔄 Starting to wait for ' + images.length + ' images...');
          
          const imagePromises = images.map((img, index) => {
            return new Promise((resolve) => {
              const imgIndex = index + 1;
              
              // If image is already loaded
              if (img.complete && img.naturalHeight !== 0) {
                console.log('✅ Image ' + imgIndex + ' already loaded: ' + img.src.substring(0, 60) + '...');
                loadedCount++;
                resolve({ status: 'already-loaded', index: imgIndex, src: img.src });
                return;
              }

              // Set up timeout for individual image
              const imgTimeout = setTimeout(() => {
                console.warn('⏰ Image ' + imgIndex + ' timeout after ' + imageTimeout + 'ms: ' + img.src);
                timeoutCount++;
                resolve({ status: 'timeout', index: imgIndex, src: img.src });
              }, imageTimeout);

              // Wait for load or error
              const cleanup = () => {
                clearTimeout(imgTimeout);
                img.removeEventListener('load', onLoad);
                img.removeEventListener('error', onError);
              };

              const onLoad = () => {
                console.log('✅ Image ' + imgIndex + ' loaded: ' + img.src.substring(0, 60) + '...');
                cleanup();
                loadedCount++;
                resolve({ status: 'loaded', index: imgIndex, src: img.src });
              };

              const onError = () => {
                console.warn('❌ Image ' + imgIndex + ' failed to load: ' + img.src);
                cleanup();
                errorCount++;
                resolve({ status: 'error', index: imgIndex, src: img.src });
              };

              img.addEventListener('load', onLoad);
              img.addEventListener('error', onError);
              
              console.log('⏳ Waiting for image ' + imgIndex + ': ' + img.src.substring(0, 60) + '...');
            });
          });

          // Wait for all images or timeout
          const results = await Promise.all(imagePromises);
          const endTime = Date.now();
          const duration = endTime - startTime;
          
          return {
            duration,
            totalImages: images.length,
            loadedCount,
            errorCount,
            timeoutCount,
            results
          };
        })(${timeout});
      `);

      console.log(`📈 Image loading completed in ${result.duration}ms:`);
      console.log(`   • Total images: ${result.totalImages}`);
      console.log(`   • Successfully loaded: ${result.loadedCount}`);
      console.log(`   • Failed to load: ${result.errorCount}`);
      console.log(`   • Timed out: ${result.timeoutCount}`);

      // Log final status
      const finalStatus = await page.evaluate(`
        (function() {
          const images = Array.from(document.querySelectorAll('img'));
          const unloadedImages = images.filter(img => !img.complete || img.naturalHeight === 0);
          
          return {
            totalImages: images.length,
            unloadedCount: unloadedImages.length,
            unloadedImages: unloadedImages.map((img, index) => ({
              src: img.src,
              complete: img.complete,
              naturalWidth: img.naturalWidth,
              naturalHeight: img.naturalHeight,
              visible: img.offsetWidth > 0 && img.offsetHeight > 0
            }))
          };
        })()
      `);

      if (finalStatus.unloadedCount > 0) {
        console.warn(`⚠️  ${finalStatus.unloadedCount} images still not fully loaded:`);
        finalStatus.unloadedImages.forEach((img: any, index: number) => {
          console.warn(`   ${index + 1}. ${img.src}`);
          console.warn(`      Complete: ${img.complete}, Dimensions: ${img.naturalWidth}x${img.naturalHeight}, Visible: ${img.visible}`);
        });
      } else {
        console.log(`✅ All images successfully loaded!`);
      }

    } catch (error) {
      console.error('❌ Error waiting for images:', error);
    }
  }

  private async takeScreenshot(
    url: string,
    options: ScreenshotOptions,
    mode: 'before' | 'after' | 'single',
  ): Promise<ScreenshotResult> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const maxRetries = options.maxRetries || 3;
    const retryDelay = options.retryDelay || 2000;
    let lastError: Error | null = null;

    try {
      // Set a more realistic user agent to avoid blocking
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });

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
          const adjustedTimeout = isStaging || isWordPress ? Math.max(options.timeout, 60000) : options.timeout;

          if (options.waitStrategy === 'images') {
            // For images strategy, use 'load' first, then wait for images
            await page.goto(url, {
              waitUntil: 'load',
              timeout: adjustedTimeout,
            });
          } else {
            await page.goto(url, {
              waitUntil: options.waitStrategy || 'load',
              timeout: adjustedTimeout,
            });
          }
          break; // Success, exit retry loop
        } catch (error) {
          lastError = error instanceof Error ? error : new Error('Unknown error');

          // Check if it's a network-related error that we should retry
          const isNetworkError =
            lastError.message.includes('net::ERR_NAME_NOT_RESOLVED') ||
            lastError.message.includes('net::ERR_CONNECTION_REFUSED') ||
            lastError.message.includes('net::ERR_TIMEOUT') ||
            lastError.message.includes('Timeout');

          if (isNetworkError && attempt < maxRetries) {
            console.log(
              `  ⚠️  Network error on attempt ${attempt}/${maxRetries}, retrying in ${retryDelay / 1000}s...`,
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay));
            continue;
          }

          // If not a network error or max retries reached, throw the error
          throw lastError;
        }
      }

      // If using images wait strategy, wait for all images to load
      if (options.waitStrategy === 'images') {
        const imageTimeout = options.imageWaitTimeout || 10000;
        await this.waitForImages(page, imageTimeout);
      }

      // Wait a bit more for dynamic content
      await page.waitForTimeout(2000);

      const filename = sanitizeFilename(url);
      const timestampString = new Date().toISOString().replace(/[:.]/g, '-');

      let screenshotPath: string;
      const screenshotsDir = join(options.output, 'screenshots');

      if (mode === 'single') {
        screenshotPath = join(screenshotsDir, `${filename}.png`);
      } else {
        screenshotPath = join(screenshotsDir, `${filename}_${mode}.png`);
      }

      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      const timestamp = new Date();
      const result: ScreenshotResult = {
        url,
        timestamp,
      };

      if (mode === 'single') {
        result.singlePath = screenshotPath;
      } else if (mode === 'before') {
        result.beforePath = screenshotPath;
        result.beforeTimestamp = timestamp;
      } else {
        result.afterPath = screenshotPath;
        result.afterTimestamp = timestamp;
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
