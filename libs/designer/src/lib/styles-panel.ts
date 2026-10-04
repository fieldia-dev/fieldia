/**
 * The panel beside the canvas, as the approved mockup draws it: a head saying
 * what is picked, the tabs under it, then one tab's settings — each a name in
 * small bold words over its control, with a line of help under it where it
 * needs one. Logical properties throughout, so right to left mirrors on its own.
 */
export const DESIGNER_PANEL_CSS = /* css */ `
/* ---- the panel: what is picked, its tabs, one tab's settings ---- */
.fd-properties.fd-inspector { display: flex; flex-direction: column; padding: 0; gap: 0; overflow: hidden; }
.fd-insp-head { flex: none; padding: 12px 14px 8px; display: grid; gap: 2px; border-block-end: 1px solid var(--fd-border); min-width: 0; }
.fd-insp-kind { display: flex; align-items: center; gap: 6px; min-width: 0; font-size: 11px; font-weight: 700; letter-spacing: 0.07em; text-transform: uppercase; color: var(--fd-muted); }
.fd-insp-kind > .fd-panel-title { font-size: inherit; font-weight: inherit; letter-spacing: inherit; color: inherit; margin: 0; }
.fd-insp-note { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fd-insp-icon { display: inline-flex; flex: none; }
.fd-insp-icon > .fd-dicon { width: 13px; height: 13px; }
.fd-insp-name { font-size: 15px; font-weight: 600; color: var(--fd-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-insp-top { flex: none; }
.fd-insp-top:empty { display: none; }
.fd-insp-tabs { flex: none; display: flex; padding-inline: 8px; border-block-end: 1px solid var(--fd-border); overflow-x: auto; scrollbar-width: none; }
.fd-insp-tab {
  all: unset; box-sizing: border-box; cursor: pointer; white-space: nowrap; padding: 9px 8px 8px;
  font-size: 13px; font-weight: 600; color: var(--fd-muted); border-block-end: 2px solid transparent;
}
.fd-insp-tab:hover { color: var(--fd-text); }
.fd-insp-tab[aria-selected="true"] { color: var(--fd-accent); border-block-end-color: var(--fd-accent); }
.fd-insp-tab:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: -3px; border-radius: 6px; }
.fd-insp-panels { flex: 1 1 auto; min-height: 0; overflow: auto; }
.fd-insp-panel { display: grid; gap: 14px; align-content: start; padding: 12px 14px 18px; min-width: 0; }
.fd-insp-panel > .fd-props { gap: 14px; }

/* A setting: its name over its control, a line of help under it. */
.fd-properties .fd-prop { gap: 6px; min-width: 0; }
.fd-properties .fd-prop-name { font-size: 12.5px; font-weight: 600; color: var(--fd-text); }
.fd-properties .fd-properties-hint { font-size: 12px; line-height: 1.45; }
.fd-properties .fd-kind-note { margin-block-start: 0; }
.fd-properties .fd-props-actions { border-block-start: 0; padding-block-start: 0; gap: 6px; }
.fd-properties .fd-q-required { display: inline-flex; align-items: center; gap: 7px; font-weight: 600; font-size: 13px; cursor: pointer; }
.fd-properties .fd-q-required > input { width: 16px; height: 16px; margin: 0; accent-color: var(--fd-accent); }
.fd-insp-area { resize: vertical; min-height: 56px; font: inherit; }
.fd-insp-code {
  font: 12.5px/1.4 ui-monospace, "SF Mono", Menlo, Consolas, monospace; color: var(--fd-text); overflow-wrap: anywhere;
  padding: 6px 9px; border: 1px solid var(--fd-border); border-radius: 6px; background: var(--fd-page);
}
.fd-insp-chip {
  justify-self: start; display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: var(--fd-muted);
  background: var(--fd-page); border: 1px solid var(--fd-border); border-radius: 999px; padding: 1px 9px;
}
/* A setting gone to, from the search or Find anything: pointed out a moment. */
.fd-set-found { animation: fd-set-found 1.2s ease; border-radius: 6px; }
@keyframes fd-set-found { from { box-shadow: 0 0 0 4px var(--fd-accent-soft); background: var(--fd-accent-soft); } to { box-shadow: 0 0 0 4px transparent; background: transparent; } }

/* A choice of a few, side by side, as wide as the panel. */
.fd-properties .fd-insp-seg { width: 100%; box-sizing: border-box; border: 1px solid var(--fd-border); }
.fd-properties .fd-insp-seg > .fd-seg-button { min-height: 28px; font-size: 13px; font-weight: 600; display: grid; place-items: center; padding: 4px; }
.fd-properties .fd-insp-seg > .fd-seg-button[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) { .fd-set-found { animation: none; } }
`;
