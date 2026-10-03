import { canvasDrag, dropIndex, type DragSource } from './canvas-drag';

/** Two sections of two-column fields, laid out by hand: rectangles the way a browser would report them. */
function canvas() {
  const host = document.createElement('div');
  document.body.append(host);
  const rects = new Map<Element, DOMRect>();
  const place = (element: Element, left: number, top: number, width: number, height: number) =>
    rects.set(element, { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect);
  const section = (id: string, top: number, fields: string[]) => {
    const element = document.createElement('fieldset');
    element.className = 'fd-section fd-canvas-section';
    element.dataset['dropSection'] = id;
    place(element, 0, top, 800, 300);
    fields.forEach((name, i) => {
      const card = document.createElement('div');
      card.className = 'fd-field fd-canvas-field';
      card.dataset['node'] = name;
      card.append(document.createElement('label'));
      element.append(card);
      place(card, 10 + (i % 2) * 390, top + 40 + Math.floor(i / 2) * 80, 380, 70);
    });
    host.append(element);
    return element;
  };
  const first = section('visit', 0, ['customer', 'date', 'notes']);
  const second = section('follow', 400, ['next', 'due']);
  const dropped: [DragSource, string, number][] = [];
  const drag = canvasDrag({ canvas: host, drop: (source, to, index) => void dropped.push([source, to, index]), rectOf: (element) => rects.get(element) ?? element.getBoundingClientRect() });
  const card = (name: string) => host.querySelector(`.fd-canvas-field[data-node="${name}"]`) as HTMLElement;
  const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }) as unknown as PointerEvent);
  return { host, first, second, dropped, drag, card, pointer, place };
}

afterEach(() => document.body.replaceChildren());

describe('dropIndex', () => {
  const r = (left: number, top: number) => ({ left, top, right: left + 100, bottom: top + 50 });
  it('counts the fields before a point in reading order', () => {
    const cards = [r(0, 0), r(110, 0), r(0, 60)];
    expect(dropIndex(cards, 10, 20)).toBe(0);
    expect(dropIndex(cards, 90, 20)).toBe(1);
    expect(dropIndex(cards, 200, 20)).toBe(2);
    expect(dropIndex(cards, 5, 80)).toBe(2);
    expect(dropIndex(cards, 80, 80)).toBe(3);
    expect(dropIndex(cards, 50, 200)).toBe(3);
    expect(dropIndex([], 50, 50)).toBe(0);
  });
});

