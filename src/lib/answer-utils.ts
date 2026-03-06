export function isBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com/");
}

export function getBlobMediaType(url: string): "video" | "audio" | null {
  const videoExtensions = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"];
  const audioExtensions = [".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"];

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (videoExtensions.some((ext) => pathname.endsWith(ext))) return "video";
    if (audioExtensions.some((ext) => pathname.endsWith(ext))) return "audio";
  } catch {
    // Invalid URL
  }
  return null;
}
