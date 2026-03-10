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

/** Check if URL is any Facebook URL (video or not) */
export function isFacebookUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace("www.", "").replace("m.", "");
    return host === "facebook.com" || host === "fb.watch" || host === "fb.com";
  } catch {
    return false;
  }
}

/**
 * Check if URL is a Facebook video URL.
 * Supports:
 *   facebook.com/watch/?v=ID
 *   facebook.com/USERNAME/videos/ID
 *   facebook.com/reel/ID
 *   facebook.com/share/v/ID/
 *   facebook.com/video.php?v=ID
 *   fb.watch/ID
 */
export function isFacebookVideoUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace("www.", "").replace("m.", "");

    if (host === "fb.watch") return true;

    if (host === "facebook.com") {
      if (u.pathname === "/watch" || u.pathname === "/watch/") return !!u.searchParams.get("v");
      if (u.pathname.match(/\/videos\/\d+/)) return true;
      if (u.pathname.match(/\/reel\/\d+/)) return true;
      if (u.pathname.match(/\/share\/v\//)) return true;
      if (u.pathname === "/video.php") return !!u.searchParams.get("v");
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Server-side check: verify that a video URL is publicly accessible.
 * - YouTube: Uses free oEmbed API (reliable, returns 401/404 for private)
 * - Facebook: HEAD request to video URL (best-effort, no free API)
 * Returns true if accessible, false if confirmed private/unavailable.
 * On network errors, returns true (lenient — don't block due to transient issues).
 */
export async function isVideoPubliclyAccessible(url: string): Promise<boolean> {
  const TIMEOUT = 5000;

  try {
    const youtubeId = getYouTubeVideoId(url);
    if (youtubeId) {
      const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`;
      const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(TIMEOUT) });
      return res.status === 200;
    }

    if (isFacebookVideoUrl(url)) {
      const res = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT),
      });
      // Facebook returns 302 to login for private content
      if (res.status >= 400) return false;
      // If we ended up on a login page, it's private
      if (res.url && res.url.includes("/login")) return false;
      return true;
    }

    return true;
  } catch {
    // Network error or timeout — allow through (lenient)
    return true;
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
