import { db } from "@/db";
import { questions, politicians, upvotes, citizens } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendGoalReachedEmail, sendGoalReachedCitizenEmail } from "@/lib/email";

export async function checkAndNotifyGoalReached(questionId: string) {
  // Atomically set goalReachedEmailSent = true ONLY IF goal is reached and not already sent.
  // Only one concurrent caller can succeed in flipping the flag.
  const [updated] = await db
    .update(questions)
    .set({ goalReachedEmailSent: true, goalReachedAt: new Date() })
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.goalReachedEmailSent, false),
        sql`${questions.upvoteCount} >= ${questions.upvoteGoal}`
      )
    )
    .returning({
      id: questions.id,
      text: questions.text,
      upvoteCount: questions.upvoteCount,
      politicianId: questions.politicianId,
    });

  if (!updated) return;

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.id, updated.politicianId))
    .limit(1);

  if (!politician) return;

  const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/politiker/dashboard`;

  // Send email to politician
  try {
    await sendGoalReachedEmail({
      to: politician.email,
      politicianName: politician.name,
      questionText: updated.text,
      upvoteCount: updated.upvoteCount,
      dashboardUrl,
    });
  } catch (error) {
    console.error("Failed to send goal reached email to politician:", error);
  }

  // Send email to all citizens who upvoted
  const upvoters = await db
    .select({
      firstName: citizens.firstName,
      email: citizens.email,
    })
    .from(upvotes)
    .innerJoin(citizens, eq(upvotes.citizenId, citizens.id))
    .where(eq(upvotes.questionId, questionId));

  await Promise.allSettled(
    upvoters.map((citizen) =>
      sendGoalReachedCitizenEmail({
        to: citizen.email,
        firstName: citizen.firstName,
        politicianName: politician.name,
        partyName: politician.party,
        questionText: updated.text,
      })
    )
  );
}
