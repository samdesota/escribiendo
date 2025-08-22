import { eq, desc } from 'drizzle-orm';
import { db } from './index';
import { chats, messages, type Chat, type NewChat, type Message, type NewMessage } from './schema';

// Chat operations
export async function getChats() {
  return await db.select().from(chats).orderBy(desc(chats.createdAt));
}

export async function getChatById(id: string) {
  const result = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
  return result[0] || null;
}

export async function getChatWithMessages(id: string) {
  const chat = await getChatById(id);
  if (!chat) return null;

  const chatMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, id))
    .orderBy(messages.timestamp);

  return {
    ...chat,
    messages: chatMessages,
  };
}

export async function createChat(data: NewChat) {
  console.log('createChat', data);
  const result = await db.insert(chats).values(data).returning();
  return result[0];
}

export async function updateChat(id: string, data: Partial<NewChat>) {
  const result = await db
    .update(chats)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(chats.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteChat(id: string) {
  // Messages will be cascade deleted due to foreign key constraint
  const result = await db.delete(chats).where(eq(chats.id, id)).returning();
  return result[0] || null;
}

// Message operations
export async function getMessagesByChat(chatId: string) {
  return await db
    .select()
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.timestamp);
}

export async function createMessage(data: NewMessage) {
  const result = await db.insert(messages).values(data).returning();
  return result[0];
}

export async function updateMessage(id: string, data: Partial<NewMessage>) {
  const result = await db
    .update(messages)
    .set(data)
    .where(eq(messages.id, id))
    .returning();
  return result[0] || null;
}

export async function deleteMessage(id: string) {
  const result = await db.delete(messages).where(eq(messages.id, id)).returning();
  return result[0] || null;
}