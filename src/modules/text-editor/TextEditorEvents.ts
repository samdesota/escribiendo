import { Accessor } from 'solid-js';
import { TextEditorState } from './TextEditorState';
import { ParagraphSelection } from './TextEditorModel';
import { logger, LOG_CATEGORIES } from '~/utils/logger';

export interface TextEditorEventHandlerOptions {
  readonly: boolean;
  placeholder?: string;
  onSuggestionTrigger?: () => void;
}

export class TextEditorEvents {
  private instanceId: number;
  private editorState: TextEditorState;
  private options: TextEditorEventHandlerOptions;
  private editorContainerRef: () => HTMLDivElement | undefined;
  private blockRefs: () => HTMLDivElement[];
  private preCompositionSelection: Accessor<ParagraphSelection | null>;
  private setPreCompositionSelection: (selection: ParagraphSelection | null) => void;

  constructor(
    instanceId: number,
    editorState: TextEditorState,
    options: TextEditorEventHandlerOptions,
    editorContainerRef: () => HTMLDivElement | undefined,
    blockRefs: () => HTMLDivElement[],
    preCompositionSelection: Accessor<ParagraphSelection | null>,
    setPreCompositionSelection: (selection: ParagraphSelection | null) => void
  ) {
    this.instanceId = instanceId;
    this.editorState = editorState;
    this.options = options;
    this.editorContainerRef = editorContainerRef;
    this.blockRefs = blockRefs;
    this.preCompositionSelection = preCompositionSelection;
    this.setPreCompositionSelection = setPreCompositionSelection;
  }

  // Get paragraph index and offset from a DOM node and offset
  private getParagraphCoordinates = (node: Node, offset: number): { paragraphIndex: number; offset: number } | null => {
    let currentNode = node;
    const container = this.editorContainerRef();

    // Walk up to find the paragraph element
    while (currentNode && currentNode !== container) {
      if (currentNode.nodeType === Node.ELEMENT_NODE) {
        const element = currentNode as HTMLElement;
        if (element.classList.contains('editor-paragraph')) {
          const paragraphIndex = parseInt(element.dataset.paragraphIndex || '0');

          // Calculate text offset within this paragraph
          let textOffset = 0;
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null
          );

          let textNode;
          while (textNode = walker.nextNode()) {
            if (textNode === node) {
              return { paragraphIndex, offset: textOffset + offset };
            }
            textOffset += textNode.textContent?.length || 0;
          }

          // If we didn't find the exact text node, use the text offset we've calculated
          return { paragraphIndex, offset: textOffset };
        }
      }
      currentNode = currentNode.parentNode!;
    }

