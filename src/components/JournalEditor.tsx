import { createSignal, createEffect, onMount, onCleanup, Show } from 'solid-js';
import { EditorState, Transaction } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema } from 'prosemirror-model';
import { baseKeymap } from 'prosemirror-commands';
import { keymap } from 'prosemirror-keymap';
import { history, undo, redo } from 'prosemirror-history';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';
import { useNavigate, revalidate } from '@solidjs/router';
import { ClientLLMService } from '~/services/llm';
import { createDebouncedTranslation } from '~/lib/translation-utils';
import SideChat from './SideChat';
import { type SideChatState, type CorrectionSuggestion } from './types';
import { diffWords } from 'diff';
import TranslationTooltip from './TranslationTooltip';

export interface JournalEditorProps {
  entryId: string;
  llmService: ClientLLMService;
  onTitleChange?: (title: string) => void;
}

export default function JournalEditor(props: JournalEditorProps) {
  let editorRef: HTMLDivElement | undefined;
  let titleRef: HTMLInputElement | undefined;
  let editorView: EditorView | undefined;

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = createSignal(false);
  const [isSaving, setIsSaving] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [title, setTitle] = createSignal('Untitled');
  const [wordCount, setWordCount] = createSignal(0);
  const [lastSaved, setLastSaved] = createSignal<Date | null>(null);

  // Correction suggestions state
  const [corrections, setCorrections] = createSignal<CorrectionSuggestion[]>(
    []
  );
  const [isGettingCorrections, setIsGettingCorrections] = createSignal(false);

  // Side chat state
  const [sideChatState, setSideChatState] = createSignal<SideChatState>({
    isOpen: false,
    context: '',
    suggestion: '',
    messages: [],
  });

  // Use shared debounced translation utility
  const { translationState, requestTranslation, clearTranslation } =
    createDebouncedTranslation(props.llmService);

  // Create enhanced schema with list support
  const schema = new Schema({
    nodes: addListNodes(basicSchema.spec.nodes, 'paragraph block*', 'block'),
    marks: basicSchema.spec.marks.append({
      correction_delete: {
        attrs: { correctionId: { default: null } },
        parseDOM: [{ tag: 'span.correction-delete' }],
        toDOM: mark => [
          'span',
          {
            class:
              'correction-delete bg-red-100 text-red-800 line-through cursor-pointer hover:bg-red-200 px-1 rounded',
            'data-correction-id': mark.attrs.correctionId,
            title: 'Click to reject this correction',
          },
        ],
      },
      correction_insert: {
        attrs: { correctionId: { default: null } },
        parseDOM: [{ tag: 'span.correction-insert' }],
        toDOM: mark => [
          'span',
          {
            class:
              'correction-insert bg-green-100 text-green-800 cursor-pointer hover:bg-green-200 px-1 rounded',
            'data-correction-id': mark.attrs.correctionId,
            title: 'Click to accept this correction',
          },
        ],
      },
    }),
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
            plugins: createEditorPlugins(),
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
        content,
      };

      let response;
      // Check if entry exists first
      const existingResponse = await fetch(`/api/journal/${props.entryId}`);

      if (existingResponse.ok) {
        // Update existing entry
        response = await fetch(`/api/journal/${props.entryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData),
        });
      } else {
        // Create new entry
        response = await fetch('/api/journal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(entryData),
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
    // Don't auto-save when there are corrections present
    if (corrections().length > 0) {
      if (saveTimeout) clearTimeout(saveTimeout);
      return;
    }

    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      if (editorView) {
        const content = editorView.state.doc.toJSON();
        await saveJournalEntry(content);

        // Revalidate the journal entries list to update the sidebar with word count and timestamp
        revalidate('journal-entries');
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
  };

  // Handle title changes
  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    props.onTitleChange?.(newTitle);

    // Don't auto-save title when there are corrections present
    if (corrections().length > 0) {
      return;
    }

    // Auto-save title
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
      if (editorView) {
        const content = editorView.state.doc.toJSON();
        await saveJournalEntry(content, newTitle);

        // Revalidate the journal entries list to update the sidebar with new title
        revalidate('journal-entries');
      }
    }, 1000);
  };

  // Handle entry deletion
  const handleDeleteEntry = async () => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/journal/${props.entryId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Revalidate the journal entries list to update the sidebar
        revalidate('journal-entries');

        // Navigate back to journal list
        navigate('/journal');
      } else {
        console.error('Failed to delete journal entry');
        // You could add a toast notification here
      }
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      // You could add a toast notification here
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  // Get text corrections from LLM
  const getTextCorrections = async () => {
    if (!editorView || isGettingCorrections()) return;

    setIsGettingCorrections(true);

    try {
      // Extract text from current paragraph only
      const paragraphData = extractCurrentParagraphText();

      if (!paragraphData || !paragraphData.text.trim()) {
        setIsGettingCorrections(false);
        return;
      }

      // Request correction from LLM
      const response = await fetch('/api/journal/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: paragraphData.text,
          context: `Current paragraph from journal entry titled "${title()}"`,
          language: 'spanish',
        }),
      });

      if (response.ok) {
        const { correctedText } = await response.json();

        if (correctedText && correctedText !== paragraphData.text) {
          // Generate text segments with consistent IDs
          const segments = buildCorrectedTextSegments(
            paragraphData.text,
            correctedText
          );

          // Generate correction suggestions for tracking using the same segments
          const suggestions =
            generateCorrectionSuggestionsFromSegments(segments);
          console.log('Suggestions', suggestions);
          setCorrections(suggestions);

          // Apply corrections declaratively by rebuilding the paragraph
          applyCorrectionMarksFromSegments(
            segments,
            paragraphData.node,
            paragraphData.nodePos
          );
        }
      }
    } catch (error) {
      console.error('Error getting text corrections:', error);
    } finally {
      setIsGettingCorrections(false);
    }
  };

  // Build corrected text segments from diff results
  const buildCorrectedTextSegments = (
    original: string,
    corrected: string
  ): Array<{
    text: string;
    type: 'unchanged' | 'delete' | 'insert' | 'replace';
    correctionId?: string;
  }> => {
    const diff = diffWords(original, corrected);
    console.log('Diff', diff);

    const segments: Array<{
      text: string;
      type: 'unchanged' | 'delete' | 'insert' | 'replace';
      correctionId?: string;
    }> = [];

    const timestamp = Date.now();
    let correctionIndex = 0;

    for (let i = 0; i < diff.length; i++) {
      const part = diff[i];
      const nextPart = diff[i + 1];

      if (!part.added && !part.removed) {
        // Unchanged text
        segments.push({
          text: part.value,
          type: 'unchanged',
        });
      } else if (part.removed && nextPart?.added) {
        // Replacement: removed followed by added
        const correctionId = `correction-${timestamp}-${correctionIndex++}`;
        segments.push({
          text: part.value,
          type: 'delete',
          correctionId,
        });
        segments.push({
          text: nextPart.value,
          type: 'insert',
          correctionId,
        });
        i++; // Skip the next part since we've processed it
      } else if (part.removed) {
        // Pure deletion
        segments.push({
          text: part.value,
          type: 'delete',
          correctionId: `correction-${timestamp}-${correctionIndex++}`,
        });
      } else if (part.added) {
        // Pure addition
        segments.push({
          text: part.value,
          type: 'insert',
          correctionId: `correction-${timestamp}-${correctionIndex++}`,
        });
      }
    }

    console.log('Text segments', segments);
    return segments;
  };

  // Generate correction suggestions from text segments
  const generateCorrectionSuggestionsFromSegments = (
    segments: Array<{
      text: string;
      type: 'unchanged' | 'delete' | 'insert' | 'replace';
      correctionId?: string;
    }>
  ): CorrectionSuggestion[] => {
    const suggestions: CorrectionSuggestion[] = [];

    // Extract unique corrections from segments for tracking purposes
    const correctionMap = new Map<
      string,
      { original: string; corrected: string; type: string }
    >();

    segments.forEach(segment => {
      if (segment.correctionId && segment.type === 'delete') {
        if (!correctionMap.has(segment.correctionId)) {
          correctionMap.set(segment.correctionId, {
            original: segment.text,
            corrected: '',
            type: 'remove',
          });
        } else {
          correctionMap.get(segment.correctionId)!.original = segment.text;
        }
      } else if (segment.correctionId && segment.type === 'insert') {
        if (!correctionMap.has(segment.correctionId)) {
          correctionMap.set(segment.correctionId, {
            original: '',
            corrected: segment.text,
            type: 'add',
          });
        } else {
          const existing = correctionMap.get(segment.correctionId)!;
          existing.corrected = segment.text;
          existing.type = existing.original ? 'replace' : 'add';
        }
      }
    });

    // Convert to suggestion format
    correctionMap.forEach((correction, id) => {
      suggestions.push({
        id,
        type: correction.type as 'add' | 'remove' | 'replace',
        originalText: correction.original,
        correctedText: correction.corrected,
        startPos: 0, // Not used in declarative approach
        endPos: 0, // Not used in declarative approach
        status: 'pending',
      });
    });

    console.log('Processed suggestions', suggestions);
    return suggestions;
  };

  // Apply correction marks to editor using declarative paragraph replacement from segments
  const applyCorrectionMarksFromSegments = (
    segments: Array<{
      text: string;
      type: 'unchanged' | 'delete' | 'insert' | 'replace';
      correctionId?: string;
    }>,
    paragraphNode: any,
    paragraphPos: number
  ) => {
    if (!editorView) return;

    // Build new paragraph content with marks
    const textNodes: any[] = [];

    segments.forEach(segment => {
      if (segment.type === 'unchanged') {
        // Add text without any marks
        textNodes.push(schema.text(segment.text));
      } else if (segment.type === 'delete') {
        // Add text with deletion mark
        textNodes.push(
          schema.text(segment.text, [
            schema.marks.correction_delete.create({
              correctionId: segment.correctionId,
            }),
          ])
        );
      } else if (segment.type === 'insert') {
        // Add text with insertion mark
        textNodes.push(
          schema.text(segment.text, [
            schema.marks.correction_insert.create({
              correctionId: segment.correctionId,
            }),
          ])
        );
      }
    });

    // Create new paragraph with the marked content
    const newParagraph = schema.nodes.paragraph.create(
      paragraphNode.attrs,
      textNodes
    );

    // Replace the entire paragraph
    const tr = editorView.state.tr.replaceWith(
      paragraphPos,
      paragraphPos + paragraphNode.nodeSize,
      newParagraph
    );

    editorView.dispatch(tr);
  };

  // Accept correction
  const acceptCorrection = (correctionId: string) => {
    const correction = corrections().find(c => c.id === correctionId);
    console.log('Corrections', corrections(), correctionId);
    if (!correction || !editorView) return;
    console.log('Accepting correction, hello', correctionId);
    console.log('Correction', correction);

    let tr = editorView.state.tr;
    const doc = editorView.state.doc;

    // Collect all nodes that need to be processed for this correction
    const nodesToDelete: Array<{ from: number; to: number }> = [];
    const marksToRemove: Array<{ from: number; to: number; mark: any }> = [];

    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.attrs.correctionId === correctionId) {
            if (mark.type.name === 'correction_delete') {
              // Mark for deletion (for replace and remove operations)
              nodesToDelete.push({ from: pos, to: pos + node.nodeSize });
            }
            // Mark all correction marks for removal
            marksToRemove.push({ from: pos, to: pos + node.nodeSize, mark });
          }
        });
      }
    });

    // Remove all correction marks first
    marksToRemove.forEach(({ from, to, mark }) => {
      tr = tr.removeMark(from, to, mark);
    });

    // Delete nodes marked for deletion (in reverse order to maintain positions)
    nodesToDelete.sort((a, b) => b.from - a.from);
    nodesToDelete.forEach(({ from, to }) => {
      tr = tr.delete(from, to);
    });

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
    const doc = editorView.state.doc;

    // Collect nodes to delete (inserted text) and marks to remove
    const nodesToDelete: Array<{ from: number; to: number }> = [];
    const marksToRemove: Array<{ from: number; to: number; mark: any }> = [];

    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach(mark => {
          if (mark.attrs.correctionId === correctionId) {
            if (mark.type.name === 'correction_insert') {
              // Mark inserted text for deletion (for replace and add operations)
              nodesToDelete.push({ from: pos, to: pos + node.nodeSize });
            }
            // Mark all correction marks for removal
            marksToRemove.push({ from: pos, to: pos + node.nodeSize, mark });
          }
        });
      }
    });

    // Remove all correction marks first
    marksToRemove.forEach(({ from, to, mark }) => {
      tr = tr.removeMark(from, to, mark);
    });

    // Delete inserted text (in reverse order to maintain positions)
    nodesToDelete.sort((a, b) => b.from - a.from);
    nodesToDelete.forEach(({ from, to }) => {
      tr = tr.delete(from, to);
    });

    editorView.dispatch(tr);

    // Update corrections state
    setCorrections(prev => prev.filter(c => c.id !== correctionId));
  };

  // Accept all corrections
  const acceptAllCorrections = () => {
    if (!editorView || corrections().length === 0) return;

    // Simply accept each correction individually
    const correctionIds = corrections().map(c => c.id);
    correctionIds.forEach(id => {
      acceptCorrection(id);
    });
  };

  // Clear all corrections
  const clearAllCorrections = () => {
    if (!editorView) return;

    let tr = editorView.state.tr;

    // Remove all correction marks and inserted text
    const doc = editorView.state.doc;
    const nodesToDelete: Array<{ from: number; to: number }> = [];

    doc.descendants((node, pos) => {
      if (node.marks) {
        node.marks.forEach(mark => {
          if (
            mark.type.name === 'correction_delete' ||
            mark.type.name === 'correction_insert'
          ) {
            tr = tr.removeMark(pos, pos + node.nodeSize, mark);

            // Remove inserted text
            if (mark.type.name === 'correction_insert') {
              nodesToDelete.push({ from: pos, to: pos + node.nodeSize });
            }
          }
        });
      }
    });

    // Delete inserted text (in reverse order to maintain positions)
    nodesToDelete.sort((a, b) => b.from - a.from);
    nodesToDelete.forEach(({ from, to }) => {
      tr = tr.delete(from, to);
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

  // Handle text selection for translation
  const handleTextSelection = async () => {
    if (!editorView) return;

    const { state } = editorView;
    const { selection } = state;
    const { from, to } = selection;

    // Check if there's actual text selected
    if (from === to) {
      clearTranslation();
      return;
    }

    const selectedText = state.doc.textBetween(from, to, ' ');

    if (!selectedText.trim()) {
      clearTranslation();
      return;
    }

    // Get position for tooltip
    const coords = editorView.coordsAtPos(from);

    // Use shared translation utility with debouncing
    const context = extractPlainTextFromDoc(state.doc);
    await requestTranslation(
      selectedText.trim(),
      context,
      `Journal entry: "${title()}"`,
      undefined, // No selectionRect for ProseMirror
      { x: coords.left, y: coords.top }
    );
  };

  // Open translation side chat
  const openTranslationSideChat = () => {
    const state = translationState();
    if (!state.selectedText || !state.translation || !editorView) return;

    setSideChatState({
      isOpen: true,
      context: `The user is writing a journal entry: "${extractPlainTextFromDoc(editorView.state.doc)}"`,
      suggestion: `Spanish: "${state.selectedText}" → English: "${state.translation}"`,
      messages: [],
    });

    // Clear selection
    clearTranslation();
  };

  // Extract plain text from ProseMirror document with position mapping
  const extractPlainTextFromDoc = (doc: any): string => {
    let text = '';

    doc.descendants((node: any) => {
      if (node.type.name === 'text') {
        text += node.text;
      } else if (
        node.type.name === 'paragraph' ||
        node.type.name === 'heading'
      ) {
        text += ' ';
      }
    });

    return text.trim();
  };

  // Extract text from current paragraph only
  const extractCurrentParagraphText = (): {
    text: string;
    startPos: number;
    endPos: number;
    node: any;
    nodePos: number;
  } | null => {
    if (!editorView) return null;

    const { state } = editorView;
    const { selection } = state;
    const cursorPos = selection.from;

    // Find the paragraph node that contains the cursor
    let paragraphNode: any = null;
    let paragraphStartPos = 0;
    let paragraphEndPos = 0;

    state.doc.descendants((node: any, pos: number) => {
      if (paragraphNode) return false; // Already found, stop searching

      if (node.type.name === 'paragraph') {
        const nodeEndPos = pos + node.nodeSize;
        if (pos <= cursorPos && cursorPos <= nodeEndPos) {
          paragraphNode = node;
          paragraphStartPos = pos;
          paragraphEndPos = nodeEndPos;
          return false; // Found the paragraph, stop searching
        }
      }
    });

    if (!paragraphNode) return null;

    // Extract text from the paragraph
    let text = '';
    paragraphNode.descendants((node: any) => {
      if (node.type.name === 'text') {
        text += node.text;
      }
    });

    return {
      text: text.trim(),
      startPos: paragraphStartPos + 1, // +1 for paragraph opening
      endPos: paragraphEndPos - 1, // -1 for paragraph closing
      node: paragraphNode,
      nodePos: paragraphStartPos,
    };
  };

  // Create editor plugins
  const createEditorPlugins = () => [
    history(),
    keymap({
      Tab: () => {
        // If in correction mode, accept all corrections
        if (corrections().length > 0) {
          acceptAllCorrections();
        } else {
          // Otherwise, get new corrections
          getTextCorrections();
        }
        return true;
      },
      'Shift-Enter': () => {
        openSideChat();
        return true;
      },
      Escape: () => {
        clearAllCorrections();
        return true;
      },
      'Mod-z': undo,
      'Mod-Shift-z': redo,
      ...baseKeymap,
    }),
  ];

  // Initialize editor
  onMount(() => {
    if (!editorRef) return;

    const state = EditorState.create({
      schema,
      plugins: createEditorPlugins(),
    });

    editorView = new EditorView(editorRef, {
      state,
      dispatchTransaction: (tr: Transaction) => {
        // Prevent regular editing when in correction mode, but allow correction-related transactions
        if (corrections().length > 0 && tr.docChanged) {
          // Check if this is a correction-related transaction
          const isCorrectionTransaction = tr.steps.some(step => {
            const stepJson = step.toJSON();
            // Allow mark operations and specific replace operations for corrections
            return (
              stepJson.stepType === 'addMark' ||
              stepJson.stepType === 'removeMark' ||
              stepJson.stepType === 'replaceWith' ||
              (stepJson.stepType === 'replace' && stepJson.from !== stepJson.to)
            );
          });

          // Allow only correction transactions or selection changes
          if (!isCorrectionTransaction && !tr.selectionSet) {
            return; // Block the transaction
          }
        }

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
      handleClickOn: (view, pos, node, nodePos, event) => {
        // Handle clicks on correction marks
        const target = event.target as HTMLElement;
        const correctionId = target.getAttribute('data-correction-id');

        if (correctionId) {
          event.preventDefault();
          event.stopPropagation();

          if (target.classList.contains('correction-delete')) {
            rejectCorrection(correctionId);
          } else if (target.classList.contains('correction-insert')) {
            acceptCorrection(correctionId);
          }
          return true;
        }

        // Clear selection when clicking elsewhere
        setTimeout(() => {
          if (editorView && editorView.state.selection.empty) {
            clearTranslation();
          }
        }, 100);

        return false;
      },
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
      <div class='flex-1 flex flex-col bg-white h-full overflow-hidden'>
        {/* Editor Header */}
        <div class='border-b border-gray-200 p-4 flex-shrink-0'>
          <div class='flex items-center justify-between mb-4'>
            <input
              ref={titleRef!}
              value={title()}
              onInput={e => handleTitleChange(e.currentTarget.value)}
              placeholder='Título de la entrada...'
              disabled={corrections().length > 0}
              class={`text-2xl font-semibold text-gray-900 bg-transparent border-none outline-none focus:ring-0 flex-1 mr-4 ${corrections().length > 0 ? 'cursor-not-allowed opacity-60' : ''}`}
            />

            <div class='flex items-center gap-4 text-sm text-gray-500'>
              <Show when={isSaving()}>
                <div class='flex items-center gap-2'>
                  <div class='w-3 h-3 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
                  <span>Guardando...</span>
                </div>
              </Show>

              <Show when={lastSaved() && !isSaving()}>
                <span>
                  Guardado{' '}
                  {lastSaved()!.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </Show>

              <span>{wordCount()} palabras</span>

              <button
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isDeleting() || isSaving()}
                class='ml-2 px-3 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
                title='Eliminar entrada'
              >
                <Show when={isDeleting()}>
                  <div class='w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin'></div>
                </Show>
                <Show when={!isDeleting()}>
                  <svg
                    class='w-4 h-4'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      stroke-linecap='round'
                      stroke-linejoin='round'
                      stroke-width='2'
                      d='M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'
                    />
                  </svg>
                </Show>
              </button>
            </div>
          </div>

          <div class='text-sm text-gray-600'>
            <Show when={corrections().length === 0}>
              <span class='mr-4'>
                <kbd class='px-2 py-1 bg-gray-100 rounded text-xs font-mono'>
                  Tab
                </kbd>{' '}
                para correcciones del párrafo actual
              </span>
            </Show>
            <Show when={corrections().length > 0}>
              <span class='mr-4 text-amber-700 font-medium'>
                <kbd class='px-2 py-1 bg-amber-100 rounded text-xs font-mono'>
                  Tab
                </kbd>{' '}
                para aceptar todas las correcciones
              </span>
            </Show>
            <span class='mr-4'>
              <kbd class='px-2 py-1 bg-gray-100 rounded text-xs font-mono'>
                Shift+Enter
              </kbd>{' '}
              para ayuda gramatical
            </span>
            <span>
              <kbd class='px-2 py-1 bg-gray-100 rounded text-xs font-mono'>
                Esc
              </kbd>{' '}
              para limpiar sugerencias
            </span>
          </div>
        </div>

        {/* Corrections Status */}
        <Show when={isGettingCorrections() || corrections().length > 0}>
          <div class='border-b border-gray-200 p-3 bg-amber-50 flex-shrink-0'>
            <Show when={isGettingCorrections()}>
              <div class='flex items-center gap-2 text-amber-700'>
                <div class='w-4 h-4 border-2 border-amber-600 border-t-transparent rounded-full animate-spin'></div>
                <span class='text-sm'>
                  Analizando párrafo actual y generando correcciones...
                </span>
              </div>
            </Show>

            <Show when={!isGettingCorrections() && corrections().length > 0}>
              <div class='flex items-center justify-between'>
                <span class='text-sm text-amber-700 font-medium'>
                  {corrections().length} sugerencias de corrección encontradas -
                  Haz clic en las correcciones para aceptar/rechazar
                  individualmente
                </span>
                <div class='flex gap-2'>
                  <button
                    onClick={acceptAllCorrections}
                    class='px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors'
                  >
                    Aceptar todas
                  </button>
                  <button
                    onClick={clearAllCorrections}
                    class='px-3 py-1 text-xs bg-amber-200 text-amber-800 rounded hover:bg-amber-300 transition-colors'
                  >
                    Rechazar todas
                  </button>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Editor Area */}
        <div class='flex-1 overflow-y-auto min-h-0'>
          <Show when={isLoading()}>
            <div class='flex items-center justify-center h-64'>
              <div class='flex items-center gap-2 text-gray-600'>
                <div class='w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin'></div>
                <span>Cargando entrada...</span>
              </div>
            </div>
          </Show>

          <div
            ref={editorRef!}
            class='prose prose-lg max-w-none p-8 min-h-full focus:outline-none'
            style={{
              'font-family': "'Inter', system-ui, sans-serif",
              'line-height': '1.7',
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
      <Show when={translationState().isActive}>
        <TranslationTooltip
          selectedText={translationState().selectedText}
          translation={translationState().translation}
          isLoading={translationState().isLoading}
          position={translationState().position}
          onOpenSideChat={openTranslationSideChat}
        />
      </Show>

      {/* Delete Confirmation Modal */}
      <Show when={showDeleteConfirm()}>
        <div class='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div class='bg-white rounded-lg p-6 max-w-md w-full mx-4'>
            <h3 class='text-lg font-semibold text-gray-900 mb-4'>
              ¿Eliminar entrada?
            </h3>
            <p class='text-gray-600 mb-6'>
              Esta acción no se puede deshacer. La entrada "{title()}" será
              eliminada permanentemente.
            </p>
            <div class='flex gap-3 justify-end'>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting()}
                class='px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50'
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteEntry}
                disabled={isDeleting()}
                class='px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2'
              >
                <Show when={isDeleting()}>
                  <div class='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin'></div>
                </Show>
                {isDeleting() ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      </Show>
    </>
  );
}
