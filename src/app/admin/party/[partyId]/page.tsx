import { auth } from "@/lib/auth";
import { getAdmin } from "@/lib/admin";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { parties } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AdminPartyForm } from "@/components/AdminPartyForm";

export default async function EditPartyPage({ params }: { params: Promise<{ partyId: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin");
  const admin = await getAdmin(session);
  if (!admin) redirect("/admin");

  const { partyId } = await params;

  const [party] = await db
    .select()
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);

  if (!party) notFound();

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">&larr; Tilbage til admin</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Rediger parti: {party.name}</h1>
      </div>
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <AdminPartyForm party={{
          id: party.id,
          name: party.name,
          logoUrl: party.logoUrl,
          color: party.color,
          colorLight: party.colorLight,
          colorDark: party.colorDark,
          topbarLeft1Color: party.topbarLeft1Color,
          topbarLeft1Opacity: party.topbarLeft1Opacity,
          topbarLeft2Color: party.topbarLeft2Color,
          topbarLeft2Opacity: party.topbarLeft2Opacity,
          topbarRightColor: party.topbarRightColor,
          topbarRightOpacity: party.topbarRightOpacity,
          topbarBgColor: party.topbarBgColor,
          topbarBtnBg: party.topbarBtnBg,
          topbarBtnIcon: party.topbarBtnIcon,
          topbarAccentBtnBg: party.topbarAccentBtnBg,
          topbarAccentBtnIcon: party.topbarAccentBtnIcon,
          fabBtnBg: party.fabBtnBg,
          fabBtnIcon: party.fabBtnIcon,
          inlineBtnBg: party.inlineBtnBg,
          inlineBtnIcon: party.inlineBtnIcon,
        }} />
      </section>
    </main>
  );
}
