import { cookies } from "next/headers";
import { db } from "@/db";
import { citizenSessions, citizens } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

const COOKIE_NAME = "citizen_session";
const SESSION_DURATION_DAYS = 30;

export async function getCitizenFromSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const result = await db
    .select({
      id: citizens.id,
      firstName: citizens.firstName,
      email: citizens.email,
    })
    .from(citizenSessions)
    .innerJoin(citizens, eq(citizenSessions.citizenId, citizens.id))
    .where(
      and(
        eq(citizenSessions.token, token),
        gt(citizenSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return result[0] ?? null;
}

export async function createCitizenSession(citizenId: string): Promise<string> {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  await db.insert(citizenSessions).values({
    token,
    citizenId,
    expiresAt,
  });

  return token;
}

export async function clearCitizenSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(citizenSessions).where(eq(citizenSessions.token, token));
  }
  cookieStore.delete(COOKIE_NAME);
}

export async function setCitizenSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: "/",
  });
}
