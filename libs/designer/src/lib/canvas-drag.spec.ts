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
      const label = document.createElement('label');
      label.className = 'fd-label';
      label.textContent = name[0].toUpperCase() + name.slice(1);
      card.append(label);
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

describe('dragging questions down a survey page', () => {
  it('places a question by height in a column, the line across under the one it follows', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const rects = new Map<Element, DOMRect>();
    const place = (element: Element, top: number, height: number) =>
      rects.set(element, { left: 0, top, width: 600, height, right: 600, bottom: top + height, x: 0, y: top, toJSON: () => ({}) } as DOMRect);
    const page = document.createElement('div');
    page.dataset['dropSection'] = 'step-1';
    page.dataset['dropFlow'] = 'column';
    place(page, 0, 400);
    const cards = ['name', 'email', 'coming'].map((id, i) => {
      const card = document.createElement('div');
      card.className = 'fd-q';
      card.dataset['node'] = id;
      page.append(card);
      place(card, i * 120, 100);
      return card;
    });
    host.append(page);
    const dropped: [DragSource, string, number][] = [];
    const drag = canvasDrag({ canvas: host, cards: '.fd-q[data-node]', drop: (source, to, index) => void dropped.push([source, to, index]), rectOf: (e) => rects.get(e) ?? e.getBoundingClientRect() });
    const pointer = (type: string, target: EventTarget, x: number, y: number) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }) as unknown as PointerEvent);
    pointer('pointerdown', cards[2], 500, 260);
    // Far to the right but in the top half of "email": before it, whatever the side — the gap opens there.
    pointer('pointermove', document, 580, 150);
    expect((document.querySelector('.fd-drop-slot') as HTMLElement).nextElementSibling).toBe(cards[1]);
    pointer('pointerup', document, 580, 150);
    expect(dropped).toEqual([[{ node: 'coming' }, 'step-1', 1]]);
    drag.destroy();
  });
});

describe('dragging columns along a list', () => {
  it('places a column by where the pointer is across the row, the line down the whole table', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const rects = new Map<Element, DOMRect>();
    const place = (element: Element, left: number, top: number, width: number, height: number) =>
      rects.set(element, { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect);
    const table = document.createElement('div');
    table.dataset['dropSection'] = 'columns';
    table.dataset['dropFlow'] = 'row';
    place(table, 0, 0, 600, 240);
    const heads = ['name', 'email', 'state'].map((id, i) => {
      const th = document.createElement('div');
      th.className = 'fd-th';
      th.dataset['node'] = id;
      table.append(th);
      place(th, 40 + i * 150, 0, 150, 34);
      return th;
    });
    host.append(table);
    const dropped: [DragSource, string, number][] = [];
    const drag = canvasDrag({ canvas: host, cards: '.fd-th[data-node]', drop: (source, to, index) => void dropped.push([source, to, index]), rectOf: (e) => rects.get(e) ?? e.getBoundingClientRect() });
    const pointer = (type: string, target: EventTarget, x: number, y: number) =>
      target.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0 }) as unknown as PointerEvent);
    pointer('pointerdown', heads[2], 400, 15);
    // Low down among the rows, but left of the middle of "email": before it.
    pointer('pointermove', document, 160, 200);
    const line = document.querySelector('.fd-drop-marker') as HTMLElement;
    expect([line.style.left, line.style.top, line.style.width, line.style.height]).toEqual(['189px', '0px', '3px', '240px']);
    pointer('pointerup', document, 160, 200);
    expect(dropped).toEqual([[{ node: 'state' }, 'columns', 1]]);
    // Past the last: the line down its far edge.
    pointer('pointerdown', heads[0], 60, 15);
    pointer('pointermove', document, 590, 100);
    expect([line.isConnected, (document.querySelector('.fd-drop-marker') as HTMLElement).style.left]).toEqual([false, '489px']);
    pointer('pointerup', document, 590, 100);
    expect(dropped[1]).toEqual([{ node: 'name' }, 'columns', 2]);
    drag.destroy();
  });
});

