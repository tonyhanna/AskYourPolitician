import { pgTable, unique, uuid, varchar, timestamp, foreignKey, text, integer, boolean, uniqueIndex, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const citizens = pgTable("citizens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	firstName: varchar("first_name", { length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	unique("citizens_email_unique").on(table.email),
]);

export const questionTags = pgTable("question_tags", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid("question_id").notNull(),
	tag: varchar({ length: 100 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "question_tags_question_id_questions_id_fk"
		}).onDelete("cascade"),
]);

export const user = pgTable("user", {
	id: text().primaryKey().notNull(),
	name: text(),
	email: text().notNull(),
	emailVerified: timestamp({ mode: 'string' }),
	image: text(),
});

export const politicians = pgTable("politicians", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	name: varchar({ length: 255 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	party: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).defaultNow().notNull(),
	partySlug: varchar("party_slug", { length: 255 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "politicians_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("politicians_user_id_unique").on(table.userId),
]);

export const citizenSessions = pgTable("citizen_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	token: varchar({ length: 255 }).notNull(),
	citizenId: uuid("citizen_id").notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.citizenId],
			foreignColumns: [citizens.id],
			name: "citizen_sessions_citizen_id_citizens_id_fk"
		}),
	unique("citizen_sessions_token_unique").on(table.token),
]);

export const answerHistory = pgTable("answer_history", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid("question_id").notNull(),
	answerUrl: varchar("answer_url", { length: 2048 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "answer_history_question_id_questions_id_fk"
		}).onDelete("cascade"),
]);

export const session = pgTable("session", {
	sessionToken: text().primaryKey().notNull(),
	userId: text().notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_userId_user_id_fk"
		}).onDelete("cascade"),
]);

export const questions = pgTable("questions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	politicianId: uuid("politician_id").notNull(),
	text: varchar({ length: 300 }).notNull(),
	upvoteGoal: integer("upvote_goal").default(1000).notNull(),
	upvoteCount: integer("upvote_count").default(0).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
	goalReachedEmailSent: boolean("goal_reached_email_sent").default(false).notNull(),
	answerUrl: varchar("answer_url", { length: 2048 }),
	suggestedByCitizenId: uuid("suggested_by_citizen_id"),
}, (table) => [
	foreignKey({
			columns: [table.politicianId],
			foreignColumns: [politicians.id],
			name: "questions_politician_id_politicians_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.suggestedByCitizenId],
			foreignColumns: [citizens.id],
			name: "questions_suggested_by_citizen_id_citizens_id_fk"
		}),
]);

export const questionSuggestions = pgTable("question_suggestions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	politicianId: uuid("politician_id").notNull(),
	citizenId: uuid("citizen_id").notNull(),
	text: varchar({ length: 300 }).notNull(),
	status: varchar({ length: 50 }).default('pending_verification').notNull(),
	rejectionReason: text("rejection_reason"),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.politicianId],
			foreignColumns: [politicians.id],
			name: "question_suggestions_politician_id_politicians_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.citizenId],
			foreignColumns: [citizens.id],
			name: "question_suggestions_citizen_id_citizens_id_fk"
		}).onDelete("cascade"),
]);

export const suggestionTokens = pgTable("suggestion_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	token: varchar({ length: 255 }).notNull(),
	citizenId: uuid("citizen_id").notNull(),
	suggestionId: uuid("suggestion_id").notNull(),
	politicianSlug: varchar("politician_slug", { length: 255 }).notNull(),
	partySlug: varchar("party_slug", { length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	used: boolean().default(false).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.citizenId],
			foreignColumns: [citizens.id],
			name: "suggestion_tokens_citizen_id_citizens_id_fk"
		}),
	foreignKey({
			columns: [table.suggestionId],
			foreignColumns: [questionSuggestions.id],
			name: "suggestion_tokens_suggestion_id_question_suggestions_id_fk"
		}).onDelete("cascade"),
	unique("suggestion_tokens_token_unique").on(table.token),
]);

export const upvotes = pgTable("upvotes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	questionId: uuid("question_id").notNull(),
	citizenId: uuid("citizen_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_upvote").using("btree", table.questionId.asc().nullsLast().op("uuid_ops"), table.citizenId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "upvotes_question_id_questions_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.citizenId],
			foreignColumns: [citizens.id],
			name: "upvotes_citizen_id_citizens_id_fk"
		}).onDelete("cascade"),
]);

export const verificationTokens = pgTable("verification_tokens", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	token: varchar({ length: 255 }).notNull(),
	citizenId: uuid("citizen_id").notNull(),
	questionId: uuid("question_id").notNull(),
	politicianSlug: varchar("politician_slug", { length: 255 }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	used: boolean().default(false).notNull(),
	partySlug: varchar("party_slug", { length: 255 }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.citizenId],
			foreignColumns: [citizens.id],
			name: "verification_tokens_citizen_id_citizens_id_fk"
		}),
	foreignKey({
			columns: [table.questionId],
			foreignColumns: [questions.id],
			name: "verification_tokens_question_id_questions_id_fk"
		}),
	unique("verification_tokens_token_unique").on(table.token),
]);

export const causes = pgTable("causes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	politicianId: uuid("politician_id").notNull(),
	title: varchar({ length: 300 }).notNull(),
	shortDescription: text("short_description").notNull(),
	longDescription: text("long_description"),
	videoUrl: varchar("video_url", { length: 2048 }),
	tagId: varchar("tag_id", { length: 100 }).notNull(),
	slug: varchar({ length: 255 }).notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_cause_tag").using("btree", table.politicianId.asc().nullsLast().op("text_ops"), table.tagId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.politicianId],
			foreignColumns: [politicians.id],
			name: "causes_politician_id_politicians_id_fk"
		}).onDelete("cascade"),
]);

export const verificationToken = pgTable("verificationToken", {
	identifier: text().notNull(),
	token: text().notNull(),
	expires: timestamp({ mode: 'string' }).notNull(),
}, (table) => [
	primaryKey({ columns: [table.identifier, table.token], name: "verificationToken_identifier_token_pk"}),
]);

export const account = pgTable("account", {
	userId: text().notNull(),
	type: text().notNull(),
	provider: text().notNull(),
	providerAccountId: text().notNull(),
	refreshToken: text("refresh_token"),
	accessToken: text("access_token"),
	expiresAt: integer("expires_at"),
	tokenType: text("token_type"),
	scope: text(),
	idToken: text("id_token"),
	sessionState: text("session_state"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_userId_user_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.provider, table.providerAccountId], name: "account_provider_providerAccountId_pk"}),
]);
