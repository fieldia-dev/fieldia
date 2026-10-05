import type { Designer } from './designer';
import { echo } from './drop-echo';
import { dropSpot, type DropSpot } from './outline-drop';
import type { OutlineRow } from './outline-rows';

/**
 * Dragging rows of the outline, as the approved mockup drags them, at hand
 * speed: what is carried stays where it is, dimmed, while one line shows
 * where it would go — drawn as far in as the depth it lands at — or the row
 * it would go into is washed (outline-drop.ts decides which). Moving the
 * pointer across as well as down changes the depth, a row's indent at a
 * time. A chip by the pointer says where in words, or why not. Let go, the
 * rows move there as one edit (`moveParts`) and the move is said aloud;
 * Escape, or letting go where nothing takes them, changes nothing. Held
 * near the top or the bottom of the rail, the rail scrolls under them.
 *
 * What is carried: the rows picked, when the press is on one of them;
 * otherwise the row pressed.
 */

export interface OutlineDragOptions {
  tree: HTMLElement;
  designer: Designer;
  /** The rows on show, in order, and their elements. */
  rows(): readonly OutlineRow[];
  viewOf(id: string): HTMLElement | undefined;
  folded(): ReadonlySet<string>;
  rtl(): boolean;
  say(words: string): void;
  rectOf(element: Element): DOMRect;
}

/** How far the pointer moves before a press becomes a drag. */
const SLOP = 5;
/** A row's indent: moving the pointer this far across changes the depth by one. */
const INDENT = 14;
/** How near the rail's top or bottom a carried row scrolls it, and how long it rests there first. */
const EDGE = 32;
const EDGE_DELAY = 200;

