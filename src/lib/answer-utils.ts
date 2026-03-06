export function isBlobUrl(url: string): boolean {
  return url.includes(".public.blob.vercel-storage.com/");
}

export function getYouTubeVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (u.hostname === "www.youtube.com" || u.hostname === "youtube.com" || u.hostname === "m.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const embedMatch = u.pathname.match(/^\/(embed|shorts)\/([^/?]+)/);
      if (embedMatch) return embedMatch[2];
    }
    return null;
  } catch {
    return null;
  }
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
