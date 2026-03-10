/**
 * Client-side video clip generator.
 *
 * Takes a video URL and generates a 5-second webm clip starting at ~50% of
 * the video duration.  Uses Canvas + MediaRecorder (no external deps).
 */

export interface ClipOptions {
  /** Max clip duration in seconds (default 5) */
  duration?: number;
  /** Max output width (default 480) */
  maxWidth?: number;
  /** Max output height (default 270) */
  maxHeight?: number;
  /** Frame rate (default 24) */
  fps?: number;
  /** Video bitrate in bps (default 500_000) */
  videoBitsPerSecond?: number;
}

const DEFAULTS: Required<ClipOptions> = {
  duration: 5,
  maxWidth: 1280,
  maxHeight: 720,
  fps: 30,
  videoBitsPerSecond: 2_500_000,
};

/**
 * Generate a short video clip from a source video URL.
 *
 * Returns a `File` (webm or mp4) or `null` if the browser doesn't support
 * MediaRecorder with a video codec.
 */
export async function generateVideoClip(
  videoUrl: string,
  opts?: ClipOptions,
): Promise<File | null> {
  const { duration, maxWidth, maxHeight, fps, videoBitsPerSecond } = {
    ...DEFAULTS,
    ...opts,
  };

  // Pick a supported MIME type
  const mimeType = getSupportedMimeType();
  if (!mimeType) return null;

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.src = videoUrl;

  // Wait for metadata so we know the duration + dimensions
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Failed to load video metadata"));
  });

  // Webm files from MediaRecorder often lack duration metadata (Infinity/NaN).
  // Workaround: seek to a huge value — the browser clamps to the real end,
  // giving us the actual duration.
  let videoDuration = video.duration;
  if (!isFinite(videoDuration) || videoDuration <= 0) {
    video.currentTime = 1e10; // seek to "end"
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    videoDuration = video.currentTime; // browser clamped to real duration
    if (videoDuration <= 0) return null;
  }

  // Calculate start time — centred around 50% of the video
  const halfClip = duration / 2;
  const midpoint = videoDuration * 0.5;
  const startTime = Math.max(0, midpoint - halfClip);
  const actualDuration = Math.min(duration, videoDuration - startTime);

  if (actualDuration <= 0) return null;

  // Seek to startTime
  video.currentTime = startTime;
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve();
  });

  // Calculate scaled dimensions (maintain aspect ratio)
  let w = video.videoWidth;
  let h = video.videoHeight;
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

  // Draw the first frame BEFORE starting the recorder so the canvas
  // stream already has pixel data.  Then start playback and wait for
  // the video to actually render a frame before we begin recording.
  ctx.drawImage(video, 0, 0, w, h);

  await video.play();

  // Wait until the video has rendered at least one frame (canplay +
  // one rAF to ensure the canvas draw loop will have real data).
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      ctx.drawImage(video, 0, 0, w, h);
      resolve();
    });
  });

  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  // Now start recording — canvas already has real pixel data
  recorder.start(100); // Request data every 100ms for more reliable output

  // Draw frames using requestAnimationFrame for smooth rendering
  let stopped = false;

  const drawFrame = () => {
    if (stopped) return;
    ctx.drawImage(video, 0, 0, w, h);
    requestAnimationFrame(drawFrame);
  };
  requestAnimationFrame(drawFrame);

  // Stop after `actualDuration` seconds
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      stopped = true;
      recorder.stop();
      video.pause();
      resolve();
    }, actualDuration * 1000);
  });

  // Wait for the recorder to flush
  await new Promise<void>((resolve) => {
    recorder.onstop = () => resolve();
  });

  const blob = new Blob(chunks, { type: mimeType });

  // Guard against corrupt/empty recordings (< 1 KB is not a valid clip)
  if (blob.size < 1024) return null;

  const ext = mimeType.includes("webm") ? "webm" : "mp4";
  return new File([blob], `clip.${ext}`, { type: mimeType });
}

function getSupportedMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;

  const candidates = [
    "video/webm;codecs=vp8",
    "video/webm;codecs=vp9",
    "video/webm",
    "video/mp4",
  ];

  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }

  return null;
}
