import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * AI help's look (the assist part): Fill from text over the fields, the review of what was proposed — how many, why,
 * Accept all — a proposal under its field (the value it takes the place of struck through, the new one, Accept and
 * Reject), its kept note with Undo, a text field's tools under its box, the dialog the words are pasted in, and a
 * list's words read as filters. On the form's tokens, so dark and the themes follow; logical sides, so right to left
 * follows. Put in the page the first time a page asks for it (installPartStyles, PART_RANK.assist).
 */
const ASSIST_CSS = /* css */ `
.fd-assist-bar { display: grid; gap: 8px; margin-block-end: 12px; }
.fd-assist-bar[hidden] { display: none; }
.fd-assist-start { display: flex; justify-content: flex-end; }
.fd-assist-start:empty, .fd-assist-start:has(> .fd-assist-fill[hidden]) { display: none; }
.fd-assist-fill, .fd-assist-tool { display: inline-flex; align-items: center; gap: 6px; }
.fd-assist-fill .fd-icon, .fd-assist-tool .fd-icon, .fd-assist-review > .fd-icon, .fd-proposal-icon .fd-icon { width: 16px; height: 16px; flex: none; color: var(--fd-accent); }
.fd-assist-review {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; align-items: start; padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--fd-accent) 40%, transparent); border-inline-start-width: 4px; border-radius: var(--fd-control-radius);
  background: var(--fd-accent-soft); color: var(--fd-text); font-size: 13.5px; line-height: 1.45;
}
.fd-assist-review[hidden] { display: none; }
.fd-assist-review > .fd-icon { margin-block-start: 2px; }
.fd-assist-review-words { min-width: 0; display: grid; gap: 2px; }
.fd-assist-review-text, .fd-assist-review-why { margin: 0; overflow-wrap: anywhere; }
.fd-assist-review-text strong { font-weight: 600; }
.fd-assist-review-why { color: var(--fd-muted); font-size: 13px; }
.fd-assist-review-why:empty { display: none; }
.fd-assist-review-more { margin: 0; padding: 0; list-style: none; color: var(--fd-muted); font-size: 13px; overflow-wrap: anywhere; }
.fd-assist-review-more[hidden] { display: none; }
.fd-assist-review-ways { grid-column: 2; display: flex; flex-wrap: wrap; gap: 6px; }
.fd-assist-review-ways .fd-button { min-height: 32px; padding-block: 4px; }
/* A sheet's: between its header's buttons and its card, as wide as the card. */
.fd-sheet-page > .fd-assist-bar { box-sizing: border-box; max-width: var(--fd-page-max, 1180px); margin: 16px auto 0; padding-inline: 16px; }
/* A proposal under its field: what it takes the place of, the new value, Accept and Reject. */
.fd-proposal {
  display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 2px 8px; align-items: start; margin-block-start: 6px; padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--fd-accent) 40%, transparent); border-inline-start-width: 4px; border-radius: var(--fd-control-radius);
  background: var(--fd-accent-soft); color: var(--fd-text); font-size: 13px; line-height: 1.45;
}
.fd-proposal-icon { display: flex; padding-block-start: 2px; }
.fd-proposal-main { min-width: 0; display: grid; gap: 6px; }
.fd-proposal-words { min-width: 0; overflow-wrap: anywhere; }
.fd-proposal-words strong { font-weight: 600; }
.fd-proposal-words del { color: var(--fd-muted); text-decoration-thickness: 1px; }
.fd-proposal-words ins { text-decoration: none; font-weight: 600; }
.fd-proposal-arrow { color: var(--fd-muted); }
/* From the old to the new, the way the words run: leftwards right to left. */
[dir="rtl"] .fd-proposal-arrow { display: inline-block; transform: scaleX(-1); }
.fd-proposal-text { margin-block-start: 4px; padding: 6px 8px; max-height: 14em; overflow: auto; white-space: pre-wrap; border-radius: var(--fd-control-radius); background: var(--fd-surface); border: 1px solid var(--fd-border); }
.fd-proposal-lines { margin: 4px 0 0; padding-inline-start: 18px; }
.fd-proposal-why { margin: 0; color: var(--fd-muted); }
.fd-proposal-ways { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-proposal-ways .fd-button { min-height: 30px; padding-block: 2px; font-size: 13px; }
.fd-proposal-kept { display: flex; flex-wrap: wrap; align-items: center; gap: 2px 8px; padding: 4px 10px; background: transparent; border-style: dashed; color: var(--fd-muted); }
.fd-proposal-kept .fd-button { min-height: 28px; padding-block: 0; font-size: 13px; }
.fd-field[data-proposed] > :is(input, textarea, select, .fd-richtext, .fd-input) { outline: 2px dashed color-mix(in srgb, var(--fd-accent) 55%, transparent); outline-offset: 1px; }
/* A text field's tools, under its box at its end. */
.fd-assist-tools { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 2px 10px; margin-block-start: 2px; }
.fd-assist-tools[hidden] { display: none; }
.fd-assist-tool { min-height: 28px; padding: 2px 4px; font-size: 13px; }
.fd-assist-tool[aria-busy="true"] { color: var(--fd-muted); cursor: progress; }
.fd-assist-failed { margin: 4px 0 0; padding: 6px 10px; border-radius: var(--fd-control-radius); background: var(--fd-error-soft); color: var(--fd-error); font-size: 13px; }
/* The words pasted in. */
.fd-assist-dialog .fd-form-dialog-body { display: grid; gap: 10px; align-content: start; }
.fd-assist-hint { margin: 0; color: var(--fd-muted); font-size: 13.5px; }
.fd-assist-text { width: 100%; min-height: 10em; resize: vertical; font: inherit; }
.fd-assist-pick-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.fd-assist-files { margin: 0; padding-inline-start: 18px; font-size: 13px; }
.fd-assist-files[hidden] { display: none; }
.fd-assist-problem { margin: 0; padding: 8px 10px; border-radius: var(--fd-control-radius); background: var(--fd-error-soft); color: var(--fd-error); }
.fd-assist-problem[hidden] { display: none; }
.fd-assist-go[aria-busy="true"] { cursor: progress; }
/* A list's words read as filters: what they were read as under the bar (the ✦ beside the box is the list's own). */
.fd-assist-words[aria-busy="true"] { cursor: progress; }
.fd-assist-read {
  display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; margin-block: 0 8px; padding: 6px 10px;
  border-inline-start: 4px solid color-mix(in srgb, var(--fd-accent) 55%, transparent); border-radius: var(--fd-control-radius);
  background: var(--fd-accent-soft); color: var(--fd-text); font-size: 13px; line-height: 1.45;
}
.fd-assist-read[hidden] { display: none; }
.fd-assist-read > .fd-icon { width: 16px; height: 16px; flex: none; color: var(--fd-accent); }
.fd-assist-read-text { flex: 1 1 16em; min-width: 0; overflow-wrap: anywhere; }
.fd-assist-read-why { color: var(--fd-muted); }
.fd-assist-read .fd-button { min-height: 28px; padding-block: 0; font-size: 13px; }
`;

/** AI help's sheet in a document, once, in its place among Fieldia's (PART_RANK.assist). */
export function installAssistStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-assist-styles', ASSIST_CSS, PART_RANK.assist);
}
