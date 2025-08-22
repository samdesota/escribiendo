import type { APIEvent } from "@solidjs/start/server";
import { LLMService } from "~/services/llm/LLMService";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();

    // Get model from payload or use default
    const modelId = payload.model || 'gpt-4o';
    const llmService = new LLMService(modelId);

    const response = await llmService.getConversationStarters(
      payload.previousAssistantQuestions || [],
      payload.previousUserQuestions || []
    );

    return new Response(JSON.stringify(response), {
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    console.error('Error in conversation starters API:', error);
    
    // Fallback to static conversation starters
    const fallbackResponse = {
      assistantQuestions: [
        "Cuéntame sobre tu día típico",
        "¿Qué es lo que más te gusta de tu ciudad?",
        "Háblame de tu comida favorita"
      ],
      userQuestions: [
        "¿Cuál es la tradición española más importante?",
        "¿Qué consejos tienes para mejorar mi pronunciación?",
        "¿Cómo es la vida en España comparada con otros países?"
      ],
      error: error instanceof Error ? error.message : 'Unknown error'
    };

    return new Response(JSON.stringify(fallbackResponse), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};