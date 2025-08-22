import type { APIEvent } from "@solidjs/start/server";
import { AVAILABLE_MODELS } from "~/services/llm/types";

export const GET = async (_event: APIEvent) => {
  try {
    const models = Object.entries(AVAILABLE_MODELS).map(([id, config]) => ({
      id,
      displayName: config.displayName,
      provider: config.provider,
      model: config.model
    }));

    return new Response(JSON.stringify({ models }), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error fetching models:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch models' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};