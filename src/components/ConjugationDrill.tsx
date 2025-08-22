import { createSignal, createEffect, For, Show } from 'solid-js';
import { TENSE_ICONS } from '~/lib/conjugation-rules';
import type { ConjugationDrill, UserRuleProgress, VerbRule } from '~/server/db/schema';

interface ConjugationDrillProps {
  drills: ConjugationDrill[];
  userProgress: Array<{progress: UserRuleProgress, rule: VerbRule}>;
  onAnswer: (drillId: string, answer: string, isCorrect: boolean, timeSpent: number) => void;
  onComplete: () => void;
  onUnlockRule: (ruleId: string) => void;
}

export default function ConjugationDrill(props: ConjugationDrillProps) {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [userAnswer, setUserAnswer] = createSignal('');
  const [feedback, setFeedback] = createSignal<'correct' | 'incorrect' | null>(null);
  const [startTime, setStartTime] = createSignal(Date.now());
  const [showAnswer, setShowAnswer] = createSignal(false);
  const [score, setScore] = createSignal({ correct: 0, total: 0 });

  const currentDrill = () => props.drills[currentIndex()];
  const isLastDrill = () => currentIndex() >= props.drills.length - 1;

  // Reset when new drills are loaded
  createEffect(() => {
    if (props.drills.length > 0) {
      setCurrentIndex(0);
      setUserAnswer('');
      setFeedback(null);
      setShowAnswer(false);
      setStartTime(Date.now());
      setScore({ correct: 0, total: 0 });
    }
  });

  const submitAnswer = () => {
    const drill = currentDrill();
    if (!drill || !userAnswer().trim()) return;

    const answer = userAnswer().trim().toLowerCase();
    const correct = drill.correctAnswer.toLowerCase();
    const isCorrect = answer === correct;
    const timeSpent = Date.now() - startTime();

    setFeedback(isCorrect ? 'correct' : 'incorrect');
    setShowAnswer(true);
    setScore(prev => ({ 
      correct: prev.correct + (isCorrect ? 1 : 0), 
      total: prev.total + 1 
    }));

    props.onAnswer(drill.id, userAnswer(), isCorrect, timeSpent);

    // Auto-advance after 2 seconds or manual next
    setTimeout(() => {
      nextDrill();
    }, 2000);
  };

  const nextDrill = () => {
    if (isLastDrill()) {
      props.onComplete();
      return;
    }

    setCurrentIndex(prev => prev + 1);
    setUserAnswer('');
    setFeedback(null);
    setShowAnswer(false);
    setStartTime(Date.now());
  };

  const skipDrill = () => {
    const drill = currentDrill();
    if (drill) {
      props.onAnswer(drill.id, '', false, Date.now() - startTime());
      setScore(prev => ({ ...prev, total: prev.total + 1 }));
    }
    nextDrill();
  };

  const formatSentence = (sentence: string) => {
    // Replace [VERB: infinitive, pronoun, tense] with input field
    const parts = sentence.split(/(\[VERB:[^\]]+\])/);
    return parts.map((part, index) => {
      if (part.startsWith('[VERB:')) {
        const match = part.match(/\[VERB:\s*([^,]+),\s*([^,]+),\s*([^\]]+)\]/);
        if (match) {
          const [, verb, pronoun, tense] = match;
          const tenseIcon = TENSE_ICONS[tense as keyof typeof TENSE_ICONS] || '❓';
          
          return (
            <span key={index} class="inline-flex items-center gap-2 mx-1">
              <span class="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                {tenseIcon} {pronoun}
              </span>
              <Show when={!showAnswer()}>
                <input
                  type="text"
                  value={userAnswer()}
                  onInput={(e) => setUserAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && submitAnswer()}
                  class="border-b-2 border-blue-400 bg-transparent text-center min-w-20 focus:outline-none focus:border-blue-600"
                  placeholder="?"
                  disabled={showAnswer()}
                />
              </Show>
              <Show when={showAnswer()}>
                <span class={`font-bold px-2 py-1 rounded ${
                  feedback() === 'correct' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {feedback() === 'correct' ? userAnswer() : currentDrill()?.correctAnswer}
                </span>
              </Show>
              <span class="text-xs text-gray-400">({verb})</span>
            </span>
          );
        }
      }
      return <span key={index}>{part}</span>;
    });
  };

  const getNextUnlockableRule = () => {
    const unlockedRuleIds = props.userProgress
      .filter(p => p.progress.isUnlocked)
      .map(p => p.progress.ruleId);
    
    // Check if user has mastered current rules (>=80% accuracy, >=5 attempts each)
    const masteredRules = props.userProgress
      .filter(p => p.progress.isUnlocked && p.progress.totalAttempts >= 5)
      .filter(p => (p.progress.correctCount / p.progress.totalAttempts) >= 0.8);
    
    // Import rules to find next one
    const allRuleIds = props.userProgress.map(p => p.rule.id).sort((a, b) => {
      const ruleA = props.userProgress.find(p => p.rule.id === a)?.rule;
      const ruleB = props.userProgress.find(p => p.rule.id === b)?.rule;
      return (ruleA?.order || 0) - (ruleB?.order || 0);
    });
    
    return allRuleIds.find(id => !unlockedRuleIds.includes(id));
  };

  return (
    <div class="max-w-4xl mx-auto p-6">
      {/* Progress Header */}
      <div class="mb-8">
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold text-gray-800">Conjugation Drill</h2>
          <div class="text-right">
            <div class="text-sm text-gray-500">
              Question {currentIndex() + 1} of {props.drills.length}
            </div>
            <div class="text-lg font-semibold text-blue-600">
              Score: {score().correct}/{score().total}
            </div>
          </div>
        </div>
        
        {/* Progress bar */}
        <div class="w-full bg-gray-200 rounded-full h-2">
          <div 
            class="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentIndex() + 1) / props.drills.length) * 100}%` }}
          />
        </div>
      </div>

      <Show when={currentDrill()}>
        <div class="bg-white rounded-lg shadow-lg p-8 mb-6">
          {/* Current drill */}
          <div class="text-center mb-8">
            <div class="text-2xl leading-relaxed mb-4">
              {formatSentence(currentDrill()!.sentence)}
            </div>
            
            <Show when={!showAnswer()}>
              <div class="flex justify-center gap-4 mt-6">
                <button
                  onClick={submitAnswer}
                  disabled={!userAnswer().trim()}
                  class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Submit
                </button>
                <button
                  onClick={skipDrill}
                  class="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400"
                >
                  Skip
                </button>
              </div>
            </Show>

            <Show when={showAnswer()}>
              <div class="mt-6">
                <div class={`text-lg font-semibold mb-2 ${
                  feedback() === 'correct' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {feedback() === 'correct' ? '✅ Correct!' : '❌ Incorrect'}
                </div>
                
                <Show when={feedback() === 'incorrect'}>
                  <div class="text-gray-600">
                    Your answer: <span class="font-mono bg-red-50 px-2 py-1 rounded">{userAnswer()}</span>
                  </div>
                  <div class="text-gray-600">
                    Correct answer: <span class="font-mono bg-green-50 px-2 py-1 rounded">{currentDrill()!.correctAnswer}</span>
                  </div>
                </Show>

                <Show when={!isLastDrill()}>
                  <button
                    onClick={nextDrill}
                    class="bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 mt-4"
                  >
                    Next Question
                  </button>
                </Show>

                <Show when={isLastDrill()}>
                  <button
                    onClick={props.onComplete}
                    class="bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 mt-4"
                  >
                    Complete Session
                  </button>
                </Show>
              </div>
            </Show>
          </div>

          {/* Rule info */}
          <Show when={currentDrill()}>
            {() => {
              const rule = props.userProgress.find(p => p.progress.ruleId === currentDrill()!.ruleId)?.rule;
              return (
                <Show when={rule}>
                  <div class="bg-blue-50 p-4 rounded-lg text-sm">
                    <div class="font-semibold text-blue-800">{rule!.name}</div>
                    <div class="text-blue-600 mt-1">{rule!.description}</div>
                  </div>
                </Show>
              );
            }}
          </Show>
        </div>
      </Show>

      {/* Unlock new rule button */}
      <Show when={getNextUnlockableRule()}>
        {(nextRuleId) => {
          const nextRule = props.userProgress.find(p => p.rule.id === nextRuleId())?.rule;
          return (
            <Show when={nextRule}>
              <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                <div class="text-yellow-800 font-semibold mb-2">
                  Ready for a new challenge?
                </div>
                <div class="text-yellow-600 text-sm mb-3">
                  Unlock: {nextRule!.name}
                </div>
                <button
                  onClick={() => props.onUnlockRule(nextRuleId())}
                  class="bg-yellow-500 text-white px-4 py-2 rounded-lg hover:bg-yellow-600"
                >
                  🔓 Unlock New Rule
                </button>
              </div>
            </Show>
          )}
        }
      </Show>

      {/* User progress summary */}
      <div class="mt-8 bg-gray-50 rounded-lg p-6">
        <h3 class="text-lg font-semibold mb-4 text-gray-800">Your Progress</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <For each={props.userProgress.filter(p => p.progress.isUnlocked)}>
            {(item) => {
              const accuracy = item.progress.totalAttempts > 0 
                ? Math.round((item.progress.correctCount / item.progress.totalAttempts) * 100)
                : 0;
              
              return (
                <div class="bg-white p-4 rounded-lg border">
                  <div class="font-medium text-gray-800 text-sm mb-1">
                    {item.rule.name}
                  </div>
                  <div class="text-xs text-gray-500 mb-2">
                    {item.rule.category}
                  </div>
                  <div class="flex justify-between text-sm">
                    <span>Accuracy:</span>
                    <span class={`font-semibold ${
                      accuracy >= 80 ? 'text-green-600' : 
                      accuracy >= 60 ? 'text-yellow-600' : 
                      'text-red-600'
                    }`}>
                      {accuracy}%
                    </span>
                  </div>
                  <div class="flex justify-between text-sm">
                    <span>Attempts:</span>
                    <span>{item.progress.correctCount}/{item.progress.totalAttempts}</span>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}