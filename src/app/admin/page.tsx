import type { Metadata } from "next";
import { auth, signIn, signOut } from "@/lib/auth";
import { getAdmin } from "@/lib/admin";
import { db } from "@/db";
import { politicians, admins } from "@/db/schema";
import { asc } from "drizzle-orm";
import { AdminPoliticianList } from "@/components/AdminPoliticianList";
import { AdminTabs } from "@/components/AdminTabs";
import { AdminSettingsForm } from "@/components/AdminSettingsForm";
import { AdminUserList } from "@/components/AdminUserList";
import { getAppSettings } from "@/lib/settings";

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

  const [allPoliticians, settings, allAdmins] = await Promise.all([
    db
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
      .orderBy(asc(politicians.party), asc(politicians.name)),
    getAppSettings(),
    db.select().from(admins).orderBy(asc(admins.email)),
  ]);

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
    <>
    <style precedence="theme" href="theme-admin">{`html body{background-color:#f9fafb}`}</style>
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">
        <span className="text-[#AAAAAA]">Introkrati:</span> Admin
      </h1>

      <AdminTabs
        userEmail={session.user?.email || ""}
        logoutAction={async () => {
          "use server";
          await signOut({ redirectTo: "/admin" });
        }}
        politiciansTab={
          <div className="space-y-6">
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
          </div>
        }
        usersTab={
          <AdminUserList
            admins={allAdmins}
            currentAdminEmail={session.user?.email || ""}
          />
        }
        settingsTab={
          <AdminSettingsForm
            colorBg0={settings.colorBg0}
            colorBg0Dark={settings.colorBg0Dark}
            colorBg0Contrast={settings.colorBg0Contrast}
            colorBg0ContrastDark={settings.colorBg0ContrastDark}
            colorBg1={settings.colorBg1}
            colorBg1Dark={settings.colorBg1Dark}
            colorBg2={settings.colorBg2}
            colorBg2Dark={settings.colorBg2Dark}
            colorText0={settings.colorText0}
            colorText0Dark={settings.colorText0Dark}
            colorText0Contrast={settings.colorText0Contrast}
            colorText0ContrastDark={settings.colorText0ContrastDark}
            colorText1={settings.colorText1}
            colorText1Dark={settings.colorText1Dark}
            colorText2={settings.colorText2}
            colorText2Dark={settings.colorText2Dark}
            colorText3={settings.colorText3}
            colorText3Dark={settings.colorText3Dark}
            colorIcon0={settings.colorIcon0}
            colorIcon0Dark={settings.colorIcon0Dark}
            colorIcon0Contrast={settings.colorIcon0Contrast}
            colorIcon0ContrastDark={settings.colorIcon0ContrastDark}
            colorIcon1={settings.colorIcon1}
            colorIcon1Dark={settings.colorIcon1Dark}
            colorIcon2={settings.colorIcon2}
            colorIcon2Dark={settings.colorIcon2Dark}
            colorIcon3={settings.colorIcon3}
            colorIcon3Dark={settings.colorIcon3Dark}
            colorAccent0={settings.colorAccent0}
            colorAccent0Dark={settings.colorAccent0Dark}
            colorAccent0Contrast={settings.colorAccent0Contrast}
            colorAccent0ContrastDark={settings.colorAccent0ContrastDark}
            colorAccent1={settings.colorAccent1}
            colorAccent1Dark={settings.colorAccent1Dark}
            colorAccent1Contrast={settings.colorAccent1Contrast}
            colorAccent1ContrastDark={settings.colorAccent1ContrastDark}
            colorSuccess={settings.colorSuccess}
            colorSuccessDark={settings.colorSuccessDark}
            colorSuccessContrast={settings.colorSuccessContrast}
            colorSuccessContrastDark={settings.colorSuccessContrastDark}
            colorPending={settings.colorPending}
            colorPendingDark={settings.colorPendingDark}
            colorPendingContrast={settings.colorPendingContrast}
            colorPendingContrastDark={settings.colorPendingContrastDark}
            colorError={settings.colorError}
            colorErrorDark={settings.colorErrorDark}
            colorErrorContrast={settings.colorErrorContrast}
            colorErrorContrastDark={settings.colorErrorContrastDark}
            colorOverlay={settings.colorOverlay}
            colorOverlayDark={settings.colorOverlayDark}
            colorFormBg0={settings.colorFormBg0}
            colorFormBg0Dark={settings.colorFormBg0Dark}
            colorFormBg1={settings.colorFormBg1}
            colorFormBg1Dark={settings.colorFormBg1Dark}
            colorFormText0={settings.colorFormText0}
            colorFormText0Dark={settings.colorFormText0Dark}
            colorFormText1={settings.colorFormText1}
            colorFormText1Dark={settings.colorFormText1Dark}
          />
        }
      />
    </main>
    </>
  );
}
