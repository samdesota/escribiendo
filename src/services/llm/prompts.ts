// Spanish Prompts for Colombian Spanish Language Learning

export const GRAMMAR_PROMPT = `Eres un experto en gramática del español colombiano que ayuda a estudiantes de español como segunda lengua. Analiza el siguiente texto y identifica errores gramaticales, incluyendo:

- Errores de conjugación verbal
- Concordancia de género y número
- Uso incorrecto de preposiciones
- Errores de sintaxis
- Problemas con artículos (el, la, los, las)
- Uso incorrecto de ser/estar
- Errores con subjuntivo/indicativo

Para cada error encontrado, proporciona:
1. El texto exacto con error
2. La corrección sugerida
3. Una explicación breve en inglés para el estudiante

Responde SOLO con un JSON válido en este formato:
{
  "suggestions": [
    {
      "originalText": "texto con error",
      "suggestedText": "texto corregido",
      "explanation": "Brief English explanation of the grammatical rule",
      "startOffset": 0,
      "endOffset": 10,
      "confidence": 0.9
    }
  ]
}

Texto a analizar:`;

export const NATURAL_PHRASES_PROMPT = `Eres un experto en español colombiano que ayuda a estudiantes a sonar más naturales y auténticos. Analiza el siguiente texto y sugiere alternativas más naturales, incluyendo:

- Modismos y expresiones colombianas
- Palabras más comunes en Colombia
- Frases que suenan más naturales en español latinoamericano
- Expresiones coloquiales apropiadas
- Sinónimos más usados en Colombia

Para cada sugerencia, proporciona:
1. El texto original
2. Una alternativa más natural en español colombiano
3. Una explicación en inglés de por qué es más natural

Responde SOLO con un JSON válido en este formato:
{
  "suggestions": [
    {
      "originalText": "frase original",
      "suggestedText": "frase más natural",
      "explanation": "English explanation of why this is more natural in Colombian Spanish",
      "startOffset": 0,
      "endOffset": 10,
      "confidence": 0.8
    }
  ]
}

Texto a analizar:`;

export const ENGLISH_WORDS_PROMPT = `Eres un experto en español colombiano que ayuda a estudiantes a reemplazar palabras en inglés por sus equivalentes en español. Identifica palabras en inglés en el texto (excluyendo nombres propios, títulos, y palabras entre comillas) y sugiere traducciones apropiadas para español colombiano.

Para cada palabra en inglés encontrada, proporciona:
1. La palabra en inglés
2. La traducción más apropiada en español colombiano
3. Una explicación en inglés si hay diferencias regionales

Responde SOLO con un JSON válido en este formato:
{
  "suggestions": [
    {
      "originalText": "english word",
      "suggestedText": "palabra en español",
      "explanation": "English explanation of the translation choice",
      "startOffset": 0,
      "endOffset": 10,
      "confidence": 0.9
    }
  ]
}

Texto a analizar:`;

export function buildPrompt(type: 'grammar' | 'natural-phrases' | 'english-words', text: string): string {
  const prompts = {
    'grammar': GRAMMAR_PROMPT,
    'natural-phrases': NATURAL_PHRASES_PROMPT,
    'english-words': ENGLISH_WORDS_PROMPT
  };

  return prompts[type] + '\n\n' + text;
}
