import { auth } from "@/lib/auth";
import { getAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";
import { AdminPartyForm } from "@/components/AdminPartyForm";

export default async function NewPartyPage() {
  const session = await auth();
  if (!session) redirect("/admin");
  const admin = await getAdmin(session);
  if (!admin) redirect("/admin");

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">&larr; Tilbage til admin</a>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Opret parti</h1>
      </div>
      <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <AdminPartyForm party={null} />
      </section>
    </main>
  );
}
