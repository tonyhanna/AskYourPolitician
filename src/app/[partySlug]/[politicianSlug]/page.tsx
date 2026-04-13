import type { Metadata } from "next";
import { db } from "@/db";
import { politicians, parties, questions, questionTags, upvotes, citizens, causes } from "@/db/schema";
import { eq, and, desc, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getCitizenFromSession } from "@/lib/citizen-session";
import { QuestionFeedFilter } from "@/components/QuestionFeedFilter";
import { ChatbaseWidget } from "@/components/ChatbaseWidget";
import { IntroSection } from "@/components/IntroSection";
import { PoliticianTopBar } from "@/components/PoliticianTopBar";
import { ThemeColorSetter } from "@/components/ThemeColorSetter";
import { getAppSettings } from "@/lib/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partySlug: string; politicianSlug: string }>;
}): Promise<Metadata> {
  const { partySlug, politicianSlug } = await params;

  const [politician] = await db
    .select({
      name: politicians.name,
      party: politicians.party,
      ogImageUrl: politicians.ogImageUrl,
    })
    .from(politicians)
    .where(
      and(
        eq(politicians.partySlug, partySlug),
        eq(politicians.slug, politicianSlug)
      )
    )
    .limit(1);

  if (!politician) return { title: "Ikke fundet" };

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;

  return {
    title: `${politician.name} / ${politician.party}`,
    openGraph: {
      title: `${politician.name} / ${politician.party}`,
      url: `${appUrl}/${partySlug}/${politicianSlug}`,
      type: "website",
      ...(politician.ogImageUrl ? { images: [{ url: politician.ogImageUrl, width: 1200, height: 630 }] } : {}),
    },
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
  const politicianFirstName = politician.firstName || politician.name.split(" ")[0];

  // Collect all tags: from questions AND from politician's defined causes
  const allTagsSet = new Set<string>();
  tagsByQuestion.forEach((tags) => tags.forEach((t) => allTagsSet.add(t)));
  const politicianCauses = await db
    .select({ tagId: causes.tagId })
    .from(causes)
    .where(eq(causes.politicianId, politician.id));
  for (const c of politicianCauses) allTagsSet.add(c.tagId);

  const feedQuestions = allQuestions
    .filter((q) => !q.archived && !(q.deadlineMissed && !q.answerUrl && !q.muxAssetStatus)) // Hide archived + missed unanswered from citizens
    .map((q) => ({
      id: q.id,
      text: q.text,
      upvoteCount: q.upvoteCount,
      upvoteGoal: q.upvoteGoal,
      answerUrl: q.answerUrl,
      answerPhotoUrl: q.answerPhotoUrl,
      answerClipUrl: q.answerClipUrl,
      answerDuration: q.answerDuration ?? null,
      answerAspectRatio: q.answerAspectRatio ?? null,
      muxPlaybackId: q.muxPlaybackId ?? null,
      muxAssetStatus: q.muxAssetStatus ?? null,
      muxMediaType: q.muxMediaType ?? null,
      goalReachedEmailSent: q.goalReachedEmailSent,
      goalReachedAt: q.goalReachedAt ? q.goalReachedAt.toISOString() : null,
      deadlineMissed: q.deadlineMissed,
      suggestedBy: q.suggestedByCitizenId
        ? suggestedByNames.get(q.suggestedByCitizenId) ?? null
        : null,
      tags: tagsByQuestion.get(q.id) ?? [],
      isUpvoted: citizenUpvotedIds.has(q.id),
      createdAt: q.createdAt.toISOString(),
      pinned: q.pinned,
    }));

  // Fetch app settings + party data
  const appSettings = await getAppSettings();

  const [party] = politician.partyId
    ? await db.select().from(parties).where(eq(parties.id, politician.partyId)).limit(1)
    : [undefined];

  // Resolve hero text color keys ("accent", "light", "dark") to actual party hex values
  let resolvedHeroLine1Color = politician.heroLine1Color;
  let resolvedHeroLine2Color = politician.heroLine2Color;
  if (party && (politician.heroLine1Color || politician.heroLine2Color)) {
    const colorMap: Record<string, string | null> = {
      accent: party.color,
      light: party.colorLight,
      dark: party.colorDark,
    };
    resolvedHeroLine1Color = colorMap[politician.heroLine1Color ?? ""] ?? politician.heroLine1Color;
    resolvedHeroLine2Color = colorMap[politician.heroLine2Color ?? ""] ?? politician.heroLine2Color;
  }

  // Resolve topbar bg color for theme-color meta + rubber-band
  const resolvePartyColor = (key: string | null | undefined, fb: string) => {
    if (!key) return fb;
    if (key === "accent") return party?.color || fb;
    if (key === "light") return party?.colorLight || fb;
    if (key === "dark") return party?.colorDark || fb;
    return key;
  };
  const topbarBgColor = resolvePartyColor(party?.topbarBgColor, "#FF0000");

  return (
    <>
      {/* SSR theme-color meta tag for Safari/Chrome mobile toolbar */}
      {party?.color && <meta name="theme-color" content={topbarBgColor} />}
      {/* SSR style: paint body bg to topbar color for overscroll rubber-band */}
      {party?.color && (
        <style precedence="theme" href={`theme-${partySlug}`}>{`html body{background-color:${topbarBgColor}}`}</style>
      )}
      {/* Client-side: toggle body bg based on scroll (topbar color at top, system bg when scrolled) */}
      {party?.color && <ThemeColorSetter color={topbarBgColor} />}
      <div className="min-h-dvh flex flex-col" style={{ "--party-accent": party?.color || "#FF0000", "--party-dark": party?.colorDark || "#FF0000", "--party-light": party?.colorLight || "#FF0000", ...(() => {
        const rc = (key: string | null | undefined, fb: string) => {
          if (!key) return fb;
          if (key === "accent") return party?.color || fb;
          if (key === "light") return party?.colorLight || fb;
          if (key === "dark") return party?.colorDark || fb;
          return key;
        };
        return {
          "--topbar-bg": rc(party?.topbarBgColor, "#FF0000"),
          "--topbar-btn-bg": rc(party?.topbarBtnBg, "#FF0000"),
          "--topbar-btn-icon": rc(party?.topbarBtnIcon, "#FF0000"),
          "--topbar-accent-btn-bg": rc(party?.topbarAccentBtnBg, "#FF0000"),
          "--topbar-accent-btn-icon": rc(party?.topbarAccentBtnIcon, "#FF0000"),
          "--fab-btn-bg": rc(party?.fabBtnBg, "#FF0000"),
          "--fab-btn-icon": rc(party?.fabBtnIcon, "#FF0000"),
          "--inline-btn-bg": rc(party?.inlineBtnBg, "#FF0000"),
          "--inline-btn-icon": rc(party?.inlineBtnIcon, "#FF0000"),
        };
      })() } as React.CSSProperties}>
      <PoliticianTopBar
        politicianName={politician.name}
        partyName={politician.party}
        profilePhotoUrl={politician.profilePhotoUrl}
        partyLogoUrl={party?.logoUrl ?? null}
        constituency={politician.constituency}
        topbarLeft1Color={party?.topbarLeft1Color ?? null}
        topbarLeft1Opacity={party?.topbarLeft1Opacity ?? null}
        topbarLeft2Color={party?.topbarLeft2Color ?? null}
        topbarLeft2Opacity={party?.topbarLeft2Opacity ?? null}
        topbarRightColor={party?.topbarRightColor ?? null}
        topbarRightOpacity={party?.topbarRightOpacity ?? null}
        politicianId={politician.id}
        partySlug={partySlug}
        politicianSlug={politicianSlug}
        hasSession={!!citizen}
      />
      <IntroSection
        bannerUrl={politician.bannerUrl}
        bannerBgColor={politician.bannerBgColor}
        heroLine1={politician.heroLine1}
        heroLine1Color={resolvedHeroLine1Color}
        heroLine2={politician.heroLine2}
        heroLine2Color={resolvedHeroLine2Color}
        politicianSlug={politicianSlug}
      />
      <main className="px-[15px] pt-[15px] pb-1 flex flex-col flex-1" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>
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
        citizenEmail={citizen?.email ?? null}
      />

        <div className="max-w-2xl mx-auto">
          {politician.chatbaseId && (
            <ChatbaseWidget chatbotId={politician.chatbaseId} />
          )}
        </div>
      </main>
      </div>
    </>
  );
}
