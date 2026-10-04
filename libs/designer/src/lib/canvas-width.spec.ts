import { createDesigner } from './designer';
import { spanAt, tradeAt, widthMarks, type WidthMarks } from './canvas-width';
import { employeePage, nodeOf, watched } from './test-layout';

/**
 * Widths dragged on the Advanced canvas: a picked part's end edge snaps to the
 * columns of the grid it sits in, and the gutter between two parts of a row
 * trades columns between them — by the pointer, or by the arrow keys.
 */

describe('spanAt: the columns an edge dragged to covers', () => {
  // Three columns of 100 with gaps of 20: they start at 0, 120 and 240.
  const grid = { colW: 100, gap: 20, cols: 3 };
  it('rounds to the nearest column, never under one or over the grid', () => {
    expect(spanAt({ ...grid, start: 0, x: 90, rtl: false })).toBe(1);
    expect(spanAt({ ...grid, start: 0, x: 155, rtl: false })).toBe(1);
    expect(spanAt({ ...grid, start: 0, x: 165, rtl: false })).toBe(2);
    expect(spanAt({ ...grid, start: 0, x: 340, rtl: false })).toBe(3);
    expect(spanAt({ ...grid, start: 0, x: -50, rtl: false })).toBe(1);
    expect(spanAt({ ...grid, start: 0, x: 900, rtl: false })).toBe(3);
  });

  it('right to left, from the part’s right edge leftwards', () => {
    expect(spanAt({ ...grid, start: 340, x: 100, rtl: true })).toBe(2);
    expect(spanAt({ ...grid, start: 340, x: 280, rtl: true })).toBe(1);
  });
});

describe('tradeAt: where the gutter between two parts lands', () => {
  const grid = { colW: 100, gap: 20 };
  it('gives the first part the columns up to the gutter, at least one each', () => {
    expect(tradeAt({ ...grid, start: 0, total: 3, x: 110, rtl: false })).toBe(1);
    expect(tradeAt({ ...grid, start: 0, total: 3, x: 230, rtl: false })).toBe(2);
    expect(tradeAt({ ...grid, start: 0, total: 3, x: 900, rtl: false })).toBe(2);
    expect(tradeAt({ ...grid, start: 0, total: 3, x: -40, rtl: false })).toBe(1);
    expect(tradeAt({ ...grid, start: 360, total: 3, x: 130, rtl: true })).toBe(2);
  });
});

/** Role's first rows laid out by hand: three columns of 100, gaps of 20 — Job title | Department | Manager, then Start date | Contract (two wide). */
function setup(rtl = false) {
  const designer = watched(createDesigner({ page: employeePage() }));
  const rects = new Map<Element, DOMRect>();
  const place = (element: Element, left: number, top: number, width: number, height: number) =>
    rects.set(element, { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect);
  const canvas = document.createElement('div');
  const root = document.createElement('div');
  root.dataset['container'] = 'root';
  canvas.append(root);
  document.body.append(canvas);
  place(canvas, 0, 0, 400, 400);
  const grid = document.createElement('div');
  grid.className = 'fd-grid';
  grid.dataset['container'] = 'role';
  root.append(grid);
  place(grid, 0, 0, 340, 200);
  const cell = (id: string, left: number, top: number, width: number) => {
    const element = document.createElement('div');
    element.dataset['node'] = id;
    grid.append(element);
    place(element, left, top, width, 60);
    return element;
  };
  const x = (left: number) => (rtl ? 340 - left : left);
  cell('f-job_title', x(0) - (rtl ? 100 : 0), 0, 100);
  cell('f-department', x(120) - (rtl ? 100 : 0), 0, 100);
  cell('f-manager', x(240) - (rtl ? 100 : 0), 0, 100);
  cell('f-start_date', x(0) - (rtl ? 100 : 0), 80, 100);
  cell('f-contract', x(120) - (rtl ? 220 : 0), 80, 220);
  const marks = widthMarks({ canvas, root, designer, rtl: () => rtl, rectOf: (e) => rects.get(e) ?? e.getBoundingClientRect(), columnsOf: () => ({ cols: 3, gap: 20 }) });
  const pointer = (type: string, target: EventTarget, px: number, py: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: px, clientY: py, button: 0 }) as unknown as PointerEvent);
  const handle = () => canvas.querySelector('.fd-width-handle') as HTMLElement;
  const gutter = () => canvas.querySelector('.fd-gutter') as HTMLElement;
  const chip = () => canvas.querySelector('.fd-width-chip') as HTMLElement | null;
  const show = (id: string) => {
    designer.select(id);
    marks.update(designer.getState(), true);
  };
  /** Lay a part out as the canvas lays a field: its box grown by the ring round it. */
  const ring = (id: string) => {
    const element = grid.querySelector(`[data-node="${id}"]`) as HTMLElement;
    element.classList.add('fd-canvas-field');
    element.style.padding = '6px 8px';
    const r = rects.get(element) as DOMRect;
    place(element, r.left - 8, r.top - 6, r.width + 16, r.height + 12);
  };
  return { designer, marks, pointer, handle, gutter, chip, show, ring };
}

