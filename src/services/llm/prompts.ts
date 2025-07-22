// Spanish Prompts for Latin American Spanish Language Learning

export const GRAMMAR_PROMPT = `Eres un experto en gramática del español latinoamericano que ayuda a estudiantes de español como segunda lengua. Analiza el siguiente texto y identifica errores gramaticales, incluyendo:

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
4. Contexto antes y después del error (2-4 palabras)

Responde SOLO con un JSON válido en este formato:
{
  "suggestions": [
    {
      "originalText": "texto con error",
      "suggestedText": "texto corregido",
      "explanation": "Brief English explanation of the grammatical rule, no más de 10 palabras",
      "contextBefore": "palabras antes del",
      "contextAfter": "del error aquí",
      "confidence": 0.9
    }
  ]
}

Si no encuentras errores gramaticales, devuelve una lista vacía: {"suggestions": []}. NO crees sugerencias que digan que no hay errores.

Texto a analizar:`;

export const NATURAL_PHRASES_PROMPT = `Eres un experto en español latinoamericano que ayuda a estudiantes de inglés a sonar más naturales y auténticos. Analiza el siguiente texto y sugiere hasta 2 alternativas más naturales, enfocándote en:

- Expresiones idiomáticas comunes en español latinoamericano
- Frases que suenan más naturales para hablantes nativos
- Modismos ampliamente usados en Latinoamérica
- Solo cambios significativos que realmente mejoren la naturalidad

Evita sugerencias demasiado específicas o cambios menores. Enfócate en frases que claramente suenan no naturales o muy formales para un hablante de inglés.

Para cada sugerencia, proporciona:
1. El texto original
2. Una alternativa más natural en español latinoamericano
3. Una explicación en inglés de por qué es más natural
4. Contexto antes y después de la frase (2-4 palabras)

Responde SOLO con un JSON válido en este formato (máximo 2 sugerencias):
{
  "suggestions": [
    {
      "originalText": "frase original",
      "suggestedText": "frase más natural",
      "explanation": "English explanation of why this is more natural in Latin American Spanish, no más de 10 palabras",
      "contextBefore": "palabras antes de",
      "contextAfter": "de la frase",
      "confidence": 0.8
    }
  ]
}

Si no encuentras frases que puedan ser más naturales, devuelve una lista vacía: {"suggestions": []}. NO crees sugerencias que digan que no hay frases para mejorar.

Texto a analizar:`;

export const ENGLISH_WORDS_PROMPT = `Eres un experto en español latinoamericano que ayuda a estudiantes a reemplazar palabras en inglés por sus equivalentes en español. Identifica palabras en inglés en el texto (excluyendo nombres propios, títulos, y palabras entre comillas) y sugiere traducciones apropiadas para español latinoamericano.

Para cada palabra en inglés encontrada, proporciona:
1. La palabra en inglés
2. La traducción más apropiada en español latinoamericano
3. Una explicación en inglés si hay diferencias regionales
4. Contexto antes y después de la palabra (2-4 palabras)

Responde SOLO con un JSON válido en este formato:
{
  "suggestions": [
    {
      "originalText": "english word",
      "suggestedText": "palabra en español",
      "explanation": "English explanation of the translation choice, no más de 10 palabras",
      "contextBefore": "words before the",
      "contextAfter": "word in text",
      "confidence": 0.9
    }
  ]
}

Si no encuentras palabras en inglés para reemplazar, devuelve una lista vacía: {"suggestions": []}. NO crees sugerencias que digan que no hay palabras en inglés.

Texto a analizar:`;

export const COMBINED_ANALYSIS_PROMPT = `Eres un experto en español latinoamericano que ayuda a estudiantes de inglés a mejorar su escritura. Analiza el siguiente texto y proporciona sugerencias en tres categorías:

1. **GRAMMAR** - Errores gramaticales:
   - Errores de conjugación verbal
   - Concordancia de género y número
   - Uso incorrecto de preposiciones
   - Errores de sintaxis
   - Problemas con artículos (el, la, los, las)
   - Uso incorrecto de ser/estar
   - Errores con subjuntivo/indicativo

2. **NATURAL-PHRASES** - Frases más naturales:
   - Expresiones idiomáticas comunes en español latinoamericano
   - Frases que suenan más naturales para hablantes nativos
   - Modismos ampliamente usados en Latinoamérica
   - Solo cambios significativos que realmente mejoren la naturalidad
   - Máximo 2 sugerencias de este tipo

3. **ENGLISH-WORDS** - Palabras en inglés:
   - Palabras en inglés que deben reemplazarse por español
   - Excluye nombres propios, títulos, y palabras entre comillas

Para cada sugerencia encontrada, proporciona:
1. El texto exacto original
2. La corrección/mejora sugerida
3. Una explicación breve en inglés (máximo 10 palabras)
4. Contexto antes y después (2-4 palabras)
5. El tipo de sugerencia: "grammar", "natural-phrases", o "english-words"

Responde SOLO con un JSON válido en este formato:
{
  "suggestions": [
    {
      "originalText": "texto original",
      "suggestedText": "texto corregido/mejorado",
      "explanation": "Brief English explanation, max 10 words",
      "contextBefore": "palabras antes",
      "contextAfter": "palabras después",
      "confidence": 0.9,
      "type": "grammar"
    }
  ]
}

Si no encuentras sugerencias en alguna categoría, simplemente no incluyas sugerencias de ese tipo. NO crees sugerencias que digan que no hay errores.

Texto a analizar:`;

export function buildPrompt(type: 'grammar' | 'natural-phrases' | 'english-words', text: string): string {
  const prompts = {
    'grammar': GRAMMAR_PROMPT,
    'natural-phrases': NATURAL_PHRASES_PROMPT,
    'english-words': ENGLISH_WORDS_PROMPT
  };

  return prompts[type] + '\n\n' + text;
}

export function buildCombinedPrompt(text: string): string {
  return COMBINED_ANALYSIS_PROMPT + '\n\n' + text;
}
