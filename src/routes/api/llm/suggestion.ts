import type { APIEvent } from "@solidjs/start/server";
import { LLMService } from "~/services/llm/LLMService";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.userInput) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userInput' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Get model from payload or use default
    const modelId = payload.model || 'gpt-4o';
    const llmService = new LLMService(modelId);

    const response = await llmService.getSuggestion({
      userInput: payload.userInput,
      chatContext: payload.chatContext
    });

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error in suggestion API:', error);
    return new Response(
      JSON.stringify({ 
        suggestion: 'Lo siento, hubo un error procesando tu sugerencia.',
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};