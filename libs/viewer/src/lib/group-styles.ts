import { installPartStyles, PART_RANK } from '@fieldia/widgets';

/**
 * A group drawn as a work item draws one (section-tools.ts): its heading with
 * its tools at the end — ⤢, ^ and ⌄ — its fields under it, and the group shown
 * alone over the body. The head part's, put in its place among Fieldia's the
 * first time a page draws such a heading (installPartStyles, PART_RANK.groups).
 */
export const GROUP_CSS = /* css */ `
/* ---- a group's heading with tools at its end: 16px words, a rule 50px down ---- */
.fd-form .fd-section[data-head] { gap: 0; --fd-group-inset: 8px; }
.fd-form .fd-section[data-head] > .fd-section-title {
  display: flex; align-items: center; float: none; width: 100%; box-sizing: border-box; min-height: 51px; margin: 0; padding: 0;
  border-block-end: 1px solid var(--fd-border); font-size: 16px; font-weight: 600; line-height: 22px; color: var(--fd-heading, var(--fd-text));
  text-transform: none; letter-spacing: 0;
}
.fd-form .fd-section[data-head] > .fd-section-title > .fd-section-name { flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere; }
.fd-form .fd-section[data-head] > .fd-section-title .fd-icon { margin-inline-end: 0.4em; }
.fd-form .fd-section[data-head] > .fd-grid { padding: 4px var(--fd-group-inset) 0; row-gap: 7px; }
/* Its fields: a 12px label on a 16px line right over a 32px box, words 7px into it, 55px from one label to the next. */
.fd-form .fd-section[data-head] { --fd-pad-x: 6px; --fd-control-height: 32px; }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field { gap: 0; line-height: 20px; }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field > .fd-label { font-size: 12px; line-height: 16px; font-weight: 400; color: var(--fd-muted); }
/* A number's box is a compact one, 22px: 45px from its label to the next one, as the tracker's numbers (measured 20.22.23). */
.fd-form .fd-section[data-head] > .fd-grid > .fd-field:is([data-type="integer"], [data-type="float"]) > input.fd-input { height: 22px; min-height: 22px; padding-block: 0; }
/* A lock in such a group is drawn in the words' colour, a padlock 12px wide and 13px tall, as the tracker's. */
.fd-form .fd-section[data-head] > .fd-grid > .fd-field .fd-lock { color: var(--fd-text); }
.fd-form .fd-section[data-head] > .fd-grid > .fd-field .fd-lock .fd-icon { width: 15px; height: 15px; }
/* At a value's start, its padlock's edge a pixel past the label's, as the tracker's: the 18px button pulled 2px back and up. */
.fd-form .fd-section[data-head] > .fd-grid > .fd-field[data-lock-at="value"] > .fd-lock-wrap { margin-inline-start: -2px; inset-block-start: -1.5px; }
/* Groups with such headings, one under another: 11px from one's last part to the next one's heading. */
.fd-form .fd-grid:has(> .fd-section[data-head]) { row-gap: 11px; }
.fd-section-tools { display: flex; align-items: center; gap: 2px; margin-inline-start: auto; flex: none; opacity: 0; transition: opacity 0.1s ease; }
/* In a work heading its tools sit low, their middle 8px under the title's, as the tracker's do (measured 20.22.23). */
.fd-form .fd-section[data-head] > .fd-section-title .fd-section-tools { align-self: flex-end; margin-block-end: 1px; margin-inline-end: -2px; }
/* Pointed at, worked in or folded, a group shows its tools; where nothing can point, always. */
.fd-form .fd-section[data-head]:is(:hover, :focus-within, .fd-section-folded, [data-maximised]) > .fd-section-title .fd-section-tools { opacity: 1; }
@media (hover: none) { .fd-section-tools { opacity: 1; } }
.fd-section-tool {
  display: inline-grid; place-items: center; width: 32px; height: 32px; padding: 0; border: 0; border-radius: 2px;
  background: none; color: var(--fd-text); cursor: pointer; font: inherit;
}
.fd-section-tool:hover { background: var(--fd-text-hover); }
.fd-section-tool:active { background: var(--fd-text-pressed); }
.fd-section-tool:focus-visible { outline: 1px solid var(--fd-focus); outline-offset: -1px; }
/* Their icons 18px in thin lines of the words' colour: ⤢ 13px across, ^ 9px, ✎ 13px, as the tracker's (measured 20.22.23). */
.fd-section-tool svg { width: 18px; height: 18px; stroke-width: 1.6; }
/* In the words' colour too in a heading, whose own icon before its name is muted. */
.fd-section-title .fd-section-tools .fd-icon { color: inherit; }
/* Shown alone over the body: the parts round it out of sight, its own heading still there to put it back. */
.fd-form [data-unshown] { display: none !important; }
.fd-form .fd-grid[data-maximising] { grid-template-columns: minmax(0, 1fr) !important; }
.fd-form .fd-grid[data-maximising] > * { grid-column: 1 / -1 !important; }
.fd-form .fd-section[data-maximised] { min-height: 60vh; }

`;

/** The sheet in a document, once, in its place among Fieldia's. */
export function installGroupStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-group-styles', GROUP_CSS, PART_RANK.groups);
}