export function outlineDrag(options: OutlineDragOptions): { destroy(): void } {
  const { tree, designer, rectOf } = options;
  const doc = tree.ownerDocument;

  interface Drag {
    ids: string[];
    level: number;
    start: { x: number; y: number };
    started: boolean;
    spot: DropSpot | null;
    refused: string | null;
    words: string;
    chip: HTMLElement | null;
    line: HTMLElement | null;
  }
  let drag: Drag | null = null;
  let pointer = { x: 0, y: 0 };
  let edgeTimer: ReturnType<typeof setTimeout> | undefined;

  const w = designer.words.outline;
  const nameOf = (ids: string[]) => (ids.length === 1 ? (options.rows().find((r) => r.id === ids[0])?.label ?? w.part) : w.parts(ids.length));

  function onDown(event: PointerEvent) {
    if (event.button !== 0 || drag) return;
    const target = event.target as Element;
    const view = target.closest?.<HTMLElement>('[role="treeitem"]');
    if (!view || target.closest('[data-twist]')) return;
    const id = view.dataset['pick'] as string;
    const rows = options.rows();
    const row = rows.find((r) => r.id === id);
    if (!row?.movable) return;
    const picked = designer.getState().picked;
    const movable = new Set(rows.filter((r) => r.movable).map((r) => r.id));
    const ids = picked.includes(id) ? picked.filter((p) => movable.has(p)) : [id];
    drag = { ids, level: row.level, start: { x: event.clientX, y: event.clientY }, started: false, spot: null, refused: null, words: '', chip: null, line: null };
  }

  function lift(current: Drag) {
    current.started = true;
    tree.classList.add('fd-outline-dragging');
    doc.getSelection()?.removeAllRanges();
    for (const id of current.ids) options.viewOf(id)?.classList.add('fd-outline-carried');
    const chip = doc.createElement('div');
    chip.className = 'fd-outline-chip';
    chip.setAttribute('aria-hidden', 'true');
    const name = doc.createElement('span');
    name.className = 'fd-outline-chip-name';
    name.textContent = nameOf(current.ids);
    const where = doc.createElement('span');
    where.className = 'fd-outline-chip-where';
    chip.append(name, where);
    const line = doc.createElement('div');
    line.className = 'fd-outline-line';
    line.setAttribute('aria-hidden', 'true');
    line.hidden = true;
    tree.append(line);
    (tree.closest('.fd-designer') ?? doc.body).append(chip);
    Object.assign(current, { chip, line });
  }

  /** Where the pointer would put what is carried, drawn as the line or the washed row, and said on the chip. */
  function follow(current: Drag, x: number, y: number) {
    const chip = current.chip as HTMLElement;
    const line = current.line as HTMLElement;
    // Right to left, the chip goes to the pointer's left, so it stays in the window.
    chip.style.left = options.rtl() ? `${Math.max(4, x - 14 - rectOf(chip).width)}px` : `${x + 14}px`;
    chip.style.top = `${y + 12}px`;
    for (const washed of tree.querySelectorAll('.fd-outline-into')) washed.classList.remove('fd-outline-into');
    const rows = options.rows();
    const box = rectOf(tree);
    const inside = x >= box.left - INDENT && x <= box.right + INDENT;
    let over = -1;
    let fraction = 0;
    if (inside && rows.length) {
      const rects = rows.map((r) => rectOf(options.viewOf(r.id) as HTMLElement));
      over = rects.findIndex((r) => y >= r.top && y < r.bottom);
      if (over === -1) {
        over = y < rects[0].top ? 0 : rows.length - 1;
        fraction = y < rects[0].top ? 0 : 1;
      } else fraction = (y - rects[over].top) / Math.max(1, rects[over].height);
    }
    const across = (options.rtl() ? current.start.x - x : x - current.start.x) / INDENT;
    const takes = (parent: string) => designer.moveRefusal(current.ids, parent) === null;
    const spot = over === -1 ? null : dropSpot(rows, designer.getPage().layout.id, over, fraction, current.level + Math.round(across), options.folded(), takes);
    current.spot = spot;
    current.refused = spot ? designer.moveRefusal(current.ids, spot.parent) : null;
    current.words = !spot ? w.notHere : (current.refused ?? designer.describeMove(current.ids, spot.parent, spot.index));
    (chip.querySelector('.fd-outline-chip-where') as HTMLElement).textContent = current.words;
    chip.classList.toggle('fd-outline-refused', !spot || !!current.refused);
    line.hidden = !spot || !!spot.into;
    line.classList.toggle('fd-outline-line-refused', !!current.refused);
    // gap lane: the canvas draws where it lands too.
    echo(tree, { source: 'outline', spot: current.refused ? null : spot, name: nameOf(current.ids), words: current.words });
    if (!spot) return;
    if (spot.into) {
      options.viewOf(spot.into)?.classList.add('fd-outline-into');
      return;
    }
    const below = rows[spot.gap];
    const edge = below ? rectOf(options.viewOf(below.id) as HTMLElement).top : rectOf(options.viewOf(rows[rows.length - 1].id) as HTMLElement).bottom;
    line.style.top = `${Math.round(edge - box.top)}px`;
    line.style.setProperty('--fd-drop-level', String(spot.level));
  }

  /** The box round the outline that scrolls: the rail on a wide screen; else the window. */
  function scroller(): HTMLElement | null {
    for (let box = tree.parentElement; box; box = box.parentElement) {
      if (/(auto|scroll)/.test(doc.defaultView?.getComputedStyle(box).overflowY ?? '') && box.scrollHeight > box.clientHeight) return box;
    }
    return null;
  }

  /** How fast to scroll at the pointer: back near the top, on near the bottom, faster the nearer; 0 elsewhere. */
  function speedAt(y: number): number {
    const box = scroller();
    const view = doc.defaultView;
    const top = Math.max(box ? rectOf(box).top : 0, 0);
    const bottom = Math.min(box ? rectOf(box).bottom : Infinity, view?.innerHeight ?? Infinity);
    if (y < top + EDGE) return -Math.ceil((top + EDGE - y) / 4);
    if (y > bottom - EDGE) return Math.ceil((y - (bottom - EDGE)) / 4);
    return 0;
  }

  function edgeScroll() {
    edgeTimer = undefined;
    if (!drag?.started) return;
    const speed = speedAt(pointer.y);
    if (!speed) return;
    const box = scroller();
    if (box) box.scrollTop += speed;
    else doc.defaultView?.scrollBy(0, speed);
    follow(drag, pointer.x, pointer.y);
    edgeTimer = setTimeout(edgeScroll, 16);
  }

  function onMove(event: PointerEvent) {
    if (!drag) return;
    const { clientX: x, clientY: y } = event;
    if (!drag.started) {
      if (Math.hypot(x - drag.start.x, y - drag.start.y) < SLOP) return;
      lift(drag);
    }
    event.preventDefault();
    pointer = { x, y };
    follow(drag, x, y);
    if (!speedAt(y)) {
      clearTimeout(edgeTimer);
      edgeTimer = undefined;
    } else if (!edgeTimer) edgeTimer = setTimeout(edgeScroll, EDGE_DELAY);
  }

  /** The click a real drag ends with is not a click on the row under it. */
  function swallowNextClick() {
    const swallow = (event: Event) => {
      event.stopPropagation();
      event.preventDefault();
      stop();
    };
    const stop = () => {
      doc.removeEventListener('click', swallow, true);
      doc.removeEventListener('pointerdown', stop, true);
    };
    doc.addEventListener('click', swallow, true);
    doc.addEventListener('pointerdown', stop, true);
    setTimeout(stop, 0);
  }

  function end(commit: boolean) {
    const current = drag;
    drag = null;
    clearTimeout(edgeTimer);
    edgeTimer = undefined;
    if (!current?.started) return;
    current.chip?.remove();
    current.line?.remove();
    echo(tree, { source: 'outline', spot: null });
    tree.classList.remove('fd-outline-dragging');
    for (const marked of tree.querySelectorAll('.fd-outline-into, .fd-outline-carried')) marked.classList.remove('fd-outline-into', 'fd-outline-carried');
    swallowNextClick();
    if (!commit || !current.spot) return;
    if (current.refused) return options.say(current.refused);
    const moved = designer.moveParts(current.ids, current.spot.parent, current.spot.index);
    options.say(moved ? designer.words.canvas.named(nameOf(current.ids), current.words) : (designer.getState().issues[0] ?? w.notMoved));
  }

  const onUp = () => end(true);
  const onCancel = () => end(false);
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || !drag?.started) return;
    event.preventDefault();
    event.stopPropagation();
    end(false);
  };
  tree.addEventListener('pointerdown', onDown);
  doc.addEventListener('pointermove', onMove);
  doc.addEventListener('pointerup', onUp);
  doc.addEventListener('pointercancel', onCancel);
  doc.addEventListener('keydown', onKey, true);
  return {
    destroy() {
      end(false);
      tree.removeEventListener('pointerdown', onDown);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('pointerup', onUp);
      doc.removeEventListener('pointercancel', onCancel);
      doc.removeEventListener('keydown', onKey, true);
    },
  };
}
