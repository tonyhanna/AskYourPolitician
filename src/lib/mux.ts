import Mux from "@mux/mux-node";

export const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID!,
  tokenSecret: process.env.MUX_TOKEN_SECRET!,
});

/**
 * Create a direct upload URL for the client to PUT a file to Mux.
 * `passthrough` is stored on the Mux upload and returned in webhooks,
 * so we can link the asset back to our question.
 */
export async function createDirectUpload(questionId: string, corsOrigin: string) {
  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: {
      playback_policy: ["public"],
      passthrough: questionId,
      static_renditions: [
        { resolution: "highest" },
      ],
    },
    // Upload expires after 1 hour
    timeout: 3600,
  });

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

/**
 * Create a direct upload URL for a guided tour video.
 * Passthrough uses `tour:{politicianId}` prefix so the webhook can route it.
 */
export async function createGuidedTourUpload(politicianId: string, corsOrigin: string) {
  const upload = await mux.video.uploads.create({
    cors_origin: corsOrigin,
    new_asset_settings: {
      playback_policy: ["public"],
      passthrough: `tour:${politicianId}`,
      static_renditions: [
        { resolution: "highest" },
      ],
    },
    timeout: 3600,
  });

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

/** HLS stream URL for a Mux playback ID */
export function getMuxStreamUrl(playbackId: string) {
  return `https://stream.mux.com/${playbackId}.m3u8`;
}

/** Static thumbnail URL */
export function getMuxThumbnailUrl(
  playbackId: string,
  opts?: { time?: number; width?: number; format?: "jpg" | "png" | "webp" }
) {
  const { time = 0, width = 600, format = "jpg" } = opts ?? {};
  return `https://image.mux.com/${playbackId}/thumbnail.${format}?time=${time}&width=${width}`;
}

/** Animated GIF URL for hover previews */
export function getMuxAnimatedGifUrl(
  playbackId: string,
  opts?: { start?: number; end?: number; width?: number; fps?: number }
) {
  const { start = 0, end = 6, width = 480, fps = 12 } = opts ?? {};
  return `https://image.mux.com/${playbackId}/animated.gif?start=${start}&end=${end}&width=${width}&fps=${fps}`;
}

/** Static MP4 rendition URL (for hover clips and fallback playback) */
export function getMuxMp4Url(playbackId: string) {
  return `https://stream.mux.com/${playbackId}/highest.mp4`;
}

/** Delete a Mux asset */
export async function deleteMuxAsset(assetId: string) {
  try {
    await mux.video.assets.delete(assetId);
  } catch (e) {
    // Asset may already be deleted — log but don't throw
    console.error("Failed to delete Mux asset:", assetId, e);
  }
}

/** Retrieve a Mux asset (for polling fallback) */
export async function getMuxAsset(assetId: string) {
  return mux.video.assets.retrieve(assetId);
}
