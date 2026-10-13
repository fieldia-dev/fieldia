/**
 * A record's head on the canvas and in the panel: the head drawn by the
 * viewer's own stylesheet (styles-head.ts in @fieldia/widgets), in place of
 * the classic header and the title card; and the panel's lists of the head's
 * parts — a part's name, what it has of its own, earlier, later and remove.
 */
export const DESIGNER_HEAD_CSS = /* css */ `
.fd-canvas-header-card[data-head] > :not(.fd-head) { display: none; }
.fd-canvas-header-card[data-head] ~ .fd-canvas-title { display: none; }
.fd-canvas-head { margin-block-end: 8px; border: 1px solid var(--fd-border); border-radius: var(--fd-radius); overflow: hidden; cursor: default; }
.fd-canvas-head .fd-head-title { font-size: 18px; }
.fd-canvas-head-title { flex: 1 1 auto; min-width: 0; padding-inline: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-canvas-head-meta { flex: 0 1 269px; min-width: 0; padding-inline: 12px; color: var(--fd-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-canvas-head .fd-head-fields > .fd-field { min-height: 32px; }
.fd-canvas-head-value { padding-inline: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-canvas-head .fd-canvas-selected { outline: 2px solid var(--fd-accent); outline-offset: 1px; }
.fd-head-list { display: grid; gap: 6px; }
.fd-head-line, .fd-head-look { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.fd-head-line-name { flex: 1 1 8em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-head-line .fd-input, .fd-head-look .fd-input { flex: 1 1 7em; min-width: 0; }
.fd-head-line .fd-hotkey-input { flex: 0 0 3.2em; text-align: center; text-transform: uppercase; }
.fd-head-look input[type="color"] { flex: 0 0 40px; padding: 2px; }
.fd-head-looks { display: grid; gap: 6px; }
`;
