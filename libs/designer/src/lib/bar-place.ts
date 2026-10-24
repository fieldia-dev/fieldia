/**
 * Where a designer's floating bar goes — the bar of the field picked, of a part of a record's head, of a list's column
 * or action: one rule for each. It belongs to its part: just above it, lined up with the part's end edge (its start
 * edge right to left) and kept inside the canvas; flipped below the part where above it there is no room — the
 * canvas's top, a group's name, another part's words or boxes. Below, where the next row would be under it, the part
 * makes room for it under itself (`room`), so it covers nothing; nothing above moves, the part pressed stays where it
 * was. Where neither side is clear and no room can be made, the side it covers least. It is the part's own child, so
 * it follows the part wherever the canvas scrolls; the canvas places it again as a window is resized or zoomed and as
 * the part grows or shrinks. A bar its sheet puts elsewhere (not absolutely placed) is left there.
 *
 * Measured in a frame of its own, after the canvas has drawn the change: read all, then write.
 */

/** Room between the bar and its part. */
const GAP = 8;

export interface BarPlacing {
  /** The bar, a child of its part, which is its containing block. */
  readonly bar: HTMLElement;
  /** What it belongs to. */
  readonly part: HTMLElement;
  /** What it must stay inside, and whose words it keeps clear of. */
  readonly area: HTMLElement;
  /** Room made under the part for the bar below it, in pixels (0 takes it away); none where a part cannot make room. */
  readonly room?: (px: number) => void;
}

type Box = { left: number; top: number; right: number; bottom: number };
const overlap = (a: Box, b: Box) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** What is a box whose words are anywhere in it, or whose room is its own to press: a label's, a group's name's. */
const BOXES = 'input:not([type="hidden"]), textarea, select, [contenteditable="true"], img, canvas, video, .fd-label, .fd-canvas-section-title';

/**
 * The words and boxes in the area a bar may not cover, within a band of it: everything but the part's own and the
 * bars'. Walked from the area down, a box nowhere near the band left unopened — a page of five hundred fields is
 * looked at only round the part.
 */
function wordsAround(area: HTMLElement, part: HTMLElement, band: { top: number; bottom: number }): Box[] {
  const range = area.ownerDocument.createRange();
  // A document no engine lays out (jsdom, an app's tests of the designer) has no boxes for words or parts: nothing to
  // keep clear — never a throw in the frame that places the bars, landing on whatever runs then.
  if (typeof range.getClientRects !== 'function') return [];
  const inBand = (box: Box) => box.bottom > band.top && box.top < band.bottom && box.right > box.left;
  const found: Box[] = [];
  const words = (holder: Element) => {
    for (const node of holder.childNodes) {
      if (node.nodeType !== 3 || !node.textContent?.trim()) continue;
      range.selectNodeContents(node);
      for (const box of range.getClientRects()) if (inBand(box)) found.push(box);
    }
  };
  const visit = (holder: Element) => {
    for (const child of holder.children) {
      if (child === part || child.classList.contains('fd-field-bar')) continue;
      const at = child.getBoundingClientRect();
      const around = child.contains(part);
      // Laid out as nothing of its own (display: contents), its children are looked at all the same.
      const boxless = !at.width && !at.height;
      if (!around && !boxless && !inBand(at)) continue;
      if (!around && child.matches(BOXES)) {
        if (inBand(at)) found.push(at);
        continue;
      }
      words(child);
      visit(child);
    }
  };
  words(area);
  visit(area);
  return found;
}

/**
 * What of the area a bar can be seen in: the area, cut by any box between it and the part that clips what it holds (a
 * list's table, which scrolls sideways in its own box). Its foot only where such a box cuts it: a canvas grows.
 */
function seenIn(area: HTMLElement, part: HTMLElement): Box {
  const room = area.getBoundingClientRect();
  const seen: Box = { left: room.left, top: room.top, right: room.right, bottom: Infinity };
  for (let at = part.parentElement; at && at !== area && area.contains(at); at = at.parentElement) {
    const style = getComputedStyle(at);
    if (style.overflowX === 'visible' && style.overflowY === 'visible') continue;
    const cut = at.getBoundingClientRect();
    seen.left = Math.max(seen.left, cut.left);
    seen.right = Math.min(seen.right, cut.right);
    seen.top = Math.max(seen.top, cut.top);
    seen.bottom = Math.min(seen.bottom, cut.bottom);
  }
  return seen;
}

