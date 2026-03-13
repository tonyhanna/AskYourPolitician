import { NextResponse } from "next/server";
import { db } from "@/db";
import { questions, politicians, upvotes, citizens } from "@/db/schema";
import { eq, and, sql, isNull } from "drizzle-orm";
import { sendDeadlineReminderEmail, sendDeadlineMissedEmail } from "@/lib/email";

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

  let remindersSent = 0;
  let missedProcessed = 0;

  // ── A) Send reminder emails (2 hours before deadline = 22h after goalReachedAt) ──
  const reminderQuestions = await db
    .select({
      id: questions.id,
      text: questions.text,
      upvoteCount: questions.upvoteCount,
      goalReachedAt: questions.goalReachedAt,
      politicianId: questions.politicianId,
    })
    .from(questions)
    .where(
      and(
        eq(questions.goalReachedEmailSent, true),
        isNull(questions.answerUrl),
        eq(questions.reminderEmailSent, false),
        eq(questions.deadlineMissed, false),
        sql`${questions.goalReachedAt} IS NOT NULL`,
        sql`${questions.goalReachedAt} + interval '22 hours' <= now()`
      )
    );

  for (const q of reminderQuestions) {
    const [politician] = await db
      .select()
      .from(politicians)
      .where(eq(politicians.id, q.politicianId))
      .limit(1);

    if (!politician) continue;

    const deadlineMs =
      new Date(q.goalReachedAt!).getTime() + 24 * 60 * 60 * 1000;
    const hoursLeft = Math.max(
      0,
      Math.round((deadlineMs - Date.now()) / (1000 * 60 * 60))
    );

    try {
      await sendDeadlineReminderEmail({
        to: politician.email,
        politicianName: politician.name,
        questionText: q.text,
        upvoteCount: q.upvoteCount,
        hoursLeft,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/politiker/dashboard`,
      });

      await db
        .update(questions)
        .set({ reminderEmailSent: true })
        .where(eq(questions.id, q.id));

      remindersSent++;
    } catch (error) {
      console.error(
        `Failed to send reminder for question ${q.id}:`,
        error
      );
    }
  }

  // ── B) Process missed deadlines (24h after goalReachedAt) ──
  const missedQuestions = await db
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
        eq(questions.deadlineMissed, false),
        sql`${questions.goalReachedAt} IS NOT NULL`,
        sql`${questions.goalReachedAt} + interval '24 hours' <= now()`
      )
    );

  for (const q of missedQuestions) {
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

  return NextResponse.json({
    remindersSent,
    missedProcessed,
  });
}
