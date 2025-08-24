import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { baseKeymap } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { ClientLLMService } from '~/services/llm';
import SideChat from './SideChat';
import { type SideChatState, type CorrectionSuggestion } from './types';
import { diffWords } from 'diff';

export interface JournalEditorProps {
  entryId: string;
  llmService: ClientLLMService;
  onTitleChange?: (title: string) => void;
}

export default function JournalEditor(props: JournalEditorProps) {
  let editorRef: HTMLDivElement | undefined;
  let titleRef: HTMLInputElement | undefined;
  let editorView: EditorView | undefined;

  const [isLoading, setIsLoading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [title, setTitle] = createSignal('Untitled');
  const [wordCount, setWordCount] = createSignal(0);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);
  
  // Correction suggestions state
  const [corrections, setCorrections] = createSignal<CorrectionSuggestion[]>([]);
  const [isGettingCorrections, setIsGettingCorrections] = createSignal(false);
  
  // Side chat state
  const [sideChatState, setSideChatState] = createSignal<SideChatState>({
    isOpen: false,
    context: '',
    suggestion: '',
    messages: []
  });

  // Text selection and translation state
  const [selectionState, setSelectionState] = createSignal({
    isActive: false,
    selectedText: '',
    translation: '',
    isLoading: false,
    position: { x: 0, y: 0 }
  });

  // Create enhanced schema with list support
  const schema = new Schema({
    nodes: addListNodes(basicSchema.spec.nodes, "paragraph block*", "block"),
    marks: basicSchema.spec.marks.append({
      correction_delete: {
        attrs: { correctionId: { default: null } },
        parseDOM: [{ tag: "span.correction-delete" }],
        toDOM: (mark) => ["span", { 
          class: "correction-delete bg-red-100 text-red-800 line-through",
          "data-correction-id": mark.attrs.correctionId 
        }]
      },
      correction_insert: {
        attrs: { correctionId: { default: null } },
        parseDOM: [{ tag: "span.correction-insert" }],
        toDOM: (mark) => ["span", { 
          class: "correction-insert bg-green-100 text-green-800",
          "data-correction-id": mark.attrs.correctionId 
        }]
      }
    })
  });

  // Load journal entry data
  const loadJournalEntry = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/journal/${props.entryId}`);
      if (response.ok) {
        const entry = await response.json();
        setTitle(entry.title);
        setWordCount(entry.wordCount);
        setLastSaved(new Date(entry.updatedAt));
        
        // Load content into editor
        if (editorView && entry.content) {
          const doc = schema.nodeFromJSON(entry.content);
          const state = EditorState.create({
            doc,
            plugins: createEditorPlugins()
          });
          editorView.updateState(state);
        }
      }
    } catch (error) {
      console.error('Error loading journal entry:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save journal entry
  const saveJournalEntry = async (content: any, newTitle?: string) => {
    setIsSaving(true);
    try {
      const entryData = {
        id: props.entryId,
        userId: 'user-123', // Replace with actual user ID
        title: newTitle || title(),
        content
      };

      let response;
      // Check if entry exists first
      const existingResponse = await fetch(`/api/journal/${props.entryId}`);
      
      if (existingResponse.ok) {
        // Update existing entry
        response = await fetch(`/api/journal/${props.entryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData)
        });
      } else {
        // Create new entry
        response = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData)
        });
      }

      if (response.ok) {
        const updatedEntry = await response.json();
        setWordCount(updatedEntry.wordCount);
        setLastSaved(new Date(updatedEntry.updatedAt));
      }
    } catch (error) {
      console.error('Error saving journal entry:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save functionality
  let saveTimeout: ReturnType<typeof setTimeout> | undefined;
  const scheduleAutoSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (editorView) {
        const content = editorView.state.doc.toJSON();
        saveJournalEntry(content);
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
  };

  // Handle title changes
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    props.onTitleChange?.(newTitle);
    
    // Auto-save title
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      if (editorView) {
        const content = editorView.state.doc.toJSON();
        saveJournalEntry(content, newTitle);
      }
    }, 1000);
  };

  // Get text corrections from LLM
  const getTextCorrections = async () => {
    if (!editorView || isGettingCorrections()) return;
    
    setIsGettingCorrections(true);
    
    try {
      // Extract plain text from current document
      const currentText = extractPlainTextFromDoc(editorView.state.doc);
      
      if (!currentText.trim()) {
        setIsGettingCorrections(false);
        return;
      }

      // Request correction from LLM
      const response = await fetch('/api/journal/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: currentText,
          context: `Journal entry titled "${title()}"`,
          language: 'spanish'
        })
      });

      if (response.ok) {
        const { correctedText } = await response.json();
        
        if (correctedText && correctedText !== currentText) {
          // Generate diff and create correction suggestions
          const suggestions = generateCorrectionSuggestions(currentText, correctedText);
          setCorrections(suggestions);
          applyCorrectionMarks(suggestions);
        }
      }
    } catch (error) {
      console.error('Error getting text corrections:', error);
    } finally {
      setIsGettingCorrections(false);
    }
  };

  // Generate correction suggestions using diff
  const generateCorrectionSuggestions = (original: string, corrected: string): CorrectionSuggestion[] => {
    const diff = diffWords(original, corrected);
    const suggestions: CorrectionSuggestion[] = [];
    let position = 0;

    diff.forEach((part, index) => {
      if (part.removed || part.added) {
        const id = `correction-${Date.now()}-${index}`;
        suggestions.push({
          id,
          originalText: part.removed ? part.value : '',
          correctedText: part.added ? part.value : '',
          startPos: position,
          endPos: position + (part.removed ? part.value.length : 0),
          status: 'pending'
        });
      }
      
      if (!part.added) {
        position += part.value.length;
      }
    });

    return suggestions;
  };

  // Apply correction marks to editor
  const applyCorrectionMarks = (suggestions: CorrectionSuggestion[]) => {
    if (!editorView) return;

    let tr = editorView.state.tr;
    
    suggestions.forEach(suggestion => {
      if (suggestion.originalText) {
        // Mark text for deletion
        tr = tr.addMark(
          suggestion.startPos,
          suggestion.endPos,
          schema.marks.correction_delete.create({ correctionId: suggestion.id })
        );
      }
      
      if (suggestion.correctedText && suggestion.originalText) {
        // Insert corrected text after original
        tr = tr.insert(
          suggestion.endPos,
          schema.text(suggestion.correctedText, [
            schema.marks.correction_insert.create({ correctionId: suggestion.id })
          ])
        );
      }
    });

    editorView.dispatch(tr);
  };

  // Accept correction
  const acceptCorrection = (correctionId: string) => {
    const correction = corrections().find(c => c.id === correctionId);
    if (!correction || !editorView) return;

    let tr = editorView.state.tr;
    
    // Remove deletion marks
    tr = tr.removeMark(
      correction.startPos,
      correction.endPos,
      schema.marks.correction_delete
    );
    
    // Remove insertion marks but keep the text
    const doc = editorView.state.doc;
    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.type.name === 'correction_insert' && mark.attrs.correctionId === correctionId) {
            tr = tr.removeMark(pos, pos + node.nodeSize, mark);
          }
        });
      }
    });
    
    // Remove original text if it was marked for deletion
    if (correction.originalText) {
      tr = tr.delete(correction.startPos, correction.endPos);
    }

    editorView.dispatch(tr);
    
    // Update corrections state
    setCorrections(prev => prev.filter(c => c.id !== correctionId));
    scheduleAutoSave();
  };

  // Reject correction
  const rejectCorrection = (correctionId: string) => {
    const correction = corrections().find(c => c.id === correctionId);
    if (!correction || !editorView) return;

    let tr = editorView.state.tr;
    
    // Remove all marks for this correction
    const doc = editorView.state.doc;
    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach(mark => {
          if ((mark.type.name === 'correction_delete' || mark.type.name === 'correction_insert') && 
              mark.attrs.correctionId === correctionId) {
            tr = tr.removeMark(pos, pos + node.nodeSize, mark);
          }
        });
      }
    });
    
    // Remove inserted text
    if (correction.correctedText) {
      // Find and remove the inserted text
      doc.descendants((node, pos) => {
        if (node.marks?.some(mark => 
          mark.type.name === 'correction_insert' && mark.attrs.correctionId === correctionId
        )) {
          tr = tr.delete(pos, pos + node.nodeSize);
        }
      });
    }

    editorView.dispatch(tr);
    
    // Update corrections state
    setCorrections(prev => prev.filter(c => c.id !== correctionId));
  };

  // Clear all corrections
  const clearAllCorrections = () => {
    if (!editorView) return;

    let tr = editorView.state.tr;
    
    // Remove all correction marks and inserted text
    const doc = editorView.state.doc;
    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.type.name === 'correction_delete' || mark.type.name === 'correction_insert') {
            tr = tr.removeMark(pos, pos + node.nodeSize, mark);
            
            // Remove inserted text
            if (mark.type.name === 'correction_insert') {
              tr = tr.delete(pos, pos + node.nodeSize);
            }
          }
        });
      }
    });

    editorView.dispatch(tr);
    setCorrections([]);
  };

  // Open side chat for grammar help
  const openSideChat = () => {
    if (!editorView) return;

    const currentText = extractPlainTextFromDoc(editorView.state.doc);
    const context = `Journal entry: "${title()}"`;
    
    setSideChatState({
      isOpen: true,
      context,
      suggestion: currentText.slice(-100), // Last 100 chars as context
      messages: []
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
      messages: [...prev.messages, message]
    }));
  };

  // Handle text selection for translation
  const handleTextSelection = async () => {
    if (!editorView) return;

    const { state } = editorView;
    const { selection } = state;
    const { from, to } = selection;

    // Check if there's actual text selected
    if (from === to) {
      setSelectionState(prev => ({ ...prev, isActive: false }));
      return;
    }

    const selectedText = state.doc.textBetween(from, to, ' ');
    
    if (!selectedText.trim()) {
      setSelectionState(prev => ({ ...prev, isActive: false }));
      return;
    }

    // Get position for tooltip
    const coords = editorView.coordsAtPos(from);
    
    setSelectionState({
      isActive: true,
      selectedText: selectedText.trim(),
      translation: '',
      isLoading: true,
      position: { x: coords.left, y: coords.top }
    });

    // Request translation
    try {
      const context = extractPlainTextFromDoc(state.doc);
      const response = await props.llmService.getTranslation({
        selectedText: selectedText.trim(),
        contextMessage: context,
        chatContext: `Journal entry: "${title()}"`
      });

      if (!response.error) {
        setSelectionState(prev => ({
          ...prev,
          translation: response.translation,
          isLoading: false
        }));
      } else {
        setSelectionState(prev => ({
          ...prev,
          translation: 'Translation failed',
          isLoading: false
        }));
      }
    } catch (error) {
      console.error('Translation error:', error);
      setSelectionState(prev => ({
        ...prev,
        translation: 'Translation failed',
        isLoading: false
      }));
    }
  };

  // Open translation side chat
  const openTranslationSideChat = () => {
    const state = selectionState();
    if (!state.selectedText || !state.translation) return;

    setSideChatState({
      isOpen: true,
      context: `Journal entry: "${title()}"`,
      suggestion: `Spanish: "${state.selectedText}" → English: "${state.translation}"`,
      messages: []
    });

    // Clear selection
    setSelectionState(prev => ({ ...prev, isActive: false }));
  };

  // Extract plain text from ProseMirror document
  const extractPlainTextFromDoc = (doc: any): string => {
    let text = '';
    
    doc.descendants((node: any) => {
      if (node.type.name === 'text') {
        text += node.text;
      } else if (node.type.name === 'paragraph' || node.type.name === 'heading') {
        text += ' ';
      }
    });
    
    return text.trim();
  };

  // Create editor plugins
  const createEditorPlugins = () => [
    history(),
    keymap({
      'Tab': () => {
        getTextCorrections();
        return true;
      },
      'Shift-Enter': () => {
        openSideChat();
        return true;
      },
      'Escape': () => {
        clearAllCorrections();
        return true;
      },
      'Mod-z': undo,
      'Mod-Shift-z': redo,
      ...baseKeymap
    })
  ];

  // Initialize editor
  onMount(() => {
    if (!editorRef) return;

    const state = EditorState.create({
      schema,
      plugins: createEditorPlugins()
    });

    editorView = new EditorView(editorRef, {
      state,
      dispatchTransaction: (tr: Transaction) => {
        const newState = editorView!.state.apply(tr);
        editorView!.updateState(newState);
        
        // Update word count
        const text = extractPlainTextFromDoc(newState.doc);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        setWordCount(words);
        
        // Handle text selection changes
        if (tr.selectionSet) {
          // Debounce text selection to avoid too many translation requests
          setTimeout(handleTextSelection, 300);
        }
        
        // Schedule auto-save on content changes
        if (tr.docChanged) {
          scheduleAutoSave();
        }
      },
      handleClickOn: () => {
        // Clear selection when clicking elsewhere
        setTimeout(() => {
          if (editorView && editorView.state.selection.empty) {
            setSelectionState(prev => ({ ...prev, isActive: false }));
          }
        }, 100);
      }
    });

    // Load existing content
    loadJournalEntry();
  });

  // Cleanup
  onCleanup(() => {
    if (saveTimeout) clearTimeout(saveTimeout);
    if (editorView) {
      editorView.destroy();
    }
  });

  return (
    <>
      <div class="flex-1 flex flex-col bg-white">
        {/* Editor Header */}
        <div class="border-b border-gray-200 p-4">
          <div class="flex items-center justify-between mb-4">
            <input
              ref={titleRef!}
              value={title()}
              onInput={(e) => handleTitleChange(e.currentTarget.value)}
              placeholder="Título de la entrada..."
              class="text-2xl font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0 flex-1 mr-4"
            />
            
            <div class="flex items-center gap-4 text-sm text-gray-500">
              <Show when={isSaving()}>
                <div class="flex items-center gap-2">
                  <div class="w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <span>Guardando...</span>
                </div>
              </Show>
              
              <Show when={lastSaved() && !isSaving()}>
                <span>
                  Guardado {lastSaved()!.toLocaleTimeString('es-ES', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
              </Show>
              
              <span>{wordCount()} palabras</span>
            </div>
          </div>
          
          <div class="text-sm text-gray-600">
            <span class="mr-4">
              <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Tab</kbd> 
              {' '}para correcciones
            </span>
            <span class="mr-4">
              <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Shift+Enter</kbd> 
              {' '}para ayuda gramatical
            </span>
            <span>
              <kbd class="px-2 py-1 bg-gray-100 rounded text-xs font-mono">Esc</kbd> 
              {' '}para limpiar sugerencias
            </span>
          </div>
        </div>

        {/* Corrections Status */}
        <Show when={isGettingCorrections() || corrections().length > 0}>
          <div class="border-b border-gray-200 p-3 bg-amber-50">
            <Show when={isGettingCorrections()}>
              <div class="flex items-center gap-2 text-amber-700">
                <div class="w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                <span class="text-sm">Analizando texto y generando correcciones...</span>
              </div>
            </Show>
            
            <Show when={!isGettingCorrections() && corrections().length > 0}>
              <div class="flex items-center justify-between">
                <span class="text-sm text-amber-700 font-medium">
                  {corrections().length} sugerencias de corrección encontradas
                </span>
                <button
                  onClick={clearAllCorrections}
                  class="px-3 py-1 text-xs bg-amber-200 text-amber-800 rounded hover:bg-amber-300 transition-colors"
                >
                  Limpiar todas
                </button>
              </div>
            </Show>
          </div>
        </Show>

        {/* Editor Area */}
        <div class="flex-1 overflow-y-auto">
          <Show when={isLoading()}>
            <div class="flex items-center justify-center h-64">
              <div class="flex items-center gap-2 text-gray-600">
                <div class="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span>Cargando entrada...</span>
              </div>
            </div>
          </Show>
          
          <div 
            ref={editorRef!}
            class="prose prose-lg max-w-none p-8 min-h-full focus:outline-none"
            style={{ 
              "font-family": "'Inter', system-ui, sans-serif",
              "line-height": "1.7"
            }}
          />
        </div>
      </div>

      {/* Side Chat Panel */}
      <SideChat
        isOpen={sideChatState().isOpen}
        context={sideChatState().context}
        suggestion={sideChatState().suggestion}
        messages={sideChatState().messages}
        chatSuggestionService={props.llmService}
        onClose={closeSideChat}
        onSendMessage={handleSideChatMessage}
      />

      {/* Translation Tooltip */}
      <Show when={selectionState().isActive}>
        <TranslationTooltip
          selectedText={selectionState().selectedText}
          translation={selectionState().translation}
          isLoading={selectionState().isLoading}
          position={selectionState().position}
          onOpenSideChat={openTranslationSideChat}
        />
      </Show>
    </>
  );
}

// Translation Tooltip Component for Journal Editor
interface TranslationTooltipProps {
  selectedText: string;
  translation: string;
  isLoading: boolean;
  position: { x: number; y: number };
  onOpenSideChat: () => void;
}

function TranslationTooltip(props: TranslationTooltipProps) {
  const getTooltipStyle = () => {
    const tooltipWidth = 300;
    const tooltipHeight = 120;
    
    // Position below the selection by default
    let left = props.position.x - (tooltipWidth / 2);
    let top = props.position.y + 25;
    
    // Adjust if going off screen
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    
    // If tooltip goes below viewport, position above selection
    if (top + tooltipHeight > window.innerHeight - 10) {
      top = props.position.y - tooltipHeight - 10;
    }
    
    return {
      position: 'fixed' as const,
      left: `${left}px`,
      top: `${top}px`,
      'z-index': '1000',
      width: `${tooltipWidth}px`
    };
  };

  return (
    <div 
      style={getTooltipStyle()}
      class="bg-white border border-gray-200 rounded-lg shadow-lg p-3"
    >
      <div class="space-y-2">
        <div class="text-xs text-gray-500 font-medium">
          Selected: "{props.selectedText}"
        </div>
        
        <div class="text-sm">
          {props.isLoading ? (
            <div class="flex items-center gap-2 text-gray-600">
              <div class="w-4 h-4 border-2 border-gray-400 border-t-blue-500 rounded-full animate-spin"></div>
              <span>Translating...</span>
            </div>
          ) : props.translation ? (
            <div>
              <div class="text-xs text-gray-500 mb-1">Translation:</div>
              <div class="text-gray-800 font-medium">"{props.translation}"</div>
            </div>
          ) : (
            <div class="text-gray-500 text-xs">
              Translation will appear shortly...
            </div>
          )}
        </div>
        
        {props.translation && !props.isLoading && (
          <div class="flex gap-2 pt-2 border-t border-gray-100">
            <button
              onClick={props.onOpenSideChat}
              class="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Discuss Translation
            </button>
          </div>
        )}
      </div>
    </div>
  );
}