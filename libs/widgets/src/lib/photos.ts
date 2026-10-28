import { fill, formatBytes, MESSAGES, PICTURE_URL, safeUrl, uploadGoing, type FileUpload, type FileValue } from '@fieldia/core';
import { readFile, source } from './file-shown';
import type { FilesPart } from './widget-parts';
import { filesPartIn } from './widget-parts';
import { drawIcon, type IconSet } from './icons';
import { announcer, askFirst, describeState, maker, rightToLeft, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { inPlural } from './labels';
import { editPhoto, type Edited } from './photo-editor';
import { stillShown } from './shown';
import { installPhotosStyles } from './styles-photos';
import type { WidgetFactory } from './widgets';

/**
 * A photo set (`"widget": "photos"` on a picture field of several photos): the photos as tiles, in the order the
 * person puts them, the first the cover — marked Cover, and what a list's card and a map's pin show — each with Make
 * cover, Crop and turn and Remove over its corner, and its caption under it where the page asks (`options.captions`).
 *
 * A photo moves by dragging it — a finger resting on it a moment first, so a swipe still scrolls — the others making
 * room as it passes them, Escape putting it back; or with Alt and an arrow key (Home and End to either end), the arrows
 * mirrored right to left; each move said aloud ("Kitchen moved to place 1 of 6"). Crop and turn opens the photo in a
 * dialog (photo-editor.ts): the picture made there takes the photo's place, the photo as it was kept beside it
 * (`original`, with what was done, `edit`) unless the page says `keepOriginal: false`; where the data source stores
 * files it goes to the store at once, its bar over the tile, Save waiting for it, Retry once it failed.
 *
 * Photos are added as a picture field adds them (the files part's `takeFiles`): picked, dropped or taken with a
 * phone's camera, made smaller first, refused past the field's `maxFiles` and `maxSize` with why, each on its way
 * shown as a tile with its bar, × and Retry. One opens in the files part's dialog, its caption its title. Read only,
 * the tiles show the photos and their captions alone.
 *
 * It comes in the photos part (photos-part.ts), with the files part, whose taking, files on their way, dialog and
 * sheet it draws with.
 */

/** The tools over a tile: the cover's star and the crop's corners. */
const PHOTO_ICONS: IconSet = {
  star: '<path d="M12 3l2.8 6 6.2.6-4.7 4.2 1.4 6.2L12 16.8 6.3 20l1.4-6.2L3 9.6 9.2 9z"/>',
  crop: '<path d="M7 2v15h15"/><path d="M2 7h15v15"/>',
};

/** How far a pointer goes before a press is a drag, how long a finger rests before it lifts a photo, how far it may wander meanwhile. */
const SLOP = 5;
const LONG_PRESS = 500;
const WANDER = 10;
/** How near the edge of what scrolls the pointer is when a drag scrolls it, and how far a frame. */
const EDGE = 48;
const SCROLL_STEP = 14;

interface Tile {
  key: string;
  photo: FileValue;
  element: HTMLLIElement;
  open: HTMLButtonElement;
  shown: string;
  cover: HTMLElement;
  makeCover: HTMLButtonElement;
  edit: HTMLButtonElement;
  remove: HTMLButtonElement;
  caption: HTMLInputElement | null;
  words: HTMLElement | null;
  going: HTMLElement;
  bar: HTMLProgressElement;
  state: HTMLElement;
  retry: HTMLButtonElement;
  upload: string | null;
}

/** A photo as it was before it was cropped: its own file, without the words a set keeps beside it. */
const bare = ({ caption: _caption, original: _original, edit: _edit, ...file }: FileValue): FileValue => file;
const same = (a: FileValue, b: FileValue) => a === b || (a.name === b.name && a.url === b.url && a.data === b.data);
/** A shape as written, "4:3": its width over its height; null for none, or one that does not read. */
const shapeOf = (aspect: unknown): number | null => {
  const [, width, height] = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(typeof aspect === 'string' ? aspect : '') ?? [];
  const ratio = Number(width) / Number(height);
  return ratio >= 0.2 && ratio <= 5 ? ratio : null;
};

export const photosWidget: WidgetFactory = ({ form, name, field: def, node, id, document: doc, labels, locale = 'en' }) => {
  // It comes with the files part (photosPart): its taking, its files on their way, its dialog and its sheet are those.
  const files = filesPartIn() as FilesPart;
  files.installFilesStyles(doc);
  installPhotosStyles(doc);
  const field = def as Parameters<FilesPart['takeFiles']>[0]['field'];
  const words = wordsFor(labels, locale);
  const messages = MESSAGES[locale] ?? MESSAGES.en;
  const make = maker(doc);
  const options = node.options ?? {};
  const covered = options['cover'] !== false;
  const captioned = options['captions'] === true;
  const editable = options['edit'] !== false;
  const keepOriginal = options['keepOriginal'] !== false;
  const shape = shapeOf(options['aspect']);
  const most = field.maxFiles ?? Infinity;
  const camera = options['camera'];
  /**
   * How a photo is named in its buttons and in what is said: its caption, else its place — "photo 2 of 5", "the photo"
   * of a set of one, with a capital where it starts what is said — never its file's name.
   */
  const named = (photo: FileValue, at: number, total: number, start = false) =>
    photo.caption || (total < 2 ? (start ? words.photoAloneStart : words.photoAlone) : fill(start ? words.photoAtStart : words.photoAt, { n: at + 1, total }));
  /** Words naming a photo, `key` its place in them: started with it, it takes a capital. */
  const saying = (template: string, photo: FileValue, at: number, total: number, more: Record<string, string | number> = {}, key = 'name') =>
    fill(template, { ...more, [key]: named(photo, at, total, template.startsWith(`{${key}}`)) });

  const input = make('input', { type: 'file', id, class: 'fd-sr-only', accept: 'image/*', capture: camera ? (camera === 'user' ? 'user' : 'environment') : undefined });
  input.multiple = true;
  const pick = make('label', { class: 'fd-file-pick fd-image-pick', for: id }, make('span', { class: 'fd-button' }, words.addPhotos), make('span', { class: 'fd-help' }, words.dropThem));
  const add = make('li', { class: 'fd-photos-add' }, input, pick);
  const list = make('ul', { class: 'fd-photos-list', role: 'list' }, add);
  const count = make('span', { class: 'fd-help fd-photos-count' });
  // How a photo is moved: with a mouse and keys, or — where the screen is touched (the sheet says which) — a finger.
  const how = make(
    'span',
    { id: `${id}-how`, class: 'fd-help fd-photos-how' },
    make('span', { class: 'fd-photos-how-keys' }, covered ? words.photosMoveCover : words.photosMove),
    make('span', { class: 'fd-photos-how-touch' }, covered ? words.photosMoveTouchCover : words.photosMoveTouch)
  );
  const bar = make('div', { class: 'fd-photos-bar' }, count, how);
  // The limits, said before anyone tries.
  const limits = [field.maxSize ? fill(words.upToEach, { size: formatBytes(field.maxSize) }) : '', field.maxFiles ? fill(words.upToPhotos, { max: field.maxFiles }) : ''].filter(Boolean);
  const limited = make('span', { class: 'fd-help fd-file-limits' }, limits.join(' · '));
  setHidden(limited, !limits.length);
  // Removing asks first, in place; why photos were not added, and one removed, said politely; what came of the uploads.
  const confirm = askFirst(make, { yes: words.removeFile, no: words.keep });
  const note = make('div', { class: 'fd-help fd-file-note', role: 'status' });
  const news = make('div', { class: 'fd-help fd-file-news', role: 'status' });
  const voice = announcer(make);
  const element = make('div', { class: 'fd-file fd-file-image fd-photos' }, bar, list, limited, confirm.element, note, news, voice.element);
  if (shape) element.style.setProperty('--fd-photo-shape', `${shape}`);

  let readonly = false;
  let photos: FileValue[] = [];
  let tiles: Tile[] = [];
  let seenValue: unknown;
  let drawnReadonly: boolean | null = null;
  let seenUploads: readonly FileUpload[] | undefined;
  const say = (lines: string[]) => note.replaceChildren(...lines.map((line) => make('div', {}, line)));
  const tell = (text: string, failed = false) => {
    setAttr(news, 'data-failed', failed ? '' : null);
    setText(news, text);
  };

  // ---- a tile for each photo ------------------------------------------------------------------------------------
  function tileFor(key: string, photo: FileValue): Tile {
    const tool = (as: string, label: string, ...inside: (Node | string)[]) => make('button', { type: 'button', class: 'fd-photo-tool', 'data-tool': as, 'aria-label': label, title: label }, ...inside);
    const icon = (which: string) => drawIcon(doc, which, PHOTO_ICONS) as SVGSVGElement;
    const open = make('button', { type: 'button', class: 'fd-photo-open', 'aria-haspopup': 'dialog', 'aria-describedby': how.id });
    const cover = make('span', { class: 'fd-photo-cover', hidden: '' }, icon('star'), words.photoCover);
    const makeCover = tool('cover', '', icon('star'));
    const edit = tool('edit', '', icon('crop'));
    const remove = tool('remove', '', '×');
    const toolbar = make('div', { class: 'fd-photo-tools' }, ...(covered ? [makeCover] : []), ...(editable ? [edit] : []), remove);
    const going = make('div', { class: 'fd-photo-going', hidden: '' });
    const progress = make('progress', { class: 'fd-file-progress', max: '100' });
    const state = make('span', { class: 'fd-file-state' });
    const retry = make('button', { type: 'button', class: 'fd-button fd-button-link fd-file-retry', 'data-tool': 'retry' }, words.retryUpload);
    going.append(progress, state, retry);
    const frame = make('div', { class: 'fd-photo-frame' }, open, cover, toolbar, going);
    const caption = captioned ? make('input', { type: 'text', class: 'fd-input fd-photo-caption', placeholder: words.captionPlaceholder, autocomplete: 'off', dir: 'auto' }) : null;
    const said = captioned ? make('p', { class: 'fd-photo-words', dir: 'auto' }) : null;
    const element = make('li', { class: 'fd-photo', 'data-key': key }, frame, ...(caption && said ? [caption, said] : []));
    const tile: Tile = { key, photo, element, open, shown: '', cover, makeCover, edit, remove, caption, words: said, going, bar: progress, state, retry, upload: null };
    caption?.addEventListener('change', () => setCaption(tile, caption.value));
    open.addEventListener('contextmenu', (event) => event.preventDefault());
    return tile;
  }

  /** A tile brought up to date with its photo, its place and whether the set reads only. */
  function paint(tile: Tile, photo: FileValue, at: number) {
    tile.photo = photo;
    const picture = source(photo);
    if (tile.shown !== picture) {
      tile.shown = picture;
      const image = make('img', { alt: '', src: safeUrl(picture, PICTURE_URL), draggable: 'false', decoding: 'async' });
      // A photo the browser cannot draw, or at no address a picture may have: its kind's page in its place, never the broken-picture mark.
      const instead = () => make('span', { class: 'fd-file-icon', 'data-kind': 'image', 'data-ext': (/\.(\w{1,5})$/.exec(photo.name)?.[1] ?? '?').toUpperCase(), 'aria-hidden': 'true' });
      image.addEventListener('error', () => image.replaceWith(instead()), { once: true });
      tile.open.replaceChildren(image.hasAttribute('src') ? image : instead());
    }
    const first = covered && at === 0;
    const total = photos.length;
    const label = named(photo, at, total);
    // Its caption, the cover and its place; with no caption, its place alone.
    const said = photo.caption ? fill(first ? words.photoNamedCover : words.photoNamed, { name: label, n: at + 1, total }) : first && total > 1 ? fill(words.photoCoverAt, { n: 1, total }) : named(photo, at, total, true);
    setAttr(tile.open, 'aria-label', said);
    setAttr(tile.open, 'aria-describedby', readonly ? null : how.id);
    setHidden(tile.cover, !first);
    setAttr(tile.makeCover, 'aria-label', fill(words.makeCover, { name: label }));
    setAttr(tile.makeCover, 'title', fill(words.makeCover, { name: label }));
    setAttr(tile.edit, 'aria-label', fill(words.editPhoto, { name: label }));
    setAttr(tile.edit, 'title', fill(words.editPhoto, { name: label }));
    setAttr(tile.remove, 'aria-label', fill(words.remove, { name: label }));
    setAttr(tile.remove, 'title', fill(words.remove, { name: label }));
    // The cover needs no Make cover: hidden, never offered.
    setHidden(tile.makeCover, readonly || first);
    setHidden(tile.edit, readonly);
    setHidden(tile.remove, readonly);
    if (tile.caption && tile.words) {
      setHidden(tile.caption, readonly);
      setHidden(tile.words, !readonly);
      setText(tile.words, readonly ? (photo.caption ?? '') : '');
      // Named by its place: what it names is being typed in it.
      setAttr(tile.caption, 'aria-label', fill(words.photoCaption, { name: total < 2 ? words.photoAlone : fill(words.photoAt, { n: at + 1, total }) }));
      // What is typed is the person's until it is read: a box being typed in is never written over.
      if (doc.activeElement !== tile.caption && tile.caption.value !== (photo.caption ?? '')) tile.caption.value = photo.caption ?? '';
    }
  }

  /** The tiles in the order of the photos: each kept for its photo — by its name, the same name twice by its turn — the focus kept with it. */
  function draw() {
    const seen = new Map<string, number>();
    const keys = photos.map((photo) => {
      const n = seen.get(photo.name) ?? 0;
      seen.set(photo.name, n + 1);
      return `${photo.name}\u0000${n}`;
    });
    const was = new Map(tiles.map((tile) => [tile.key, tile]));
    tiles = keys.map((key, at) => was.get(key) ?? tileFor(key, photos[at]));
    for (const [key, tile] of was) if (!keys.includes(key)) tile.element.remove();
    // The tile with the focus stays where it is in the page, the rest put round it: a box moved loses its focus, and
    // what is typed in it would be read as left.
    const held = tiles.find((tile) => tile.element.isConnected && tile.element.contains(doc.activeElement));
    if (held) {
      const at = tiles.indexOf(held);
      for (const tile of tiles.slice(0, at)) list.insertBefore(tile.element, held.element);
      let after = held.element;
      for (const tile of tiles.slice(at + 1)) {
        if (after.nextElementSibling !== tile.element) after.after(tile.element);
        after = tile.element;
      }
    } else tiles.forEach((tile, at) => list.children[at] !== tile.element && list.insertBefore(tile.element, list.children[at] ?? null));
    tiles.forEach((tile, at) => {
      tile.element.style.order = '';
      paint(tile, photos[at], at);
    });
  }

  // ---- moving a photo -------------------------------------------------------------------------------------------
  /** The photos in a new order, kept, and where the one moved went said aloud — the cover's too. */
  function putInOrder(next: FileValue[], moved: FileValue) {
    if (readonly || next.every((photo, at) => photo === photos[at])) return;
    const at = next.indexOf(moved);
    // Named by the place it was in: where the person found it.
    const was = photos.indexOf(moved);
    form.setValue(name, next);
    voice.say(covered && at === 0 ? saying(words.coverNow, moved, was, next.length) : saying(words.movedTo, moved, was, next.length, { n: at + 1, total: next.length }, 'label'));
  }
  function moveTo(tile: Tile, to: number) {
    const from = tiles.indexOf(tile);
    if (from < 0 || to < 0 || to >= photos.length || to === from) return;
    const next = [...photos];
    next.splice(to, 0, ...next.splice(from, 1));
    putInOrder(next, tile.photo);
  }

  /** A photo lifted to be moved: the others make room for it as the pointer passes them; dropped, the order is kept. */
  interface Lifted {
    to(x: number, y: number): void;
    drop(): void;
    cancel(): void;
  }
  let lifted: Lifted | null = null;
  /** A click a drag ends with opens nothing. */
  let dragged = false;
  function scrollerOf(from: Element): Element | null {
    for (let at: Element | null = from.parentElement; at; at = at.parentElement) {
      const overflow = doc.defaultView?.getComputedStyle(at).overflowY ?? '';
      if (/(auto|scroll)/.test(overflow) && at.scrollHeight > at.clientHeight) return at;
    }
    return null;
  }
  function lift(tile: Tile): Lifted | null {
    if (readonly || photos.length < 2 || !tiles.includes(tile)) return null;
    const before = [...tiles];
    let order = [...tiles];
    let point = { x: 0, y: 0 };
    let frame = 0;
    const view = doc.defaultView;
    const scroller = scrollerOf(element);
    tile.element.setAttribute('data-lifted', '');
    element.setAttribute('data-moving', '');
    dragged = true;
    // Laid out in the order it would be kept, the cover's mark on the first of them.
    const place = () =>
      order.forEach((one, at) => {
        one.element.style.order = String(at - order.length);
        setHidden(one.cover, !(covered && at === 0));
      });
    function to(x: number, y: number) {
      point = { x, y };
      const own = tile.element.getBoundingClientRect();
      if (x >= own.left && x <= own.right && y >= own.top && y <= own.bottom) return;
      // The tile nearest the pointer, and its half: before it, or after it — the line's start the right, right to left.
      let near: Tile | null = null;
      let best = Infinity;
      for (const other of order) {
        if (other === tile) continue;
        const box = other.element.getBoundingClientRect();
        const far = Math.hypot(Math.max(box.left - x, 0, x - box.right), Math.max(box.top - y, 0, y - box.bottom));
        if (far < best) [near, best] = [other, far];
      }
      if (!near) return;
      const box = near.element.getBoundingClientRect();
      const after = y > box.bottom || (y >= box.top && (rightToLeft(element) ? x < box.left + box.width / 2 : x > box.left + box.width / 2));
      const others = order.filter((other) => other !== tile);
      const at = others.indexOf(near) + (after ? 1 : 0);
      const next = [...others.slice(0, at), tile, ...others.slice(at)];
      if (next.every((one, i) => one === order[i])) return;
      order = next;
      place();
    }
    // Near an edge of what scrolls, it scrolls, the pointer still over the tiles it passes.
    const roll = () => {
      frame = view?.requestAnimationFrame(roll) ?? 0;
      const area = scroller?.getBoundingClientRect() ?? { top: 0, bottom: view?.innerHeight ?? 0 };
      const by = point.y < area.top + EDGE ? -SCROLL_STEP : point.y > area.bottom - EDGE ? SCROLL_STEP : 0;
      if (!by) return;
      if (scroller) scroller.scrollTop += by;
      else view?.scrollBy(0, by);
      to(point.x, point.y);
    };
    frame = view?.requestAnimationFrame(roll) ?? 0;
    const end = () => {
      view?.cancelAnimationFrame(frame);
      tile.element.removeAttribute('data-lifted');
      element.removeAttribute('data-moving');
      before.forEach((one, at) => {
        one.element.style.order = '';
        setHidden(one.cover, !(covered && at === 0));
      });
      doc.removeEventListener('keydown', escape, true);
      lifted = null;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      end();
    };
    doc.addEventListener('keydown', escape, true);
    return {
      to,
      drop() {
        const moved = order.map((one) => one.photo);
        end();
        putInOrder(moved, tile.photo);
      },
      cancel: end,
    };
  }

  /** A mouse or a pen: a press carried past a few pixels lifts the photo, which follows it; let go, it stays. */
  function pressed(tile: Tile, event: PointerEvent) {
    const from = { x: event.clientX, y: event.clientY };
    const id = event.pointerId;
    const follow = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      if (e.type !== 'pointermove') {
        stop();
        if (e.type === 'pointerup') lifted?.drop();
        else lifted?.cancel();
        return;
      }
      if (!lifted) {
        if (Math.hypot(e.clientX - from.x, e.clientY - from.y) < SLOP) return;
        lifted = lift(tile);
        if (!lifted) return stop();
      }
      e.preventDefault();
      lifted.to(e.clientX, e.clientY);
    };
    const kinds = ['pointermove', 'pointerup', 'pointercancel'] as const;
    const stop = () => kinds.forEach((kind) => doc.removeEventListener(kind, follow, true));
    kinds.forEach((kind) => doc.addEventListener(kind, follow, true));
  }

  /** A finger: resting a moment on a photo lifts it, which then follows it; a tap opens it, a swipe scrolls. */
  function rested(tile: Tile, touch: Touch) {
    const { identifier, clientX: fromX, clientY: fromY } = touch;
    let point = { x: fromX, y: fromY };
    const view = doc.defaultView;
    const timer = view?.setTimeout(() => {
      lifted = lift(tile);
      if (!lifted) return stop();
      try {
        view.navigator.vibrate?.(8);
      } catch {
        // A phone that will not buzz is still told by the tile it lifted.
      }
      lifted.to(point.x, point.y);
    }, LONG_PRESS);
    const follow = (event: TouchEvent) => {
      const one = [...event.changedTouches].find((each) => each.identifier === identifier);
      if (!one) return;
      point = { x: one.clientX, y: one.clientY };
      if (event.type === 'touchmove') {
        // A finger that wanders before it has rested is a swipe, the browser's; once it has, it moves the photo, not the page.
        if (!lifted) {
          if (Math.hypot(one.clientX - fromX, one.clientY - fromY) > WANDER) stop();
          return;
        }
        if (event.cancelable) event.preventDefault();
        lifted.to(point.x, point.y);
        return;
      }
      const was = lifted;
      stop();
      // A touch that was the drag's ends in no click.
      if (was && event.cancelable) event.preventDefault();
      if (event.type === 'touchend') was?.drop();
      else was?.cancel();
    };
    const kinds = ['touchmove', 'touchend', 'touchcancel'] as const;
    function stop() {
      view?.clearTimeout(timer);
      kinds.forEach((kind) => tile.open.removeEventListener(kind, follow));
    }
    kinds.forEach((kind) => tile.open.addEventListener(kind, follow, { passive: false }));
  }

  const tileOf = (target: EventTarget | null) => tiles.find((tile) => tile.element.contains(target as Node)) ?? null;
  list.addEventListener('pointerdown', (event) => {
    const tile = tileOf(event.target);
    dragged = false;
    // A finger is the touch events' (a long press).
    if (!tile || readonly || event.pointerType === 'touch' || event.button !== 0 || !event.isPrimary || !(event.target as Element).closest('.fd-photo-open')) return;
    pressed(tile, event);
  });
  list.addEventListener(
    'touchstart',
    (event) => {
      const tile = tileOf(event.target);
      dragged = false;
      if (!tile || readonly || event.touches.length !== 1 || !(event.target as Element).closest('.fd-photo-open')) return;
      rested(tile, event.touches[0]);
    },
    { passive: true }
  );
  // Keys: Alt and an arrow a place at a time — mirrored right to left — Alt and Home or End to either end.
  list.addEventListener('keydown', (event) => {
    const tile = tileOf(event.target);
    if (!tile || readonly || !event.altKey || event.ctrlKey || event.metaKey || !(event.target as Element).closest('.fd-photo-open')) return;
    const at = tiles.indexOf(tile);
    const back = rightToLeft(element) ? 1 : -1;
    const by: Record<string, number> = { ArrowLeft: at + back, ArrowRight: at - back, ArrowUp: at - 1, ArrowDown: at + 1, Home: 0, End: photos.length - 1 };
    if (!(event.key in by)) return;
    event.preventDefault();
    moveTo(tile, Math.min(photos.length - 1, Math.max(0, by[event.key])));
  });

  // ---- each tile's tools ------------------------------------------------------------------------------------------
  list.addEventListener('click', (event) => {
    const target = event.target as Element;
    const tile = tileOf(target);
    if (!tile) return;
    if (target.closest('.fd-photo-open')) {
      if (dragged) return void (dragged = false);
      return files.viewFiles({ doc, words, id: `${id}-view`, files: photos, at: tiles.indexOf(tile), home: element, back: (last) => tiles[last]?.open });
    }
    const tool = target.closest<HTMLElement>('[data-tool]')?.dataset['tool'];
    if (readonly || !tool) return;
    if (tool === 'cover') {
      // Where the eye is, as it goes to the front (kept-in-sight.ts).
      const top = tile.element.getBoundingClientRect().top;
      moveTo(tile, 0);
      keepInSight(tile.element, top);
      tile.open.focus({ preventScroll: true });
    } else if (tool === 'edit') void edit(tile);
    else if (tool === 'retry' && tile.upload) form.retryUpload(tile.upload);
    else if (tool === 'remove') askRemove(tile);
  });

  function askRemove(tile: Tile) {
    const photo = tile.photo;
    const [place, total] = [tiles.indexOf(tile), photos.length];
    confirm.ask(saying(words.removeAsk, photo, place, total), (remove) => {
      const at = tiles.indexOf(tile);
      if (remove && at >= 0) {
        stopGoing(photo);
        form.setValue(name, photos.filter((_, i) => i !== at));
        say([saying(words.removed, photo, place, total)]);
      }
      // Back on the next photo's, or the one before, or where photos are added.
      const next = remove ? tiles[Math.min(at, tiles.length - 1)]?.remove : tile.remove;
      (next?.isConnected ? next : input).focus();
    });
  }

  function setCaption(tile: Tile, typed: string) {
    const at = tiles.indexOf(tile);
    const text = typed.trim();
    if (readonly || at < 0 || text === (tile.photo.caption ?? '')) return;
    const { caption: _was, ...photo } = tile.photo;
    form.setValue(name, photos.map((one, i) => (i === at ? (text ? { ...photo, caption: text } : photo) : one)));
  }

  /** A cropped photo still on its way to the store, stopped: a photo cropped again, put back or taken away. */
  function stopGoing(photo: FileValue) {
    if (photo.data === undefined) return;
    for (const upload of form.uploading(name)) if (upload.name === photo.name) form.cancelUpload(upload.id);
  }

  async function edit(tile: Tile) {
    const photo = tile.photo;
    const shown = stillShown(form);
    const result: Edited = await editPhoto({ doc, words, id: `${id}-edit`, photo, name: named(photo, tiles.indexOf(tile), photos.length), shape, home: element, read: files.readPicture });
    (tile.edit.isConnected ? tile.edit : tile.open.isConnected ? tile.open : input).focus();
    if (!result || readonly || !shown()) return;
    // Where the photo is now: it may have moved while the dialog was open.
    const at = photos.findIndex((one) => same(one, photo));
    if (at < 0) return;
    const was = photos[at];
    const keep = was.caption !== undefined ? { caption: was.caption } : {};
    if ('original' in result) {
      if (!was.original) return;
      stopGoing(was);
      form.setValue(name, photos.map((one, i) => (i === at ? { ...bare(was.original as FileValue), ...keep } : one)));
      return voice.say(saying(words.originalBack, was, at, photos.length));
    }
    const read = await readFile(result.file);
    const now = photos.findIndex((one) => same(one, was));
    if (now < 0 || !shown()) return;
    // The photo as it was before any crop, kept beside the new picture: what a crop again starts from.
    const made: FileValue = { ...read, ...(keepOriginal ? { original: bare(was.original ?? was), edit: result.edit } : {}), ...keep };
    stopGoing(was);
    form.setValue(name, photos.map((one, i) => (i === now ? made : one)));
    if (form.canUpload()) for (const upload of form.upload(name, [result.file], { replaces: made })) cropping.add(upload);
    voice.say(saying(keepOriginal ? words.photoChangedKept : words.photoChanged, made, now, photos.length));
  }

  // ---- photos added, and on their way ---------------------------------------------------------------------------
  const take = async (chosen: File[]) => {
    if (readonly || !chosen.length) return;
    const started = await files.takeFiles({ form, name, field, doc, words, messages, held: () => photos, say }, chosen);
    if (!started.length) return;
    tell('');
    for (const { id: upload, file } of started) previews.set(upload, files.preview(file));
    for (const { id: upload } of started) goingItems.get(upload)?.item.element.remove();
    for (const { id: upload } of started) goingItems.delete(upload);
    drawGoing();
  };
  input.addEventListener('change', () => {
    void take([...(input.files ?? [])]);
    input.value = '';
  });
  element.addEventListener('dragover', (event) => {
    if (readonly || !(event as DragEvent).dataTransfer?.types.includes('Files')) return;
    event.preventDefault();
    element.classList.add('fd-dragging');
  });
  element.addEventListener('dragleave', () => element.classList.remove('fd-dragging'));
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    element.classList.remove('fd-dragging');
    void take([...((event as DragEvent).dataTransfer?.files ?? [])].filter((file) => /^image\//.test(file.type)));
  });

  /**
   * The uploads of photos cropped here, and any of a photo the set holds as its bytes (one cropped before this was
   * drawn): each shows its bar on its own tile, never as a photo picked.
   */
  const cropping = new Set<string>();
  const cropped = (upload: FileUpload) => cropping.has(upload.id) || photos.some((photo) => photo.data !== undefined && photo.name === upload.name);
  const goingItems = new Map<string, { item: ReturnType<FilesPart['goingItem']>; name: string }>();
  const previews = new Map<string, string>();
  let uploadedSince = 0;
  const saidFailed = new Set<string>();
  /** A photo held as its bytes and on its way — one cropped — shows its bar on its own tile; one picked, as a tile after the photos. */
  function drawGoing() {
    const going = form.uploading(name);
    for (const upload of cropping) if (!going.some((one) => one.id === upload)) cropping.delete(upload);
    const picked = going.filter((upload) => !cropped(upload));
    for (const tile of tiles) {
      const upload = going.find((one) => one.name === tile.photo.name && cropped(one));
      tile.upload = upload?.id ?? null;
      setHidden(tile.going, !upload);
      if (!upload) continue;
      tile.going.dataset['status'] = upload.status;
      setText(tile.state, files.goingWords(words, upload));
      const moving = uploadGoing(upload);
      setHidden(tile.bar, !moving);
      if (upload.status === 'uploading' && upload.total) tile.bar.value = Math.min(100, Math.floor((upload.sent * 100) / upload.total));
      else tile.bar.removeAttribute('value');
      setAttr(tile.bar, 'aria-label', fill(words.uploadingNamed, { name: upload.name }));
      setHidden(tile.retry, readonly || upload.status !== 'failed');
      setAttr(tile.retry, 'aria-label', fill(words.retryUploadNamed, { name: upload.name }));
    }
    const ids = new Set(picked.map((upload) => upload.id));
    for (const [upload, { item, name: was }] of goingItems) {
      if (ids.has(upload)) continue;
      item.element.remove();
      goingItems.delete(upload);
      const preview = previews.get(upload);
      if (preview) URL.revokeObjectURL(preview);
      previews.delete(upload);
      // Gone because it is stored, not cancelled: the set holds it now.
      if (photos.some((photo) => photo.name === was)) uploadedSince++;
    }
    for (const upload of picked) {
      let item = goingItems.get(upload.id)?.item;
      if (!item) {
        const preview = previews.get(upload.id);
        const icon = () => make('span', { class: 'fd-file-icon', 'data-kind': 'image', 'data-ext': (/\.(\w{1,5})$/.exec(upload.name)?.[1] ?? '').toUpperCase(), 'aria-hidden': 'true' });
        const picture = preview ? make('img', { class: 'fd-file-thumb', alt: '', src: safeUrl(preview, PICTURE_URL) }) : icon();
        item = files.goingItem(make, words, make('span', { class: 'fd-file-picture' }, picture), (text) => make('span', { class: 'fd-file-name', dir: 'auto', title: text }, text), {
          cancel: () => form.cancelUpload(upload.id),
          retry: () => form.retryUpload(upload.id),
        });
      }
      goingItems.set(upload.id, { item, name: upload.name });
      item.update(upload, readonly);
      if (item.element.parentNode !== list || item.element.nextElementSibling !== add) list.insertBefore(item.element, add);
      if (upload.status === 'failed' || upload.status === 'refused') {
        if (!saidFailed.has(upload.id)) tell(fill(words.notUploadedNamed, { name: upload.name }), true);
        saidFailed.add(upload.id);
      } else saidFailed.delete(upload.id);
    }
    // Once nothing is on its way, how many got there.
    if (!going.some(uploadGoing) && uploadedSince) {
      tell(inPlural(words.photosUploaded, words.photoUploaded, uploadedSince, locale));
      uploadedSince = 0;
    }
  }

  return {
    element,
    focus: () => (tiles[0]?.open ?? input).focus(),
    update(state) {
      readonly = state.readonly;
      const value = state.value as FileValue[] | FileValue | null | undefined;
      photos = Array.isArray(value) ? value : value ? [value] : [];
      const picked = form.uploading(name).filter((upload) => !cropped(upload));
      setAttr(element, 'data-readonly', readonly ? '' : null);
      setHidden(add, readonly || photos.length + picked.length >= most);
      input.disabled = readonly;
      setHidden(limited, readonly || !limits.length);
      setHidden(how, readonly || photos.length < 2);
      setText(count, !photos.length ? '' : field.maxFiles ? fill(words.photoCountOf, { n: photos.length, max: field.maxFiles }) : inPlural(words.photoCount, words.photoCountOne, photos.length, locale));
      setHidden(bar, !photos.length);
      describeState(input, state);
      if (seenValue !== value || drawnReadonly !== readonly) {
        seenValue = value;
        drawnReadonly = readonly;
        draw();
      }
      const uploads = form.getState().uploads;
      if (uploads !== seenUploads || picked.length !== goingItems.size) {
        seenUploads = uploads;
        drawGoing();
      }
    },
    destroy() {
      lifted?.cancel();
      for (const preview of previews.values()) if (preview) URL.revokeObjectURL(preview);
      previews.clear();
    },
  };
};

/**
 * What a person moved, kept where their eye is: its top on the screen as the move was asked (`top`); once it is drawn in
 * its new place, the page scrolled by as much as it moved (inside a dialog, which scrolls on its own, it moves as it is
 * drawn). A focus given back after a move takes no scroll of the browser's own (`preventScroll`): WebKit scrolled to a
 * button it had just put back from a layout not yet worked out, and threw the page to its top (0.36's walk, a line
 * card's ↑ on an iPhone).
 */
function keepInSight(element: Element | null | undefined, top: number | undefined): void {
  if (element?.isConnected && top !== undefined) element.ownerDocument.defaultView?.scrollBy(0, element.getBoundingClientRect().top - top);
}
