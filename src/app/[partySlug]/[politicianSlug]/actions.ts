"use server";

import { db } from "@/db";
import {
  citizens,
  upvotes,
  questions,
  verificationTokens,
  questionSuggestions,
  suggestionTokens,
  politicians,
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getCitizenFromSession, clearCitizenSession } from "@/lib/citizen-session";
import {
  sendVerificationEmail,
  sendSuggestionVerificationEmail,
  sendSuggestionReceivedEmail,
  sendNewSuggestionNotificationEmail,
} from "@/lib/email";
import { generateToken } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { checkAndNotifyGoalReached } from "@/lib/goal-check";

export async function submitUpvote(formData: FormData): Promise<{ error?: string }> {
  const firstName = formData.get("firstName") as string;
  const email = formData.get("email") as string;
  const questionId = formData.get("questionId") as string;
  const politicianSlug = formData.get("politicianSlug") as string;
  const partySlug = formData.get("partySlug") as string;

  if (!firstName || !email || !questionId || !politicianSlug || !partySlug) {
    return { error: "Alle felter er påkrævet" };
  }

  // Find or create citizen
  let [citizen] = await db
    .select()
    .from(citizens)
    .where(eq(citizens.email, email.toLowerCase()))
    .limit(1);

  if (!citizen) {
    [citizen] = await db
      .insert(citizens)
      .values({
        firstName,
        email: email.toLowerCase(),
      })
      .returning();
  }

  // Check if already upvoted
  const [existingUpvote] = await db
    .select()
    .from(upvotes)
    .where(
      and(eq(upvotes.questionId, questionId), eq(upvotes.citizenId, citizen.id))
    )
    .limit(1);

  if (existingUpvote) {
    return { error: "Du har allerede upvotet dette spørgsmål" };
  }

  // Get the question text for the email
  const [question] = await db
    .select()
    .from(questions)
    .where(eq(questions.id, questionId))
    .limit(1);

  if (!question) return { error: "Spørgsmål ikke fundet" };

  // Create verification token
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await db.insert(verificationTokens).values({
    token,
    citizenId: citizen.id,
    questionId,
    politicianSlug,
    partySlug,
    expiresAt,
  });

  // Send verification email
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/verify/${token}`;
  await sendVerificationEmail({
    to: email.toLowerCase(),
    firstName,
    questionText: question.text,
    verificationUrl,
  });

  return {};
}

export async function directUpvote(
  questionId: string,
  partySlug: string,
  politicianSlug: string
) {
  const citizen = await getCitizenFromSession();
  if (!citizen) throw new Error("Du er ikke logget ind");

  const [existingUpvote] = await db
    .select()
    .from(upvotes)
    .where(
      and(eq(upvotes.questionId, questionId), eq(upvotes.citizenId, citizen.id))
    )
    .limit(1);

  if (existingUpvote) throw new Error("Du har allerede upvotet dette spørgsmål");

  await db.insert(upvotes).values({
    questionId,
    citizenId: citizen.id,
  });

  await db
    .update(questions)
    .set({
      upvoteCount: sql`${questions.upvoteCount} + 1`,
    })
    .where(eq(questions.id, questionId));

  await checkAndNotifyGoalReached(questionId);

  revalidatePath(`/${partySlug}/${politicianSlug}`);
}

export async function cancelUpvote(
  questionId: string,
  partySlug: string,
  politicianSlug: string
) {
  const citizen = await getCitizenFromSession();
  if (!citizen) throw new Error("Du er ikke logget ind");

  const [existingUpvote] = await db
    .select()
    .from(upvotes)
    .where(
      and(eq(upvotes.questionId, questionId), eq(upvotes.citizenId, citizen.id))
    )
    .limit(1);

  if (!existingUpvote) throw new Error("Upvote ikke fundet");

  await db.delete(upvotes).where(eq(upvotes.id, existingUpvote.id));

  await db
    .update(questions)
    .set({
      upvoteCount: sql`${questions.upvoteCount} - 1`,
    })
    .where(eq(questions.id, questionId));

  revalidatePath(`/${partySlug}/${politicianSlug}`);
}

export async function submitSuggestion(formData: FormData) {
  const firstName = formData.get("firstName") as string;
  const email = formData.get("email") as string;
  const text = formData.get("text") as string;
  const politicianId = formData.get("politicianId") as string;
  const politicianSlug = formData.get("politicianSlug") as string;
  const partySlug = formData.get("partySlug") as string;

  if (!firstName || !email || !text || !politicianId || !politicianSlug || !partySlug) {
    throw new Error("Alle felter er påkrævet");
  }

  if (text.length > 300) throw new Error("Spørgsmålet må maks være 300 tegn");

  // Find or create citizen
  let [citizen] = await db
    .select()
    .from(citizens)
    .where(eq(citizens.email, email.toLowerCase()))
    .limit(1);

  if (!citizen) {
    [citizen] = await db
      .insert(citizens)
      .values({
        firstName,
        email: email.toLowerCase(),
      })
      .returning();
  }

  // Create suggestion with pending_verification status
  const [suggestion] = await db
    .insert(questionSuggestions)
    .values({
      politicianId,
      citizenId: citizen.id,
      text,
      status: "pending_verification",
    })
    .returning();

  // Create verification token
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24);

  await db.insert(suggestionTokens).values({
    token,
    citizenId: citizen.id,
    suggestionId: suggestion.id,
    politicianSlug,
    partySlug,
    expiresAt,
  });

  // Send verification email
  const verificationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/verify-suggestion/${token}`;
  await sendSuggestionVerificationEmail({
    to: email.toLowerCase(),
    firstName,
    questionText: text,
    verificationUrl,
  });
}

export async function directSuggestion(formData: FormData) {
  const citizen = await getCitizenFromSession();
  if (!citizen) throw new Error("Du er ikke logget ind");

  const text = formData.get("text") as string;
  const politicianId = formData.get("politicianId") as string;
  const partySlug = formData.get("partySlug") as string;
  const politicianSlug = formData.get("politicianSlug") as string;

  if (!text || !politicianId) throw new Error("Alle felter er påkrævet");
  if (text.length > 300) throw new Error("Spørgsmålet må maks være 300 tegn");

  await db.insert(questionSuggestions).values({
    politicianId,
    citizenId: citizen.id,
    text,
    status: "pending",
  });

  // Get politician info for emails
  const [politician] = await db
    .select({ name: politicians.name, email: politicians.email })
    .from(politicians)
    .where(eq(politicians.id, politicianId))
    .limit(1);

  if (politician) {
    await sendSuggestionReceivedEmail({
      to: citizen.email,
      firstName: citizen.firstName,
      politicianName: politician.name,
      questionText: text,
    });

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/politiker/dashboard#borgeres-spoergsmaal`;
    await sendNewSuggestionNotificationEmail({
      to: politician.email,
      politicianName: politician.name,
      citizenName: citizen.firstName,
      questionText: text,
      dashboardUrl,
    });
  }

  revalidatePath(`/${partySlug}/${politicianSlug}`);
}

export async function citizenLogout(partySlug: string, politicianSlug: string) {
  await clearCitizenSession();
  revalidatePath(`/${partySlug}/${politicianSlug}`);
}
