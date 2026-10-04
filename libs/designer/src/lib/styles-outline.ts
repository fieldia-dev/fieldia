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
.fd-outline-row .fd-outline-kind { font-size: inherit; color: var(--fd-muted); max-width: none; }
.fd-outline-row[aria-selected="true"] .fd-outline-kind { color: inherit; opacity: 0.8; }
.fd-outline-row .fd-outline-required .fd-dicon { width: 11px; height: 11px; }
.fd-outline-required, .fd-outline-badge { flex: none; display: inline-flex; color: var(--fd-muted); }
.fd-outline-badge { font-size: 11px; font-variant-numeric: tabular-nums; }
.fd-outline-help { margin: 6px 4px 2px; color: var(--fd-muted); font-size: 12px; line-height: 1.45; }
.fd-outline-said { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (prefers-reduced-motion: reduce) { .fd-outline-row .fd-outline-twist .fd-dicon { transition: none; } }
`;
