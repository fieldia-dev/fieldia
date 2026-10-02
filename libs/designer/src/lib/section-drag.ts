/**
 * Moving a field to another section by dragging it there.
 *
 * Each section is a board of its own, and a board moves a card only within
 * itself. So the editor watches the drag: the moment the pointer is over
 * another section, the board's gesture is called off (Escape puts the board
 * back as it was), and the card follows the pointer here instead, with a line
 * where it would land. Let go over a section, it moves there, one edit; let
 * go anywhere else, or press Escape, and nothing changes. Hovering over a tab
 * opens it, so a field can go into another tab's section.
 *
 * Cards on the canvas are inert, so nothing here hit-tests them: it reads
 * where they are.
 */

interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** How many of the cards, in reading order, come before a point: where a card let go there would go. */
export function dropIndex(cards: readonly Rect[], x: number, y: number): number {
  return cards.filter((r) => r.bottom <= y || (r.top <= y && (r.left + r.right) / 2 < x)).length;
}

export interface SectionDragOptions {
  /** The canvas: every section on it, and the tabs that hold some. */
  canvas: HTMLElement;
  /** Put a field into a section, at a place among its fields. */
  move(fieldId: string, sectionId: string, index: number): void;
  /** Where an element is on screen; the browser's own by default. */
  rectOf?: (element: Element) => DOMRect;
}

/** How long the pointer rests on a tab before it opens. */
const TAB_DELAY = 450;

