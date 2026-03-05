import { relations } from "drizzle-orm/relations";
import { questions, questionTags, user, politicians, citizens, citizenSessions, answerHistory, session, questionSuggestions, suggestionTokens, upvotes, verificationTokens, causes, account } from "./schema";

export const questionTagsRelations = relations(questionTags, ({one}) => ({
	question: one(questions, {
		fields: [questionTags.questionId],
		references: [questions.id]
	}),
}));

export const questionsRelations = relations(questions, ({one, many}) => ({
	questionTags: many(questionTags),
	answerHistories: many(answerHistory),
	politician: one(politicians, {
		fields: [questions.politicianId],
		references: [politicians.id]
	}),
	citizen: one(citizens, {
		fields: [questions.suggestedByCitizenId],
		references: [citizens.id]
	}),
	upvotes: many(upvotes),
	verificationTokens: many(verificationTokens),
}));

export const politiciansRelations = relations(politicians, ({one, many}) => ({
	user: one(user, {
		fields: [politicians.userId],
		references: [user.id]
	}),
	questions: many(questions),
	questionSuggestions: many(questionSuggestions),
	causes: many(causes),
}));

export const userRelations = relations(user, ({many}) => ({
	politicians: many(politicians),
	sessions: many(session),
	accounts: many(account),
}));

export const citizenSessionsRelations = relations(citizenSessions, ({one}) => ({
	citizen: one(citizens, {
		fields: [citizenSessions.citizenId],
		references: [citizens.id]
	}),
}));

export const citizensRelations = relations(citizens, ({many}) => ({
	citizenSessions: many(citizenSessions),
	questions: many(questions),
	questionSuggestions: many(questionSuggestions),
	suggestionTokens: many(suggestionTokens),
	upvotes: many(upvotes),
	verificationTokens: many(verificationTokens),
}));

export const answerHistoryRelations = relations(answerHistory, ({one}) => ({
	question: one(questions, {
		fields: [answerHistory.questionId],
		references: [questions.id]
	}),
}));

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const questionSuggestionsRelations = relations(questionSuggestions, ({one, many}) => ({
	politician: one(politicians, {
		fields: [questionSuggestions.politicianId],
		references: [politicians.id]
	}),
	citizen: one(citizens, {
		fields: [questionSuggestions.citizenId],
		references: [citizens.id]
	}),
	suggestionTokens: many(suggestionTokens),
}));

export const suggestionTokensRelations = relations(suggestionTokens, ({one}) => ({
	citizen: one(citizens, {
		fields: [suggestionTokens.citizenId],
		references: [citizens.id]
	}),
	questionSuggestion: one(questionSuggestions, {
		fields: [suggestionTokens.suggestionId],
		references: [questionSuggestions.id]
	}),
}));

export const upvotesRelations = relations(upvotes, ({one}) => ({
	question: one(questions, {
		fields: [upvotes.questionId],
		references: [questions.id]
	}),
	citizen: one(citizens, {
		fields: [upvotes.citizenId],
		references: [citizens.id]
	}),
}));

export const verificationTokensRelations = relations(verificationTokens, ({one}) => ({
	citizen: one(citizens, {
		fields: [verificationTokens.citizenId],
		references: [citizens.id]
	}),
	question: one(questions, {
		fields: [verificationTokens.questionId],
		references: [questions.id]
	}),
}));

export const causesRelations = relations(causes, ({one}) => ({
	politician: one(politicians, {
		fields: [causes.politicianId],
		references: [politicians.id]
	}),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));