describe('dragging on the canvas', () => {
  it('carries a field to another section, a line where it lands, and drops it there', () => {
    const { card, pointer, second, dropped } = canvas();
    pointer('pointerdown', card('customer').querySelector('label') as Element, 100, 60);
    // A press that has not moved is still a click.
    expect(document.querySelector('.fd-drag-ghost')).toBeNull();
    pointer('pointermove', document, 300, 470);
    expect(document.querySelector('.fd-drag-ghost')).not.toBeNull();
    expect(card('customer').classList.contains('fd-drag-source')).toBe(true);
    expect(second.classList.contains('fd-drop-target')).toBe(true);
    expect((document.querySelector('.fd-drop-marker') as HTMLElement).hidden).toBe(false);
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([[{ node: 'customer' }, 'follow', 1]]);
    expect(document.querySelector('.fd-drag-ghost')).toBeNull();
    expect(document.querySelector('.fd-drop-marker')).toBeNull();
    expect(second.classList.contains('fd-drop-target')).toBe(false);
    expect(card('customer').classList.contains('fd-drag-source')).toBe(false);
  });

  it('moves within its own section too, its own place not counted', () => {
    const { card, pointer, dropped } = canvas();
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointermove', document, 600, 160);
    pointer('pointerup', document, 600, 160);
    // After "notes", the last of the other two.
    expect(dropped).toEqual([[{ node: 'customer' }, 'visit', 2]]);
  });

  it('leaves a press without a move to the click, and swallows the click after a drag', () => {
    const { card, pointer, dropped } = canvas();
    let clicks = 0;
    card('customer').addEventListener('click', () => clicks++);
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointerup', card('customer'), 101, 61);
    card('customer').click();
    expect(dropped).toEqual([]);
    expect(clicks).toBe(1);
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', card('customer'), 300, 470);
    card('customer').click();
    expect(clicks).toBe(1);
  });

  it('drops last in a section from the gap just under it, and nowhere further down', () => {
    const { card, pointer, dropped } = canvas();
    // The first section ends at 300; the second starts at 400.
    pointer('pointerdown', card('next'), 100, 460);
    pointer('pointermove', document, 300, 318);
    pointer('pointerup', document, 300, 318);
    expect(dropped).toEqual([[{ node: 'next' }, 'visit', 3]]);
    pointer('pointerdown', card('due'), 500, 460);
    pointer('pointermove', document, 300, 340);
    pointer('pointerup', document, 300, 340);
    expect(dropped).toHaveLength(1);
  });

  it('marks the canvas while something is carried, so each section can show a place to drop it last', () => {
    const { host, card, pointer } = canvas();
    pointer('pointerdown', card('customer'), 100, 60);
    expect(host.classList.contains('fd-dragging')).toBe(false);
    pointer('pointermove', document, 300, 470);
    expect(host.classList.contains('fd-dragging')).toBe(true);
    pointer('pointerup', document, 300, 470);
    expect(host.classList.contains('fd-dragging')).toBe(false);
  });

  it('takes a press that wobbles a pixel or two for a click, not a drag', () => {
    const { card, pointer, dropped } = canvas();
    let clicks = 0;
    card('customer').addEventListener('click', () => clicks++);
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointermove', document, 102, 61);
    expect(document.querySelector('.fd-drag-ghost')).toBeNull();
    pointer('pointerup', card('customer'), 102, 61);
    card('customer').click();
    expect(dropped).toEqual([]);
    expect(clicks).toBe(1);
  });

  it('moves the field being edited by its grip only: elsewhere on it the press is for its boxes and bar', () => {
    const { card, pointer, dropped } = canvas();
    const editing = card('customer');
    editing.classList.add('fd-editing');
    const bar = document.createElement('button');
    editing.append(bar);
    pointer('pointerdown', editing, 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', document, 300, 470);
    pointer('pointerdown', bar, 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([]);
  });

  it('drops nothing outside every section, and Escape calls a drag off', () => {
    const { card, pointer, dropped } = canvas();
    pointer('pointerdown', card('date'), 500, 60);
    pointer('pointermove', document, 900, 350);
    expect((document.querySelector('.fd-drop-marker') as HTMLElement).hidden).toBe(true);
    pointer('pointerup', document, 900, 350);
    pointer('pointerdown', card('date'), 500, 60);
    pointer('pointermove', document, 300, 470);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([]);
    expect(document.querySelector('.fd-drag-ghost')).toBeNull();
  });

  it('carries a tile pressed in the toolbox and drops what it adds', () => {
    const { drag, pointer, dropped } = canvas();
    const tile = document.createElement('button');
    document.body.append(tile);
    drag.press({ tool: 'kind:date' }, new MouseEvent('pointerdown', { clientX: 5, clientY: 5, button: 0 }) as unknown as PointerEvent, tile);
    pointer('pointermove', document, 30, 30);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([[{ tool: 'kind:date' }, 'follow', 1]]);
  });

  it('starts nothing from a box being typed in, but does from the grip of the field being edited', () => {
    const { card, pointer, dropped } = canvas();
    const editing = card('customer');
    editing.classList.add('fd-editing');
    const input = document.createElement('input');
    const grip = document.createElement('button');
    grip.dataset['grip'] = '';
    editing.append(input, grip);
    pointer('pointerdown', input, 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([]);
    pointer('pointerdown', grip, 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([[{ node: 'customer' }, 'follow', 1]]);
  });

  it('opens a closed tab the pointer rests on, so a field can go into another tab', async () => {
    const { host, card, pointer, place } = canvas();
    const tab = document.createElement('button');
    tab.className = 'fd-tab';
    tab.setAttribute('aria-selected', 'false');
    let opened = 0;
    tab.addEventListener('click', () => opened++);
    host.append(tab);
    place(tab, 0, 340, 120, 40);
    tab.getBoundingClientRect = () => ({ left: 0, top: 340, right: 120, bottom: 380, width: 120, height: 40, x: 0, y: 340, toJSON: () => ({}) }) as DOMRect;
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointermove', document, 60, 360);
    expect(opened).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 520));
    expect(opened).toBe(1);
    pointer('pointerup', document, 60, 360);
  });

  it('goes quiet once taken down', () => {
    const { card, pointer, dropped, drag } = canvas();
    drag.destroy();
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([]);
  });
});
