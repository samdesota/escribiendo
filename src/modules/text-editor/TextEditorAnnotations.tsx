import { Key } from '@solid-primitives/keyed';
import { createSignal, createMemo, Accessor, createEffect, Show, createRenderEffect, onMount, onCleanup, on } from 'solid-js';
import { createApp } from 'vinxi';
import { logger, LOG_CATEGORIES } from '~/utils/logger';
import { createAtom, type EnhancedAccessor } from '~/utils/signal';
import type { TextEditorState } from './TextEditorState';

// Text edit event types
export interface TextEditEvent {
  type: 'insert' | 'delete' | 'replace';
  startParagraph: number;
  startOffset: number;
  endParagraph: number;
  endOffset: number;
  insertedText?: string; // For insert and replace operations
  deletedText?: string;  // For delete and replace operations
  version: number;       // Document version after the edit
}



// External annotation interface (passed as props)
export interface ExternalAnnotation {
  id: string;
  startParagraph: number;
  startOffset: number;
  endParagraph: number;
  endOffset: number;
  color: string;
  description: string;
}

// Internal annotation interface (with adjusted positions)
export interface InternalAnnotation extends ExternalAnnotation {
  originalId: string; // Maps back to external annotation
}

// Annotation manager class to handle annotation state and operations
export class TextEditorAnnotationManager {
  private internalAnnotations: EnhancedAccessor<InternalAnnotation[]> = createAtom<InternalAnnotation[]>([]);
  private hoveredAnnotation: EnhancedAccessor<ExternalAnnotation | null> = createAtom<ExternalAnnotation | null>(null);
  private onAnnotationHover?: (annotation: ExternalAnnotation | null) => void;
  private unsubscribeTextEditEvent?: () => void;

