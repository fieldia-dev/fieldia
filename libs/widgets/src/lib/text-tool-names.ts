/**
 * The formatted text's tools by name, in the order a page lists them: what a
 * page may name in a field's `tools`, and what the designer offers. How each
 * is drawn and what it does are the text part's (text-tools.ts).
 */

export type TextTool =
  | 'bold' | 'italic' | 'underline' | 'bulletList' | 'numberList' | 'highlight' | 'colour' | 'emoji' | 'outdent' | 'indent'
  | 'strike' | 'size' | 'code' | 'mention' | 'reference' | 'clearFormatting' | 'image' | 'link' | 'unlink' | 'taskList' | 'heading' | 'attach';

export const TEXT_TOOLS: readonly TextTool[] = [
  'bold', 'italic', 'underline', 'bulletList', 'numberList', 'highlight', 'colour', 'emoji', 'outdent', 'indent',
  'strike', 'size', 'code', 'mention', 'reference', 'clearFormatting', 'image', 'link', 'unlink', 'taskList', 'heading', 'attach',
];

/** The rich editor's tools when a page names none: bold to Remove link, as a work item's System Info has them. */
export const RICH_TOOLS: readonly TextTool[] = ['bold', 'italic', 'underline', 'bulletList', 'numberList', 'highlight', 'colour', 'emoji', 'outdent', 'indent', 'strike', 'size', 'code', 'mention', 'reference', 'clearFormatting', 'image', 'link', 'unlink'];
/** The Markdown editor's: a mention and links to records first, then the marks, the lists last. */
export const MARKDOWN_TOOLS: readonly TextTool[] = ['mention', 'reference', 'attach', 'highlight', 'heading', 'bold', 'italic', 'code', 'link', 'bulletList', 'numberList', 'taskList'];
