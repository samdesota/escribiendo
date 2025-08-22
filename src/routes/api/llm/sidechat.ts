import type { APIEvent } from "@solidjs/start/server";
import { LLMService } from "~/services/llm/LLMService";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.originalContext || !payload.spanishSuggestion || !payload.studentMessage) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: originalContext, spanishSuggestion, studentMessage' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Get model from payload or use default
    const modelId = payload.model || 'gpt-4o';
    const llmService = new LLMService(modelId);

    const response = await llmService.getSideChatResponse({
      originalContext: payload.originalContext,
      spanishSuggestion: payload.spanishSuggestion,
      studentMessage: payload.studentMessage
    });

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error in sidechat API:', error);
    return new Response(
      JSON.stringify({ 
        response: 'Sorry, I encountered an error. Please try asking your question again.',
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};