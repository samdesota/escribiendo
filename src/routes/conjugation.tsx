import { Suspense, createSignal, createResource, Show, onMount } from "solid-js";
import { createAsync, query, RouteDefinition, action, redirect, revalidate } from "@solidjs/router";
import ConjugationDrill from "~/components/ConjugationDrill";
import { getUserProgressWithRules } from "~/server/db/conjugation-queries";
import { generateDrillsAction, recordAnswerAction, completeSessionAction, unlockRuleAction } from "~/lib/conjugation-actions";
import type { ConjugationDrill as DrillType, UserRuleProgress, VerbRule, DrillSession } from "~/server/db/schema";

// Mock user ID for now - replace with actual auth later
const MOCK_USER_ID = "user-123";

// Server queries
const userProgressQuery = query(async () => {
  "use server";
  return await getUserProgressWithRules(MOCK_USER_ID);
}, "user-progress");

export const route = { 
  preload: () => userProgressQuery() 
} satisfies RouteDefinition;

export default function ConjugationPage() {
  const userProgress = createAsync(() => userProgressQuery());
  const [currentSession, setCurrentSession] = createSignal<{
    session: DrillSession;
    drills: DrillType[];
  } | null>(null);
  const [isGenerating, setIsGenerating] = createSignal(false);
  const [sessionCompleted, setSessionCompleted] = createSignal(false);

  // Auto-generate first drills when component mounts
  onMount(async () => {
    const progress = userProgress();
    if (progress && progress.length === 0) {
      // New user, generate first drills
      await generateDrills();
    }
  });

  const generateDrills = async (focusRuleId?: string) => {
    try {
      setIsGenerating(true);
      setSessionCompleted(false);
      
      const data = await generateDrillsAction(MOCK_USER_ID, 5, focusRuleId);
      setCurrentSession(data);
    } catch (error) {
      console.error('Error generating drills:', error);
      alert('Failed to generate drills. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = async (drillId: string, answer: string, isCorrect: boolean, timeSpent: number) => {
    try {
      await recordAnswerAction(MOCK_USER_ID, drillId, answer, isCorrect, timeSpent);
      
      // Refresh user progress
      revalidate(userProgressQuery.key);
    } catch (error) {
      console.error('Error recording answer:', error);
    }
  };

  const handleSessionComplete = async () => {
    try {
      const session = currentSession();
      if (!session) return;

      await completeSessionAction(MOCK_USER_ID, session.session.id);

      setSessionCompleted(true);
      // Don't clear currentSession immediately to show final results
    } catch (error) {
      console.error('Error completing session:', error);
    }
  };

  const handleUnlockRule = async (ruleId: string) => {
    try {
      await unlockRuleAction(MOCK_USER_ID, ruleId);

      // Refresh user progress
      revalidate(userProgressQuery.key);
      
      // Generate new drills focusing on the newly unlocked rule
      await generateDrills(ruleId);
    } catch (error) {
      console.error('Error unlocking rule:', error);
      alert('Failed to unlock rule. Please try again.');
    }
  };

  const startNewSession = () => {
    setCurrentSession(null);
    setSessionCompleted(false);
    generateDrills();
  };

  return (
    <div class="min-h-screen bg-gray-50">
      <Suspense fallback={
        <div class="flex justify-center items-center h-64">
          <div class="text-lg text-gray-600">Loading...</div>
        </div>
      }>
        <div class="container mx-auto py-8">
          {/* Header */}
          <div class="text-center mb-8">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">
              Spanish Conjugation Drills
            </h1>
            <p class="text-gray-600">
              Master Spanish verb conjugations step by step
            </p>
          </div>

          <Show when={!currentSession() && !isGenerating()}>
            <div class="max-w-2xl mx-auto text-center bg-white rounded-lg shadow p-8">
              <h2 class="text-2xl font-semibold mb-4">Ready to Practice?</h2>
              <p class="text-gray-600 mb-6">
                We'll generate personalized conjugation exercises based on your progress and focus on areas where you need practice.
              </p>
              <button
                onClick={() => generateDrills()}
                class="bg-blue-500 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-600 transition-colors"
              >
                Start Practice Session
              </button>
              
              <Show when={userProgress() && userProgress()!.length > 0}>
                <div class="mt-8 pt-6 border-t">
                  <h3 class="text-lg font-semibold mb-4">Your Progress Summary</h3>
                  <div class="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {userProgress()!.filter(p => p.progress.isUnlocked && p.rule).map((item) => {
                      const accuracy = item.progress.totalAttempts > 0 
                        ? Math.round((item.progress.correctCount / item.progress.totalAttempts) * 100)
                        : 0;
                      
                      return (
                        <div class="bg-blue-50 p-3 rounded text-center">
                          <div class="font-medium text-blue-800 text-xs mb-1">
                            {item.rule!.name}
                          </div>
                          <div class={`text-lg font-bold ${
                            accuracy >= 80 ? 'text-green-600' : 
                            accuracy >= 60 ? 'text-yellow-600' : 
                            'text-red-600'
                          }`}>
                            {accuracy}%
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Show>
            </div>
          </Show>

          <Show when={isGenerating()}>
            <div class="max-w-2xl mx-auto text-center bg-white rounded-lg shadow p-8">
              <div class="animate-spin mx-auto mb-4 w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
              <h2 class="text-xl font-semibold mb-2">Generating Your Drills...</h2>
              <p class="text-gray-600">
                Creating personalized exercises based on your progress
              </p>
            </div>
          </Show>

          <Show when={currentSession() && userProgress()}>
            <Show when={!sessionCompleted()}>
              <ConjugationDrill
                drills={currentSession()!.drills}
                userProgress={userProgress()!}
                onAnswer={handleAnswer}
                onComplete={handleSessionComplete}
                onUnlockRule={handleUnlockRule}
              />
            </Show>

            <Show when={sessionCompleted()}>
              <div class="max-w-2xl mx-auto text-center bg-white rounded-lg shadow p-8">
                <div class="text-6xl mb-4">🎉</div>
                <h2 class="text-2xl font-semibold mb-4">Session Complete!</h2>
                <p class="text-gray-600 mb-6">
                  Great job! You've completed this practice session.
                </p>
                
                <div class="space-y-4">
                  <button
                    onClick={startNewSession}
                    class="bg-blue-500 text-white px-8 py-3 rounded-lg text-lg hover:bg-blue-600 transition-colors mr-4"
                  >
                    Start New Session
                  </button>
                  
                  <div class="mt-6">
                    <a 
                      href="/chat" 
                      class="text-blue-500 hover:text-blue-600 underline"
                    >
                      Return to Chat Practice
                    </a>
                  </div>
                </div>
              </div>
            </Show>
          </Show>
        </div>
      </Suspense>
    </div>
  );
}