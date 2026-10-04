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
`;
