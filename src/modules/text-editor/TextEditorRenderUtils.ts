import { ParagraphSelection } from './TextEditorModel';
import { logger, LOG_CATEGORIES } from '~/utils/logger';

/**
 * Restore selection to DOM based on paragraph coordinates
 */
export function restoreSelection(
  selection: ParagraphSelection,
  editorContainerRef: HTMLDivElement | undefined,
  blockRefs: HTMLDivElement[],
  instanceId: number
) {
  if (!editorContainerRef) return;

  const startParagraph = blockRefs[selection.startParagraph];
  const endParagraph = blockRefs[selection.endParagraph];

  if (!startParagraph || !endParagraph) return;

  const domSelection = window.getSelection();
  if (!domSelection) return;

  const range = document.createRange();

  try {
    // Find start position within start paragraph
    const startWalker = document.createTreeWalker(
      startParagraph,
      NodeFilter.SHOW_TEXT,
      null
    );

    let currentOffset = 0;
    let startNode: Node | null = null;
    let startOffset = 0;

    let node;
    while (node = startWalker.nextNode()) {
      const nodeLength = node.textContent?.length || 0;
      if (currentOffset + nodeLength >= selection.startOffset) {
        startNode = node;
        startOffset = selection.startOffset - currentOffset;
        break;
      }
      currentOffset += nodeLength;
    }

    if (!startNode) {
      startNode = startParagraph;
      startOffset = 0;
    }

    // Find end position within end paragraph
    let endNode: Node | null = null;
    let endOffset = 0;

    if (selection.isCollapsed) {
      endNode = startNode;
      endOffset = startOffset;
    } else {
      const endWalker = document.createTreeWalker(
        endParagraph,
        NodeFilter.SHOW_TEXT,
        null
      );

      currentOffset = 0;
      while (node = endWalker.nextNode()) {
        const nodeLength = node.textContent?.length || 0;
        if (currentOffset + nodeLength >= selection.endOffset) {
          endNode = node;
          endOffset = selection.endOffset - currentOffset;
          break;
        }
        currentOffset += nodeLength;
      }

      if (!endNode) {
        endNode = endParagraph;
        endOffset = 0;
      }
    }

    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    domSelection.removeAllRanges();
    domSelection.addRange(range);

    logger.debug(LOG_CATEGORIES.EDITOR_DOM, `#${instanceId} Selection restored`, selection);
  } catch (error) {
    logger.warn(LOG_CATEGORIES.EDITOR_DOM, `#${instanceId} Failed to restore selection`, { error, selection });
  }
}
