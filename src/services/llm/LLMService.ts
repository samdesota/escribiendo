import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt } from './prompts';
import type {
  LLMSuggestionRequest,
  LLMSuggestionResponse,
  LLMBatchRequest,
  LLMBatchResponse,
  SuggestionType
} from './types';

export class LLMService {
  private anthropic: Anthropic;
  private model: string = 'claude-3-5-sonnet-20241022';

  constructor(apiKey?: string) {
    this.anthropic = new Anthropic({
      dangerouslyAllowBrowser: true,
      apiKey: apiKey || import.meta.env.VITE_ANTHROPIC_API_KEY || '',
    });
  }

  /**
   * Make a single suggestion request to Claude
   */
  async getSuggestions(request: LLMSuggestionRequest): Promise<LLMSuggestionResponse> {
    const startTime = Date.now();

    try {
      const prompt = buildPrompt(request.type, request.text);

      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: 2000,
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

      // Parse the JSON response
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No valid JSON found in Claude response');
      }

      const parsedResponse = JSON.parse(jsonMatch[0]);

      // Add type and validate suggestions
      const suggestions = parsedResponse.suggestions.map((suggestion: any) => ({
        ...suggestion,
        type: request.type,
        confidence: suggestion.confidence || 0.7
      }));

      return {
        suggestions,
        processingTime: Date.now() - startTime
      };

    } catch (error) {
      console.error(`LLM Service error for ${request.type}:`, error);
      return {
        suggestions: [],
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime: Date.now() - startTime
      };
    }
  }

  /**
   * Get all three types of suggestions in parallel
   */
  async getBatchSuggestions(batchRequest: LLMBatchRequest): Promise<LLMBatchResponse> {
    const requests: Promise<LLMSuggestionResponse>[] = [];
    const types: SuggestionType[] = [];

    // Build parallel requests based on what's requested
    if (batchRequest.requests.grammar) {
      requests.push(this.getSuggestions({
        text: batchRequest.text,
        type: 'grammar',
        targetLanguage: 'colombian-spanish'
      }));
      types.push('grammar');
    }

    if (batchRequest.requests.naturalPhrases) {
      requests.push(this.getSuggestions({
        text: batchRequest.text,
        type: 'natural-phrases',
        targetLanguage: 'colombian-spanish'
      }));
      types.push('natural-phrases');
    }

    if (batchRequest.requests.englishWords) {
      requests.push(this.getSuggestions({
        text: batchRequest.text,
        type: 'english-words',
        targetLanguage: 'colombian-spanish'
      }));
      types.push('english-words');
    }

    // Execute all requests in parallel
    const responses = await Promise.all(requests);

    // Map responses back to their types
    const result: Partial<LLMBatchResponse> = {};
    responses.forEach((response, index) => {
      const type = types[index];
      if (type === 'grammar') result.grammar = response;
      else if (type === 'natural-phrases') result.naturalPhrases = response;
      else if (type === 'english-words') result.englishWords = response;
    });

    // Fill in empty responses for non-requested types
    return {
      grammar: result.grammar || { suggestions: [] },
      naturalPhrases: result.naturalPhrases || { suggestions: [] },
      englishWords: result.englishWords || { suggestions: [] }
    };
  }

  /**
   * Convert flat text offsets to paragraph coordinates
   */
  static flatOffsetsToCoordinates(text: string, startOffset: number, endOffset: number) {
    const lines = text.split('\n');
    let currentOffset = 0;

    let startParagraph = 0;
    let startOffsetInParagraph = startOffset;
    let endParagraph = 0;
    let endOffsetInParagraph = endOffset;

    // Find start paragraph
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length;
      if (currentOffset + lineLength >= startOffset) {
        startParagraph = i;
        startOffsetInParagraph = startOffset - currentOffset;
        break;
      }
      currentOffset += lineLength + 1; // +1 for newline
    }

    // Find end paragraph
    currentOffset = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineLength = lines[i].length;
      if (currentOffset + lineLength >= endOffset) {
        endParagraph = i;
        endOffsetInParagraph = endOffset - currentOffset;
        break;
      }
      currentOffset += lineLength + 1; // +1 for newline
    }

    return {
      startParagraph,
      startOffset: startOffsetInParagraph,
      endParagraph,
      endOffset: endOffsetInParagraph
    };
  }
}
