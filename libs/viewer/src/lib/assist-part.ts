/**
 * The assist part (parts.ts in @fieldia/widgets): AI help through the app's own model — a page's Fill from text
 * (`suggest`), a text field's Draft and Polish (`options.rewrite`), the app's own proposal (the viewer's `propose`),
 * each value proposed shown on its field to accept or reject, with Undo (assist.ts); and a list's search in plain words
 * turned into filters (`searchToFilter`, assist-words.ts) — with their stylesheet (assist-styles.ts). Loaded through
 * `assistPart` with the page's other parts where the page asks for any of them; the app's `propose` asks for it then.
 */
export { watchAssist } from './assist';
export { searchWords } from './assist-words';
export { installAssistStyles } from './assist-styles';
