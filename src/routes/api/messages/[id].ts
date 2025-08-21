import type { APIEvent } from "@solidjs/start/server";
import { updateMessage, deleteMessage } from "~/server/db/queries";

export const PATCH = async ({ params, request }: APIEvent) => {
  try {
    const payload = await request.json();
    const updated = await updateMessage(params.id!, payload);
    
    if (!updated) {
      return new Response("Not Found", { status: 404 });
    }
    
    return new Response(JSON.stringify(updated), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error updating message:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update message' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const DELETE = async ({ params }: APIEvent) => {
  try {
    const deleted = await deleteMessage(params.id!);
    
    if (!deleted) {
      return new Response("Not Found", { status: 404 });
    }
    
    return new Response(JSON.stringify(deleted), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error deleting message:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to delete message' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};