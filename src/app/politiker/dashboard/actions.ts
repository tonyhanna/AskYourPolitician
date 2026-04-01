"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { users, accounts, sessions, politicians, questions, questionTags, upvotes, citizens, answerHistory, causes, questionSuggestions, parties } from "@/db/schema";
import { sendAnswerNotificationEmail, sendSuggestionApprovedEmail, sendSuggestionRejectedEmail } from "@/lib/email";
import { eq, and, sql, inArray } from "drizzle-orm";
import { generateSlug } from "@/lib/utils";
import { isBlobUrl } from "@/lib/answer-utils";
import { del } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { getActivePolitician } from "@/lib/admin";
import { checkAndNotifyGoalReached } from "@/lib/goal-check";
import { createDirectUpload, deleteMuxAsset } from "@/lib/mux";

export async function createQuestion(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Opret venligst dine indstillinger først");

  const text = formData.get("text") as string;
  const tagsRaw = formData.get("tags") as string;
  const upvoteGoal = parseInt(formData.get("upvoteGoal") as string) || 1000;

  if (!text || text.length > 300) throw new Error("Ugyldigt spørgsmål");

  const [question] = await db
    .insert(questions)
    .values({
      politicianId: politician.id,
      text,
      upvoteGoal,
    })
    .returning();

  if (tagsRaw) {
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) {
      await db
        .insert(questionTags)
        .values(tags.map((tag) => ({ questionId: question.id, tag })));
    }
  }

  revalidatePath("/politiker/dashboard");
}

export async function updateSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const firstName = (formData.get("firstName") as string)?.trim() || "";
  const middleName = (formData.get("middleName") as string)?.trim() || null;
  const lastName = (formData.get("lastName") as string)?.trim() || "";
  const name = [firstName, middleName, lastName].filter(Boolean).join(" ");
  const partyId = formData.get("partyId") as string;
  const email = formData.get("email") as string;
  const profilePhotoUrl = (formData.get("profilePhotoUrl") as string) || null;
  const bannerUrl = (formData.get("bannerUrl") as string) || null;
  const ogImageUrl = (formData.get("ogImageUrl") as string) || null;
  const bannerBgColor = (formData.get("bannerBgColor") as string)?.trim() || null;
  const constituency = (formData.get("constituency") as string)?.trim() || null;
  const heroLine1 = (formData.get("heroLine1") as string)?.trim() || null;
  const heroLine1Color = (formData.get("heroLine1Color") as string)?.trim() || null;
  const heroLine2 = (formData.get("heroLine2") as string)?.trim() || null;
  const heroLine2Color = (formData.get("heroLine2Color") as string)?.trim() || null;
  const chatbaseId = (formData.get("chatbaseId") as string)?.trim() || null;
  const defaultUpvoteGoal = parseInt(formData.get("defaultUpvoteGoal") as string) || 1000;
  if (!firstName || !lastName || !partyId || !email) throw new Error("Fornavn, efternavn, parti og email er påkrævet");

  // Look up party record
  const [partyRecord] = await db
    .select()
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);

  if (!partyRecord) throw new Error("Parti ikke fundet");

  const slug = generateSlug(name);

  const politician = await getActivePolitician();

  if (politician) {
    // Collect old blob URLs to delete when replaced
    const oldBlobUrls: string[] = [];
    if (politician.bannerUrl && politician.bannerUrl !== bannerUrl && isBlobUrl(politician.bannerUrl)) {
      oldBlobUrls.push(politician.bannerUrl);
    }
    if (politician.profilePhotoUrl && politician.profilePhotoUrl !== profilePhotoUrl && isBlobUrl(politician.profilePhotoUrl)) {
      oldBlobUrls.push(politician.profilePhotoUrl);
    }
    if (politician.ogImageUrl && politician.ogImageUrl !== ogImageUrl && isBlobUrl(politician.ogImageUrl)) {
      oldBlobUrls.push(politician.ogImageUrl);
    }

    await db
      .update(politicians)
      .set({
        name,
        firstName,
        middleName,
        lastName,
        slug,
        party: partyRecord.name,
        partySlug: partyRecord.slug,
        partyId: partyRecord.id,
        email,
        constituency,
        profilePhotoUrl,
        bannerUrl,
        ogImageUrl,
        bannerBgColor,
        heroLine1,
        heroLine1Color,
        heroLine2,
        heroLine2Color,
        chatbaseId,
        defaultUpvoteGoal,
        updatedAt: new Date(),
      })
      .where(eq(politicians.id, politician.id));

    // If email changed: sync to auth user, remove old Google account link
    // (so they must re-authenticate with the new Google account), and
    // invalidate all sessions to force re-login.
    if (email !== politician.email) {
      await db
        .update(users)
        .set({ email })
        .where(eq(users.id, politician.userId));
      await db
        .delete(accounts)
        .where(eq(accounts.userId, politician.userId));
      await db
        .delete(sessions)
        .where(eq(sessions.userId, politician.userId));
    }

    // Clean up old blobs (fire-and-forget)
    if (oldBlobUrls.length > 0) {
      del(oldBlobUrls).catch(() => {});
    }
  } else {
    // Only admins can create politician profiles (via /admin)
    throw new Error("Ingen politikerprofil fundet. Kontakt en administrator.");
  }

  revalidatePath("/politiker/dashboard");
}

