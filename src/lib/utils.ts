import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  
  // Handle gs:// URLs
  if (path.startsWith('gs://')) {
    const bucket = 'thebestfanonlinegas.firebasestorage.app';
    const filePath = path.replace(`gs://${bucket}/`, '');
    return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(filePath)}?alt=media`;
  }

  // Fallback for relative paths
  return `https://firebasestorage.googleapis.com/v0/b/thebestfanonlinegas.firebasestorage.app/o/${encodeURIComponent(path)}?alt=media`;
}
