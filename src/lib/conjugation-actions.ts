"use server";

import { 
  getUserProgressWithRules, 
  unlockUserRule, 
  recordDrillAttempt,
  createConjugationDrill,
  createDrillSession,
  completeDrillSession,
  getDrillSessionWithDrills,
  getActiveDrillSession,
  getUnlockProgress
} from "~/server/db/conjugation-queries";
import { CONJUGATION_RULES, getRulesByOrder } from "~/lib/conjugation-rules";
import { LLMService } from "~/services/llm/LLMService";
import { getWordSeedsForPrompt } from "~/lib/word-seeds";

export async function generateDrillsAction(userId: string, count: number = 5) {
  // Always complete any existing active sessions to ensure we generate fresh drills
  const existingSession = await getActiveDrillSession(userId);
  if (existingSession) {
    await completeDrillSession(userId, existingSession.id);
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

  const focusRuleId = userProgress.find(p => p.progress.totalAttempts < 20)?.progress.ruleId;

  // Determine which rules to focus on
  let rulesToFocus: string[] = [];
  
  if (focusRuleId && unlockedRuleIds.includes(focusRuleId)) {
    // Focus on specific rule (when user unlocks a new rule)
    rulesToFocus = [focusRuleId];
  } else {
    // Mix of rules based on performance
    const weakRules = userProgress
      .filter(p => p.progress.isUnlocked && p.progress.totalAttempts > 0)
      .filter(p => (p.progress.correctCount / p.progress.totalAttempts) < 0.9)
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
    .map(rule => `Rule ID: "${rule.id}" | Name: "${rule.name}" | Description: ${rule.description} | Examples: ${rule.examples.join(', ')}`)
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

  const focusedRuleIds = CONJUGATION_RULES
    .filter(rule => rulesToFocus.includes(rule.id))
    .map(rule => rule.id);

  const focusInstructions = focusRuleId 
    ? `SPECIAL FOCUS: This user just unlocked a new rule! Generate ALL ${count} exercises focusing on "${focusRuleId}" to help them practice this new concept immediately.`
    : `Focus more on rules where the user has lower accuracy`;

  const prompt = `${wordSeeds}Generate ${count} Spanish conjugation drill exercises based on these rules:

${rulesContext}

User Performance Stats:
${userStats}

For each drill, create a sentence in Spanish where ONE verb should be conjugated. Replace that verb with [VERB: infinitive, PRONOUN, TENSE] format.

Requirements:
1. The sentence should clearly indicate which tense to use through context
2. Vary the verbs, pronouns, and difficulty
3. ${focusInstructions}
4. Make sentences natural and contextually clear about the required tense
5. Include a mix of easy and challenging examples
6. IMPORTANT: Incorporate the provided random words into your sentences for variety and to avoid repetitive content. Use them as nouns, subjects, or context within the sentences to create diverse scenarios.

IMPORTANT: You MUST use one of these exact Rule IDs (case-sensitive):
${focusedRuleIds.map(id => `"${id}"`).join(', ')}

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
  
  // Define the expected schema for better results
  const schema = `Array of objects with the following structure:
  {
    "sentence": "string - Spanish sentence with [VERB: infinitive, pronoun, tense] placeholder",
    "verb": "string - infinitive form of verb", 
    "pronoun": "string - subject pronoun (yo, tú, él, etc.)",
    "tense": "string - verb tense",
    "correctAnswer": "string - correct conjugated form",
    "ruleId": "string - rule identifier", 
    "difficulty": "number - 1-5 scale"
  }`;

  const response = await llmService.getStructuredResponse({
    prompt,
    schema
  });

  if (response.error) {
    console.error('LLM structured response error:', response.error);
    throw new Error(`Failed to generate drills: ${response.error}`);
  }

  const generatedDrills = response.data;

  // Validate that all rule IDs exist
  const validRuleIds = CONJUGATION_RULES.map(rule => rule.id);
  
  // Save drills to database
  const savedDrills = [];
  for (const drill of generatedDrills) {
    // Validate rule ID before saving
    if (!validRuleIds.includes(drill.ruleId)) {
      console.warn(`Invalid rule ID generated: ${drill.ruleId}. Skipping drill.`);
      continue;
    }

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

  // Ensure we have at least some valid drills
  if (savedDrills.length === 0) {
    throw new Error('No valid drills were generated. Please try again.');
  }

  // Create drill session
  const drillSession = await createDrillSession({
    id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    userId,
    drillIds: savedDrills.map(d => d.id),
    status: 'active'
  });

  return {
    session: drillSession,
    drills: savedDrills
  };
}

export async function recordAnswerAction(userId: string, drillId: string, userAnswer: string, isCorrect: boolean, timeSpent?: number) {
  const result = await recordDrillAttempt({
    userId,
    drillId,
    userAnswer,
    isCorrect,
    timeSpent
  });

  // Return both the attempt and any unlock result
  return {
    attempt: result.attempt,
    unlockResult: result.unlockResult
  };
}

export async function completeSessionAction(userId: string, sessionId: string) {
  return await completeDrillSession(userId, sessionId);
}

export async function unlockRuleAction(userId: string, ruleId: string) {
  return await unlockUserRule(userId, ruleId);
}

export async function getUnlockProgressAction(userId: string, ruleId: string) {
  return await getUnlockProgress(userId, ruleId);
}