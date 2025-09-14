#!/usr/bin/env node

import chalk from 'chalk';
import { Command } from 'commander';
import fs from 'fs';
import inquirer from 'inquirer';
import { basename, dirname, resolve } from 'path';
import packageJson from '../package.json';
import { DataPersistence } from './data-persistence';
import { HtmlGenerator } from './html-generator';
import { ImageComparator } from './image-comparator';
import { PDFGenerator } from './pdf-generator';
import { Screenshotter } from './screenshotter';
import {
  ComparisonOptions,
  DataFile,
  GenerateOptions,
  ReportData,
  ReportType,
  ScreenshotOptions,
  ScreenshotResult,
  generateFilenames,
} from './types';
import { formatDuration, loadUrlsFromFile } from './utils';

const program = new Command();

program
  .name('screenshot-cli')
  .description('CLI tool for taking website screenshots with before/after comparison')
  .version(packageJson.version);

// Capture subcommand (main screenshot functionality)
program
  .command('capture')
  .description('Take website screenshots with optional before/after comparison')
  .option('-u, --urls <urls>', 'Comma-separated list of URLs')
  .option(
    '-f, --file <file>',
    'Path to file containing URLs (JS file exporting array or text file with one URL per line)',
  )
  .option('-o, --output <directory>', 'Output directory for screenshots', 'output')
  .option('-b, --before-after', 'Enable before/after comparison mode (captures both before and after in sequence)')
  .option('--before', 'Capture only before screenshots')
  .option('--after', 'Capture only after screenshots')
  .option('-w, --width <width>', 'Viewport width', '1920')
  .option('-h, --height <height>', 'Viewport height', '1080')
  .option('-t, --timeout <timeout>', 'Page load timeout in milliseconds', '30000')
  .option('-r, --max-retries <retries>', 'Maximum retry attempts for network errors', '3')
  .option('--retry-delay <delay>', 'Delay between retries in milliseconds', '2000')
  .option('--wait-strategy <strategy>', 'Page load wait strategy: networkidle, load, domcontentloaded', 'load')
  .option('--report-type <type>', 'Report type: html, pdf, all', 'html')
  .option('--title <title>', 'Report title (used for filenames)', 'Report')
  .option('--comparison-threshold <threshold>', 'Pixelmatch threshold for comparison (0-1)', '0.1')
  .option('--min-change-threshold <threshold>', 'Minimum change percentage to highlight (0-100)', '0.5')
  .option('--skip-diff-images', 'Skip generating diff images for unchanged pages')
  .option('--comparison-only', 'Only show pages with changes in reports')
  .option('--json-only', 'Save data file as plain JSON instead of JSONC (JSON with comments)')
  .action(async (options) => {
    try {
      const startTime = Date.now();
      console.log(chalk.blue('🚀 Starting screenshot capture...'));

      // Get URLs from command line or file
      let urls: string[] = [];

      if (options.file) {
        console.log(chalk.gray(`Loading URLs from file: ${options.file}`));
        urls = await loadUrlsFromFile(resolve(options.file));
      } else if (options.urls) {
        urls = options.urls.split(',').map((url: string) => url.trim());
      } else {
        console.error(chalk.red('❌ Please provide URLs via --urls or --file option'));
        process.exit(1);
      }

      if (urls.length === 0) {
        console.error(chalk.red('❌ No URLs found'));
        process.exit(1);
      }

      console.log(chalk.green(`📋 Found ${urls.length} URLs to process`));

      // Validate mutually exclusive flags
      const modeFlags = [options.beforeAfter, options.before, options.after].filter(Boolean);
      if (modeFlags.length > 1) {
        console.error(chalk.red('❌ Only one of --before-after, --before, or --after can be specified'));
        process.exit(1);
      }

      // Validate report type
      if (!Object.values(ReportType).includes(options.reportType as ReportType)) {
        console.error(chalk.red(`❌ Invalid report type: ${options.reportType}`));
        console.error(chalk.gray('Valid types: html, pdf, all'));
        process.exit(1);
      }

      const screenshotOptions: ScreenshotOptions = {
        urls,
        output: resolve(options.output),
        beforeAfter: options.beforeAfter,
        before: options.before,
        after: options.after,
        width: parseInt(options.width),
        height: parseInt(options.height),
        timeout: parseInt(options.timeout),
        maxRetries: parseInt(options.maxRetries),
        retryDelay: parseInt(options.retryDelay),
        waitStrategy: options.waitStrategy as 'networkidle' | 'load' | 'domcontentloaded',
        reportType: options.reportType as ReportType,
        title: options.title,
      };

      // Generate filenames based on title
      const filenames = generateFilenames(options.title, screenshotOptions.output, options.jsonOnly);

      const screenshotter = new Screenshotter();
      const htmlGenerator = new HtmlGenerator();

      let beforeResults: ScreenshotResult[] = [];
      let afterResults: ScreenshotResult[] = [];
      let singleResults: ScreenshotResult[] = [];

      try {
        await screenshotter.initialize();

        if (options.beforeAfter) {
          console.log(chalk.yellow('📷 Taking BEFORE screenshots...'));
          beforeResults = await screenshotter.takeScreenshots(urls, screenshotOptions, 'before');

          console.log(chalk.yellow('⏸️  Before screenshots complete!'));

          const { proceed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: 'Ready to take AFTER screenshots?',
              default: true,
            },
          ]);

          if (proceed) {
            console.log(chalk.yellow('📷 Taking AFTER screenshots...'));
            afterResults = await screenshotter.takeScreenshots(urls, screenshotOptions, 'after');
          } else {
            console.log(chalk.gray('❌ Cancelled by user'));
            process.exit(0);
          }
        } else if (options.before) {
          console.log(chalk.yellow('📷 Taking BEFORE screenshots...'));
          beforeResults = await screenshotter.takeScreenshots(urls, screenshotOptions, 'before');
          console.log(chalk.green('✅ Before screenshots complete!'));
        } else if (options.after) {
          console.log(chalk.yellow('📷 Taking AFTER screenshots...'));
          afterResults = await screenshotter.takeScreenshots(urls, screenshotOptions, 'after');
          console.log(chalk.green('✅ After screenshots complete!'));
        } else {
          console.log(chalk.yellow('📷 Taking screenshots...'));
          singleResults = await screenshotter.takeScreenshots(urls, screenshotOptions, 'single');
        }

        // Merge results and perform comparison for before/after mode
        let allResults: ScreenshotResult[] = [];

        if (options.beforeAfter) {
          allResults = await mergeBeforeAfterResultsWithComparison(beforeResults, afterResults, {
            threshold: parseFloat(options.comparisonThreshold),
            minChangeThreshold: parseFloat(options.minChangeThreshold),
            generateDiffImage: !options.skipDiffImages,
            ignoreAntialiasing: false,
          });
        } else if (options.before) {
          allResults = beforeResults;
        } else if (options.after) {
          allResults = afterResults;
        } else {
          allResults = singleResults;
        }

        // Generate ReportData for data persistence
        const mode = options.beforeAfter ? 'before-after' :
          (options.before || options.after) ? 'before-after' : 'single';

        const reportData: ReportData = {
          results: allResults,
          mode,
          generatedAt: new Date(),
          totalUrls: urls.length,
          successCount: allResults.filter((r: ScreenshotResult) => !r.error).length,
          errorCount: allResults.filter((r: ScreenshotResult) => r.error).length,
        };

        // Calculate phase timing for before/after mode
        let beforePhase, afterPhase;

        if (beforeResults.length > 0) {
          const beforeStart = Math.min(...beforeResults.map((r) => r.timestamp.getTime()));
          const beforeEnd = Math.max(...beforeResults.map((r) => r.timestamp.getTime()));

          beforePhase = {
            startTime: new Date(beforeStart),
            endTime: new Date(beforeEnd),
            duration: formatDuration(beforeEnd - beforeStart),
          };
        }

        if (afterResults.length > 0) {
          const afterStart = Math.min(...afterResults.map((r) => r.timestamp.getTime()));
          const afterEnd = Math.max(...afterResults.map((r) => r.timestamp.getTime()));

          afterPhase = {
            startTime: new Date(afterStart),
            endTime: new Date(afterEnd),
            duration: formatDuration(afterEnd - afterStart),
          };
        }

        console.log(chalk.yellow('💾 Saving data file...'));

        // For independent before/after modes, merge with existing data if it exists
        let finalReportData = reportData;

        if ((options.before || options.after || (!options.beforeAfter && !options.before && !options.after)) && fs.existsSync(filenames.dataFile)) {
          try {
            console.log(chalk.gray('📄 Loading existing data file to merge...'));
            const existingDataFile = await DataPersistence.loadDataFile(filenames.dataFile);
            const resolvedExistingData = DataPersistence.resolveImagePaths(existingDataFile, filenames.dataFile);

            // Merge the results
            const mergedResults: ScreenshotResult[] = [];

            // Process new results and merge with existing ones
            for (const newResult of reportData.results) {
              const existingResult = resolvedExistingData.results.find(r => r.url === newResult.url);

              if (existingResult) {
                // Merge existing and new data
                const merged: ScreenshotResult = {
                  url: newResult.url,
                  timestamp: newResult.timestamp,
                  // Handle different modes
                  singlePath: (!options.before && !options.after && !options.beforeAfter) ? newResult.singlePath : existingResult.singlePath,
                  beforePath: options.before ? newResult.beforePath : existingResult.beforePath,
                  afterPath: options.after ? newResult.afterPath : existingResult.afterPath,
                  error: newResult.error || existingResult.error || existingResult.beforeError || existingResult.afterError,
                  comparison: existingResult.comparison,
                  // Preserve original timestamps
                  beforeTimestamp: options.before ? newResult.timestamp :
                    (existingResult.beforeTimestamp ? new Date(existingResult.beforeTimestamp) : undefined),
                  afterTimestamp: options.after ? newResult.timestamp :
                    (existingResult.afterTimestamp ? new Date(existingResult.afterTimestamp) : undefined),
                };
                mergedResults.push(merged);
              } else {
                mergedResults.push(newResult);
              }
            }

            // Add existing results that weren't updated (preserve URLs not in current capture)
            for (const existingResult of resolvedExistingData.results) {
              const isUpdated = reportData.results.some(r => r.url === existingResult.url);
              if (!isUpdated) {
                // Convert existing result back to ScreenshotResult format
                const preserved: ScreenshotResult = {
                  url: existingResult.url,
                  timestamp: existingResult.timestamp ? new Date(existingResult.timestamp) :
                    existingResult.beforeTimestamp ? new Date(existingResult.beforeTimestamp) :
                      existingResult.afterTimestamp ? new Date(existingResult.afterTimestamp) : new Date(),
                  singlePath: existingResult.singlePath,
                  beforePath: existingResult.beforePath,
                  afterPath: existingResult.afterPath,
                  error: existingResult.error || existingResult.beforeError || existingResult.afterError,
                  comparison: existingResult.comparison,
                  beforeTimestamp: existingResult.beforeTimestamp ? new Date(existingResult.beforeTimestamp) : undefined,
                  afterTimestamp: existingResult.afterTimestamp ? new Date(existingResult.afterTimestamp) : undefined,
                };
                mergedResults.push(preserved);
              }
            }

            // Update report data with merged results
            finalReportData = {
              ...reportData,
              results: mergedResults,
            };

            // Preserve existing phase timing
            if (!beforePhase && existingDataFile.metadata.beforePhase) {
              beforePhase = {
                startTime: new Date(existingDataFile.metadata.beforePhase.startTime),
                endTime: new Date(existingDataFile.metadata.beforePhase.endTime),
                duration: existingDataFile.metadata.beforePhase.duration,
              };
            }

            if (!afterPhase && existingDataFile.metadata.afterPhase) {
              afterPhase = {
                startTime: new Date(existingDataFile.metadata.afterPhase.startTime),
                endTime: new Date(existingDataFile.metadata.afterPhase.endTime),
                duration: existingDataFile.metadata.afterPhase.duration,
              };
            }

            console.log(chalk.green('✅ Merged with existing data'));
          } catch (error) {
            console.warn(chalk.yellow(`⚠️  Could not merge with existing data file: ${error instanceof Error ? error.message : 'Unknown error'}`));
            console.warn(chalk.yellow('Creating new data file instead'));
          }
        }

        // Save data file
        await DataPersistence.saveDataFile(
          finalReportData,
          filenames.dataFile,
          {
            waitStrategy: screenshotOptions.waitStrategy || 'load',
            width: screenshotOptions.width,
            height: screenshotOptions.height,
            timeout: screenshotOptions.timeout,
            maxRetries: screenshotOptions.maxRetries ?? 3,
            retryDelay: screenshotOptions.retryDelay ?? 2000,
          },
          beforePhase,
          afterPhase,
          options.jsonOnly,
        );

        console.log(chalk.green(`✅ Data file saved: ${filenames.dataFile}`));

        // Generate reports based on report type
        const reportsGenerated: string[] = [];

        // Build comparison options
        const comparisonOptions = {
          threshold: parseFloat(options.comparisonThreshold),
          minChangeThreshold: parseFloat(options.minChangeThreshold),
          generateDiffImage: !options.skipDiffImages,
          ignoreAntialiasing: false,
          comparisonOnly: options.comparisonOnly,
        };

        if (screenshotOptions.reportType === ReportType.HTML || screenshotOptions.reportType === ReportType.ALL) {
          console.log(chalk.yellow('📄 Generating HTML report...'));
          const htmlGenerator = new HtmlGenerator();
          await htmlGenerator.generateReport(reportData, filenames.htmlFile, comparisonOptions);
          reportsGenerated.push(filenames.htmlFile);
          console.log(chalk.green(`✅ HTML report generated: ${filenames.htmlFile}`));
        }

        if (screenshotOptions.reportType === ReportType.PDF || screenshotOptions.reportType === ReportType.ALL) {
          console.log(chalk.yellow('📄 Generating PDF report...'));
          const dataFile = await DataPersistence.loadDataFile(filenames.dataFile);
          const resolvedDataFile = DataPersistence.resolveImagePaths(dataFile, filenames.dataFile);
          const pdfGenerator = new PDFGenerator();
          await pdfGenerator.generateReport(resolvedDataFile, filenames.pdfFile, comparisonOptions);
          reportsGenerated.push(filenames.pdfFile);
          console.log(chalk.green(`✅ PDF report generated: ${filenames.pdfFile}`));
        }

        const duration = formatDuration(Date.now() - startTime);
        console.log(chalk.green(`✅ Complete! Screenshot capture and report generation finished in ${duration}`));
        console.log(chalk.blue(`📄 Data file: ${filenames.dataFile}`));
        reportsGenerated.forEach((reportPath) => {
          console.log(chalk.blue(`📄 Report: ${reportPath}`));
        });
        console.log(chalk.gray(`📁 Screenshots: ${screenshotOptions.output}/screenshots`));
      } finally {
        await screenshotter.close();
      }
    } catch (error) {
      console.error(chalk.red('❌ Error:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

// Generate subcommand
program
  .command('generate')
  .description('Generate reports from existing data file')
  .argument('<data-file>', 'Path to the data file (.jsonc or .json)')
  .option('--report-type <type>', 'Report type: html, pdf, all', 'html')
  .action(
    async (
      dataFilePath: string,
      options: {
        reportType: string;
      },
    ) => {
      try {
        console.log(chalk.blue('🚀 Generating report from data file...'));

        // Validate report type
        if (!Object.values(ReportType).includes(options.reportType as ReportType)) {
          console.error(chalk.red(`❌ Invalid report type: ${options.reportType}`));
          console.error(chalk.gray('Valid types: html, pdf, all'));
          process.exit(1);
        }

        const generateOptions: GenerateOptions = {
          dataFilePath: resolve(dataFilePath),
          reportType: options.reportType as ReportType,
        };

        await generateReportsFromDataFile(generateOptions);
      } catch (error) {
        console.error(
          chalk.red('❌ Error generating report:'),
          error instanceof Error ? error.message : 'Unknown error',
        );
        process.exit(1);
      }
    },
  );

// Compare subcommand
program
  .command('compare')
  .description('Add or update image comparison data in existing before/after data file')
  .argument('<data-file>', 'Path to the before/after data file (.jsonc or .json)')
  .option('--comparison-threshold <threshold>', 'Pixelmatch threshold for comparison (0-1)', '0.1')
  .option('--min-change-threshold <threshold>', 'Minimum change percentage to highlight (0-100)', '0.5')
  .option('--skip-diff-images', 'Skip generating diff images for unchanged pages')
  .option('--ignore-antialiasing', 'Ignore anti-aliased pixels in comparison')
  .action(
    async (
      dataFilePath: string,
      options: {
        comparisonThreshold: string;
        minChangeThreshold: string;
        skipDiffImages: boolean;
        ignoreAntialiasing: boolean;
      },
    ) => {
      try {
        console.log(chalk.blue('🔍 Adding comparison data to existing data file...'));

        // Load and validate data file
        const dataFile = await DataPersistence.loadDataFile(resolve(dataFilePath));

        if (dataFile.metadata.mode !== 'before-after') {
          console.error(chalk.red('❌ Comparison can only be performed on before/after data files'));
          process.exit(1);
        }

        // Resolve image paths for comparison
        const resolvedDataFile = DataPersistence.resolveImagePaths(dataFile, resolve(dataFilePath));

        // Build comparison options
        const comparisonOptions: ComparisonOptions = {
          threshold: parseFloat(options.comparisonThreshold),
          minChangeThreshold: parseFloat(options.minChangeThreshold),
          generateDiffImage: !options.skipDiffImages,
          ignoreAntialiasing: options.ignoreAntialiasing,
        };

        console.log(chalk.gray(`📄 Loaded data file: ${resolvedDataFile.results.length} results`));
        console.log(chalk.yellow('🔍 Performing image comparison...'));

        // Perform comparison on results
        const imageComparator = new ImageComparator();
        let updatedCount = 0;

        for (const result of resolvedDataFile.results) {
          if (result.beforePath && result.afterPath && result.beforeSuccess && result.afterSuccess) {
            try {
              const comparison = await imageComparator.compareImages(
                result.beforePath,
                result.afterPath,
                comparisonOptions,
              );

              // Update the result with comparison data
              result.comparison = comparison;
              updatedCount++;

              console.log(chalk.gray(`  ${result.url}: ${comparison.changeLevel} (${comparison.diffPercentage}%)`));
            } catch (error) {
              console.warn(
                chalk.yellow(
                  `⚠️  Failed to compare images for ${result.url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
                ),
              );
            }
          }
        }

        // Show comparison summary
        const changedCount = resolvedDataFile.results.filter((r) => r.comparison?.hasSignificantChange).length;
        const unchangedCount = resolvedDataFile.results.filter(
          (r) => r.comparison && !r.comparison.hasSignificantChange,
        ).length;

        console.log(chalk.green(`✅ Image comparison complete: ${changedCount} changed, ${unchangedCount} unchanged`));

        // Save updated data file
        console.log(chalk.yellow('💾 Updating data file...'));

        // Convert back to ReportData format for saving
        const reportData: ReportData = {
          results: resolvedDataFile.results.map((result) => ({
            url: result.url,
            timestamp: result.timestamp
              ? new Date(result.timestamp)
              : result.beforeTimestamp
                ? new Date(result.beforeTimestamp)
                : new Date(),
            beforePath: result.beforePath,
            afterPath: result.afterPath,
            error: result.error || result.beforeError || result.afterError,
            comparison: result.comparison,
          })),
          mode: resolvedDataFile.metadata.mode,
          generatedAt: new Date(resolvedDataFile.metadata.generatedAt),
          totalUrls: resolvedDataFile.metadata.totalUrls,
          successCount: resolvedDataFile.metadata.successCount,
          errorCount: resolvedDataFile.metadata.errorCount,
        };

        // Preserve original timing data
        const beforePhase = resolvedDataFile.metadata.beforePhase
          ? {
            startTime: new Date(resolvedDataFile.metadata.beforePhase.startTime),
            endTime: new Date(resolvedDataFile.metadata.beforePhase.endTime),
            duration: resolvedDataFile.metadata.beforePhase.duration,
          }
          : undefined;

        const afterPhase = resolvedDataFile.metadata.afterPhase
          ? {
            startTime: new Date(resolvedDataFile.metadata.afterPhase.startTime),
            endTime: new Date(resolvedDataFile.metadata.afterPhase.endTime),
            duration: resolvedDataFile.metadata.afterPhase.duration,
          }
          : undefined;

        await DataPersistence.saveDataFile(
          reportData,
          resolve(dataFilePath),
          resolvedDataFile.metadata.options,
          beforePhase,
          afterPhase,
          dataFilePath.endsWith('.json'),
        );

        console.log(chalk.green(`✅ Data file updated with comparison data for ${updatedCount} results`));
        console.log(chalk.blue(`📄 Updated data file: ${resolve(dataFilePath)}`));
      } catch (error) {
        console.error(
          chalk.red('❌ Error performing comparison:'),
          error instanceof Error ? error.message : 'Unknown error',
        );
        process.exit(1);
      }
    },
  );

function mergeBeforeAfterResults(
  beforeResults: ScreenshotResult[],
  afterResults: ScreenshotResult[],
): ScreenshotResult[] {
  const merged: ScreenshotResult[] = [];

  for (const beforeResult of beforeResults) {
    const afterResult = afterResults.find((r) => r.url === beforeResult.url);

    merged.push({
      url: beforeResult.url,
      beforePath: beforeResult.beforePath,
      afterPath: afterResult?.afterPath,
      error: beforeResult.error || afterResult?.error,
      timestamp: beforeResult.timestamp,
    });
  }

  return merged;
}

async function mergeBeforeAfterResultsWithComparison(
  beforeResults: ScreenshotResult[],
  afterResults: ScreenshotResult[],
  comparisonOptions: ComparisonOptions,
): Promise<ScreenshotResult[]> {
  const merged: ScreenshotResult[] = [];
  const imageComparator = new ImageComparator();

  console.log(chalk.yellow('🔍 Performing image comparison...'));

  for (const beforeResult of beforeResults) {
    const afterResult = afterResults.find((r) => r.url === beforeResult.url);

    const result: ScreenshotResult = {
      url: beforeResult.url,
      beforePath: beforeResult.beforePath,
      afterPath: afterResult?.afterPath,
      error: beforeResult.error || afterResult?.error,
      timestamp: beforeResult.timestamp,
    };

    // Perform image comparison if both images exist and there are no errors
    if (result.beforePath && result.afterPath && !result.error) {
      try {
        const comparison = await imageComparator.compareImages(result.beforePath, result.afterPath, comparisonOptions);
        result.comparison = comparison;

        console.log(chalk.gray(`  ${result.url}: ${comparison.changeLevel} (${comparison.diffPercentage}%)`));
      } catch (error) {
        console.warn(
          chalk.yellow(
            `⚠️  Failed to compare images for ${result.url}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
        );
      }
    }

    merged.push(result);
  }

  // Show comparison summary
  const changedCount = merged.filter((r) => r.comparison?.hasSignificantChange).length;
  const unchangedCount = merged.filter((r) => r.comparison && !r.comparison.hasSignificantChange).length;

  console.log(chalk.green(`✅ Image comparison complete: ${changedCount} changed, ${unchangedCount} unchanged`));

  return merged;
}

async function generateReportsFromDataFile(generateOptions: GenerateOptions): Promise<void> {
  const { dataFilePath, reportType } = generateOptions;

  console.log(chalk.gray(`Loading data file: ${dataFilePath}`));

  // Load and validate data file
  const dataFile = await DataPersistence.loadDataFile(dataFilePath);
  const resolvedDataFile = DataPersistence.resolveImagePaths(dataFile, dataFilePath);

  console.log(chalk.green(`✅ Data file loaded: ${dataFile.metadata.totalUrls} URLs`));

  const outputDir = dirname(dataFilePath);
  const isJsonFile = dataFilePath.endsWith('.json');
  const reportTitle = basename(dataFilePath, isJsonFile ? '-data.json' : '-data.jsonc');
  const filenames = generateFilenames(reportTitle, outputDir, isJsonFile);

  // Generate reports based on type
  if (reportType === ReportType.HTML || reportType === ReportType.ALL) {
    console.log(chalk.yellow('📄 Generating HTML report...'));
    await generateHTMLFromDataFile(resolvedDataFile, filenames.htmlFile);
    console.log(chalk.green(`✅ HTML report generated: ${filenames.htmlFile}`));
  }

  if (reportType === ReportType.PDF || reportType === ReportType.ALL) {
    console.log(chalk.yellow('📄 Generating PDF report...'));
    await generatePDFFromDataFile(resolvedDataFile, filenames.pdfFile);
    console.log(chalk.green(`✅ PDF report generated: ${filenames.pdfFile}`));
  }

  console.log(chalk.green('✅ Report generation complete!'));
}

async function generateHTMLFromDataFile(dataFile: DataFile, outputPath: string): Promise<void> {
  const htmlGenerator = new HtmlGenerator();

  // Convert DataFile to ReportData format
  const reportData: ReportData = {
    results: dataFile.results.map((result) => ({
      url: result.url,
      timestamp: result.timestamp
        ? new Date(result.timestamp)
        : result.beforeTimestamp
          ? new Date(result.beforeTimestamp)
          : new Date(),
      singlePath: result.singlePath,
      beforePath: result.beforePath,
      afterPath: result.afterPath,
      error: result.error || result.beforeError || result.afterError,
      comparison: result.comparison,
    })),
    mode: dataFile.metadata.mode,
    generatedAt: new Date(dataFile.metadata.generatedAt),
    totalUrls: dataFile.metadata.totalUrls,
    successCount: dataFile.metadata.successCount,
    errorCount: dataFile.metadata.errorCount,
  };

  // Generate HTML report using existing generator
  await htmlGenerator.generateReport(reportData, outputPath);
}

async function generatePDFFromDataFile(dataFile: DataFile, outputPath: string): Promise<void> {
  const pdfGenerator = new PDFGenerator();
  await pdfGenerator.generateReport(dataFile, outputPath);
}

program.parse();
