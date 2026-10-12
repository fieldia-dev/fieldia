import type * as Leaflet from 'leaflet';
import type { Locale } from '@fieldia/core';
import type { MapLabels } from './labels';
import type { LeafletModule } from './leaflet';
import type { MapBox, MapTool } from './map-core';
import type { MapProvider } from './providers';

/**
 * The tools under a map's zoom, those its page asks for: the satellite's
 * images (no button where the provider has none), full screen (filling the
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
