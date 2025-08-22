import type { APIEvent } from "@solidjs/start/server";
import { getVerbRules, createVerbRule } from "~/server/db/conjugation-queries";
import { CONJUGATION_RULES } from "~/lib/conjugation-rules";

export const GET = async (_event: APIEvent) => {
  try {
    const rules = await getVerbRules();
    return new Response(JSON.stringify(rules), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching verb rules:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch verb rules' }),
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
    if (!payload.id || !payload.name || !payload.description) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: id, name, description' 
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const newRule = await createVerbRule({
      id: payload.id,
      name: payload.name,
      description: payload.description,
      category: payload.category || 'regular',
      tenses: payload.tenses || ['present'],
      order: payload.order || 1,
      isUnlocked: payload.isUnlocked || false
    });

    return new Response(JSON.stringify(newRule), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error creating verb rule:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to create verb rule' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};