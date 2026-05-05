import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Video proxy or direct
export function getOptimizedVideoUrl(path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  
  // Handle gs:// URLs (Legacy database records)
  let finalPath = path;
  if (path.startsWith('gs://thebestfanonlinegas.firebasestorage.app/')) {
    const filePath = path.replace('gs://thebestfanonlinegas.firebasestorage.app/', '');
    finalPath = `https://thebestfan.online/img/${filePath}`;
  } else if (!path.startsWith('http')) {
    finalPath = `https://thebestfan.online/img/${path}`;
  }

  return finalPath;
}

export function getImageUrl(path: string | null | undefined, width: number = 800): string | undefined {
  if (!path) return undefined;
  
  if (path.startsWith('/api/image-proxy')) {
    return path;
  }
  
  // Automatically proxy football API logos to avoid CORS and caching issues
  if (path.includes('api-sports.io') || path.includes('media.api-sports.io') || path.includes('api-football.com')) {
    return `/api/image-proxy?url=${encodeURIComponent(path)}&w=${width > 120 ? 120 : width}`;
  }

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
