import type { APIEvent } from "@solidjs/start/server";
import { LLMService } from "~/services/llm/LLMService";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.text) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: text' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Get model from payload or use default
    const modelId = payload.model || 'gpt-4o';
    const llmService = new LLMService(modelId);

    // Create a simple prompt for text correction
    const prompt = `You are a Spanish language tutor helping students improve their writing. 

Your task is to:
1. Correct any grammar, spelling, or syntax errors in the Spanish text
2. Replace any English words or phrases with appropriate Spanish equivalents
3. Improve the natural flow and readability while maintaining the original meaning
4. Ensure the text sounds natural to a native Spanish speaker

Input text: "${payload.text}"

Context: ${payload.context || 'Journal entry practice'}

Return ONLY the corrected Spanish text, nothing else. Do not include explanations, comments, or formatting. Just the improved text.

If the text is already perfect, return it unchanged.`;

    // Use regular chat response instead of structured response for simple text correction
    const correctionResponse = await llmService.getRegularChatResponse({
      userMessage: prompt,
      chatHistory: ''
    });

    if (correctionResponse.error) {
      console.error('Correction error:', correctionResponse.error);
      return new Response(
        JSON.stringify({ error: 'Failed to get text corrections' }),
        {
          status: 500,
          headers: { "content-type": "application/json" },
        }
      );
    }

    return new Response(JSON.stringify({ 
      correctedText: correctionResponse.response 
    }), {
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error('Error processing correction request:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process correction request' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};