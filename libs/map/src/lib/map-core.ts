import type * as Leaflet from 'leaflet';
import type { Locale } from '@fieldia/core';
import type { LatLng } from './geo';
import { fill, type MapLabels } from './labels';
import { loadLeaflet, tileLayer, type LeafletModule } from './leaflet';
import type { BaseMap, Credit, MapProvider } from './providers';
import { installLeafletStyles, installMapStyles } from './styles';

/**
 * One map in a box: the provider's map images for the page's scheme, its
 * credits and mark, Fieldia's own zoom buttons at the box's inline end, and
 * the manners a map needs among other fields. A scroll passes over it to the
 * page unless Ctrl (⌘) is held, and one finger scrolls the page while two
 * move the map: a form on a phone is never caught in its map.
 *
 * The box exists at once; the map arrives when Leaflet has loaded, and the
 * widget does its map work in `ready`.
 */

export interface MapBoxOptions {
  document: Document;
  provider: MapProvider;
  locale: Locale;
  labels: MapLabels;
  /** The field's label: the map is named after it. */
  name: string;
  /** What else the keys do on this map, said after how they move it. */
  keys?: string;
  center?: LatLng;
  zoom?: number;
  /** Height in pixels, or as CSS says it (`clamp(…)`); 280 pixels unless said. */
  height?: number | string;
  /** Tools under the zoom: the satellite's images, full screen, measuring a distance. */
  tools?: readonly MapTool[];
}

/** A tool a map can have under its zoom. */
export type MapTool = 'satellite' | 'fullscreen' | 'measure';

/** The tools a field's `tools` option names, those a field's map can have; anything else is passed over. */
export function mapTools(value: unknown): MapTool[] {
  return Array.isArray(value) ? value.filter((tool): tool is MapTool => tool === 'satellite' || tool === 'fullscreen' || tool === 'measure') : [];
}

export interface MapBox {
  element: HTMLElement;
  /** Runs `use` with the map once it is there: at once if it already is. */
  ready(use: (map: Leaflet.Map, L: LeafletModule) => void): void;
  /** Says something over the map for a moment. */
  veil(words: string): void;
  /** Whether one finger or the mouse may drag the map; off while a shape is drawn. */
  setPannable(pannable: boolean): void;
  /** Looks again at the page's scheme and direction, after a theme or a language changed. */
  refresh(): void;
  /** Elements over the map that clicks must not pass through. */
  shield(element: HTMLElement): void;
  /** Words over the map, written in the page's direction though the map itself is left to right. */
  follow(element: HTMLElement): void;
  /** A tool of the map's user's own under the zoom, drawn as the others are: an SVG drawing on a 24-unit square. */
  tool(words: string, drawing: string): HTMLButtonElement;
  destroy(): void;
}

const warned = new Set<string>();
/** Says a provider's trouble to the developer once, in the console: a map that stays empty says nothing itself. */
export function warnOnce(words: string) {
  if (warned.has(words)) return;
  warned.add(words);
  console.warn(`[Fieldia] ${words}`);
}
const isMac = (doc: Document) => /Mac|iPhone|iPad/.test(doc.defaultView?.navigator.platform ?? '');

