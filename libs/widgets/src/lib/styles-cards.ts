import { installPartStyles, PART_RANK } from './styles';

/**
 * A repeating group of cards (cards.ts, `one2many.cards`): each line a card of its fields under its numbered title, ×
 * at its end, "Add another" under the cards. Cut from the question kinds' rules (styles-kinds.ts), which stand at the
 * head of the page's own looks: the cards' sheet goes in after every other part's and before the rest of those looks
 * (PART_RANK.cards), the first time a page draws cards.
 */
export const CARDS_CSS = /* css */ `
/* ---- a repeating group of cards, cut from the question kinds' rules -------------------------------------- */
/* A repeating group: each line a card of its fields under its numbered title, × at its end; "Add another" under the cards. */
.fd-repeat { display: grid; gap: 10px; justify-items: start; width: 100%; min-width: 0; }
.fd-repeat-list { display: grid; gap: 10px; width: 100%; min-width: 0; }
.fd-repeat-list:empty { display: none; }
.fd-repeat-card {
  display: grid; gap: 8px; min-width: 0; padding: 10px 14px 14px;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: max(var(--fd-radius), 6px);
}
.fd-repeat-head { display: flex; align-items: center; gap: 2px; min-height: 28px; }
.fd-repeat-title { font-weight: 600; font-size: 13.5px; margin-inline-end: auto; }
.fd-repeat-remove, .fd-repeat-tool { border: none; background: none; cursor: pointer; color: var(--fd-muted); font-size: 18px; line-height: 1; padding: 4px 8px; border-radius: 4px; }
.fd-repeat-remove:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-repeat-tool { font-size: 15px; min-width: 24px; min-height: 24px; }
.fd-repeat-tool:hover { color: var(--fd-accent); background: var(--fd-accent-soft); }
.fd-repeat-fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 10px 14px; }
.fd-repeat-field { display: grid; gap: 3px; min-width: 0; align-content: start; }
.fd-repeat-label { font-size: 12.5px; color: var(--fd-muted); }
.fd-repeat-add { border-style: dashed; }
`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installCardsStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-cards-styles', CARDS_CSS, PART_RANK.cards);
}
