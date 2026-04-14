import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { questions, answerHistory, upvotes, citizens, politicians, parties, politicianMedia } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { sendAnswerNotificationEmail } from "@/lib/email";

/**
 * Mux webhook handler.
 *
 * We primarily use `video.asset.ready` which fires when transcoding is complete.
 * This event contains the asset's `passthrough` field (our question ID),
 * playback IDs, duration, and aspect ratio — everything we need.
 *
 * `video.asset.errored` handles transcoding failures.
 */
export async function POST(req: NextRequest) {
  // Basic webhook secret check (header presence)
  const webhookSecret = process.env.MUX_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers.get("mux-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    // TODO: Implement full HMAC verification
  }

  let event: { type: string; data: Record<string, unknown> };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type;
  const data = event.data;

  if (eventType === "video.asset.ready") {
    const assetId = data.id as string;
    const passthrough = data.passthrough as string | undefined;
    const playbackIds = data.playback_ids as { id: string; policy: string }[] | undefined;
    const playbackId = playbackIds?.[0]?.id;
    const duration = data.duration as number | undefined;
    const aspectRatioStr = data.aspect_ratio as string | undefined;
    const tracks = data.tracks as { type: string }[] | undefined;

    let aspectRatio: number | undefined;
    if (aspectRatioStr) {
      const [w, h] = aspectRatioStr.split(":").map(Number);
      if (w && h) aspectRatio = w / h;
    }

    const hasVideo = tracks?.some((t) => t.type === "video");
    const mediaType = hasVideo ? "video" : "audio";

    // Check if this is a politician media item (passthrough = "media:{mediaId}")
    if (passthrough?.startsWith("media:")) {
      const mediaId = passthrough.slice(6);
      const [media] = await db
        .update(politicianMedia)
        .set({
          muxAssetId: assetId,
          muxPlaybackId: playbackId,
          muxAssetStatus: "ready",
          muxMediaType: mediaType,
          duration,
          aspectRatio,
        })
        .where(eq(politicianMedia.id, mediaId))
        .returning({ politicianId: politicianMedia.politicianId });

      if (media) {
        const [politician] = await db
          .select({ slug: politicians.slug, partySlug: parties.slug })
          .from(politicians)
          .innerJoin(parties, eq(politicians.partyId, parties.id))
          .where(eq(politicians.id, media.politicianId))
          .limit(1);
        if (politician) {
          revalidatePath(`/${politician.partySlug}/${politician.slug}`);
          revalidatePath("/politiker/dashboard");
        }
      }
      return NextResponse.json({ received: true });
    }

    // Find question by passthrough (question ID) or by muxAssetId
    let questionId = passthrough;

    if (!questionId) {
      // Fallback: look up by asset ID if passthrough is missing
      const [q] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.muxAssetId, assetId))
        .limit(1);
      questionId = q?.id;
    }

    if (!questionId) {
      console.error("Mux webhook: could not find question for asset", assetId);
      return NextResponse.json({ received: true });
    }

    // Update questions table
    const [updatedQuestion] = await db
      .update(questions)
      .set({
        muxAssetId: assetId,
        muxPlaybackId: playbackId,
        muxAssetStatus: "ready",
        muxMediaType: mediaType,
        answerDuration: duration,
        answerAspectRatio: aspectRatio,
        deadlineMissed: false,
      })
      .where(eq(questions.id, questionId))
      .returning({
        id: questions.id,
        politicianId: questions.politicianId,
      });

    // Update answer_history
    await db
      .update(answerHistory)
      .set({
        muxAssetId: assetId,
        muxPlaybackId: playbackId,
        muxAssetStatus: "ready",
        muxMediaType: mediaType,
        answerDuration: duration,
        answerAspectRatio: aspectRatio,
      })
      .where(eq(answerHistory.questionId, questionId));

    // Revalidate pages + send notification emails
    if (updatedQuestion) {
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

        // Determine if this is an update (answerUpdateCount > 0)
        const [questionData] = await db
          .select({ answerUpdateCount: questions.answerUpdateCount })
          .from(questions)
          .where(eq(questions.id, updatedQuestion.id))
          .limit(1);
        const isUpdate = (questionData?.answerUpdateCount ?? 0) > 0;

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
              isUpdate,
            })
          )
        );
      }
    }
  } else if (eventType === "video.asset.errored") {
    const assetId = data.id as string;
    const passthrough = data.passthrough as string | undefined;

    if (passthrough?.startsWith("media:")) {
      const mediaId = passthrough.slice(6);
      await db
        .update(politicianMedia)
        .set({ muxAssetId: assetId, muxAssetStatus: "errored" })
        .where(eq(politicianMedia.id, mediaId));
    } else if (passthrough) {
      await db
        .update(questions)
        .set({ muxAssetId: assetId, muxAssetStatus: "errored" })
        .where(eq(questions.id, passthrough));

      await db
        .update(answerHistory)
        .set({ muxAssetId: assetId, muxAssetStatus: "errored" })
        .where(eq(answerHistory.questionId, passthrough));
    }
  }

  return NextResponse.json({ received: true });
}