export function createMapBox(options: MapBoxOptions): MapBox {
  const { document: doc, provider, locale, labels } = options;
  installMapStyles(doc);
  const element = doc.createElement('div');
  element.className = 'fd-map-box';
  // The map's own layout is left to right in every language; the controls over it follow the page.
  element.dir = 'ltr';
  element.style.setProperty('--fd-map-height', typeof options.height === 'string' ? options.height : `${options.height ?? 280}px`);
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', fill(labels.mapOf, { label: options.name }));
  const keysId = `fd-map-keys-${Math.random().toString(36).slice(2, 9)}`;
  const keys = doc.createElement('span');
  keys.id = keysId;
  keys.className = 'fd-sr-only';
  keys.textContent = [labels.mapKeys, options.keys].filter(Boolean).join(' ');
  element.setAttribute('aria-describedby', keysId);

  const zoom = doc.createElement('div');
  zoom.className = 'fd-map-zoom';
  zoom.dataset['side'] = 'right';
  const zoomButton = (words: string, sign: string) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', words);
    button.title = words;
    button.textContent = sign;
    return button;
  };
  const zoomIn = zoomButton(labels.zoomIn, '+');
  const zoomOut = zoomButton(labels.zoomOut, '−');
  zoom.append(zoomIn, zoomOut);
  /** A tool's button under the zoom: pressed while it is on. */
  const toolButton = (words: string, drawing: string) => {
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'fd-map-tool';
    button.setAttribute('aria-label', words);
    button.title = words;
    button.setAttribute('aria-pressed', 'false');
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${drawing}</svg>`;
    zoom.append(button);
    return button;
  };
  const tools = new Set(options.tools ?? []);
  const credits = doc.createElement('div');
  credits.className = 'fd-map-credits';
  const veilElement = doc.createElement('div');
  veilElement.className = 'fd-map-veil';
  veilElement.setAttribute('aria-hidden', 'true');
  const crosshair = doc.createElement('div');
  crosshair.className = 'fd-map-crosshair';
  element.append(keys, veilElement, crosshair);
  // The buttons and credits go in after Leaflet's layers, once the map is made: Tab reaches the map's own pins and grips first.
  const overlays: HTMLElement[] = [zoom, credits];
  if (provider.logo) {
    const mark = doc.createElement(provider.logo.href ? 'a' : 'span');
    mark.className = 'fd-map-logo';
    if (mark instanceof HTMLAnchorElement && provider.logo.href) {
      mark.href = provider.logo.href;
      mark.target = '_blank';
      mark.rel = 'noopener';
    }
    if (provider.logo.image) {
      const img = doc.createElement('img');
      img.src = provider.logo.image;
      img.alt = provider.logo.text;
      mark.append(img);
    } else {
      const words = doc.createElement('span');
      words.textContent = provider.logo.text;
      mark.append(words);
    }
    overlays.push(mark);
  }
  if (provider.demoOnly) warnOnce(`The "${provider.id}" map provider is for demos and development only: choose a provider (azureMaps, googleMaps, mapbox, or tiles) for an app in use.`);

  let map: Leaflet.Map | null = null;
  let L: LeafletModule | null = null;
  let destroyed = false;
  let pannable = true;
  let baseMap: BaseMap | null = null;
  /** The satellite's images, by the person's choice; the scheme's own otherwise. */
  let satellite = false;
  let baseLayer: Leaflet.TileLayer | null = null;
  let creditsAsked = 0;
  let creditsTimer: ReturnType<typeof setTimeout> | undefined;
  let veilTimer: ReturnType<typeof setTimeout> | undefined;
  const waiting: ((map: Leaflet.Map, L: LeafletModule) => void)[] = [];
  const following: HTMLElement[] = [veilElement];
  const cleanups: (() => void)[] = [];

  function veil(words: string) {
    veilElement.textContent = words;
    veilElement.dataset['show'] = '';
    clearTimeout(veilTimer);
    veilTimer = setTimeout(() => delete veilElement.dataset['show'], 1400);
  }

  function shield(over: HTMLElement) {
    if (!L) {
      waiting.push(() => shield(over));
      return;
    }
    L.DomEvent.disableClickPropagation(over);
    L.DomEvent.disableScrollPropagation(over);
  }

  /** Dark when the form is: its own scheme, or the reader's when it follows theirs. */
  function dark(): boolean {
    const view = doc.defaultView;
    const scheme = view?.getComputedStyle(element).colorScheme ?? '';
    if (!scheme.includes('dark')) return false;
    if (!scheme.includes('light')) return true;
    return !!view?.matchMedia?.('(prefers-color-scheme: dark)').matches;
  }

  function showCredits(list: Credit[]) {
    credits.replaceChildren();
    list.forEach((credit, i) => {
      if (i) credits.append(' · ');
      if (credit.href) {
        const link = doc.createElement('a');
        link.href = credit.href;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = credit.text;
        credits.append(link);
      } else credits.append(credit.text);
    });
  }

  function askCredits() {
    clearTimeout(creditsTimer);
    creditsTimer = setTimeout(() => {
      if (!map || !baseMap) return;
      const asked = ++creditsAsked;
      const b = map.getBounds();
      provider
        .credits(baseMap, { zoom: map.getZoom(), bounds: { south: b.getSouth(), west: b.getWest(), north: b.getNorth(), east: b.getEast() } }, locale)
        .then((list) => asked === creditsAsked && showCredits(list))
        .catch(() => undefined);
    }, 300);
  }

  async function setBaseMap(kind: BaseMap) {
    if (!map || !L || kind === baseMap) return;
    const refused = (error: Error) => {
      warnOnce(`The ${provider.id} map images could not be drawn: ${error.message}`);
      return null;
    };
    let spec = await provider.tiles(kind, locale).catch(refused);
    let drawn = kind;
    if (!spec && kind !== 'road') {
      spec = await provider.tiles('road', locale).catch(refused);
      drawn = 'road';
    }
    if (!spec || destroyed || !map) return;
    if (drawn === baseMap) {
      baseMap = kind;
      return;
    }
    const layer = tileLayer(L, spec).addTo(map);
    // An image refused (a key the provider does not take, a network that blocks it): the map shows the ground and nothing else.
    layer.on('tileerror', () => warnOnce(`The ${provider.id} map images failed to load: a key or token the provider refuses, or a network that blocks it, does this. Open one image's address to see the provider's answer.`));
    baseLayer?.remove();
    baseLayer = layer;
    baseMap = drawn;
    element.dataset['baseMap'] = drawn;
    askCredits();
  }

  function refresh() {
    const page = element.parentElement ? doc.defaultView?.getComputedStyle(element.parentElement).direction : 'ltr';
    zoom.dataset['side'] = page === 'rtl' ? 'left' : 'right';
    element.dataset['side'] = zoom.dataset['side'];
    for (const words of following) words.dir = page === 'rtl' ? 'rtl' : 'ltr';
    if (map) void setBaseMap(satellite ? 'satellite' : dark() ? 'dark' : 'road');
  }

  function setPannable(on: boolean) {
    pannable = on;
    if (!map) return;
    if (on) map.dragging.enable();
    else map.dragging.disable();
  }

  // A scroll passes to the page; Ctrl or ⌘ with it zooms. Caught on the way down, before Leaflet's own.
  const wheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return;
    event.stopPropagation();
    veil(isMac(doc) ? labels.cmdZoom : labels.ctrlZoom);
  };
  element.addEventListener('wheel', wheel, { capture: true, passive: true });
  // The cross at the centre is the keyboard's pointer: shown once a key is pressed on the map, gone at the next press of a pointer.
  // (Leaflet focuses the map in code on every press, which a browser may show as keyboard focus.)
  // Focus that no press brought (Tab, a shortcut) is the keyboard's too.
  let pressing = false;
  const byKeys = (event: KeyboardEvent) => event.target === element && element.setAttribute('data-keys', '');
  const byPointer = () => {
    element.removeAttribute('data-keys');
    pressing = true;
    setTimeout(() => (pressing = false), 0);
  };
  const byFocus = () => !pressing && element.setAttribute('data-keys', '');
  element.addEventListener('keydown', byKeys);
  element.addEventListener('pointerdown', byPointer, { capture: true });
  element.addEventListener('focus', byFocus);
  cleanups.push(() => {
    element.removeEventListener('keydown', byKeys);
    element.removeEventListener('pointerdown', byPointer, { capture: true });
    element.removeEventListener('focus', byFocus);
  });
  // One finger scrolls the page; two move the map.
  let touchStart: { x: number; y: number } | null = null;
  const touchstart = (event: TouchEvent) => {
    if (!map) return;
    const one = event.touches.length === 1;
    touchStart = one ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    if (one || !pannable) map.dragging.disable();
    else map.dragging.enable();
  };
  const touchmove = (event: TouchEvent) => {
    if (!touchStart || event.touches.length !== 1 || !pannable) return;
    const moved = Math.hypot(event.touches[0].clientX - touchStart.x, event.touches[0].clientY - touchStart.y);
    if (moved > 12) veil(labels.twoFingers);
  };
  const touchend = (event: TouchEvent) => {
    if (event.touches.length === 0 && map && pannable) map.dragging.enable();
  };
  element.addEventListener('touchstart', touchstart, { capture: true, passive: true });
  element.addEventListener('touchmove', touchmove, { capture: true, passive: true });
  element.addEventListener('touchend', touchend, { capture: true, passive: true });
  cleanups.push(() => {
    element.removeEventListener('wheel', wheel, { capture: true });
    element.removeEventListener('touchstart', touchstart, { capture: true });
    element.removeEventListener('touchmove', touchmove, { capture: true });
    element.removeEventListener('touchend', touchend, { capture: true });
  });

  void loadLeaflet().then(({ L: leaflet, css }) => {
    if (destroyed) return;
    installLeafletStyles(doc, css);
    L = leaflet;
    map = leaflet.map(element, {
      zoomControl: false,
      attributionControl: false,
      keyboard: true,
      keyboardPanDelta: 80,
      worldCopyJump: true,
      dragging: pannable,
    });
    if (options.center) map.setView([options.center.lat, options.center.lng], options.zoom ?? 15);
    else map.setView([20, 0], options.zoom ?? 2);
    element.append(...overlays);
    for (const over of overlays) shield(over);
    // A press while the map still zooms from the last is kept and made when that zoom ends (Leaflet drops it): two quick presses, two steps.
    let zooming = false;
    let owed = 0;
    map.on('zoomstart', () => (zooming = true));
    map.on('zoomend', () => {
      zooming = false;
      if (!owed || !map) return;
      const by = owed;
      owed = 0;
      map.setZoom(map.getZoom() + by);
    });
    const step = (by: number) => {
      if (!map) return;
      if (zooming) owed += by;
      else map.setZoom(map.getZoom() + by);
    };
    zoomIn.addEventListener('click', () => step(1));
    zoomOut.addEventListener('click', () => step(-1));
    // The tools under the zoom, when the page asks for any: their code comes with the first map that has them.
    if (tools.size)
      void import('./tools').then(({ wireTools }) => {
        if (destroyed || !map) return;
        wireTools({ tools, box: api, map, L: leaflet, document: doc, labels, locale, provider, satellite: (on) => ((satellite = on), refresh()), cleanup: (done) => cleanups.push(done) });
      });
    map.on('moveend', askCredits);
    // Shown at last in a tab or a dialog: the map measures itself again.
    const ResizeWatch = doc.defaultView?.ResizeObserver;
    if (ResizeWatch) {
      const watch = new ResizeWatch(() => map?.invalidateSize({ pan: false }));
      watch.observe(element);
      cleanups.push(() => watch.disconnect());
    }
    refresh();
    for (const use of waiting.splice(0)) use(map, leaflet);
  });


  const api: MapBox = {
    element,
    ready(use) {
      if (map && L) use(map, L);
      else waiting.push(use);
    },
    veil,
    setPannable,
    refresh,
    shield,
    follow(words) {
      following.push(words);
      refresh();
    },
    tool(words, drawing) {
      const button = toolButton(words, drawing);
      shield(button);
      return button;
    },
    destroy() {
      destroyed = true;
      clearTimeout(creditsTimer);
      clearTimeout(veilTimer);
      for (const cleanup of cleanups.splice(0)) cleanup();
      map?.remove();
      map = null;
    },
  };
  return api;
}
