import type { Metadata } from "next";
import { auth, signIn, signOut } from "@/lib/auth";
import { getAdmin } from "@/lib/admin";
import { db } from "@/db";
import { politicians } from "@/db/schema";
import { asc } from "drizzle-orm";
import { AdminPoliticianList } from "@/components/AdminPoliticianList";

export const metadata: Metadata = {
  title: "Admin — Introkrati",
};

export default async function AdminPage() {
  const session = await auth();

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-sm">
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">Admin Login</h1>
            <p className="text-gray-600 text-sm">Log ind med din admin-konto</p>
          </div>
          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/admin" });
            }}
          >
            <button
              type="submit"
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition font-medium cursor-pointer"
            >
              Log ind med Google
            </button>
          </form>
        </div>
      </main>
    );
  }

  const admin = await getAdmin(session);
  if (!admin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm p-8 space-y-6 bg-white rounded-xl shadow-sm text-center">
          <h1 className="text-2xl font-bold text-red-600">Adgang nægtet</h1>
          <p className="text-gray-600 text-sm">
            Din konto ({session.user?.email}) har ikke admin-rettigheder.
          </p>
        </div>
      </main>
    );
  }

  const allPoliticians = await db
    .select({
      id: politicians.id,
      name: politicians.name,
      party: politicians.party,
      partyId: politicians.partyId,
      email: politicians.email,
      profilePhotoUrl: politicians.profilePhotoUrl,
      slug: politicians.slug,
      partySlug: politicians.partySlug,
    })
    .from(politicians)
    .orderBy(asc(politicians.party), asc(politicians.name));

  // Group by party
  const partyGroups: { party: string; partyId: string | null; politicians: typeof allPoliticians }[] = [];
  for (const p of allPoliticians) {
    const groupKey = p.party || "Intet parti";
    const existing = partyGroups.find((g) => g.party === groupKey);
    if (existing) {
      existing.politicians.push(p);
    } else {
      partyGroups.push({ party: groupKey, partyId: p.partyId, politicians: [p] });
    }
  }

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        <p className="text-gray-600 mt-1">
          {allPoliticians.length} {allPoliticians.length === 1 ? "politiker" : "politikere"} i systemet
        </p>
      </div>

      <div className="flex gap-3">
        <a
          href="/admin/party/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
        >
          Opret parti
        </a>
        <a
          href="/admin/politician/new"
          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition"
        >
          Opret politiker
        </a>
      </div>

      {partyGroups.length === 0 ? (
        <p className="text-gray-500 text-center py-8">
          Der er ingen politikere i systemet endnu.
        </p>
      ) : (
        <AdminPoliticianList groups={partyGroups} />
      )}

      <div className="text-center space-y-2">
        <p className="text-sm text-gray-500">
          Logget ind som {session.user?.email}
        </p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/admin" });
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
    </main>
  );
}
