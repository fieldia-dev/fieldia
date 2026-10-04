import { elementFactory } from './chrome';
import { createDesigner, type Designer } from './designer';
import { advancedDrag } from './canvas-advanced';
import { canvasPlace, dropEcho, outlineMark, type DropEcho } from './drop-echo';
import { outlineRows } from './outline-rows';
import { outlineView, type OutlineView } from './outline-view';
import { employeePage, fakeCanvas } from './test-layout';

/**
 * One drop line, drawn in the outline and on the canvas at once, as
 * Designable draws it: while a row is dragged in the outline, the canvas
 * shows where the part will land with the line and chip a canvas drag
 * draws, at the same place; while a part is dragged on the canvas, the
 * outline shows the line at the matching row. Only drawing: where it is let
 * go is each drag's own to decide.
 */

const page = employeePage();
const rows = outlineRows(page).map((r) => ({ id: r.id, level: r.level }));
const at = (id: string) => rows.findIndex((r) => r.id === id);

describe('where a drop in the outline lands on the canvas', () => {
  it('is before the part now at its place, or after the last when it goes at the end', () => {
    expect(canvasPlace(page, { parent: 'address', index: 1 })).toEqual({ kind: 'edge', target: 'f-city', after: false });
    expect(canvasPlace(page, { parent: 'address', index: 4 })).toEqual({ kind: 'edge', target: 'f-country', after: true });
    expect(canvasPlace(page, { parent: 'root', index: 0 })).toEqual({ kind: 'edge', target: 'personal', after: false });
    expect(canvasPlace(page, { parent: 'tab-docs', index: 0 })).toEqual({ kind: 'edge', target: 'docs', after: false });
  });

  it('is into a group, at its end, when it goes into one; or into an empty one', () => {
    expect(canvasPlace(page, { parent: 'emergency', index: 3, into: 'emergency' })).toEqual({ kind: 'into', container: 'emergency', last: 'f-ec_phone' });
    const empty = { ...page, layout: { ...page.layout, children: [...(page.layout as unknown as { children: never[] }).children, { type: 'section', id: 'empty', title: 'New', children: [] }] } } as typeof page;
    expect(canvasPlace(empty, { parent: 'empty', index: 0 })).toEqual({ kind: 'into', container: 'empty', last: null });
    expect(canvasPlace(page, { parent: 'nowhere', index: 0 })).toBeNull();
  });
});

describe('where a drop on the canvas lands in the outline', () => {
  it('is before or after the part it is beside or under, at its depth', () => {
    expect(outlineMark(rows, page, { how: 'beside', target: 'f-city', after: false })).toEqual({ gap: at('f-city'), level: 2 });
    expect(outlineMark(rows, page, { how: 'under', target: 'f-city', after: true })).toEqual({ gap: at('f-postcode'), level: 2 });
  });

  it('is after the whole of a group, its parts too, for a drop by the group’s edge', () => {
    expect(outlineMark(rows, page, { how: 'under', target: 'address', after: true, whole: true })).toEqual({ gap: at('emergency'), level: 1 });
    expect(outlineMark(rows, page, { how: 'beside', target: 'address', after: false, whole: true })).toEqual({ gap: at('address'), level: 1 });
  });

  it('is between a group’s rows by their place, the part carried left out, and after its last at the end', () => {
    expect(outlineMark(rows, page, { how: 'row', container: 'address', index: 1 }, 'f-street')).toEqual({ gap: at('f-postcode'), level: 2 });
    expect(outlineMark(rows, page, { how: 'row', container: 'address', index: 1 })).toEqual({ gap: at('f-city'), level: 2 });
    expect(outlineMark(rows, page, { how: 'row', container: 'address', index: 9 })).toEqual({ gap: at('emergency'), level: 2 });
    expect(outlineMark(rows, page, { how: 'at', container: 'root', index: 0 })).toEqual({ gap: 0, level: 0 });
  });

  it('washes the group a part goes into, and the page’s end is after every row', () => {
    expect(outlineMark(rows, page, { how: 'into', container: 'emergency' })).toEqual({ into: 'emergency' });
    expect(outlineMark(rows, page, { how: 'into', container: 'root' })).toEqual({ gap: rows.length, level: 0 });
  });

  it('washes the nearest row on show when the part is folded away', () => {
    const shown = rows.filter((r) => !['f-street', 'f-city', 'f-postcode', 'f-country'].includes(r.id));
    expect(outlineMark(shown, page, { how: 'beside', target: 'f-city', after: false })).toEqual({ into: 'address' });
  });
});

