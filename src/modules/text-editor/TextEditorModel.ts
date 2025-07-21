// Data model for text editor content

export interface ParagraphNode {
  id: string;
  content: string;
  type: 'paragraph';
}

export interface AnnotationNode {
  type: 'annotation';
  paragraphId: string;
  start: number;
  end: number;
  annotationType: string;
  metadata?: Record<string, any>;
}

export interface WidgetNode {
  type: 'widget';
  paragraphId: string;
  start: number;
  end: number;
  widgetType: string;
  props?: Record<string, any>;
}

export type ContentNode = AnnotationNode | WidgetNode;

export interface ParagraphSelection {
  startParagraph: number;
  startOffset: number;
  endParagraph: number;
  endOffset: number;
  isCollapsed: boolean;
}

export interface TextEditorDocument {
  blocks: ParagraphNode[];
  nodes: ContentNode[];
  selection: ParagraphSelection | null;
  version: number;
}

// Helper functions for working with the document model
export class DocumentModel {
  static createEmpty(): TextEditorDocument {
    return {
      blocks: [{ id: this.generateId(), content: '', type: 'paragraph' }],
      nodes: [],
      selection: null,
      version: 0
    };
  }

  static generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  // Convert document to flat text representation (for backwards compatibility)
  static getFullText(doc: TextEditorDocument): string {
    return doc.blocks.map(p => p.content).join('\n');
  }

  // Get block by index
  static getBlock(doc: TextEditorDocument, index: number): ParagraphNode | null {
    return doc.blocks[index] || null;
  }

  // Convert paragraph-based selection to flat position (for backwards compatibility)
  static selectionToFlatPosition(doc: TextEditorDocument, selection: ParagraphSelection): { start: number; end: number } {
    let start = 0;
    let end = 0;

    // Calculate start position
    for (let i = 0; i < selection.startParagraph; i++) {
      start += doc.blocks[i].content.length + 1; // +1 for newline
    }
    start += selection.startOffset;

    // Calculate end position
    end = start;
    if (!selection.isCollapsed) {
      if (selection.startParagraph === selection.endParagraph) {
        end = start + (selection.endOffset - selection.startOffset);
      } else {
        // Add remaining text from start paragraph
        end += doc.blocks[selection.startParagraph].content.length - selection.startOffset;

        // Add full paragraphs in between
        for (let i = selection.startParagraph + 1; i < selection.endParagraph; i++) {
          end += doc.blocks[i].content.length + 1; // +1 for newline
        }

        // Add text from end paragraph
        end += selection.endOffset + 1; // +1 for newline before end paragraph
      }
    }

    return { start, end };
  }

  // Convert flat position to paragraph-based coordinates
  static flatPositionToSelection(doc: TextEditorDocument, start: number, end: number): ParagraphSelection {
    let currentPos = 0;
    let startParagraph = 0;
    let startOffset = 0;
    let endParagraph = 0;
    let endOffset = 0;

    // Find start position
    for (let i = 0; i < doc.blocks.length; i++) {
      const paragraphLength = doc.blocks[i].content.length;

      if (currentPos + paragraphLength >= start) {
        startParagraph = i;
        startOffset = start - currentPos;
        break;
      }
      currentPos += paragraphLength + 1; // +1 for newline
    }

    // Find end position
    currentPos = 0;
    for (let i = 0; i < doc.blocks.length; i++) {
      const paragraphLength = doc.blocks[i].content.length;

      if (currentPos + paragraphLength >= end) {
        endParagraph = i;
        endOffset = end - currentPos;
        break;
      }
      currentPos += paragraphLength + 1; // +1 for newline
    }

    return {
      startParagraph,
      startOffset,
      endParagraph,
      endOffset,
      isCollapsed: start === end
    };
  }

