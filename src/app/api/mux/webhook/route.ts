import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, answerHistory, upvotes, citizens, politicians, parties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendAnswerNotificationEmail } from "@/lib/email";

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

      // Revalidate pages + send notification emails
      if (updatedQuestion) {
        // Fetch politician info for revalidation and emails
        const [politician] = await db
          .select({
            name: politicians.name,
            slug: politicians.slug,
            partySlug: parties.slug,
            partyName: parties.name,
          })
          .from(politicians)
          .innerJoin(parties, eq(politicians.partyId, parties.id))
          .where(eq(politicians.id, updatedQuestion.politicianId))
          .limit(1);

        if (politician) {
          revalidatePath(`/${politician.partySlug}/${politician.slug}`);
          revalidatePath(`/${politician.partySlug}/${politician.slug}/q/${updatedQuestion.id}`);
          revalidatePath("/politiker/dashboard");

          // Fetch question text for email
          const [q] = await db
            .select({ text: questions.text })
            .from(questions)
            .where(eq(questions.id, updatedQuestion.id))
            .limit(1);

          // Send notification emails to all upvoters
          const upvoterList = await db
            .select({ firstName: citizens.firstName, email: citizens.email })
            .from(upvotes)
            .innerJoin(citizens, eq(upvotes.citizenId, citizens.id))
            .where(eq(upvotes.questionId, updatedQuestion.id));

          const appUrl = process.env.NEXT_PUBLIC_APP_URL;
          const questionPageUrl = `${appUrl}/${politician.partySlug}/${politician.slug}/q/${updatedQuestion.id}`;

          await Promise.allSettled(
            upvoterList.map((citizen) =>
              sendAnswerNotificationEmail({
                to: citizen.email,
                firstName: citizen.firstName,
                politicianName: politician.name,
                partyName: politician.partyName,
                questionText: q?.text ?? "",
                answerUrl: questionPageUrl,
                isUpdate: false,
              })
            )
          );
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
