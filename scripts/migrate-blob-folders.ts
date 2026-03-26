/**
 * Migration script: Move existing blob files into organized folders.
 *
 * Folders:
 *   parties/        — party logos
 *   politicians/    — profile photos + banners
 *   answers/video/  — answer videos
 *   answers/sound/  — answer audio files
 *   answers/photo/  — photos attached to audio answers
 *
 * Usage:
 *   npx tsx scripts/migrate-blob-folders.ts
 *
 * Requires BLOB_READ_WRITE_TOKEN and DATABASE_URL env vars (loaded from .env.local).
 */

// Load env FIRST before any other imports
import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  // Dynamic imports so db module sees the env vars
  const { copy, del } = await import("@vercel/blob");
  const { db } = await import("../src/db");
  const { parties, politicians, questions, answerHistory } = await import("../src/db/schema");
  const { eq } = await import("drizzle-orm");

  const BLOB_DOMAIN = ".public.blob.vercel-storage.com/";

  function isBlobUrl(url: string): boolean {
    return url.includes(BLOB_DOMAIN);
  }

  function alreadyInFolder(url: string, folder: string): boolean {
    try {
      const pathname = new URL(url).pathname;
      return pathname.startsWith(`/${folder}/`);
    } catch {
      return false;
    }
  }

  function getFilename(url: string): string {
    try {
      const pathname = new URL(url).pathname;
      return pathname.split("/").pop() || "unknown";
    } catch {
      return "unknown";
    }
  }

  function getBlobMediaType(url: string): "video" | "audio" | null {
    const videoExtensions = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"];
    const audioExtensions = [".mp3", ".m4a", ".wav", ".ogg", ".aac", ".flac"];
    try {
      const pathname = new URL(url).pathname.toLowerCase();
      if (videoExtensions.some((ext) => pathname.includes(ext))) return "video";
      if (audioExtensions.some((ext) => pathname.includes(ext))) return "audio";
    } catch {}
    return null;
  }

  type MoveTask = {
    label: string;
    oldUrl: string;
    targetFolder: string;
    updateDb: (newUrl: string) => Promise<void>;
  };

  const tasks: MoveTask[] = [];

  // ── 1. Party logos ──
  console.log("Scanning party logos...");
  const allParties = await db.select({ id: parties.id, logoUrl: parties.logoUrl }).from(parties);
  for (const party of allParties) {
    if (party.logoUrl && isBlobUrl(party.logoUrl) && !alreadyInFolder(party.logoUrl, "parties")) {
      tasks.push({
        label: `party logo (${party.id})`,
        oldUrl: party.logoUrl,
        targetFolder: "parties",
        updateDb: async (newUrl) => {
          await db.update(parties).set({ logoUrl: newUrl }).where(eq(parties.id, party.id));
        },
      });
    }
  }

  // ── 2. Politician profile photos + banners ──
  console.log("Scanning politician photos/banners...");
  const allPoliticians = await db
    .select({ id: politicians.id, profilePhotoUrl: politicians.profilePhotoUrl, bannerUrl: politicians.bannerUrl })
    .from(politicians);
  for (const pol of allPoliticians) {
    if (pol.profilePhotoUrl && isBlobUrl(pol.profilePhotoUrl) && !alreadyInFolder(pol.profilePhotoUrl, "politicians")) {
      tasks.push({
        label: `politician profile photo (${pol.id})`,
        oldUrl: pol.profilePhotoUrl,
        targetFolder: "politicians",
        updateDb: async (newUrl) => {
          await db.update(politicians).set({ profilePhotoUrl: newUrl }).where(eq(politicians.id, pol.id));
        },
      });
    }
    if (pol.bannerUrl && isBlobUrl(pol.bannerUrl) && !alreadyInFolder(pol.bannerUrl, "politicians")) {
      tasks.push({
        label: `politician banner (${pol.id})`,
        oldUrl: pol.bannerUrl,
        targetFolder: "politicians",
        updateDb: async (newUrl) => {
          await db.update(politicians).set({ bannerUrl: newUrl }).where(eq(politicians.id, pol.id));
        },
      });
    }
  }

  // ── 3. Question answer URLs + answer photos ──
  console.log("Scanning question answers...");
  const allQuestions = await db
    .select({ id: questions.id, answerUrl: questions.answerUrl, answerPhotoUrl: questions.answerPhotoUrl })
    .from(questions);
  for (const q of allQuestions) {
    if (q.answerUrl && isBlobUrl(q.answerUrl)) {
      const mediaType = getBlobMediaType(q.answerUrl);
      const folder = mediaType === "audio" ? "answers/sound" : "answers/video";
      if (!alreadyInFolder(q.answerUrl, folder)) {
        tasks.push({
          label: `question answer ${mediaType || "video"} (${q.id})`,
          oldUrl: q.answerUrl,
          targetFolder: folder,
          updateDb: async (newUrl) => {
            await db.update(questions).set({ answerUrl: newUrl }).where(eq(questions.id, q.id));
          },
        });
      }
    }
    if (q.answerPhotoUrl && isBlobUrl(q.answerPhotoUrl) && !alreadyInFolder(q.answerPhotoUrl, "answers/photo")) {
      tasks.push({
        label: `question answer photo (${q.id})`,
        oldUrl: q.answerPhotoUrl,
        targetFolder: "answers/photo",
        updateDb: async (newUrl) => {
          await db.update(questions).set({ answerPhotoUrl: newUrl }).where(eq(questions.id, q.id));
        },
      });
    }
  }

  // ── 4. Answer history URLs + photos ──
  console.log("Scanning answer history...");
  const allHistory = await db
    .select({ id: answerHistory.id, answerUrl: answerHistory.answerUrl, answerPhotoUrl: answerHistory.answerPhotoUrl })
    .from(answerHistory);
  for (const h of allHistory) {
    if (h.answerUrl && isBlobUrl(h.answerUrl)) {
      const mediaType = getBlobMediaType(h.answerUrl);
      const folder = mediaType === "audio" ? "answers/sound" : "answers/video";
      if (!alreadyInFolder(h.answerUrl, folder)) {
        tasks.push({
          label: `answer history ${mediaType || "video"} (${h.id})`,
          oldUrl: h.answerUrl,
          targetFolder: folder,
          updateDb: async (newUrl) => {
            await db.update(answerHistory).set({ answerUrl: newUrl }).where(eq(answerHistory.id, h.id));
          },
        });
      }
    }
    if (h.answerPhotoUrl && isBlobUrl(h.answerPhotoUrl) && !alreadyInFolder(h.answerPhotoUrl, "answers/photo")) {
      tasks.push({
        label: `answer history photo (${h.id})`,
        oldUrl: h.answerPhotoUrl,
        targetFolder: "answers/photo",
        updateDb: async (newUrl) => {
          await db.update(answerHistory).set({ answerPhotoUrl: newUrl }).where(eq(answerHistory.id, h.id));
        },
      });
    }
  }

  // ── Execute ──
  console.log(`\nFound ${tasks.length} blob files to move.\n`);

  if (tasks.length === 0) {
    console.log("Nothing to do!");
    process.exit(0);
  }

  let success = 0;
  let failed = 0;
  const oldUrlsToDelete: string[] = [];

  for (const task of tasks) {
    const filename = getFilename(task.oldUrl);
    const newPath = `${task.targetFolder}/${filename}`;
    try {
      const result = await copy(task.oldUrl, newPath, { access: "public" });
      await task.updateDb(result.url);
      oldUrlsToDelete.push(task.oldUrl);
      success++;
      console.log(`  ✓ ${task.label}: ${filename} → ${newPath}`);
    } catch (e) {
      failed++;
      console.error(`  ✗ ${task.label}: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Delete old blob files
  if (oldUrlsToDelete.length > 0) {
    console.log(`\nDeleting ${oldUrlsToDelete.length} old blob files...`);
    try {
      await del(oldUrlsToDelete);
      console.log("  ✓ Old files deleted");
    } catch (e) {
      console.error(`  ✗ Failed to delete some old files: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nDone! ${success} moved, ${failed} failed.`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
