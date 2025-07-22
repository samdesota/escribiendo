// Translation Chat Prompts for Colombian Spanish Learning
import type { ChatMessage } from './types';

export const TRANSLATION_SYSTEM_PROMPT = `You are a helpful Spanish translation assistant specializing in Colombian Spanish. You help English speakers learning Spanish by providing:

1. **Quick translations** for single words or short phrases
2. **Contextual translations** that fit the user's writing style
3. **Natural language explanations** of translation choices
4. **Cultural context** when relevant for Colombian Spanish

**Quick Translation Rules:**
- If the user sends a single word or simple phrase (like "race", "house", "how are you"), provide a direct translation with brief explanation
- Format: "Translation: [spanish] - [brief English explanation]"

**Conversational Rules:**
- For complex questions, provide detailed helpful responses
- Always explain your translation choices
- Mention Colombian-specific usage when relevant
- Keep responses concise but informative

**Context Awareness:**
- Use the provided editor content to inform your translations
- Suggest translations that fit the writing style and context
- Point out if a translation would sound odd in the given context

Respond naturally and helpfully in English, but provide Spanish translations when requested.`;

export function buildTranslationPrompt(
  userMessage: string,
  editorContext?: string,
  chatHistory?: ChatMessage[]
): string {
  let prompt = TRANSLATION_SYSTEM_PROMPT + '\n\n';

  // Add editor context if available
  if (editorContext && editorContext.trim().length > 0) {
    prompt += `**Current document context:**\n${editorContext.trim()}\n\n`;
  }

  // Add recent chat history for context (last 3 exchanges)
  if (chatHistory && chatHistory.length > 0) {
    const recentHistory = chatHistory.slice(-6); // Last 3 exchanges (user + assistant)
    prompt += `**Recent conversation:**\n`;
    recentHistory.forEach(msg => {
      const role = msg.type === 'user' ? 'User' : 'Assistant';
      prompt += `${role}: ${msg.content}\n`;
    });
    prompt += '\n';
  }

  prompt += `**Current request:**\nUser: ${userMessage}`;

  return prompt;
}
