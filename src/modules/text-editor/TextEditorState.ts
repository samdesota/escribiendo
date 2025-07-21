import { createSignal, createMemo, createEffect } from 'solid-js';
import { DocumentModel, type TextEditorDocument, type ParagraphSelection, type ContentNode } from './TextEditorModel';
import { logger, LOG_CATEGORIES, logMethodCall } from '~/utils/logger';
import type { TextEditEvent } from './TextEditorAnnotations';
import { createEvent, type EventEmitter } from '~/utils/signal';

export interface TextEditorAction {
  type: 'insert' | 'delete' | 'format' | 'annotate';
  timestamp: number;
  payload: any;
}

export class TextEditorState {
  private instanceId: number;
  private document = createSignal<TextEditorDocument>(DocumentModel.createEmpty());
  private history = createSignal<TextEditorDocument[]>([]);
  private historyIndex = createSignal(-1);
  private isComposing = createSignal(false);
  private isDirty = createSignal(false);
  // Text edit event emitter
  public textEditEvent: EventEmitter<TextEditEvent> = createEvent<TextEditEvent>();

  private getDocument = () => this.document[0]();
  private setDocument = (doc: TextEditorDocument) => {
    const oldDoc = this.document[0]();
    logger.debug(LOG_CATEGORIES.EDITOR_STATE, `#${this.instanceId} setDocument called`, {
      oldVersion: oldDoc.version,
      oldBlocks: oldDoc.blocks.length,
      oldContent: DocumentModel.getFullText(oldDoc).slice(0, 50),
      newVersion: doc.version,
      newBlocks: doc.blocks.length,
      newContent: DocumentModel.getFullText(doc).slice(0, 50),
      contentChanged: DocumentModel.getFullText(oldDoc) !== DocumentModel.getFullText(doc)
    });
    this.document[1](doc);
  };
  private getHistory = () => this.history[0]();
  private setHistory = (history: TextEditorDocument[]) => this.history[1](history);
  private getHistoryIndex = () => this.historyIndex[0]();
  private setHistoryIndex = (index: number) => this.historyIndex[1](index);
  private getIsComposing = () => this.isComposing[0]();
  private setIsComposing = (composing: boolean) => this.isComposing[1](composing);
  private getIsDirty = () => this.isDirty[0]();
  private setIsDirty = (dirty: boolean) => this.isDirty[1](dirty);

