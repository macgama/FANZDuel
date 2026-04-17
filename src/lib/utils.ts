import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getImageUrl(path: string | null, width: number = 800) {
  if (!path) return '';
  
  let finalPath = path;

  // Handle gs:// URLs (Legacy database records)
  if (path.startsWith('gs://thebestfanonlinegas.firebasestorage.app/')) {
    const filePath = path.replace('gs://thebestfanonlinegas.firebasestorage.app/', '');
    finalPath = `https://thebestfan.online/img/${filePath}`;
  } else if (!path.startsWith('http')) {
    // Fallback for relative paths
    finalPath = `https://thebestfan.online/img/${path}`;
  }

  // Optimize only images through the local proxy, exclude videos
  if (
    finalPath.includes('thebestfan.online/img/') && 
    !finalPath.endsWith('.mp4') && 
    !finalPath.endsWith('.webm') &&
    !finalPath.endsWith('.mov')
  ) {
    return `/api/image-proxy?url=${encodeURIComponent(finalPath)}&w=${width}`;
  }

  return finalPath;
}
