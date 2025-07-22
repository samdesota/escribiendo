import { createSignal, onMount, For } from 'solid-js';
import { SimpleTextEditor, type ExternalAnnotation, LLMSuggestionManager, type LoadingState } from '~/modules/text-editor';
import { TranslationChatInterface } from '~/modules/translation-chat';
import DebugPanel from '~/components/DebugPanel';

const STORAGE_KEY = 'editor-content';

export default function Editor() {
  const [content, setContent] = createSignal('');
  const [hoveredAnnotation, setHoveredAnnotation] = createSignal<ExternalAnnotation | null>(null);
  const [initialContent, setInitialContent] = createSignal('');

  // Sample annotations for demonstration
  const [manualAnnotations, setManualAnnotations] = createSignal<ExternalAnnotation[]>([]);
  const [llmAnnotations, setLlmAnnotations] = createSignal<ExternalAnnotation[]>([]);
  const [loadingState, setLoadingState] = createSignal<LoadingState>({
    grammar: false,
    naturalPhrases: false,
    englishWords: false,
    isAnyLoading: false
  });

  // Editor state for undo/redo/clear operations
  const [editorRef, setEditorRef] = createSignal<any>(null);

  // Local storage functions
  const saveToLocalStorage = (content: string) => {
    try {
      localStorage.setItem(STORAGE_KEY, content);
    } catch (error) {
      console.warn('Failed to save content to localStorage:', error);
    }
  };

  const loadFromLocalStorage = (): string => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved || "";
    } catch (error) {
      console.warn('Failed to load content from localStorage:', error);
      return "";
    }
  };

  // Load content from localStorage on mount
  onMount(() => {
    const savedContent = loadFromLocalStorage();
    setInitialContent(savedContent);
    setContent(savedContent);
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
    saveToLocalStorage(newContent);
  };

  const handleAnnotationHover = (annotation: ExternalAnnotation | null) => {
    setHoveredAnnotation(annotation);
  };

  const clearLLMSuggestions = () => {
    llmManager.clearSuggestions();
  };

  const dismissSuggestion = (suggestionId: string) => {
    llmManager.dismissSuggestion(suggestionId);
  };

  const handleSuggestionTrigger = async () => {
    await llmManager.getSuggestionsForText(content());
  };

  return (
    <div class="h-screen flex bg-gray-50">
      {/* Main editor area */}
      <div class="flex-1 flex flex-col">
        {/* Header */}
        <div class="bg-white border-b border-gray-200 px-6 py-4 flex justify-end items-center">
          <div class="flex gap-2">
            <button
              onClick={() => editorRef()?.undo()}
              disabled={!editorRef()?.canUndo()}
              class="px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed rounded border text-sm"
            >
              Undo
            </button>
            <button
              onClick={() => editorRef()?.redo()}
              disabled={!editorRef()?.canRedo()}
              class="px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed rounded border text-sm"
            >
              Redo
            </button>
            <button
              onClick={() => editorRef()?.clear()}
              class="px-3 py-1 bg-red-100 hover:bg-red-200 rounded border text-sm"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Editor and Translation Assistant container */}
        <div class="flex-1 flex flex-col bg-white">
          {/* Main text editor */}
          <div class="flex-1 pt-8 px-8">
            <SimpleTextEditor
              ref={setEditorRef}
              placeholder="Start writing..."
              initialContent={initialContent()}
              onContentChange={handleContentChange}
              annotations={annotations()}
              onAnnotationHover={handleAnnotationHover}
              onSuggestionTrigger={handleSuggestionTrigger}
              hideControls={true}
              hideDebug={true}
              class="h-full"
            />
          </div>

          {/* Translation Assistant */}
          <div class="flex flex-col border-gray-200 p-4 flex-1">
            <TranslationChatInterface
              editorContent={content()}
              class="flex-1"
            />
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div class="w-[576px] bg-white border-l border-gray-200 flex flex-col">
        {/* Sidebar content */}
        <div class="flex-1 p-4 space-y-4">
          {/* LLM Suggestions */}
          <div class="space-y-2">
            <h3 class="text-sm font-medium text-gray-700 mb-2">Spanish Suggestions</h3>
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

          {/* All Suggestions */}
          <div class="flex-1 flex flex-col space-y-2">
            <h3 class="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              All Suggestions
              {loadingState().isAnyLoading && <div class="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>}
            </h3>
            <div class="flex-1 space-y-2 overflow-y-auto">
              <For each={(() => {
                // Get all suggestions and sort by position in text
                const allSuggestions = llmManager.getCurrentSuggestions();
                return allSuggestions.sort((a, b) => {
                  if (a.startParagraph !== b.startParagraph) {
                    return a.startParagraph - b.startParagraph;
                  }
                  return a.startOffset - b.startOffset;
                });
              })()}>
                {(annotation) => {
                  const type = annotation.id.split('-')[0];
                  const colorMap = {
                    grammar: 'border-red-200 text-red-700',
                    'natural-phrases': 'border-amber-200 text-amber-700',
                    'english-words': 'border-blue-200 text-blue-700'
                  };
                  const colorClass = colorMap[type as keyof typeof colorMap] || 'border-gray-200 text-gray-700';

                  return (
                    <div class={`text-xs p-2 bg-white rounded border ${colorClass} flex gap-2`}>
                      <div class="flex-1">
                        <div class="font-medium">{type.replace('-', ' ')}</div>
                        <div class="text-gray-600 mt-1 whitespace-pre-wrap">{annotation.description}</div>
                      </div>
                      <button
                        onClick={() => dismissSuggestion(annotation.id)}
                        class="flex-shrink-0 w-5 h-5 flex items-center justify-center text-green-600 hover:text-green-800 hover:bg-green-50 rounded"
                        title="Dismiss suggestion"
                      >
                        ✓
                      </button>
                    </div>
                  );
                }}
              </For>
              {llmManager.getCurrentSuggestions().length === 0 && !loadingState().isAnyLoading && (
                <p class="text-sm text-gray-500">No suggestions</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