let current: WidthMarks | null = null;
afterEach(() => {
  current?.destroy();
  current = null;
  document.body.replaceChildren();
});

describe('the width handle', () => {
  it('sits on a picked part’s end edge, and only in Advanced', () => {
    const { marks, handle, show, designer } = setup();
    current = marks;
    show('f-contract');
    expect(handle().hidden).toBe(false);
    expect([handle().style.left, handle().style.top]).toEqual(['336px', '95px']);
    marks.update(designer.getState(), false);
    expect(handle().hidden).toBe(true);
  });

  it('dragged, snaps to the columns, says how many, and sets the width as one edit', () => {
    const { marks, handle, pointer, chip, show, designer } = setup();
    current = marks;
    show('f-contract');
    pointer('pointerdown', handle(), 340, 110);
    pointer('pointermove', document, 290, 110);
    pointer('pointermove', document, 230, 110);
    expect(chip()?.textContent).toBe('1 of 3 columns');
    pointer('pointerup', document, 230, 110);
    expect(nodeOf(designer.getPage(), 'f-contract')?.['colspan']).toBeUndefined();
    expect(chip()).toBeNull();
    designer.undo();
    expect(nodeOf(designer.getPage(), 'f-contract')?.['colspan']).toBe(2);
  });

  it('right to left, on the edge at its left, dragged rightwards', () => {
    const { marks, handle, pointer, show, designer } = setup(true);
    current = marks;
    show('f-contract');
    expect(handle().style.left).toBe('-4px');
    pointer('pointerdown', handle(), 0, 110);
    pointer('pointermove', document, 110, 110);
    pointer('pointerup', document, 110, 110);
    expect(nodeOf(designer.getPage(), 'f-contract')?.['colspan']).toBeUndefined();
  });

  it('gives way to the gutter where another part follows in the row', () => {
    const { marks, handle, gutter, show } = setup();
    current = marks;
    show('f-start_date');
    expect([handle().hidden, gutter().hidden]).toEqual([true, false]);
    expect([gutter().style.left, gutter().style.top, gutter().style.height]).toEqual(['104px', '80px', '60px']);
  });
});

describe('the gutter between two parts of a row', () => {
  it('trades columns between them, one edit, with the pointer', () => {
    const { marks, gutter, pointer, chip, show, designer } = setup();
    current = marks;
    show('f-start_date');
    expect(gutter().hidden).toBe(false);
    expect(gutter().getAttribute('aria-label')).toBe('Width between “Start date” and “Contract”');
    pointer('pointerdown', gutter(), 110, 110);
    pointer('pointermove', document, 170, 110);
    pointer('pointermove', document, 235, 110);
    expect(chip()?.textContent).toBe('2 and 1 of 3 columns');
    pointer('pointerup', document, 235, 110);
    expect([nodeOf(designer.getPage(), 'f-start_date')?.['colspan'], nodeOf(designer.getPage(), 'f-contract')?.['colspan']]).toEqual([2, undefined]);
    designer.undo();
    expect([nodeOf(designer.getPage(), 'f-start_date')?.['colspan'], nodeOf(designer.getPage(), 'f-contract')?.['colspan']]).toEqual([undefined, 2]);
  });

  it('with the arrow keys, a column at a time, mirrored right to left', () => {
    const { marks, gutter, show, designer } = setup();
    current = marks;
    show('f-start_date');
    expect([gutter().getAttribute('role'), gutter().getAttribute('aria-valuenow'), gutter().getAttribute('aria-valuemax')]).toEqual(['separator', '1', '2']);
    gutter().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(nodeOf(designer.getPage(), 'f-start_date')?.['colspan']).toBe(2);
    gutter().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(nodeOf(designer.getPage(), 'f-start_date')?.['colspan']).toBe(2);
    const rtl = setup(true);
    current?.destroy();
    current = rtl.marks;
    rtl.show('f-start_date');
    rtl.gutter().dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(nodeOf(rtl.designer.getPage(), 'f-start_date')?.['colspan']).toBe(2);
  });

  it('measures a field by its own box, not the ring round it it is picked by', () => {
    const { marks, gutter, show, ring } = setup();
    current = marks;
    // On the canvas a field reaches 6px and 8px into the gap round it, for its ring.
    ring('f-start_date');
    show('f-start_date');
    expect(gutter().hidden).toBe(false);
    expect([gutter().style.left, gutter().style.top, gutter().style.height]).toEqual(['104px', '80px', '60px']);
  });

  it('only between two parts of one row: none after the last of a row', () => {
    const { marks, gutter, show } = setup();
    current = marks;
    show('f-manager');
    expect(gutter().hidden).toBe(true);
  });
});
