import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db";
import { politicians, parties, questions, questionTags, upvotes, citizens } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getCitizenFromSession } from "@/lib/citizen-session";
import { SuccessBanner } from "@/components/SuccessBanner";
import { QuestionFeedFilter } from "@/components/QuestionFeedFilter";
import { citizenLogout } from "./actions";
import { ChatbaseWidget } from "@/components/ChatbaseWidget";
import { IntroSection } from "@/components/IntroSection";
import { PoliticianTopBar } from "@/components/PoliticianTopBar";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partySlug: string; politicianSlug: string }>;
}): Promise<Metadata> {
  const { partySlug, politicianSlug } = await params;

  const [politician] = await db
    .select({ name: politicians.name, party: politicians.party })
    .from(politicians)
    .where(
      and(
        eq(politicians.partySlug, partySlug),
        eq(politicians.slug, politicianSlug)
      )
    )
    .limit(1);

  if (!politician) return { title: "Ikke fundet" };

  return {
    title: `${politician.name} / ${politician.party}`,
  };
}

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
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  const allQuestions = await db
    .select()
    .from(questions)
    .where(eq(questions.politicianId, politician.id))
    .orderBy(desc(questions.createdAt));

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

  // Fetch "suggested by" citizen names
  const suggestedByNames = new Map<string, string>();
  const suggestedQuestions = allQuestions.filter((q) => q.suggestedByCitizenId);
  if (suggestedQuestions.length > 0) {
    const citizenIds = [...new Set(suggestedQuestions.map((q) => q.suggestedByCitizenId!))];
    const suggesters = await db
      .select({ id: citizens.id, firstName: citizens.firstName, age: citizens.age })
      .from(citizens)
      .where(inArray(citizens.id, citizenIds));
    for (const c of suggesters) {
      suggestedByNames.set(c.id, c.firstName + (c.age ? `, ${c.age} år` : ""));
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

  // Prepare data for filter component
  const politicianFirstName = politician.name.split(" ")[0];
  const allTagsSet = new Set<string>();
  tagsByQuestion.forEach((tags) => tags.forEach((t) => allTagsSet.add(t)));

  const feedQuestions = allQuestions.map((q) => ({
    id: q.id,
    text: q.text,
    upvoteCount: q.upvoteCount,
    upvoteGoal: q.upvoteGoal,
    answerUrl: q.answerUrl,
    answerPhotoUrl: q.answerPhotoUrl,
    goalReachedEmailSent: q.goalReachedEmailSent,
    suggestedBy: q.suggestedByCitizenId
      ? suggestedByNames.get(q.suggestedByCitizenId) ?? null
      : null,
    tags: tagsByQuestion.get(q.id) ?? [],
    isUpvoted: citizenUpvotedIds.has(q.id),
    createdAt: q.createdAt.toISOString(),
    pinned: q.pinned,
  }));

  // Fetch party data (needed for top bar colors + hero color resolution)
  const [party] = politician.partyId
    ? await db.select().from(parties).where(eq(parties.id, politician.partyId)).limit(1)
    : [undefined];

  // Resolve hero text color keys ("primary", "light", "dark") to actual party hex values
  let resolvedHeroLine1Color = politician.heroLine1Color;
  let resolvedHeroLine2Color = politician.heroLine2Color;
  if (party && (politician.heroLine1Color || politician.heroLine2Color)) {
    const colorMap: Record<string, string | null> = {
      primary: party.color,
      light: party.colorLight,
      dark: party.colorDark,
    };
    resolvedHeroLine1Color = colorMap[politician.heroLine1Color ?? ""] ?? politician.heroLine1Color;
    resolvedHeroLine2Color = colorMap[politician.heroLine2Color ?? ""] ?? politician.heroLine2Color;
  }

  return (
    <>
      <PoliticianTopBar
        politicianName={politician.name}
        partyName={politician.party}
        profilePhotoUrl={politician.profilePhotoUrl}
        partyLogoUrl={party?.logoUrl ?? null}
        constituency={politician.constituency}
        partyColor={party?.color ?? null}
        partyColorDark={party?.colorDark ?? null}
        partyColorLight={party?.colorLight ?? null}
        politicianId={politician.id}
        partySlug={partySlug}
        politicianSlug={politicianSlug}
        hasSession={!!citizen}
      />
      <IntroSection
        politicianFirstName={politicianFirstName}
        bannerUrl={politician.bannerUrl}
        bannerBgColor={politician.bannerBgColor}
        heroLine1={politician.heroLine1}
        heroLine1Color={resolvedHeroLine1Color}
        heroLine2={politician.heroLine2}
        heroLine2Color={resolvedHeroLine2Color}
      />
      <main className="max-w-2xl mx-auto p-6">
        <Suspense>
          <SuccessBanner />
        </Suspense>

      {allQuestions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Der er endnu ingen spørgsmål fra denne politiker.
        </p>
      ) : (
        <QuestionFeedFilter
          questions={feedQuestions}
          allTags={[...allTagsSet]}
          politicianFirstName={politicianFirstName}
          politicianName={politician.name}
          basePath={basePath}
          appUrl={appUrl!}
          hasSession={!!citizen}
          partySlug={partySlug}
          politicianSlug={politicianSlug}
          partyColor={party?.color ?? null}
          partyColorDark={party?.colorDark ?? null}
          partyColorLight={party?.colorLight ?? null}
        />
      )}

      {citizen && (
        <div className="text-center mt-8 space-y-2" style={{ fontFamily: "var(--font-dm-sans)", fontWeight: 500 }}>
          <p className="text-sm" style={{ color: "#7E7D7A" }}>
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
              className="text-sm transition cursor-pointer hover:opacity-50"
              style={{ color: party?.color || "#3B82F6" }}
            >
              Log ud
            </button>
          </form>
        </div>
      )}
      {politician.chatbaseId && (
        <ChatbaseWidget chatbotId={politician.chatbaseId} />
      )}
    </main>
    </>
  );
}
