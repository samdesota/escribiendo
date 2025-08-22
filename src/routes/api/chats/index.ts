import type { APIEvent } from "@solidjs/start/server";
import { getChats, createChat } from "~/server/db/queries";
import { AVAILABLE_MODELS } from "~/services/llm/types";

export const GET = async (_event: APIEvent) => {
  try {
    const chats = await getChats();
    return new Response(JSON.stringify(chats), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch chats' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.id || !payload.title) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: id, title' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Validate model is a valid model
    if (!payload.model || !Object.keys(AVAILABLE_MODELS).includes(payload.model)) {
      return new Response(
        JSON.stringify({ error: 'Invalid model' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const newChat = await createChat({
      id: payload.id,
      title: payload.title,
      model: payload.model || 'claude-3.5-sonnet',
      createdAt: payload.createdAt || Date.now(),
    });

    return new Response(JSON.stringify(newChat), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error creating chat:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create chat' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};