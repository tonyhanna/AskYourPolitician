import { Suspense } from "react";
import { db } from "@/db";
import { politicians, questions, questionTags, upvotes } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getCitizenFromSession } from "@/lib/citizen-session";
import { SuccessBanner } from "@/components/SuccessBanner";
import { CitizenUpvotedList } from "@/components/CitizenUpvotedList";
import { UpvoteButton } from "@/components/UpvoteButton";
import { CancelUpvoteButton } from "@/components/CancelUpvoteButton";
import { citizenLogout } from "./actions";


export default async function BorgerFeed({
  params,
}: {
  params: Promise<{ partySlug: string; politicianSlug: string }>;
}) {
  const { partySlug, politicianSlug } = await params;

  const [politician] = await db
    .select()
    .from(politicians)
    .where(
      and(
        eq(politicians.partySlug, partySlug),
        eq(politicians.slug, politicianSlug)
      )
    )
    .limit(1);

  if (!politician) notFound();

  const basePath = `/${partySlug}/${politicianSlug}`;

  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.politicianId, politician.id))
    .orderBy(desc(questions.upvoteCount));

  // Fetch tags
  const tagsByQuestion = new Map<string, string[]>();
  if (allQuestions.length > 0) {
    const questionIds = allQuestions.map((q) => q.id);
    const allTags = await db
      .select()
      .from(questionTags)
      .where(inArray(questionTags.questionId, questionIds));

    for (const tag of allTags) {
      const existing = tagsByQuestion.get(tag.questionId) ?? [];
      existing.push(tag.tag);
      tagsByQuestion.set(tag.questionId, existing);
    }
  }

  // Check citizen session for upvoted questions
  const citizen = await getCitizenFromSession();
  let citizenUpvotedIds = new Set<string>();

  if (citizen) {
    const citizenUpvotes = await db
      .select({ questionId: upvotes.questionId })
      .from(upvotes)
      .where(eq(upvotes.citizenId, citizen.id));

    citizenUpvotedIds = new Set(citizenUpvotes.map((u) => u.questionId));
  }

  const upvotedQuestions = allQuestions.filter((q) =>
    citizenUpvotedIds.has(q.id)
  );

  return (
    <main className="max-w-2xl mx-auto p-6">
      <Suspense>
        <SuccessBanner />
      </Suspense>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{politician.name}</h1>
        <p className="text-gray-600">{politician.party}</p>
      </div>

      {upvotedQuestions.length > 0 && (
        <CitizenUpvotedList
          questions={upvotedQuestions.map((q) => ({
            id: q.id,
            text: q.text,
            upvoteCount: q.upvoteCount,
          }))}
          partySlug={partySlug}
          politicianSlug={politicianSlug}
        />
      )}

      <div className="mb-6">
        <p className="text-gray-600 mb-4">
          Her kan du se spørgsmål, som du kan stille til {politician.name}. Upvote
          de spørgsmål du synes er vigtigst, så politikeren ved hvad der betyder
          noget for dig.
        </p>
      </div>

      <div className="space-y-4">
        {allQuestions.map((question) => {
          const isUpvoted = citizenUpvotedIds.has(question.id);
          const tags = tagsByQuestion.get(question.id) ?? [];

          return (
            <div
              key={question.id}
              className={`border rounded-lg p-4 ${
                isUpvoted
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200"
              }`}
            >
              <p className="font-medium text-gray-900 mb-2">{question.text}</p>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {question.answerUrl && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-2">
                  <p className="text-sm text-green-800 font-medium mb-1">
                    {politician.name} har svaret!
                  </p>
                  <a
                    href={question.answerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800 underline"
                  >
                    Se svar
                  </a>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  {question.upvoteCount} {question.upvoteCount === 1 ? "upvote" : "upvotes"}
                </span>
                {question.answerUrl ? null : question.goalReachedEmailSent ? (
                  <span className="text-sm text-amber-600 font-medium">Afventer svar...</span>
                ) : isUpvoted ? (
                  <CancelUpvoteButton
                    questionId={question.id}
                    partySlug={partySlug}
                    politicianSlug={politicianSlug}
                  />
                ) : (
                  <UpvoteButton
                    questionId={question.id}
                    basePath={basePath}
                    isUpvoted={false}
                    hasSession={!!citizen}
                    partySlug={partySlug}
                    politicianSlug={politicianSlug}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {allQuestions.length === 0 && (
        <p className="text-gray-500 text-center py-8">
          Der er endnu ingen spørgsmål fra denne politiker.
        </p>
      )}

{/* TODO: Foreslå et spørgsmål-feature */}

      {citizen && (
        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-gray-500">
            Logget ind som {citizen.email}
          </p>
          <form
            action={async () => {
              "use server";
              await citizenLogout(partySlug, politicianSlug);
            }}
          >
            <button
              type="submit"
              className="text-sm text-gray-500 hover:text-red-600 transition cursor-pointer"
            >
              Log ud
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
