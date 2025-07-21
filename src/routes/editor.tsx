import { createSignal } from 'solid-js';
import { SimpleTextEditor, type ExternalAnnotation, LLMSuggestionManager, type LoadingState } from '~/modules/text-editor';
import DebugPanel from '~/components/DebugPanel';

export default function Editor() {
  const [content, setContent] = createSignal('');
  const [hoveredAnnotation, setHoveredAnnotation] = createSignal<ExternalAnnotation | null>(null);

  // Sample annotations for demonstration
  const [manualAnnotations, setManualAnnotations] = createSignal<ExternalAnnotation[]>([]);
  const [llmAnnotations, setLlmAnnotations] = createSignal<ExternalAnnotation[]>([]);
  const [loadingState, setLoadingState] = createSignal<LoadingState>({
    grammar: false,
    naturalPhrases: false,
    englishWords: false,
    isAnyLoading: false
  });

  // Combined annotations for the editor
  const annotations = () => [...manualAnnotations(), ...llmAnnotations()];

  // Create LLM suggestion manager
  const llmManager = new LLMSuggestionManager({
    onAnnotationsUpdate: setLlmAnnotations,
    onLoadingStateChange: setLoadingState
  });

  const handleContentChange = (newContent: string) => {
    setContent(newContent);
  };

  const handleAnnotationHover = (annotation: ExternalAnnotation | null) => {
    setHoveredAnnotation(annotation);
  };

  const addRandomAnnotation = () => {
    const currentContent = content();
    if (currentContent.length < 10) return;

    const start = Math.floor(Math.random() * (currentContent.length - 5));
    const end = start + Math.floor(Math.random() * 10) + 3;
    const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6'];
    const types = ['grammar', 'spelling', 'style', 'clarity', 'tone'];

    const newAnnotation: ExternalAnnotation = {
      id: `${types[Math.floor(Math.random() * types.length)]}-${Date.now()}`,
      startParagraph: 0, // Simple demo - all in first paragraph
      startOffset: start,
      endParagraph: 0,
      endOffset: Math.min(end, currentContent.length),
      color: colors[Math.floor(Math.random() * colors.length)],
      description: 'Auto-generated suggestion for demonstration'
    };

    setManualAnnotations([...manualAnnotations(), newAnnotation]);
  };

  const clearAnnotations = () => {
    setManualAnnotations([]);
  };

  const clearLLMSuggestions = () => {
    llmManager.clearSuggestions();
  };

  const handleSuggestionTrigger = async () => {
    await llmManager.getSuggestionsForText(content());
  };

  return (
    <div class="h-screen flex bg-gray-50">
      <DebugPanel />
      {/* Main editor area */}
      <div class="flex-1 flex flex-col">
        {/* Header */}
        <div class="bg-white border-b border-gray-200 px-6 py-4">
          <h1 class="text-2xl font-semibold text-gray-900">Editor</h1>
        </div>

        {/* Editor container */}
        <div class="flex-1 p-6">
          <SimpleTextEditor
            placeholder="Start writing..."
            initialContent="Nuestra empresa es una empresa de software que desarrolla software para la industria de la construcción. Nuestra misión es ayudar a nuestros clientes a mejorar su eficiencia y productivity."
            onContentChange={handleContentChange}
            annotations={annotations()}
            onAnnotationHover={handleAnnotationHover}
            onSuggestionTrigger={handleSuggestionTrigger}
            class="h-full"
          />
        </div>
      </div>

      {/* Right sidebar */}
      <div class="w-80 bg-white border-l border-gray-200 flex flex-col">
        {/* Sidebar header */}
        <div class="border-b border-gray-200 px-4 py-4">
          <h2 class="text-lg font-medium text-gray-900">Side Panel</h2>
        </div>

        {/* Sidebar content */}
        <div class="flex-1 p-4 space-y-4">
          {/* LLM Suggestions */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-700 mb-2">Spanish Suggestions</h3>
            <div class="space-y-2">
              <button
                onClick={handleSuggestionTrigger}
                disabled={content().length < 10 || loadingState().isAnyLoading}
                class="w-full px-3 py-2 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingState().isAnyLoading ? 'Getting Suggestions...' : 'Get Suggestions (Ctrl+Enter)'}
              </button>
              <button
                onClick={clearLLMSuggestions}
                class="w-full px-3 py-2 text-sm bg-orange-600 text-white rounded hover:bg-orange-700"
              >
                Clear Suggestions
              </button>
            </div>
          </div>

          {/* Grammar Suggestions */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <div class="w-3 h-3 rounded bg-red-500"></div>
              Grammar Errors
              {loadingState().grammar && <div class="w-4 h-4 border-2 border-gray-300 border-t-red-500 rounded-full animate-spin"></div>}
            </h3>
            <div class="space-y-2 max-h-32 overflow-y-auto">
              {llmManager.getSuggestionsByType().grammar.map((annotation) => (
                <div class="text-xs p-2 bg-white rounded border border-red-200">
                  <div class="font-medium text-red-700">{annotation.id.split('-')[0]}</div>
                  <div class="text-gray-600 mt-1 whitespace-pre-wrap">{annotation.description}</div>
                </div>
              ))}
              {llmManager.getSuggestionsByType().grammar.length === 0 && !loadingState().grammar && (
                <p class="text-sm text-gray-500">No grammar suggestions</p>
              )}
            </div>
          </div>

          {/* Natural Phrases */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <div class="w-3 h-3 rounded bg-amber-500"></div>
              Natural Phrases
              {loadingState().naturalPhrases && <div class="w-4 h-4 border-2 border-gray-300 border-t-amber-500 rounded-full animate-spin"></div>}
            </h3>
            <div class="space-y-2 max-h-32 overflow-y-auto">
              {llmManager.getSuggestionsByType().naturalPhrases.map((annotation) => (
                <div class="text-xs p-2 bg-white rounded border border-amber-200">
                  <div class="font-medium text-amber-700">{annotation.id.split('-')[0]}</div>
                  <div class="text-gray-600 mt-1 whitespace-pre-wrap">{annotation.description}</div>
                </div>
              ))}
              {llmManager.getSuggestionsByType().naturalPhrases.length === 0 && !loadingState().naturalPhrases && (
                <p class="text-sm text-gray-500">No natural phrase suggestions</p>
              )}
            </div>
          </div>

          {/* English Words */}
          <div class="bg-gray-50 rounded-lg p-4">
            <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <div class="w-3 h-3 rounded bg-blue-500"></div>
              English Words
              {loadingState().englishWords && <div class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>}
            </h3>
            <div class="space-y-2 max-h-32 overflow-y-auto">
              {llmManager.getSuggestionsByType().englishWords.map((annotation) => (
                <div class="text-xs p-2 bg-white rounded border border-blue-200">
                  <div class="font-medium text-blue-700">{annotation.id.split('-')[0]}</div>
                  <div class="text-gray-600 mt-1 whitespace-pre-wrap">{annotation.description}</div>
                </div>
              ))}
              {llmManager.getSuggestionsByType().englishWords.length === 0 && !loadingState().englishWords && (
                <p class="text-sm text-gray-500">No English word suggestions</p>
              )}
            </div>
          </div>

          {/* Hovered annotation details */}
          {hoveredAnnotation() && (
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 class="text-sm font-medium text-blue-700 mb-2">Hovered Annotation</h3>
              <div class="space-y-2 text-sm">
                <div class="flex items-center gap-2">
                  <div
                    class="w-4 h-4 rounded border"
                    style={{ "background-color": hoveredAnnotation()!.color }}
                  />
                  <span class="font-medium">{hoveredAnnotation()!.id}</span>
                </div>
                <div class="text-gray-700">{hoveredAnnotation()!.description}</div>
                <div class="text-gray-600">
                  Position: P{hoveredAnnotation()!.startParagraph}:{hoveredAnnotation()!.startOffset}-{hoveredAnnotation()!.endOffset}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
