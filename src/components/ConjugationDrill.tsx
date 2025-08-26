import {
  createSignal,
  createEffect,
  For,
  Show,
  Index,
  createResource,
  onMount,
  onCleanup,
} from 'solid-js';
import { TENSE_ICONS } from '~/lib/conjugation-rules';
import { getUnlockProgressAction } from '~/lib/conjugation-actions';
import type {
  ConjugationDrill,
  UserRuleProgress,
  VerbRule,
} from '~/server/db/schema';
import SelectableText from './SelectableText';
import SideChat from './SideChat';
import type { ClientLLMService } from '~/services/llm';
import type { SideChatState } from './types';

interface ConjugationDrillProps {
  drills: ConjugationDrill[];
  userProgress: Array<{ progress: UserRuleProgress; rule: VerbRule }>;
  onAnswer: (
    drillId: string,
    answer: string,
    isCorrect: boolean,
    timeSpent: number
  ) => void;
  onComplete: () => void;
  onUnlockRule: (ruleId: string) => void;
  onQuit: () => void;
  onRequestMoreDrills: () => void;
  isGeneratingMore?: boolean;
  translationService?: ClientLLMService;
}

export default function ConjugationDrill(props: ConjugationDrillProps) {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  const [userAnswer, setUserAnswer] = createSignal('');
  const [feedback, setFeedback] = createSignal<'correct' | 'incorrect' | null>(
    null
  );
  const [startTime, setStartTime] = createSignal(Date.now());
  const [showAnswer, setShowAnswer] = createSignal(false);
  const [showDontKnowAnswer, setShowDontKnowAnswer] = createSignal(false);
  const [score, setScore] = createSignal({ correct: 0, total: 0 });
  const [initialDrillsLength, setInitialDrillsLength] = createSignal(0);
  let inputRef: HTMLInputElement | undefined;

  // Side chat state
  const [sideChatState, setSideChatState] = createSignal<SideChatState>({
    isOpen: false,
    context: '',
    suggestion: '',
    messages: [],
  });

  const currentDrill = () => props.drills[currentIndex()];
  const isLastDrill = () => currentIndex() >= props.drills.length - 1;
  const remainingDrills = () => props.drills.length - currentIndex() - 1;

  // Track unlock progress for current drill's rule
  const [unlockProgress] = createResource(
    () => {
      const drill = currentDrill();
      return drill ? drill.ruleId : null;
    },
    async ruleId => {
      if (!ruleId) return null;
      // Mock user ID - should match the one from the parent component
      return await getUnlockProgressAction('user-123', ruleId);
    }
  );

  // Only reset on initial load, not when more drills are added
  createEffect(() => {
    if (props.drills.length > 0) {
      // If this is the first time we have drills, or if the length decreased (new session)
      if (
        initialDrillsLength() === 0 ||
        props.drills.length < initialDrillsLength()
      ) {
        setCurrentIndex(0);
        setUserAnswer('');
        setFeedback(null);
        setShowAnswer(false);
        setShowDontKnowAnswer(false);
        setStartTime(Date.now());
        setScore({ correct: 0, total: 0 });
      }
      setInitialDrillsLength(props.drills.length);
    }
  });

  // Auto-focus input when a new drill is ready
  createEffect(() => {
    // Focus the input when:
    // 1. There's a current drill available
    // 2. We're not showing the answer and not showing "I don't know" answer (so the input is visible)
    // 3. The input ref exists
    if (currentDrill() && !showAnswer() && !showDontKnowAnswer() && inputRef) {
      // Use setTimeout to ensure the DOM has updated
      setTimeout(() => {
        inputRef?.focus();
      }, 0);
    }
  });

  // Handle keyboard shortcuts
  const handleKeyDown = (e: KeyboardEvent) => {
    // Shift+Enter to open side chat
    if (e.shiftKey && e.key === 'Enter') {
      e.preventDefault();
      openSideChat();
    }
  };

  // Focus input on initial mount and add keyboard listener
  onMount(() => {
    if (currentDrill() && !showAnswer() && !showDontKnowAnswer() && inputRef) {
      setTimeout(() => {
        inputRef?.focus();
      }, 100); // Slightly longer delay for initial mount
    }

    // Add keyboard event listener
    document.addEventListener('keydown', handleKeyDown);
  });

  // Cleanup keyboard listener
  onCleanup(() => {
    document.removeEventListener('keydown', handleKeyDown);
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
      total: prev.total + 1,
    }));

    props.onAnswer(drill.id, userAnswer(), isCorrect, timeSpent);

    // Auto-advance after 2 seconds or manual next
    setTimeout(() => {
      nextDrill();
    }, 2000);
  };

  const handleAnswerInput = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const newAnswer = target.value;
    setUserAnswer(newAnswer);

    // Check if the answer is correct and auto-submit
    const drill = currentDrill();
    if (drill && newAnswer.trim()) {
      const answer = newAnswer.trim().toLowerCase();
      const correct = drill.correctAnswer.toLowerCase();

      if (answer === correct && !showAnswer() && !showDontKnowAnswer()) {
        // Auto-submit when answer is correct
        submitAnswer();
      }
    }
  };

  const nextDrill = () => {
    // Check if we need to request more drills before running out
    if (remainingDrills() <= 2 && !props.isGeneratingMore) {
      props.onRequestMoreDrills();
    }

    if (isLastDrill()) {
      // Don't complete automatically - let user continue or quit
      return;
    }

    setCurrentIndex(prev => prev + 1);
    setUserAnswer('');
    setFeedback(null);
    setShowAnswer(false);
    setShowDontKnowAnswer(false);
    setStartTime(Date.now());
  };

  const handleDontKnow = () => {
    const drill = currentDrill();
    if (drill) {
      // Record as incorrect attempt
      props.onAnswer(drill.id, '', false, Date.now() - startTime());
      setScore(prev => ({ ...prev, total: prev.total + 1 }));
      setFeedback('incorrect');
      setShowDontKnowAnswer(true);
    }
  };

  const continueFromDontKnow = () => {
    nextDrill();
  };

  // Open side chat for conjugation help
  const openSideChat = () => {
    const drill = currentDrill();
    if (!drill || !props.translationService) return;

    const context = `Conjugation drill for verb "${drill.verb}" in ${drill.tense} tense with pronoun "${drill.pronoun}"`;
    const suggestion = `I need help with conjugating "${drill.verb}" in the ${drill.tense} tense for "${drill.pronoun}". The sentence is: "${drill.sentence}"`;

    setSideChatState({
      isOpen: true,
      context,
      suggestion,
      messages: [],
    });
  };

  // Close side chat
  const closeSideChat = () => {
    setSideChatState(prev => ({ ...prev, isOpen: false }));
  };

  // Handle side chat message
  const handleSideChatMessage = (message: any) => {
    setSideChatState(prev => ({
      ...prev,
      messages: [...prev.messages, message],
    }));
  };

  const formatSentence = (sentence: string) => {
    // Replace [VERB: infinitive, pronoun, tense] with input field
    const parts = sentence.split(/(\[VERB:[^\]]+\])/);
    return (
      <Index each={parts}>
        {(part, index) => {
          if (part().startsWith('[VERB:')) {
            const match = part().match(
              /\[VERB:\s*([^,]+),\s*([^,]+),\s*([^\]]+)\]/
            );
            if (match) {
              const [, verb, pronoun, tense] = match;
              const tenseIcon =
                TENSE_ICONS[tense as keyof typeof TENSE_ICONS] || '❓';

              return (
                <span class='inline-flex items-center gap-2 mx-1'>
                  <span class='text-base text-gray-700 bg-gray-200 px-3 py-1 rounded font-medium'>
                    {tenseIcon} {pronoun}
                  </span>
                  <Show when={!showAnswer() && !showDontKnowAnswer()}>
                    <input
                      ref={inputRef}
                      type='text'
                      value={userAnswer()}
                      onInput={handleAnswerInput}
                      onKeyPress={e => e.key === 'Enter' && submitAnswer()}
                      class='border-b-2 border-blue-400 bg-transparent text-center min-w-16 w-16 focus:outline-none focus:border-blue-600'
                      placeholder='?'
                      disabled={showAnswer() || showDontKnowAnswer()}
                      style={{
                        width: `${Math.max(4, userAnswer().length + 2)}ch`,
                      }}
                    />
                  </Show>
                  <Show when={showAnswer()}>
                    <span
                      class={`font-bold px-2 py-1 rounded ${
                        feedback() === 'correct'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {feedback() === 'correct'
                        ? userAnswer()
                        : currentDrill()?.correctAnswer}
                    </span>
                  </Show>
                  <Show when={showDontKnowAnswer()}>
                    <span class='font-bold px-2 py-1 rounded bg-blue-100 text-blue-800'>
                      {currentDrill()?.correctAnswer}
                    </span>
                  </Show>
                  <span class='text-md text-gray-600 font-medium'>
                    ({verb})
                  </span>
                </span>
              );
            }
          }
          return <span>{part()}</span>;
        }}
      </Index>
    );
  };

  const getNextUnlockableRule = () => {
    const unlockedRuleIds = props.userProgress
      .filter(p => p.progress.isUnlocked)
      .map(p => p.progress.ruleId);

    // Find next rule in order that's not unlocked
    const allRules = props.userProgress
      .map(p => p.rule)
      .sort((a, b) => a.order - b.order);
    return allRules.find(rule => !unlockedRuleIds.includes(rule.id));
  };

  const buildConjugationContext = () => {
    const drill = currentDrill();
    if (!drill) return '';

    const rule = props.userProgress.find(
      p => p.progress.ruleId === drill.ruleId
    )?.rule;

    return `This is a Spanish conjugation exercise. Context:
- Exercise type: Conjugation drill
- Verb to conjugate: ${drill.verb} (infinitive)
- Required tense: ${drill.tense}
- Required pronoun: ${drill.pronoun}
- Correct conjugation: ${drill.correctAnswer}
- Grammar rule: ${rule?.name || 'Unknown rule'} - ${rule?.description || 'No description'}
- Rule category: ${rule?.category || 'Unknown category'}

This sentence is testing the student's ability to conjugate the verb "${drill.verb}" in the ${drill.tense} tense with the pronoun "${drill.pronoun}". The correct answer is "${drill.correctAnswer}".`;
  };

  return (
    <div class='max-w-4xl mx-auto p-6'>
      {/* Progress Header */}
      <div class='mb-8'>
        <div class='flex justify-between items-center mb-4'>
          <h2 class='text-2xl font-bold text-gray-800'>Conjugation Drill</h2>
          <div class='flex items-center gap-4'>
            <div class='text-right'>
              <div class='text-sm text-gray-500'>
                <div class='flex items-center gap-2 justify-end'>
                  <span>Drill #{currentIndex() + 1}</span>
                  <Show when={props.isGeneratingMore}>
                    <span class='text-blue-500 text-xs bg-blue-50 px-2 py-1 rounded-full animate-pulse'>
                      🔄 Generating more...
                    </span>
                  </Show>
                </div>
                <div class='text-xs text-gray-400 mt-1'>
                  {props.drills.length} drills available
                </div>
              </div>
            </div>
            <Show when={props.translationService}>
              <button
                onClick={openSideChat}
                class='bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 text-sm mr-2'
                title='Get help with this conjugation (Shift+Enter)'
              >
                Help
              </button>
            </Show>
            <button
              onClick={props.onQuit}
              class='bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 text-sm'
            >
              Quit
            </button>
          </div>
        </div>
      </div>

      <Show when={currentDrill()}>
        <div class='bg-white rounded-lg shadow-lg p-8 mb-6'>
          {/* Current drill */}
          <div class='text-center mb-8'>
            <Show
              when={props.translationService}
              fallback={
                <div class='text-2xl leading-relaxed mb-4'>
                  {formatSentence(currentDrill()!.sentence)}
                </div>
              }
            >
              <SelectableText
                translationService={props.translationService!}
                additionalContext={buildConjugationContext()}
                className='text-2xl leading-relaxed mb-4'
                enableDiscussion={false}
              >
                {formatSentence(currentDrill()!.sentence)}
              </SelectableText>
            </Show>

            <Show when={!showAnswer() && !showDontKnowAnswer()}>
              <div class='flex justify-center gap-4 mt-6'>
                <button
                  onClick={submitAnswer}
                  disabled={!userAnswer().trim()}
                  class='bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  Submit
                </button>
                <button
                  onClick={handleDontKnow}
                  class='bg-gray-300 text-gray-700 px-6 py-2 rounded-lg hover:bg-gray-400'
                >
                  I don't know
                </button>
              </div>
            </Show>

            <Show when={showDontKnowAnswer()}>
              <div class='mt-6'>
                <div class='text-lg font-semibold mb-2 text-blue-600'>
                  The correct answer is:{' '}
                  <span class='font-mono bg-blue-50 px-2 py-1 rounded'>
                    {currentDrill()!.correctAnswer}
                  </span>
                </div>

                <Show when={!isLastDrill()}>
                  <button
                    onClick={continueFromDontKnow}
                    class='bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 mt-4'
                  >
                    Continue
                  </button>
                </Show>

                <Show when={isLastDrill()}>
                  <div class='mt-4 space-y-2'>
                    <Show when={props.isGeneratingMore}>
                      <div class='text-blue-600 text-sm'>
                        🔄 Generating more drills...
                      </div>
                    </Show>
                    <Show when={!props.isGeneratingMore}>
                      <div class='text-gray-600 text-sm mb-2'>
                        No more drills available. Click "Quit" to end the
                        session.
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>

            <Show when={showAnswer()}>
              <div class='mt-6'>
                <div
                  class={`text-lg font-semibold mb-2 ${
                    feedback() === 'correct' ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {feedback() === 'correct' ? '✅ Correct!' : '❌ Incorrect'}
                </div>

                <Show when={feedback() === 'incorrect'}>
                  <div class='text-gray-600'>
                    Your answer:{' '}
                    <span class='font-mono bg-red-50 px-2 py-1 rounded'>
                      {userAnswer()}
                    </span>
                  </div>
                  <div class='text-gray-600'>
                    Correct answer:{' '}
                    <span class='font-mono bg-green-50 px-2 py-1 rounded'>
                      {currentDrill()!.correctAnswer}
                    </span>
                  </div>
                </Show>

                <Show when={!isLastDrill()}>
                  <button
                    onClick={nextDrill}
                    class='bg-blue-500 text-white px-6 py-2 rounded-lg hover:bg-blue-600 mt-4'
                  >
                    Next Question
                  </button>
                </Show>

                <Show when={isLastDrill()}>
                  <div class='mt-4 space-y-2'>
                    <Show when={props.isGeneratingMore}>
                      <div class='text-blue-600 text-sm'>
                        🔄 Generating more drills...
                      </div>
                    </Show>
                    <Show when={!props.isGeneratingMore}>
                      <div class='text-gray-600 text-sm mb-2'>
                        No more drills available. Click "Quit" to end the
                        session.
                      </div>
                    </Show>
                  </div>
                </Show>
              </div>
            </Show>
          </div>

          {/* Rule info */}
          <Show when={currentDrill()}>
            {drill => {
              const rule = () =>
                props.userProgress.find(
                  p => p.progress.ruleId === drill().ruleId
                )?.rule;
              return (
                <Show when={rule()}>
                  <div class='bg-blue-50 p-4 rounded-lg text-sm'>
                    <Show
                      when={props.translationService}
                      fallback={
                        <>
                          <div class='font-semibold text-blue-800'>
                            {rule()!.name}
                          </div>
                          <div class='text-blue-600 mt-1'>
                            {rule()!.description}
                          </div>
                        </>
                      }
                    >
                      <SelectableText
                        translationService={props.translationService!}
                        additionalContext={buildConjugationContext()}
                        enableDiscussion={false}
                      >
                        <div class='font-semibold text-blue-800'>
                          {rule()!.name}
                        </div>
                        <div class='text-blue-600 mt-1'>
                          {rule()!.description}
                        </div>
                      </SelectableText>
                    </Show>
                  </div>
                </Show>
              );
            }}
          </Show>
        </div>
      </Show>

      {/* Next rule unlock progress */}
      <Show
        when={
          getNextUnlockableRule() && unlockProgress() && getNextUnlockableRule()
        }
      >
        {nextRule => {
          const progress = unlockProgress()!;
          const progressPercent =
            progress.totalAttempts > 0
              ? Math.round(progress.accuracy * 100)
              : 0;
          const isCloseToUnlock =
            progress.totalAttempts >= 15 && progressPercent >= 85;

          return (
            <div
              class={`border rounded-lg p-4 text-center mb-4 ${
                isCloseToUnlock
                  ? 'bg-yellow-50 border-yellow-200'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div
                class={`font-semibold mb-2 ${
                  isCloseToUnlock ? 'text-yellow-800' : 'text-blue-800'
                }`}
              >
                Next Rule: {nextRule.name}
              </div>

              <div class='text-sm mb-3'>
                <div
                  class={`${isCloseToUnlock ? 'text-yellow-600' : 'text-blue-600'}`}
                >
                  Progress to unlock (need 90% accuracy on last 20 exercises):
                </div>

                <div class='mt-2 space-y-2'>
                  <div class='flex justify-between text-xs'>
                    <span>Exercises completed:</span>
                    <span>{progress.totalAttempts}/20</span>
                  </div>

                  <div class='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      class='bg-blue-500 h-2 rounded-full transition-all duration-300'
                      style={{
                        width: `${Math.min((progress.totalAttempts / 20) * 100, 100)}%`,
                      }}
                    />
                  </div>

                  <Show when={progress.totalAttempts > 0}>
                    <div class='flex justify-between text-xs'>
                      <span>Current accuracy:</span>
                      <span
                        class={`font-semibold ${
                          progressPercent >= 90
                            ? 'text-green-600'
                            : progressPercent >= 80
                              ? 'text-yellow-600'
                              : 'text-red-600'
                        }`}
                      >
                        {progressPercent}% ({progress.correctCount}/
                        {progress.totalAttempts})
                      </span>
                    </div>
                  </Show>

                  <Show
                    when={progress.totalAttempts >= 20 && progressPercent >= 90}
                  >
                    <div class='text-green-600 font-semibold text-sm'>
                      🎉 Ready to unlock! Complete a few more exercises.
                    </div>
                  </Show>

                  <Show
                    when={progress.totalAttempts >= 20 && progressPercent < 90}
                  >
                    <div class='text-orange-600 text-sm'>
                      Need {Math.ceil(0.9 * 20 - progress.correctCount)} more
                      correct answers in next exercises
                    </div>
                  </Show>

                  <Show when={progress.totalAttempts < 20}>
                    <div class='text-gray-600 text-sm'>
                      Complete {20 - progress.totalAttempts} more exercises to
                      unlock next rule
                    </div>
                  </Show>
                </div>
              </div>
            </div>
          );
        }}
      </Show>

      {/* User progress summary */}
      <div class='mt-8 bg-gray-50 rounded-lg p-6'>
        <h3 class='text-lg font-semibold mb-4 text-gray-800'>Your Progress</h3>
        <div class='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
          <For each={props.userProgress.filter(p => p.progress.isUnlocked)}>
            {item => {
              // Create a resource for each rule's last 20 attempts accuracy
              const [recentProgress] = createResource(
                () => item.progress.ruleId,
                async ruleId => {
                  try {
                    return await getUnlockProgressAction('user-123', ruleId);
                  } catch (error) {
                    console.error('Error fetching recent progress:', error);
                    return null;
                  }
                }
              );

              return (
                <div class='bg-white p-4 rounded-lg border'>
                  <div class='font-medium text-gray-800 text-sm mb-1'>
                    {item.rule.name}
                  </div>
                  <div class='text-xs text-gray-500 mb-2'>
                    {item.rule.category}
                  </div>

                  <Show
                    when={recentProgress()}
                    fallback={
                      <div class='text-xs text-gray-400'>Loading...</div>
                    }
                  >
                    {progress => {
                      const progressData = progress();
                      const recentAccuracy =
                        progressData.totalAttempts > 0
                          ? Math.round(progressData.accuracy * 100)
                          : 0;
                      const totalAccuracy =
                        item.progress.totalAttempts > 0
                          ? Math.round(
                              (item.progress.correctCount /
                                item.progress.totalAttempts) *
                                100
                            )
                          : 0;

                      return (
                        <>
                          <div class='flex justify-between text-sm'>
                            <span>Last 20 accuracy:</span>
                            <span
                              class={`font-semibold ${
                                recentAccuracy >= 90
                                  ? 'text-green-600'
                                  : recentAccuracy >= 80
                                    ? 'text-yellow-600'
                                    : 'text-red-600'
                              }`}
                            >
                              {recentAccuracy}% ({progressData.correctCount}/
                              {progressData.totalAttempts})
                            </span>
                          </div>
                          <div class='flex justify-between text-xs text-gray-500 mt-1'>
                            <span>Overall accuracy:</span>
                            <span>
                              {totalAccuracy}% ({item.progress.correctCount}/
                              {item.progress.totalAttempts})
                            </span>
                          </div>
                        </>
                      );
                    }}
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </div>

      {/* Side Chat Panel */}
      <Show when={props.translationService}>
        <SideChat
          isOpen={sideChatState().isOpen}
          context={sideChatState().context}
          suggestion={sideChatState().suggestion}
          messages={sideChatState().messages}
          chatSuggestionService={props.translationService!}
          onClose={closeSideChat}
          onSendMessage={handleSideChatMessage}
        />
      </Show>
    </div>
  );
}
