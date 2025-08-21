import type { APIEvent } from "@solidjs/start/server";
import { getChats, createChat } from "~/server/db/queries";

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

    const newChat = await createChat({
      id: payload.id,
      title: payload.title,
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