import { LEAFLET_CSS } from './leaflet-css';

/**
 * The maps in Fieldia's colours: every colour a token, so a theme, a host's
 * tokens and the dark scheme reach the map's buttons, search, shapes and
 * grips. Fixed on purpose: the veil over the map that asks for two fingers
 * or Ctrl (white words on a dark veil, as an image's caption has them).
 */
export const MAP_CSS = `
.fd-map-field { display: grid; gap: 8px; min-width: 0; }
.fd-map-tools { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; min-width: 0; }
.fd-map-tools .fd-button { min-height: 32px; padding-inline: 10px; }
.fd-map-tools .fd-button[aria-pressed="true"] { background: var(--fd-accent-soft); border-color: var(--fd-accent); color: var(--fd-accent); }
.fd-map-tools .fd-button svg { width: 16px; height: 16px; flex: none; }
.fd-map-search { position: relative; flex: 1 1 220px; min-width: 0; }
.fd-map-results {
  position: absolute; inset-inline: 0; top: calc(100% + 4px); z-index: 1100; margin: 0; padding: 4px; list-style: none;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16); max-height: 240px; overflow: auto;
}
.fd-map-results [role="option"] { padding: 6px 8px; border-radius: 4px; cursor: pointer; line-height: 1.35; }
.fd-map-results [role="option"][aria-selected="true"], .fd-map-results [role="option"]:hover { background: var(--fd-accent-soft); }
.fd-map-results .fd-map-results-note { padding: 6px 8px; color: var(--fd-muted); cursor: default; }
.fd-map-box {
  position: relative; height: var(--fd-map-height, 280px); min-height: 160px; overflow: hidden; isolation: isolate;
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-fill);
}
.fd-map-box.leaflet-container:focus { outline: none; }
.fd-map-box.leaflet-container[data-keys]:focus { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-map-box.leaflet-container { font: inherit; background: var(--fd-fill); }
.fd-map-zoom { position: absolute; top: 8px; z-index: 1000; display: grid; gap: 4px; }
.fd-map-zoom[data-side="right"] { right: 8px; }
.fd-map-zoom[data-side="left"] { left: 8px; }
.fd-map-zoom button {
  width: 32px; height: 32px; display: grid; place-items: center; padding: 0; cursor: pointer; font: 600 18px/1 system-ui, sans-serif;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.fd-map-zoom button:hover { color: var(--fd-accent); border-color: var(--fd-accent); }
.fd-map-zoom button:focus-visible, .fd-map-hint button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-map-credits {
  position: absolute; right: 0; bottom: 0; z-index: 1000; max-width: 72%; padding: 1px 6px; font-size: 11px; line-height: 1.5;
  background: color-mix(in srgb, var(--fd-surface) 88%, transparent); color: var(--fd-text); border-top-left-radius: 4px;
}
.fd-map-credits a { color: inherit; }
.fd-map-logo { position: absolute; left: 6px; bottom: 4px; z-index: 1000; display: inline-flex; align-items: center; text-decoration: none; }
.fd-map-logo img { height: 18px; width: auto; display: block; }
.fd-map-logo span {
  font: 700 12px/1.4 system-ui, sans-serif; padding: 0 5px; border-radius: 3px;
  background: color-mix(in srgb, var(--fd-surface) 88%, transparent); color: var(--fd-text);
}
.fd-map-veil {
  position: absolute; inset: 0; z-index: 1001; display: grid; place-items: center; padding: 16px; text-align: center;
  background: rgba(0, 0, 0, 0.5); color: #fff; font-weight: 600; opacity: 0; pointer-events: none; transition: opacity 0.2s;
}
.fd-map-veil[data-show] { opacity: 1; }
.fd-map-crosshair { position: absolute; left: 50%; top: 50%; width: 22px; height: 22px; margin: -11px 0 0 -11px; z-index: 900; pointer-events: none; display: none; }
.fd-map-crosshair::before, .fd-map-crosshair::after { content: ""; position: absolute; background: var(--fd-accent); box-shadow: 0 0 0 1px var(--fd-surface); }
.fd-map-crosshair::before { left: 10px; top: 0; width: 2px; height: 22px; }
.fd-map-crosshair::after { top: 10px; left: 0; height: 2px; width: 22px; }
.fd-map-box[data-keys]:focus .fd-map-crosshair { display: block; }
.fd-map-hint {
  position: absolute; top: 8px; left: 8px; right: 52px; z-index: 1000; display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center;
  padding: 6px 10px; font-size: 13px; line-height: 1.4; background: var(--fd-surface); color: var(--fd-text);
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); box-shadow: 0 2px 8px rgba(0, 0, 0, 0.14);
}
.fd-map-box[data-side="left"] .fd-map-hint { left: 52px; right: 8px; }
.fd-map-hint p { margin: 0; flex: 1 1 180px; min-width: 0; }
.fd-map-hint .fd-button { min-height: 28px; padding: 2px 10px; }
.fd-map-coords { display: flex; flex-wrap: wrap; gap: 6px 12px; align-items: center; }
.fd-map-coords label { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--fd-muted); }
.fd-map-coords .fd-input { width: 12ch; font-variant-numeric: tabular-nums; }
.fd-map-coords .fd-input[aria-invalid="true"] { border-color: var(--fd-error); }
.fd-map-note { margin: 0; font-size: 12.5px; color: var(--fd-muted); }
.fd-map-note[data-tone="error"] { color: var(--fd-error); }
.fd-map-pin { width: 28px; height: 40px; }
.fd-map-pin svg { display: block; width: 28px; height: 40px; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3)); }
.fd-map-pin .fd-map-pin-body { fill: var(--fd-accent); stroke: var(--fd-surface); stroke-width: 1.5; }
.fd-map-pin .fd-map-pin-dot { fill: var(--fd-surface); }
.fd-map-pin:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; border-radius: 4px; }
path.fd-map-shape { stroke: var(--fd-accent); fill: var(--fd-accent); stroke-width: 2; fill-opacity: 0.16; }
path.fd-map-shape.fd-map-movable { cursor: move; }
path.fd-map-trace { stroke: var(--fd-accent); fill: var(--fd-accent); stroke-width: 2; fill-opacity: 0.08; stroke-dasharray: 6 5; pointer-events: none; }
.fd-map-grip { width: 24px; height: 24px; display: grid; place-items: center; cursor: grab; }
.fd-map-grip::after {
  content: ""; width: 12px; height: 12px; border-radius: 50%; box-sizing: border-box;
  background: var(--fd-surface); border: 2px solid var(--fd-accent); box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.fd-map-grip[data-closes]::after { width: 18px; height: 18px; background: var(--fd-accent); border-color: var(--fd-surface); }
.fd-map-grip:focus-visible { outline: none; }
.fd-map-grip:focus-visible::after { box-shadow: 0 0 0 3px var(--fd-focus); }
.fd-map-field select.fd-input { width: auto; max-width: 100%; }
/* One finger scrolls the page past a map, as on any page; two move it. While a shape is drawn, the map takes every touch. */
.fd-map-box.leaflet-container, .fd-map-box.leaflet-touch-drag.leaflet-touch-zoom { touch-action: pan-x pan-y; }
.fd-map-box.leaflet-container[data-drawing] { touch-action: none; }
.fd-map-box .leaflet-marker-draggable { touch-action: none; }
.fd-map-grip-add::after { width: 10px; height: 10px; opacity: 0.7; }
`;

/** Leaflet's own stylesheet and the maps' own, once per document. */
export function installMapStyles(doc: Document) {
  if (doc.getElementById('fieldia-map-styles')) return;
  const leaflet = doc.createElement('style');
  leaflet.id = 'fieldia-leaflet-styles';
  leaflet.textContent = LEAFLET_CSS;
  const own = doc.createElement('style');
  own.id = 'fieldia-map-styles';
  own.textContent = MAP_CSS;
  // Before the page's own styles, so an app's rule for a map wins over these.
  doc.head.prepend(leaflet, own);
}
