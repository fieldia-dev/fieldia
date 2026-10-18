/**
 * The columns part's sheet (columns-part.ts): a list whose columns people shape — the Columns menu at its header's end,
 * a header's grip, the header and the first column kept in view while the rows scroll. Not ranked among the parts'
 * sheets (PART_RANK): it is the list's, cut from it, and goes right after the list's own sheet (fd-list-styles, itself
 * after them all), as its sticky header stands over a theme's (Fluent's, in the list's sheet).
 */
export const COLUMN_STYLES = `
/* ---- the columns a person shapes: the Columns menu, a header's grip, the header and first column in view ---- */
.fd-list[data-shaped] { position: relative; }
.fd-list-columns-button { all: unset; box-sizing: border-box; cursor: pointer; display: inline-grid; place-items: center; width: 28px; height: 28px; border-radius: 4px; color: var(--fd-muted); vertical-align: middle; }
.fd-list-columns-button:hover, .fd-list-columns-button[aria-expanded="true"] { background: var(--fd-page); color: var(--fd-text); }
.fd-list-columns-button:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-list-columns-button svg { width: 18px; height: 18px; }
.fd-list-columns-menu { position: absolute; z-index: 40; box-sizing: border-box; width: max-content; min-width: 240px; max-width: min(340px, calc(100% - 8px)); max-height: 60vh; overflow: auto; padding: 6px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); box-shadow: 0 10px 28px rgba(15, 23, 42, 0.14); }
.fd-list-columns-heading { padding: 4px 8px 6px; color: var(--fd-muted); font-size: 12px; font-weight: 600; }
.fd-list-columns-items { list-style: none; margin: 0; padding: 0; }
.fd-list-columns-item { display: flex; align-items: center; gap: 8px; min-height: 32px; padding-block: 1px; padding-inline: 8px 2px; border-radius: 4px; }
.fd-list-columns-item:hover, .fd-list-columns-item:focus-within { background: var(--fd-page); }
.fd-list-columns-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; cursor: pointer; }
.fd-list-columns-name[data-fixed] { cursor: default; }
.fd-list-columns-room { flex: none; width: 16px; }
.fd-list-columns-moves { display: inline-flex; gap: 2px; flex: none; }
.fd-list-columns-move { all: unset; box-sizing: border-box; cursor: pointer; display: grid; place-items: center; width: 26px; height: 26px; border-radius: 4px; color: var(--fd-muted); font-size: 14px; }
.fd-list-columns-move:hover { background: var(--fd-surface); color: var(--fd-text); }
.fd-list-columns-move:focus-visible { outline: 2px solid var(--fd-focus); }
/* The first has no Move up, the last no Move down: their places kept, so the arrows line up. */
.fd-list .fd-list-columns-move[hidden] { display: grid !important; visibility: hidden; }
.fd-list-columns-reset { margin: 6px 8px 2px; }
/* Inside its header, at its end: the next header, drawn over it, would take a press on any part past it. */
.fd-list-grip { position: absolute; inset-block: 0; inset-inline-end: 0; z-index: 1; width: 9px; cursor: col-resize; touch-action: none; }
.fd-list-grip::after { content: ''; position: absolute; inset-block: 8px; inset-inline-end: 3px; width: 1px; background: var(--fd-border-strong); opacity: 0; }
.fd-list-table th:hover > .fd-list-grip::after { opacity: 1; }
.fd-list-grip:focus-visible, .fd-list-grip[data-dragging] { outline: none; }
.fd-list-grip:focus-visible::after, .fd-list-grip[data-dragging]::after { opacity: 1; width: 2px; background: var(--fd-accent); }
/* The rows scroll in their card, as tall as the window allows, under their header; the first column stays as they go sideways. */
.fd-list[data-shaped]:not([data-as]) .fd-list-scroll { overflow: auto; max-height: var(--fd-list-height, calc(100dvh - 32px)); }
.fd-list[data-shaped]:not([data-as]) .fd-list-table thead th { position: sticky; top: 0; z-index: 3; }
.fd-list[data-shaped]:not([data-as]) .fd-list-table :is(td, th):is([data-pin], .fd-list-check, .fd-list-tree) { position: sticky; z-index: 1; }
.fd-list[data-shaped]:not([data-as]) .fd-list-table thead th:is([data-pin], .fd-list-check, .fd-list-tree) { z-index: 4; }
.fd-list[data-shaped]:not([data-as]) .fd-list-table .fd-list-check { inset-inline-start: 0; }
.fd-list[data-shaped]:not([data-as]) .fd-list-table .fd-list-tree { inset-inline-start: var(--fd-pin-tree, 0px); }
.fd-list[data-shaped]:not([data-as]) .fd-list-table [data-pin] { inset-inline-start: var(--fd-pin-first, 0px); }
/* Scrolled sideways, a rule at the first column's end parts it from the columns going under it. */
.fd-list[data-shaped]:not([data-as]) .fd-list-scroll[data-scrolled] [data-pin] { box-shadow: inset -1px 0 0 var(--fd-border-strong); }
.fd-list[data-shaped]:not([data-as]) .fd-list-scroll[data-scrolled] [data-pin]:dir(rtl) { box-shadow: inset 1px 0 0 var(--fd-border-strong); }
/* The Columns menu's cell held at the header's end, as the first column is at its start: in sight however wide the
   table, a rule at its start while columns lie past it. The rows' end cells keep to their own places. */
.fd-list[data-shaped]:not([data-as]) .fd-list-table thead th.fd-list-tail { position: sticky; inset-inline-end: 0; z-index: 4; }
.fd-list[data-shaped]:not([data-as]) .fd-list-scroll[data-more] thead th.fd-list-tail { box-shadow: inset 1px 0 0 var(--fd-border-strong); }
.fd-list[data-shaped]:not([data-as]) .fd-list-scroll[data-more] thead th.fd-list-tail:dir(rtl) { box-shadow: inset -1px 0 0 var(--fd-border-strong); }
/* Under the rows' own backgrounds (a row pointed at, chosen, open), so they stay whole. */
:where(.fd-list[data-shaped]) :where(.fd-list-row) > :is(td[data-pin], .fd-list-check, .fd-list-tree) { background: var(--fd-surface); }
.fd-list[data-shaped]:not([data-as]) .fd-list-totals { position: sticky; bottom: 0; z-index: 2; }
/* A header dragged sideways moves its column: its words are not chosen as it goes, nor a finger's long press the browser's. */
.fd-list[data-shaped]:not([data-as]) .fd-list-table thead th[data-col] { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
.fd-list[data-moving], .fd-list[data-moving] * { cursor: grabbing !important; }
/* The columns slide aside to make its place; its own cells stand in that place, faint, until it is let go. */
.fd-list-table[data-sliding] :is(th, td) { transition: transform 0.15s ease; }
.fd-list-table [data-lifted] { background: var(--fd-accent-soft) !important; opacity: 0.65; }
.fd-list-ghost { position: absolute; z-index: 41; box-sizing: border-box; display: flex; align-items: center; padding-inline: 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; pointer-events: none; background: var(--fd-surface); color: var(--fd-text); font-size: 13px; font-weight: 600; border: 1px solid var(--fd-accent); border-radius: 4px; box-shadow: 0 8px 24px rgba(15, 23, 42, 0.18); }
.fd-list-ghost > bdi { overflow: hidden; text-overflow: ellipsis; }
.fd-list-drop { position: absolute; z-index: 40; width: 2px; margin-left: -1px; border-radius: 1px; background: var(--fd-accent); pointer-events: none; }
.fd-list-drop[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) { .fd-list-table[data-sliding] :is(th, td) { transition: none; } }
/* On paper: the table as it stands, its columns in the person's order — nothing held in view (the first column held
   past the boxes left out before it would stand over the next), no menu, no drag's ghost or line, a lifted column's
   cells as the others'. */
@media print {
  .fd-form .fd-list[data-shaped] .fd-list-scroll { max-height: none !important; }
  .fd-form .fd-list[data-shaped] :is(.fd-list-table th, .fd-list-table td, .fd-list-totals) { position: static !important; box-shadow: none !important; transform: none !important; }
  .fd-form .fd-list[data-shaped] .fd-list-table [data-lifted] { background: none !important; opacity: 1; }
  .fd-form :is(.fd-list-columns-menu, .fd-list-ghost, .fd-list-drop, .fd-list-grip) { display: none !important; }
}

`;

/** The columns' sheet in a document, once, right after the list's own. */
export function installColumnStyles(doc: Document): void {
  if (doc.getElementById('fd-list-columns-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-list-columns-styles';
  style.textContent = COLUMN_STYLES;
  const list = doc.getElementById('fd-list-styles');
  if (list) list.after(style);
  else (doc.head ?? doc.documentElement).append(style);
}
