import { pgTable, varchar, text, timestamp, bigint, boolean, pgEnum } from 'drizzle-orm/pg-core';
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

// Relations
export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
}));

// Types for TypeScript
export type Chat = typeof chats.$inferSelect;
export type NewChat = typeof chats.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;