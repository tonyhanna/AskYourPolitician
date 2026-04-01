import type { Metadata } from "next";
import { auth, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { politicians, questions, questionTags, causes, questionSuggestions, citizens, parties } from "@/db/schema";
import { eq, desc, inArray, and } from "drizzle-orm";
import { QuestionForm } from "@/components/QuestionForm";
import { SettingsForm } from "@/components/SettingsForm";
import { QuestionList } from "@/components/QuestionList";
import { CauseForm } from "@/components/CauseForm";
import { CauseList } from "@/components/CauseList";
import { getActivePolitician, getImpersonatingPoliticianId } from "@/lib/admin";
import { DashboardTabs } from "@/components/DashboardTabs";
import { PoliticianTopBar } from "@/components/PoliticianTopBar";
import { ThemeColorSetter } from "@/components/ThemeColorSetter";

export async function generateMetadata(): Promise<Metadata> {
  const politician = await getActivePolitician();
  return {
    title: politician
      ? `Politiker Dashboard / ${politician.name}`
      : "Politiker Dashboard",
  };
}

export default async function Dashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/politiker");

  const impersonatingId = await getImpersonatingPoliticianId();
  const politician = await getActivePolitician();

  // Block access if no politician profile was pre-created by admin
  if (!politician && !impersonatingId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-gray-900 mb-3">Ingen adgang</h1>
          <p className="text-gray-600 mb-6">
            Din Google-konto er ikke tilknyttet en politikerprofil. Kontakt en administrator for at få adgang.
          </p>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/politiker" }); }}>
            <button type="submit" className="px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition cursor-pointer">
              Log ud
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Fetch all parties for dropdown
  const allParties = await db
    .select({ id: parties.id, name: parties.name, color: parties.color, colorLight: parties.colorLight, colorDark: parties.colorDark, logoUrl: parties.logoUrl, topbarLeft1Color: parties.topbarLeft1Color, topbarLeft1Opacity: parties.topbarLeft1Opacity, topbarLeft2Color: parties.topbarLeft2Color, topbarLeft2Opacity: parties.topbarLeft2Opacity, topbarRightColor: parties.topbarRightColor, topbarRightOpacity: parties.topbarRightOpacity })
    .from(parties)
    .orderBy(parties.name);

  let politicianQuestions: {
    id: string;
    text: string;
    upvoteGoal: number;
    upvoteCount: number;
    tags: string[];
    goalReached: boolean;
    goalReachedAt: string | null;
    deadlineMissed: boolean;
    answerUrl: string | null;
    answerPhotoUrl: string | null;
    answerClipUrl: string | null;
    suggestedBy: string | null;
    pinned: boolean;
    muxAssetId: string | null;
    muxPlaybackId: string | null;
    muxAssetStatus: string | null;
    muxMediaType: string | null;
  }[] = [];

  let politicianCauses: {
    id: string;
    title: string;
    shortDescription: string;
    longDescription: string | null;
    videoUrl: string | null;
    points: string[];
    tagId: string;
    sortOrder: number;
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
        .select({ id: citizens.id, firstName: citizens.firstName, age: citizens.age })
        .from(citizens)
        .where(inArray(citizens.id, suggestedCitizenIds));

      for (const c of suggestedCitizens) {
        suggestedByNames.set(c.id, c.firstName + (c.age ? `, ${c.age} år` : ""));
      }
    }

    politicianQuestions = rawQuestions.map((q) => ({
      id: q.id,
      text: q.text,
      upvoteGoal: q.upvoteGoal,
      upvoteCount: q.upvoteCount,
      tags: tagsByQuestion.get(q.id) ?? [],
      goalReached: q.goalReachedEmailSent,
      goalReachedAt: q.goalReachedAt ? q.goalReachedAt.toISOString() : null,
      deadlineMissed: q.deadlineMissed,
      answerUrl: q.answerUrl,
      answerPhotoUrl: q.answerPhotoUrl,
      answerClipUrl: q.answerClipUrl,
      suggestedBy: q.suggestedByCitizenId
        ? suggestedByNames.get(q.suggestedByCitizenId) ?? null
        : null,
      pinned: q.pinned,
      muxAssetId: q.muxAssetId ?? null,
      muxPlaybackId: q.muxPlaybackId ?? null,
      muxAssetStatus: q.muxAssetStatus ?? null,
      muxMediaType: q.muxMediaType ?? null,
    }));

    // Fetch causes
    const rawCauses = await db
      .select()
      .from(causes)
      .where(eq(causes.politicianId, politician.id))
      .orderBy(causes.sortOrder);

    politicianCauses = rawCauses.map((c) => {
      let parsedPoints: string[] = [];
      if (c.points) {
        try { parsedPoints = JSON.parse(c.points); } catch {}
      }
      return {
        id: c.id,
        title: c.title,
        shortDescription: c.shortDescription,
        longDescription: c.longDescription,
        videoUrl: c.videoUrl,
        points: parsedPoints,
        tagId: c.tagId,
        sortOrder: c.sortOrder,
        inUse: usedTagIds.has(c.tagId),
      };
    });

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
        citizenAge: citizens.age,
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
      citizenFirstName: s.citizenFirstName + (s.citizenAge ? `, ${s.citizenAge} år` : ""),
      text: s.text,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const uniqueUrl = politician ? `${appUrl}/${politician.partySlug}/${politician.slug}` : null;
  const party = politician ? allParties.find((p) => p.id === politician.partyId) : null;

  return (
    <>
      {/* SSR theme-color meta tag for Safari/Chrome mobile toolbar */}
      {party?.color && <meta name="theme-color" content={party.color} />}
      {/* SSR style: paint body bg to party color for overscroll rubber-band */}
      {party?.color && politician && (
        <style precedence="theme" href={`theme-dashboard-${politician.partySlug}`}>{`html body{background-color:${party.color}}`}</style>
      )}
      {/* Client-side: toggle body bg based on scroll (party color at top, system bg when scrolled) */}
      {party?.color && <ThemeColorSetter color={party.color} />}
      <div className="min-h-dvh flex flex-col" style={{ "--party-primary": party?.color || "#FF0000", "--party-dark": party?.colorDark || "#FF0000", "--party-light": party?.colorLight || "#FF0000" } as React.CSSProperties}>
      {politician && party && (
        <PoliticianTopBar
          mode="dashboard"
          politicianName={politician.name}
          partyName={politician.party}
          profilePhotoUrl={politician.profilePhotoUrl}
          partyLogoUrl={party.logoUrl ?? null}
          constituency={politician.constituency}
          politicianId={politician.id}
          partySlug={politician.partySlug}
          politicianSlug={politician.slug}
          hasSession={true}
          citizenPageUrl={uniqueUrl}
          isImpersonating={!!impersonatingId}
          topbarLeft1Color={party.topbarLeft1Color ?? null}
          topbarLeft1Opacity={party.topbarLeft1Opacity ?? null}
          topbarLeft2Color={party.topbarLeft2Color ?? null}
          topbarLeft2Opacity={party.topbarLeft2Opacity ?? null}
          topbarRightColor={party.topbarRightColor ?? null}
          topbarRightOpacity={party.topbarRightOpacity ?? null}
        />
      )}
    <main className="flex-1 w-full px-[15px] pt-[15px]" style={{ backgroundColor: "var(--system-bg0, #FF0000)" }}>

      {politician ? (
        <DashboardTabs
          logoutAction={async () => { "use server"; await signOut({ redirectTo: "/politiker" }); }}
          questionsTab={
            <div key="questions" className="space-y-6">
              <QuestionForm
                politicianId={politician.id}
                disabled={false}
                availableTags={availableTags}
                defaultUpvoteGoal={politician.defaultUpvoteGoal}
              />
              {(politicianQuestions.length > 0 || pendingSuggestions.length > 0) && (
                  <QuestionList
                    questions={politicianQuestions}
                    availableTags={availableTags}
                    basePath={uniqueUrl!}
                    pendingSuggestions={pendingSuggestions}
                  />
              )}
            </div>
          }
          causesTab={
            <div key="causes" className="space-y-6">
              <CauseForm politicianId={politician.id} />
              {politicianCauses.length > 0 && (
                  <CauseList causes={politicianCauses} />
              )}
            </div>
          }
          settingsTab={
            <div key="settings" className="space-y-6">
              {uniqueUrl && (
                <div className="p-3 bg-gray-50 rounded-lg">
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
              <SettingsForm
                politician={{
                  name: politician.name,
                  firstName: politician.firstName,
                  middleName: politician.middleName,
                  lastName: politician.lastName,
                  partyId: politician.partyId,
                  email: politician.email,
                  slug: politician.slug,
                  constituency: politician.constituency,
                  profilePhotoUrl: politician.profilePhotoUrl,
                  bannerUrl: politician.bannerUrl,
                  ogImageUrl: politician.ogImageUrl,
                  bannerBgColor: politician.bannerBgColor,
                  heroLine1: politician.heroLine1,
                  heroLine1Color: politician.heroLine1Color,
                  heroLine2: politician.heroLine2,
                  heroLine2Color: politician.heroLine2Color,
                  chatbaseId: politician.chatbaseId,
                  defaultUpvoteGoal: politician.defaultUpvoteGoal,
                }}
                allParties={allParties}
                googleEmail={session.user.email!}
                googleName={session.user.name ?? ""}
              />
            </div>
          }
        />
      ) : (
        <div className="max-w-4xl mx-auto px-6 space-y-6">
            <SettingsForm
              politician={null}
              allParties={allParties}
              googleEmail={session.user.email!}
              googleName={session.user.name ?? ""}
            />
        </div>
      )}
    </main>
      </div>
    </>
  );
}
