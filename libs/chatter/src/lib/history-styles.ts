/**
 * The History tab's look, on the same tokens as the form round it. Sizes are a
 * work item's, measured: headings 50px over a hairline, 51px rows with 32px
 * pictures, the State Graph's 8px arrows and 33px state chips, a 40px picture
 * over the change's before and after.
 *
 * Colours come from the form's tokens, so a host's own and the dark scheme
 * reach them. A few have a hook of their own a host may set on any element
 * round the history: `--fd-history-ink` (headings, names, a change's values),
 * `--fd-history-arrow`, `--fd-history-picked` (the chosen row, a replaced
 * value), `--fd-history-new` (a new value), `--fd-history-divider` (between
 * the list and the change) and `--fd-history-foot` (room kept under the list
 * where it fills the window or dialog).
 */
export const HISTORY_STYLES = /* css */ `
.fd-history {
  --fdh-arrow: #2b88d8;
  --fdh-ink: var(--fd-history-ink, var(--fd-text));
  --fdh-picked: var(--fd-history-picked, color-mix(in srgb, var(--fd-text) 9%, var(--fd-surface)));
  --fdh-hover: color-mix(in srgb, var(--fd-text) 4%, var(--fd-surface));
  container: fd-history / inline-size;
  display: block; min-width: 0; font-family: var(--fd-font); font-size: 14px; line-height: 20px; color: var(--fd-text);
}
:is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="dark"] .fd-history { --fdh-arrow: #479ef5; }
@media (prefers-color-scheme: dark) { :is(.fd-form, .fd-form-dialog, .fd-theme)[data-scheme="auto"] .fd-history { --fdh-arrow: #479ef5; } }
.fd-history *, .fd-history *::before, .fd-history *::after { box-sizing: border-box; }
.fd-history [hidden] { display: none !important; }
.fd-history .fd-icon { width: 16px; height: 16px; margin: 0; }

/* A heading over a hairline, its tools at its end. */
.fd-history-head { position: relative; display: flex; align-items: center; height: 51px; border-block-end: 1px solid var(--fd-border); }
.fd-history-title { flex: 1; min-width: 0; margin: 0; font-size: 16px; font-weight: 600; line-height: 22px; color: var(--fdh-ink); }
.fd-history-tool {
  align-self: flex-end; margin-block-end: 2px; display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; padding: 0;
  border: 0; border-radius: 2px; background: none; color: var(--fdh-ink); cursor: pointer; font: inherit;
}
.fd-history-tool[data-tool="fold"] { color: var(--fd-muted); }
.fd-history-tool:hover, .fd-history-tool[aria-haspopup][aria-expanded="true"] { background: var(--fd-fill, var(--fdh-hover)); }
.fd-history-tool:focus-visible, .fd-history-group-head:focus-visible, .fd-history-row:focus-visible, .fd-history-menu-item:focus { outline: 1px solid var(--fd-focus); outline-offset: -1px; }

/* The State Graph: each move an arrow with why above it and who and when under it, then the state it came to. */
.fd-history-graph { list-style: none; margin: 0; padding: 15px 0 0; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 12px 10px; }
.fd-history-step { display: flex; align-items: flex-start; gap: 10px; }
/* Its arrow the move's whole box: at least 85px, else 3px past the words over and under it each side, as the tracker's
   (measured 20.24.46); 10px on to the state, and from it to the next arrow. */
.fd-history-move { box-sizing: border-box; display: grid; grid-template-rows: 16px 19px 17px 15px; justify-items: center; min-width: 85px; padding-inline: 3px; font-size: 12px; line-height: 16px; color: var(--fd-muted); white-space: nowrap; }
.fd-history-move > :is(.fd-history-arrow, .fd-history-who) { align-self: end; }
.fd-history-arrow { justify-self: stretch; display: flex; height: 18px; margin-inline: -3px; color: var(--fd-history-arrow, var(--fdh-arrow)); }
.fd-history-arrow::before { content: ""; flex: 1; height: 8px; margin-block: 5px; background: currentColor; }
.fd-history-arrow::after { content: ""; flex: none; width: 10px; height: 18px; background: currentColor; clip-path: polygon(0 0, 100% 50%, 0 100%); }
.fd-history-arrow:dir(rtl) { transform: scaleX(-1); }
.fd-history-who { display: inline-flex; align-items: center; gap: 8px; }
.fd-history-state {
  display: inline-flex; align-items: center; gap: 7px; height: 33px; margin-block-start: 12px; padding: 0 8px;
  background: var(--fd-accent-soft); color: var(--fdh-ink); white-space: nowrap;
}
.fd-history-dot { display: inline-block; flex: none; width: 10px; height: 10px; border-radius: 50%; background: var(--fd-border-strong); }
.fd-history-states[data-maximised] { position: fixed; inset: 0; z-index: 1000; padding: 0 20px 20px; overflow: auto; background: var(--fd-surface); }

/* The list and the change it has chosen, side by side, the list 2px short of half (20.24.46); one over the other on a
   narrow screen. */
.fd-history-changes > .fd-history-head-row { display: grid; grid-template-columns: minmax(0, calc(50% - 2px)) minmax(0, 1fr); border-block-end: 1px solid var(--fd-border); }
.fd-history-head-row > .fd-history-head { border: 0; height: 50px; padding-inline-end: 10px; }
.fd-history-panes { display: grid; grid-template-columns: minmax(0, calc(50% - 2px)) minmax(0, 1fr); margin-block-start: 4px; min-height: 0; }
.fd-history[data-fit] .fd-history-panes { height: max(240px, calc(var(--fd-history-room, 0px) - var(--fd-history-foot, 38px))); }
/* Its scroll bar 2px short of the divider, as the tracker's (20.24.46). */
.fd-history-list { min-height: 0; overflow-y: auto; padding: 1px 2px 0; margin-inline-end: 2px; }
.fd-history-detail { min-height: 0; overflow-y: auto; border-inline-start: 1px solid var(--fd-history-divider, color-mix(in srgb, var(--fd-text) 42.4%, var(--fd-surface))); }

/* A group by age, folded by its heading. */
.fd-history-group-head {
  display: flex; align-items: center; gap: 8px; width: 100%; height: 34px; margin: 0; padding: 0 9px; border: 0; border-block-end: 1px solid var(--fd-border);
  background: var(--fd-band, color-mix(in srgb, var(--fd-text) 3%, var(--fd-surface))); color: var(--fd-text); font: inherit; text-align: start; cursor: pointer;
}
.fd-history-group-head .fd-icon { width: 12px; height: 12px; }
.fd-history-group-head[aria-expanded="false"] .fd-icon:dir(rtl) { transform: scaleX(-1); }
.fd-history-row {
  position: relative; display: grid; grid-template-columns: 32px minmax(0, 1fr); column-gap: 8px; align-items: center; height: 51px;
  padding: 0 2px 0 8px; border-block-end: 1px solid var(--fd-border); cursor: pointer;
}
.fd-history-row:hover { background: var(--fdh-hover); }
.fd-history-row[aria-selected="true"] { background: var(--fdh-picked); }
.fd-history-words { display: grid; min-width: 0; }
.fd-history-summary { min-width: 0; margin-block-start: 2px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; line-height: 20px; }
.fd-history-row[data-state] .fd-history-summary { padding-inline-end: 18px; }
.fd-history-summary .fd-history-dot { margin-inline-end: 6px; vertical-align: -0.5px; }
/* The summary sits 2px under the middle, its date where it was: as a work item's list sets them. */
.fd-history-row .fd-history-when { justify-self: end; margin-block-start: -2px; font-size: 12px; line-height: 16px; color: var(--fd-muted); }
/* On the picked row's grey the muted words would read under 4.5:1 (#707070 on #eaeaea is 4.1): a fifth of the text's ink in them. */
.fd-history-row[aria-selected="true"] .fd-history-when { color: color-mix(in srgb, var(--fd-muted) 80%, var(--fd-text)); }
.fd-history-end-dot { position: absolute; inset-inline-end: 6px; top: 14px; }
.fd-history-none { margin: 12px 9px; color: var(--fd-muted); }

/* A picture, or initials on the accent. */
.fd-history-avatar { display: inline-grid; place-items: center; flex: none; width: 32px; height: 32px; border-radius: 50%; overflow: hidden; object-fit: cover; background: var(--fd-accent); color: var(--fd-accent-text); font-size: 12.8px; line-height: 1; font-weight: 400; }
.fd-history-avatar[data-size="16"] { width: 16px; height: 16px; font-size: 6.4px; }
.fd-history-avatar[data-size="40"] { width: 40px; height: 40px; font-size: 16px; }

/* The change: who, what, when, then each field with its new value and the one it replaced. */
.fd-history-detail-head { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; column-gap: 8px; align-items: center; min-height: 57px; padding: 8px 1px 8px 9px; border-block-end: 1px solid var(--fd-border); color: var(--fdh-ink); }
.fd-history-detail-head > div { display: grid; min-width: 0; overflow-wrap: anywhere; }
.fd-history-detail-name { font-weight: 600; }
.fd-history-detail-head > .fd-history-when { align-self: start; padding-block-start: 2px; font-size: 12px; color: var(--fd-muted); white-space: nowrap; }
.fd-history-fields { margin: 0; padding: 20px 16px 16px 17px; }
.fd-history-field { display: grid; grid-template-columns: 168px minmax(0, 1fr); align-items: start; margin-block-end: 8px; }
.fd-history-field > dt { color: var(--fdh-ink); overflow-wrap: anywhere; padding-inline-end: 8px; }
.fd-history-field > dd { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; min-width: 0; }
.fd-history-chip { display: inline-flex; align-items: center; gap: 7px; max-width: 100%; padding: 2.5px 8px; color: var(--fdh-ink); overflow-wrap: anywhere; white-space: pre-wrap; }
.fd-history-new { background: var(--fd-history-new, color-mix(in srgb, #5fd255 20%, var(--fd-surface))); }
.fd-history-old { background: var(--fdh-picked); }
.fd-history-old s { text-decoration-thickness: 1px; }
.fd-history-comment { padding: 20px 16px 16px 17px; overflow-wrap: anywhere; }
.fd-history-comment p { margin: 0 0 8px; }
.fd-history-comment img { max-width: 100%; height: auto; }

/* The filter's menu, under its button at the heading's end. */
.fd-history-menu {
  position: absolute; top: calc(100% - 2px); inset-inline-end: 10px; z-index: 30; min-width: 200px; padding: 0; background: var(--fd-surface); color: var(--fd-text);
  border-radius: 4px; box-shadow: 0 3.2px 7.2px rgba(0, 0, 0, 0.132), 0 0.6px 1.8px rgba(0, 0, 0, 0.108);
}
.fd-history-menu-item { display: flex; align-items: center; gap: 12px; height: 31px; padding: 0 16px 0 14px; cursor: pointer; white-space: nowrap; }
.fd-history-menu-item:hover, .fd-history-menu-item:focus { background: var(--fdh-hover); }
.fd-history-menu-item[aria-checked="false"] .fd-icon { visibility: hidden; }

@container fd-history (max-width: 759.98px) {
  .fd-history-changes > .fd-history-head-row, .fd-history-panes { grid-template-columns: minmax(0, 1fr); }
  .fd-history[data-fit] .fd-history-panes, .fd-history-panes { height: auto; }
  .fd-history-list { max-height: 360px; }
  .fd-history-detail { border-inline-start: 0; border-block-start: 1px solid var(--fd-history-divider, color-mix(in srgb, var(--fd-text) 42.4%, var(--fd-surface))); overflow: visible; }
  .fd-history-field { grid-template-columns: minmax(0, 1fr); gap: 4px; }
  /* What the change did in full, its date under it. */
  .fd-history-detail-head { grid-template-columns: 40px minmax(0, 1fr); }
  .fd-history-detail-head > .fd-history-when { grid-column: 2; padding: 0; }
}
`;

/** Puts the History tab's look in the document once. */
export function installHistoryStyles(doc: Document): void {
  if (doc.getElementById('fd-history-styles')) return;
  const style = doc.createElement('style');
  style.id = 'fd-history-styles';
  style.textContent = HISTORY_STYLES;
  doc.head.append(style);
}