describe('dragging on the canvas', () => {
  it('carries a field to another section, a gap opening where it lands, and drops it there', () => {
    const { card, pointer, second, dropped } = canvas();
    pointer('pointerdown', card('customer').querySelector('label') as Element, 100, 60);
    // A press that has not moved is still a click.
    expect(document.querySelector('.fd-drag-ghost')).toBeNull();
    pointer('pointermove', document, 300, 470);
    expect(document.querySelector('.fd-drag-ghost')).not.toBeNull();
    expect(card('customer').classList.contains('fd-drag-source')).toBe(true);
    expect(second.classList.contains('fd-drop-target')).toBe(true);
    // In the second half of "next": the gap after it.
    expect(card('next').nextElementSibling?.classList.contains('fd-drop-slot')).toBe(true);
    pointer('pointerup', document, 300, 470);
    expect(dropped).toEqual([[{ node: 'customer' }, 'follow', 1]]);
    expect(document.querySelector('.fd-drag-ghost')).toBeNull();
    expect(document.querySelector('.fd-drop-slot')).toBeNull();
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

  it('drops last in a section from the room after its last field, and nowhere under the section', () => {
    const { card, pointer, dropped } = canvas();
    // Beside "notes", the last of the first section, in the room left on its row.
    pointer('pointerdown', card('next'), 100, 460);
    pointer('pointermove', document, 600, 150);
    pointer('pointerup', document, 600, 150);
    expect(dropped).toEqual([[{ node: 'next' }, 'visit', 3]]);
    // The first section ends at 300: under it is no section.
    pointer('pointerdown', card('due'), 500, 460);
    pointer('pointermove', document, 300, 318);
    pointer('pointerup', document, 300, 318);
    expect(dropped).toHaveLength(1);
  });

  it('marks the canvas while something is carried', () => {
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
    // Over no section: the gap goes back to where it came from.
    expect(card('date').previousElementSibling?.classList.contains('fd-drop-slot')).toBe(true);
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

  it('scrolls the window while something is held near its top or bottom edge, and stops when let go', () => {
    jest.useFakeTimers();
    const { card, pointer, drag } = canvas();
    const scrolled: number[] = [];
    const scrollBy = jest.spyOn(window, 'scrollBy').mockImplementation(((_x: number, y: number) => void scrolled.push(y)) as typeof window.scrollBy);
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointermove', document, 100, 300);
    expect(scrolled).toEqual([]);
    // Near the bottom: after a moment's rest there, down.
    pointer('pointermove', document, 100, window.innerHeight - 10);
    jest.advanceTimersByTime(200);
    expect(scrolled).toEqual([]);
    jest.advanceTimersByTime(150);
    expect(scrolled.length).toBeGreaterThan(2);
    expect(scrolled.every((y) => y > 0)).toBe(true);
    // Near the top: up.
    scrolled.length = 0;
    pointer('pointermove', document, 100, 300);
    pointer('pointermove', document, 100, 8);
    jest.advanceTimersByTime(400);
    expect(scrolled.length).toBeGreaterThan(0);
    expect(scrolled.every((y) => y < 0)).toBe(true);
    // Let go: no more.
    pointer('pointerup', document, 100, 8);
    scrolled.length = 0;
    jest.advanceTimersByTime(200);
    expect(scrolled).toEqual([]);
    scrollBy.mockRestore();
    jest.useRealTimers();
    drag.destroy();
  });

  it('opens a gap the size of what is carried in its own place, and moves it only across the middle of another field', () => {
    const { card, pointer, first, place } = canvas();
    card('customer').style.setProperty('--fd-span', '2');
    pointer('pointerdown', card('customer'), 100, 60);
    pointer('pointermove', document, 106, 64);
    const slot = document.querySelector('.fd-drop-slot') as HTMLElement;
    /** What a person sees in the first section, in order: the fields on show, and the gap. */
    const seen = () => [...first.children].filter((c) => !c.classList.contains('fd-drag-source')).map((c) => (c === slot ? '[gap]' : (c as HTMLElement).dataset['node']));
    // Where it was, as wide as it was; it is out of the way.
    expect(seen()).toEqual(['[gap]', 'date', 'notes']);
    expect(slot.style.getPropertyValue('--fd-span')).toBe('2');
    expect(slot.style.height).toBe('70px');
    expect(card('customer').classList.contains('fd-drag-source')).toBe(true);
    // A chip with its name follows the pointer.
    expect(document.querySelector('.fd-drag-chip')?.textContent).toBe('Customer');
    // Over the second half of "date": the gap after it.
    pointer('pointermove', document, 700, 70);
    expect(seen()).toEqual(['date', '[gap]', 'notes']);
    // Over the gap itself, wherever it is now drawn: it stays.
    place(slot, 10, 120, 380, 70);
    pointer('pointermove', document, 200, 150);
    expect(seen()).toEqual(['date', '[gap]', 'notes']);
    // Over the second half of "notes", moved on by the gap: after it.
    place(card('notes'), 400, 120, 380, 70);
    pointer('pointermove', document, 700, 150);
    expect(seen()).toEqual(['date', 'notes', '[gap]']);
    pointer('pointerup', document, 420, 150);
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
