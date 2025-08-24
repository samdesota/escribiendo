import type { APIEvent } from "@solidjs/start/server";
import { LLMService } from "~/services/llm/LLMService";
import { getUserProgressWithRules, createConjugationDrill, createDrillSession } from "~/server/db/conjugation-queries";
import { CONJUGATION_RULES, getRulesByOrder } from "~/lib/conjugation-rules";
import { getWordSeedsForPrompt } from "~/lib/word-seeds";

export const POST = async (event: APIEvent) => {
  try {
    const payload = await event.request.json();
    const { userId, count = 5, focusRuleId } = payload;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        {
          status: 400,
          headers: { "content-type": "application/json" },
        }
      );
    }

    // Get user progress to understand what rules are unlocked and their performance
    const userProgress = await getUserProgressWithRules(userId);
    const unlockedRuleIds = userProgress
      .filter(p => p.progress.isUnlocked)
      .map(p => p.progress.ruleId);

    // If no rules unlocked, unlock the first one
    if (unlockedRuleIds.length === 0) {
      const firstRule = getRulesByOrder()[0];
      unlockedRuleIds.push(firstRule.id);
    }

    // Determine which rules to focus on
    let rulesToFocus: string[] = [];
    
    if (focusRuleId && unlockedRuleIds.includes(focusRuleId)) {
      // Focus on specific rule (when user unlocks a new rule)
      rulesToFocus = [focusRuleId];
    } else {
      // Mix of rules based on performance
      const weakRules = userProgress
        .filter(p => p.progress.isUnlocked && p.progress.totalAttempts > 0)
        .filter(p => (p.progress.correctCount / p.progress.totalAttempts) < 0.8)
        .map(p => p.progress.ruleId);
      
      const recentRules = userProgress
        .filter(p => p.progress.isUnlocked)
        .sort((a, b) => {
          const aTime = a.progress.lastAttemptAt?.getTime() || 0;
          const bTime = b.progress.lastAttemptAt?.getTime() || 0;
          return bTime - aTime;
        })
        .slice(0, 3)
        .map(p => p.progress.ruleId);
      
      rulesToFocus = [...new Set([...weakRules, ...recentRules, ...unlockedRuleIds.slice(-2)])];
    }

    // Get random word seeds for variety
    const wordSeeds = await getWordSeedsForPrompt();

    // Create prompt for LLM to generate drills
    const rulesContext = CONJUGATION_RULES
      .filter(rule => rulesToFocus.includes(rule.id))
      .map(rule => `Rule "${rule.name}": ${rule.description}. Examples: ${rule.examples.join(', ')}`)
      .join('\n\n');

    const userStats = userProgress
      .filter(p => rulesToFocus.includes(p.progress.ruleId))
      .map(p => {
        const rule = CONJUGATION_RULES.find(r => r.id === p.progress.ruleId);
        const accuracy = p.progress.totalAttempts > 0 
          ? Math.round((p.progress.correctCount / p.progress.totalAttempts) * 100)
          : 0;
        const lastAttempt = p.progress.lastAttemptAt 
          ? new Date(p.progress.lastAttemptAt).toLocaleDateString()
          : 'Never';
        return `${rule?.name || p.progress.ruleId}: ${accuracy}% accuracy (${p.progress.correctCount}/${p.progress.totalAttempts}), last attempt: ${lastAttempt}`;
      })
      .join('\n');

    const prompt = `${wordSeeds}Generate ${count} Spanish conjugation drill exercises based on these rules:

${rulesContext}

User Performance Stats:
${userStats}

For each drill, create a sentence in Spanish where ONE verb should be conjugated. Replace that verb with [VERB: infinitive, PRONOUN, TENSE] format.

Requirements:
1. The sentence should clearly indicate which tense to use through context
2. Vary the verbs, pronouns, and difficulty
3. Focus more on rules where the user has lower accuracy
4. Make sentences natural and contextually clear about the required tense
5. Include a mix of easy and challenging examples
6. IMPORTANT: Incorporate the provided random words into your sentences for variety and to avoid repetitive content. Use them as nouns, subjects, or context within the sentences to create diverse scenarios.

Return ONLY a JSON array with this exact format:
[
  {
    "sentence": "Mañana [VERB: hablar, yo, future] con mi madre por teléfono",
    "verb": "hablar",
    "pronoun": "yo", 
    "tense": "future",
    "correctAnswer": "hablaré",
    "ruleId": "regular-future",
    "difficulty": 2
  }
]

Tenses to use: ${Array.from(new Set(CONJUGATION_RULES.filter(r => rulesToFocus.includes(r.id)).flatMap(r => r.tenses))).join(', ')}`;

    const llmService = new LLMService('gpt-4o');
    const response = await llmService.getStructuredResponse({
      prompt,
      schema: 'Array of drill objects with sentence, verb, pronoun, tense, correctAnswer, ruleId, and difficulty properties'
    });

    if (response.error) {
      console.error('LLM service error:', response.error);
      throw new Error('Failed to generate drills from LLM');
    }

    const generatedDrills = response.data;

    // Save drills to database
    const savedDrills = [];
    for (const drill of generatedDrills) {
      const savedDrill = await createConjugationDrill({
        id: `drill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sentence: drill.sentence,
        verb: drill.verb,
        pronoun: drill.pronoun,
        tense: drill.tense,
        correctAnswer: drill.correctAnswer,
        ruleId: drill.ruleId,
        difficulty: drill.difficulty || 1
      });
      savedDrills.push(savedDrill);
    }

    // Create drill session
    const drillSession = await createDrillSession({
      id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
      drillIds: savedDrills.map(d => d.id),
      status: 'active'
    });

    return new Response(JSON.stringify({
      session: drillSession,
      drills: savedDrills
    }), {
      status: 201,
      headers: { "content-type": "application/json" },
    });

  } catch (error) {
    console.error('Error generating drills:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to generate drills' }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      }
    );
  }
};