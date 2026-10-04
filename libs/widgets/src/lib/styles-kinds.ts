/**
 * The question kinds' part of the stylesheet: a signature pad, a slider, tags
 * from a list, pictures to choose from, a ranking, an address and a repeating
 * group of cards. Appended to Fieldia's stylesheet, scoped and written with
 * logical properties as the rest of it is.
 */
export const KINDS_CSS = /* css */ `
/* ---- question kinds -------------------------------------------------------- */
/* A signature: a pad with a line to sign on, a box to type a name in instead, and Clear. */
.fd-signature { display: grid; gap: 8px; justify-items: start; width: 100%; max-width: 480px; min-width: 0; }
.fd-signature-box {
  position: relative; width: 100%; aspect-ratio: 10 / 3; border: 1px dashed var(--fd-border-strong);
  border-radius: var(--fd-control-radius); background: #fff; overflow: hidden;
}
.fd-signature-box:has(.fd-signature-pad:not([hidden]):not(.fd-signature-locked)):hover { border-color: var(--fd-accent); }
.fd-signature-pad, .fd-signature-image { display: block; width: 100%; height: 100%; }
.fd-signature-pad { touch-action: none; cursor: crosshair; }
.fd-signature-pad.fd-signature-locked { cursor: default; }
.fd-signature-image { object-fit: contain; }
.fd-signature-hint {
  position: absolute; inset-inline: 18px; inset-block-end: 16px; padding-block-start: 4px; pointer-events: none;
  border-block-start: 1px solid var(--fd-border-strong); color: var(--fd-muted); font-size: 12.5px;
}
.fd-signature-tools { display: flex; flex-wrap: wrap; gap: 8px 12px; align-items: center; width: 100%; }
.fd-signature-typed { flex: 1 1 200px; min-width: 0; }
/* A slider: the value beside the track and its ends under it; dimmed until it is slid. */
.fd-slider { display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 14px; row-gap: 0; align-items: center; width: 100%; max-width: 440px; min-width: 0; }
.fd-slider-track { display: contents; }
.fd-slider-input { width: 100%; min-width: 0; height: 26px; margin: 0; accent-color: var(--fd-accent); cursor: pointer; }
.fd-slider-input:disabled { cursor: default; }
.fd-slider-value { min-width: 2.5em; text-align: end; font-variant-numeric: tabular-nums; font-weight: 600; }
.fd-slider-ends { grid-column: 1; display: flex; justify-content: space-between; gap: 12px; font-size: 12.5px; color: var(--fd-muted); font-variant-numeric: tabular-nums; }
.fd-slider-empty .fd-slider-input { opacity: 0.5; }
.fd-slider-empty .fd-slider-value { color: var(--fd-muted); font-weight: 400; }
.fd-slider .fd-choice-clear { grid-column: 1 / -1; }
`;
