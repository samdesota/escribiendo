import { pgTable, varchar, text, timestamp, bigint, boolean, pgEnum, integer, json } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Message type enum
export const messageTypeEnum = pgEnum('message_type', ['user', 'assistant', 'suggestion']);

// Chats table
export const chats = pgTable('chats', {
  id: varchar('id', { length: 255 }).primaryKey(),
  title: varchar('title', { length: 500 }).notNull(),
  model: varchar('model', { length: 50 }).notNull().default('gpt-4o'),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Messages table
export const messages = pgTable('messages', {
  id: varchar('id', { length: 255 }).primaryKey(),
  chatId: varchar('chat_id', { length: 255 }).notNull().references(() => chats.id, { onDelete: 'cascade' }),
  type: messageTypeEnum('type').notNull(),
  content: text('content').notNull(),
  timestamp: bigint('timestamp', { mode: 'number' }).notNull(),
  isComplete: boolean('is_complete').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Journal entries table
export const journalEntries = pgTable('journal_entries', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(), // Add user support later
  title: varchar('title', { length: 500 }).notNull().default('Untitled'),
  content: json('content').notNull(), // ProseMirror document format
  plainText: text('plain_text').notNull().default(''), // For search/backup
  wordCount: integer('word_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Journal corrections/suggestions table for tracking LLM suggestions
export const journalCorrections = pgTable('journal_corrections', {
  id: varchar('id', { length: 255 }).primaryKey(),
  entryId: varchar('entry_id', { length: 255 }).notNull().references(() => journalEntries.id, { onDelete: 'cascade' }),
  originalText: text('original_text').notNull(),
  correctedText: text('corrected_text').notNull(),
  startPos: integer('start_pos').notNull(),
  endPos: integer('end_pos').notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, accepted, rejected
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

export const journalEntriesRelations = relations(journalEntries, ({ many }) => ({
  corrections: many(journalCorrections),
}));

export const journalCorrectionsRelations = relations(journalCorrections, ({ one }) => ({
  entry: one(journalEntries, {
    fields: [journalCorrections.entryId],
    references: [journalEntries.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

// Conjugation drill enums and tables
export const conjugationTenseEnum = pgEnum('conjugation_tense', [
  'present', 'preterite', 'imperfect', 'future', 'conditional', 'present_subjunctive'
]);

export const drillStatusEnum = pgEnum('drill_status', ['active', 'completed', 'skipped']);

// Verb rules table - stores the conjugation rules
export const verbRules = pgTable('verb_rules', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 200 }).notNull(),
  description: text('description').notNull(),
  category: varchar('category', { length: 100 }).notNull(), // e.g., 'regular', 'stem-changing', 'irregular'
  tenses: json('tenses').$type<string[]>().notNull(), // Array of applicable tenses
  order: integer('order').notNull(), // For gradual introduction
  isUnlocked: boolean('is_unlocked').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Conjugation drills table
export const conjugationDrills = pgTable('conjugation_drills', {
  id: varchar('id', { length: 255 }).primaryKey(),
  sentence: text('sentence').notNull(), // The sentence with placeholder
  verb: varchar('verb', { length: 100 }).notNull(), // The infinitive verb
  pronoun: varchar('pronoun', { length: 50 }).notNull(), // yo, tú, él, etc.
  tense: conjugationTenseEnum('tense').notNull(),
  correctAnswer: varchar('correct_answer', { length: 100 }).notNull(),
  ruleId: varchar('rule_id', { length: 255 }).notNull().references(() => verbRules.id),
  difficulty: integer('difficulty').notNull().default(1), // 1-5 scale
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// User progress on drill rules
export const userRuleProgress = pgTable('user_rule_progress', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(), // TODO: Add users table later
  ruleId: varchar('rule_id', { length: 255 }).notNull().references(() => verbRules.id),
  correctCount: integer('correct_count').default(0).notNull(),
  totalAttempts: integer('total_attempts').default(0).notNull(),
  lastAttemptAt: timestamp('last_attempt_at'),
  isUnlocked: boolean('is_unlocked').default(false).notNull(),
  unlockedAt: timestamp('unlocked_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User drill attempts
export const userDrillAttempts = pgTable('user_drill_attempts', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  drillId: varchar('drill_id', { length: 255 }).notNull().references(() => conjugationDrills.id),
  userAnswer: varchar('user_answer', { length: 100 }).notNull(),
  isCorrect: boolean('is_correct').notNull(),
  timeSpent: integer('time_spent'), // milliseconds
  status: drillStatusEnum('status').default('completed').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Drill sessions - track groups of drills generated together
export const drillSessions = pgTable('drill_sessions', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  drillIds: json('drill_ids').$type<string[]>().notNull(),
  status: drillStatusEnum('status').default('active').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
});

// Relations for conjugation drills
export const verbRulesRelations = relations(verbRules, ({ many }) => ({
  drills: many(conjugationDrills),
  userProgress: many(userRuleProgress),
}));

export const conjugationDrillsRelations = relations(conjugationDrills, ({ one, many }) => ({
  rule: one(verbRules, {
    fields: [conjugationDrills.ruleId],
    references: [verbRules.id],
  }),
  attempts: many(userDrillAttempts),
}));

export const userRuleProgressRelations = relations(userRuleProgress, ({ one }) => ({
  rule: one(verbRules, {
    fields: [userRuleProgress.ruleId],
    references: [verbRules.id],
  }),
}));

export const userDrillAttemptsRelations = relations(userDrillAttempts, ({ one }) => ({
  drill: one(conjugationDrills, {
    fields: [userDrillAttempts.drillId],
    references: [conjugationDrills.id],
  }),
}));

export const drillSessionsRelations = relations(drillSessions, ({ many }) => ({
  // Note: Can't directly relate to drills via array, handled in queries
}));

// Types for TypeScript
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type VerbRule = typeof verbRules.$inferSelect;
export type NewVerbRule = typeof verbRules.$inferInsert;
export type ConjugationDrill = typeof conjugationDrills.$inferSelect;
export type NewConjugationDrill = typeof conjugationDrills.$inferInsert;
export type UserRuleProgress = typeof userRuleProgress.$inferSelect;
export type NewUserRuleProgress = typeof userRuleProgress.$inferInsert;
export type UserDrillAttempt = typeof userDrillAttempts.$inferSelect;
export type NewUserDrillAttempt = typeof userDrillAttempts.$inferInsert;
export type DrillSession = typeof drillSessions.$inferSelect;
export type NewDrillSession = typeof drillSessions.$inferInsert;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;
export type JournalCorrection = typeof journalCorrections.$inferSelect;
export type NewJournalCorrection = typeof journalCorrections.$inferInsert;