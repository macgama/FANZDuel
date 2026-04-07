import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path: string | null) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://firebasestorage.googleapis.com/v0/b/ais-dev-642kxhb462wkkmvimy57lm.appspot.com/o/${encodeURIComponent(path)}?alt=media`;
}
