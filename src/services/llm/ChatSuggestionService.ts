import Anthropic from '@anthropic-ai/sdk';
import { buildChatSuggestionPrompt, buildSideChatPrompt, buildRegularChatPrompt } from './chatPrompts';

export interface ChatSuggestionRequest {
  userInput: string;
  chatContext?: string;
}

export interface ChatSuggestionResponse {
  suggestion: string;
  processingTime?: number;
  error?: string;
}

export interface SideChatRequest {
  originalContext: string;
  spanishSuggestion: string;
  studentMessage: string;
}

export interface SideChatResponse {
  response: string;
  processingTime?: number;
  error?: string;
}

export interface RegularChatRequest {
  userMessage: string;
  chatHistory?: string;
}

export interface RegularChatResponse {
  response: string;
  processingTime?: number;
  error?: string;
}

export interface StreamingChatCallbacks {
  onTextChunk: (chunk: string) => void;
  onComplete: (finalText: string) => void;
  onError: (error: string) => void;
}

export class ChatSuggestionService {
  private anthropic: Anthropic;
  private model: string = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      dangerouslyAllowBrowser: true,
      apiKey: apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    });
  }

  /**
   * Get a Spanish suggestion for what the user wants to say
   */
  async getSuggestion(request: ChatSuggestionRequest): Promise<ChatSuggestionResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildChatSuggestionPrompt(request.userInput, request.chatContext);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 200, // Keep suggestions concise
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Clean up the response - remove any quotes or extra formatting
      let suggestion = content.text.trim();
      
      // Remove surrounding quotes if present
      if ((suggestion.startsWith('"') && suggestion.endsWith('"')) ||
          (suggestion.startsWith("'") && suggestion.endsWith("'"))) {
        suggestion = suggestion.slice(1, -1);
      }

      return {
        suggestion,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Chat suggestion service error:', error);
      return {
        suggestion: 'Lo siento, hubo un error procesando tu sugerencia.',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
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
    const startTime = Date.now();

    try {
      const prompt = buildRegularChatPrompt(request.userMessage, request.chatHistory);

      const stream = await this.anthropic.messages.stream({
        model: this.model,
        max_tokens: 600,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      let fullMessage = '';

      // Handle streaming text chunks
      stream.on('text', (text: string) => {
        fullMessage += text;
        callbacks.onTextChunk(text);
      });

      // Handle completion
      stream.on('end', () => {
        callbacks.onComplete(fullMessage.trim());
      });

      // Handle errors
      stream.on('error', (error: any) => {
        console.error('Regular chat streaming error:', error);
        callbacks.onError(error instanceof Error ? error.message : 'Unknown streaming error');
      });

    } catch (error) {
      console.error('Regular chat service error:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get a regular chat response in Spanish (non-streaming version)
   */
  async getRegularChatResponse(request: RegularChatRequest): Promise<RegularChatResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildRegularChatPrompt(request.userMessage, request.chatHistory);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 600,
        temperature: 0.7,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return {
        response: content.text.trim(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Regular chat service error:', error);
      return {
        response: 'Lo siento, he tenido un error. ¿Puedes intentarlo de nuevo?',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Handle side chat conversations about grammar and language
   */
  async getSideChatResponse(request: SideChatRequest): Promise<SideChatResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildSideChatPrompt(
        request.originalContext,
        request.spanishSuggestion,
        request.studentMessage
      );

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 800,
        temperature: 0.4,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      return {
        response: content.text.trim(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Side chat service error:', error);
      return {
        response: 'Sorry, I encountered an error. Please try asking your question again.',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
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