    return null;
  };

  // Get current selection as paragraph coordinates
  private getCurrentSelection = (): ParagraphSelection | null => {
    const container = this.editorContainerRef();
    if (!container) return null;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);

    const startCoords = this.getParagraphCoordinates(range.startContainer, range.startOffset);
    const endCoords = this.getParagraphCoordinates(range.endContainer, range.endOffset);

    if (!startCoords || !endCoords) return null;

    return {
      startParagraph: startCoords.paragraphIndex,
      startOffset: startCoords.offset,
      endParagraph: endCoords.paragraphIndex,
      endOffset: endCoords.offset,
      isCollapsed: startCoords.paragraphIndex === endCoords.paragraphIndex && startCoords.offset === endCoords.offset
    };
  };

  // Handle manual input events - prevent default and translate to state commands
  handleBeforeInput = (e: InputEvent) => {
    logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} beforeInput called`, {
      inputType: e.inputType,
      data: e.data,
      readonly: this.options.readonly
    });

    if (this.options.readonly) {
      logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Input ignored - readonly`);
      e.preventDefault();
      return;
    }

    // Prevent default DOM manipulation - we'll handle everything manually
    e.preventDefault();

    const selection = this.getCurrentSelection();
    if (!selection) {
      logger.warn(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} No selection available`);
      return;
    }

    const inputType = e.inputType;
    const data = e.data;

    logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Processing input`, {
      inputType,
      data,
      selection
    });

    // Handle different input types
    switch (inputType) {
      case 'insertText':
        if (data) {
          if (!selection.isCollapsed) {
            // Replace selected text
            logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Replacing selected text`);
            this.editorState.replaceText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset, data);
            // Move cursor to after inserted text
            const newOffset = selection.startOffset + data.length;
            this.editorState.updateSelection({
              startParagraph: selection.startParagraph,
              startOffset: newOffset,
              endParagraph: selection.startParagraph,
              endOffset: newOffset,
              isCollapsed: true
            });
          } else {
            // Insert at cursor
            logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Inserting text at cursor`);
            this.editorState.insertText(data, selection.startParagraph, selection.startOffset);
            // Move cursor to after inserted text
            const newOffset = selection.startOffset + data.length;
            this.editorState.updateSelection({
              startParagraph: selection.startParagraph,
              startOffset: newOffset,
              endParagraph: selection.startParagraph,
              endOffset: newOffset,
              isCollapsed: true
            });
          }
        }
        break;

      case 'insertLineBreak':
      case 'insertParagraph':
        if (!selection.isCollapsed) {
          logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Replacing selection with new paragraph`);
          this.editorState.replaceText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset, '');
        }

        logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Splitting paragraph`);
        this.editorState.splitParagraph(selection.startParagraph, selection.startOffset);

        // Move cursor to start of new paragraph
        this.editorState.updateSelection({
          startParagraph: selection.startParagraph + 1,
          startOffset: 0,
          endParagraph: selection.startParagraph + 1,
          endOffset: 0,
          isCollapsed: true
        });
        break;

      case 'deleteContentBackward':
        if (!selection.isCollapsed) {
          // Delete selection
          logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Deleting selected content`);
          this.editorState.deleteText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset);
          this.editorState.updateSelection({
            startParagraph: selection.startParagraph,
            startOffset: selection.startOffset,
            endParagraph: selection.startParagraph,
            endOffset: selection.startOffset,
            isCollapsed: true
          });
        } else if (selection.startOffset > 0) {
          // Delete character before cursor within paragraph
          logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Deleting character backward`);
          this.editorState.deleteText(selection.startParagraph, selection.startOffset - 1, selection.startParagraph, selection.startOffset);
          this.editorState.updateSelection({
            startParagraph: selection.startParagraph,
            startOffset: selection.startOffset - 1,
            endParagraph: selection.startParagraph,
            endOffset: selection.startOffset - 1,
            isCollapsed: true
          });
        } else if (selection.startParagraph > 0) {
          // Merge with previous paragraph
          logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Merging with previous paragraph`);
          const prevBlock = this.editorState.blocks()[selection.startParagraph - 1];
          const mergeOffset = prevBlock.content.length;

          this.editorState.mergeParagraphs(selection.startParagraph - 1, selection.startParagraph);
          this.editorState.updateSelection({
            startParagraph: selection.startParagraph - 1,
            startOffset: mergeOffset,
            endParagraph: selection.startParagraph - 1,
            endOffset: mergeOffset,
            isCollapsed: true
          });
        }
        break;

      case 'deleteContentForward':
        if (!selection.isCollapsed) {
          // Delete selection
          logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Deleting selected content forward`);
          this.editorState.deleteText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset);
          this.editorState.updateSelection({
            startParagraph: selection.startParagraph,
            startOffset: selection.startOffset,
            endParagraph: selection.startParagraph,
            endOffset: selection.startOffset,
            isCollapsed: true
          });
        } else {
          // Delete character after cursor
          const currentBlock = this.editorState.blocks()[selection.startParagraph];
          if (currentBlock && selection.startOffset < currentBlock.content.length) {
            logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Deleting character forward`);
            this.editorState.deleteText(selection.startParagraph, selection.startOffset, selection.startParagraph, selection.startOffset + 1);
          } else if (selection.startParagraph < this.editorState.blocks().length - 1) {
            // Merge with next paragraph
            logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Merging with next paragraph`);
            this.editorState.mergeParagraphs(selection.startParagraph, selection.startParagraph + 1);
          }
          // Keep cursor at same position
        }
        break;

      case 'insertFromPaste':
        if (data) {
          if (!selection.isCollapsed) {
            logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Replacing selection with pasted content`);
            this.editorState.replaceText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset, data);
          } else {
            logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Inserting pasted content`);
            this.editorState.insertText(data, selection.startParagraph, selection.startOffset);
          }

          // Calculate new cursor position (simplified - could be more complex with multi-line paste)
          const newOffset = selection.startOffset + data.length;
          this.editorState.updateSelection({
            startParagraph: selection.startParagraph,
            startOffset: newOffset,
            endParagraph: selection.startParagraph,
            endOffset: newOffset,
            isCollapsed: true
          });
        }
        break;

      default:
        logger.warn(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Unhandled input type: ${inputType}`, { data });
        break;
    }
  };

  // Handle keyboard shortcuts
  handleKeyDown = (e: KeyboardEvent) => {
    if (this.options.readonly) return;

    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) {
            this.editorState.redo();
          } else {
            this.editorState.undo();
          }
          break;
        case 'y':
          e.preventDefault();
          this.editorState.redo();
          break;
        case 'Enter':
          e.preventDefault();
          if (this.options.onSuggestionTrigger) {
            this.options.onSuggestionTrigger();
          }
          break;
      }
    }
  };

  // Handle selection changes to update state
  handleSelectionChange = () => {
    const container = this.editorContainerRef();
    if (this.options.readonly || !container) return;

    const selection = this.getCurrentSelection();
    if (selection) {
      this.editorState.updateSelection(selection);
    }
  };

  // Handle composition events for IME input
  handleCompositionStart = () => {
    logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Composition started`);
    const currentSelection = this.getCurrentSelection();
    if (currentSelection) {
      this.setPreCompositionSelection(currentSelection);
    }
    this.editorState.startComposition();
  };

  handleCompositionEnd = (e: CompositionEvent) => {
    logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Composition ended`, { data: e.data });
    this.editorState.endComposition();

    if (e.data) {
      const selection = this.getCurrentSelection();
      if (selection) {
        if (!selection.isCollapsed) {
          this.editorState.replaceText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset, e.data);
        } else {
          this.editorState.insertText(e.data, selection.startParagraph, selection.startOffset);
        }

        // Move cursor to after composed text
        const newOffset = selection.startOffset + e.data.length;
        this.editorState.updateSelection({
          startParagraph: selection.startParagraph,
          startOffset: newOffset,
          endParagraph: selection.startParagraph,
          endOffset: newOffset,
          isCollapsed: true
        });
      }
    } else {
      // Restore pre-composition selection
      const savedSelection = this.preCompositionSelection();
      if (savedSelection) {
        this.editorState.updateSelection(savedSelection);
      }
    }

    this.setPreCompositionSelection(null);
  };

  // Handle paste events manually
  handlePaste = (e: ClipboardEvent) => {
    if (this.options.readonly) {
      e.preventDefault();
      return;
    }

    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain');

    if (text) {
      logger.debug(LOG_CATEGORIES.EDITOR_EVENTS, `#${this.instanceId} Handling paste`, { text: text.slice(0, 50) });

      const selection = this.getCurrentSelection();
      if (selection) {
        if (!selection.isCollapsed) {
          this.editorState.replaceText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset, text);
        } else {
          this.editorState.insertText(text, selection.startParagraph, selection.startOffset);
        }

        // Calculate new cursor position
        const lines = text.split('\n');
        if (lines.length === 1) {
          // Single line paste
          const newOffset = selection.startOffset + text.length;
          this.editorState.updateSelection({
            startParagraph: selection.startParagraph,
            startOffset: newOffset,
            endParagraph: selection.startParagraph,
            endOffset: newOffset,
            isCollapsed: true
          });
        } else {
          // Multi-line paste - cursor goes to end of last pasted line
          const newParagraph = selection.startParagraph + lines.length - 1;
          const newOffset = lines[lines.length - 1].length;
          this.editorState.updateSelection({
            startParagraph: newParagraph,
            startOffset: newOffset,
            endParagraph: newParagraph,
            endOffset: newOffset,
            isCollapsed: true
          });
        }
      }
    }
  };

  // Register all event listeners
  attachEventListeners = (container: HTMLDivElement) => {
    container.addEventListener('beforeinput', this.handleBeforeInput);
    container.addEventListener('keydown', this.handleKeyDown);
    container.addEventListener('compositionstart', this.handleCompositionStart);
    container.addEventListener('compositionend', this.handleCompositionEnd);
    container.addEventListener('paste', this.handlePaste);

    // Selection change needs to be on document
    document.addEventListener('selectionchange', this.handleSelectionChange);
  };

  // Remove all event listeners
  detachEventListeners = (container: HTMLDivElement) => {
    container.removeEventListener('beforeinput', this.handleBeforeInput);
    container.removeEventListener('keydown', this.handleKeyDown);
    container.removeEventListener('compositionstart', this.handleCompositionStart);
    container.removeEventListener('compositionend', this.handleCompositionEnd);
    container.removeEventListener('paste', this.handlePaste);

    document.removeEventListener('selectionchange', this.handleSelectionChange);
  };
}
