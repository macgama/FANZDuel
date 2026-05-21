import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Video proxy or direct
export function getOptimizedVideoUrl(
  path: string | null | undefined,
): string | undefined {
  if (!path) return undefined;

  // Handle gs:// URLs (Legacy database records)
  let finalPath = path;

  if (finalPath.startsWith("fanz/")) {
    finalPath = `/${finalPath}`;
  } else if (
    finalPath.startsWith("imageFanz") ||
    finalPath.startsWith("videoFanz")
  ) {
    finalPath = `/fanz/${finalPath}`;
  }

  // Handle db urls that have the old patterns
  if (finalPath.includes("thebestfan.online/img/public/fanz/")) {
    finalPath = finalPath.replace(
      "https://thebestfan.online/img/public/fanz/",
      "/fanz/",
    );
  } else if (
    finalPath.includes("/fanz/") &&
    !finalPath.startsWith("http") &&
    !finalPath.startsWith("/fanz/")
  ) {
    finalPath = `/fanz/${finalPath.split("/fanz/")[1]}`;
  }

  // Insert the 3-digit folder structure if it's missing
  const regex = /\/fanz\/(imageFanz|videoFanz)(\d{3})/;
  if (regex.test(finalPath)) {
    finalPath = finalPath.replace(regex, "/fanz/$2/$1$2");
  }

  // Ensure absolute URL for /fanz/ in our dev environment or his proxy
  if (finalPath.startsWith("/fanz/")) {
    finalPath = `https://thebestfan.online/img/public${finalPath}`;
  }

  if (finalPath.startsWith("gs://thebestfanonlinegas.firebasestorage.app/")) {
    const filePath = finalPath.replace(
      "gs://thebestfanonlinegas.firebasestorage.app/",
      "",
    );
    finalPath = `https://thebestfan.online/img/${filePath}`;
  } else if (!finalPath.startsWith("http") && !finalPath.startsWith("/")) {
    finalPath = `https://thebestfan.online/img/${finalPath}`;
  }

  return finalPath;
}

export function getImageUrl(
  path: string | null | undefined,
  width: number = 800,
): string | undefined {
  if (!path) return undefined;

  if (path.startsWith("/api/image-proxy")) {
    return path;
  }

  // Automatically proxy football API logos to avoid CORS and caching issues
  if (
    path.includes("api-sports.io") ||
    path.includes("media.api-sports.io") ||
    path.includes("api-football.com")
  ) {
    return `/api/image-proxy?url=${encodeURIComponent(path)}&w=${width > 120 ? 120 : width}`;
  }

  let finalPath = path;

  if (finalPath.startsWith("fanz/")) {
    finalPath = `/${finalPath}`;
  } else if (
    finalPath.startsWith("imageFanz") ||
    finalPath.startsWith("videoFanz")
  ) {
    finalPath = `/fanz/${finalPath}`;
  }

  // Handle db urls that have the old patterns
  if (finalPath.includes("thebestfan.online/img/public/fanz/")) {
    finalPath = finalPath.replace(
      "https://thebestfan.online/img/public/fanz/",
      "/fanz/",
    );
  } else if (
    finalPath.includes("/fanz/") &&
    !finalPath.startsWith("http") &&
    !finalPath.startsWith("/fanz/")
  ) {
    finalPath = `/fanz/${finalPath.split("/fanz/")[1]}`;
  }

  // Insert the 3-digit folder structure if it's missing (e.g. /fanz/imageFanz001Skin000.png -> /fanz/001/imageFanz001Skin000.png)
  const regex = /\/fanz\/(imageFanz|videoFanz)(\d{3})/;
  if (regex.test(finalPath)) {
    finalPath = finalPath.replace(regex, "/fanz/$2/$1$2");
  }

  // Ensure absolute URL for /fanz/ in our dev environment or his proxy
  if (finalPath.startsWith("/fanz/")) {
    finalPath = `https://thebestfan.online/img/public${finalPath}`;
  }

  // Handle gs:// URLs (Legacy database records)
  if (finalPath.startsWith("gs://thebestfanonlinegas.firebasestorage.app/")) {
    const filePath = finalPath.replace(
      "gs://thebestfanonlinegas.firebasestorage.app/",
      "",
    );
    finalPath = `https://thebestfan.online/img/${filePath}`;
  } else if (!finalPath.startsWith("http") && !finalPath.startsWith("/")) {
    // Fallback for relative paths
    finalPath = `https://thebestfan.online/img/${finalPath}`;
  }

  // Optimize only images through the local proxy, exclude videos
  if (
    finalPath.includes("thebestfan.online/img/") &&
    !finalPath.endsWith(".mp4") &&
    !finalPath.endsWith(".webm") &&
    !finalPath.endsWith(".mov")
  ) {
    return `/api/image-proxy?url=${encodeURIComponent(finalPath)}&w=${width}`;
  }

  return finalPath;
}
