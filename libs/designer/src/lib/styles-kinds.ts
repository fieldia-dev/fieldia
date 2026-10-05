/**
 * The designer's part for the newer kinds of question: their settings in the
 * picked question — pictures and points beside each option, a matrix's rows
 * and columns, a repeating group's cards — and how their closed cards read.
 * Appended to the designer's stylesheet.
 */
export const DESIGNER_KINDS_CSS = /* css */ `
/* ---- the newer kinds' settings ------------------------------------------- */
.fd-kind-block { display: grid; gap: 6px; width: 100%; justify-items: start; }
.fd-kind-matrix { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 220px), 1fr)); gap: 12px 28px; width: 100%; }
.fd-kind-items, .fd-kind-pictures, .fd-kind-points { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; width: 100%; }
.fd-kind-item-row { display: grid; grid-template-columns: minmax(0, 1fr) 28px; gap: 6px; align-items: center; }
.fd-inline-input.fd-kind-item { width: 100%; }
.fd-kind-picture { display: grid; grid-template-columns: 48px minmax(5em, 11em) minmax(0, 1fr) auto; gap: 6px 12px; align-items: center; }
.fd-kind-thumb { display: block; width: 48px; height: 36px; overflow: hidden; border-radius: 4px; background: var(--fd-page); border: 1px dashed var(--fd-border-strong); }
.fd-kind-thumb:has(img) { border-style: solid; border-color: var(--fd-border); }
.fd-kind-thumb img { display: block; width: 100%; height: 100%; object-fit: cover; }
.fd-kind-picture-name, .fd-kind-points-name { min-width: 0; color: var(--fd-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-inline-input.fd-kind-picture-address { width: 100%; min-width: 0; }
.fd-kind-upload { font-size: 13px; }
.fd-kind-points-row { display: grid; grid-template-columns: minmax(0, 16em) 8ch; gap: 12px; align-items: center; }
.fd-kind-points-box { display: contents; }
.fd-inline-input.fd-inline-number { width: 8ch; }
.fd-inline-input.fd-inline-words { width: 16ch; }
.fd-inline-toggle { gap: 10px; color: var(--fd-text); }
@container (max-width: 520px) {
  .fd-kind-picture { grid-template-columns: 48px minmax(0, 1fr) auto; }
  .fd-kind-picture-name { grid-column: 2 / -1; }
  .fd-kind-picture-address { grid-column: 2; }
}
/* Closed cards of the newer kinds: a line to sign on, an address's lines, tags to pick, a card to repeat. */
.fd-q-preview.fd-q-preview-signature { width: min(70%, 360px); padding-block-start: 38px; font-size: 12.5px; border-block-end-style: solid; }
.fd-q-preview-lines { display: grid; gap: 2px; width: min(80%, 520px); }
.fd-q-preview-part { color: var(--fd-muted); font-size: 14px; padding-block: 8px 6px; border-block-end: 1px dotted color-mix(in srgb, var(--fd-text) 38%, transparent); }
.fd-q-preview-tags { display: flex; flex-wrap: wrap; gap: 6px; }
.fd-q-preview-tag { padding: 2px 10px; border-radius: 999px; border: 1px solid var(--fd-border); font-size: 13px; color: var(--fd-text); }
.fd-q-preview-cards { display: grid; gap: 8px; justify-items: start; width: min(80%, 520px); }
.fd-q-preview-card { display: grid; gap: 2px; width: 100%; box-sizing: border-box; padding: 8px 12px 10px; border: 1px solid var(--fd-border); border-radius: 6px; }
.fd-q-preview-card-title { font-size: 13px; font-weight: 600; color: var(--fd-text); }
.fd-q-preview-add { font-size: 13px; color: var(--fd-accent); }
/* The structures' settings: a signature's inks, each a dot of its colour. */
.fd-pen-ink { display: inline-flex; align-items: center; gap: 6px; }
.fd-pen-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--fd-ink); box-shadow: 0 0 0 1px var(--fd-surface), 0 0 0 2px var(--fd-border); }
.fd-q-preview-under { font-size: 12.5px; color: var(--fd-muted); }
`;
