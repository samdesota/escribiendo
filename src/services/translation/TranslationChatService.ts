import Anthropic from '@anthropic-ai/sdk';
import { buildTranslationPrompt } from './prompts';
import type { TranslationRequest, TranslationResponse, ChatMessage } from './types';

export class TranslationChatService {
  private anthropic: Anthropic;
  private model: string = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      dangerouslyAllowBrowser: true,
      apiKey: apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    });
  }

  /**
   * Send a translation request with optional editor context and chat history
   */
  async getTranslation(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();

    try {
      // Build the prompt with context
      const prompt = buildTranslationPrompt(
        request.message,
        request.editorContext,
        request.chatHistory
      );

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 1000,
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

      return {
        message: content.text.trim(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Translation service error:', error);
      return {
        message: 'Sorry, I encountered an error processing your translation request.',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Check if a user message looks like a quick translation request
   */
  isQuickTranslation(message: string): boolean {
    const trimmed = message.trim().toLowerCase();

    // Single word or short phrase patterns
    const patterns = [
      /^[a-z\s]{1,20}$/i, // Simple word or short phrase
      /^how do you say .{1,30}\??$/i, // "how do you say X?"
      /^what is .{1,30} in spanish\??$/i, // "what is X in spanish?"
      /^translate .{1,30}$/i, // "translate X"
    ];

    return patterns.some(pattern => pattern.test(trimmed));
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create a new chat message
   */
  createMessage(type: 'user' | 'assistant', content: string): ChatMessage {
    return {
      id: this.generateMessageId(),
      type,
      content,
      timestamp: Date.now()
    };
  }
}
