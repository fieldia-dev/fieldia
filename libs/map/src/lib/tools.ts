import type * as Leaflet from 'leaflet';
import type { Locale } from '@fieldia/core';
import type { MapLabels } from './labels';
import { tileLayer, type LeafletModule } from './leaflet';
import { warnOnce, type MapBox, type MapTool } from './map-core';
import type { BaseMap, MapProvider } from './providers';

/**
 * The tools under a map's zoom, those its page asks for: the satellite's
 * images (no button where the provider has none), the provider's live
 * traffic over the map (no button where it has none), full screen (filling the
 * window where the browser refuses the screen, as a frame may), and measuring
 * a way (its drawing asked for as the tools come, so a key pressed straight
 * after its press is not lost). Loaded with the first map that has any.
 */
export function wireTools(options: {
  tools: ReadonlySet<MapTool>;
  box: MapBox;
  map: Leaflet.Map;
  L: LeafletModule;
  document: Document;
  labels: MapLabels;
  locale: Locale;
  provider: MapProvider;
  /** The satellite's images on or off: the map draws them. */
  satellite(on: boolean): void;
  /** Traffic on or off: the map says its credits. */
  traffic(on: boolean): void;
  /** What to undo when the map goes. */
  cleanup(done: () => void): void;
}): void {
  const { tools, box, map, labels, locale, document: doc } = options;
  const element = box.element;
  if (tools.has('satellite')) {
    const button = box.tool(labels.satellite, '<circle cx="12" cy="12" r="3"/><path d="M5 5l3 3M16 16l3 3M19 5l-3 3M8 16l-3 3"/><rect x="3" y="3" width="18" height="18" rx="3" stroke-dasharray="2 3"/>');
    // A provider with no such images: no such button.
    button.hidden = true;
    void options.provider.tiles('satellite', locale).then((spec) => (button.hidden = !spec), () => (button.hidden = true));
    let on = false;
    button.addEventListener('click', () => {
      on = !on;
      button.setAttribute('aria-pressed', String(on));
      options.satellite(on);
    });
  }
  const traffic = options.provider.traffic;
  if (tools.has('traffic') && traffic) {
    const button = box.tool(labels.traffic, '<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="17" r="1.5"/>');
    // None from the provider: no such button, as with no traffic at all.
    button.hidden = true;
    void traffic('road', locale).then((spec) => (button.hidden = !spec), () => (button.hidden = true));
    let on = false;
    let layer: Leaflet.TileLayer | null = null;
    let asked = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    /**
     * The traffic for the map images drawn now (Azure's has colours of its own
     * over the dark map): over them, under the routes and pins; drawn again
     * as it goes out of date, the new over the old until it has come.
     */
    const draw = async () => {
      const asking = ++asked;
      clearTimeout(timer);
      const spec = on ? await traffic((element.dataset['baseMap'] ?? 'road') as BaseMap, locale).catch((error: Error) => (warnOnce(`The ${options.provider.id} traffic could not be drawn: ${error.message}`), null)) : null;
      if (asking !== asked) return;
      const last = layer;
      layer = spec && tileLayer(options.L, spec.fresh ? { ...spec, url: `${spec.url}&t=${Date.now()}` } : spec);
      if (layer) {
        layer.options.className = 'fd-map-traffic';
        layer.setZIndex(2).addTo(map);
        if (spec?.fresh) timer = setTimeout(draw, spec.fresh * 1000);
      }
      const drop = () => last?.remove();
      if (layer && last) {
        layer.once('load', drop);
        setTimeout(drop, 5000);
      } else drop();
    };
    button.addEventListener('click', () => {
      on = !on;
      button.setAttribute('aria-pressed', String(on));
      options.traffic(on);
      void draw();
    });
    // The map's images change kind (dark for a dark page, the satellite's): the traffic for them.
    const watch = new MutationObserver(() => on && void draw());
    watch.observe(element, { attributes: true, attributeFilter: ['data-base-map'] });
    options.cleanup(() => (watch.disconnect(), clearTimeout(timer)));
  }
  if (tools.has('fullscreen')) {
    const button = box.tool(labels.fullScreen, '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>');
    const mark = (on: boolean) => {
      element.toggleAttribute('data-full', on);
      button.setAttribute('aria-pressed', String(on));
      button.setAttribute('aria-label', on ? labels.leaveFullScreen : labels.fullScreen);
      button.title = button.getAttribute('aria-label') ?? '';
      setTimeout(() => map.invalidateSize({ pan: false }), 50);
    };
    // Where the browser refuses the screen (a frame that may not), the map fills the window instead.
    const fill = (on: boolean) => {
      element.classList.toggle('fd-map-fixed', on);
      mark(on);
    };
    const change = () => mark(doc.fullscreenElement === element);
    doc.addEventListener('fullscreenchange', change);
    options.cleanup(() => doc.removeEventListener('fullscreenchange', change));
    button.addEventListener('click', () => {
      if (element.hasAttribute('data-full')) {
        if (doc.fullscreenElement === element) void doc.exitFullscreen();
        else fill(false);
      } else if (element.requestFullscreen) element.requestFullscreen().catch(() => fill(true));
      else fill(true);
    });
    element.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && element.classList.contains('fd-map-fixed')) fill(false);
    });
  }
  if (tools.has('measure')) {
    const button = box.tool(labels.measure, '<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>');
    let stop: (() => void) | null = null;
    const measuring = import('./measure');
    button.addEventListener('click', async () => {
      if (stop) return stop();
      button.setAttribute('aria-pressed', 'true');
      const { measure } = await measuring;
      stop = measure({
        box,
        map,
        L: options.L,
        labels,
        locale,
        stopped: () => {
          stop = null;
          button.setAttribute('aria-pressed', 'false');
          button.focus();
        },
      });
    });
  }
}
