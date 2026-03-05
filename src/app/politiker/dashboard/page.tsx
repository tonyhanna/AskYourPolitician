import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { politicians, questions, questionTags, causes, questionSuggestions, citizens } from "@/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { QuestionForm } from "@/components/QuestionForm";
import { SettingsForm } from "@/components/SettingsForm";
import { QuestionList } from "@/components/QuestionList";
import { CauseForm } from "@/components/CauseForm";
import { CauseList } from "@/components/CauseList";
import { SuggestionList } from "@/components/SuggestionList";

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/politiker");

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);

  let politicianQuestions: {
    id: string;
    text: string;
    upvoteGoal: number;
    upvoteCount: number;
    tags: string[];
    goalReached: boolean;
    answerUrl: string | null;
    suggestedBy: string | null;
  }[] = [];

  let politicianCauses: {
    id: string;
    title: string;
    shortDescription: string;
    longDescription: string | null;
    videoUrl: string | null;
    tagId: string;
    inUse: boolean;
  }[] = [];

  let availableTags: { tagId: string; title: string }[] = [];

  if (politician) {
    const rawQuestions = await db
      .select()
      .from(questions)
      .where(eq(questions.politicianId, politician.id))
      .orderBy(desc(questions.createdAt));

    const tagsByQuestion = new Map<string, string[]>();
    const usedTagIds = new Set<string>();

    if (rawQuestions.length > 0) {
      const questionIds = rawQuestions.map((q) => q.id);
      const allTags = await db
        .select()
        .from(questionTags)
        .where(inArray(questionTags.questionId, questionIds));

      for (const tag of allTags) {
        const existing = tagsByQuestion.get(tag.questionId) ?? [];
        existing.push(tag.tag);
        tagsByQuestion.set(tag.questionId, existing);
        usedTagIds.add(tag.tag);
      }
    }

    // Fetch citizen names for suggested questions
    const suggestedByNames = new Map<string, string>();
    const suggestedCitizenIds = rawQuestions
      .filter((q) => q.suggestedByCitizenId)
      .map((q) => q.suggestedByCitizenId!);

    if (suggestedCitizenIds.length > 0) {
      const suggestedCitizens = await db
        .select({ id: citizens.id, firstName: citizens.firstName })
        .from(citizens)
        .where(inArray(citizens.id, suggestedCitizenIds));

      for (const c of suggestedCitizens) {
        suggestedByNames.set(c.id, c.firstName);
      }
    }

    politicianQuestions = rawQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      upvoteGoal: q.upvoteGoal,
      upvoteCount: q.upvoteCount,
      tags: tagsByQuestion.get(q.id) ?? [],
      goalReached: q.goalReachedEmailSent,
      answerUrl: q.answerUrl,
      suggestedBy: q.suggestedByCitizenId
        ? suggestedByNames.get(q.suggestedByCitizenId) ?? null
        : null,
    }));

    // Fetch causes
    const rawCauses = await db
      .select()
      .from(causes)
      .where(eq(causes.politicianId, politician.id))
      .orderBy(desc(causes.createdAt));

    politicianCauses = rawCauses.map((c) => ({
      id: c.id,
      title: c.title,
      shortDescription: c.shortDescription,
      longDescription: c.longDescription,
      videoUrl: c.videoUrl,
      tagId: c.tagId,
      inUse: usedTagIds.has(c.tagId),
    }));

    availableTags = rawCauses.map((c) => ({ tagId: c.tagId, title: c.title }));
  }

  // Fetch pending suggestions
  let pendingSuggestions: {
    id: string;
    citizenFirstName: string;
    text: string;
    createdAt: string;
  }[] = [];

  if (politician) {
    const rawSuggestions = await db
      .select({
        id: questionSuggestions.id,
        text: questionSuggestions.text,
        createdAt: questionSuggestions.createdAt,
        citizenFirstName: citizens.firstName,
      })
      .from(questionSuggestions)
      .innerJoin(citizens, eq(questionSuggestions.citizenId, citizens.id))
      .where(
        and(
          eq(questionSuggestions.politicianId, politician.id),
          eq(questionSuggestions.status, "pending")
        )
      )
      .orderBy(desc(questionSuggestions.createdAt));

    pendingSuggestions = rawSuggestions.map((s) => ({
      id: s.id,
      citizenFirstName: s.citizenFirstName,
      text: s.text,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const uniqueUrl = politician ? `${appUrl}/${politician.partySlug}/${politician.slug}` : null;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold">
        {politician ? (
          <>
            <span className="text-[#AAAAAA]">Dashboard:</span> {politician.party} / {politician.name}
          </>
        ) : "Dashboard"}
      </h1>

      {politician && (
        <>
          <h2 className="text-2xl font-bold text-gray-900">Spørgsmål</h2>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <QuestionForm
              politicianId={politician.id}
              disabled={false}
              availableTags={availableTags}
            />
          </section>

          {politicianQuestions.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <QuestionList questions={politicianQuestions} availableTags={availableTags} basePath={uniqueUrl!} />
            </section>
          )}

          <h2 id="borgeres-spoergsmaal" className="text-2xl font-bold text-gray-900">
            Borgeres spørgsmål
            {pendingSuggestions.length > 0 && (
              <span className="ml-2 text-sm bg-blue-600 text-white px-2 py-0.5 rounded-full font-medium align-middle">
                {pendingSuggestions.length}
              </span>
            )}
          </h2>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <SuggestionList suggestions={pendingSuggestions} availableTags={availableTags} />
          </section>

          <h2 className="text-2xl font-bold text-gray-900">Mærkesager</h2>

          <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <CauseForm politicianId={politician.id} />
          </section>

          {politicianCauses.length > 0 && (
            <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <CauseList causes={politicianCauses} />
            </section>
          )}
        </>
      )}

      <h2 className="text-2xl font-bold text-gray-900">Indstillinger</h2>

      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <SettingsForm
          politician={
            politician
              ? {
                  name: politician.name,
                  party: politician.party,
                  email: politician.email,
                  slug: politician.slug,
                }
              : null
          }
          googleEmail={session.user.email!}
          googleName={session.user.name ?? ""}
        />
        {uniqueUrl && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              Din unikke URL:{" "}
              <a
                href={uniqueUrl}
                className="text-blue-600 underline font-medium"
                target="_blank"
              >
                {uniqueUrl}
              </a>
            </p>
          </div>
        )}
      </section>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/politiker" });
        }}
        className="text-center"
      >
        <button
          type="submit"
          className="text-sm text-gray-500 hover:text-red-600 transition cursor-pointer"
        >
          Log ud
        </button>
      </form>
    </main>
  );
}
