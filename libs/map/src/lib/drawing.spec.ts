import type { Locale } from '@fieldia/core';
import type { WidgetContext } from '@fieldia/widgets';
import { areaWidget } from './area';
import { shapeDrawing } from './drawing';
import { writeArea } from './geo';
import { mapLabels } from './labels';
import { loadLeaflet } from './leaflet';
import { createMapBox } from './map-core';
import { measure } from './measure';
import { tiles } from './providers';

/**
 * Drawing on a map (drawing.ts, and measuring a way, measure.ts), as the zone demo's how-to found it in 0.35:
 *
 * A drag the map's own code carries — a box or a circle drawn, a shape carried — holds off the browser's own while it
 * lasts, as Leaflet's own drags do. 0.35 did not: a box drawn across the zoom selected its "+ −", and the browser took
 * the next press on the shape for a drag and drop of the words, its pointer taken from the shape (pointercancel): the
 * shape moved 5 pixels for a drag of 60 (with the demo's frame round it). Asked here as the browser asks: whether a
 * selection or a drag and drop may start (`selectstart`, `dragstart`), each cancelled while held.
 *
 * The bar over the map says one point as one ("1 point", never "1 points"), and on a touch screen says what a finger
 * does — taps, and no Enter. The browser's side of each is driven in e2e/map-area.spec.ts.
 */

const provider = tiles({ url: 'https://example.test/{z}/{x}/{y}.png', credit: { text: '© Example' } });
const labels = mapLabels('en');

