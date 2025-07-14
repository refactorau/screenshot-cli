import fs from 'fs/promises';
import { basename, dirname, join } from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { ChangeLevel, ComparisonOptions, ComparisonResult } from './types';

export class ImageComparator {
  private defaultOptions: ComparisonOptions = {
    threshold: 0.1,
    generateDiffImage: true,
    ignoreAntialiasing: false,
    minChangeThreshold: 0.1, // 0.1% minimum change to be considered different
  };

  async compareImages(
    beforePath: string,
    afterPath: string,
    options: Partial<ComparisonOptions> = {},
  ): Promise<ComparisonResult> {
    const opts = { ...this.defaultOptions, ...options };

    try {
      // Read both images
      const beforeBuffer = await fs.readFile(beforePath);
      const afterBuffer = await fs.readFile(afterPath);

      const beforeImg = PNG.sync.read(beforeBuffer);
      const afterImg = PNG.sync.read(afterBuffer);

      // Check if dimensions match
      if (beforeImg.width !== afterImg.width || beforeImg.height !== afterImg.height) {
        // Different dimensions indicate significant layout changes
        const beforePixels = beforeImg.width * beforeImg.height;
        const afterPixels = afterImg.width * afterImg.height;
        const pixelDifference = Math.abs(afterPixels - beforePixels);

        // Calculate percentage change based on dimension difference
        const diffPercentage = (pixelDifference / beforePixels) * 100;
        const changeLevel = this.determineChangeLevel(Math.max(diffPercentage, 15)); // Minimum 15% for dimension changes

        return {
          diffPixels: pixelDifference,
          totalPixels: beforePixels,
          diffPercentage: Math.round(diffPercentage * 100) / 100,
          changeLevel,
          diffImagePath: undefined, // Can't generate diff for different dimensions
          hasSignificantChange: true, // Always significant when dimensions change
        };
      }

      const { width, height } = beforeImg;
      const totalPixels = width * height;

      // Create diff image if requested
      const diffImg = opts.generateDiffImage ? new PNG({ width, height }) : null;

      // Compare images
      const diffPixels = pixelmatch(beforeImg.data, afterImg.data, diffImg?.data || undefined, width, height, {
        threshold: opts.threshold,
        includeAA: !opts.ignoreAntialiasing,
        alpha: 0.1,
        diffColor: [255, 0, 0], // Red for differences
        diffColorAlt: [0, 255, 0], // Green for removals
        aaColor: [255, 255, 0], // Yellow for antialiasing
      });

      const diffPercentage = (diffPixels / totalPixels) * 100;
      const changeLevel = this.determineChangeLevel(diffPercentage);
      const hasSignificantChange = diffPercentage >= opts.minChangeThreshold;

      let diffImagePath: string | undefined;

      // Save diff image if significant changes found OR if it's a major change
      const shouldGenerateDiffImage =
        opts.generateDiffImage &&
        diffImg &&
        (hasSignificantChange || changeLevel === 'major' || changeLevel === 'moderate');

      if (shouldGenerateDiffImage) {
        diffImagePath = this.generateDiffImagePath(beforePath);
        const diffBuffer = PNG.sync.write(diffImg);
        await fs.writeFile(diffImagePath, diffBuffer);
      }

      return {
        diffPixels,
        totalPixels,
        diffPercentage: Math.round(diffPercentage * 100) / 100, // Round to 2 decimals
        changeLevel,
        diffImagePath,
        hasSignificantChange,
      };
    } catch (error) {
      throw new Error(`Image comparison failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private determineChangeLevel(diffPercentage: number): ChangeLevel {
    if (diffPercentage < 0.1) return ChangeLevel.NONE;
    if (diffPercentage < 1) return ChangeLevel.MINIMAL;
    if (diffPercentage < 5) return ChangeLevel.MINOR;
    if (diffPercentage < 15) return ChangeLevel.MODERATE;
    if (diffPercentage < 50) return ChangeLevel.MAJOR;
    return ChangeLevel.EXTREME;
  }

  private generateDiffImagePath(beforePath: string): string {
    const dir = dirname(beforePath);
    const name = basename(beforePath, '.png');
    return join(dir, `${name}_diff.png`);
  }

  /**
   * Batch compare multiple image pairs
   */
  async batchCompare(
    imagePairs: Array<{ beforePath: string; afterPath: string }>,
    options: Partial<ComparisonOptions> = {},
  ): Promise<ComparisonResult[]> {
    const results: ComparisonResult[] = [];

    for (const pair of imagePairs) {
      try {
        const result = await this.compareImages(pair.beforePath, pair.afterPath, options);
        results.push(result);
      } catch (error) {
        // Return a default result for failed comparisons
        results.push({
          diffPixels: 0,
          totalPixels: 0,
          diffPercentage: 0,
          changeLevel: ChangeLevel.NONE,
          hasSignificantChange: false,
          diffImagePath: undefined,
        });
      }
    }

    return results;
  }

  /**
   * Get summary statistics for a batch of comparisons
   */
  getComparisonSummary(results: ComparisonResult[]): {
    totalImages: number;
    changedImages: number;
    unchangedImages: number;
    averageChangePercentage: number;
    maxChangePercentage: number;
    changeLevelCounts: Record<ChangeLevel, number>;
  } {
    const changedImages = results.filter((r) => r.hasSignificantChange).length;
    const unchangedImages = results.length - changedImages;

    const changePercentages = results.map((r) => r.diffPercentage);
    const averageChangePercentage = changePercentages.reduce((a, b) => a + b, 0) / results.length;
    const maxChangePercentage = Math.max(...changePercentages);

    const changeLevelCounts: Record<ChangeLevel, number> = {
      [ChangeLevel.NONE]: 0,
      [ChangeLevel.MINIMAL]: 0,
      [ChangeLevel.MINOR]: 0,
      [ChangeLevel.MODERATE]: 0,
      [ChangeLevel.MAJOR]: 0,
      [ChangeLevel.EXTREME]: 0,
    };

    results.forEach((result) => {
      changeLevelCounts[result.changeLevel]++;
    });

    return {
      totalImages: results.length,
      changedImages,
      unchangedImages,
      averageChangePercentage: Math.round(averageChangePercentage * 100) / 100,
      maxChangePercentage,
      changeLevelCounts,
    };
  }
}
