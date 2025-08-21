import { query } from "@solidjs/router";
import { getChats, getChatWithMessages } from "~/server/db/queries";

// Query to get all chats
export const chatsQuery = query(async () => {
  "use server";
  return await getChats();
}, "chats");

// Query to get a specific chat with messages
export const chatQuery = query(async (id: string) => {
  "use server";
  return await getChatWithMessages(id);
}, "chat");