/** Whether the browser may start a selection now: Leaflet cancels `selectstart`, or turns `user-select` off where there is none. */
const maySelect = () => {
  const event = new Event('selectstart', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return !event.defaultPrevented && document.documentElement.style.userSelect !== 'none';
};
/** Whether the browser may start a drag and drop of its own now. */
const mayDragAndDrop = () => {
  const event = new Event('dragstart', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(event);
  return !event.defaultPrevented;
};
/** A mouse's pointer event (jsdom has no PointerEvent: a mouse event with a pointer's id). */
const pointer = (type: string, x: number, y: number) =>
  Object.assign(new MouseEvent(type, { button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, bubbles: true, cancelable: true }), { pointerId: 3, pointerType: 'mouse', isPrimary: true });

function boxOnPage(locale: Locale = 'en') {
  const box = createMapBox({ document, provider, locale, labels: mapLabels(locale), name: 'Zone', center: { lat: 30.05, lng: 31.23 }, zoom: 12 });
  document.body.append(box.element);
  return box;
}

afterEach(() => document.body.replaceChildren());

/** A page read on a touch screen, whose pointer cannot hover (jsdom has no `matchMedia`: a phone's answer to it). */
function onTouchScreen() {
  const view = window as { matchMedia?: (query: string) => MediaQueryList };
  const was = view.matchMedia;
  view.matchMedia = (query: string) => ({ matches: query === '(hover: none)', media: query }) as MediaQueryList;
  return () => (view.matchMedia = was);
}

describe('a drag of the map’s own, holding off the browser’s', () => {
  beforeAll(() => loadLeaflet());

  it.each(['box', 'circle'] as const)('a %s drawn: no selection and no drag and drop from the press until it is let go', async (shape) => {
    const box = boxOnPage();
    await new Promise<void>((ready) => box.ready(() => ready()));
    const done = jest.fn();
    const drawing = shapeDrawing({ box, labels, keys: box.element, announce: () => undefined, armed: () => undefined, done, escaped: () => undefined });
    drawing.arm(shape);
    expect(maySelect()).toBe(true);
    box.element.dispatchEvent(pointer('pointerdown', 40, 40));
    expect(maySelect()).toBe(false);
    expect(mayDragAndDrop()).toBe(false);
    box.element.dispatchEvent(pointer('pointermove', 90, 80));
    expect(maySelect()).toBe(false);
    box.element.dispatchEvent(pointer('pointerup', 120, 100));
    expect(done).toHaveBeenCalledWith(expect.objectContaining({ shape }));
    expect(maySelect()).toBe(true);
    expect(mayDragAndDrop()).toBe(true);
    // A press taken from it (a finger's scroll, the browser's own) lets go as well.
    drawing.arm(shape);
    box.element.dispatchEvent(pointer('pointerdown', 40, 40));
    expect(maySelect()).toBe(false);
    box.element.dispatchEvent(pointer('pointercancel', 40, 40));
    expect(maySelect()).toBe(true);
    expect(mayDragAndDrop()).toBe(true);
    box.destroy();
  });

  it('a shape carried by a press on it: held from the press until it is let go', async () => {
    const { L } = await loadLeaflet();
    // jsdom draws no SVG: Leaflet's paths are SVG elements here, as a browser's are.
    const svg = jest.replaceProperty(L.Browser, 'svg', true);
    let value: unknown = asJson({ shape: 'box', points: [{ lat: 30.04, lng: 31.22 }, { lat: 30.04, lng: 31.24 }, { lat: 30.06, lng: 31.24 }, { lat: 30.06, lng: 31.22 }] });
    const context = {
      form: { setValue: (_: string, next: unknown) => (value = next) },
      name: 'zone',
      field: { type: 'json', label: 'Zone' },
      node: { type: 'field', id: 'zone', field: 'zone', widget: 'area' },
      id: 'f-zone',
      document,
      locale: 'en',
    } as unknown as WidgetContext;
    const widget = areaWidget({ provider, center: { lat: 30.05, lng: 31.23 }, zoom: 12 })(context);
    document.body.append(widget.element);
    widget.update({ value: value as never, values: {}, readonly: false, required: false, invalid: false });
    const shape = await waitFor(() => widget.element.querySelector('path.fd-map-shape'));
    const map = widget.element.querySelector<HTMLElement>('.fd-map-box')!;
    shape.dispatchEvent(pointer('pointerdown', 50, 50));
    expect(maySelect()).toBe(false);
    expect(mayDragAndDrop()).toBe(false);
    map.dispatchEvent(pointer('pointermove', 110, 70));
    map.dispatchEvent(pointer('pointerup', 110, 70));
    expect(maySelect()).toBe(true);
    expect(mayDragAndDrop()).toBe(true);
    widget.destroy?.();
    svg.restore();
  });
});

const asJson = (area: Parameters<typeof writeArea>[0]) => JSON.parse(JSON.stringify(writeArea(area)));

async function waitFor<T>(find: () => T | null | undefined): Promise<T> {
  for (let i = 0; i < 50; i++) {
    const found = find();
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('never came');
}

describe('the bar over the map while a tool is in hand', () => {
  /** A polygon begun, a point put at the map's centre by Space for each of `n`: the bar's words, and what was said. */
  async function polygonOf(n: number, locale: Locale = 'en') {
    const box = boxOnPage(locale);
    await new Promise<void>((ready) => box.ready(() => ready()));
    const said: string[] = [];
    const drawing = shapeDrawing({ box, labels: mapLabels(locale), locale, keys: box.element, announce: (words) => said.push(words), armed: () => undefined, done: () => undefined, escaped: () => undefined });
    drawing.arm('polygon');
    const bar = box.element.querySelector('.fd-map-hint p')!;
    const steps = [bar.textContent];
    for (let i = 0; i < n; i++) {
      box.element.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }));
      steps.push(bar.textContent);
    }
    box.destroy();
    return { steps, said };
  }

  it('says one point as one, in English and in each language: “1 point”, then “2 points”', async () => {
    const { steps, said } = await polygonOf(2);
    expect(steps[1]).toBe('Click to add points. Click the first point, double-click or press Enter to finish. 1 point.');
    expect(steps[2]).toMatch(/ 2 points\.$/);
    expect(said.slice(-2)).toEqual(['1 point', '2 points']);
    expect((await polygonOf(1, 'de')).steps[1]).toMatch(/ 1 Punkt\.$/);
    expect((await polygonOf(1, 'fr')).steps[1]).toMatch(/ 1 point\.$/);
  });

  it('on a touch screen says what a finger does: taps, and no Enter', async () => {
    const back = onTouchScreen();
    try {
      const { steps } = await polygonOf(1);
      expect(steps[0]).toBe('Tap to add points. Tap the first point or double-tap to finish.');
      expect(steps[1]).toBe('Tap to add points. Tap the first point or double-tap to finish. 1 point.');
      // Measuring a way, the same.
      const { L } = await loadLeaflet();
      const box = boxOnPage();
      const map = await new Promise<import('leaflet').Map>((ready) => box.ready((m) => ready(m)));
      const stop = measure({ box, map, L, labels, locale: 'en', stopped: () => undefined });
      expect(box.element.querySelector('.fd-map-measure-hint')?.textContent).toBe('Tap points along the way; double-tap to finish.');
      stop();
      box.destroy();
    } finally {
      back();
    }
    // With a mouse, the mouse's words.
    expect((await polygonOf(0)).steps[0]).toBe('Click to add points. Click the first point, double-click or press Enter to finish.');
  });
});
