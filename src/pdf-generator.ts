import fs from 'fs';
import PDFDocument from 'pdfkit';
import { ComparisonOptions, DataFile } from './types';

export class PDFGenerator {
  private doc: InstanceType<typeof PDFDocument>;
  private currentY: number = 0;
  private pageWidth: number = 841.89; // A4 landscape width in points
  private pageHeight: number = 595.28; // A4 landscape height in points
  private margin: number = 40;
  private contentWidth: number;
  private imageWidth: number;
  private imageHeight: number;

  constructor() {
    this.doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margins: {
        top: this.margin,
        bottom: this.margin,
        left: this.margin,
        right: this.margin,
      },
    });

    this.contentWidth = this.pageWidth - this.margin * 2;
    this.imageWidth = (this.contentWidth - 20) / 2; // Space for two images side by side with gap
    this.imageHeight = 350; // Increased height for landscape format
  }

  async generateReport(dataFile: DataFile, outputPath: string, comparisonOptions?: Partial<ComparisonOptions & { comparisonOnly: boolean }>): Promise<void> {
    try {
      // Filter results if comparison-only is enabled (uses existing comparison data for filtering)
      if (comparisonOptions?.comparisonOnly && dataFile.metadata.mode === 'before-after') {
        dataFile.results = dataFile.results.filter((result: any) => result.comparison?.hasSignificantChange);
      }

      // Set up the PDF output stream
      const stream = fs.createWriteStream(outputPath);
      this.doc.pipe(stream);

      // Add title page
      this.addTitlePage(dataFile);

      // Add screenshot pages
      await this.addScreenshotPages(dataFile);

      // Add summary page
      this.addSummaryPage(dataFile);

      // Finalize the PDF
      this.doc.end();

      // Wait for the stream to finish
      await new Promise<void>((resolve, reject) => {
        stream.on('finish', () => resolve());
        stream.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private addTitlePage(dataFile: DataFile): void {
    // Set dark background matching GitHub's dark theme
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight).fill('#0d1117');

    // Add title with GitHub-style colors
    this.doc
      .fillColor('#f0f6fc')
      .fontSize(36)
      .font('Helvetica-Bold')
      .text('Screenshot Report', this.margin, 160, { align: 'center' });

    // Add subtitle
    const modeText = dataFile.metadata.mode === 'single' ? 'Single Screenshot Mode' : 'Before/After Comparison';
    this.doc.fontSize(20).fillColor('#58a6ff').font('Helvetica').text(modeText, this.margin, 210, { align: 'center' });

    // Add generation info with better styling
    const generatedDate = new Date(dataFile.metadata.generatedAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    this.doc
      .fontSize(14)
      .fillColor('#8b949e')
      .text(`Generated: ${generatedDate}`, this.margin, 260, { align: 'center' });

    // Add statistics with cards-like styling
    const statsY = 330;
    const cardWidth = 120;
    const cardHeight = 80;
    const cardSpacing = 20;

    // Determine number of cards based on mode
    const hasComparison = dataFile.metadata.mode === 'before-after';
    let comparisonSummary = null;

    if (hasComparison) {
      // Calculate comparison summary from stored comparison data
      const changedCount = dataFile.results.filter((r: any) => r.comparison?.hasSignificantChange).length;
      const unchangedCount = dataFile.results.filter((r: any) => r.comparison && !r.comparison.hasSignificantChange).length;

      comparisonSummary = {
        changedCount,
        unchangedCount,
        totalComparisons: changedCount + unchangedCount
      };
    }

    const cardCount = hasComparison && comparisonSummary && comparisonSummary.totalComparisons > 0 ? 5 : 3;

    const totalCardsWidth = cardWidth * cardCount + cardSpacing * (cardCount - 1);
    const cardsStartX = (this.pageWidth - totalCardsWidth) / 2;

    let currentCardX = cardsStartX;

    // Total URLs card
    this.doc.rect(currentCardX, statsY, cardWidth, cardHeight).fill('#21262d').stroke('#30363d');

    this.doc
      .fillColor('#58a6ff')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(dataFile.metadata.totalUrls.toString(), currentCardX, statsY + 15, { width: cardWidth, align: 'center' });

    this.doc
      .fillColor('#8b949e')
      .fontSize(12)
      .font('Helvetica')
      .text('Total URLs', currentCardX, statsY + 45, { width: cardWidth, align: 'center' });

    // Successful card
    currentCardX += cardWidth + cardSpacing;
    this.doc.rect(currentCardX, statsY, cardWidth, cardHeight).fill('#21262d').stroke('#30363d');

    this.doc
      .fillColor('#3fb950')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(dataFile.metadata.successCount.toString(), currentCardX, statsY + 15, { width: cardWidth, align: 'center' });

    this.doc
      .fillColor('#8b949e')
      .fontSize(12)
      .font('Helvetica')
      .text('Successful', currentCardX, statsY + 45, { width: cardWidth, align: 'center' });

    // Failed card
    currentCardX += cardWidth + cardSpacing;
    this.doc.rect(currentCardX, statsY, cardWidth, cardHeight).fill('#21262d').stroke('#30363d');

    this.doc
      .fillColor('#f85149')
      .fontSize(24)
      .font('Helvetica-Bold')
      .text(dataFile.metadata.errorCount.toString(), currentCardX, statsY + 15, { width: cardWidth, align: 'center' });

    this.doc
      .fillColor('#8b949e')
      .fontSize(12)
      .font('Helvetica')
      .text('Failed', currentCardX, statsY + 45, { width: cardWidth, align: 'center' });

    // Add comparison cards if in before/after mode
    if (hasComparison && comparisonSummary && comparisonSummary.totalComparisons > 0) {
      // Changed card
      currentCardX += cardWidth + cardSpacing;
      this.doc.rect(currentCardX, statsY, cardWidth, cardHeight).fill('#21262d').stroke('#30363d');

      this.doc
        .fillColor('#f79000')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(comparisonSummary.changedCount.toString(), currentCardX, statsY + 15, { width: cardWidth, align: 'center' });

      this.doc
        .fillColor('#8b949e')
        .fontSize(12)
        .font('Helvetica')
        .text('Changed', currentCardX, statsY + 45, { width: cardWidth, align: 'center' });

      // Unchanged card
      currentCardX += cardWidth + cardSpacing;
      this.doc.rect(currentCardX, statsY, cardWidth, cardHeight).fill('#21262d').stroke('#30363d');

      this.doc
        .fillColor('#8b949e')
        .fontSize(24)
        .font('Helvetica-Bold')
        .text(comparisonSummary.unchangedCount.toString(), currentCardX, statsY + 15, { width: cardWidth, align: 'center' });

      this.doc
        .fillColor('#8b949e')
        .fontSize(12)
        .font('Helvetica')
        .text('Unchanged', currentCardX, statsY + 45, { width: cardWidth, align: 'center' });
    }

    // Add footer
    this.doc.fontSize(12).fillColor('#6e7681').text('Generated by Screenshot CLI', 0, 480, {
      width: this.pageWidth,
      align: 'center',
    });
  }

  private async addScreenshotPages(dataFile: DataFile): Promise<void> {
    let results = dataFile.results.filter((r) => r.success);

    // Sort results by change level for before/after mode
    if (dataFile.metadata.mode === 'before-after') {
      results = this.sortResultsByChangeLevel(results);
    }

    for (const result of results) {
      this.doc.addPage();

      // Dark background
      this.doc.rect(0, 0, this.pageWidth, this.pageHeight).fill('#0d1117');

      // Add header section with subtle background
      this.doc.rect(0, 0, this.pageWidth, 120).fill('#161b22');

      // Calculate proper spacing for URL and comparison badge
      const hasComparison = dataFile.metadata.mode === 'before-after' && (result as any).comparison;
      const badgeWidth = hasComparison ? 180 : 0; // Space needed for comparison badge (matches actual badge width)
      const urlWidth = this.contentWidth - badgeWidth - (hasComparison ? 20 : 0); // 20px gap if badge exists

      // Add URL header with proper width calculation
      const urlY = 40;
      const fontSize = 16;
      this.doc.fillColor('#f0f6fc').fontSize(fontSize).font('Helvetica-Bold').text(result.url, this.margin, urlY, {
        width: urlWidth,
        ellipsis: true,
      });

      // Add comparison badge for before/after mode (vertically centered with URL)
      if (hasComparison) {
        const badgeX = this.margin + urlWidth + 20; // 20px gap from URL
        const badgeHeight = 30;
        // Calculate vertical center: URL baseline + (fontSize/2) - (badgeHeight/2)
        const badgeY = urlY + (fontSize / 2) - (badgeHeight / 2);
        this.addComparisonBadge((result as any).comparison, badgeX, badgeY);
      }

      // Add timestamp with better positioning
      const timestamp = result.timestamp || result.beforeTimestamp || result.afterTimestamp;
      if (timestamp) {
        const date = new Date(timestamp).toLocaleString();
        this.doc.fontSize(12).fillColor('#8b949e').text(`Captured: ${date}`, this.margin, 75);
      }

      // Add screenshots
      await this.addScreenshotImages(result, dataFile.metadata.mode);
    }
  }

  private async addScreenshotImages(result: any, mode: string): Promise<void> {
    const startY = 160;
    const imageGap = 30; // Gap between images

    if (mode === 'single' && result.singlePath) {
      // Single screenshot - centered
      const centeredX = this.margin + (this.contentWidth - this.imageWidth) / 2;
      await this.addImage(result.singlePath, centeredX, startY);
    } else if (mode === 'before-after' && result.beforePath && result.afterPath) {
      const hasDiffImage = result.comparison?.diffImagePath && result.comparison?.hasSignificantChange;

      if (hasDiffImage) {
        // 3-column layout: Before, After, Diff
        const imageWidth = (this.contentWidth - imageGap * 2) / 3;
        const startX = this.margin + (this.contentWidth - (imageWidth * 3 + imageGap * 2)) / 2;

        // Before image
        this.doc
          .fillColor('#f0f6fc')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Before', startX, startY - 25, { width: imageWidth, align: 'center' });

        await this.addImage(result.beforePath, startX, startY, imageWidth, this.imageHeight);

        // After image
        const afterX = startX + imageWidth + imageGap;
        this.doc
          .fillColor('#f0f6fc')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('After', afterX, startY - 25, { width: imageWidth, align: 'center' });

        await this.addImage(result.afterPath, afterX, startY, imageWidth, this.imageHeight);

        // Diff image
        const diffX = afterX + imageWidth + imageGap;
        this.doc
          .fillColor('#f79000')
          .fontSize(12)
          .font('Helvetica-Bold')
          .text('Differences', diffX, startY - 25, { width: imageWidth, align: 'center' });

        await this.addImage(result.comparison.diffImagePath, diffX, startY, imageWidth, this.imageHeight);
      } else {
        // 2-column layout: Before, After
        const totalImageWidth = this.imageWidth * 2 + imageGap;
        const startX = (this.pageWidth - totalImageWidth) / 2;

        // Before image (left side, centered)
        this.doc
          .fillColor('#f0f6fc')
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Before', startX, startY - 25);

        await this.addImage(result.beforePath, startX, startY);

        // After image (right side, centered)
        const afterX = startX + this.imageWidth + imageGap;
        this.doc
          .fillColor('#f0f6fc')
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('After', afterX, startY - 25);

        await this.addImage(result.afterPath, afterX, startY);
      }
    }
  }

  private async addImage(imagePath: string, x: number, y: number, width?: number, height?: number): Promise<void> {
    const imageWidth = width || this.imageWidth;
    const imageHeight = height || this.imageHeight;

    try {
      if (fs.existsSync(imagePath)) {
        // Add subtle border effect
        this.doc.rect(x - 1, y - 1, imageWidth + 2, imageHeight + 2).fill('#30363d');

        // Add main image container
        this.doc.rect(x, y, imageWidth, imageHeight).fill('#21262d');

        // Add the image with better centering
        this.doc.image(imagePath, x, y, {
          width: imageWidth,
          height: imageHeight,
          fit: [imageWidth, imageHeight],
          align: 'center',
          valign: 'center',
        });
      } else {
        // Image not found - add placeholder with theme colors
        this.doc.rect(x, y, imageWidth, imageHeight).stroke('#30363d').fillColor('#21262d').fill();

        this.doc
          .fillColor('#8b949e')
          .fontSize(12)
          .text('Image not found', x + imageWidth / 2 - 40, y + imageHeight / 2 - 10);
      }
    } catch (error) {
      console.warn(`Warning: Could not add image ${imagePath}:`, error);

      // Add error placeholder with theme colors
      this.doc.rect(x, y, imageWidth, imageHeight).stroke('#f85149').fillColor('#21262d').fill();

      this.doc
        .fillColor('#f85149')
        .fontSize(10)
        .text('Error loading image', x + imageWidth / 2 - 40, y + imageHeight / 2 - 10);
    }
  }

  private addComparisonBadge(comparison: any, x: number, y: number): void {
    const badgeWidth = 180;
    const badgeHeight = 30;

    // Get color based on change level
    const colors = this.getChangeColors(comparison.changeLevel);

    // Draw badge background
    this.doc.rect(x, y, badgeWidth, badgeHeight).fill(colors.background).stroke(colors.border);

    // Calculate vertical center for text positioning
    const getCenteredY = (fontSize: number) => y + (badgeHeight / 2) - (fontSize / 2) + 2; // +2 for better visual balance

    // Add change level text (vertically centered)
    this.doc
      .fillColor(colors.text)
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(comparison.changeLevel.toUpperCase(), x + 5, getCenteredY(10), { width: 60, align: 'center' });

    // Add percentage (vertically centered)
    this.doc
      .fontSize(12)
      .text(`${comparison.diffPercentage}%`, x + 70, getCenteredY(12), { width: 50, align: 'center' });

    // Add pixel count (vertically centered)
    this.doc
      .fontSize(8)
      .text(`${comparison.diffPixels.toLocaleString()} px`, x + 125, getCenteredY(8), { width: 50, align: 'center' });
  }

  private getChangeColors(changeLevel: string): { background: string; border: string; text: string } {
    switch (changeLevel) {
      case 'none': return { background: '#30363d', border: '#8b949e', text: '#8b949e' };
      case 'minimal': return { background: '#1f2937', border: '#60a5fa', text: '#60a5fa' };
      case 'minor': return { background: '#1e3a8a', border: '#93c5fd', text: '#93c5fd' };
      case 'moderate': return { background: '#92400e', border: '#fbbf24', text: '#fbbf24' };
      case 'major': return { background: '#991b1b', border: '#fca5a5', text: '#fca5a5' };
      case 'extreme': return { background: '#581c87', border: '#c4b5fd', text: '#c4b5fd' };
      default: return { background: '#30363d', border: '#8b949e', text: '#8b949e' };
    }
  }

  private sortResultsByChangeLevel(results: any[]): any[] {
    const levelOrder: Record<string, number> = {
      'extreme': 0,
      'major': 1,
      'moderate': 2,
      'minor': 3,
      'minimal': 4,
      'none': 5
    };

    return [...results].sort((a, b) => {
      const aLevel = a.comparison?.changeLevel || 'none';
      const bLevel = b.comparison?.changeLevel || 'none';
      return (levelOrder[aLevel] ?? 5) - (levelOrder[bLevel] ?? 5);
    });
  }

  private addSummaryPage(dataFile: DataFile): void {
    this.doc.addPage();

    // Dark background matching theme
    this.doc.rect(0, 0, this.pageWidth, this.pageHeight).fill('#0d1117');

    // Title
    this.doc.fillColor('#f0f6fc').fontSize(28).font('Helvetica-Bold').text('Summary', this.margin, 60);

    let y = 120;
    const lineHeight = 22;

    // Statistics section
    this.doc.fontSize(16).fillColor('#58a6ff').text('Statistics', this.margin, y);

    y += 35;
    this.doc.fontSize(14).fillColor('#8b949e').text(`Total URLs processed: `, this.margin, y);
    this.doc.fillColor('#f0f6fc').text(`${dataFile.metadata.totalUrls}`, this.margin + 180, y);

    y += lineHeight;
    this.doc.fillColor('#8b949e').text(`Successful screenshots: `, this.margin, y);
    this.doc.fillColor('#3fb950').text(`${dataFile.metadata.successCount}`, this.margin + 180, y);

    y += lineHeight;
    this.doc.fillColor('#8b949e').text(`Failed screenshots: `, this.margin, y);
    this.doc.fillColor('#f85149').text(`${dataFile.metadata.errorCount}`, this.margin + 180, y);

    // Configuration section
    y += 50;
    this.doc.fontSize(16).fillColor('#58a6ff').text('Configuration', this.margin, y);

    y += 35;
    this.doc.fontSize(14).fillColor('#8b949e').text(`Viewport: `, this.margin, y);
    this.doc
      .fillColor('#f0f6fc')
      .text(`${dataFile.metadata.options.width}x${dataFile.metadata.options.height}`, this.margin + 100, y);

    y += lineHeight;
    this.doc.fillColor('#8b949e').text(`Wait strategy: `, this.margin, y);
    this.doc.fillColor('#f0f6fc').text(`${dataFile.metadata.options.waitStrategy}`, this.margin + 110, y);

    y += lineHeight;
    this.doc.fillColor('#8b949e').text(`Timeout: `, this.margin, y);
    this.doc.fillColor('#f0f6fc').text(`${dataFile.metadata.options.timeout}ms`, this.margin + 90, y);

    y += lineHeight;
    this.doc.fillColor('#8b949e').text(`Max retries: `, this.margin, y);
    this.doc.fillColor('#f0f6fc').text(`${dataFile.metadata.options.maxRetries}`, this.margin + 100, y);

    // Timing information for before/after mode
    if (dataFile.metadata.beforePhase && dataFile.metadata.afterPhase) {
      y += 50;
      this.doc.fontSize(16).fillColor('#58a6ff').text('Timing', this.margin, y);

      y += 35;
      this.doc.fontSize(14).fillColor('#8b949e').text(`Before phase: `, this.margin, y);
      this.doc.fillColor('#f0f6fc').text(`${dataFile.metadata.beforePhase.duration}`, this.margin + 110, y);

      y += lineHeight;
      this.doc.fillColor('#8b949e').text(`After phase: `, this.margin, y);
      this.doc.fillColor('#f0f6fc').text(`${dataFile.metadata.afterPhase.duration}`, this.margin + 105, y);
    }

    // Footer - positioned dynamically below content with safe spacing
    const footerY = Math.min(y + 60, this.pageHeight - 30);
    this.doc.fontSize(12).fillColor('#6e7681').text('Report generated by Screenshot CLI', 0, footerY, {
      width: this.pageWidth,
      align: 'center',
    });
  }

  private truncateUrl(url: string, maxLength: number = 60): string {
    if (url.length <= maxLength) return url;

    const start = url.substring(0, 20);
    const end = url.substring(url.length - 30);
    return `${start}...${end}`;
  }
}
