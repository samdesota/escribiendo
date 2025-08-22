import { query } from "@solidjs/router";
import { getChats, getChatWithMessages } from "~/server/db/queries";

interface SerializableChat {
  id: string;
  title: string;
  model: string;
  createdAt: number;
  updatedAt: Date;
}

interface SerializableChatWithMessages extends SerializableChat {
  messages: Array<{
    id: string;
    chatId: string;
    type: 'user' | 'assistant' | 'suggestion';
    content: string;
    timestamp: number;
    isComplete: boolean;
    createdAt: Date;
  }>;
}

// Query to get all chats
export const chatsQuery = query(async (): Promise<SerializableChat[]> => {
  "use server";
  try {
    const chats = await getChats();
    // Return serializable data only
    return chats.map(chat => ({
      id: chat.id,
      title: chat.title,
      model: chat.model,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }));
  } catch (error) {
    console.error('Failed to load chats:', error);
    return [];
  }
}, "chats");

// Query to get a specific chat with messages
export const chatQuery = query(async (id: string): Promise<SerializableChatWithMessages | null> => {
  "use server";
  try {
    const chat = await getChatWithMessages(id);
    if (!chat) return null;
    
    // Return serializable data only
    return {
      id: chat.id,
      title: chat.title,
      model: chat.model,
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