export async function editQuestion(formData: FormData): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const questionId = formData.get("questionId") as string;
  const text = formData.get("text") as string;
  const tagsRaw = formData.get("tags") as string;
  const upvoteGoal = parseInt(formData.get("upvoteGoal") as string) || 1000;

  if (!text || text.length > 300) return { error: "Ugyldigt spørgsmål" };

  const politician = await getActivePolitician();
  if (!politician) return { error: "Politician not found" };

  // Only edit if upvoteCount is 0
  const [question] = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id),
        eq(questions.upvoteCount, 0)
      )
    )
    .limit(1);

  if (!question) return { error: "Spørgsmålet kan ikke redigeres, da det allerede har fået upvotes" };

  await db
    .update(questions)
    .set({ text, upvoteGoal })
    .where(eq(questions.id, questionId));

  // Replace tags
  await db.delete(questionTags).where(eq(questionTags.questionId, questionId));
  if (tagsRaw) {
    const tags = tagsRaw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length > 0) {
      await db
        .insert(questionTags)
        .values(tags.map((tag) => ({ questionId, tag })));
    }
  }

  revalidatePath("/politiker/dashboard");
  return {};
}

export async function deleteQuestion(questionId: string): Promise<{ error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized" };

  const politician = await getActivePolitician();
  if (!politician) return { error: "Politician not found" };

  // Fetch question + answer history to collect blob URLs + Mux assets before deleting
  const [question] = await db
    .select({ answerUrl: questions.answerUrl, answerPhotoUrl: questions.answerPhotoUrl, answerClipUrl: questions.answerClipUrl, muxAssetId: questions.muxAssetId })
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id),
        eq(questions.upvoteCount, 0)
      )
    )
    .limit(1);

  if (!question) return { error: "Spørgsmålet kan ikke slettes" };

  const history = await db
    .select({ answerUrl: answerHistory.answerUrl, answerPhotoUrl: answerHistory.answerPhotoUrl, answerClipUrl: answerHistory.answerClipUrl })
    .from(answerHistory)
    .where(eq(answerHistory.questionId, questionId));

  // Collect all blob URLs to delete
  const blobUrls: string[] = [];
  for (const entry of [question, ...history]) {
    if (entry.answerUrl && isBlobUrl(entry.answerUrl)) blobUrls.push(entry.answerUrl);
    if (entry.answerPhotoUrl && isBlobUrl(entry.answerPhotoUrl)) blobUrls.push(entry.answerPhotoUrl);
    if (entry.answerClipUrl && isBlobUrl(entry.answerClipUrl)) blobUrls.push(entry.answerClipUrl);
  }

  // Delete question (cascades to tags, upvotes, history, etc.)
  await db
    .delete(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id),
        eq(questions.upvoteCount, 0)
      )
    );

  // Clean up blob storage (fire-and-forget, don't block on failure)
  if (blobUrls.length > 0) {
    del(blobUrls).catch(() => {});
  }

  // Clean up Mux asset
  if (question.muxAssetId) {
    deleteMuxAsset(question.muxAssetId).catch(() => {});
  }

  revalidatePath("/politiker/dashboard");
  return {};
}

