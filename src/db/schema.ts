import {
  timestamp,
  pgTable,
  text,
  primaryKey,
  integer,
  uuid,
  varchar,
  boolean,
  uniqueIndex,
  real,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "@auth/core/adapters";

// ============================================
// Auth.js tables (required by DrizzleAdapter)
// ============================================

export const users = pgTable("user", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccountType>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const authVerificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ============================================
// Application tables
// ============================================

export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 255 }),
  permissions: text("permissions").notNull().default('["all"]'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const parties = pgTable("parties", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  logoUrl: varchar("logo_url", { length: 2048 }),
  color: varchar("color", { length: 7 }),
  colorLight: varchar("color_light", { length: 7 }),
  colorDark: varchar("color_dark", { length: 7 }),
  topbarLeft1Color: varchar("topbar_left1_color", { length: 20 }),
  topbarLeft1Opacity: integer("topbar_left1_opacity"),
  topbarLeft2Color: varchar("topbar_left2_color", { length: 20 }),
  topbarLeft2Opacity: integer("topbar_left2_opacity"),
  topbarRightColor: varchar("topbar_right_color", { length: 20 }),
  topbarRightOpacity: integer("topbar_right_opacity"),
  topbarBgColor: varchar("topbar_bg_color", { length: 20 }),
  topbarBtnBg: varchar("topbar_btn_bg", { length: 20 }),
  topbarBtnIcon: varchar("topbar_btn_icon", { length: 20 }),
  topbarAccentBtnBg: varchar("topbar_accent_btn_bg", { length: 20 }),
  topbarAccentBtnIcon: varchar("topbar_accent_btn_icon", { length: 20 }),
  fabBtnBg: varchar("fab_btn_bg", { length: 20 }),
  fabBtnIcon: varchar("fab_btn_icon", { length: 20 }),
  inlineBtnBg: varchar("inline_btn_bg", { length: 20 }),
  inlineBtnIcon: varchar("inline_btn_icon", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const politicians = pgTable("politicians", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" })
    .unique(),
  name: varchar("name", { length: 255 }).notNull(),
  firstName: varchar("first_name", { length: 255 }),
  middleName: varchar("middle_name", { length: 255 }),
  lastName: varchar("last_name", { length: 255 }),
  slug: varchar("slug", { length: 255 }).notNull(),
  party: varchar("party", { length: 255 }).notNull(),
  partySlug: varchar("party_slug", { length: 255 }).notNull(),
  partyId: uuid("party_id").references(() => parties.id),
  email: varchar("email", { length: 255 }).notNull(),
  profilePhotoUrl: varchar("profile_photo_url", { length: 2048 }),
  bannerUrl: varchar("banner_url", { length: 2048 }),
  ogImageUrl: varchar("og_image_url", { length: 2048 }),
  bannerBgColor: varchar("banner_bg_color", { length: 7 }),
  heroLine1: varchar("hero_line_1", { length: 255 }),
  heroLine1Color: varchar("hero_line_1_color", { length: 7 }),
  heroLine2: varchar("hero_line_2", { length: 255 }),
  heroLine2Color: varchar("hero_line_2_color", { length: 7 }),
  constituency: varchar("constituency", { length: 255 }),
  chatbaseId: varchar("chatbase_id", { length: 255 }),
  defaultUpvoteGoal: integer("default_upvote_goal").notNull().default(1000),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const questions = pgTable("questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  politicianId: uuid("politician_id")
    .notNull()
    .references(() => politicians.id, { onDelete: "cascade" }),
  text: varchar("text", { length: 300 }).notNull(),
  upvoteGoal: integer("upvote_goal").notNull().default(1000),
  upvoteCount: integer("upvote_count").notNull().default(0),
  goalReachedEmailSent: boolean("goal_reached_email_sent").notNull().default(false),
  goalReachedAt: timestamp("goal_reached_at"),
  reminderEmailSent: boolean("reminder_email_sent").notNull().default(false),
  deadlineMissed: boolean("deadline_missed").notNull().default(false),
  answerUrl: varchar("answer_url", { length: 2048 }),
  answerPhotoUrl: varchar("answer_photo_url", { length: 2048 }),
  answerClipUrl: varchar("answer_clip_url", { length: 2048 }),
  answerDuration: real("answer_duration"),
  answerAspectRatio: real("answer_aspect_ratio"),
  muxAssetId: varchar("mux_asset_id", { length: 255 }),
  muxPlaybackId: varchar("mux_playback_id", { length: 255 }),
  muxAssetStatus: varchar("mux_asset_status", { length: 50 }),
  muxMediaType: varchar("mux_media_type", { length: 10 }),
  answerUpdateCount: integer("answer_update_count").notNull().default(0),
  pinned: boolean("pinned").notNull().default(false),
  archived: boolean("archived").notNull().default(false),
  suggestedByCitizenId: uuid("suggested_by_citizen_id").references(
    () => citizens.id
  ),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const causes = pgTable(
  "causes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    politicianId: uuid("politician_id")
      .notNull()
      .references(() => politicians.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 300 }).notNull(),
    shortDescription: text("short_description").notNull(),
    longDescription: text("long_description"),
    videoUrl: varchar("video_url", { length: 2048 }),
    points: text("points"),
    tagId: varchar("tag_id", { length: 100 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_cause_tag").on(table.politicianId, table.tagId),
  ]
);

export const questionTags = pgTable("question_tags", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  tag: varchar("tag", { length: 100 }).notNull(),
});

export const citizens = pgTable("citizens", {
  id: uuid("id").primaryKey().defaultRandom(),
  firstName: varchar("first_name", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  age: integer("age"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const upvotes = pgTable(
  "upvotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    citizenId: uuid("citizen_id")
      .notNull()
      .references(() => citizens.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("unique_upvote").on(table.questionId, table.citizenId),
  ]
);

export const verificationTokens = pgTable("verification_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  citizenId: uuid("citizen_id")
    .notNull()
    .references(() => citizens.id),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  politicianSlug: varchar("politician_slug", { length: 255 }).notNull(),
  partySlug: varchar("party_slug", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const answerHistory = pgTable("answer_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  questionId: uuid("question_id")
    .notNull()
    .references(() => questions.id, { onDelete: "cascade" }),
  answerUrl: varchar("answer_url", { length: 2048 }),
  answerPhotoUrl: varchar("answer_photo_url", { length: 2048 }),
  answerClipUrl: varchar("answer_clip_url", { length: 2048 }),
  answerDuration: real("answer_duration"),
  answerAspectRatio: real("answer_aspect_ratio"),
  muxAssetId: varchar("mux_asset_id", { length: 255 }),
  muxPlaybackId: varchar("mux_playback_id", { length: 255 }),
  muxAssetStatus: varchar("mux_asset_status", { length: 50 }),
  muxMediaType: varchar("mux_media_type", { length: 10 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const citizenSessions = pgTable("citizen_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  citizenId: uuid("citizen_id")
    .notNull()
    .references(() => citizens.id),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const questionSuggestions = pgTable("question_suggestions", {
  id: uuid("id").primaryKey().defaultRandom(),
  politicianId: uuid("politician_id")
    .notNull()
    .references(() => politicians.id, { onDelete: "cascade" }),
  citizenId: uuid("citizen_id")
    .notNull()
    .references(() => citizens.id, { onDelete: "cascade" }),
  text: varchar("text", { length: 300 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending_verification"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const suggestionTokens = pgTable("suggestion_tokens", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  citizenId: uuid("citizen_id")
    .notNull()
    .references(() => citizens.id),
  suggestionId: uuid("suggestion_id")
    .notNull()
    .references(() => questionSuggestions.id, { onDelete: "cascade" }),
  politicianSlug: varchar("politician_slug", { length: 255 }).notNull(),
  partySlug: varchar("party_slug", { length: 255 }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").notNull().default(false),
});

export const appSettings = pgTable("app_settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
