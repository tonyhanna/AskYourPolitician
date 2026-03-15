/**
 * Client-side video compressor.
 *
 * Re-encodes a video file at a lower bitrate using Canvas + MediaRecorder.
 * Caps resolution at 1080p while maintaining aspect ratio.
 * Processes at 1× real-time (a 20s video takes ~20s to compress).
 */

export interface CompressOptions {
  /** Max output width (default 1920) */
  maxWidth?: number;
  /** Max output height (default 1080) */
  maxHeight?: number;
  /** Frame rate (default 30) */
  fps?: number;
  /** Video bitrate in bps (default 5_000_000) */
  videoBitsPerSecond?: number;
  /** Skip compression if file is already smaller than this (bytes, default 50 MB) */
  skipThresholdBytes?: number;
}

const DEFAULTS: Required<CompressOptions> = {
  maxWidth: 1920,
  maxHeight: 1080,
  fps: 30,
  videoBitsPerSecond: 5_000_000,
  skipThresholdBytes: 50 * 1024 * 1024, // 50 MB
};

/**
 * Compress a video file.
 *
 * Returns a compressed `File` (webm or mp4), or the original file if:
 * - The file is already under the skip threshold
 * - The browser doesn't support MediaRecorder with a video codec
 * - The compressed version is somehow larger than the original
 *
 * @param onProgress — called with 0–1 representing how far through the video we are
 */
export async function compressVideo(
  file: File,
  opts?: CompressOptions,
  onProgress?: (progress: number) => void,
): Promise<File> {
  const { maxWidth, maxHeight, fps, videoBitsPerSecond, skipThresholdBytes } = {
    ...DEFAULTS,
    ...opts,
  };

  // Skip if already small enough
  if (file.size <= skipThresholdBytes) {
    return file;
  }

  // Pick a supported MIME type
  const mimeType = getSupportedMimeType();
  if (!mimeType) return file;

  const videoUrl = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    // Use volume=0 instead of muted=true — muted can prevent audio track decoding
    // in some browsers, which breaks Web Audio capture
    video.volume = 0;
    video.playsInline = true;
    video.src = videoUrl;

    // Wait for metadata
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Failed to load video metadata"));
    });

    // Wait for enough data to start playback
    await new Promise<void>((resolve) => {
      if (video.readyState >= 3) {
        resolve();
        return;
      }
      video.oncanplay = () => resolve();
    });

    const totalDuration = video.duration;
    if (!totalDuration || totalDuration <= 0 || !isFinite(totalDuration)) {
      return file;
    }

    // Calculate scaled dimensions (maintain aspect ratio)
    let w = video.videoWidth;
    let h = video.videoHeight;

    // Only downscale, never upscale
    if (w > maxWidth || h > maxHeight) {
      const scale = Math.min(maxWidth / w, maxHeight / h);
      w = Math.round(w * scale);
      h = Math.round(h * scale);
    }

    // Ensure even dimensions (required by some codecs)
    w = w % 2 === 0 ? w : w + 1;
    h = h % 2 === 0 ? h : h + 1;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;

    // Capture video from canvas
    const stream = canvas.captureStream(fps);

    // Capture audio directly from the video element's stream
    // This is more reliable than Web Audio API for preserving audio
    try {
      const videoElementStream = (video as HTMLVideoElement & { captureStream(): MediaStream }).captureStream();
      const audioTracks = videoElementStream.getAudioTracks();
      for (const track of audioTracks) {
        stream.addTrack(track);
      }
    } catch {
      // captureStream() not supported — proceed without audio
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    // Start from beginning
    video.currentTime = 0;
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });

    // Start recording + playback
    recorder.start(1000); // Flush chunks every second for memory efficiency
    try {
      await video.play();
    } catch {
      // Unmuted autoplay blocked — fall back to muted (audio will be lost)
      video.muted = true;
      await video.play();
    }

    // Draw frames using requestAnimationFrame
    let stopped = false;

    const drawFrame = () => {
      if (stopped) return;

      ctx.drawImage(video, 0, 0, w, h);

      // Report progress
      if (onProgress && totalDuration > 0) {
        onProgress(Math.min(video.currentTime / totalDuration, 1));
      }

      requestAnimationFrame(drawFrame);
    };
    requestAnimationFrame(drawFrame);

    // Wait for playback to end
    await new Promise<void>((resolve) => {
      video.onended = () => {
        stopped = true;
        recorder.stop();
        resolve();
      };

      // Safety timeout: stop after duration + 2s buffer
      setTimeout(() => {
        if (!stopped) {
          stopped = true;
          recorder.stop();
          video.pause();
          resolve();
        }
      }, (totalDuration + 2) * 1000);
    });

    // Wait for the recorder to flush
    await new Promise<void>((resolve) => {
      if (recorder.state === "inactive") {
        resolve();
        return;
      }
      recorder.onstop = () => resolve();
    });

    onProgress?.(1);

    const blob = new Blob(chunks, { type: mimeType });

    // If compressed version is larger, return original
    if (blob.size >= file.size) {
      return file;
    }

    const ext = mimeType.includes("webm") ? "webm" : "mp4";
    const originalName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${originalName}-compressed.${ext}`, { type: mimeType });
  } finally {
    URL.revokeObjectURL(videoUrl);
  }
}

function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  // Prefer MP4/H.264 — it's universally supported on all devices including iOS.
  // WebM (VP8/VP9) is NOT supported on iOS Safari/Chrome (WebKit), so if a
  // video is compressed in desktop Chrome (which picks VP9) and then played
  // on an iPhone, it will stutter or fail entirely.
  const candidates = [
    "video/mp4;codecs=avc1",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }

  return null;
}
