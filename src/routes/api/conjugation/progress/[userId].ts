import type { APIEvent } from "@solidjs/start/server";
import { getUserProgressWithRules, unlockUserRule } from "~/server/db/conjugation-queries";

export const GET = async ({ params }: APIEvent) => {
  try {
    const userId = params.userId!;
    const progress = await getUserProgressWithRules(userId);
    
    return new Response(JSON.stringify(progress), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching user progress:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch user progress' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};

export const POST = async ({ params, request }: APIEvent) => {
  try {
    const userId = params.userId!;
    const payload = await request.json();
    
    if (payload.action === 'unlock_rule' && payload.ruleId) {
      const progress = await unlockUserRule(userId, payload.ruleId);
      return new Response(JSON.stringify(progress), {
        status: 201,
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
    console.error('Error updating user progress:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to update user progress' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};