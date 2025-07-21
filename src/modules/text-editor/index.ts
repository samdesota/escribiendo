// Text Editor Module Exports
export { default as SimpleTextEditor } from './SimpleTextEditor';
export { TextEditorState } from './TextEditorState';
export { TextEditorEvents } from './TextEditorEvents';
export { restoreSelection } from './TextEditorRenderUtils';
export { LLMSuggestionManager } from './LLMSuggestionManager';
export type { ExternalAnnotation } from './TextEditorAnnotations';
export type {
  TextEditorDocument,
  ParagraphNode,
  AnnotationNode,
  WidgetNode,
  ContentNode,
  ParagraphSelection
} from './TextEditorModel';
export { DocumentModel } from './TextEditorModel';
export type { LoadingState } from './LLMSuggestionManager';
