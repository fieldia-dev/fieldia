/**
 * The Translations view: the bar over it, asking before a language goes, the
 * CSV panel, and the grid — a box of its own that scrolls both ways, its
 * heads and its first column held in place, each cell typed in where it
 * stands. Appended to the designer's stylesheet.
 */
export const DESIGNER_TRANSLATIONS_CSS = /* css */ `
/* ---- Translations: the page's words in other languages ---------------------- */
.fd-words { display: grid; gap: 12px; min-width: 0; }
.fd-words-bar {
  display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 10px 14px;
}
.fd-words-heading { flex: 1 1 220px; min-width: 0; display: grid; gap: 2px; }
.fd-words-title { margin: 0; font-size: 16px; font-weight: 650; }
.fd-words-note { margin: 0; font-size: 13px; color: var(--fd-muted); }
.fd-words-filter { display: inline-flex; align-items: center; gap: 8px; font-size: 13.5px; }
.fd-words-add { display: flex; gap: 6px; align-items: center; flex: 0 1 300px; min-width: 0; margin: 0; }
.fd-words-add .fd-input { flex: 1 1 150px; min-width: 0; }
.fd-words-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-words-confirm, .fd-words-paste {
  display: grid; gap: 10px; justify-items: start;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); padding: 12px 14px;
}
.fd-words-confirm { border-inline-start: 3px solid var(--fd-error); }
.fd-words-ask { margin: 0; font-weight: 600; }
.fd-words-buttons { display: flex; flex-wrap: wrap; gap: 8px; }
.fd-words-csv-label { font-size: 13.5px; }
.fd-words-paste .fd-words-csv { width: 100%; box-sizing: border-box; min-height: 130px; resize: vertical; font-size: 13px; line-height: 1.5; }
.fd-words-problem { margin: 0; color: var(--fd-error); font-size: 13px; }
.fd-words-status { margin: 0; font-size: 13px; color: var(--fd-muted); }
.fd-words-status:empty { display: none; }

/* The grid: its own box, scrolling both ways, never the page. */
.fd-words-scroll {
  overflow: auto; max-height: max(320px, calc(100vh - 260px)); overscroll-behavior: contain;
  background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius);
}
.fd-words-table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 14px; }
.fd-words-table th, .fd-words-table td { padding: 0; text-align: start; vertical-align: top; border-block-end: 1px solid var(--fd-border); }
.fd-words-table tr > * + * { border-inline-start: 1px solid var(--fd-border); }
.fd-words-table tbody tr:last-child > * { border-block-end: 0; }
.fd-words-table thead th { position: sticky; top: 0; z-index: 2; min-width: 200px; padding: 8px 10px; background: var(--fd-page); font-size: 13px; font-weight: 600; }
/* The page's own words stay in sight as the languages scroll by. */
.fd-words-table tbody th, .fd-words-table thead th:first-child { position: sticky; inset-inline-start: 0; box-shadow: 1px 0 0 var(--fd-border); }
.fd-words-table thead th:first-child { z-index: 3; width: 34%; }
.fd-words-table tbody th { z-index: 1; min-width: 180px; max-width: 320px; padding: 8px 10px; background: var(--fd-surface); font-weight: 400; line-height: 1.45; overflow-wrap: anywhere; }
.fd-words-head { display: flex; align-items: center; gap: 6px; min-height: 24px; }
.fd-words-lang { font-weight: 650; }
.fd-words-native { color: var(--fd-muted); font-weight: 400; font-size: 12.5px; }
.fd-words-remove { margin-inline-start: auto; width: 24px; height: 24px; font-size: 15px; }
.fd-words-progress, .fd-words-own { display: flex; align-items: center; gap: 8px; margin-block-start: 4px; font-size: 12px; font-weight: 400; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-words-meter { flex: 0 1 96px; height: 4px; border-radius: 2px; background: var(--fd-border); overflow: hidden; }
.fd-words-meter > span { display: block; height: 100%; border-radius: 2px; background: var(--fd-accent); transition: width 0.2s ease; }
/* A cell: the words typed where they stand, right to left in a language written so. */
.fd-words-cell {
  display: block; box-sizing: border-box; width: 100%; min-width: 200px; min-height: 38px; margin: 0; padding: 8px 10px;
  border: 0; border-radius: 0; resize: none; field-sizing: content; overflow: hidden;
  background: transparent; color: inherit; font: inherit; line-height: 1.45; text-align: start;
}
/* The whole cell answers, however tall its row: tinted while empty, lit under the pointer, underlined while typed in. */
.fd-words-grid td:has(> .fd-words-cell[data-empty]) { background: color-mix(in srgb, var(--fd-page) 55%, transparent); }
.fd-words-grid td:hover { background: var(--fd-accent-soft); }
.fd-words-grid td:focus-within { background: var(--fd-surface); box-shadow: inset 0 -2px 0 var(--fd-focus); }
.fd-words-cell:focus { outline: none; }
.fd-words-none { margin: 0; padding: 16px; color: var(--fd-muted); font-size: 13.5px; }

/* Words no longer on the page. */
.fd-words-stale { display: grid; gap: 8px; }
.fd-words-stale-head { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; }
.fd-words-stale-title { margin: 0; font-size: 14px; font-weight: 650; }
.fd-words-stale-note { margin: 0; flex: 1 1 220px; font-size: 13px; color: var(--fd-muted); }
.fd-words-stale-grid .fd-words-gone { padding: 8px 10px; color: var(--fd-muted); line-height: 1.45; }
.fd-words-stale-grid .fd-words-gone-remove { width: 1%; min-width: 0; padding: 4px; text-align: center; vertical-align: middle; }
@container (max-width: 620px) {
  .fd-words-table tbody th, .fd-words-table thead th:first-child { min-width: 120px; max-width: 150px; }
  .fd-words-table thead th, .fd-words-cell { min-width: 170px; }
}

/* Try it in a language: the page's languages, beside English and العربية. */
.fd-try-language { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--fd-muted); }
.fd-try-language .fd-input { width: auto; min-height: 30px; padding-block: 2px; font-size: 13px; color: var(--fd-text); }
@media (prefers-reduced-motion: reduce) { .fd-words-meter > span { transition: none; } }
`;
