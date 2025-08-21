import Anthropic from '@anthropic-ai/sdk';
import { buildChatSuggestionPrompt, buildSideChatPrompt, buildRegularChatPrompt, buildTranslationPrompt, buildAssistantQuestionsPrompt, buildUserQuestionsPrompt } from './chatPrompts';

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

export interface TranslationRequest {
  selectedText: string;
  contextMessage: string;
  chatContext?: string;
}

export interface TranslationResponse {
  translation: string;
  processingTime?: number;
  error?: string;
}

export interface ConversationStartersResponse {
  assistantQuestions: string[];
  userQuestions: string[];
  processingTime?: number;
  error?: string;
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
   * Get translation for selected text
   */
  async getTranslation(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildTranslationPrompt(
        request.selectedText,
        request.contextMessage,
        request.chatContext || ''
      );

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 200,
        temperature: 0.2,
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
        translation: content.text.trim(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Translation service error:', error);
      return {
        translation: 'Translation error',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
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
    const startTime = Date.now();

    try {
      // Generate both types of questions in parallel
      const [assistantResponse, userResponse] = await Promise.all([
        this.anthropic.messages.create({
          model: this.model,
          max_tokens: 200,
          temperature: 0.8,
          messages: [{ role: 'user', content: buildAssistantQuestionsPrompt(previousAssistantQuestions) }]
        }),
        this.anthropic.messages.create({
          model: this.model,
          max_tokens: 200,
          temperature: 0.8,
          messages: [{ role: 'user', content: buildUserQuestionsPrompt(previousUserQuestions) }]
        })
      ]);

      // Process assistant questions
      const assistantContent = assistantResponse.content[0];
      const userContent = userResponse.content[0];
      
      if (assistantContent.type !== 'text' || userContent.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      // Parse assistant questions
      const assistantQuestions = assistantContent.text
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim())
        .slice(0, 3);

      // Parse user questions
      const userQuestions = userContent.text
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim())
        .slice(0, 3);

      return {
        assistantQuestions,
        userQuestions,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('Conversation starters service error:', error);
      
      // Fallback to static conversation starters
      const fallbackAssistantQuestions = [
        "Cuéntame sobre tu día típico",
        "¿Qué es lo que más te gusta de tu ciudad?",
        "Háblame de tu comida favorita"
      ];

      const fallbackUserQuestions = [
        "¿Cuál es la tradición española más importante?",
        "¿Qué consejos tienes para mejorar mi pronunciación?",
        "¿Cómo es la vida en España comparada con otros países?"
      ];

      return {
        assistantQuestions: fallbackAssistantQuestions,
        userQuestions: fallbackUserQuestions,
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