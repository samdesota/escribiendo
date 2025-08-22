import type { APIEvent } from "@solidjs/start/server";
import { LLMService } from "~/services/llm/LLMService";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.selectedText || !payload.contextMessage) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: selectedText, contextMessage' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Get model from payload or use default
    const modelId = payload.model || 'gpt-4o';
    console.log('modelId', 'hello', modelId, typeof modelId);
    const llmService = new LLMService(modelId);

    const response = await llmService.getTranslation({
      selectedText: payload.selectedText,
      contextMessage: payload.contextMessage,
      chatContext: payload.chatContext
    });

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error in translation API:', error);
    return new Response(
      JSON.stringify({ 
        translation: 'Translation error',
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};