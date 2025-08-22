// Client-side LLM service that calls server-side APIs
import type {
  ChatSuggestionRequest,
  ChatSuggestionResponse,
  RegularChatRequest,
  RegularChatResponse,
  StreamingChatCallbacks,
  SideChatRequest,
  SideChatResponse,
  TranslationRequest,
  TranslationResponse,
  ConversationStartersResponse
} from './types';

export class ClientLLMService {
  private model: string;

  constructor(model: string = 'gpt-4o') {
    this.model = model;
  }

  /**
   * Switch to a different model
   */
  switchModel(modelId: string): void {
    this.model = modelId;
  }

  /**
   * Get current model
   */
  getCurrentModel(): { id: string } {
    return { id: this.model };
  }

  /**
   * Get a Spanish suggestion for what the user wants to say
   */
  async getSuggestion(request: ChatSuggestionRequest): Promise<ChatSuggestionResponse> {
    try {
      const response = await fetch('/api/llm/suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          model: this.model
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get suggestion:', error);
      return {
        suggestion: 'Lo siento, hubo un error procesando tu sugerencia.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get a regular chat response in Spanish with streaming
   */
  async getRegularChatResponseStreaming(
    request: RegularChatRequest,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    try {
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          model: this.model,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let fullMessage = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === 'chunk') {
                  fullMessage += data.content;
                  callbacks.onTextChunk(data.content);
                } else if (data.type === 'complete') {
                  callbacks.onComplete(fullMessage);
                  return;
                } else if (data.type === 'error') {
                  callbacks.onError(data.content);
                  return;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Failed to get streaming chat response:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get a regular chat response in Spanish (non-streaming version)
   */
  async getRegularChatResponse(request: RegularChatRequest): Promise<RegularChatResponse> {
    try {
      const response = await fetch('/api/llm/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          model: this.model,
          stream: false
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get chat response:', error);
      return {
        response: 'Lo siento, he tenido un error. ¿Puedes intentarlo de nuevo?',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle side chat conversations about grammar and language
   */
  async getSideChatResponse(request: SideChatRequest): Promise<SideChatResponse> {
    try {
      const response = await fetch('/api/llm/sidechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          model: this.model
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get sidechat response:', error);
      return {
        response: 'Sorry, I encountered an error. Please try asking your question again.',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Handle side chat conversations about grammar and language with streaming
   */
  async getSideChatResponseStreaming(
    request: SideChatRequest,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    try {
      const response = await fetch('/api/llm/sidechat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          model: this.model,
          stream: true
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No reader available');
      }

      const decoder = new TextDecoder();
      let fullMessage = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === 'chunk') {
                  fullMessage += data.content;
                  callbacks.onTextChunk(data.content);
                } else if (data.type === 'complete') {
                  callbacks.onComplete(fullMessage);
                  return;
                } else if (data.type === 'error') {
                  callbacks.onError(data.content);
                  return;
                }
              } catch (e) {
                // Skip invalid JSON lines
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      console.error('Failed to get streaming sidechat response:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get translation for selected text
   */
  async getTranslation(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const response = await fetch('/api/llm/translation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...request,
          model: this.model
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get translation:', error);
      return {
        translation: 'Translation error',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate conversation starters for new chats (both assistant and user questions)
   */
  async getConversationStarters(
    previousAssistantQuestions: string[] = [],
    previousUserQuestions: string[] = []
  ): Promise<ConversationStartersResponse> {
    try {
      const response = await fetch('/api/llm/starters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.model,
          previousAssistantQuestions,
          previousUserQuestions
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to get conversation starters:', error);
      
      // Fallback to static conversation starters
      return {
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
    }
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Extract the last few messages from chat for context
   */
  buildChatContext(messages: Array<{content: string, type: string}>, maxMessages: number = 3): string {
    const recentMessages = messages
      .slice(-maxMessages)
      .filter(msg => msg.type === 'user' || msg.type === 'assistant')
      .map(msg => `${msg.type}: ${msg.content}`)
      .join('\n');
    
    return recentMessages;
  }
}