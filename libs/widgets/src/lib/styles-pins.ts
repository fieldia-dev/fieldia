import { installPartStyles, PART_RANK } from './styles';

/**
 * Pins on a picture (pins.ts): the picture as wide as its place allows, each pin a numbered disc centred on its point,
 * the keyboard's cross, and the numbered list of pins with each note's box — beside the picture where the form is wide
 * enough, under it on a phone. The pins part's sheet, put in its
 * place among Fieldia's the first time a page shows pins (installPartStyles, PART_RANK.pins): before the themes', which
 * reshape the note boxes, the buttons and their focus. The pins are the accent's, so dark follows; a picture is never
 * mirrored, right to left too.
 */
export const PINS_CSS = /* css */ `
.fd-pins { display: grid; gap: 8px; min-width: 0; }
.fd-pins-stage { position: relative; display: inline-block; justify-self: start; max-width: 100%; line-height: 0; border-radius: var(--fd-control-radius); cursor: crosshair; touch-action: manipulation; direction: ltr; }
.fd-pins-readonly .fd-pins-stage { cursor: default; }
.fd-pins-stage:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-pins-image { display: block; max-width: 100%; height: auto; border-radius: inherit; box-shadow: 0 0 0 1px var(--fd-border); user-select: none; -webkit-user-drag: none; }
.fd-pin {
  position: absolute; translate: -50% -50%; display: grid; place-items: center; width: 26px; height: 26px; padding: 0; border-radius: 50%;
  font: 600 12px/1 inherit; font-variant-numeric: tabular-nums; color: #fff; background: var(--fd-accent); border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45); cursor: grab; touch-action: none;
}
.fd-pin:active { cursor: grabbing; }
.fd-pins-readonly .fd-pin { cursor: default; }
.fd-pin:focus-visible { outline: 3px solid var(--fd-focus); outline-offset: 2px; }
/* The keyboard's cross, where a pin goes on Enter: shown while the picture is worked by keys. */
.fd-pins-cross { position: absolute; display: none; width: 28px; height: 28px; translate: -50% -50%; pointer-events: none; }
.fd-pins-cross::before, .fd-pins-cross::after { content: ""; position: absolute; background: var(--fd-focus); box-shadow: 0 0 0 1px #fff; }
.fd-pins-cross::before { inset-block: 0; left: 13px; width: 2px; }
.fd-pins-cross::after { inset-inline: 0; top: 13px; height: 2px; }
.fd-pins-stage:focus-visible .fd-pins-cross, .fd-pins-keyed:focus .fd-pins-cross { display: block; }
.fd-pins-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
.fd-pins-list:empty { display: none; }
.fd-pin-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; min-width: 0; }
.fd-pin-badge { flex: none; display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; font-size: 12px; font-weight: 600; color: #fff; background: var(--fd-accent); }
.fd-pin-at { flex: none; min-width: 14.5em; color: var(--fd-muted); font-size: 13px; }
.fd-pin-note { flex: 1 1 12em; min-width: 0; }
.fd-pin-note-words { flex: 1 1 12em; overflow-wrap: anywhere; }
.fd-pin-remove { flex: none; width: 32px; height: 32px; border: none; border-radius: 999px; background: none; color: var(--fd-muted); font-size: 20px; line-height: 1; cursor: pointer; }
.fd-pin-remove:hover { color: var(--fd-error); background: var(--fd-error-soft); }
.fd-pins-none:not([hidden]) + .fd-announce, .fd-pins-readonly .fd-pins-help { margin: 0; }
/* Where there is room, the list beside the picture: a pin put, its note's box is in sight, never scrolled to below. */
@container (min-width: 720px) {
  .fd-pins { grid-template-columns: fit-content(65%) minmax(16em, 1fr); align-items: start; column-gap: 24px; }
  .fd-pins > :is(.fd-pins-stage, .fd-pins-missing) { grid-column: 1; grid-row: 1 / span 4; }
  .fd-pins > :is(.fd-pins-help, .fd-pins-list, .fd-pins-none, .fd-announce) { grid-column: 2; }
}
`;

/** The pins' sheet in a document, once, in its place among Fieldia's (PART_RANK.pins). */
export function installPinsStyles(doc: Document): void {
  installPartStyles(doc, 'fieldia-pins-styles', PINS_CSS, PART_RANK.pins);
}
