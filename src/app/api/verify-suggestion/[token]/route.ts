import { db } from "@/db";
import {
  suggestionTokens,
  questionSuggestions,
  politicians,
  citizens,
  questions,
} from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  createCitizenSession,
  setCitizenSessionCookieOnResponse,
} from "@/lib/citizen-session";
import { sendNewSuggestionNotificationEmail } from "@/lib/email";
import { NextResponse } from "next/server";

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
    .from(suggestionTokens)
    .where(
      and(
        eq(suggestionTokens.token, token),
        eq(suggestionTokens.used, false),
        gt(suggestionTokens.expiresAt, new Date())
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
    .update(suggestionTokens)
    .set({ used: true })
    .where(eq(suggestionTokens.id, verification.id));

  // Update suggestion status to pending
  await db
    .update(questionSuggestions)
    .set({ status: "pending" })
    .where(eq(questionSuggestions.id, verification.suggestionId));

  // Get suggestion, politician, and citizen info for notification
  const [suggestion] = await db
    .select()
    .from(questionSuggestions)
    .where(eq(questionSuggestions.id, verification.suggestionId))
    .limit(1);

  if (suggestion) {
    const [politician] = await db
      .select({ name: politicians.name, email: politicians.email })
      .from(politicians)
      .where(eq(politicians.id, suggestion.politicianId))
      .limit(1);

    const [citizen] = await db
      .select({ firstName: citizens.firstName })
      .from(citizens)
      .where(eq(citizens.id, suggestion.citizenId))
      .limit(1);

    if (politician && citizen) {
      const dashboardUrl = `${appUrl}/politiker/dashboard#borgeres-spoergsmaal`;
      await sendNewSuggestionNotificationEmail({
        to: politician.email,
        politicianName: politician.name,
        citizenName: citizen.firstName,
        questionText: suggestion.text,
        dashboardUrl,
      });
    }
  }

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

  // Create citizen session and set cookie on the redirect response
  const sessionToken = await createCitizenSession(verification.citizenId);
  const response = NextResponse.redirect(
    `${baseDest}${baseDest.includes("?") ? "&" : "?"}suggestion_verified=true`
  );
  setCitizenSessionCookieOnResponse(response, sessionToken);
  return response;
}
