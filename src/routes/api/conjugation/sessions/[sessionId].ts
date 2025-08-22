import type { APIEvent } from "@solidjs/start/server";
import { getDrillSessionWithDrills, completeDrillSession } from "~/server/db/conjugation-queries";

export const GET = async ({ params, request }: APIEvent) => {
  try {
    const sessionId = params.sessionId!;
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId parameter is required' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const session = await getDrillSessionWithDrills(userId, sessionId);
    
    if (!session) {
      return new Response("Not Found", { status: 404 });
    }
    
    return new Response(JSON.stringify(session), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching drill session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch drill session' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const PATCH = async ({ params, request }: APIEvent) => {
  try {
    const sessionId = params.sessionId!;
    const payload = await request.json();
    
    if (!payload.userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    if (payload.action === 'complete') {
      const updated = await completeDrillSession(payload.userId, sessionId);
      
      if (!updated) {
        return new Response("Not Found", { status: 404 });
      }
      
      return new Response(JSON.stringify(updated), {
        headers: { "content-type": "application/json" },
      });
    }
    
    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      {
        status: 400,
        headers: { "content-type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error updating drill session:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update drill session' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};