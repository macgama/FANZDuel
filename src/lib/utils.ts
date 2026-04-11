import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path: string | null, width?: number) {
  if (!path) return '';
  
  // If it's a Picsum URL, we can modify the URL to request a specific width
  if (path.includes('picsum.photos') && width) {
    // Example: https://picsum.photos/seed/xyz/800/600 -> we can't easily regex it without knowing the exact format,
    // but we can try to replace the width part if it matches a known pattern.
    // For simplicity, we'll just return the path for now, but this is where CDN-specific logic goes.
  }

  if (path.startsWith('http')) return path;
  
  // Handle gs:// URLs
  if (path.startsWith('gs://')) {
    const bucket = 'thebestfanonlinegas.firebasestorage.app';
    const filePath = path.replace(`gs://${bucket}/`, '');
    // If we had a Firebase Resize Images extension, we could append `_${width}x${width}` to the filename here.
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
  }

  // Fallback for relative paths
  return `https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`;
}
