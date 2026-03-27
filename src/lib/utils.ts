import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(url: string | undefined | null): string {
  if (!url) return '';
  
  const cleanUrl = url.trim();
  const defaultBucket = 'thebestfanonlinegas.firebasestorage.app';
  
  // If it's a data URL or a non-firebase HTTP URL, return as is
  if (cleanUrl.startsWith('data:') || (cleanUrl.startsWith('http') && !cleanUrl.includes('firebasestorage.googleapis.com'))) {
    return cleanUrl;
  }

  let bucket = defaultBucket;
  let path = '';

  if (cleanUrl.startsWith('gs://')) {
    const withoutProtocol = cleanUrl.replace('gs://', '');
    const firstSlashIndex = withoutProtocol.indexOf('/');
    if (firstSlashIndex !== -1) {
      const extractedBucket = withoutProtocol.substring(0, firstSlashIndex);
      bucket = extractedBucket || defaultBucket;
      path = withoutProtocol.substring(firstSlashIndex + 1);
    } else {
      bucket = withoutProtocol || defaultBucket;
      path = '';
    }
  } else if (cleanUrl.startsWith('https://firebasestorage.googleapis.com')) {
    try {
      // Extract bucket and path from existing Firebase URL
      // https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{path}?alt=media
      const urlObj = new URL(cleanUrl);
      const pathParts = urlObj.pathname.split('/');
      // pathParts: ["", "v0", "b", "{bucket}", "o", "{path}"]
      if (pathParts.length >= 6) {
        bucket = pathParts[3];
        // The rest of the path after 'o/' is the encoded file path
        path = decodeURIComponent(pathParts.slice(5).join('/'));
      } else {
        return cleanUrl;
      }
    } catch (e) {
      return cleanUrl;
    }
  } else if (!cleanUrl.includes('://')) {
    // It's just a path
    path = cleanUrl;
  } else {
    return cleanUrl;
  }

  if (!path) return '';

  // Return normalized Firebase Storage URL
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media`;
}
