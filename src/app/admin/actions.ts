"use server";

import { auth } from "@/lib/auth";
import { getAdmin, IMPERSONATE_COOKIE } from "@/lib/admin";
import { cookies } from "next/headers";
import { db } from "@/db";
import { parties, politicians, users, appSettings, admins } from "@/db/schema";
import { eq } from "drizzle-orm";
import { generateSlug } from "@/lib/utils";
import { revalidatePath } from "next/cache";
import { del } from "@vercel/blob";
import { isBlobUrl } from "@/lib/answer-utils";

async function requireAdmin() {
  const session = await auth();
  const admin = await getAdmin(session);
  if (!admin) throw new Error("Unauthorized");
  return admin;
}

// --- Impersonation ---

export async function startImpersonation(politicianId: string) {
  await requireAdmin();
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATE_COOKIE, politicianId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function stopImpersonation() {
  await requireAdmin();
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATE_COOKIE);
}

// --- Party CRUD ---

export async function createParty(formData: FormData) {
  await requireAdmin();

  const name = formData.get("name") as string;
  const logoUrl = (formData.get("logoUrl") as string) || null;
  const color = (formData.get("color") as string) || null;
  const colorLight = (formData.get("colorLight") as string) || null;
  const colorDark = (formData.get("colorDark") as string) || null;

  if (!name) throw new Error("Parti-navn er påkrævet");

  const slug = generateSlug(name);

  const [existing] = await db
    .select()
    .from(parties)
    .where(eq(parties.slug, slug))
    .limit(1);

  if (existing) throw new Error("Et parti med dette navn eksisterer allerede");

  await db.insert(parties).values({
    name,
    slug,
    logoUrl,
    color,
    colorLight,
    colorDark,
  });

  revalidatePath("/admin");
}

export async function updateParty(formData: FormData) {
  await requireAdmin();

  const partyId = formData.get("partyId") as string;
  const name = formData.get("name") as string;
  const logoUrl = (formData.get("logoUrl") as string) || null;
  const color = (formData.get("color") as string) || null;
  const colorLight = (formData.get("colorLight") as string) || null;
  const colorDark = (formData.get("colorDark") as string) || null;

  if (!name || !partyId) throw new Error("Parti-navn er påkrævet");

  const slug = generateSlug(name);

  await db
    .update(parties)
    .set({ name, slug, logoUrl, color, colorLight, colorDark, updatedAt: new Date() })
    .where(eq(parties.id, partyId));

  // Update denormalized party/partySlug on all politicians in this party
  await db
    .update(politicians)
    .set({ party: name, partySlug: slug })
    .where(eq(politicians.partyId, partyId));

  revalidatePath("/admin");
}

export async function deleteParty(partyId: string) {
  await requireAdmin();

  if (!partyId) throw new Error("Parti-ID mangler");

  // Detach all politicians from this party
  await db
    .update(politicians)
    .set({ partyId: null, party: "", partySlug: "" })
    .where(eq(politicians.partyId, partyId));

  // Delete the party
  await db.delete(parties).where(eq(parties.id, partyId));

  revalidatePath("/admin");
}

// --- Politician CRUD ---

