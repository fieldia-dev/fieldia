/**
 * The cards part's sheet (cards-part.ts): a record list's rows as cards — on a phone, where the list has `card`, and in
 * its gallery on any width — their pictures, titles, pills and lines, the Group By headings across them and the totals
 * under them. Not ranked among the parts' sheets (PART_RANK): it is the list's, cut from it, and goes right after the
 * list's own sheet (fd-list-styles, itself after them all), as its rules reshape the list's table, a theme's table
 * (Fluent's, in the list's sheet) among it.
 */
export const CARD_STYLES = `
/* A card's cell, the table's hidden; its words for the box in the header, a card's alone. */
.fd-list-table .fd-list-card, .fd-list-check-words { display: none; }
/* ---- cards: a narrow list's rows (card), and its gallery's on any width ---- */
/* No longer a scroll box: as wide as the list, never as wide as the line of chips over the cards. */
.fd-list[data-as] .fd-list-scroll { overflow: visible; min-width: 0; max-height: none; background: none; border: 0; border-radius: 0; padding: 0; }
.fd-list[data-as] .fd-list-table, .fd-list[data-as] .fd-list-table > :is(thead, tbody, tfoot) { display: block; }
.fd-list[data-as] .fd-list-table { width: auto; }
/* The header: the box that ticks every card, and the columns that order them, as chips. */
/* One line, which scrolls sideways under a finger: the cards start at once, however many columns order them. */
.fd-list[data-as] .fd-list-table thead tr { display: flex; align-items: center; gap: 6px; margin-block-end: 10px; padding-block: 1px; overflow-x: auto; scrollbar-width: none; }
.fd-list[data-as] .fd-list-table thead tr::-webkit-scrollbar { display: none; }
.fd-list[data-as] .fd-list-table thead th { display: block; flex: none; position: static; width: auto; min-width: 0; max-width: none; height: auto; padding: 0; border: 0; background: none; }
.fd-list[data-as] .fd-list-table thead th::after, .fd-list[data-as] .fd-list-table thead th:not(:has(.fd-list-sort)):not(.fd-list-check) { display: none; }
.fd-list[data-as] .fd-list-table thead :is(.fd-list-tree, .fd-list-tail), .fd-list[data-as] .fd-list-grip { display: none; }
.fd-list[data-as] .fd-list-check-all { display: inline-flex; align-items: center; gap: 8px; box-sizing: border-box; min-height: 32px; padding-inline: 10px 12px; border: 1px solid var(--fd-border); border-radius: 999px; background: var(--fd-surface); font-size: 13.5px; font-weight: 400; cursor: pointer; }
.fd-list[data-as] .fd-list-check-words { display: inline; }
.fd-list[data-as] .fd-list-sort { width: auto; box-sizing: border-box; min-height: 32px; padding-inline: 12px; border: 1px solid var(--fd-border); border-radius: 999px; background: var(--fd-surface); color: var(--fd-text); }
.fd-list[data-as] th[aria-sort] .fd-list-sort { border-color: var(--fd-accent); background: var(--fd-accent-soft); color: var(--fd-accent); }
.fd-list[data-as] .fd-list-table th.fd-num .fd-list-sort { justify-content: flex-start; }
.fd-list[data-as] .fd-list-table th.fd-num .fd-list-sort::after { order: 0; }
.fd-list[data-as] .fd-list-sort .fd-list-head { font-size: 13.5px; font-weight: 500; color: inherit; }
/* Each row a card: its box at its start, its card, its own buttons under it; a tone on its edge. */
.fd-list[data-as] .fd-list-table tbody { display: grid; gap: 10px; }
.fd-list[data-as] .fd-list-row { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: start; column-gap: 10px; box-sizing: border-box; min-width: 0; padding: 12px; background: var(--fd-surface); border: 1px solid var(--fd-border); border-radius: var(--fd-radius); }
.fd-list[data-as][data-choose="none"] .fd-list-row { grid-template-columns: minmax(0, 1fr); }
.fd-list[data-as] .fd-list-row[data-tone] { border-inline-start: 4px solid var(--fd-row-tone); }
.fd-list[data-as] .fd-list-row:hover { border-color: var(--fd-border-strong); }
.fd-list[data-as] .fd-list-row[data-tone]:hover { border-inline-start-color: var(--fd-row-tone); }
.fd-list[data-as] .fd-list-row:is([aria-selected="true"], [aria-current="true"], .fd-list-hot) { background: var(--fd-accent-soft); border-color: var(--fd-accent); }
.fd-list[data-as] .fd-list-row:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-list[data-as] .fd-list-row > td { display: none; height: auto; max-width: none; padding: 0; border: 0; background: none; color: inherit; white-space: normal; overflow: visible; }
.fd-list[data-as] .fd-list-row > .fd-list-check { display: block; width: auto; padding-block-start: 2px; }
.fd-list[data-as] .fd-list-row > .fd-list-card { display: flex; gap: 12px; grid-column: -2; min-width: 0; }
.fd-list[data-as] .fd-list-row > .fd-list-tail:not(:empty) { display: flex; flex-wrap: wrap; gap: 6px; grid-column: -2; padding-block-start: 10px; text-align: start; }
.fd-list[data-as] .fd-list-tail > .fd-list-row-button + .fd-list-row-button { margin: 0; }
.fd-list-card-photo { position: relative; flex: none; overflow: hidden; border-radius: 8px; background: var(--fd-page); }
.fd-list-card-photo img { display: block; width: 100%; height: 100%; object-fit: cover; }
.fd-list-card-initials::before { content: attr(data-initials); }
.fd-list-card-initials { display: grid; place-items: center; width: 100%; height: 100%; color: var(--fd-accent); font-weight: 600; }
.fd-list-card-photo[data-empty] { background: var(--fd-accent-soft); }
.fd-list-card-body { display: grid; flex: 1; gap: 3px; min-width: 0; align-content: start; }
.fd-list-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; min-width: 0; }
.fd-list-card-title { min-width: 0; font-size: 15px; font-weight: 600; line-height: 1.35; overflow-wrap: anywhere; }
/* A row in bold (rowBold): its card's title bolder, its lines in bold as its cells are. */
.fd-list[data-as] .fd-list-row[data-bold] .fd-list-card-title { font-weight: 750; }
.fd-list-card-head > .fd-list-pill { flex: none; }
.fd-list-card-subtitle { color: var(--fd-muted); font-size: 13.5px; overflow-wrap: anywhere; }
.fd-list-card-lines { display: grid; gap: 3px; margin: 4px 0 0; font-size: 13.5px; }
.fd-list-card-lines > div { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
.fd-list-card-lines dt { flex: none; color: var(--fd-muted); }
.fd-list-card-lines dd { min-width: 0; margin: 0; overflow-wrap: break-word; font-variant-numeric: tabular-nums; }
/* A phone's links stay together, beside its number or under it. */
.fd-list-card-lines .fd-list-links { white-space: nowrap; }
.fd-list-card-lines[data-labels="hidden"] dt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-list-card-lines[data-lead] > div:first-child dd { color: var(--fd-text); font-size: 17px; font-weight: 700; }
.fd-list-card-lines .fd-list-links { margin-block: -3px; }
/* A narrow list's card: its picture small at its start, round where it is a person's initials. */
.fd-list[data-as="cards"] .fd-list-card-photo { width: 56px; height: 56px; }
.fd-list[data-as="cards"] .fd-list-card-photo[data-empty] { width: 44px; height: 44px; border-radius: 50%; }
/* The gallery: cards side by side, as wide as its size says at least, their pictures large on top. */
.fd-list[data-as="gallery"] .fd-list-table tbody { grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--fd-card-min, 240px)), 1fr)); gap: 14px; }
.fd-list[data-size="small"] { --fd-card-min: 180px; }
.fd-list[data-size="large"] { --fd-card-min: 320px; }
.fd-list[data-as="gallery"] .fd-list-row:has(.fd-list-card-photo) { grid-template-columns: minmax(0, 1fr); grid-template-rows: auto 1fr; padding: 0; overflow: hidden; }
.fd-list[data-as="gallery"] .fd-list-row:has(.fd-list-card-photo) > .fd-list-card { display: block; grid-column: 1; grid-row: 1; }
.fd-list[data-as="gallery"] .fd-list-card-photo { width: 100%; aspect-ratio: 3 / 2; border-radius: 0; }
.fd-list[data-as="gallery"] .fd-list-card-initials { font-size: 34px; }
.fd-list[data-as="gallery"] .fd-list-row:has(.fd-list-card-photo) .fd-list-card-body { padding: 12px 14px 14px; }
.fd-list[data-as="gallery"] .fd-list-row:has(.fd-list-card-photo) > .fd-list-check { position: absolute; z-index: 1; top: 8px; inset-inline-start: 8px; padding: 6px; border-radius: 6px; background: var(--fd-surface); box-shadow: 0 1px 4px rgba(15, 23, 42, 0.22); line-height: 0; }
.fd-list[data-as="gallery"] .fd-list-row:has(.fd-list-card-photo) > .fd-list-tail:not(:empty) { grid-column: 1; grid-row: 2; align-self: end; padding: 0 14px 14px; }
.fd-list[data-as="gallery"] .fd-list-row:has(.fd-list-card-photo)[data-tone] { border-inline-start-width: 1px; border-block-start: 4px solid var(--fd-row-tone); }
/* Group By headings across the cards, a group's More under them; the totals in a card of their own. */
.fd-list[data-as] :is(.fd-list-group, .fd-list-more) { display: block; grid-column: 1 / -1; }
.fd-list[data-as] :is(.fd-list-group, .fd-list-more) > td { display: block; max-width: none; padding: 0; border: 0; background: none; }
.fd-list[data-as] .fd-list-group > td { border-radius: var(--fd-control-radius); background: var(--fd-page); }
/* The totals stay in sight under the cards as they scroll, on the page's own ground: a phone's first screen says them. */
.fd-list[data-as] .fd-list-totals { position: sticky; bottom: 0; z-index: 2; margin-block-start: 10px; padding-block: 6px 8px; background: var(--fd-page); }
.fd-list[data-as] .fd-list-totals:not(:has(tr:not([hidden]))) { display: none; }
.fd-list[data-as] .fd-list-totals tr:not([hidden]) { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 18px; padding: 10px 12px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); background: var(--fd-surface); box-shadow: 0 -2px 10px rgba(15, 23, 42, 0.08); }
.fd-list[data-as] .fd-list-totals tr[data-total="ticked"]:not([hidden]) { margin-block-end: 6px; border-color: var(--fd-accent); background: var(--fd-accent-soft); }
.fd-list[data-as] .fd-list-totals :is(td, th) { display: block; position: static; padding: 0; border: 0 !important; background: none !important; white-space: normal; }
/* A total that cannot be said honestly (amounts in more than one currency) says why in words: no pointer on a phone. */
.fd-list[data-as] .fd-list-totals td:empty:not([title]) { display: none; }
.fd-list[data-as] .fd-list-totals td[title]:empty::after { content: attr(title); color: var(--fd-muted); font-weight: 400; }
.fd-list[data-as] .fd-list-totals td[data-label]::before { content: attr(data-label); margin-inline-end: 6px; color: var(--fd-muted); font-weight: 400; }
`;

/** The cards' sheet in a document, once, right after the list's own. */
export function installCardStyles(doc: Document): void {
  if (doc.getElementById('fd-list-cards-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-list-cards-styles';
  style.textContent = CARD_STYLES;
  const list = doc.getElementById('fd-list-styles');
  if (list) list.after(style);
  else (doc.head ?? doc.documentElement).append(style);
}
