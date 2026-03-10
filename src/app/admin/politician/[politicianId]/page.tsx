import { auth } from "@/lib/auth";
import { getAdmin } from "@/lib/admin";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { politicians, parties } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { AdminPoliticianForm } from "@/components/AdminPoliticianForm";

export default async function EditPoliticianPage({ params }: { params: Promise<{ politicianId: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin");
  const admin = await getAdmin(session);
  if (!admin) redirect("/admin");

  const { politicianId } = await params;

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.id, politicianId))
    .limit(1);

  if (!politician) notFound();

  const allParties = await db
    .select({ id: parties.id, name: parties.name, color: parties.color, colorLight: parties.colorLight, colorDark: parties.colorDark })
    .from(parties)
    .orderBy(asc(parties.name));

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">&larr; Tilbage til admin</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Rediger politiker: {politician.name}</h1>
      </div>
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <AdminPoliticianForm
          politician={{
            id: politician.id,
            name: politician.name,
            email: politician.email,
            partyId: politician.partyId,
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
        />
      </section>
    </main>
  );
}
