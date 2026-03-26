import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, answerHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

// Mux webhook types we care about
type MuxWebhookEvent = {
  type: string;
  data: {
    id: string;
    upload_id?: string;
    passthrough?: string;
    playback_ids?: { id: string; policy: string }[];
    duration?: number;
    aspect_ratio?: string;
    status?: string;
    tracks?: { type: string; max_width?: number; max_height?: number }[];
  };
};

/**
 * Mux sends webhooks when uploads complete and assets become ready.
 *
 * Events we handle:
 * - video.upload.asset_created: Upload completed, asset created. We store the asset ID.
 * - video.asset.ready: Transcoding complete. We store the playback ID, duration, aspect ratio.
 * - video.asset.errored: Transcoding failed. We mark the status as errored.
 */
export async function POST(req: NextRequest) {
  // Verify webhook signature if secret is configured
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get("mux-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    // TODO: Implement proper HMAC verification with mux-signature header
    // For now, we rely on the webhook URL being secret
  }

  const event: MuxWebhookEvent = await req.json();

  switch (event.type) {
    case "video.upload.asset_created": {
      // The upload completed and Mux created an asset.
      // Find the question via passthrough (question ID).
      const passthrough = event.data.passthrough;
      if (!passthrough) break;

      const assetId = event.data.id;

      await db
        .update(questions)
        .set({ muxAssetId: assetId })
        .where(eq(questions.id, passthrough));

      // Also update answer_history
      await db
        .update(answerHistory)
        .set({ muxAssetId: assetId })
        .where(eq(answerHistory.questionId, passthrough));

      break;
    }

    case "video.asset.ready": {
      // Transcoding complete. Extract playback ID, duration, aspect ratio.
      const assetId = event.data.id;
      const playbackId = event.data.playback_ids?.[0]?.id;
      const duration = event.data.duration;
      const aspectRatioStr = event.data.aspect_ratio; // e.g. "9:16"

      let aspectRatio: number | undefined;
      if (aspectRatioStr) {
        const [w, h] = aspectRatioStr.split(":").map(Number);
        if (w && h) aspectRatio = w / h;
      }

      // Determine media type from tracks
      const tracks = event.data.tracks || [];
      const hasVideo = tracks.some((t) => t.type === "video");
      const mediaType = hasVideo ? "video" : "audio";

      // Update questions table
      const [updatedQuestion] = await db
        .update(questions)
        .set({
          muxPlaybackId: playbackId,
          muxAssetStatus: "ready",
          muxMediaType: mediaType,
          answerDuration: duration,
          answerAspectRatio: aspectRatio,
        })
        .where(eq(questions.muxAssetId, assetId))
        .returning({
          id: questions.id,
          politicianId: questions.politicianId,
        });

      // Update answer_history
      await db
        .update(answerHistory)
        .set({
          muxPlaybackId: playbackId,
          muxAssetStatus: "ready",
          muxMediaType: mediaType,
          answerDuration: duration,
          answerAspectRatio: aspectRatio,
        })
        .where(eq(answerHistory.muxAssetId, assetId));

      // Revalidate pages so the citizen side picks up the ready asset
      if (updatedQuestion) {
        // We need politician slug and party slug for revalidation.
        // Fetch them from the politician table.
        const result = await db.execute<{ slug: string; party_slug: string }>(
          `SELECT p.slug, pa.slug as party_slug FROM politicians p JOIN parties pa ON p.party_id = pa.id WHERE p.id = '${updatedQuestion.politicianId}'`
        );
        const row = (result as unknown as { slug: string; party_slug: string }[])?.[0];
        if (row) {
          revalidatePath(`/${row.party_slug}/${row.slug}`);
          revalidatePath(`/${row.party_slug}/${row.slug}/q/${updatedQuestion.id}`);
        }
      }

      break;
    }

    case "video.asset.errored": {
      const assetId = event.data.id;

      await db
        .update(questions)
        .set({ muxAssetStatus: "errored" })
        .where(eq(questions.muxAssetId, assetId));

      await db
        .update(answerHistory)
        .set({ muxAssetStatus: "errored" })
        .where(eq(answerHistory.muxAssetId, assetId));

      break;
    }
  }

  return NextResponse.json({ received: true });
}
