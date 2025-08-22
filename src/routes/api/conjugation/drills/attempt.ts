import type { APIEvent } from "@solidjs/start/server";
import { recordDrillAttempt } from "~/server/db/conjugation-queries";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.userId || !payload.drillId || !payload.userAnswer || typeof payload.isCorrect !== 'boolean') {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: userId, drillId, userAnswer, isCorrect' 
        }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    const attempt = await recordDrillAttempt({
      userId: payload.userId,
      drillId: payload.drillId,
      userAnswer: payload.userAnswer,
      isCorrect: payload.isCorrect,
      timeSpent: payload.timeSpent
    });

    return new Response(JSON.stringify(attempt), {
      status: 201,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error recording drill attempt:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to record drill attempt' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};