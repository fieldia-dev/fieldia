import { dropIndex, sectionDrag } from './section-drag';

/** Two sections of two-column cards, laid out by hand: rectangles the way a browser would report them. */
function canvas() {
  const host = document.createElement('div');
  document.body.append(host);
  const rects = new Map<Element, DOMRect>();
  const place = (element: Element, left: number, top: number, width: number, height: number) =>
    rects.set(element, { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect);
  const section = (id: string, top: number, cards: string[]) => {
    const element = document.createElement('section');
    element.className = 'fd-canvas-section';
    element.dataset['node'] = id;
    const board = document.createElement('div');
    board.className = 'fd-canvas-board';
    element.append(board);
    place(element, 0, top, 800, 300);
    place(board, 10, top + 40, 780, 250);
    cards.forEach((name, i) => {
      const cell = document.createElement('div');
      const card = document.createElement('div');
      card.className = 'fd-canvas-field';
      card.dataset['node'] = name;
      card.setAttribute('inert', '');
      cell.append(card);
      board.append(cell);
      place(card, 10 + (i % 2) * 390, top + 40 + Math.floor(i / 2) * 80, 380, 70);
    });
    host.append(element);
    return element;
  };
  const first = section('visit', 0, ['customer', 'date', 'notes']);
  const second = section('follow', 400, ['next', 'due']);
  const moved: [string, string, number][] = [];
  const escapes: number[] = [];
  document.addEventListener('keydown', (event) => event.key === 'Escape' && escapes.push(1));
  const drag = sectionDrag({ canvas: host, move: (id, to, index) => void moved.push([id, to, index]), rectOf: (element) => rects.get(element) ?? element.getBoundingClientRect() });
  const card = (name: string) => host.querySelector(`.fd-canvas-field[data-node="${name}"]`) as HTMLElement;
  const pointer = (type: string, target: EventTarget, x: number, y: number) =>
    target.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button: 0 }) as unknown as PointerEvent);
  return { host, first, second, moved, escapes, drag, card, pointer };
}

afterEach(() => document.body.replaceChildren());

describe('dropIndex', () => {
  const r = (left: number, top: number) => ({ left, top, right: left + 100, bottom: top + 50 });
  it('counts the cards before a point in reading order', () => {
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

describe('sectionDrag', () => {
  it('takes over a drag the moment it is over another section, and puts the field where it is let go', () => {
    const { card, pointer, second, moved, escapes, host } = canvas();
    pointer('pointerdown', card('customer').parentElement as Element, 100, 60);
    pointer('pointermove', document, 120, 200);
    expect(escapes).toEqual([]);
    expect(host.ownerDocument.querySelector('.fd-drag-ghost')).toBeNull();
    pointer('pointermove', document, 300, 470);
    // The board's own gesture is called off, and the card follows the pointer here.
    expect(escapes).toEqual([1]);
    expect(host.ownerDocument.querySelector('.fd-drag-ghost')).not.toBeNull();
    expect(second.classList.contains('fd-drop-target')).toBe(true);
    pointer('pointerup', document, 300, 470);
    expect(moved).toEqual([['customer', 'follow', 1]]);
    expect(host.ownerDocument.querySelector('.fd-drag-ghost')).toBeNull();
    expect(second.classList.contains('fd-drop-target')).toBe(false);
  });

  it('drops last after the last card, and back in its own section counts its own place out', () => {
    const { card, pointer, moved } = canvas();
    pointer('pointerdown', card('customer').parentElement as Element, 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointermove', document, 500, 650);
    pointer('pointerup', document, 500, 650);
    expect(moved).toEqual([['customer', 'follow', 2]]);
    // Back over its own section, after "notes": its own place is not counted.
    pointer('pointerdown', card('customer').parentElement as Element, 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointermove', document, 600, 160);
    pointer('pointerup', document, 600, 160);
    expect(moved[1]).toEqual(['customer', 'visit', 2]);
  });

  it('lets a drag that never left its section be, and Escape calls off one it took over', () => {
    const { card, pointer, moved, escapes } = canvas();
    pointer('pointerdown', card('date').parentElement as Element, 500, 60);
    pointer('pointermove', document, 120, 150);
    pointer('pointerup', document, 120, 150);
    expect(escapes).toEqual([]);
    expect(moved).toEqual([]);
    pointer('pointerdown', card('date').parentElement as Element, 500, 60);
    pointer('pointermove', document, 300, 470);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    pointer('pointerup', document, 300, 470);
    expect(moved).toEqual([]);
    expect(document.querySelector('.fd-drag-ghost')).toBeNull();
  });

  it('takes over on a tab, too, and opens it after a moment', async () => {
    const { card, pointer, host, escapes } = canvas();
    const tab = document.createElement('button');
    tab.className = 'fd-canvas-tab';
    tab.setAttribute('aria-selected', 'false');
    let opened = 0;
    tab.addEventListener('click', () => opened++);
    host.append(tab);
    const rect = { left: 0, top: 340, right: 120, bottom: 380, width: 120, height: 40, x: 0, y: 340, toJSON: () => ({}) } as DOMRect;
    tab.getBoundingClientRect = () => rect;
    pointer('pointerdown', card('customer').parentElement as Element, 100, 60);
    pointer('pointermove', document, 60, 360);
    expect(escapes).toEqual([1]);
    expect(opened).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 520));
    expect(opened).toBe(1);
    pointer('pointerup', document, 60, 360);
  });

  it('goes quiet once taken down', () => {
    const { card, pointer, moved, drag } = canvas();
    drag.destroy();
    pointer('pointerdown', card('customer').parentElement as Element, 100, 60);
    pointer('pointermove', document, 300, 470);
    pointer('pointerup', document, 300, 470);
    expect(moved).toEqual([]);
  });
});
