import Anthropic from '@anthropic-ai/sdk';
import { buildPrompt } from './prompts';
import type {
  LLMSuggestionRequest,
  LLMSuggestionResponse,
  LLMBatchRequest,
  LLMBatchResponse,
  SuggestionType,
  RawLLMSuggestion,
  LLMSuggestion
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
   * Find exact character offsets using context before/after
   */
  private findExactOffsets(
    fullText: string,
    originalText: string,
    contextBefore: string,
    contextAfter: string
  ): { startOffset: number; endOffset: number } | null {
    // Clean up context strings (trim whitespace)
    const cleanContextBefore = contextBefore.trim();
    const cleanContextAfter = contextAfter.trim();
    const cleanOriginalText = originalText.trim();

    // Create search pattern: contextBefore + originalText + contextAfter
    const searchPattern = `${cleanContextBefore} ${cleanOriginalText} ${cleanContextAfter}`;

    // Find the pattern in the full text
    let searchIndex = fullText.indexOf(searchPattern);
    if (searchIndex !== -1) {
      const startOffset = searchIndex + cleanContextBefore.length + 1; // +1 for space
      const endOffset = startOffset + cleanOriginalText.length;
      return { startOffset, endOffset };
    }

    // Fallback: try with more flexible whitespace matching
    const flexiblePattern = new RegExp(
      cleanContextBefore.replace(/\s+/g, '\\s+') +
      '\\s+' +
      cleanOriginalText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
      '\\s+' +
      cleanContextAfter.replace(/\s+/g, '\\s+'),
      'i'
    );

    const match = fullText.match(flexiblePattern);
    if (match) {
      const matchStart = fullText.indexOf(match[0]);
      const beforeLength = cleanContextBefore.length;
      // Find the start of originalText within the match
      const originalStart = match[0].indexOf(cleanOriginalText, beforeLength);
      if (originalStart !== -1) {
        const startOffset = matchStart + originalStart;
        const endOffset = startOffset + cleanOriginalText.length;
        return { startOffset, endOffset };
      }
    }

    // Last resort: just find the original text directly (less precise)
    const directIndex = fullText.indexOf(cleanOriginalText);
    if (directIndex !== -1) {
      return {
        startOffset: directIndex,
        endOffset: directIndex + cleanOriginalText.length
      };
    }

    return null;
  }

  /**
   * Process raw LLM suggestions to add exact offsets
   */
  private processRawSuggestions(
    rawSuggestions: RawLLMSuggestion[],
    fullText: string,
    type: SuggestionType
  ): LLMSuggestion[] {
    return rawSuggestions.map(rawSuggestion => {
      const offsets = this.findExactOffsets(
        fullText,
        rawSuggestion.originalText,
        rawSuggestion.contextBefore,
        rawSuggestion.contextAfter
      );

      if (!offsets) {
        console.warn(`Could not find exact offsets for suggestion: "${rawSuggestion.originalText}"`);
        // Return a suggestion with placeholder offsets
        return {
          startOffset: 0,
          endOffset: rawSuggestion.originalText.length,
          originalText: rawSuggestion.originalText,
          suggestedText: rawSuggestion.suggestedText,
          explanation: rawSuggestion.explanation,
          contextBefore: rawSuggestion.contextBefore,
          contextAfter: rawSuggestion.contextAfter,
          confidence: rawSuggestion.confidence * 0.5, // Reduce confidence due to positioning uncertainty
          type
        };
      }

      return {
        startOffset: offsets.startOffset,
        endOffset: offsets.endOffset,
        originalText: rawSuggestion.originalText,
        suggestedText: rawSuggestion.suggestedText,
        explanation: rawSuggestion.explanation,
        contextBefore: rawSuggestion.contextBefore,
        contextAfter: rawSuggestion.contextAfter,
        confidence: rawSuggestion.confidence,
        type
      };
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

      // Process raw suggestions to add exact offsets
      const rawSuggestions: RawLLMSuggestion[] = parsedResponse.suggestions.map((suggestion: any) => ({
        originalText: suggestion.originalText,
        suggestedText: suggestion.suggestedText,
        explanation: suggestion.explanation,
        contextBefore: suggestion.contextBefore || '',
        contextAfter: suggestion.contextAfter || '',
        confidence: suggestion.confidence || 0.7
      }));

      const suggestions = this.processRawSuggestions(rawSuggestions, request.text, request.type);

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