export async function submitAnswerUrl(questionId: string, answerUrl: string, photoUrl?: string, duration?: number, aspectRatio?: number, clipUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (!answerUrl || !isBlobUrl(answerUrl)) {
    throw new Error("Ugyldig fil-URL");
  }

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [question] = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id),
        eq(questions.goalReachedEmailSent, true)
      )
    )
    .limit(1);

  if (!question) throw new Error("Spørgsmålet har ikke nået sit upvote-mål endnu og kan ikke besvares");

  const isUpdate = !!question.answerUrl;

  // Clean up old blob files when editing an existing answer
  // Skip poster blob if it's being kept (same URL reused)
  if (isUpdate) {
    const keepingPoster = photoUrl && photoUrl === question.answerPhotoUrl;
    const oldBlobUrls = [
      question.answerUrl,
      keepingPoster ? null : question.answerPhotoUrl,
      question.answerClipUrl,
    ].filter((url): url is string => !!url && isBlobUrl(url));
    if (oldBlobUrls.length > 0) del(oldBlobUrls).catch(() => {});
  }

  if (isUpdate) {
    // Update existing answer_history entry with the new URLs
    await db
      .update(answerHistory)
      .set({
        answerUrl,
        answerPhotoUrl: photoUrl ?? null,
        answerClipUrl: clipUrl ?? null,
        answerDuration: duration ?? null,
        answerAspectRatio: aspectRatio ?? null,
      })
      .where(eq(answerHistory.questionId, questionId));
  } else {
    await db.insert(answerHistory).values({
      questionId,
      answerUrl,
      answerPhotoUrl: photoUrl ?? null,
      answerClipUrl: clipUrl ?? null,
      answerDuration: duration ?? null,
      answerAspectRatio: aspectRatio ?? null,
    });
  }

  await db
    .update(questions)
    .set({ answerUrl, answerPhotoUrl: photoUrl ?? null, answerClipUrl: clipUrl ?? null, answerDuration: duration ?? null, answerAspectRatio: aspectRatio ?? null, deadlineMissed: false })
    .where(eq(questions.id, questionId));

  const upvoters = await db
    .select({
      firstName: citizens.firstName,
      email: citizens.email,
    })
    .from(upvotes)
    .innerJoin(citizens, eq(upvotes.citizenId, citizens.id))
    .where(eq(upvotes.questionId, questionId));

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const questionPageUrl = `${appUrl}/${politician.partySlug}/${politician.slug}/q/${questionId}`;

  await Promise.allSettled(
    upvoters.map((citizen) =>
      sendAnswerNotificationEmail({
        to: citizen.email,
        firstName: citizen.firstName,
        politicianName: politician.name,
        partyName: politician.party,
        questionText: question.text,
        answerUrl: questionPageUrl,
        isUpdate,
      })
    )
  );

  // NOTE: Do NOT revalidate /politiker/dashboard here — it resets client-side
  // state (submitStep) mid-flow, causing the UI to flash "Svar indsendt" before
  // clip generation finishes.  The dashboard is revalidated later by
  // submitAnswerClipUrl once the full flow (answer + clip) is complete.
  revalidatePath(`/${politician.partySlug}/${politician.slug}`);
}