    constructor(instanceId: number = 0) {
    this.instanceId = instanceId;
    logger.debug(LOG_CATEGORIES.EDITOR_STATE, `#${this.instanceId} TextEditorState constructor called`);

    // Initialize history with empty document
    const emptyDoc = DocumentModel.createEmpty();
    logger.debug(LOG_CATEGORIES.EDITOR_STATE, `#${this.instanceId} Initializing with empty document`, emptyDoc);

    this.setHistory([emptyDoc]);
    this.setHistoryIndex(0);

    // Track changes for dirty state
    createEffect(() => {
      logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'Dirty state effect triggered');
      const doc = this.getDocument();
      const wasDirty = this.getIsDirty();
      const newDirty = doc.version > 0;

      if (wasDirty !== newDirty) {
        logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Setting dirty state', { from: wasDirty, to: newDirty, version: doc.version });
        this.setIsDirty(newDirty);
      }
    });

    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'TextEditorState constructor completed');
  }



  // Simple reactive getters - these are memos that can be called directly
  content = createMemo(() => {
    const content = DocumentModel.getFullText(this.getDocument());
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, `#${this.instanceId} Content memo computed`, {
      length: content.length,
      content: content.slice(0, 50) + (content.length > 50 ? '...' : ''),
      fullContent: content
    });
    return content;
  });

  blocks = createMemo(() => {
    const blocks = this.getDocument().blocks;
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, `#${this.instanceId} Blocks memo computed`, {
      count: blocks.length
    });
    return blocks;
  });

  selection = createMemo(() => {
    const selection = this.getDocument().selection;
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'Selection memo computed', selection);
    return selection;
  });

  nodes = createMemo(() => {
    const nodes = this.getDocument().nodes;
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'Nodes memo computed', { count: nodes.length });
    return nodes;
  });

  version = createMemo(() => {
    const version = this.getDocument().version;
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'Version memo computed', version);
    return version;
  });

  canUndo = createMemo(() => {
    const canUndo = this.getHistoryIndex() > 0;
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'CanUndo memo computed', canUndo);
    return canUndo;
  });

  canRedo = createMemo(() => {
    const canRedo = this.getHistoryIndex() < this.getHistory().length - 1;
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'CanRedo memo computed', canRedo);
    return canRedo;
  });

  isComposingText = createMemo(() => {
    const composing = this.getIsComposing();
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'IsComposingText memo computed', composing);
    return composing;
  });

  hasUnsavedChanges = createMemo(() => {
    const hasChanges = this.getIsDirty();
    logger.debug(LOG_CATEGORIES.EDITOR_SIGNALS, 'HasUnsavedChanges memo computed', hasChanges);
    return hasChanges;
  });

  // Core operations - now work with paragraph coordinates
  insertText(text: string, paragraphIndex: number, offset: number): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'insertText', [text, paragraphIndex, offset]);

    if (this.getIsComposing()) {
      logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'insertText ignored - composing');
      return;
    }

    const currentDoc = this.getDocument();

    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Inserting text', {
      text,
      paragraphIndex,
      offset,
      currentVersion: currentDoc.version,
      blockCount: currentDoc.blocks.length
    });

    const newDoc = DocumentModel.insertText(currentDoc, text, paragraphIndex, offset);
    this.updateDocument(newDoc);

    // Emit text edit event
    this.textEditEvent.emit({
      type: 'insert',
      startParagraph: paragraphIndex,
      startOffset: offset,
      endParagraph: paragraphIndex,
      endOffset: offset,
      insertedText: text,
      version: newDoc.version
    });
  }

  deleteText(startParagraph: number, startOffset: number, endParagraph: number, endOffset: number): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'deleteText', [startParagraph, startOffset, endParagraph, endOffset]);

    if (this.getIsComposing()) {
      logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'deleteText ignored - composing');
      return;
    }

    const currentDoc = this.getDocument();

    // Get the text that will be deleted for the event
    const deletedText = this.getTextInRange(startParagraph, startOffset, endParagraph, endOffset);

    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Deleting text', {
      startParagraph,
      startOffset,
      endParagraph,
      endOffset,
      currentVersion: currentDoc.version,
      deletedText
    });

    const newDoc = DocumentModel.deleteText(currentDoc, startParagraph, startOffset, endParagraph, endOffset);
    this.updateDocument(newDoc);

    // Emit text edit event
    this.textEditEvent.emit({
      type: 'delete',
      startParagraph,
      startOffset,
      endParagraph,
      endOffset,
      deletedText,
      version: newDoc.version
    });
  }

  replaceText(startParagraph: number, startOffset: number, endParagraph: number, endOffset: number, newText: string): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'replaceText', [startParagraph, startOffset, endParagraph, endOffset, newText]);

    if (this.getIsComposing()) {
      logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'replaceText ignored - composing');
      return;
    }

    const currentDoc = this.getDocument();

    // Get the text that will be replaced for the event
    const deletedText = this.getTextInRange(startParagraph, startOffset, endParagraph, endOffset);

    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Replacing text', {
      startParagraph,
      startOffset,
      endParagraph,
      endOffset,
      newText,
      deletedText,
      currentVersion: currentDoc.version
    });

    let newDoc = DocumentModel.deleteText(currentDoc, startParagraph, startOffset, endParagraph, endOffset);
    newDoc = DocumentModel.insertText(newDoc, newText, startParagraph, startOffset);
    this.updateDocument(newDoc);

    // Emit text edit event
    this.textEditEvent.emit({
      type: 'replace',
      startParagraph,
      startOffset,
      endParagraph,
      endOffset,
      insertedText: newText,
      deletedText,
      version: newDoc.version
    });
  }

  updateSelection(selection: ParagraphSelection | null): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'updateSelection', [selection]);

    const currentDoc = this.getDocument();
    const oldSelection = currentDoc.selection;

    if (JSON.stringify(oldSelection) !== JSON.stringify(selection)) {
      logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Updating selection', {
        from: oldSelection,
        to: selection
      });

      const newDoc = DocumentModel.updateSelection(currentDoc, selection);
      this.setDocument(newDoc);
    } else {
      logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Selection update skipped - no change');
    }
  }

  addAnnotation(paragraphIndex: number, start: number, end: number, type: string, metadata?: Record<string, any>): void {
    const currentDoc = this.getDocument();
    const newDoc = DocumentModel.addAnnotation(currentDoc, paragraphIndex, start, end, type, metadata);
    this.updateDocument(newDoc);
  }

  splitParagraph(paragraphIndex: number, offset: number): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'splitParagraph', [paragraphIndex, offset]);

    const currentDoc = this.getDocument();
    const newDoc = DocumentModel.splitParagraph(currentDoc, paragraphIndex, offset);
    this.updateDocument(newDoc);
  }

  mergeParagraphs(firstIndex: number, secondIndex: number): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'mergeParagraphs', [firstIndex, secondIndex]);

    const currentDoc = this.getDocument();
    const newDoc = DocumentModel.mergeParagraphs(currentDoc, firstIndex, secondIndex);
    this.updateDocument(newDoc);
  }

  // History management
  private updateDocument(newDoc: TextEditorDocument): void {
    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'updateDocument called', {
      oldVersion: this.getDocument().version,
      newVersion: newDoc.version
    });

    this.setDocument(newDoc);
    this.addToHistory(newDoc);
  }

  private addToHistory(doc: TextEditorDocument): void {
    logger.debug(LOG_CATEGORIES.EDITOR_HISTORY, 'Adding to history', { version: doc.version });

    const currentHistory = this.getHistory();
    const currentIndex = this.getHistoryIndex();

    // Remove any future history if we're not at the end
    const newHistory = currentHistory.slice(0, currentIndex + 1);
    newHistory.push(doc);

    logger.debug(LOG_CATEGORIES.EDITOR_HISTORY, 'History state', {
      oldIndex: currentIndex,
      newHistoryLength: newHistory.length
    });

    // Limit history size
    const maxHistorySize = 100;
    if (newHistory.length > maxHistorySize) {
      newHistory.shift();
      logger.debug(LOG_CATEGORIES.EDITOR_HISTORY, 'History size limited, removed oldest entry');
    } else {
      this.setHistoryIndex(currentIndex + 1);
    }

    this.setHistory(newHistory);
  }

  undo(): boolean {
    logMethodCall(LOG_CATEGORIES.EDITOR_HISTORY, 'undo');

    if (!this.canUndo()) {
      logger.debug(LOG_CATEGORIES.EDITOR_HISTORY, 'Cannot undo - at beginning of history');
      return false;
    }

    const newIndex = this.getHistoryIndex() - 1;
    logger.debug(LOG_CATEGORIES.EDITOR_HISTORY, 'Undoing', { from: this.getHistoryIndex(), to: newIndex });

    this.setHistoryIndex(newIndex);
    this.setDocument(this.getHistory()[newIndex]);
    return true;
  }

  redo(): boolean {
    logMethodCall(LOG_CATEGORIES.EDITOR_HISTORY, 'redo');

    if (!this.canRedo()) {
      logger.debug(LOG_CATEGORIES.EDITOR_HISTORY, 'Cannot redo - at end of history');
      return false;
    }

    const newIndex = this.getHistoryIndex() + 1;
    logger.debug(LOG_CATEGORIES.EDITOR_HISTORY, 'Redoing', { from: this.getHistoryIndex(), to: newIndex });

    this.setHistoryIndex(newIndex);
    this.setDocument(this.getHistory()[newIndex]);
    return true;
  }

  // Composition handling for IME input
  startComposition(): void {
    this.setIsComposing(true);
  }

  endComposition(): void {
    this.setIsComposing(false);
  }

  // Utility methods
  getNodesInParagraph(paragraphIndex: number): ContentNode[] {
    return DocumentModel.getNodesInParagraph(this.getDocument(), paragraphIndex);
  }

  getTextInRange(startParagraph: number, startOffset: number, endParagraph: number, endOffset: number): string {
    const doc = this.getDocument();

    if (startParagraph === endParagraph) {
      const paragraph = doc.blocks[startParagraph];
      return paragraph ? paragraph.content.slice(startOffset, endOffset) : '';
    }

    let result = '';
    for (let i = startParagraph; i <= endParagraph; i++) {
      const paragraph = doc.blocks[i];
      if (!paragraph) continue;

      if (i === startParagraph) {
        result += paragraph.content.slice(startOffset);
      } else if (i === endParagraph) {
        result += '\n' + paragraph.content.slice(0, endOffset);
      } else {
        result += '\n' + paragraph.content;
      }
    }
    return result;
  }

  getSelectionText(): string {
    const selection = this.getDocument().selection;
    if (!selection || selection.isCollapsed) return '';
    return this.getTextInRange(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset);
  }

  // Load/save operations
  loadDocument(content: string, nodes: ContentNode[] = []): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'loadDocument', [content.slice(0, 50), nodes]);

    // Split content into paragraphs
    const lines = content.split('\n');
    const blocks = lines.map(line => ({
      id: DocumentModel.generateId(),
      content: line,
      type: 'paragraph' as const
    }));

    const newDoc: TextEditorDocument = {
      blocks,
      nodes,
      selection: null,
      version: 0
    };

    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Loading new document', {
      contentLength: content.length,
      blockCount: blocks.length,
      nodesCount: nodes.length,
      oldVersion: this.getDocument().version
    });

    this.setDocument(newDoc);
    this.setHistory([newDoc]);
    this.setHistoryIndex(0);
    this.setIsDirty(false);

    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Document loaded successfully');
  }

  exportDocument(): TextEditorDocument {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'exportDocument');
    return { ...this.getDocument() };
  }

  clear(): void {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'clear');

    const emptyDoc = DocumentModel.createEmpty();
    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Clearing document', {
      oldContentLength: DocumentModel.getFullText(this.getDocument()).length
    });

    this.setDocument(emptyDoc);
    this.setHistory([emptyDoc]);
    this.setHistoryIndex(0);
    this.setIsDirty(false);

    logger.debug(LOG_CATEGORIES.EDITOR_STATE, 'Document cleared successfully');
  }

  markAsSaved(): void {
    this.setIsDirty(false);
  }

  // JSON representation for debugging and serialization
  toJSON(): object {
    logMethodCall(LOG_CATEGORIES.EDITOR_STATE, 'toJSON');

    const currentDoc = this.getDocument();

    return {
      blocks: currentDoc.blocks,
      blockCount: currentDoc.blocks.length,
      nodes: currentDoc.nodes,
      nodesCount: currentDoc.nodes.length,
      selection: currentDoc.selection,
      version: currentDoc.version,
      fullText: DocumentModel.getFullText(currentDoc)
    };
  }

  // Backward compatibility methods for flat position operations
  insertTextAtPosition(text: string, position: number): void {
    const doc = this.getDocument();
    const selection = DocumentModel.flatPositionToSelection(doc, position, position);
    this.insertText(text, selection.startParagraph, selection.startOffset);
  }

  deleteTextAtPositions(start: number, end: number): void {
    const doc = this.getDocument();
    const selection = DocumentModel.flatPositionToSelection(doc, start, end);
    this.deleteText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset);
  }

  replaceTextAtPositions(start: number, end: number, newText: string): void {
    const doc = this.getDocument();
    const selection = DocumentModel.flatPositionToSelection(doc, start, end);
    this.replaceText(selection.startParagraph, selection.startOffset, selection.endParagraph, selection.endOffset, newText);
  }
}