  constructor(
    editorState?: TextEditorState,
    onAnnotationHover?: (annotation: ExternalAnnotation | null) => void
  ) {
    this.onAnnotationHover = onAnnotationHover;

    // Register text edit event listener if editorState is provided
    if (editorState) {
      this.unsubscribeTextEditEvent = editorState.textEditEvent.on(this.handleTextEditEvent);
      logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, 'Annotation manager registered to text edit events');
    }
  }

  // Cleanup method to unsubscribe from events
  destroy() {
    if (this.unsubscribeTextEditEvent) {
      this.unsubscribeTextEditEvent();
      this.unsubscribeTextEditEvent = undefined;
      logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, 'Annotation manager unsubscribed from text edit events');
    }
  }

  // Getters for reactive access
  getInternalAnnotations = () => this.internalAnnotations();
  getHoveredAnnotation = () => this.hoveredAnnotation();

  // Sync external annotations to internal state
  syncExternalAnnotations(externalAnnotations: ExternalAnnotation[]) {
    logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, `Syncing ${externalAnnotations.length} external annotations`);

    this.internalAnnotations.set(externalAnnotations.map(annotation => ({
      ...annotation,
      originalId: annotation.id
    })));
  }

  // Handle annotation hover
  handleAnnotationHover = (annotation: ExternalAnnotation | null) => {
    this.hoveredAnnotation.set(annotation);
    if (this.onAnnotationHover) {
      this.onAnnotationHover(annotation);
    }
  };

  // Listen to text edit events and update annotation positions
  handleTextEditEvent = (event: TextEditEvent) => {
    logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, 'Handling text edit event for annotations', event);

    const currentAnnotations = this.internalAnnotations();
    if (currentAnnotations.length === 0) return;

    const updatedAnnotations = currentAnnotations.map(annotation =>
      this.adjustAnnotationPositionFromEvent(annotation, event)
    ).filter(annotation => annotation !== null) as InternalAnnotation[];

    this.internalAnnotations.set(updatedAnnotations);
  };

  // Adjust annotation position based on a text edit event
  private adjustAnnotationPositionFromEvent(
    annotation: InternalAnnotation,
    event: TextEditEvent
  ): InternalAnnotation | null {
    const newAnnotation = { ...annotation };

    // Helper to adjust a single position based on the edit event
    const adjustPosition = (paragraphIndex: number, offset: number) => {
      // Handle different types of edits
      switch (event.type) {
        case 'insert':
          return this.adjustPositionForInsert(
            paragraphIndex,
            offset,
            event.startParagraph,
            event.startOffset,
            event.insertedText || ''
          );

        case 'delete':
          return this.adjustPositionForDelete(
            paragraphIndex,
            offset,
            event.startParagraph,
            event.startOffset,
            event.endParagraph,
            event.endOffset
          );

        case 'replace':
          // For replace, first apply delete then insert
          const afterDelete = this.adjustPositionForDelete(
            paragraphIndex,
            offset,
            event.startParagraph,
            event.startOffset,
            event.endParagraph,
            event.endOffset
          );
          return this.adjustPositionForInsert(
            afterDelete.paragraphIndex,
            afterDelete.offset,
            event.startParagraph,
            event.startOffset,
            event.insertedText || ''
          );

        default:
          return { paragraphIndex, offset };
      }
    };

    const newStart = adjustPosition(newAnnotation.startParagraph, newAnnotation.startOffset);
    const newEnd = adjustPosition(newAnnotation.endParagraph, newAnnotation.endOffset);

    // If the annotation was completely deleted, return null to remove it
    if (newStart.paragraphIndex === newEnd.paragraphIndex && newStart.offset === newEnd.offset) {
      logger.debug(LOG_CATEGORIES.EDITOR_COMPONENT, `Annotation ${annotation.id} was completely deleted`, annotation);
      return null;
    }

    return {
      ...newAnnotation,
      startParagraph: newStart.paragraphIndex,
      startOffset: newStart.offset,
      endParagraph: newEnd.paragraphIndex,
      endOffset: newEnd.offset
    };
  }

  // Adjust position for text insertion
  private adjustPositionForInsert(
    paragraphIndex: number,
    offset: number,
    insertParagraph: number,
    insertOffset: number,
    insertedText: string
  ) {
    const linesInserted = insertedText.split('\n');
    const paragraphsInserted = linesInserted.length - 1;
    const lastLineLength = linesInserted[linesInserted.length - 1].length;

    // If position is before the insertion point, no change needed
    if (paragraphIndex < insertParagraph ||
      (paragraphIndex === insertParagraph && offset < insertOffset)) {
      return { paragraphIndex, offset };
    }

    // If insertion creates new paragraphs
    if (paragraphsInserted > 0) {
      if (paragraphIndex === insertParagraph) {
        // Position is in the same paragraph as insertion
        if (offset >= insertOffset) {
          // Position is after insertion point
          return {
            paragraphIndex: paragraphIndex + paragraphsInserted,
            offset: offset - insertOffset + lastLineLength
          };
        }
      } else {
        // Position is in a later paragraph
        return {
          paragraphIndex: paragraphIndex + paragraphsInserted,
          offset
        };
      }
    } else {
      // Single line insertion
      if (paragraphIndex === insertParagraph && offset >= insertOffset) {
        return {
          paragraphIndex,
          offset: offset + insertedText.length
        };
      }
    }

    return { paragraphIndex, offset };
  }

  // Adjust position for text deletion
  private adjustPositionForDelete(
    paragraphIndex: number,
    offset: number,
    deleteStartParagraph: number,
    deleteStartOffset: number,
    deleteEndParagraph: number,
    deleteEndOffset: number
  ) {
    // If position is before the deletion range, no change needed
    if (paragraphIndex < deleteStartParagraph ||
      (paragraphIndex === deleteStartParagraph && offset < deleteStartOffset)) {
      return { paragraphIndex, offset };
    }

    // If position is after the deletion range
    if (paragraphIndex > deleteEndParagraph ||
      (paragraphIndex === deleteEndParagraph && offset > deleteEndOffset)) {

      const paragraphsDeleted = deleteEndParagraph - deleteStartParagraph;

      if (paragraphsDeleted > 0) {
        // Multi-paragraph deletion
        if (paragraphIndex === deleteEndParagraph) {
          // Position is in the same paragraph as deletion end
          return {
            paragraphIndex: deleteStartParagraph,
            offset: deleteStartOffset + (offset - deleteEndOffset)
          };
        } else {
          // Position is in a later paragraph
          return {
            paragraphIndex: paragraphIndex - paragraphsDeleted,
            offset
          };
        }
      } else {
        // Single paragraph deletion
        return {
          paragraphIndex,
          offset: offset - (deleteEndOffset - deleteStartOffset)
        };
      }
    }

    // Position is within the deleted range - move to start of deletion
    return {
      paragraphIndex: deleteStartParagraph,
      offset: deleteStartOffset
    };
  }

  // Get annotations organized by paragraph
  getAnnotationsForParagraph = createMemo(() => {
    const annotations = this.internalAnnotations();
    const paragraphAnnotations: Record<number, InternalAnnotation[]> = {};

    annotations.forEach(annotation => {
      for (let i = annotation.startParagraph; i <= annotation.endParagraph; i++) {
        if (!paragraphAnnotations[i]) {
          paragraphAnnotations[i] = [];
        }
        paragraphAnnotations[i].push(annotation);
      }
    });

    return paragraphAnnotations;
  });
}

