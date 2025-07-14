export interface ScreenshotOptions {
  urls: string[];
  output: string;
  beforeAfter: boolean;
  width: number;
  height: number;
  timeout: number;
  urlsFile?: string;
  maxRetries?: number;
  retryDelay?: number;
  waitStrategy?: 'networkidle' | 'load' | 'domcontentloaded';
  reportType?: ReportType;
  title?: string;
}

export enum ReportType {
  HTML = 'html',
  PDF = 'pdf',
  ALL = 'all',
}

export interface ComparisonResult {
  diffPixels: number;
  totalPixels: number;
  diffPercentage: number;
  changeLevel: ChangeLevel;
  diffImagePath?: string;
  hasSignificantChange: boolean;
}

export enum ChangeLevel {
  NONE = 'none',           // 0-0.1% difference
  MINIMAL = 'minimal',     // 0.1-1% difference  
  MINOR = 'minor',         // 1-5% difference
  MODERATE = 'moderate',   // 5-15% difference
  MAJOR = 'major',         // 15-50% difference
  EXTREME = 'extreme'      // 50%+ difference
}

export interface ComparisonOptions {
  threshold: number;          // pixelmatch threshold (0-1)
  generateDiffImage: boolean; // create visual diff image
  ignoreAntialiasing: boolean; // ignore anti-aliased pixels
  minChangeThreshold: number; // minimum % to consider "changed"
}

export interface ScreenshotResult {
  url: string;
  beforePath?: string;
  afterPath?: string;
  singlePath?: string;
  error?: string;
  timestamp: Date;
  comparison?: ComparisonResult;
}

export interface ReportData {
  results: ScreenshotResult[];
  mode: 'single' | 'before-after';
  generatedAt: Date;
  totalUrls: number;
  successCount: number;
  errorCount: number;
}

export interface DataFile {
  metadata: {
    version: string;
    mode: 'single' | 'before-after';
    generatedAt: string;
    totalUrls: number;
    successCount: number;
    errorCount: number;
    options: {
      waitStrategy: string;
      width: number;
      height: number;
      timeout: number;
      maxRetries: number;
      retryDelay: number;
    };
    beforePhase?: {
      startTime: string;
      endTime: string;
      duration: string;
    };
    afterPhase?: {
      startTime: string;
      endTime: string;
      duration: string;
    };
  };
  results: Array<{
    url: string;
    timestamp?: string;
    beforeTimestamp?: string;
    afterTimestamp?: string;
    singlePath?: string;
    beforePath?: string;
    afterPath?: string;
    error?: string;
    beforeError?: string;
    afterError?: string;
    success: boolean;
    beforeSuccess?: boolean;
    afterSuccess?: boolean;
    comparison?: ComparisonResult;
  }>;
}

export interface GenerateOptions {
  dataFilePath: string;
  reportType: ReportType;
}

// Utility functions for title and filename conversion
export function titleToFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

export function generateFilenames(title: string, outputDir: string) {
  const safeTitle = titleToFilename(title);
  return {
    dataFile: `${outputDir}/${safeTitle}-data.jsonc`,
    htmlFile: `${outputDir}/${safeTitle}.html`,
    pdfFile: `${outputDir}/${safeTitle}.pdf`,
    safeTitle,
  };
}
