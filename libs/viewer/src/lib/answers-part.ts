/**
 * The answers part (viewer-parts.ts): what a page says of the answers given — a `{field}` in a label, a help, a
 * choice, a step's title or a button written as a sentence says it (sentence-value.ts: a day in the page's order, a
 * yes or no in words), choices whose words follow the answers they name (worded-choices.ts), and the ending a page of
 * responses shows once they are sent, with the reference the app gave (ending.ts). Loaded before a page that has any
 * is drawn; a page with none never loads it. Where it cannot come, such words read as the fields show their values
 * at rest, and a page sent says the viewer's own thanks.
 */
export { sentenceValue, orderedDay } from './sentence-value';
export { wordedWidget } from './worded-choices';
export { drawEnding, linkedValueWords } from './ending';
