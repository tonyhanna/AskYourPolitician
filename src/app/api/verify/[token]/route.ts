import { db } from "@/db";
import { verificationTokens, upvotes, questions } from "@/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import {
  createCitizenSession,
  setCitizenSessionCookieOnResponse,
} from "@/lib/citizen-session";
import { NextResponse } from "next/server";
import { checkAndNotifyGoalReached } from "@/lib/goal-check";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const url = new URL(request.url);
  const customRedirect = url.searchParams.get("redirect");

  // Find valid, unused token
  const [verification] = await db
    .select()
    .from(verificationTokens)
    .where(
      and(
        eq(verificationTokens.token, token),
        eq(verificationTokens.used, false),
        gt(verificationTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!verification) {
    return NextResponse.redirect(
      `${appUrl}?error=invalid_token`
    );
  }

  // Mark token as used
  await db
    .update(verificationTokens)
    .set({ used: true })
    .where(eq(verificationTokens.id, verification.id));

  // Check if upvote already exists (idempotency)
  const [existingUpvote] = await db
    .select()
    .from(upvotes)
    .where(
      and(
        eq(upvotes.questionId, verification.questionId),
        eq(upvotes.citizenId, verification.citizenId)
      )
    )
    .limit(1);

  // Create citizen session
  const sessionToken = await createCitizenSession(verification.citizenId);

  // Determine redirect destination with fallback
  const citizenPageUrl = `${appUrl}/${verification.partySlug}/${verification.politicianSlug}`;
  let baseDest = citizenPageUrl;

  if (customRedirect) {
    // Check if redirect points to a question detail page — verify question still exists
    const questionMatch = customRedirect.match(/\/q\/([^/?]+)/);
    if (questionMatch) {
      const questionId = questionMatch[1];
      const [q] = await db
        .select({ id: questions.id })
        .from(questions)
        .where(eq(questions.id, questionId))
        .limit(1);
      if (q) {
        baseDest = `${appUrl}${customRedirect}`;
      }
      // If question doesn't exist, baseDest stays as citizen page (fallback)
    } else {
      baseDest = `${appUrl}${customRedirect}`;
    }
  }

  if (existingUpvote) {
    const response = NextResponse.redirect(
      `${baseDest}${baseDest.includes("?") ? "&" : "?"}already_upvoted=true`
    );
    setCitizenSessionCookieOnResponse(response, sessionToken);
    return response;
  }

  // Create upvote
  await db.insert(upvotes).values({
    questionId: verification.questionId,
    citizenId: verification.citizenId,
  });

  // Increment upvote count atomically
  await db
    .update(questions)
    .set({
      upvoteCount: sql`${questions.upvoteCount} + 1`,
    })
    .where(eq(questions.id, verification.questionId));

  await checkAndNotifyGoalReached(verification.questionId);

  const response = NextResponse.redirect(
    `${baseDest}${baseDest.includes("?") ? "&" : "?"}success=true`
  );
  setCitizenSessionCookieOnResponse(response, sessionToken);
  return response;
}
