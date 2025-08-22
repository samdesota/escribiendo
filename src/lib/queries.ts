import { query } from "@solidjs/router";
import { getChats, getChatWithMessages } from "~/server/db/queries";

// Query to get all chats
export const chatsQuery = query(async () => {
  "use server";
  try {
    const chats = await getChats();
    // Return serializable data only
    return chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }));
  } catch (error) {
    console.error('Failed to load chats:', error);
    return [];
  }
}, "chats");

// Query to get a specific chat with messages
export const chatQuery = query(async (id: string) => {
  "use server";
  try {
    const chat = await getChatWithMessages(id);
    if (!chat) return null;
    
    // Return serializable data only
    return {
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messages: chat.messages.map(msg => ({
        id: msg.id,
        chatId: msg.chatId,
        type: msg.type,
        content: msg.content,
        timestamp: msg.timestamp,
        isComplete: msg.isComplete,
        createdAt: msg.createdAt
      }))
    };
  } catch (error) {
    console.error('Failed to load chat:', error);
    return null;
  }
}, "chat");