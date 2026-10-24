import { readBarPlace } from './bar-place';

/**
 * Where a designer's floating bar goes (bar-place.ts), on boxes measured as a browser would lay them out: just above
 * its part at the part's end edge; below it where above there is no room — the canvas's top, a group's name, another
 * part's words — the part making room under itself where the next row would be under it; never over the words of
 * anything else; right to left at the part's start edge; inside the canvas.
 */

type Rect = { left: number; top: number; width: number; height: number };
const box = (r: Rect) => ({ ...r, x: r.left, y: r.top, right: r.left + r.width, bottom: r.top + r.height, toJSON: () => r }) as DOMRect;
const rects = new Map<Node, DOMRect>();
const measure = (node: Element, r: Rect) => {
  rects.set(node, box(r));
  (node as HTMLElement).getBoundingClientRect = () => rects.get(node) as DOMRect;
};
let realRange: typeof document.createRange;
/** A text's own boxes: its words where its element is measured to hold them. */
const measuredRange = () => {
  const range = realRange();
  let of: Node | null = null;
  range.selectNodeContents = (node: Node) => void (of = node);
  range.getClientRects = () => {
    const at = of ? (rects.get(of) ?? rects.get(of.parentNode as Node)) : undefined;
    return (at ? [at] : []) as unknown as DOMRectList;
  };
  return range;
};
beforeAll(() => {
  realRange = document.createRange.bind(document);
  document.createRange = measuredRange;
});
afterAll(() => (document.createRange = realRange));
afterEach(() => {
  rects.clear();
  document.body.replaceChildren();
});

/** A canvas 1000 wide from 0, a group's name at its top left, the part picked at 400–700 down from 100, the next row under it. */
function canvas(options: { dir?: 'rtl'; nameWide?: number; nextAt?: number; nextLeft?: number } = {}) {
  const area = document.createElement('div');
  area.dir = options.dir ?? 'ltr';
  const name = document.createElement('legend');
  name.textContent = 'Visit';
  const part = document.createElement('div');
  part.style.position = 'relative';
  part.style.direction = options.dir ?? 'ltr';
  const bar = document.createElement('div');
  bar.className = 'fd-field-bar';
  bar.style.position = 'absolute';
  part.append(bar, Object.assign(document.createElement('label'), { textContent: 'Customer' }));
  const next = document.createElement('label');
  next.textContent = 'Notes';
  area.append(name, part, next);
  document.body.append(area);
  measure(area, { left: 0, top: 0, width: 1000, height: 800 });
  measure(name, { left: 20, top: 60, width: options.nameWide ?? 60, height: 24 });
  measure(part, { left: 400, top: 100, width: 300, height: 200 });
  // Where it stands before it is placed: just above the part's end, as the stylesheet puts it.
  measure(bar, { left: 450, top: 58, width: 250, height: 34 });
  Object.defineProperty(part, 'offsetWidth', { value: 300, configurable: true });
  measure(next, { left: options.nextLeft ?? 400, top: options.nextAt ?? 330, width: 60, height: 20 });
  measure(part.querySelector('label') as HTMLElement, { left: 400, top: 100, width: 80, height: 20 });
  return { area, part, bar, name, next };
}

/** The bar placed, as the canvas places it: read, then written. */
function place(at: ReturnType<typeof canvas>, room?: (px: number) => void) {
  const style = at.bar.style;
  // Its offsets from its part, as the browser resolves them.
  style.left = '50px';
  style.top = '-42px';
  readBarPlace({ bar: at.bar, part: at.part, area: at.area, room })?.();
  return { side: at.bar.dataset['side'], top: parseFloat(style.top), left: parseFloat(style.left) };
}

describe('a designer’s floating bar, placed', () => {
  it('goes just above its part, at its end edge, where nothing is there', () => {
    expect(place(canvas())).toEqual({ side: 'above', top: -42, left: 50 });
  });

  it('goes below where a group’s name is above it, and makes room where the next row is under it', () => {
    const rooms: number[] = [];
    const at = canvas({ nameWide: 700, nextAt: 310 });
    expect(place(at, (px) => rooms.push(px))).toEqual({ side: 'below', top: 208, left: 50 });
    // Room for the bar and a gap under it, where the next row's words were: they move down, never the part.
    expect(rooms).toEqual([40]);
    expect(at.part.dataset['barRoom']).toBe('40');
  });

  it('below with nothing under it makes no room, and gives room back once it goes above again', () => {
    const rooms: number[] = [];
    const at = canvas({ nameWide: 700, nextLeft: 20 });
    expect(place(at, (px) => rooms.push(px)).side).toBe('below');
    expect(rooms).toEqual([]);
    at.part.dataset['barRoom'] = '42';
    measure(at.name, { left: 20, top: 60, width: 60, height: 24 });
    expect(place(at, (px) => rooms.push(px)).side).toBe('above');
    expect(rooms).toEqual([0]);
    expect(at.part.dataset['barRoom']).toBeUndefined();
  });

  it('with no room to make, takes the side it covers least', () => {
    const at = canvas({ nameWide: 700, nextAt: 310 });
    measure(at.name, { left: 450, top: 82, width: 10, height: 10 });
    expect(place(at).side).toBe('above');
  });

  it('never goes over the canvas’s top: a part at its top has its bar below', () => {
    const at = canvas({ nextLeft: 20 });
    measure(at.part, { left: 400, top: 10, width: 300, height: 200 });
    expect(place(at).side).toBe('below');
  });

  it('right to left lines up with the part’s start edge, on its left; and stays inside the canvas', () => {
    expect(place(canvas({ dir: 'rtl' })).left).toBe(0);
    const wide = canvas();
    measure(wide.part, { left: 900, top: 100, width: 100, height: 200 });
    Object.defineProperty(wide.part, 'offsetWidth', { value: 100, configurable: true });
    // Its end at the canvas's, less 4px: never past it.
    const { left } = place(wide);
    expect(450 - 50 + left + 250).toBe(996);
  });

  it('in a document no engine lays out (jsdom: no boxes for words), goes above with nothing to keep clear, never throwing', () => {
    const at = canvas();
    document.createRange = realRange;
    try {
      expect(typeof document.createRange().getClientRects).not.toBe('function');
      expect(place(at).side).toBe('above');
    } finally {
      document.createRange = measuredRange;
    }
  });
});