/** Where a bar goes, read now (nothing written): the writing, to do after every other read. */
export function readBarPlace(placing: BarPlacing): (() => void) | null {
  const { bar, part, area } = placing;
  if (!bar.isConnected || !part.isConnected) return null;
  const style = getComputedStyle(bar);
  // Not shown, or put elsewhere by its sheet (not absolutely placed): left there.
  if (style.position !== 'absolute' || style.display === 'none') return null;
  const rtl = getComputedStyle(part).direction === 'rtl';
  const [own, at, room] = [part.getBoundingClientRect(), bar.getBoundingClientRect(), seenIn(area, part)];
  const width = at.width;
  const height = at.height;
  // Lined up with the part's end edge (its start right to left), kept inside the area.
  const left = Math.max(room.left + 4, Math.min(rtl ? own.left : own.right - width, room.right - 4 - width));
  const made = Number(part.dataset['barRoom'] ?? 0);
  const above: Box = { left, right: left + width, top: own.top - GAP - height, bottom: own.top - GAP };
  const below: Box = { left, right: left + width, top: own.bottom + GAP, bottom: own.bottom + GAP + height };
  const words = wordsAround(area, part, { top: above.top, bottom: below.bottom + made });
  const covers = (box: Box) => words.reduce((sum, word) => sum + overlap(box, word), 0);
  const aboveCovers = above.top < room.top ? Infinity : covers(above);
  let side: 'above' | 'below';
  let roomNow = 0;
  if (aboveCovers === 0) side = 'above';
  else {
    side = 'below';
    const belowCovers = below.bottom > room.bottom ? Infinity : covers(below);
    if (belowCovers > 0 && placing.room) {
      // Room under the part, as much as the bar needs over what it covers: the words under it move down, never the part.
      const lowest = words.filter((word) => overlap(below, word) > 0).reduce((top, word) => Math.min(top, word.top), Infinity);
      roomNow = Math.ceil(made + below.bottom + GAP - lowest);
    } else if (belowCovers > aboveCovers) side = 'above';
    else roomNow = made;
  }
  if (side === 'above') roomNow = 0;
  // In the frame the bar is placed against — its part's box, or the grid area a part laid out as a grid gives it — read
  // from where it stands now and the offsets that put it there; in its own pixels (a zoom on the page round it makes
  // the screen's bigger).
  const scale = own.width ? part.offsetWidth / own.width : 1;
  const frame = { left: at.left - (parseFloat(style.left) || 0) / scale, top: at.top - (parseFloat(style.top) || 0) / scale };
  const top = ((side === 'above' ? above.top : below.top) - frame.top) * scale;
  const x = (left - frame.left) * scale;
  return () => {
    if (roomNow !== made) {
      if (roomNow) part.dataset['barRoom'] = String(roomNow);
      else delete part.dataset['barRoom'];
      placing.room?.(Math.ceil(roomNow * scale));
    }
    bar.dataset['side'] = side;
    bar.style.setProperty('top', `${Math.round(top)}px`);
    bar.style.setProperty('left', `${Math.round(x)}px`);
    bar.style.setProperty('bottom', 'auto');
    bar.style.setProperty('right', 'auto');
  };
}

/** A field's room under itself for its bar, as the canvas lays fields out (`--fd-bar-room`, styles.ts). */
function fieldRoom(part: HTMLElement) {
  return (px: number) => (px ? part.style.setProperty('--fd-bar-room', `${px}px`) : part.style.removeProperty('--fd-bar-room'));
}

/** What watches the parts with a bar in each area, to place their bars again as a part changes size. */
const watching = new WeakMap<HTMLElement, { observer: ResizeObserver; parts: Set<HTMLElement> }>();

/** Every floating bar in an area placed by the rule, read now: the writing, to do after every other read. */
export function barsPlaced(area: HTMLElement): () => void {
  const parts: HTMLElement[] = [];
  const writes = [...area.querySelectorAll<HTMLElement>('.fd-field-bar')].map((bar) => {
    const part = bar.parentElement;
    if (part) parts.push(part);
    return part ? readBarPlace({ bar, part, area, room: part.matches('.fd-canvas-field') ? fieldRoom(part) : undefined }) : null;
  });
  return () => {
    writes.forEach((write) => write?.());
    watchParts(area, parts);
  };
}

/** A part with a bar that grows or shrinks — its words typed, its settings opened — has its bar placed again, in a frame of its own. */
function watchParts(area: HTMLElement, parts: HTMLElement[]) {
  const view = area.ownerDocument.defaultView;
  if (!view?.ResizeObserver || !view.requestAnimationFrame) return;
  let watch = watching.get(area);
  if (!watch) {
    let asked = false;
    const observer = new view.ResizeObserver(() => {
      if (asked) return;
      asked = true;
      view.requestAnimationFrame(() => {
        asked = false;
        if (area.isConnected) barsPlaced(area)();
      });
    });
    watching.set(area, (watch = { observer, parts: new Set() }));
  }
  for (const part of watch.parts) if (!parts.includes(part)) {
    watch.observer.unobserve(part);
    watch.parts.delete(part);
  }
  for (const part of parts) if (!watch.parts.has(part)) {
    watch.observer.observe(part);
    watch.parts.add(part);
  }
}

/** The watch on the parts with a bar in an area ended, as its canvas goes. */
export function stopWatchingBars(area: HTMLElement): void {
  watching.get(area)?.observer.disconnect();
  watching.delete(area);
}
