import type { APIEvent } from "@solidjs/start/server";
import { LLMService } from "~/services/llm/LLMService";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    
    // Validate required fields
    if (!payload.userMessage) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: userMessage' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Get model from payload or use default
    const modelId = payload.model || 'gpt-4o';
    const llmService = new LLMService(modelId);

    // Check if streaming is requested
    if (payload.stream) {
      // Set up SSE headers for streaming
      const headers = new Headers({
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control',
      });

      // Create a ReadableStream for SSE
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          
          llmService.getRegularChatResponseStreaming(
            {
              userMessage: payload.userMessage,
              chatHistory: payload.chatHistory
            },
            {
              onTextChunk: (chunk: string) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`));
              },
              onComplete: (finalText: string) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'complete', content: finalText })}\n\n`));
                controller.close();
              },
              onError: (error: string) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'error', content: error })}\n\n`));
                controller.close();
              }
            }
          );
        }
      });

      return new Response(stream, { headers });
    } else {
      // Non-streaming response
      const response = await llmService.getRegularChatResponse({
        userMessage: payload.userMessage,
        chatHistory: payload.chatHistory
      });

      return new Response(JSON.stringify(response), {
        headers: { "content-type": "application/json" },
      });
    }
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response(
      JSON.stringify({ 
        response: 'Lo siento, he tenido un error. ¿Puedes intentarlo de nuevo?',
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};