export async function submitAnswerClipUrl(questionId: string, clipUrl: string, posterUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (!clipUrl || !isBlobUrl(clipUrl)) {
    throw new Error("Ugyldig clip-URL");
  }

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id)
      )
    )
    .limit(1);

  if (!question) throw new Error("Spørgsmål ikke fundet");

  // Update clip URL (and poster if provided) on question
  const updateData: Record<string, string> = { answerClipUrl: clipUrl };
  if (posterUrl && isBlobUrl(posterUrl)) {
    updateData.answerPhotoUrl = posterUrl;
  }

  await db
    .update(questions)
    .set(updateData)
    .where(eq(questions.id, questionId));

  // Update the latest answer history entry
  const [latestHistory] = await db
    .select({ id: answerHistory.id })
    .from(answerHistory)
    .where(eq(answerHistory.questionId, questionId))
    .orderBy(sql`${answerHistory.createdAt} DESC`)
    .limit(1);

  if (latestHistory) {
    const historyUpdate: Record<string, string> = { answerClipUrl: clipUrl };
    if (posterUrl && isBlobUrl(posterUrl)) {
      historyUpdate.answerPhotoUrl = posterUrl;
    }
    await db
      .update(answerHistory)
      .set(historyUpdate)
      .where(eq(answerHistory.id, latestHistory.id));
  }

  revalidatePath("/politiker/dashboard");
  revalidatePath(`/${politician.partySlug}/${politician.slug}`);
}

/** Update only the poster for an existing answer (no new video). */
export async function updateAnswerPoster(questionId: string, posterUrl: string | null, clipUrl?: string, autoPosterUrl?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [question] = await db
    .select({
      id: questions.id,
      answerUrl: questions.answerUrl,
      answerPhotoUrl: questions.answerPhotoUrl,
      answerClipUrl: questions.answerClipUrl,
      muxAssetStatus: questions.muxAssetStatus,
    })
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id)
      )
    )
    .limit(1);

  if (!question || (!question.answerUrl && !question.muxAssetStatus)) throw new Error("Spørgsmål eller svar ikke fundet");

  // Delete old poster + clip blobs
  const oldBlobUrls = [question.answerPhotoUrl, question.answerClipUrl]
    .filter((url): url is string => !!url && isBlobUrl(url));
  if (oldBlobUrls.length > 0) del(oldBlobUrls).catch(() => {});

  // Update question
  // When removing poster and regenerating clip: posterUrl=null, but use autoPosterUrl + clipUrl from clip generation
  const finalPhotoUrl = posterUrl ?? autoPosterUrl ?? null;
  const finalClipUrl = clipUrl ?? null;
  await db
    .update(questions)
    .set({ answerPhotoUrl: finalPhotoUrl, answerClipUrl: finalClipUrl })
    .where(eq(questions.id, questionId));

  // Update latest answer_history entry
  const [latestHistory] = await db
    .select({ id: answerHistory.id })
    .from(answerHistory)
    .where(eq(answerHistory.questionId, questionId))
    .orderBy(sql`${answerHistory.createdAt} DESC`)
    .limit(1);

  if (latestHistory) {
    await db
      .update(answerHistory)
      .set({ answerPhotoUrl: finalPhotoUrl, answerClipUrl: finalClipUrl })
      .where(eq(answerHistory.id, latestHistory.id));
  }

  revalidatePath("/politiker/dashboard");
  revalidatePath(`/${politician.partySlug}/${politician.slug}`);
}

export async function togglePinQuestion(questionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  // Verify question belongs to this politician
  const [question] = await db
    .select({ id: questions.id, pinned: questions.pinned })
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id)
      )
    )
    .limit(1);

  if (!question) throw new Error("Spørgsmål ikke fundet");

  const newPinned = !question.pinned;

  // Only one question can be pinned at a time — unpin all others first
  if (newPinned) {
    await db
      .update(questions)
      .set({ pinned: false })
      .where(
        and(
          eq(questions.politicianId, politician.id),
          eq(questions.pinned, true)
        )
      );
  }

  await db
    .update(questions)
    .set({ pinned: newPinned })
    .where(eq(questions.id, questionId));

  revalidatePath("/politiker/dashboard");
  revalidatePath(`/${politician.partySlug}/${politician.slug}`);
}

