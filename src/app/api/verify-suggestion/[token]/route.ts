import { db } from "@/db";
import {
  suggestionTokens,
  questionSuggestions,
  politicians,
  citizens,
} from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  createCitizenSession,
  setCitizenSessionCookie,
} from "@/lib/citizen-session";
import { sendNewSuggestionNotificationEmail } from "@/lib/email";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

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

  // Create citizen session
  const sessionToken = await createCitizenSession(verification.citizenId);
  await setCitizenSessionCookie(sessionToken);

  return NextResponse.redirect(
    `${appUrl}/${verification.partySlug}/${verification.politicianSlug}?suggestion_verified=true`
  );
}
