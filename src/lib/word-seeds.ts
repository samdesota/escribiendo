import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * Reads the Spanish words file and returns an array of words
 */
async function getSpanishWords(): Promise<string[]> {
  try {
    const wordsPath = join(process.cwd(), 'data', 'spanish-words.txt');
    const content = await readFile(wordsPath, 'utf-8');
    return content
      .split('\n')
      .map(word => word.trim())
      .filter(word => word.length > 0);
  } catch (error) {
    console.error('Error reading Spanish words file:', error);
    // Fallback words if file can't be read
    return [
      'aventura', 'biblioteca', 'cascada', 'dinosaurio', 'elefante',
      'guitarra', 'hospital', 'jardín', 'montaña', 'océano',
      'panadería', 'restaurante', 'universidad', 'volcán', 'zoológico'
    ];
  }
}

/**
 * Randomly selects a specified number of words from the Spanish words list
 */
export async function getRandomSpanishWords(count: number = 5): Promise<string[]> {
  const words = await getSpanishWords();
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, words.length));
}

/**
 * Formats random words for use in LLM prompts
 */
export async function getWordSeedsForPrompt(): Promise<string> {
  const words = await getRandomSpanishWords(5);
  return `Use these random Spanish words as inspiration for creating varied and diverse drill content: ${words.join(', ')}. `;
}