import type { APIEvent } from "@solidjs/start/server";
import { getChatWithMessages, updateChat, deleteChat } from "~/server/db/queries";

export const GET = async ({ params }: APIEvent) => {
  try {
    const chat = await getChatWithMessages(params.id!);
    if (!chat) {
      return new Response("Not Found", { status: 404 });
    }
    
    return new Response(JSON.stringify(chat), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch chat' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const PATCH = async ({ params, request }: APIEvent) => {
  try {
    const payload = await request.json();
    const updated = await updateChat(params.id!, payload);
    
    if (!updated) {
      return new Response("Not Found", { status: 404 });
    }
    
    return new Response(JSON.stringify(updated), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error updating chat:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update chat' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const DELETE = async ({ params }: APIEvent) => {
  try {
    const deleted = await deleteChat(params.id!);
    
    if (!deleted) {
      return new Response("Not Found", { status: 404 });
    }
    
    return new Response(JSON.stringify(deleted), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete chat' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};