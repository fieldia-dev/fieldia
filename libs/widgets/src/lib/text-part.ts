/**
 * The text part (parts.ts): a work item's formatted text — its editor, rich or
 * Markdown, with its toolbar while it is worked in; Markdown both ways; the
 * menus of its tools; its tables' tools, and a table pasted made plain (the
 * classic editor's too); the links box with Add link — and their stylesheet,
 * which each puts in the page as it is first drawn. Loaded the first time a
 * page shows one, through `textPart`; nothing else imports these modules.
 */
export { modernHtml } from './html-field';
export { linksWidget } from './links';
export { formattedText, decorateLinks } from './formatted-text';
export { cleanPasted, pasteTable, putHtml } from './pasted-html';
export { markdownToHtml, htmlToMarkdown, markdownLoses } from './markdown';
export { textMenu } from './text-menu';
