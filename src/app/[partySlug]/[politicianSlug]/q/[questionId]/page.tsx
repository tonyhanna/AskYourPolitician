import { db } from "@/db";
import { politicians, questions, questionTags, upvotes, citizens, parties } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getCitizenFromSession } from "@/lib/citizen-session";
import { PoliticianTopBar } from "@/components/PoliticianTopBar";
import { QuestionDetailCard } from "@/components/QuestionDetailCard";
import { QuestionDetailEllipsis } from "@/components/QuestionDetailEllipsis";
import { ChatbaseWidget } from "@/components/ChatbaseWidget";
import type { Metadata } from "next";
import { getAppSettings } from "@/lib/settings";

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
      .select({ firstName: citizens.firstName, age: citizens.age })
      .from(citizens)
      .where(eq(citizens.id, question.suggestedByCitizenId))
      .limit(1);
    if (suggester) suggestedByName = suggester.firstName + (suggester.age ? `, ${suggester.age} år` : "");
  }

  // Fetch party data for TopBar
  let party: { color: string | null; colorDark: string | null; colorLight: string | null; logoUrl: string | null } | null = null;
  if (politician.partyId) {
    const [p] = await db
      .select({
        color: parties.color,
        colorDark: parties.colorDark,
        colorLight: parties.colorLight,
        logoUrl: parties.logoUrl,
      })
      .from(parties)
      .where(eq(parties.id, politician.partyId))
      .limit(1);
    party = p ?? null;
  }

  return { politician, question, tags: tags.map((t) => t.tag), suggestedByName, party };
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
      ...(politician.ogImageUrl ? { images: [{ url: politician.ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
  };
}

export default async function QuestionLandingPage({ params }: Props) {
  const { partySlug, politicianSlug, questionId } = await params;
  const data = await getQuestionData(partySlug, politicianSlug, questionId);

  if (!data) notFound();

  const { politician, question, tags, suggestedByName, party } = data;
  const basePath = `/${partySlug}/${politicianSlug}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";

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

  const appSettings = await getAppSettings();
  const partyColor = party?.color ?? null;
  const partyColorDark = party?.colorDark ?? null;

  return (
    <>
      {/* Theme color meta tag */}
      {partyColor && (
        <meta name="theme-color" content={partyColor} />
      )}
      <style>{`:root { --party-color: ${partyColor || "#3B82F6"}; }`}</style>

      <div className="min-h-dvh flex flex-col">
      {/* PoliticianTopBar */}
      <PoliticianTopBar
        politicianName={politician.name}
        partyName={politician.party}
        profilePhotoUrl={politician.profilePhotoUrl}
        partyLogoUrl={party?.logoUrl ?? null}
        constituency={politician.constituency}
        partyColor={partyColor}
        partyColorDark={partyColorDark}
        partyColorLight={party?.colorLight ?? null}
        politicianId={politician.id}
        partySlug={partySlug}
        politicianSlug={politicianSlug}
        hasSession={!!citizen}
        backHref={basePath}
        redirectPath={`${basePath}/q/${question.id}`}
      />

      <main className="px-[15px] py-6 pb-1 flex flex-col flex-1" style={{ backgroundColor: "var(--system-bg0, #ffffff)" }}>
        {/* Question detail card */}
        <QuestionDetailCard
          question={{
            id: question.id,
            text: question.text,
            upvoteCount: question.upvoteCount,
            answerUrl: question.answerUrl,
            answerPhotoUrl: question.answerPhotoUrl,
            answerClipUrl: question.answerClipUrl,
            answerDuration: question.answerDuration,
            answerAspectRatio: question.answerAspectRatio,
            tags,
            suggestedByName,
            isUpvoted,
            goalReached: question.goalReachedEmailSent,
            goalReachedAt: question.goalReachedAt?.toISOString() ?? null,
            deadlineMissed: question.deadlineMissed,
          }}
          basePath={basePath}
          appUrl={appUrl}
          partySlug={partySlug}
          politicianSlug={politicianSlug}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
          partyColorLight={party?.colorLight ?? null}
          hasSession={!!citizen}
          politicianName={politician.name}
          politicianFirstName={politician.name.split(" ")[0]}
          partyName={politician.party}
        />

        {/* Ellipse menu for logged-in citizens */}
        <QuestionDetailEllipsis
          hasSession={!!citizen}
          citizenEmail={citizen?.email ?? null}
          partySlug={partySlug}
          politicianSlug={politicianSlug}
          partyColor={partyColor}
          partyColorDark={partyColorDark}
        />

        {politician.chatbaseId && (
          <div className="max-w-2xl mx-auto">
            <ChatbaseWidget chatbotId={politician.chatbaseId} />
          </div>
        )}
      </main>
      </div>
    </>
  );
}
