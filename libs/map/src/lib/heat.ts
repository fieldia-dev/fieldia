import type * as Leaflet from 'leaflet';
import type { LeafletModule } from './leaflet';

/**
 * A heat map of a list's records: where they crowd glows, from the page's
 * accent through its warning tone to its error tone, each record weighing one
 * or its weight. Drawn on a canvas of its own over the map images and under
 * the pins, again after each move; hidden while the map zooms. Loaded with
 * the first map that has one.
 */

export interface HeatPoint {
  lat: number;
  lng: number;
  weight: number;
}

/** How far each record's glow reaches, in pixels, and how soft its edge is. */
const RADIUS = 22;
const BLUR = 16;

export interface HeatLayer {
  /** The records to glow, and whether the heat map shows at all. */
  draw(points: readonly HeatPoint[], shown: boolean): void;
  destroy(): void;
}

export function drawHeat(options: { map: Leaflet.Map; L: LeafletModule; document: Document; colours: () => string[] }): HeatLayer {
  const { map, L, document: doc } = options;
  const canvas = doc.createElement('canvas');
  canvas.className = 'fd-map-heat leaflet-zoom-hide';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.position = 'absolute';
  canvas.style.pointerEvents = 'none';
  const pane = map.getPane('fd-heat') ?? map.createPane('fd-heat');
  // Over the images, under the shapes (400) and the pins (600).
  pane.style.zIndex = '350';
  pane.style.pointerEvents = 'none';
  pane.append(canvas);
  let points: readonly HeatPoint[] = [];
  let shown = false;
  let palette: Uint8ClampedArray | null = null;
  let paletteOf = '';

  // One record's glow, drawn once: a blurred disc to stamp at each place.
  const stamp = doc.createElement('canvas');
  const r = RADIUS + BLUR;
  stamp.width = stamp.height = r * 2;
  const stampContext = stamp.getContext('2d');
  if (stampContext) {
    stampContext.shadowOffsetX = stampContext.shadowOffsetY = r * 2;
    stampContext.shadowBlur = BLUR;
    stampContext.shadowColor = 'black';
    stampContext.beginPath();
    stampContext.arc(-r, -r, RADIUS, 0, Math.PI * 2);
    stampContext.fill();
  }

  /** 256 colours, from none to the strongest, made from the page's tones as the canvas reads them. */
  function makePalette(colours: string[]): Uint8ClampedArray {
    const strip = doc.createElement('canvas');
    strip.width = 256;
    strip.height = 1;
    const context = strip.getContext('2d');
    if (!context) return new Uint8ClampedArray(1024);
    const gradient = context.createLinearGradient(0, 0, 256, 0);
    colours.forEach((colour, i) => {
      context.fillStyle = '#2563eb';
      // A tone the canvas cannot read keeps the last it could.
      context.fillStyle = colour;
      gradient.addColorStop(0.25 + (0.75 * i) / Math.max(1, colours.length - 1), context.fillStyle);
    });
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 1);
    return context.getImageData(0, 0, 256, 1).data;
  }

  function redraw() {
    const size = map.getSize();
    const ratio = doc.defaultView?.devicePixelRatio ?? 1;
    L.DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]));
    canvas.style.width = `${size.x}px`;
    canvas.style.height = `${size.y}px`;
    canvas.width = Math.round(size.x * ratio);
    canvas.height = Math.round(size.y * ratio);
    canvas.hidden = !shown;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context || !shown || !points.length) return;
    const colours = options.colours();
    if (colours.join() !== paletteOf) {
      palette = makePalette(colours);
      paletteOf = colours.join();
    }
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const most = Math.max(...points.map((p) => p.weight), 1e-9);
    const bounds = map.getBounds().pad(0.2);
    for (const point of points) {
      if (!bounds.contains([point.lat, point.lng])) continue;
      const at = map.latLngToContainerPoint([point.lat, point.lng]);
      // Each adds a little: only many together, or the heaviest, glow strongest.
      context.globalAlpha = Math.max(0.04, point.weight / most) * 0.22;
      context.drawImage(stamp, at.x - r, at.y - r);
    }
    // Each pixel's strength becomes its colour.
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = image.data;
    for (let i = 3; i < data.length; i += 4) {
      const strength = data[i];
      if (!strength || !palette) continue;
      const j = strength * 4;
      data[i - 3] = palette[j];
      data[i - 2] = palette[j + 1];
      data[i - 1] = palette[j + 2];
      data[i] = Math.min(220, strength * 1.6);
    }
    context.putImageData(image, 0, 0);
  }

  map.on('moveend resize', redraw);
  return {
    draw(next, on) {
      points = next;
      shown = on;
      redraw();
    },
    destroy() {
      map.off('moveend resize', redraw);
      canvas.remove();
    },
  };
}