export async function createPolitician(formData: FormData) {
  await requireAdmin();

  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const partyId = formData.get("partyId") as string;
  const profilePhotoUrl = (formData.get("profilePhotoUrl") as string) || null;
  const bannerUrl = (formData.get("bannerUrl") as string) || null;
  const bannerBgColor = (formData.get("bannerBgColor") as string)?.trim() || null;
  const constituency = (formData.get("constituency") as string)?.trim() || null;
  const heroLine1 = (formData.get("heroLine1") as string)?.trim() || null;
  const heroLine1Color = (formData.get("heroLine1Color") as string)?.trim() || null;
  const heroLine2 = (formData.get("heroLine2") as string)?.trim() || null;
  const heroLine2Color = (formData.get("heroLine2Color") as string)?.trim() || null;
  const chatbaseId = (formData.get("chatbaseId") as string)?.trim() || null;
  const defaultUpvoteGoal = parseInt(formData.get("defaultUpvoteGoal") as string) || 1000;

  if (!name || !email || !partyId) throw new Error("Navn, email og parti er påkrævet");

  // Get party for denormalized fields
  const [party] = await db
    .select()
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);

  if (!party) throw new Error("Parti ikke fundet");

  // Create or find user record
  let [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user) {
    [user] = await db
      .insert(users)
      .values({ email, name })
      .returning();
  }

  // Check if politician already exists for this user
  const [existingPolitician] = await db
    .select()
    .from(politicians)
    .where(eq(politicians.userId, user.id))
    .limit(1);

  if (existingPolitician) throw new Error("Der eksisterer allerede en politiker med denne email");

  const slug = generateSlug(name);

  await db.insert(politicians).values({
    userId: user.id,
    name,
    slug,
    party: party.name,
    partySlug: party.slug,
    partyId: party.id,
    email,
    constituency,
    profilePhotoUrl,
    bannerUrl,
    bannerBgColor,
    heroLine1,
    heroLine1Color,
    heroLine2,
    heroLine2Color,
    chatbaseId,
    defaultUpvoteGoal,
  });

  revalidatePath("/admin");
}

export async function updatePolitician(formData: FormData) {
  await requireAdmin();

  const politicianId = formData.get("politicianId") as string;
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const partyId = formData.get("partyId") as string;
  const constituency = (formData.get("constituency") as string)?.trim() || null;
  const heroLine1 = (formData.get("heroLine1") as string)?.trim() || null;
  const heroLine1Color = (formData.get("heroLine1Color") as string)?.trim() || null;
  const heroLine2 = (formData.get("heroLine2") as string)?.trim() || null;
  const heroLine2Color = (formData.get("heroLine2Color") as string)?.trim() || null;
  const profilePhotoUrl = (formData.get("profilePhotoUrl") as string) || null;
  const bannerUrl = (formData.get("bannerUrl") as string) || null;
  const ogImageUrl = (formData.get("ogImageUrl") as string) || null;
  const bannerBgColor = (formData.get("bannerBgColor") as string)?.trim() || null;
  const chatbaseId = (formData.get("chatbaseId") as string)?.trim() || null;
  const defaultUpvoteGoal = parseInt(formData.get("defaultUpvoteGoal") as string) || 1000;

  if (!name || !email || !partyId || !politicianId) throw new Error("Navn, email og parti er påkrævet");

  const [party] = await db
    .select()
    .from(parties)
    .where(eq(parties.id, partyId))
    .limit(1);

  if (!party) throw new Error("Parti ikke fundet");

  const slug = generateSlug(name);

  // Fetch old politician to compare blob URLs
  const [oldPolitician] = await db
    .select({ bannerUrl: politicians.bannerUrl, profilePhotoUrl: politicians.profilePhotoUrl, ogImageUrl: politicians.ogImageUrl })
    .from(politicians)
    .where(eq(politicians.id, politicianId))
    .limit(1);

  const oldBlobUrls: string[] = [];
  if (oldPolitician?.bannerUrl && oldPolitician.bannerUrl !== bannerUrl && isBlobUrl(oldPolitician.bannerUrl)) {
    oldBlobUrls.push(oldPolitician.bannerUrl);
  }
  if (oldPolitician?.profilePhotoUrl && oldPolitician.profilePhotoUrl !== profilePhotoUrl && isBlobUrl(oldPolitician.profilePhotoUrl)) {
    oldBlobUrls.push(oldPolitician.profilePhotoUrl);
  }
  if (oldPolitician?.ogImageUrl && oldPolitician.ogImageUrl !== ogImageUrl && isBlobUrl(oldPolitician.ogImageUrl)) {
    oldBlobUrls.push(oldPolitician.ogImageUrl);
  }

  await db
    .update(politicians)
    .set({
      name,
      slug,
      party: party.name,
      partySlug: party.slug,
      partyId: party.id,
      email,
      constituency,
      profilePhotoUrl,
      bannerUrl,
      ogImageUrl,
      bannerBgColor,
      heroLine1,
      heroLine1Color,
      heroLine2,
      heroLine2Color,
      chatbaseId,
      defaultUpvoteGoal,
      updatedAt: new Date(),
    })
    .where(eq(politicians.id, politicianId));

  // Clean up old blobs (fire-and-forget)
  if (oldBlobUrls.length > 0) {
    del(oldBlobUrls).catch(() => {});
  }

  revalidatePath("/admin");
}