describe('the line drawn on the other side', () => {
  const ROW = 20;
  let echo: DropEcho;
  let view: OutlineView;
  let designer: Designer;

  function setup() {
    const fake = fakeCanvas(employeePage());
    designer = createDesigner({ page: fake.page });
    const canvas = document.createElement('div');
    canvas.className = 'fd-canvas';
    document.body.append(canvas);
    canvas.append(fake.root);
    fake.place(canvas, 0, 0, 900, 900);
    const rail = document.createElement('div');
    document.body.append(rail);
    const box = (left: number, top: number, right: number, bottom: number) => ({ left, top, right, bottom, width: right - left, height: bottom - top, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    const tree = () => view.element.querySelector('[role="tree"]') as HTMLElement;
    const treeRows = () => [...tree().querySelectorAll('[role="treeitem"]')];
    const rectOf = (element: Element): DOMRect => {
      if (element === tree()) return box(1000, 100, 1228, 100 + treeRows().length * ROW);
      const i = treeRows().indexOf(element);
      return i === -1 ? fake.rectOf(element) : box(1000, 100 + i * ROW, 1228, 100 + (i + 1) * ROW);
    };
    view = outlineView({ el: elementFactory(document), doc: document, designer, survey: false, reveal: () => undefined, several: () => true, say: () => undefined, rectOf });
    rail.append(view.element);
    // On show, as the rail shows it on its Outline tab.
    view.element.hidden = false;
    view.update(designer.getState(), true);
    echo = dropEcho({ editor: document.body, canvas, parts: fake.root, tree: tree(), designer, rtl: () => false, rectOf });
    const send = (target: Element, detail: object) => target.dispatchEvent(new CustomEvent('fd-drop-echo', { bubbles: true, detail }));
    const shownIndex = (id: string) => treeRows().findIndex((r) => (r as HTMLElement).dataset['pick'] === id);
    const canvasDrag = advancedDrag({ canvas, root: fake.root, designer, rtl: () => false, rectOf, elementAt: fake.under });
    return { canvas, tree, send, shownIndex, canvasDrag, fake, treeRows };
  }

  const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }));
  /** Press, and move at hand speed to a point, in a few steps. */
  function carry(target: Element, from: [number, number], to: [number, number]) {
    pointer('pointerdown', target, ...from);
    for (let i = 1; i <= 4; i++) pointer('pointermove', document, from[0] + ((to[0] - from[0]) * i) / 4, from[1] + ((to[1] - from[1]) * i) / 4);
  }

  it('is said by the outline’s own drag: a row carried shows on the canvas where it lands, and goes when let go', () => {
    const { canvas, shownIndex, treeRows, canvasDrag } = setup();
    const rowAt = (id: string, fraction: number): [number, number] => [1100, 100 + (shownIndex(id) + fraction) * ROW];
    carry(treeRows()[shownIndex('f-photo')], rowAt('f-photo', 0.5), rowAt('f-ec_relation', 0.25));
    const bar = canvas.querySelector('.fd-drop-bar.fd-drop-echo') as HTMLElement;
    expect(bar.style.top).toBe('543px');
    expect(canvas.querySelector('.fd-drop-chip.fd-drop-echo .fd-drop-where')?.textContent).toBe(document.querySelector('.fd-outline-chip-where')?.textContent);
    pointer('pointerup', document, ...rowAt('f-ec_relation', 0.25));
    expect(canvas.querySelector('.fd-drop-echo')).toBeNull();
    canvasDrag.destroy();
  });

  it('is said by the canvas’s own drag: a part carried shows in the outline where it lands, and goes when let go', () => {
    const { tree, fake, canvasDrag } = setup();
    const mobile = fake.root.querySelector('[data-node="f-mobile"]') as HTMLElement;
    carry(mobile, [700, 180], [580, 100]);
    const line = tree().querySelector('.fd-outline-line.fd-drop-echo') as HTMLElement;
    expect(line.isConnected).toBe(true);
    expect(line.style.getPropertyValue('--fd-drop-level')).toBe('2');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(tree().querySelector('.fd-drop-echo')).toBeNull();
    canvasDrag.destroy();
  });

  afterEach(() => {
    echo?.destroy();
    document.body.replaceChildren();
  });

  it('shows on the canvas, while a row is dragged in the outline, the line and chip where it lands', () => {
    const { canvas, tree, send } = setup();
    send(tree(), { source: 'outline', ids: ['f-photo'], name: 'Photo', spot: { parent: 'emergency', index: 1, level: 2, gap: 0 }, words: 'into “Emergency contact”, before “Relation”' });
    const bar = canvas.querySelector('.fd-drop-bar.fd-drop-echo') as HTMLElement;
    // Above Relation, which sits at 550 to 610, across its width: as the canvas's own drag draws it.
    expect([bar.style.left, bar.style.top, bar.style.width, bar.style.height]).toEqual(['20px', '543px', '860px', '4px']);
    const chip = canvas.querySelector('.fd-drop-chip.fd-drop-echo') as HTMLElement;
    expect(chip.textContent).toBe('Photointo “Emergency contact”, before “Relation”');
    // In a group of columns, before a part is a line down its leading side.
    send(tree(), { source: 'outline', ids: ['f-photo'], name: 'Photo', spot: { parent: 'who', index: 1, level: 2, gap: 0 }, words: 'before' });
    expect([bar.style.left, bar.style.top, bar.style.width, bar.style.height]).toEqual(['593px', '70px', '4px', '60px']);
    send(tree(), { source: 'outline', spot: null });
    expect(canvas.querySelector('.fd-drop-echo')).toBeNull();
  });

  it('tints a group a row goes into, with the line after its last part', () => {
    const { canvas, tree, send } = setup();
    send(tree(), { source: 'outline', ids: ['f-photo'], name: 'Photo', spot: { parent: 'emergency', index: 3, level: 2, gap: 0, into: 'emergency' }, words: 'into “Emergency contact”, at the end' });
    const zone = canvas.querySelector('.fd-drop-zone.fd-drop-echo') as HTMLElement;
    expect([zone.hidden, zone.style.top, zone.style.height]).toEqual([false, '440px', '260px']);
    expect((canvas.querySelector('.fd-drop-bar.fd-drop-echo') as HTMLElement).style.top).toBe('683px');
  });

  it('shows in the outline, while a part is dragged on the canvas, the line at the matching row', () => {
    const { canvas, tree, send, shownIndex } = setup();
    send(canvas, { source: 'canvas', drop: { how: 'under', target: 'f-city', after: true }, moving: 'f-photo' });
    const line = tree().querySelector('.fd-outline-line.fd-drop-echo') as HTMLElement;
    expect(line.isConnected).toBe(true);
    expect(line.style.top).toBe(`${shownIndex('f-postcode') * ROW}px`);
    expect(line.style.getPropertyValue('--fd-drop-level')).toBe('2');
    send(canvas, { source: 'canvas', drop: { how: 'into', container: 'emergency' } });
    expect(tree().querySelector('.fd-outline-line.fd-drop-echo')).toBeNull();
    expect(tree().querySelector('[data-pick="emergency"]')?.classList.contains('fd-outline-into')).toBe(true);
    send(canvas, { source: 'canvas', drop: null });
    expect(tree().querySelector('.fd-drop-echo, .fd-outline-into')).toBeNull();
  });

  it('draws nothing in an outline that is not on show', () => {
    const { canvas, tree, send } = setup();
    view.element.hidden = true;
    send(canvas, { source: 'canvas', drop: { how: 'under', target: 'f-city', after: true } });
    expect(tree().querySelector('.fd-drop-echo:not([hidden])')).toBeNull();
  });
});
