import fs from 'fs';
import path from 'path';
import { DataFile, ReportData } from './types';

export class DataPersistence {
  static async saveDataFile(
    reportData: ReportData,
    dataFilePath: string,
    options: {
      waitStrategy: string;
      width: number;
      height: number;
      timeout: number;
      maxRetries: number;
      retryDelay: number;
    },
    beforePhase?: { startTime: Date; endTime: Date; duration: string },
    afterPhase?: { startTime: Date; endTime: Date; duration: string },
  ): Promise<void> {
    const dataFile: DataFile = {
      metadata: {
        version: '1.0.0',
        mode: reportData.mode,
        generatedAt: reportData.generatedAt.toISOString(),
        totalUrls: reportData.totalUrls,
        successCount: reportData.successCount,
        errorCount: reportData.errorCount,
        options: {
          waitStrategy: options.waitStrategy,
          width: options.width,
          height: options.height,
          timeout: options.timeout,
          maxRetries: options.maxRetries,
          retryDelay: options.retryDelay,
        },
        beforePhase: beforePhase
          ? {
              startTime: beforePhase.startTime.toISOString(),
              endTime: beforePhase.endTime.toISOString(),
              duration: beforePhase.duration,
            }
          : undefined,
        afterPhase: afterPhase
          ? {
              startTime: afterPhase.startTime.toISOString(),
              endTime: afterPhase.endTime.toISOString(),
              duration: afterPhase.duration,
            }
          : undefined,
      },
      results: reportData.results.map((result) => ({
        url: result.url,
        timestamp: result.singlePath ? result.timestamp.toISOString() : undefined,
        beforeTimestamp: result.beforePath ? result.timestamp.toISOString() : undefined,
        afterTimestamp: result.afterPath ? result.timestamp.toISOString() : undefined,
        singlePath: result.singlePath ? path.relative(path.dirname(dataFilePath), result.singlePath) : undefined,
        beforePath: result.beforePath ? path.relative(path.dirname(dataFilePath), result.beforePath) : undefined,
        afterPath: result.afterPath ? path.relative(path.dirname(dataFilePath), result.afterPath) : undefined,
        error: result.error,
        success: !result.error,
        beforeSuccess: result.beforePath ? !result.error : undefined,
        afterSuccess: result.afterPath ? !result.error : undefined,
        comparison: result.comparison
          ? {
              ...result.comparison,
              diffImagePath: result.comparison.diffImagePath
                ? path.relative(path.dirname(dataFilePath), result.comparison.diffImagePath)
                : undefined,
            }
          : undefined,
      })),
    };

    const jsonContent = this.generateJSONCContent(dataFile);

    // Ensure directory exists
    const dir = path.dirname(dataFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(dataFilePath, jsonContent, 'utf8');
  }

  static async loadDataFile(dataFilePath: string): Promise<DataFile> {
    if (!fs.existsSync(dataFilePath)) {
      throw new Error(`Data file not found: ${dataFilePath}`);
    }

    const content = await fs.promises.readFile(dataFilePath, 'utf8');

    // Parse JSONC by removing comments and parsing as JSON
    const jsonContent = this.stripJSONComments(content);

    try {
      const dataFile: DataFile = JSON.parse(jsonContent);
      this.validateDataFile(dataFile);
      return dataFile;
    } catch (error) {
      throw new Error(`Invalid data file format: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static resolveImagePaths(dataFile: DataFile, dataFilePath: string): DataFile {
    const baseDir = path.dirname(dataFilePath);

    return {
      ...dataFile,
      results: dataFile.results.map((result) => ({
        ...result,
        singlePath: result.singlePath ? path.resolve(baseDir, result.singlePath) : undefined,
        beforePath: result.beforePath ? path.resolve(baseDir, result.beforePath) : undefined,
        afterPath: result.afterPath ? path.resolve(baseDir, result.afterPath) : undefined,
        comparison: result.comparison
          ? {
              ...result.comparison,
              diffImagePath: result.comparison.diffImagePath
                ? path.resolve(baseDir, result.comparison.diffImagePath)
                : undefined,
            }
          : undefined,
      })),
    };
  }

  private static generateJSONCContent(dataFile: DataFile): string {
    const mode = dataFile.metadata.mode === 'single' ? 'single' : 'before-after';
    const modeTitle = mode === 'single' ? 'Single Screenshot Mode' : 'Before/After Mode';

    let content = `{
  // Screenshot CLI Report Data - ${modeTitle}
  // Generated: ${dataFile.metadata.generatedAt}
  // This file contains all data needed to regenerate reports without retaking screenshots
  
  "metadata": {
    // Basic report information
    "version": "${dataFile.metadata.version}",           // Screenshot CLI version used
    "mode": "${dataFile.metadata.mode}",${
      mode === 'single'
        ? '             // Screenshot mode: "single" or "before-after"'
        : '       // Screenshot mode: "single" or "before-after"'
    }
    "generatedAt": "${dataFile.metadata.generatedAt}",
    "totalUrls": ${dataFile.metadata.totalUrls},
    "successCount": ${dataFile.metadata.successCount},
    "errorCount": ${dataFile.metadata.errorCount},
    
    // Original command options used
    "options": {
      "waitStrategy": "${dataFile.metadata.options.waitStrategy}",     // Page load strategy used
      "width": ${dataFile.metadata.options.width},              // Viewport width
      "height": ${dataFile.metadata.options.height},             // Viewport height
      "timeout": ${dataFile.metadata.options.timeout},           // Page timeout in ms
      "maxRetries": ${dataFile.metadata.options.maxRetries},            // Retry attempts for failures
      "retryDelay": ${dataFile.metadata.options.retryDelay}          // Delay between retries in ms
    }`;

    if (dataFile.metadata.beforePhase && dataFile.metadata.afterPhase) {
      content += `,
    
    // Before/after phase timing
    "beforePhase": {
      "startTime": "${dataFile.metadata.beforePhase.startTime}",
      "endTime": "${dataFile.metadata.beforePhase.endTime}",
      "duration": "${dataFile.metadata.beforePhase.duration}"      // Human-readable duration
    },
    "afterPhase": {
      "startTime": "${dataFile.metadata.afterPhase.startTime}",
      "endTime": "${dataFile.metadata.afterPhase.endTime}",
      "duration": "${dataFile.metadata.afterPhase.duration}"
    }`;
    }

    content += `
  },
  
  // Screenshot results - one entry per URL
  "results": [`;

    dataFile.results.forEach((result, index) => {
      const isLast = index === dataFile.results.length - 1;

      if (mode === 'single') {
        content += `
    {
      "url": "${result.url}",
      "timestamp": "${result.timestamp}",
      "singlePath": "${result.singlePath}",    // Relative path to screenshot
      "success": ${result.success}${
        result.error
          ? `,
      "error": "${result.error}"  // Error message if failed`
          : ''
      }
    }${isLast ? '' : ','}`;
      } else {
        content += `
    {
      "url": "${result.url}",
      "beforeTimestamp": "${result.beforeTimestamp}",
      "afterTimestamp": "${result.afterTimestamp}",
      "beforePath": "${result.beforePath}",    // Relative path to before screenshot
      "afterPath": "${result.afterPath}",      // Relative path to after screenshot
      "beforeSuccess": ${result.beforeSuccess},
      "afterSuccess": ${result.afterSuccess},
      "success": ${result.success}${result.beforeError || result.afterError || result.comparison ? ',' : ''}             // Overall success (both phases succeeded)${
        result.beforeError || result.afterError
          ? `
      ${result.beforeError ? `"beforeError": "${result.beforeError}"` : ''}${
        result.beforeError && result.afterError
          ? `,
      `
          : ''
      }${result.afterError ? `"afterError": "${result.afterError}"` : ''}${result.comparison ? ',' : ''}  // Error messages if failed`
          : ''
      }${
        result.comparison
          ? `
      "comparison": {
        "diffPixels": ${result.comparison.diffPixels},
        "totalPixels": ${result.comparison.totalPixels},
        "diffPercentage": ${result.comparison.diffPercentage},
        "changeLevel": "${result.comparison.changeLevel}",
        "hasSignificantChange": ${result.comparison.hasSignificantChange}${
          result.comparison.diffImagePath
            ? `,
        "diffImagePath": "${result.comparison.diffImagePath}"  // Relative path to diff image`
            : ''
        }
      }`
          : ''
      }
    }${isLast ? '' : ','}`;
      }
    });

    content += `
  ]
}`;

    return content;
  }

  private static stripJSONComments(content: string): string {
    // Remove single-line comments (// comment) but preserve URLs with //
    let result = content.replace(/^\s*\/\/.*$/gm, '');

    // Remove inline comments after JSON values (but not inside strings)
    result = result.replace(/(?<!["'])(\s+)\/\/.*$/gm, '$1');

    // Remove multi-line comments (/* comment */)
    result = result.replace(/\/\*[\s\S]*?\*\//g, '');

    // Clean up extra whitespace and empty lines
    result = result.replace(/^\s*\n/gm, '');

    return result;
  }

  private static validateDataFile(dataFile: DataFile): void {
    if (!dataFile.metadata) {
      throw new Error('Missing metadata');
    }

    if (!dataFile.metadata.version) {
      throw new Error('Missing version in metadata');
    }

    if (!dataFile.metadata.mode || !['single', 'before-after'].includes(dataFile.metadata.mode)) {
      throw new Error('Invalid or missing mode in metadata');
    }

    if (!dataFile.results || !Array.isArray(dataFile.results)) {
      throw new Error('Missing or invalid results array');
    }

    // Validate each result
    dataFile.results.forEach((result, index) => {
      if (!result.url) {
        throw new Error(`Missing URL in result ${index}`);
      }

      if (dataFile.metadata.mode === 'single' && !result.singlePath && result.success) {
        throw new Error(`Missing singlePath in successful result ${index}`);
      }

      if (dataFile.metadata.mode === 'before-after' && !result.beforePath && !result.afterPath && result.success) {
        throw new Error(`Missing beforePath or afterPath in successful result ${index}`);
      }
    });
  }
}