export async function deletePolitician(politicianId: string) {
  await requireAdmin();

  if (!politicianId) throw new Error("Politiker-ID mangler");

  // Cascade deletes handle: questions, questionTags, upvotes,
  // verificationTokens, answerHistory, causes, questionSuggestions, suggestionTokens
  await db.delete(politicians).where(eq(politicians.id, politicianId));

  revalidatePath("/admin");
}

// --- App Settings ---

export async function updateAppSettings(formData: FormData) {
  await requireAdmin();

  const keys = [
    "colorBg0", "colorBg0Dark", "colorBg0Contrast", "colorBg0ContrastDark",
    "colorBg1", "colorBg1Dark",
    "colorBg2", "colorBg2Dark",
    "colorText0", "colorText0Dark", "colorText0Contrast", "colorText0ContrastDark",
    "colorText1", "colorText1Dark",
    "colorText2", "colorText2Dark",
    "colorText3", "colorText3Dark",
    "colorIcon0", "colorIcon0Dark", "colorIcon0Contrast", "colorIcon0ContrastDark",
    "colorIcon1", "colorIcon1Dark",
    "colorIcon2", "colorIcon2Dark",
    "colorIcon3", "colorIcon3Dark",
    "colorAccent0", "colorAccent0Dark", "colorAccent0Contrast", "colorAccent0ContrastDark",
    "colorAccent1", "colorAccent1Dark", "colorAccent1Contrast", "colorAccent1ContrastDark",
    "colorSuccess", "colorSuccessDark", "colorSuccessContrast", "colorSuccessContrastDark",
    "colorPending", "colorPendingDark", "colorPendingContrast", "colorPendingContrastDark",
    "colorError", "colorErrorDark", "colorErrorContrast", "colorErrorContrastDark",
    "colorOverlay", "colorOverlayDark",
  ];

  const entries = keys
    .map((key) => ({ key, value: formData.get(key) as string }))
    .filter((e) => e.value);

  for (const entry of entries) {
    await db
      .insert(appSettings)
      .values({ key: entry.key, value: entry.value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value: entry.value, updatedAt: new Date() },
      });
  }

  revalidatePath("/admin");
}

// --- Admin Users ---

export async function createAdmin(email: string, name: string | null) {
  await requireAdmin();

  if (!email) throw new Error("E-mail mangler");

  const [existing] = await db.select().from(admins).where(eq(admins.email, email)).limit(1);
  if (existing) throw new Error("Denne e-mail er allerede admin");

  const [created] = await db
    .insert(admins)
    .values({ email, name, permissions: '["all"]' })
    .returning();

  revalidatePath("/admin");
  return created;
}

export async function updateAdmin(adminId: string, email: string, name: string | null) {
  await requireAdmin();

  if (!adminId || !email) throw new Error("Admin-ID og e-mail mangler");

  await db
    .update(admins)
    .set({ email, name })
    .where(eq(admins.id, adminId));

  revalidatePath("/admin");
}

export async function deleteAdmin(adminId: string) {
  const currentAdmin = await requireAdmin();

  if (!adminId) throw new Error("Admin-ID mangler");

  // Prevent self-deletion
  if (currentAdmin.id === adminId) throw new Error("Du kan ikke slette dig selv");

  // Get admin email before deleting, so we can clean up the Auth.js user row
  const [admin] = await db.select().from(admins).where(eq(admins.id, adminId)).limit(1);
  if (!admin) throw new Error("Admin ikke fundet");

  await db.delete(admins).where(eq(admins.id, adminId));

  // Also remove from Auth.js user table
  await db.delete(users).where(eq(users.email, admin.email));

  revalidatePath("/admin");
}
