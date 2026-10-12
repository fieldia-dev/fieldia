import type * as Leaflet from 'leaflet';
import type { TileSpec } from './providers';

export type LeafletModule = typeof Leaflet;

let loading: Promise<{ L: LeafletModule; css: string }> | undefined;

/**
 * Leaflet and its stylesheet, loaded the first time a map is shown. Leaflet
 * reads `window` as it loads, so it must never load where there is none (a
 * server, a test in Node, the release check's `require`); and a page
 * without a map never pays for either.
 */
export function loadLeaflet(): Promise<{ L: LeafletModule; css: string }> {
  loading ??= Promise.all([import('leaflet'), import('./leaflet-css')]).then(([module, styles]) => ({
    L: ((module as unknown as { default?: LeafletModule }).default ?? module) as LeafletModule,
    css: styles.LEAFLET_CSS,
  }));
  return loading;
}

/** A layer of map images: plain addresses, or each fetched with the provider's headers (a token kept out of the address). */
export function tileLayer(L: LeafletModule, spec: TileSpec): Leaflet.TileLayer {
  return overlapped(makeLayer(L, spec), spec.tileSize ?? 256);
}

/**
 * Each image a pixel larger than its place, so it overlaps the next: at a
 * screen scale of 125% or 80% (Windows' settings, a zoomed page) images
 * placed edge to edge leave a hairline between them.
 */
function overlapped(layer: Leaflet.TileLayer, size: number): Leaflet.TileLayer {
  layer.on('tileloadstart', (event: Leaflet.TileEvent) => {
    event.tile.style.width = `${size + 1}px`;
    event.tile.style.height = `${size + 1}px`;
  });
  return layer;
}

function makeLayer(L: LeafletModule, spec: TileSpec): Leaflet.TileLayer {
  const options: Leaflet.TileLayerOptions = {
    maxZoom: spec.maxZoom,
    ...(spec.minZoom ? { minZoom: spec.minZoom } : {}),
    ...(spec.tileSize ? { tileSize: spec.tileSize } : {}),
    ...(spec.zoomOffset ? { zoomOffset: spec.zoomOffset } : {}),
    crossOrigin: true,
  };
  if (!spec.headers) return L.tileLayer(spec.url, options);
  const headers = spec.headers;
  const WithHeaders = L.TileLayer.extend({
    createTile(this: Leaflet.TileLayer, coords: Leaflet.Coords, done: Leaflet.DoneCallback) {
      const img = document.createElement('img');
      img.alt = '';
      img.setAttribute('role', 'presentation');
      const url = this.getTileUrl(coords);
      headers()
        .then((sent) => fetch(url, { headers: sent }))
        .then((response) => {
          if (!response.ok) throw new Error(`${response.status}`);
          return response.blob();
        })
        .then((blob) => {
          const src = URL.createObjectURL(blob);
          img.onload = () => {
            URL.revokeObjectURL(src);
            done(undefined, img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(src);
            done(new Error('map image'), img);
          };
          img.src = src;
        })
        .catch((error: Error) => done(error, img));
      return img;
    },
  }) as unknown as new (url: string, options: Leaflet.TileLayerOptions) => Leaflet.TileLayer;
  return new WithHeaders(spec.url, options);
}