// Annotation overlay component
export function AnnotationOverlay(props: {
  paragraphIndex: number;
  annotationManager: TextEditorAnnotationManager;
  blockRefs: HTMLDivElement[];
}) {
  const paragraphAnnotations = () => props.annotationManager.getAnnotationsForParagraph()[props.paragraphIndex] || [];
  const mounted = createAtom(false);

  onMount(() => {
    mounted.set(true)
  });

  onCleanup(() => {
    mounted.set(false)
    console.log('unmounted');
  });

  createEffect(() => {
    console.log(paragraphAnnotations());
  });

  return (
    <div class="absolute inset-0 pointer-events-none">
      <Key each={paragraphAnnotations()} by="id">
        {(annotation, index) => {
          // Calculate the visual position of the annotation within this paragraph
          const location = createAtom<{ left: number, top: number, width: number, height: number } | null>(null);

          createRenderEffect(() => {
            if (!mounted()) return null;
            const paragraphRef = props.blockRefs[props.paragraphIndex];
            if (!paragraphRef) return null;

            // Create a temporary range to measure text position
            const range = document.createRange();
            const textNode = Array.from(paragraphRef.childNodes).find(node => node.nodeType === Node.TEXT_NODE);

            if (!textNode) return null;
            const startOffset = annotation().startParagraph === props.paragraphIndex ? annotation().startOffset : 0;
            const endOffset = annotation().endParagraph === props.paragraphIndex ? annotation().endOffset : paragraphRef.textContent?.length || 0;

            range.setStart(textNode, Math.min(startOffset, textNode.textContent?.length || 0));
            range.setEnd(textNode, Math.min(endOffset, textNode.textContent?.length || 0));

            const rect = range.getBoundingClientRect();
            const paragraphRect = paragraphRef.getBoundingClientRect();

            location.set({
              left: rect.left - paragraphRect.left,
              top: rect.top - paragraphRect.top,
              width: rect.width,
              height: rect.height
            });
          });


          const externalAnnotation: () => ExternalAnnotation = () => ({
            id: annotation().originalId,
            startParagraph: annotation().startParagraph,
            startOffset: annotation().startOffset,
            endParagraph: annotation().endParagraph,
            endOffset: annotation().endOffset,
            color: annotation().color,
            description: annotation().description
          });

          return (
            <Show when={location()}>
              {(location) => (
                console.log(location()),
                <div
                  class="absolute pointer-events-auto cursor-pointer"
                  style={{
                    left: `${location().left}px`,
                    top: `${location().top}px`,
                    width: `${location().width}px`,
                    height: `${location().height}px`,
                    "border-bottom": `2px solid ${annotation().color}`,
                    "z-index": "1"
                  }}
                  onMouseEnter={() => props.annotationManager.handleAnnotationHover(externalAnnotation())}
                  onMouseLeave={() => props.annotationManager.handleAnnotationHover(null)}
                  title={annotation().description}
                />
              )}
            </Show>
          );

        }}
      </Key>
    </div>
  );
}
