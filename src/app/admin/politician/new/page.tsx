import { auth } from "@/lib/auth";
import { getAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { parties } from "@/db/schema";
import { asc } from "drizzle-orm";
import { AdminPoliticianForm } from "@/components/AdminPoliticianForm";

export default async function NewPoliticianPage() {
  const session = await auth();
  if (!session) redirect("/admin");
  const admin = await getAdmin(session);
  if (!admin) redirect("/admin");

  const allParties = await db
    .select({ id: parties.id, name: parties.name, color: parties.color, colorLight: parties.colorLight, colorDark: parties.colorDark })
    .from(parties)
    .orderBy(asc(parties.name));

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">&larr; Tilbage til admin</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Opret politiker</h1>
      </div>
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <AdminPoliticianForm politician={null} allParties={allParties} />
      </section>
    </main>
  );
}