  static insertText(doc: TextEditorDocument, text: string, paragraphIndex: number, offset: number): TextEditorDocument {
    if (paragraphIndex < 0 || paragraphIndex >= doc.blocks.length) {
      return doc;
    }

    const blocks = [...doc.blocks];
    const paragraph = blocks[paragraphIndex];

    // Check if text contains newlines (paragraph breaks)
    if (text.includes('\n')) {
      const lines = text.split('\n');
      const beforeText = paragraph.content.slice(0, offset);
      const afterText = paragraph.content.slice(offset);

      // Update current paragraph with text before first newline
      blocks[paragraphIndex] = {
        ...paragraph,
        content: beforeText + lines[0]
      };

      // Create new paragraphs for each line break
      const newBlocks: ParagraphNode[] = [];
      for (let i = 1; i < lines.length - 1; i++) {
        newBlocks.push({
          id: this.generateId(),
          content: lines[i],
          type: 'paragraph'
        });
      }

      // Final paragraph gets remaining text + text after insertion point
      newBlocks.push({
        id: this.generateId(),
        content: lines[lines.length - 1] + afterText,
        type: 'paragraph'
      });

      // Insert new paragraphs
      blocks.splice(paragraphIndex + 1, 0, ...newBlocks);
    } else {
      // Simple text insertion within paragraph
      blocks[paragraphIndex] = {
        ...paragraph,
        content: paragraph.content.slice(0, offset) + text + paragraph.content.slice(offset)
      };
    }

    return {
      ...doc,
      blocks,
      version: doc.version + 1
    };
  }

  static deleteText(doc: TextEditorDocument, startParagraph: number, startOffset: number, endParagraph: number, endOffset: number): TextEditorDocument {
    if (startParagraph < 0 || endParagraph >= doc.blocks.length) {
      return doc;
    }

    const blocks = [...doc.blocks];

    if (startParagraph === endParagraph) {
      // Delete within single paragraph
      const paragraph = blocks[startParagraph];
      blocks[startParagraph] = {
        ...paragraph,
        content: paragraph.content.slice(0, startOffset) + paragraph.content.slice(endOffset)
      };
    } else {
      // Delete across multiple paragraphs
      const startPara = blocks[startParagraph];
      const endPara = blocks[endParagraph];

      // Merge start and end paragraphs
      blocks[startParagraph] = {
        ...startPara,
        content: startPara.content.slice(0, startOffset) + endPara.content.slice(endOffset)
      };

      // Remove paragraphs in between and end paragraph
      blocks.splice(startParagraph + 1, endParagraph - startParagraph);
    }

    return {
      ...doc,
      blocks,
      version: doc.version + 1
    };
  }

  static updateSelection(doc: TextEditorDocument, selection: ParagraphSelection | null): TextEditorDocument {
    return {
      ...doc,
      selection,
      version: doc.version + 1
    };
  }

  static addAnnotation(
    doc: TextEditorDocument,
    paragraphIndex: number,
    start: number,
    end: number,
    annotationType: string,
    metadata?: Record<string, any>
  ): TextEditorDocument {
    const paragraph = doc.blocks[paragraphIndex];
    if (!paragraph) return doc;

    const annotation: AnnotationNode = {
      type: 'annotation',
      paragraphId: paragraph.id,
      start,
      end,
      annotationType,
      metadata
    };

    return {
      ...doc,
      nodes: [...doc.nodes, annotation],
      version: doc.version + 1
    };
  }

  static getNodesInParagraph(doc: TextEditorDocument, paragraphIndex: number): ContentNode[] {
    const paragraph = doc.blocks[paragraphIndex];
    if (!paragraph) return [];

    return doc.nodes.filter(node =>
      'paragraphId' in node && node.paragraphId === paragraph.id
    );
  }

  static splitParagraph(doc: TextEditorDocument, paragraphIndex: number, offset: number): TextEditorDocument {
    if (paragraphIndex < 0 || paragraphIndex >= doc.blocks.length) {
      return doc;
    }

    const blocks = [...doc.blocks];
    const paragraph = blocks[paragraphIndex];

    const beforeText = paragraph.content.slice(0, offset);
    const afterText = paragraph.content.slice(offset);

    // Update current paragraph
    blocks[paragraphIndex] = {
      ...paragraph,
      content: beforeText
    };

    // Create new paragraph
    const newParagraph: ParagraphNode = {
      id: this.generateId(),
      content: afterText,
      type: 'paragraph'
    };

    blocks.splice(paragraphIndex + 1, 0, newParagraph);

    return {
      ...doc,
      blocks,
      version: doc.version + 1
    };
  }

  static mergeParagraphs(doc: TextEditorDocument, firstIndex: number, secondIndex: number): TextEditorDocument {
    if (firstIndex < 0 || secondIndex >= doc.blocks.length || firstIndex >= secondIndex) {
      return doc;
    }

    const blocks = [...doc.blocks];
    const firstPara = blocks[firstIndex];
    const secondPara = blocks[secondIndex];

    // Merge content
    blocks[firstIndex] = {
      ...firstPara,
      content: firstPara.content + secondPara.content
    };

    // Remove second paragraph
    blocks.splice(secondIndex, 1);

    return {
      ...doc,
      blocks,
      version: doc.version + 1
    };
  }
}
