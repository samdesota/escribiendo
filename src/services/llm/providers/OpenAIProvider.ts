import OpenAI from 'openai';
import {
  LLMProvider,
  LLMModelConfig,
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
} from '../types';
import {
  buildChatSuggestionPrompt,
  buildRegularChatPrompt,
  buildSideChatPrompt,
  buildTranslationPrompt,
  buildAssistantQuestionsPrompt,
  buildUserQuestionsPrompt
} from '../chatPrompts';

export class OpenAIProvider implements LLMProvider {
  private openai: OpenAI;
  private modelConfig: LLMModelConfig;

  constructor(apiKey: string, modelConfig: LLMModelConfig) {
    this.openai = new OpenAI({
      apiKey: apiKey || import.meta.env.VITE_OPENAI_API_KEY || '',
      dangerouslyAllowBrowser: true
    });
    this.modelConfig = modelConfig;
  }

  async getSuggestion(request: ChatSuggestionRequest): Promise<ChatSuggestionResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildChatSuggestionPrompt(request.userInput, request.chatContext);

      const response = await this.openai.chat.completions.create({
        model: this.modelConfig.model,
        max_tokens: this.modelConfig.maxTokens.suggestion,
        temperature: this.modelConfig.temperature.suggestion,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      // Clean up the response - remove any quotes or extra formatting
      let suggestion = content.trim();
      
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
      console.error('OpenAI suggestion service error:', error);
      return {
        suggestion: 'Lo siento, hubo un error procesando tu sugerencia.',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  async getRegularChatResponseStreaming(
    request: RegularChatRequest,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    try {
      const prompt = buildRegularChatPrompt(request.userMessage, request.chatHistory);

      const stream = await this.openai.chat.completions.create({
        model: this.modelConfig.model,
        max_tokens: this.modelConfig.maxTokens.chat,
        temperature: this.modelConfig.temperature.chat,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true
      });

      let fullMessage = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullMessage += content;
          callbacks.onTextChunk(content);
        }
      }

      callbacks.onComplete(fullMessage.trim());

    } catch (error) {
      console.error('OpenAI streaming error:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown streaming error');
    }
  }

  async getRegularChatResponse(request: RegularChatRequest): Promise<RegularChatResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildRegularChatPrompt(request.userMessage, request.chatHistory);

      const response = await this.openai.chat.completions.create({
        model: this.modelConfig.model,
        max_tokens: this.modelConfig.maxTokens.chat,
        temperature: this.modelConfig.temperature.chat,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      return {
        response: content.trim(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('OpenAI chat service error:', error);
      return {
        response: 'Lo siento, he tenido un error. ¿Puedes intentarlo de nuevo?',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  async getSideChatResponse(request: SideChatRequest): Promise<SideChatResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildSideChatPrompt(
        request.originalContext,
        request.spanishSuggestion,
        request.studentMessage
      );

      const response = await this.openai.chat.completions.create({
        model: this.modelConfig.model,
        max_tokens: this.modelConfig.maxTokens.sideChat,
        temperature: this.modelConfig.temperature.sideChat,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      return {
        response: content.trim(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('OpenAI side chat service error:', error);
      return {
        response: 'Sorry, I encountered an error. Please try asking your question again.',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  async getSideChatResponseStreaming(
    request: SideChatRequest,
    callbacks: StreamingChatCallbacks
  ): Promise<void> {
    try {
      const prompt = buildSideChatPrompt(
        request.originalContext,
        request.spanishSuggestion,
        request.studentMessage
      );

      const stream = await this.openai.chat.completions.create({
        model: this.modelConfig.model,
        max_tokens: this.modelConfig.maxTokens.sideChat,
        temperature: this.modelConfig.temperature.sideChat,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        stream: true
      });

      let fullMessage = '';

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullMessage += content;
          callbacks.onTextChunk(content);
        }
      }

      callbacks.onComplete(fullMessage);

    } catch (error) {
      console.error('OpenAI side chat streaming service error:', error);
      callbacks.onError(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  async getTranslation(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildTranslationPrompt(
        request.selectedText,
        request.contextMessage,
        request.chatContext || ''
      );

      const response = await this.openai.chat.completions.create({
        model: this.modelConfig.model,
        max_tokens: this.modelConfig.maxTokens.translation,
        temperature: this.modelConfig.temperature.translation,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response content from OpenAI');
      }

      return {
        translation: content.trim(),
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error('OpenAI translation service error:', error);
      return {
        translation: 'Translation error',
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  async getConversationStarters(
    previousAssistantQuestions: string[] = [],
    previousUserQuestions: string[] = []
  ): Promise<ConversationStartersResponse> {
    const startTime = Date.now();

    try {
      // Generate both types of questions in parallel
      const [assistantResponse, userResponse] = await Promise.all([
        this.openai.chat.completions.create({
          model: this.modelConfig.model,
          max_tokens: this.modelConfig.maxTokens.conversationStarters,
          temperature: this.modelConfig.temperature.conversationStarters,
          messages: [{ role: 'user', content: buildAssistantQuestionsPrompt(previousAssistantQuestions) }]
        }),
        this.openai.chat.completions.create({
          model: this.modelConfig.model,
          max_tokens: this.modelConfig.maxTokens.conversationStarters,
          temperature: this.modelConfig.temperature.conversationStarters,
          messages: [{ role: 'user', content: buildUserQuestionsPrompt(previousUserQuestions) }]
        })
      ]);

      const assistantContent = assistantResponse.choices[0]?.message?.content;
      const userContent = userResponse.choices[0]?.message?.content;
      
      if (!assistantContent || !userContent) {
        throw new Error('No response content from OpenAI');
      }

      // Parse assistant questions
      const assistantQuestions = assistantContent
        .trim()
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.trim())
        .slice(0, 3);

      // Parse user questions
      const userQuestions = userContent
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
      console.error('OpenAI conversation starters service error:', error);
      
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
}