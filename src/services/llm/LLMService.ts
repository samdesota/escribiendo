import { AnthropicProvider } from './providers/AnthropicProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import {
  LLMProvider,
  LLMModelConfig,
  AVAILABLE_MODELS,
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

export class LLMService {
  private provider: LLMProvider;
  private modelConfig: LLMModelConfig;

  constructor(modelId: string = 'gpt-4o') {
    this.modelConfig = AVAILABLE_MODELS[modelId];
    if (!this.modelConfig) {
      throw new Error(`Model ${modelId} not found in available models`);
    }

    this.provider = this.createProvider();
  }

  private createProvider(): LLMProvider {
    switch (this.modelConfig.provider) {
      case 'anthropic':
        return new AnthropicProvider(
          import.meta.env.VITE_ANTHROPIC_API_KEY || '',
          this.modelConfig
        );
      case 'openai':
        return new OpenAIProvider(
          import.meta.env.VITE_OPENAI_API_KEY || '',
          this.modelConfig
        );
      default:
        throw new Error(`Unsupported provider: ${this.modelConfig.provider}`);
    }
  }

  /**
   * Switch to a different model
   */
  switchModel(modelId: string): void {
    const newModelConfig = AVAILABLE_MODELS[modelId];
    if (!newModelConfig) {
      throw new Error(`Model ${modelId} not found in available models`);
    }

    this.modelConfig = newModelConfig;
    this.provider = this.createProvider();
  }

  /**
   * Get current model information
   */
  getCurrentModel(): { id: string; config: LLMModelConfig } {
    const modelId = Object.keys(AVAILABLE_MODELS).find(
      key => AVAILABLE_MODELS[key] === this.modelConfig
    ) || 'unknown';

    return {
      id: modelId,
      config: this.modelConfig
    };
  }

  /**
   * Get list of available models
   */
  static getAvailableModels(): Array<{ id: string; config: LLMModelConfig }> {
    return Object.entries(AVAILABLE_MODELS).map(([id, config]) => ({
      id,
      config
    }));
  }

  /**
   * Get a Spanish suggestion for what the user wants to say
   */
  async getSuggestion(request: ChatSuggestionRequest): Promise<ChatSuggestionResponse> {
    return this.provider.getSuggestion(request);
  }

  /**
   * Get a regular chat response in Spanish with streaming
   */
  async getRegularChatResponseStreaming(
    request: RegularChatRequest,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    return this.provider.getRegularChatResponseStreaming(request, callbacks);
  }

  /**
   * Get a regular chat response in Spanish (non-streaming version)
   */
  async getRegularChatResponse(request: RegularChatRequest): Promise<RegularChatResponse> {
    return this.provider.getRegularChatResponse(request);
  }

  /**
   * Handle side chat conversations about grammar and language
   */
  async getSideChatResponse(request: SideChatRequest): Promise<SideChatResponse> {
    return this.provider.getSideChatResponse(request);
  }

  /**
   * Handle side chat conversations about grammar and language with streaming
   */
  async getSideChatResponseStreaming(
    request: SideChatRequest,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    return this.provider.getSideChatResponseStreaming(request, callbacks);
  }

  /**
   * Get translation for selected text
   */
  async getTranslation(request: TranslationRequest): Promise<TranslationResponse> {
    return this.provider.getTranslation(request);
  }

  /**
   * Generate conversation starters for new chats (both assistant and user questions)
   */
  async getConversationStarters(
    previousAssistantQuestions: string[] = [],
    previousUserQuestions: string[] = []
  ): Promise<ConversationStartersResponse> {
    return this.provider.getConversationStarters(previousAssistantQuestions, previousUserQuestions);
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