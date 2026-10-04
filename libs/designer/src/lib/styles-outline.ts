/**
 * The outline's look, as the approved mockup draws it: rows indented by how
 * deep they sit, an arrow that turns as a row folds, the picked rows washed
 * in the accent, a field's kind after its name, and a group's columns in a
 * badge at the end.
 */
export const DESIGNER_OUTLINE_CSS = /* css */ `
.fd-outline > * { min-width: 0; }
.fd-outline .fd-outline-tree { grid-template-columns: minmax(0, 1fr); font-size: 13px; }
.fd-outline-row {
  display: flex; align-items: center; gap: 6px; min-height: 28px; box-sizing: border-box; padding: 4px 6px;
  padding-inline-start: calc(2px + var(--fd-level, 0) * 14px); border-radius: 6px; cursor: pointer; user-select: none; position: relative; color: var(--fd-text);
}
.fd-outline-row:hover { background: var(--fd-page); }
.fd-outline-row[aria-selected="true"] { background: var(--fd-accent-soft); color: var(--fd-accent); }
.fd-outline-row:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -2px; }
.fd-outline-row .fd-dicon { width: 14px; height: 14px; flex: none; color: var(--fd-muted); }
.fd-outline-row[aria-selected="true"] .fd-dicon { color: var(--fd-accent); }
.fd-outline-twist { width: 14px; height: 14px; flex: none; display: grid; place-items: center; }
.fd-outline-row .fd-outline-twist .fd-dicon { width: 10px; height: 10px; transition: transform 120ms; }
.fd-outline-row[aria-expanded="false"] .fd-outline-twist .fd-dicon { transform: rotate(-90deg); }
.fd-outline-row[aria-expanded="false"]:dir(rtl) .fd-outline-twist .fd-dicon { transform: rotate(90deg); }
.fd-outline-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
/* On a right-to-left page a name in a left-to-right language sits by its icon, its start in view. */
.fd-outline-row:dir(rtl) .fd-outline-name { text-align: right; }
.fd-outline-row .fd-outline-kind { font-size: inherit; color: var(--fd-muted); max-width: none; }
.fd-outline-row[aria-selected="true"] .fd-outline-kind { color: inherit; opacity: 0.8; }
.fd-outline-row .fd-outline-required .fd-dicon { width: 11px; height: 11px; }
.fd-outline-required, .fd-outline-badge { flex: none; display: inline-flex; color: var(--fd-muted); }
.fd-outline-badge { font-size: 11px; font-variant-numeric: tabular-nums; }
.fd-outline-help { margin: 6px 4px 2px; color: var(--fd-muted); font-size: 12px; line-height: 1.5; }
.fd-outline-help kbd { font: 11px ui-monospace, SFMono-Regular, Menlo, monospace; padding: 0 4px; border: 1px solid var(--fd-border); border-radius: 4px; background: var(--fd-page); color: var(--fd-text); }
.fd-outline-said { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
/* Dragging rows: what is carried dims; one line where it would go, as far in as it would land, a ring at its start; or the row it would go into washed. */
.fd-outline .fd-outline-tree { position: relative; }
.fd-outline-dragging, .fd-outline-dragging .fd-outline-row { cursor: grabbing; }
.fd-outline-row.fd-outline-carried { opacity: 0.4; }
.fd-outline-dragging .fd-outline-row:hover:not(.fd-outline-into):not([aria-selected="true"]) { background: none; }
.fd-outline-row.fd-outline-into { background: var(--fd-accent-soft); box-shadow: inset 0 0 0 1.5px var(--fd-accent); }
.fd-outline-line {
  position: absolute; z-index: 2; height: 2px; margin-block-start: -1px; pointer-events: none; border-radius: 2px; background: var(--fd-accent);
  inset-inline-start: calc(20px + var(--fd-drop-level, 0) * 14px); inset-inline-end: 4px;
}
.fd-outline-line::before {
  content: ""; position: absolute; inset-inline-start: -7px; inset-block-start: -3px; width: 8px; height: 8px; box-sizing: border-box;
  border-radius: 50%; border: 2px solid var(--fd-accent); background: var(--fd-surface);
}
.fd-outline-line.fd-outline-line-refused { background: var(--fd-error); }
.fd-outline-line.fd-outline-line-refused::before { border-color: var(--fd-error); }
/* The chip by the pointer: what is carried, and where it would go — or why not — as the canvas's says. */
.fd-outline-chip {
  position: fixed; z-index: 90; pointer-events: none; display: inline-flex; flex-wrap: wrap; align-items: center; gap: 2px 6px; width: max-content; max-width: 280px;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-accent); border-radius: 7px; padding: 5px 9px;
  font-size: 12.5px; font-weight: 600; line-height: 1.35; box-shadow: 0 10px 26px rgba(15, 23, 42, 0.18);
}
.fd-outline-chip-where { flex-basis: 100%; font-weight: 500; font-size: 11.5px; color: var(--fd-muted); }
.fd-outline-chip.fd-outline-refused { border-color: var(--fd-error); }
.fd-outline-chip.fd-outline-refused .fd-outline-chip-where { color: var(--fd-error); }
/* What a copy, a cut or a paste did: a line at the foot of the window a moment, then gone. */
.fd-clipboard-said {
  position: fixed; z-index: 85; bottom: 20px; left: 50%; transform: translate(-50%, 8px); max-width: min(460px, calc(100vw - 32px)); box-sizing: border-box;
  padding: 8px 14px; border-radius: 8px; background: var(--fd-text); color: var(--fd-surface); font-size: 13px; line-height: 1.4;
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.22); opacity: 0; pointer-events: none; transition: opacity 160ms, transform 160ms;
}
.fd-clipboard-said.fd-clipboard-shown { opacity: 1; transform: translate(-50%, 0); }
/* The sheet of shortcuts: every key, in groups, with a box to find one. */
.fd-keys-backdrop { z-index: 80; place-items: start center; padding-block-start: 8vh; }
.fd-keys {
  width: min(640px, 100%); max-height: min(80vh, 720px); box-sizing: border-box; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; overflow: hidden;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: 12px; box-shadow: 0 24px 64px rgba(15, 20, 25, 0.3);
}
.fd-keys-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 14px 4px 18px; }
.fd-keys-title { margin: 0; font-size: 16px; font-weight: 650; }
.fd-keys-close { all: unset; box-sizing: border-box; width: 32px; height: 32px; border-radius: 7px; display: grid; place-items: center; cursor: pointer; color: var(--fd-muted); }
.fd-keys-close:hover { background: var(--fd-page); color: var(--fd-text); }
.fd-keys-close:focus-visible { outline: 2px solid var(--fd-focus); }
.fd-keys-close .fd-dicon { transform: rotate(45deg); }
.fd-keys .fd-keys-find { margin: 6px 18px 10px; font: inherit; font-size: 14px; padding: 8px 10px; border: 1px solid var(--fd-border); border-radius: 8px; background: var(--fd-surface); color: inherit; min-width: 0; }
.fd-keys .fd-keys-find:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -1px; }
.fd-keys-groups { overflow: auto; padding: 0 18px 16px; display: grid; gap: 18px; align-content: start; }
.fd-keys-group h3 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--fd-muted); }
.fd-keys-when { margin: 2px 0 6px; font-size: 12px; color: var(--fd-muted); }
.fd-keys-group dl { margin: 0; display: grid; }
.fd-keys-row { display: grid; grid-template-columns: minmax(0, 15em) minmax(0, 1fr); gap: 4px 14px; align-items: baseline; padding: 7px 0; border-block-start: 1px solid var(--fd-border); }
.fd-keys-row dt, .fd-keys-row dd { margin: 0; font-size: 13.5px; line-height: 1.5; }
.fd-keys-row dt { color: var(--fd-muted); }
.fd-keys kbd { font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; color: var(--fd-text); padding: 1px 6px; border: 1px solid var(--fd-border); border-block-end-width: 2px; border-radius: 5px; background: var(--fd-page); white-space: nowrap; }
.fd-keys-none { margin: 0; padding: 4px 18px 18px; color: var(--fd-muted); }
@media (max-width: 520px) { .fd-keys-row { grid-template-columns: minmax(0, 1fr); } .fd-keys-backdrop { padding-block-start: 16px; } }
@media (prefers-reduced-motion: reduce) { .fd-outline-row .fd-outline-twist .fd-dicon, .fd-clipboard-said { transition: none; } }
`;