export async function createCause(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Opret venligst dine indstillinger først");

  const title = formData.get("title") as string;
  const shortDescription = formData.get("shortDescription") as string;
  const longDescription = (formData.get("longDescription") as string) || null;
  const videoUrl = (formData.get("videoUrl") as string) || null;
  const points = (formData.get("points") as string) || null;
  const tagId = formData.get("tagId") as string;

  if (!title || title.length > 300) throw new Error("Ugyldig overskrift");
  if (!shortDescription) throw new Error("Kort beskrivelse er påkrævet");
  if (!tagId || tagId.length > 100) throw new Error("Ugyldig tag titel");

  const [existing] = await db
    .select()
    .from(causes)
    .where(and(eq(causes.politicianId, politician.id), eq(causes.tagId, tagId)))
    .limit(1);

  if (existing) throw new Error("Tag titel er allerede i brug");

  // Get max sortOrder for this politician
  const [maxOrder] = await db
    .select({ max: sql<number>`COALESCE(MAX(${causes.sortOrder}), -1)` })
    .from(causes)
    .where(eq(causes.politicianId, politician.id));

  await db.insert(causes).values({
    politicianId: politician.id,
    title,
    shortDescription,
    longDescription,
    videoUrl,
    points,
    tagId,
    slug: generateSlug(tagId),
    sortOrder: (maxOrder?.max ?? -1) + 1,
  });

  revalidatePath("/politiker/dashboard");
}

export async function editCause(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const causeId = formData.get("causeId") as string;
  const title = formData.get("title") as string;
  const shortDescription = formData.get("shortDescription") as string;
  const longDescription = (formData.get("longDescription") as string) || null;
  const videoUrl = (formData.get("videoUrl") as string) || null;
  const points = (formData.get("points") as string) || null;
  const tagId = formData.get("tagId") as string;

  if (!title || title.length > 300) throw new Error("Ugyldig overskrift");
  if (!shortDescription) throw new Error("Kort beskrivelse er påkrævet");
  if (!tagId || tagId.length > 100) throw new Error("Ugyldig tag titel");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [duplicate] = await db
    .select()
    .from(causes)
    .where(
      and(
        eq(causes.politicianId, politician.id),
        eq(causes.tagId, tagId),
        sql`${causes.id} != ${causeId}`
      )
    )
    .limit(1);

  if (duplicate) throw new Error("Tag titel er allerede i brug");

  const [oldCause] = await db
    .select({ tagId: causes.tagId })
    .from(causes)
    .where(and(eq(causes.id, causeId), eq(causes.politicianId, politician.id)))
    .limit(1);

  if (!oldCause) throw new Error("Mærkesag ikke fundet");

  await db
    .update(causes)
    .set({ title, shortDescription, longDescription, videoUrl, points, tagId, slug: generateSlug(tagId) })
    .where(eq(causes.id, causeId));

  if (oldCause.tagId !== tagId) {
    const politicianQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.politicianId, politician.id));

    if (politicianQuestions.length > 0) {
      const questionIds = politicianQuestions.map((q) => q.id);
      await db
        .update(questionTags)
        .set({ tag: tagId })
        .where(
          and(
            inArray(questionTags.questionId, questionIds),
            eq(questionTags.tag, oldCause.tagId)
          )
        );
    }
  }

  revalidatePath("/politiker/dashboard");
}

export async function deleteCause(causeId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [cause] = await db
    .select()
    .from(causes)
    .where(and(eq(causes.id, causeId), eq(causes.politicianId, politician.id)))
    .limit(1);

  if (!cause) throw new Error("Mærkesag ikke fundet");

  const politicianQuestions = await db
    .select({ id: questions.id })
    .from(questions)
    .where(eq(questions.politicianId, politician.id));

  if (politicianQuestions.length > 0) {
    const questionIds = politicianQuestions.map((q) => q.id);
    const [inUse] = await db
      .select()
      .from(questionTags)
      .where(
        and(
          inArray(questionTags.questionId, questionIds),
          eq(questionTags.tag, cause.tagId)
        )
      )
      .limit(1);

    if (inUse) throw new Error("Mærkesagen er tilknyttet et spørgsmål og kan ikke slettes");
  }

  await db.delete(causes).where(eq(causes.id, causeId));

  revalidatePath("/politiker/dashboard");
}

export async function reorderCauses(orderedIds: string[]) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  await Promise.all(
    orderedIds.map((id, index) =>
      db
        .update(causes)
        .set({ sortOrder: index })
        .where(and(eq(causes.id, id), eq(causes.politicianId, politician.id)))
    )
  );

  revalidatePath("/politiker/dashboard");
}

