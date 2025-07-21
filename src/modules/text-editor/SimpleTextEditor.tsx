import { createSignal, onMount, onCleanup, createEffect, untrack, createMemo } from 'solid-js';
import { TextEditorState } from './TextEditorState';
import { ParagraphSelection } from './TextEditorModel';
import { TextEditorEvents } from './TextEditorEvents';
import { restoreSelection } from './TextEditorRenderUtils';
import { logger, LOG_CATEGORIES, logEffect } from '~/utils/logger';
import { Key } from '@solid-primitives/keyed';
import {
  ExternalAnnotation,
  TextEditorAnnotationManager,
  AnnotationOverlay
} from './TextEditorAnnotations';

// Re-export for external use
export type { ExternalAnnotation };

interface TextEditorProps {
  initialContent?: string;
  placeholder?: string;
  readonly?: boolean;
  class?: string;
  annotations?: ExternalAnnotation[];
  onContentChange?: (content: string) => void;
  onAnnotationHover?: (annotation: ExternalAnnotation | null) => void;
  onSuggestionTrigger?: () => void;
  hideControls?: boolean;
  hideDebug?: boolean;
  ref?: (el: any) => void;
}

let editorInstanceCount = 0;

export default function SimpleTextEditor(props: TextEditorProps) {
  let editorContainerRef: HTMLDivElement | undefined;
  let blockRefs: HTMLDivElement[] = [];

  // Create unique instance ID for this editor
  const instanceId = ++editorInstanceCount;
  const isReadonly = props.readonly || false;

  logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, `SimpleTextEditor #${instanceId} component created`, {
    readonly: isReadonly,
    initialContent: props.initialContent?.slice(0, 50)
  });

  // Create editor state instance
  const editorState = new TextEditorState(instanceId);

  // Expose editor methods through ref
  if (props.ref) {
    props.ref({
      undo: () => editorState.undo(),
      redo: () => editorState.redo(),
      clear: () => editorState.clear(),
      canUndo: () => editorState.canUndo(),
      canRedo: () => editorState.canRedo()
    });
  }

  // Create annotation manager with editor state
  const annotationManager = new TextEditorAnnotationManager(editorState, props.onAnnotationHover);

  // Sync external annotations when props change
  createEffect(() => {
    const externalAnnotations = props.annotations || [];
    annotationManager.syncExternalAnnotations(externalAnnotations);
  });

  // Track selection position before composition starts for Unicode input
  const [preCompositionSelection, setPreCompositionSelection] = createSignal<ParagraphSelection | null>(null);


  // Create event handler instance
  const eventHandler = new TextEditorEvents(
    instanceId,
    editorState,
    { readonly: isReadonly, placeholder: props.placeholder, onSuggestionTrigger: props.onSuggestionTrigger },
    () => editorContainerRef,
    () => blockRefs,
    preCompositionSelection,
    setPreCompositionSelection
  );

  // Initialize content
  onMount(() => {
    logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, 'SimpleTextEditor onMount', {
      hasInitialContent: !!props.initialContent,
      readonly: props.readonly
    });

    if (props.initialContent) {
      logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, 'Loading initial content', { content: props.initialContent.slice(0, 50) });
      editorState.loadDocument(props.initialContent);
    }

    // Focus first paragraph if not readonly
    if (!props.readonly && blockRefs[0]) {
      blockRefs[0].focus();
      logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, 'Editor focused');
    }
  });

  // Watch for content changes and notify parent
  createEffect(() => {
    logEffect(LOG_CATEGORIES.EDITOR_SYNC, `content-sync-effect #${instanceId}`);

    const blocks = editorState.blocks();

    logger.debug(LOG_CATEGORIES.EDITOR_SYNC, `#${instanceId} Content effect triggered`, {
      blockCount: blocks.length,
      hasContainerRef: !!editorContainerRef,
      readonly: isReadonly
    });

    // Notify parent of content changes (untracked to prevent reactive loops)
    if (props.onContentChange) {
      logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, `#${instanceId} Notifying parent of content change`);
      untrack(() => {
        props.onContentChange!(editorState.content());
      });
    }
  });

  // Add event listeners
  onMount(() => {
    if (editorContainerRef) {
      eventHandler.attachEventListeners(editorContainerRef);
    }
  });

  // Cleanup
  onCleanup(() => {
    if (editorContainerRef) {
      eventHandler.detachEventListeners(editorContainerRef);
    }
    // Cleanup annotation manager
    annotationManager.destroy();
  });

  const containerClasses = () => {
    const baseClasses = "h-full w-full";
    const readonlyClasses = props.readonly ? "bg-gray-50" : "bg-white";
    const customClasses = props.class || "";

    return `${baseClasses} ${readonlyClasses} ${customClasses}`;
  };

  const paragraphClasses = () => {
    const baseClasses = "editor-paragraph p-t-2 p-x-2 focus:outline-none max-w-4xl mx-auto";
    const readonlyClasses = props.readonly ? "cursor-default" : "";

    return `${baseClasses} ${readonlyClasses}`;
  };

  return (
    <div class="text-editor-container space-y-4">
      <div
        ref={editorContainerRef}
        class={containerClasses()}
        role="textbox"
        aria-multiline="true"
        aria-readonly={props.readonly}
        style={{
          "white-space": "pre-wrap",
          "word-wrap": "break-word"
        }}
      >
        <Key each={editorState.blocks()} by="id" fallback={<div>No content</div>}>
          {(block, index) => {
            const isFirstEmpty = () => index() === 0 && block().content === '';
            let elementRef: HTMLDivElement;

            // Reactive selection restoration
            createEffect(() => {
              const stateSelection = editorState.selection();
              if (stateSelection && !props.readonly && elementRef) {
                // Only restore selection if this block is involved in the selection
                if (index() >= stateSelection.startParagraph && index() <= stateSelection.endParagraph) {
                  logger.debug(LOG_CATEGORIES.EDITOR_DOM, `#${instanceId} Restoring selection for block ${index()}`, stateSelection);
                  restoreSelection(stateSelection, editorContainerRef, blockRefs, instanceId);
                }
              }
            });

            return (
              <div
                ref={(el) => {
                  if (el) {
                    elementRef = el;
                    blockRefs[index()] = el;
                  }
                }}
                contentEditable={!props.readonly}
                class={`${paragraphClasses()} relative`}
                data-paragraph-index={index()}
                data-paragraph-id={block().id}
                spellcheck={false}
                style={{
                  "min-height": isFirstEmpty() ? "1.5em" : "auto"
                }}
              >
                {isFirstEmpty() && props.placeholder ? props.placeholder : block().content}
                {/* Annotation overlay */}
                <AnnotationOverlay
                  paragraphIndex={index()}
                  annotationManager={annotationManager}
                  blockRefs={blockRefs}
                />
              </div>
            );
          }}
        </Key>
      </div>

      {/* Control panel */}
      {!props.hideControls && (
        <div class="flex flex-wrap gap-2 text-sm">
          <button
            onClick={() => editorState.undo()}
            disabled={!editorState.canUndo()}
            class="px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed rounded border"
          >
            Undo
          </button>
          <button
            onClick={() => editorState.redo()}
            disabled={!editorState.canRedo()}
            class="px-3 py-1 bg-blue-100 hover:bg-blue-200 disabled:opacity-50 disabled:cursor-not-allowed rounded border"
          >
            Redo
          </button>
          <button
            onClick={() => editorState.clear()}
            disabled={props.readonly}
            class="px-3 py-1 bg-red-100 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed rounded border"
          >
            Clear
          </button>
        </div>
      )}

      {/* Debug info */}
      {!props.hideDebug && (
        <div class="text-xs text-gray-500 space-y-1 bg-gray-50 p-2 rounded">
          <div>Characters: {editorState.content().length}</div>
          <div>Blocks: {editorState.blocks().length}</div>
          <div>Version: {editorState.version()}</div>
          <div>
            Selection: {
              editorState.selection() ?
                `P${editorState.selection()!.startParagraph}:${editorState.selection()!.startOffset}-P${editorState.selection()!.endParagraph}:${editorState.selection()!.endOffset}` :
                'None'
            }
          </div>
          <div>Nodes: {editorState.nodes().length}</div>
          <div>Can Undo: {editorState.canUndo() ? 'Yes' : 'No'}</div>
          <div>Can Redo: {editorState.canRedo() ? 'Yes' : 'No'}</div>
          <div>Has Changes: {editorState.hasUnsavedChanges() ? 'Yes' : 'No'}</div>

          {/* Annotation info */}
          <div>Annotations: {annotationManager.getInternalAnnotations().length}</div>
          <div>Hovered: {annotationManager.getHoveredAnnotation()?.id || 'None'}</div>

          {/* JSON State Representation */}
          <div class="mt-3 pt-2 border-t border-gray-300">
            <div class="font-semibold mb-2">State JSON:</div>
            <pre class="bg-white p-2 rounded border text-xs overflow-auto max-h-40 whitespace-pre-wrap font-mono">
              {JSON.stringify(editorState.toJSON(), null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
