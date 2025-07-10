#!/usr/bin/env node

import { Command } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import { resolve, dirname, basename } from 'path';
import { Screenshotter } from './screenshotter';
import { HtmlGenerator } from './html-generator';
import { loadUrlsFromFile, formatDuration } from './utils';
import {
  ScreenshotOptions,
  ScreenshotResult,
  ReportData,
  ReportType,
  GenerateOptions,
  generateFilenames,
  DataFile,
} from './types';
import { DataPersistence } from './data-persistence';
import { PDFGenerator } from './pdf-generator';
import packageJson from '../package.json';

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
  .option('-b, --before-after', 'Enable before/after comparison mode')
  .option('-w, --width <width>', 'Viewport width', '1920')
  .option('-h, --height <height>', 'Viewport height', '1080')
  .option('-t, --timeout <timeout>', 'Page load timeout in milliseconds', '30000')
  .option('-r, --max-retries <retries>', 'Maximum retry attempts for network errors', '3')
  .option('--retry-delay <delay>', 'Delay between retries in milliseconds', '2000')
  .option('--wait-strategy <strategy>', 'Page load wait strategy: networkidle, load, domcontentloaded', 'load')
  .option('--report-type <type>', 'Report type: html, pdf, all', 'html')
  .option('--title <title>', 'Report title (used for filenames)', 'Report')
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
      const filenames = generateFilenames(options.title, screenshotOptions.output);

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
        } else {
          console.log(chalk.yellow('📷 Taking screenshots...'));
          singleResults = await screenshotter.takeScreenshots(urls, screenshotOptions, 'single');
        }

        // Merge results for before/after mode
        const allResults = options.beforeAfter ? mergeBeforeAfterResults(beforeResults, afterResults) : singleResults;

        // Generate ReportData for data persistence
        const reportData: ReportData = {
          results: allResults,
          mode: options.beforeAfter ? 'before-after' : 'single',
          generatedAt: new Date(),
          totalUrls: urls.length,
          successCount: allResults.filter((r) => !r.error).length,
          errorCount: allResults.filter((r) => r.error).length,
        };

        // Calculate phase timing for before/after mode
        let beforePhase, afterPhase;
        if (options.beforeAfter && beforeResults.length > 0 && afterResults.length > 0) {
          const beforeStart = Math.min(...beforeResults.map((r) => r.timestamp.getTime()));
          const beforeEnd = Math.max(...beforeResults.map((r) => r.timestamp.getTime()));
          const afterStart = Math.min(...afterResults.map((r) => r.timestamp.getTime()));
          const afterEnd = Math.max(...afterResults.map((r) => r.timestamp.getTime()));

          beforePhase = {
            startTime: new Date(beforeStart),
            endTime: new Date(beforeEnd),
            duration: formatDuration(beforeEnd - beforeStart),
          };

          afterPhase = {
            startTime: new Date(afterStart),
            endTime: new Date(afterEnd),
            duration: formatDuration(afterEnd - afterStart),
          };
        }

        console.log(chalk.yellow('💾 Saving data file...'));

        // Save data file first
        await DataPersistence.saveDataFile(
          reportData,
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
        );

        console.log(chalk.green(`✅ Data file saved: ${filenames.dataFile}`));

        // Generate reports based on report type
        const reportsGenerated: string[] = [];

        if (screenshotOptions.reportType === ReportType.HTML || screenshotOptions.reportType === ReportType.ALL) {
          console.log(chalk.yellow('📄 Generating HTML report...'));
          const htmlGenerator = new HtmlGenerator();
          await htmlGenerator.generateReport(reportData, filenames.htmlFile);
          reportsGenerated.push(filenames.htmlFile);
          console.log(chalk.green(`✅ HTML report generated: ${filenames.htmlFile}`));
        }

        if (screenshotOptions.reportType === ReportType.PDF || screenshotOptions.reportType === ReportType.ALL) {
          console.log(chalk.yellow('📄 Generating PDF report...'));
          const dataFile = await DataPersistence.loadDataFile(filenames.dataFile);
          const resolvedDataFile = DataPersistence.resolveImagePaths(dataFile, filenames.dataFile);
          const pdfGenerator = new PDFGenerator();
          await pdfGenerator.generateReport(resolvedDataFile, filenames.pdfFile);
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
  .argument('<data-file>', 'Path to the data file (.jsonc)')
  .option('--report-type <type>', 'Report type: html, pdf, all', 'html')
  .action(async (dataFilePath: string, options: { reportType: string }) => {
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
      console.error(chalk.red('❌ Error generating report:'), error instanceof Error ? error.message : 'Unknown error');
      process.exit(1);
    }
  });

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

async function generateReportsFromDataFile(generateOptions: GenerateOptions): Promise<void> {
  const { dataFilePath, reportType } = generateOptions;

  console.log(chalk.gray(`Loading data file: ${dataFilePath}`));

  // Load and validate data file
  const dataFile = await DataPersistence.loadDataFile(dataFilePath);
  const resolvedDataFile = DataPersistence.resolveImagePaths(dataFile, dataFilePath);

  console.log(chalk.green(`✅ Data file loaded: ${dataFile.metadata.totalUrls} URLs`));

  const outputDir = dirname(dataFilePath);
  const reportTitle = basename(dataFilePath, '-data.jsonc');
  const filenames = generateFilenames(reportTitle, outputDir);

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