export async function approveSuggestion(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const suggestionId = formData.get("suggestionId") as string;
  const upvoteGoal = parseInt(formData.get("upvoteGoal") as string) || 1000;
  const tagsRaw = formData.get("tags") as string;
  const editedText = (formData.get("editedText") as string)?.trim();
  const editReason = (formData.get("editReason") as string)?.trim() || undefined;

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [suggestion] = await db
    .select()
    .from(questionSuggestions)
    .where(
      and(
        eq(questionSuggestions.id, suggestionId),
        eq(questionSuggestions.politicianId, politician.id),
        eq(questionSuggestions.status, "pending")
      )
    )
    .limit(1);

  if (!suggestion) throw new Error("Forslag ikke fundet");

  // Create the question from the suggestion (use edited text if provided)
  const questionText = editedText || suggestion.text;
  const wasEdited = editReason && questionText !== suggestion.text;

  const [question] = await db
    .insert(questions)
    .values({
      politicianId: politician.id,
      text: questionText,
      upvoteGoal,
      suggestedByCitizenId: suggestion.citizenId,
    })
    .returning();

  // Add tags if any
  if (tagsRaw) {
    const tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    if (tags.length > 0) {
      await db
        .insert(questionTags)
        .values(tags.map((tag) => ({ questionId: question.id, tag })));
    }
  }

  // Auto-upvote by the suggesting citizen
  await db.insert(upvotes).values({
    questionId: question.id,
    citizenId: suggestion.citizenId,
  });
  await db
    .update(questions)
    .set({ upvoteCount: sql`${questions.upvoteCount} + 1` })
    .where(eq(questions.id, question.id));

  // Check if goal is already reached (e.g. upvoteGoal = 1)
  await checkAndNotifyGoalReached(question.id);

  // Update suggestion status
  await db
    .update(questionSuggestions)
    .set({ status: "approved" })
    .where(eq(questionSuggestions.id, suggestionId));

  // Send email to citizen
  const [citizen] = await db
    .select()
    .from(citizens)
    .where(eq(citizens.id, suggestion.citizenId))
    .limit(1);

  if (citizen) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    const questionUrl = `${appUrl}/${politician.partySlug}/${politician.slug}/q/${question.id}`;
    await sendSuggestionApprovedEmail({
      to: citizen.email,
      firstName: citizen.firstName,
      politicianName: politician.name,
      partyName: politician.party,
      questionText: questionText,
      questionUrl,
      ...(wasEdited ? { originalText: suggestion.text, editReason } : {}),
    });
  }

  revalidatePath("/politiker/dashboard");
  revalidatePath(`/${politician.partySlug}/${politician.slug}`);
}

const REJECTION_REASONS: Record<string, string> = {
  already_answered: "Jeg har allerede svaret på det spørgsmål",
  duplicate: "Dit spørgsmål ligner et eksisterende spørgsmål",
};

export async function rejectSuggestion(suggestionId: string, reason: string, link?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [suggestion] = await db
    .select()
    .from(questionSuggestions)
    .where(
      and(
        eq(questionSuggestions.id, suggestionId),
        eq(questionSuggestions.politicianId, politician.id),
        eq(questionSuggestions.status, "pending")
      )
    )
    .limit(1);

  if (!suggestion) throw new Error("Forslag ikke fundet");

  // Map standard reason or use custom text
  const rejectionText = REJECTION_REASONS[reason] ?? reason;

  await db
    .update(questionSuggestions)
    .set({ status: "rejected", rejectionReason: rejectionText })
    .where(eq(questionSuggestions.id, suggestionId));

  // Send rejection email
  const [citizen] = await db
    .select()
    .from(citizens)
    .where(eq(citizens.id, suggestion.citizenId))
    .limit(1);

  if (citizen) {
    await sendSuggestionRejectedEmail({
      to: citizen.email,
      firstName: citizen.firstName,
      politicianName: politician.name,
      partyName: politician.party,
      questionText: suggestion.text,
      reason: rejectionText,
      link: link || undefined,
    });
  }

  revalidatePath("/politiker/dashboard");
}

