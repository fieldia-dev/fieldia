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
.fd-map-results [role="option"] { padding: 6px 8px; border-radius: 4px; cursor: pointer; line-height: 1.35; display: grid; gap: 1px; }
.fd-map-result-name { color: var(--fd-text); font-weight: 600; overflow-wrap: anywhere; }
.fd-map-result-detail { color: var(--fd-muted); font-size: 12.5px; overflow-wrap: anywhere; }
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
path.fd-map-accuracy { stroke: var(--fd-accent); fill: var(--fd-accent); stroke-width: 1; fill-opacity: 0.08; stroke-dasharray: 4 4; pointer-events: none; }
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
/* Each image overlaps the next by a pixel (leaflet.ts): drawn plainly over it, not added to it as Leaflet's own seam fix adds light. */
.fd-map-box.leaflet-container img.leaflet-tile { mix-blend-mode: normal; }
/* The tools under the zoom: drawn as its buttons are, pressed while on. */
.fd-map-zoom .fd-map-tool { margin-top: 4px; }
.fd-map-zoom .fd-map-tool svg { width: 18px; height: 18px; }
.fd-map-zoom .fd-map-tool[aria-pressed="true"] { color: var(--fd-accent); border-color: var(--fd-accent); background: var(--fd-accent-soft); }
.fd-map-zoom .fd-map-tool[hidden] { display: none; }
.fd-map-box.fd-map-fixed { position: fixed; inset: 0; z-index: 2147483000; height: auto; border-radius: 0; }
.fd-map-box[data-full] { border-radius: 0; }
.fd-map-box[data-measuring] .fd-map-mark { pointer-events: none; }
`;

/** The maps' own stylesheet, once per document: the tools, the search and the box are drawn before Leaflet has loaded. */
export function installMapStyles(doc: Document) {
  if (doc.getElementById('fieldia-map-styles')) return;
  const own = doc.createElement('style');
  own.id = 'fieldia-map-styles';
  own.textContent = MAP_CSS;
  // Before the page's own styles, so an app's rule for a map wins over these.
  doc.head.prepend(own);
}

/** Leaflet's stylesheet, once per document, before the maps' own (which add to it): it comes with Leaflet. */
export function installLeafletStyles(doc: Document, css: string) {
  if (doc.getElementById('fieldia-leaflet-styles')) return;
  const leaflet = doc.createElement('style');
  leaflet.id = 'fieldia-leaflet-styles';
  leaflet.textContent = css;
  const own = doc.getElementById('fieldia-map-styles');
  if (own) own.before(leaflet);
  else doc.head.prepend(leaflet);
}

/**
 * A list's map, on top of the maps' own: each record's pin in its look and
 * tone, bubbles of pins that crowd, the card a pin opens, "Search this area".
 * Its own stylesheet, so a form with only a place or an area never carries it.
 */
export const LIST_MAP_CSS = `
.fd-map-list { min-width: 0; }
.fd-map-mark { overflow: visible; }
.fd-map-mark:focus { outline: none; }
/* Each mark is as large as its face, stood on its point by its foot, its middle, or the tip of a label's tail. */
.fd-map-mark.fd-map-foot { translate: -50% -100%; }
.fd-map-mark.fd-map-middle { translate: -50% -50%; }
.fd-map-mark.fd-map-tail { translate: -50% calc(-100% - 6px); }
.fd-map-face {
  --fd-map-tone: var(--fd-accent); --fd-map-on: var(--fd-accent-text);
  position: relative; box-sizing: border-box; cursor: pointer; transition: scale 0.12s;
}
.fd-map-face[data-tone] { --fd-map-on: var(--fd-surface); }
.fd-map-face[data-tone="info"] { --fd-map-tone: var(--fd-info); }
.fd-map-face[data-tone="success"] { --fd-map-tone: var(--fd-success); }
.fd-map-face[data-tone="warning"] { --fd-map-tone: var(--fd-warning); }
.fd-map-face[data-tone="danger"] { --fd-map-tone: var(--fd-error); }
.fd-map-face[data-tone="muted"] { --fd-map-tone: var(--fd-muted); }
.fd-map-face[data-stands="foot"] { transform-origin: 50% 100%; }
.fd-map-face[data-stands="middle"] { transform-origin: 50% 50%; }
.fd-map-face[data-hot], .fd-map-mark:hover .fd-map-face, .fd-map-bubble[data-hot], .fd-map-mark:hover .fd-map-bubble { scale: 1.12; }
.fd-map-mark:focus-visible .fd-map-face, .fd-map-mark:focus-visible .fd-map-bubble { outline: 2px solid var(--fd-focus); outline-offset: 3px; }
.fd-map-face-icon { display: block; }
.fd-map-face-icon svg { display: block; width: 100%; height: 100%; }
.fd-map-face[data-look="label"] {
  padding: 4px 9px; border-radius: 999px; font-weight: 700; font-size: 13px; line-height: 1.25; font-variant-numeric: tabular-nums;
  background: var(--fd-surface); color: var(--fd-text); border: 1.5px solid color-mix(in srgb, var(--fd-text) 20%, transparent); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28);
}
.fd-map-face[data-look="label"][data-tone] { color: var(--fd-map-tone); border-color: var(--fd-map-tone); }
.fd-map-face[data-look="label"]::after {
  content: ""; position: absolute; left: 50%; bottom: -5px; width: 8px; height: 8px; margin-left: -4px; transform: rotate(45deg);
  background: inherit; border: inherit; border-top: 0; border-left: 0;
}
.fd-map-face[data-look="label"]:is([data-hot], [data-chosen]), .fd-map-mark:hover .fd-map-face[data-look="label"] { background: var(--fd-map-tone); color: var(--fd-map-on); border-color: var(--fd-map-tone); }
.fd-map-face-text { display: block; max-width: 16ch; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.fd-map-face[data-look="pin"] { width: 30px; height: 40px; }
.fd-map-face[data-look="pin"] > svg { display: block; width: 30px; height: 40px; filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.3)); }
.fd-map-face-body { fill: var(--fd-map-tone); stroke: var(--fd-surface); stroke-width: 1.5; }
.fd-map-face[data-look="pin"] .fd-map-face-icon { position: absolute; left: 7px; top: 6px; width: 16px; height: 16px; color: var(--fd-map-on); }
.fd-map-face[data-look="pin"] .fd-map-face-icon:empty { left: 10px; top: 9px; width: 10px; height: 10px; border-radius: 50%; background: var(--fd-map-on); }
.fd-map-face[data-look="icon"] {
  width: 34px; height: 34px; display: grid; place-items: center; border-radius: 50%;
  background: var(--fd-map-tone); color: var(--fd-map-on); border: 2px solid var(--fd-surface); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
.fd-map-face[data-look="icon"] .fd-map-face-icon { width: 20px; height: 20px; }
.fd-map-face-turn { position: absolute; inset: -9px; pointer-events: none; }
.fd-map-face-turn::before { content: ""; position: absolute; left: 50%; top: 0; margin-left: -5px; border: 5px solid transparent; border-top: 0; border-bottom: 7px solid var(--fd-map-tone); }
.fd-map-face-photo {
  display: grid; place-items: center; width: 40px; height: 40px; box-sizing: border-box; border-radius: 50%; object-fit: cover;
  border: 3px solid var(--fd-map-tone); background: var(--fd-fill); color: var(--fd-muted); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
span.fd-map-face-photo svg { width: 22px; height: 22px; }
.fd-map-face[data-look="photo"] .fd-map-face-text {
  position: absolute; top: calc(100% + 2px); left: 50%; translate: -50% 0; max-width: 14ch; padding: 1px 6px; border-radius: 999px;
  font-size: 12px; font-weight: 600; background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.fd-map-face[data-look="dot"] { width: 16px; height: 16px; border-radius: 50%; background: var(--fd-map-tone); border: 2px solid var(--fd-surface); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4); }
.fd-map-face:is([data-look="icon"], [data-look="dot"])[data-chosen], .fd-map-face[data-chosen] .fd-map-face-photo { box-shadow: 0 0 0 2px var(--fd-surface), 0 0 0 4px var(--fd-map-tone); }
.fd-map-face[data-chosen]::before, .fd-map-bubble[data-chosen]::before {
  content: "✓"; position: absolute; top: -7px; right: -7px; z-index: 1; width: 16px; height: 16px; border-radius: 50%; box-sizing: border-box;
  display: grid; place-items: center; font: 700 10px/1 system-ui, sans-serif; background: var(--fd-accent); color: var(--fd-accent-text); border: 1.5px solid var(--fd-surface);
}
.fd-map-bubble {
  position: relative; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 50%; cursor: pointer;
  background: var(--fd-accent); color: var(--fd-accent-text); font-weight: 700; font-size: 13px; font-variant-numeric: tabular-nums; transition: scale 0.12s;
  box-shadow: 0 0 0 5px color-mix(in srgb, var(--fd-accent) 30%, transparent), 0 1px 4px rgba(0, 0, 0, 0.3);
}
.fd-map-bubble[data-size="m"] { width: 40px; height: 40px; }
.fd-map-bubble[data-size="l"] { width: 48px; height: 48px; }
.fd-map-card-popup .leaflet-popup-content-wrapper { padding: 0; border-radius: 10px; overflow: hidden; background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 8px 28px rgba(0, 0, 0, 0.24); }
.fd-map-card-popup .leaflet-popup-content { margin: 0; font: inherit; font-size: 14px; line-height: 1.4; }
.fd-map-card-popup .leaflet-popup-tip { background: var(--fd-surface); }
.fd-map-card { display: grid; }
.fd-map-card-image { display: block; width: 100%; max-width: 100%; aspect-ratio: 16 / 9; object-fit: cover; background: var(--fd-fill); }
.fd-map-card-body { display: grid; gap: 8px; padding: 10px 12px 12px; }
.fd-map-card-head { display: flex; align-items: flex-start; gap: 8px; }
.fd-map-card-title { flex: 1; min-width: 0; font-size: 14.5px; line-height: 1.3; overflow-wrap: anywhere; }
.fd-map-card-close {
  flex: none; width: 28px; height: 28px; margin: -4px -6px -4px 0; display: grid; place-items: center; padding: 0; border: 0; border-radius: 50%;
  background: transparent; color: var(--fd-muted); font: 400 20px/1 system-ui, sans-serif; cursor: pointer;
}
.fd-map-card[dir="rtl"] .fd-map-card-close { margin: -4px 0 -4px -6px; }
.fd-map-card-close:hover { background: var(--fd-fill); color: var(--fd-text); }
.fd-map-card-fields { margin: 0; display: grid; gap: 3px; font-size: 13px; }
.fd-map-card-fields div { display: flex; justify-content: space-between; gap: 10px; }
.fd-map-card-fields dt { color: var(--fd-muted); }
.fd-map-card-fields dd { margin: 0; text-align: end; font-weight: 600; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
/* A title linking to the record's page; bare lines, their labels for a screen reader alone; the first line leading. */
.fd-map-card .fd-map-card-link { color: inherit; text-decoration: none; }
.fd-map-card .fd-map-card-link:hover { color: var(--fd-accent); text-decoration: underline; }
.fd-map-card-picture { display: block; }
.fd-map-card-fields[data-labels] div { display: block; }
.fd-map-card-fields[data-labels] dt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-map-card-fields[data-labels] dd { text-align: start; font-weight: 400; }
.fd-map-card-fields[data-lead] > div:first-child dd { font-size: 15.5px; font-weight: 700; color: var(--fd-text); }
.fd-map-card-fields[data-lead][data-labels] > div + div dd { color: var(--fd-muted); }
.fd-map-card-actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 8px; }
.fd-map-card-choose { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; cursor: pointer; margin-inline-end: auto; }
.fd-map-card-choose input { width: 16px; height: 16px; margin: 0; accent-color: var(--fd-accent); }
.fd-map-card .fd-button { min-height: 30px; padding-inline: 14px; }
.fd-map-card :focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-map-crowd-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 220px; overflow: auto; }
.fd-map-crowd-item { width: 100%; padding: 6px 8px; border: 0; border-radius: 6px; text-align: start; background: transparent; color: var(--fd-text); font: inherit; font-size: 13px; cursor: pointer; }
button.fd-map-crowd-item:hover { background: var(--fd-accent-soft); }
span.fd-map-crowd-item { display: block; cursor: default; }
.fd-map-here {
  position: absolute; top: 10px; left: 50%; translate: -50% 0; z-index: 1000; padding: 7px 14px; border-radius: 999px; white-space: nowrap; cursor: pointer;
  border: 1px solid var(--fd-border); background: var(--fd-surface); color: var(--fd-text); font: inherit; font-size: 13.5px; font-weight: 600; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.fd-map-here:hover { color: var(--fd-accent); border-color: var(--fd-accent); }
.fd-map-here:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-map-box[data-card] > .fd-map-here { visibility: hidden; }
/* The map over the table when the list is too narrow for both side by side: shorter, so the table is in reach (unless the page says how tall). */
@container fd-list (max-width: 860px) { .fd-list[data-view="both"] .fd-map-list:not([data-height]) .fd-map-box { height: clamp(260px, 46vh, 420px); } }
.fd-map-ghost .fd-map-face { pointer-events: none; }
/* The tools that draw an area to search in: at the map's start, the zoom at its end. */
.fd-map-draw { position: absolute; top: 8px; left: 8px; z-index: 1000; display: grid; gap: 4px; }
.fd-map-box[data-side="left"] .fd-map-draw { left: auto; right: 8px; }
.fd-map-draw button {
  width: 32px; height: 32px; display: grid; place-items: center; padding: 0; cursor: pointer;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.fd-map-draw button svg { width: 18px; height: 18px; }
.fd-map-draw button:hover, .fd-map-draw button[aria-pressed="true"] { color: var(--fd-accent); border-color: var(--fd-accent); }
.fd-map-draw button[aria-pressed="true"] { background: var(--fd-accent-soft); }
.fd-map-draw button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
/* While an area is drawn, the pins let every press through to the map. */
.fd-map-box[data-drawing] .fd-map-mark { pointer-events: none; }
/* The drawing's bar starts after the tools. */
.fd-map-list .fd-map-hint { left: 48px; }
.fd-map-list .fd-map-box[data-side="left"] .fd-map-hint { left: 52px; right: 48px; }
.fd-map-list-note {
  position: absolute; left: 8px; bottom: 28px; z-index: 1000; max-width: calc(100% - 64px); margin: 0; padding: 4px 8px; border-radius: 6px; font-size: 12.5px; line-height: 1.4;
  background: color-mix(in srgb, var(--fd-surface) 92%, transparent); color: var(--fd-text); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18);
}
/* As tall as the element it is put in; in the viewer's list, which gives it no height to fill, as tall as a list's map is. */
.fd-map-list[data-height="fill"] { height: 100%; }
.fd-list-map .fd-map-list[data-height="fill"] { height: auto; }
.fd-list-map .fd-map-list[data-height="fill"] .fd-map-box { height: clamp(320px, 64vh, 640px); }
/* A map that takes every gesture: one finger pans it, the page does not scroll under it. */
.fd-map-box.leaflet-container[data-gestures="all"] { touch-action: none; }
`;

/** The list map's stylesheet, once per document, after the maps' own. */
export function installListMapStyles(doc: Document) {
  installMapStyles(doc);
  if (doc.getElementById('fieldia-list-map-styles')) return;
  const own = doc.createElement('style');
  own.id = 'fieldia-list-map-styles';
  own.textContent = LIST_MAP_CSS;
  doc.getElementById('fieldia-map-styles')?.after(own);
}

/**
 * A list's map in a page of its own (`mountListMap`), outside the viewer:
 * what the viewer's form gives its map — a part hidden stays hidden, words
 * for a screen reader alone, its buttons, its sizes — on the map's element
 * alone, so none of it reaches the page round it. Its colours are Fieldia's
 * tokens, light and dark by the page's colour scheme, in Fieldia's tokens'
 * layer: a page's own rule for `.fd-map-embed`, of any weight, sets them.
 */
export const EMBED_CSS = `
@layer fieldia-tokens {
.fd-map-embed {
  --fd-text: light-dark(#1f2328, #e8eaed); --fd-muted: light-dark(#59636e, #a3a9b2); --fd-surface: light-dark(#fff, #1f2329); --fd-border: light-dark(#d0d7de, #3a4048);
  --fd-accent: light-dark(#1365d9, #5aa2ff); --fd-accent-text: light-dark(#fff, #0b1220); --fd-accent-soft: light-dark(#e6f4ff, #1d2c42); --fd-focus: var(--fd-accent);
  --fd-info: light-dark(#0b5cad, #7db7ff); --fd-success: light-dark(#2e7d32, #6fd08e); --fd-warning: light-dark(#8a5300, #f2b55c); --fd-error: light-dark(#c62828, #ff8a7a);
  --fd-control-radius: 6px;
}
}
.fd-map-embed { position: relative; color: var(--fd-text); font-size: 14px; line-height: 1.45; }
.fd-map-embed *, .fd-map-embed ::before, .fd-map-embed ::after { box-sizing: border-box; }
.fd-map-embed [hidden] { display: none !important; }
.fd-map-embed .fd-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
.fd-map-embed .fd-button {
  font: inherit; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 32px; padding: 4px 14px;
  border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); background: var(--fd-surface); color: var(--fd-text);
}
.fd-map-embed .fd-button:hover { border-color: var(--fd-accent); color: var(--fd-accent); }
.fd-map-embed .fd-button-primary { background: var(--fd-accent); border-color: var(--fd-accent); color: var(--fd-accent-text); }
.fd-map-embed .fd-button-primary:hover { color: var(--fd-accent-text); filter: brightness(1.12); }
.fd-map-embed .fd-button:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 2px; }
.fd-map-embed .fd-button[aria-busy="true"] { cursor: progress; opacity: 0.7; }
`;

/** A list's map's own base, once per document, after the list map's stylesheet: a page of its own carries it, the viewer never does. */
export function installEmbedStyles(doc: Document) {
  installListMapStyles(doc);
  if (doc.getElementById('fieldia-map-embed-styles')) return;
  const own = doc.createElement('style');
  own.id = 'fieldia-map-embed-styles';
  own.textContent = EMBED_CSS;
  doc.getElementById('fieldia-list-map-styles')?.after(own);
}

/**
 * A form's map, on top of a list map's pins and cards: its label, a route
 * (the part travelled faded), a place whose news is old, the Follow button,
 * and the reader's own place with its button.
 */
export const FORM_MAP_CSS = `
.fd-map-form { display: grid; gap: 6px; min-width: 0; }
.fd-map-form-label { margin: 0; font-weight: 600; color: var(--fd-text); }
path.fd-map-route { stroke: var(--fd-accent); stroke-width: 5; stroke-opacity: 0.85; fill: none; stroke-linecap: round; stroke-linejoin: round; }
path.fd-map-route-done { stroke: var(--fd-muted); stroke-width: 4; stroke-opacity: 0.55; fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1 8; }
path.fd-map-reach { stroke: var(--fd-accent); stroke-width: 2; stroke-dasharray: 6 5; fill: var(--fd-accent); fill-opacity: 0.1; }
path.fd-map-fence { stroke: var(--fd-warning); stroke-width: 2.5; stroke-dasharray: 2 5; stroke-linecap: round; fill: var(--fd-warning); fill-opacity: 0.12; }
.fd-map-face[data-stale] { filter: grayscale(1); opacity: 0.75; }
.fd-map-face-stale {
  position: absolute; top: calc(100% + 4px); left: 50%; translate: -50% 0; z-index: 1; padding: 1px 6px; border-radius: 999px; white-space: nowrap;
  font-size: 11.5px; font-weight: 600; background: var(--fd-surface); color: var(--fd-text); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
}
.fd-map-face[data-look="photo"] .fd-map-face-stale { top: calc(100% + 26px); }
/* A place that moves, with pins that crowd it gathered under it: their count, itself among them, at its shoulder. */
.fd-map-count {
  position: absolute; top: -8px; right: -10px; z-index: 2; min-width: 20px; height: 20px; padding: 0 5px; box-sizing: border-box; border-radius: 999px;
  display: grid; place-items: center; font: 700 11.5px/1 system-ui, sans-serif; font-variant-numeric: tabular-nums; pointer-events: none;
  background: var(--fd-accent); color: var(--fd-accent-text); border: 2px solid var(--fd-surface); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}
.fd-map-here.fd-map-follow { top: auto; bottom: 28px; }
.fd-map-locate {
  position: absolute; top: 8px; left: 8px; z-index: 1000; width: 32px; height: 32px; display: grid; place-items: center; padding: 0; cursor: pointer;
  background: var(--fd-surface); color: var(--fd-text); border: 1px solid var(--fd-border); border-radius: var(--fd-control-radius); box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
}
.fd-map-box[data-side="left"] .fd-map-locate { left: auto; right: 8px; }
.fd-map-locate svg { width: 18px; height: 18px; }
.fd-map-locate:hover, .fd-map-locate[aria-pressed="true"] { color: var(--fd-accent); border-color: var(--fd-accent); }
.fd-map-locate[aria-pressed="true"] { background: var(--fd-accent-soft); }
.fd-map-locate:focus-visible { outline: 2px solid var(--fd-focus); outline-offset: 1px; }
.fd-map-me { box-sizing: border-box; border-radius: 50%; background: var(--fd-info); border: 3px solid var(--fd-surface); box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25), 0 1px 4px rgba(0, 0, 0, 0.3); }
`;

/** A form's map's stylesheet, once per document, after a list map's. */
export function installFormMapStyles(doc: Document) {
  installListMapStyles(doc);
  if (doc.getElementById('fieldia-form-map-styles')) return;
  const own = doc.createElement('style');
  own.id = 'fieldia-form-map-styles';
  own.textContent = FORM_MAP_CSS;
  doc.getElementById('fieldia-list-map-styles')?.after(own);
}
