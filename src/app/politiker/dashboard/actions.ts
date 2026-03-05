"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { politicians, questions, questionTags, upvotes, citizens, answerHistory, causes } from "@/db/schema";
import { sendAnswerNotificationEmail } from "@/lib/email";
import { eq, and, sql, inArray } from "drizzle-orm";
import { generateSlug } from "@/lib/utils";
import { revalidatePath } from "next/cache";

export async function createQuestion(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

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

  const name = formData.get("name") as string;
  const party = formData.get("party") as string;
  const email = formData.get("email") as string;

  if (!name || !party || !email) throw new Error("Navn, parti og email er påkrævet");

  const slug = generateSlug(name);
  const partySlug = generateSlug(party);

  const [existing] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

  if (existing) {
    await db
      .update(politicians)
      .set({
        name,
        slug,
        party,
        partySlug,
        email,
        updatedAt: new Date(),
      })
      .where(eq(politicians.id, existing.id));
  } else {
    await db.insert(politicians).values({
      userId: session.user.id,
      name,
      slug,
      party,
      partySlug,
      email,
    });
  }

  revalidatePath("/politiker/dashboard");
}

export async function editQuestion(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const questionId = formData.get("questionId") as string;
  const text = formData.get("text") as string;
  const tagsRaw = formData.get("tags") as string;
  const upvoteGoal = parseInt(formData.get("upvoteGoal") as string) || 1000;

  if (!text || text.length > 300) throw new Error("Ugyldigt spørgsmål");

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

  if (!politician) throw new Error("Politician not found");

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

  if (!question) throw new Error("Spørgsmålet kan ikke redigeres");

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
}

export async function deleteQuestion(questionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

  if (!politician) throw new Error("Politician not found");

  // Only delete if upvoteCount is 0
  await db
    .delete(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id),
        eq(questions.upvoteCount, 0)
      )
    );

  revalidatePath("/politiker/dashboard");
}

export async function submitAnswerUrl(questionId: string, answerUrl: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (!answerUrl || !answerUrl.startsWith("http")) {
    throw new Error("Ugyldig URL");
  }

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

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

  if (!question) throw new Error("Spørgsmålet kan ikke besvares endnu");

  await db.insert(answerHistory).values({ questionId, answerUrl });

  await db
    .update(questions)
    .set({ answerUrl })
    .where(eq(questions.id, questionId));

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
      sendAnswerNotificationEmail({
        to: citizen.email,
        firstName: citizen.firstName,
        politicianName: politician.name,
        partyName: politician.party,
        questionText: question.text,
        answerUrl,
      })
    )
  );

  revalidatePath("/politiker/dashboard");
}

export async function createCause(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

  if (!politician) throw new Error("Opret venligst dine indstillinger først");

  const title = formData.get("title") as string;
  const shortDescription = formData.get("shortDescription") as string;
  const longDescription = (formData.get("longDescription") as string) || null;
  const videoUrl = (formData.get("videoUrl") as string) || null;
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

  await db.insert(causes).values({
    politicianId: politician.id,
    title,
    shortDescription,
    longDescription,
    videoUrl,
    tagId,
    slug: generateSlug(tagId),
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
  const tagId = formData.get("tagId") as string;

  if (!title || title.length > 300) throw new Error("Ugyldig overskrift");
  if (!shortDescription) throw new Error("Kort beskrivelse er påkrævet");
  if (!tagId || tagId.length > 100) throw new Error("Ugyldig tag titel");

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

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
    .set({ title, shortDescription, longDescription, videoUrl, tagId, slug: generateSlug(tagId) })
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

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

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
