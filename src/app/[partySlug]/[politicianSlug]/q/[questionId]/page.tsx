import { db } from "@/db";
import { politicians, questions, questionTags, upvotes, citizens } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getCitizenFromSession } from "@/lib/citizen-session";
import { UpvoteButton } from "@/components/UpvoteButton";
import { CancelUpvoteButton } from "@/components/CancelUpvoteButton";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { AnswerPlayer } from "@/components/AnswerPlayer";
import { citizenLogout } from "../../actions";
import type { Metadata } from "next";

type Props = {
  params: Promise<{
    partySlug: string;
    politicianSlug: string;
    questionId: string;
  }>;
};

async function getQuestionData(partySlug: string, politicianSlug: string, questionId: string) {
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

  if (!politician) return null;

  const [question] = await db
    .select()
    .from(questions)
    .where(
      and(
        eq(questions.id, questionId),
        eq(questions.politicianId, politician.id)
      )
    )
    .limit(1);

  if (!question) return null;

  const tags = await db
    .select()
    .from(questionTags)
    .where(eq(questionTags.questionId, questionId));

  let suggestedByName: string | null = null;
  if (question.suggestedByCitizenId) {
    const [suggester] = await db
      .select({ firstName: citizens.firstName })
      .from(citizens)
      .where(eq(citizens.id, question.suggestedByCitizenId))
      .limit(1);
    if (suggester) suggestedByName = suggester.firstName;
  }

  return { politician, question, tags: tags.map((t) => t.tag), suggestedByName };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { partySlug, politicianSlug, questionId } = await params;
  const data = await getQuestionData(partySlug, politicianSlug, questionId);

  if (!data) return { title: "Spørgsmål ikke fundet" };

  const { politician, question } = data;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const url = `${appUrl}/${partySlug}/${politicianSlug}/q/${questionId}`;

  return {
    title: `${question.text} / ${politician.name} / ${politician.party}`,
    description: `${politician.name} fra ${politician.party} — ${question.upvoteCount} upvotes`,
    openGraph: {
      title: question.text,
      description: `${politician.name} fra ${politician.party} — ${question.upvoteCount} upvotes`,
      url,
      type: "website",
    },
  };
}

export default async function QuestionLandingPage({ params }: Props) {
  const { partySlug, politicianSlug, questionId } = await params;
  const data = await getQuestionData(partySlug, politicianSlug, questionId);

  if (!data) notFound();

  const { politician, question, tags, suggestedByName } = data;
  const basePath = `/${partySlug}/${politicianSlug}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const pageUrl = `${appUrl}${basePath}/q/${questionId}`;

  const citizen = await getCitizenFromSession();
  let isUpvoted = false;

  if (citizen) {
    const [existing] = await db
      .select()
      .from(upvotes)
      .where(
        and(
          eq(upvotes.questionId, questionId),
          eq(upvotes.citizenId, citizen.id)
        )
      )
      .limit(1);

    isUpvoted = !!existing;
  }

  return (
    <main className="max-w-xl mx-auto p-6 mt-8">
      <div className="mb-4">
        <a
          href={basePath}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Se alle spørgsmål fra {politician.name}
        </a>
      </div>

      <div className={`rounded-xl shadow-sm p-6 space-y-6 ${
        question.answerUrl
          ? "bg-gray-900 border border-gray-900"
          : "bg-white border border-gray-200"
      }`}>
        <div>
          <p className={`text-sm mb-1 ${question.answerUrl ? "text-gray-400" : "text-gray-500"}`}>
            Spørgsmål til {politician.name} ({politician.party})
          </p>
          <h1 className={`text-2xl font-bold ${question.answerUrl ? "text-white" : "text-gray-900"}`}>{question.text}</h1>
          {suggestedByName && (
            <p className="text-xs text-gray-400 mt-1">
              Foreslået af {suggestedByName}
            </p>
          )}
        </div>

        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <span
                key={tag}
                className={`text-xs px-2 py-0.5 rounded-full ${
                  question.answerUrl
                    ? "bg-gray-700 text-gray-300"
                    : "bg-blue-100 text-blue-800"
                }`}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className={`flex items-center justify-between pt-2 border-t ${question.answerUrl ? "border-gray-700" : "border-gray-100"}`}>
          {question.answerUrl ? (
            <AnswerPlayer answerUrl={question.answerUrl} photoUrl={question.answerPhotoUrl} className="w-full rounded-lg" />
          ) : (
            <span className="text-lg font-semibold text-gray-700">
              {question.upvoteCount} {question.upvoteCount === 1 ? "upvote" : "upvotes"}
            </span>
          )}
          {question.answerUrl ? (
            isUpvoted ? (
              <CancelUpvoteButton
                questionId={question.id}
                partySlug={partySlug}
                politicianSlug={politicianSlug}
              />
            ) : null
          ) : question.goalReachedEmailSent ? (
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

        <div className="flex items-center gap-3 pt-2">
          <CopyLinkButton url={pageUrl} title={question.text} />
        </div>
      </div>

      {citizen && (
        <div className="text-center mt-6 space-y-2">
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
