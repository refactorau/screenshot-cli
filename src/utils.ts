import { promises as fs } from 'fs';
import { join, extname, resolve } from 'path';
import { pathToFileURL } from 'url';

export function sanitizeFilename(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .substring(0, 100);
}

export async function ensureDirectory(dir: string): Promise<void> {
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function loadUrlsFromFile(filePath: string): Promise<string[]> {
  const resolvedPath = resolve(filePath);
  const ext = extname(filePath).toLowerCase();

  if (ext === '.js') {
    // Load JS file that exports array of URLs
    const fileUrl = pathToFileURL(resolvedPath).href;
    const urlsModule = await import(fileUrl + '?t=' + Date.now());
    const urls = urlsModule.default || urlsModule;

    if (!Array.isArray(urls)) {
      throw new Error('JS file must export an array of URLs');
    }

    return urls.filter((url) => typeof url === 'string' && url.trim());
  } else {
    // Load text file with URLs (one per line)
    const content = await fs.readFile(resolvedPath, 'utf-8');
    return content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
  }
}

export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}