export function sectionDrag(options: SectionDragOptions) {
  const { canvas, move } = options;
  const doc = canvas.ownerDocument;
  const rectOf = options.rectOf ?? ((element: Element) => element.getBoundingClientRect());
  const inside = (r: Rect, x: number, y: number) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

  interface Drag {
    field: string;
    from: string;
    card: HTMLElement;
    /** Taken over from the board: the card follows the pointer here. */
    ours: boolean;
    ghost: HTMLElement | null;
    marker: HTMLElement | null;
    target: { section: HTMLElement; index: number } | null;
    offset: { x: number; y: number };
  }
  let drag: Drag | null = null;
  let tabTimer: ReturnType<typeof setTimeout> | undefined;
  let tabUnder: HTMLElement | null = null;

  const sections = () => [...canvas.querySelectorAll<HTMLElement>('.fd-canvas-section')].filter((s) => s.isConnected && !s.closest('[hidden]'));
  const cardsIn = (section: HTMLElement) => [...section.querySelectorAll<HTMLElement>('.fd-canvas-field')];
  const sectionAt = (x: number, y: number) => sections().find((s) => inside(rectOf(s), x, y)) ?? null;

  function onDown(event: PointerEvent) {
    if (event.button !== 0 || drag) return;
    const section = (event.target as Element).closest?.<HTMLElement>('.fd-canvas-section');
    if (!section?.contains(event.target as Node) || !(event.target as Element).closest('.fd-canvas-board')) return;
    const card = cardsIn(section).find((c) => inside(rectOf(c), event.clientX, event.clientY));
    if (!card?.dataset['node']) return;
    const r = rectOf(card);
    drag = { field: card.dataset['node'], from: section.dataset['node'] ?? '', card, ours: false, ghost: null, marker: null, target: null, offset: { x: event.clientX - r.left, y: event.clientY - r.top } };
  }

  /** The board lets go of its gesture; from here the drag is ours. */
  function takeOver(current: Drag, x: number, y: number) {
    current.ours = true;
    doc.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    // The card stays put, faded, while its ghost travels.
    current.card.classList.add('fd-drag-source');
    const r = rectOf(current.card);
    const ghost = current.card.cloneNode(true) as HTMLElement;
    ghost.removeAttribute('inert');
    ghost.classList.add('fd-drag-ghost');
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.width = `${r.right - r.left}px`;
    current.ghost = ghost;
    current.marker = doc.createElement('div');
    current.marker.className = 'fd-drop-marker';
    // Inside the editor, so the card keeps the form's look.
    (canvas.closest('.fd-form') ?? doc.body).append(ghost, current.marker);
    follow(current, x, y);
  }

  function follow(current: Drag, x: number, y: number) {
    if (current.ghost) {
      current.ghost.style.left = `${x - current.offset.x}px`;
      current.ghost.style.top = `${y - current.offset.y}px`;
    }
    const section = sectionAt(x, y);
    for (const s of sections()) s.classList.toggle('fd-drop-target', s === section);
    if (!section) {
      current.target = null;
      if (current.marker) current.marker.hidden = true;
      return;
    }
    // Its own place is not counted: in its own section the others close up around it.
    const others = cardsIn(section).filter((c) => c !== current.card);
    const rects = others.map(rectOf);
    const index = dropIndex(rects, x, y);
    current.target = { section, index };
    if (!current.marker) return;
    current.marker.hidden = false;
    const at = rects[index];
    const last = rects[rects.length - 1];
    const area = rectOf(section.querySelector('.fd-canvas-board') ?? section);
    // Before a card: a line down its leading edge; after them all, a line across under the last.
    const line = at
      ? { left: at.left - 5, top: at.top, width: 3, height: at.bottom - at.top }
      : { left: area.left + 6, top: (last ? last.bottom : area.top) + 4, width: area.right - area.left - 12, height: 3 };
    Object.assign(current.marker.style, { left: `${line.left}px`, top: `${line.top}px`, width: `${line.width}px`, height: `${line.height}px` });
  }

  /** A tab not on show under the pointer: somewhere to take the field, once it opens. */
  const closedTabAt = (x: number, y: number) =>
    [...canvas.querySelectorAll<HTMLElement>('.fd-canvas-tab')].find((t) => t.getAttribute('aria-selected') !== 'true' && inside(rectOf(t), x, y)) ?? null;

  /** A tab under the pointer opens after a moment, its sections then taking the drop. */
  function restOnTab(x: number, y: number) {
    const tab = closedTabAt(x, y);
    if (tab === tabUnder) return;
    clearTimeout(tabTimer);
    tabUnder = tab;
    if (tab) tabTimer = setTimeout(() => tab.click(), TAB_DELAY);
  }

  function onMove(event: PointerEvent) {
    if (!drag) return;
    const { clientX: x, clientY: y } = event;
    if (!drag.ours) {
      // Another section, or a tab that would show others: the board cannot take it there, so this drag is ours.
      const over = sectionAt(x, y);
      if ((over && over.dataset['node'] !== drag.from) || closedTabAt(x, y)) takeOver(drag, x, y);
      else return;
    }
    follow(drag, x, y);
    restOnTab(x, y);
  }

  function end(commit: boolean) {
    const current = drag;
    drag = null;
    clearTimeout(tabTimer);
    tabUnder = null;
    if (!current) return;
    current.ghost?.remove();
    current.marker?.remove();
    current.card.classList.remove('fd-drag-source');
    for (const s of sections()) s.classList.remove('fd-drop-target');
    if (commit && current.ours && current.target) move(current.field, current.target.section.dataset['node'] ?? '', current.target.index);
  }

  const onUp = () => end(true);
  const onCancel = () => end(false);
  const onKey = (event: KeyboardEvent) => {
    // Our own Escape, sent to the board before the ghost exists, is not the person's.
    if (event.key === 'Escape' && drag?.ours && drag.ghost) end(false);
  };
  canvas.addEventListener('pointerdown', onDown, true);
  doc.addEventListener('pointermove', onMove, true);
  doc.addEventListener('pointerup', onUp, true);
  doc.addEventListener('pointercancel', onCancel, true);
  doc.addEventListener('keydown', onKey, true);

  return {
    destroy() {
      end(false);
      canvas.removeEventListener('pointerdown', onDown, true);
      doc.removeEventListener('pointermove', onMove, true);
      doc.removeEventListener('pointerup', onUp, true);
      doc.removeEventListener('pointercancel', onCancel, true);
      doc.removeEventListener('keydown', onKey, true);
    },
  };
}
