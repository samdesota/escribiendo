import type { APIEvent } from "@solidjs/start/server";
import { createMessage } from "~/server/db/queries";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.id || !payload.chatId || !payload.type || !payload.content) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: id, chatId, type, content' 
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const newMessage = await createMessage({
      id: payload.id,
      chatId: payload.chatId,
      type: payload.type,
      content: payload.content,
      timestamp: payload.timestamp || Date.now(),
      isComplete: payload.isComplete ?? true,
    });

    return new Response(JSON.stringify(newMessage), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error creating message:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create message' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};