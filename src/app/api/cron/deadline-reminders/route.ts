import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, politicians, upvotes, citizens } from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { sendDeadlineMissedEmail, sendDailyMissedSummaryEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (production security)
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let missedProcessed = 0;
  let summariesSent = 0;

  // ── A) Mark newly missed deadlines (24h after goalReachedAt) + notify upvoters ──
  const newlyMissedQuestions = await db
    .select({
      id: questions.id,
      text: questions.text,
      upvoteCount: questions.upvoteCount,
      politicianId: questions.politicianId,
    })
    .from(questions)
    .where(
      and(
        eq(questions.goalReachedEmailSent, true),
        isNull(questions.answerUrl),
        isNull(questions.muxAssetStatus),
        eq(questions.deadlineMissed, false),
        sql`${questions.goalReachedAt} IS NOT NULL`,
        sql`${questions.goalReachedAt} + interval '24 hours' <= now()`
      )
    );

  for (const q of newlyMissedQuestions) {
    const [politician] = await db
      .select()
      .from(politicians)
      .where(eq(politicians.id, q.politicianId))
      .limit(1);

    if (!politician) continue;

    // Mark as missed
    await db
      .update(questions)
      .set({ deadlineMissed: true })
      .where(eq(questions.id, q.id));

    // Send email to all upvoters
    const upvoters = await db
      .select({
        firstName: citizens.firstName,
        email: citizens.email,
      })
      .from(upvotes)
      .innerJoin(citizens, eq(upvotes.citizenId, citizens.id))
      .where(eq(upvotes.questionId, q.id));

    await Promise.allSettled(
      upvoters.map((citizen) =>
        sendDeadlineMissedEmail({
          to: citizen.email,
          firstName: citizen.firstName,
          politicianName: politician.name,
          partyName: politician.party,
          questionText: q.text,
        })
      )
    );

    missedProcessed++;
  }

  // ── B) Daily summary to politicians: all missed + unanswered questions ──
  const allMissedQuestions = await db
    .select({
      id: questions.id,
      text: questions.text,
      upvoteCount: questions.upvoteCount,
      politicianId: questions.politicianId,
    })
    .from(questions)
    .where(
      and(
        eq(questions.deadlineMissed, true),
        isNull(questions.answerUrl),
        isNull(questions.muxAssetStatus)
      )
    );

  // Group by politician
  const byPolitician = new Map<string, typeof allMissedQuestions>();
  for (const q of allMissedQuestions) {
    const list = byPolitician.get(q.politicianId) || [];
    list.push(q);
    byPolitician.set(q.politicianId, list);
  }

  for (const [politicianId, missedList] of byPolitician) {
    const [politician] = await db
      .select()
      .from(politicians)
      .where(eq(politicians.id, politicianId))
      .limit(1);

    if (!politician) continue;

    try {
      await sendDailyMissedSummaryEmail({
        to: politician.email,
        politicianName: politician.name,
        questions: missedList.map((q) => ({
          text: q.text,
          upvoteCount: q.upvoteCount,
        })),
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/politiker/dashboard`,
      });
      summariesSent++;
    } catch (error) {
      console.error(
        `Failed to send daily missed summary to ${politician.email}:`,
        error
      );
    }
  }

  return NextResponse.json({
    missedProcessed,
    summariesSent,
  });
}
