import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { db } from "@/db";
import { admins, politicians } from "@/db/schema";
import { eq } from "drizzle-orm";

export const IMPERSONATE_COOKIE = "impersonate_politician_id";

export async function getAdmin(session: { user?: { email?: string | null } } | null) {
  if (!session?.user?.email) return null;
  const [admin] = await db
    .select()
    .from(admins)
    .where(eq(admins.email, session.user.email))
    .limit(1);
  return admin ?? null;
}

export async function getActivePolitician() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const admin = await getAdmin(session);
  if (admin) {
    const cookieStore = await cookies();
    const impersonateId = cookieStore.get(IMPERSONATE_COOKIE)?.value;
    if (impersonateId) {
      const [politician] = await db
        .select()
        .from(politicians)
        .where(eq(politicians.id, impersonateId))
        .limit(1);
      return politician ?? null;
    }
  }

  const [politician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, session.user.id))
    .limit(1);
  return politician ?? null;
}

export async function getImpersonatingPoliticianId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const admin = await getAdmin(session);
  if (!admin) return null;

  const cookieStore = await cookies();
  return cookieStore.get(IMPERSONATE_COOKIE)?.value ?? null;
}