export async function verifyQuestionLink(url: string): Promise<{ valid: boolean; questionText?: string }> {
  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split("/").filter(Boolean);

    // Expected: /{partySlug}/{politicianSlug}/q/{questionId}
    const qIndex = segments.indexOf("q");
    if (qIndex === -1 || qIndex + 1 >= segments.length) {
      return { valid: false };
    }

    const questionId = segments[qIndex + 1];

    const [question] = await db
      .select({ text: questions.text })
      .from(questions)
      .where(eq(questions.id, questionId))
      .limit(1);

    if (!question) return { valid: false };

    return { valid: true, questionText: question.text };
  } catch {
    return { valid: false };
  }
}

export async function revalidateDashboard() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  revalidatePath("/politiker/dashboard");
}

/** Delete a blob URL uploaded by the current politician (fire-and-forget). */
export async function deleteBlobUrl(url: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  if (!url || !isBlobUrl(url)) return;
  del(url).catch(() => {});
}

// ── Mux Integration ───────────────────────────────────────────────────

/**
 * Check if a Mux answer is ready (for dashboard polling).
 * Returns the current muxAssetStatus.
 */
export async function checkMuxAnswerStatus(questionId: string): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [question] = await db
    .select({ muxAssetStatus: questions.muxAssetStatus })
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  return question?.muxAssetStatus ?? null;
}

/**
 * Create a Mux direct upload URL.
 * The client PUTs the raw file directly to Mux — no server proxy needed.
 */
export async function getMuxUploadUrl(questionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  // Verify the question belongs to this politician and has reached its goal
  const [question] = await db
    .select({ id: questions.id })
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id),
        eq(questions.goalReachedEmailSent, true)
      )
    )
    .limit(1);

  if (!question) throw new Error("Spørgsmålet har ikke nået sit upvote-mål endnu");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:4000";
  const { uploadUrl, uploadId } = await createDirectUpload(questionId, appUrl);

  return { uploadUrl, uploadId };
}

/**
 * Submit a Mux-based answer. Called after the client has uploaded to Mux.
 * Sets muxAssetStatus = "preparing" — the webhook will update it to "ready".
 */
export async function submitMuxAnswer(
  questionId: string,
  mediaType: "video" | "audio",
  posterUrl?: string,
  duration?: number,
  aspectRatio?: number,
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const politician = await getActivePolitician();
  if (!politician) throw new Error("Politician not found");

  const [question] = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id),
        eq(questions.goalReachedEmailSent, true)
      )
    )
    .limit(1);

  if (!question) throw new Error("Spørgsmålet har ikke nået sit upvote-mål endnu");

  const isUpdate = !!(question.answerUrl || question.muxAssetId);

  // Clean up old assets
  if (isUpdate) {
    // Delete old Mux asset
    if (question.muxAssetId) {
      deleteMuxAsset(question.muxAssetId).catch(() => {});
    }
    // Delete old blob URLs (video, clip — NOT poster if it's being reused)
    const keepingPoster = posterUrl && posterUrl === question.answerPhotoUrl;
    const oldBlobUrls = [
      question.answerUrl,
      keepingPoster ? null : question.answerPhotoUrl,
      question.answerClipUrl,
    ].filter((url): url is string => !!url && isBlobUrl(url));
    if (oldBlobUrls.length > 0) del(oldBlobUrls).catch(() => {});
  }

  // Update question — clear blob URLs, set Mux status to preparing, increment update count if replacing
  await db
    .update(questions)
    .set({
      answerUrl: null,
      answerClipUrl: null,
      answerPhotoUrl: posterUrl ?? null,
      answerDuration: duration ?? null,
      answerAspectRatio: aspectRatio ?? null,
      muxAssetStatus: "preparing",
      muxMediaType: mediaType,
      muxPlaybackId: null,
      muxAssetId: null,
      deadlineMissed: false,
      ...(isUpdate ? { answerUpdateCount: sql`answer_update_count + 1` } : {}),
    })
    .where(eq(questions.id, questionId));

  // NOTE: Notification emails are sent from the Mux webhook when the asset is ready,
  // so citizens only get notified when the video/audio is actually playable.

  revalidatePath("/politiker/dashboard");
}
