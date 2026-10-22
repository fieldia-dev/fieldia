import type { FileValue, JsonValue, PinsOptions } from '@fieldia/core';
import { source } from './file-shown';
import { announcer, fillIn, maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import type { WidgetLabels } from './labels';
import { installPinsStyles } from './styles-pins';
import type { WidgetFactory } from './widgets';

/**
 * Pins with notes on a picture (`"widget": "pins"` on a json field): a face chart's injection points, a floor plan's
 * snags, a car's damage. The picture is the page's own (`options.image`) or a field's (`options.imageField`: a picture
 * or file field, or a web address); the value is the pins, each where it is on the picture as a share of its width and
 * height from its top left corner — `[{ "x": 0.42, "y": 0.31, "note": "Botox, 4 units" }]` — so they stand where they
 * were put at any size the picture is drawn, and an app's own keys on a pin are kept.
 *
 * A click or a tap on the picture puts a pin there, its note's box focused; a pin is dragged to move it, Escape putting
 * it back. By the keyboard: Tab reaches the picture, the arrow keys move a cross over it (Shift: further) and Enter or
 * Space puts a pin there; on a pin, the arrow keys move it, Delete takes it away and Enter goes to its note. Each pin is
 * a button named by its number, where it is in words ("top left, 18% across, 22% down") and its note, and under the
 * picture the pins are a numbered list with each note's box and Remove — what a screen reader reads, in order. What
 * happens is said politely. Read-only, the pins and their notes are shown, nothing moves. A picture is never mirrored
 * right to left: left is the picture's left.
 *
 * It comes in the pins part (pins-part.ts), loaded the first time a page shows pins; their notes, in order, meanwhile.
 */

/** A pin as the value holds it: where it is, as shares of the picture's width and height, its note, and the app's own keys. */
export interface Pin {
  x: number;
  y: number;
  note?: string;
  [key: string]: JsonValue | undefined;
}

/** The pins a value holds: each with a place on the picture; anything else left out. */
export function pinsOf(value: unknown): Pin[] {
  if (!Array.isArray(value)) return [];
  return value.filter((pin): pin is Pin => !!pin && typeof pin === 'object' && [pin.x, pin.y].every((share) => typeof share === 'number' && share >= 0 && share <= 1));
}

/** A share kept to the picture, to four places: 0.4213. */
const share = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 1e4) / 1e4;
const AREAS = [
  ['pinTopLeft', 'pinTop', 'pinTopRight'],
  ['pinLeft', 'pinCentre', 'pinRight'],
  ['pinBottomLeft', 'pinBottom', 'pinBottomRight'],
] as const;
/** Where a pin is, in words: the ninth of the picture, then how far across and down. */
export function pinAt(pin: { x: number; y: number }, words: WidgetLabels): string {
  const third = (n: number) => (n < 1 / 3 ? 0 : n > 2 / 3 ? 2 : 1);
  return fillIn(words.pinAt, { area: words[AREAS[third(pin.y)][third(pin.x)]], x: Math.round(pin.x * 100), y: Math.round(pin.y * 100) });
}

/** The picture's address: the page's own, else a field's — a picture or a file it holds, or a web address. */
function pictureOf(options: PinsOptions, values: Readonly<Record<string, unknown>> | undefined): string {
  if (options.imageField) {
    const held = values?.[options.imageField];
    const file = (Array.isArray(held) ? held[0] : held) as FileValue | string | null | undefined;
    if (typeof file === 'string') return file;
    if (file && typeof file === 'object') return source(file);
    return '';
  }
  return options.image ?? '';
}

export const pinsWidget: WidgetFactory = ({ form, name, field, node, id, document: doc, labels, locale }) => {
  installPinsStyles(doc);
  const words = wordsFor(labels, locale);
  const make = maker(doc);
  const options = (node.options ?? {}) as PinsOptions;
  const most = options.maxPins ?? Infinity;
  const area = options.alt || field.label || name;
  const image = make('img', { class: 'fd-pins-image', alt: options.alt ?? '', draggable: 'false' });
  const cross = make('span', { class: 'fd-pins-cross', 'aria-hidden': 'true' });
  const help = make('p', { class: 'fd-help fd-pins-help', id: `${id}-pins-help` }, words.pinsHelp);
  const stage = make('div', { class: 'fd-pins-stage', id, role: 'group', tabindex: '0', 'aria-label': fillIn(words.pinsOn, { label: area }), 'aria-describedby': help.id }, image, cross);
  const missing = make('p', { class: 'fd-help fd-pins-missing', hidden: '' }, words.pinsNoPicture);
  const list = make('ol', { class: 'fd-pins-list' });
  const none = make('p', { class: 'fd-help fd-pins-none' }, words.pinsNone);
  const voice = announcer(make);
  const element = make('div', { class: 'fd-pins' }, stage, missing, help, list, none, voice.element);

  let pins: Pin[] = [];
  let readonly = false;
  let held: unknown;
  /** The cross the keyboard moves over the picture, where a pin goes on Enter. */
  const at = { x: 0.5, y: 0.5 };
  const buttons: HTMLButtonElement[] = [];
  const rows: { item: HTMLLIElement; place: HTMLElement; note: HTMLInputElement; remove: HTMLButtonElement; words: HTMLElement }[] = [];

  const place = (target: HTMLElement, pin: { x: number; y: number }) => {
    target.style.left = `${pin.x * 100}%`;
    target.style.top = `${pin.y * 100}%`;
  };
  const named = (pin: Pin, n: number) => fillIn(pin.note ? words.pinNamedNote : words.pinNamed, { n, at: pinAt(pin, words), note: pin.note ?? '' });
  /** The pins written: the value the form keeps, an app's own keys on each pin kept. */
  const write = (next: Pin[]) => {
    pins = next;
    held = next;
    form.setValue(name, next as unknown as JsonValue);
    draw();
  };

  /** The pins and their list drawn as they are: a row's note box kept as typed while the person is in it. */
  function draw() {
    for (const [n, pin] of pins.entries()) {
      let button = buttons[n];
      if (!button) {
        button = make('button', { type: 'button', class: 'fd-pin', 'data-at': String(n) }, String(n + 1));
        buttons.push(button);
        stage.append(button);
      }
      place(button, pin);
      setAttr(button, 'aria-label', named(pin, n + 1));
      let row = rows[n];
      if (!row) {
        const note = make('input', { type: 'text', class: 'fd-input fd-pin-note', 'data-at': String(n), autocomplete: 'off', placeholder: options.noteLabel ?? words.pinNotePlaceholder });
        const remove = make('button', { type: 'button', class: 'fd-pin-remove', 'data-at': String(n) }, '×');
        const placeWords = make('span', { class: 'fd-pin-at' });
        const noteWords = make('span', { class: 'fd-pin-note-words' });
        const item = make('li', { class: 'fd-pin-row' }, make('span', { class: 'fd-pin-badge', 'aria-hidden': 'true' }, String(n + 1)), placeWords, note, noteWords, remove);
        row = { item, place: placeWords, note, remove, words: noteWords };
        rows.push(row);
        list.append(item);
      }
      setText(row.place, pinAt(pin, words));
      setAttr(row.note, 'aria-label', fillIn(words.pinNote, { n: n + 1 }));
      setAttr(row.remove, 'aria-label', fillIn(words.pinRemove, { n: n + 1 }));
      if (doc.activeElement !== row.note && row.note.value !== (pin.note ?? '')) row.note.value = pin.note ?? '';
      setText(row.words, pin.note ?? '');
      setHidden(row.note, readonly);
      setHidden(row.remove, readonly);
      setHidden(row.words, !readonly);
    }
    for (const button of buttons.splice(pins.length)) button.remove();
    for (const row of rows.splice(pins.length)) row.item.remove();
    setHidden(none, pins.length > 0);
    place(cross, at);
    element.classList.toggle('fd-pins-readonly', readonly);
    setHidden(help, readonly);
    setAttr(stage, 'tabindex', readonly ? null : '0');
  }

  /** A pin put at a place: its note's box focused, as a person writes what was done there. */
  function add(where: { x: number; y: number }) {
    if (readonly) return;
    if (pins.length >= most) return voice.say(fillIn(words.pinsFull, { max: most }));
    const pin: Pin = { x: share(where.x), y: share(where.y) };
    write([...pins, pin]);
    voice.say(fillIn(words.pinAdded, { n: pins.length, at: pinAt(pin, words) }));
    rows[pins.length - 1]?.note.focus();
  }
  function move(n: number, to: { x: number; y: number }, said = true) {
    const pin = { ...pins[n], x: share(to.x), y: share(to.y) };
    write(pins.map((one, i) => (i === n ? pin : one)));
    if (said) voice.say(fillIn(words.pinMoved, { n: n + 1, at: pinAt(pin, words) }));
  }
  function remove(n: number) {
    write(pins.filter((_, i) => i !== n));
    voice.say(fillIn(words.pinRemoved, { n: n + 1 }));
    (buttons[Math.min(n, buttons.length - 1)] ?? stage).focus();
  }
  /** Where a pointer is on the picture, as shares of its width and height. */
  const shareOf = (event: PointerEvent | MouseEvent) => {
    const box = image.getBoundingClientRect();
    return { x: box.width ? (event.clientX - box.left) / box.width : 0.5, y: box.height ? (event.clientY - box.top) / box.height : 0.5 };
  };

  // A click or a tap on the picture, not on a pin: a pin there.
  stage.addEventListener('click', (event) => {
    if ((event.target as Element).closest('.fd-pin') || !image.complete || !image.naturalWidth) return;
    add(shareOf(event));
  });
  // A pin dragged: it follows the pointer, and is kept where it is let go; Escape puts it back. A press that does not move
  // goes to its note.
  let dragging: { n: number; from: { x: number; y: number }; startX: number; startY: number; moved: boolean; pointer: number } | null = null;
  stage.addEventListener('pointerdown', (event) => {
    // The cross is the keyboard's: shown while the picture is worked by keys.
    stage.classList.remove('fd-pins-keyed');
    const button = (event.target as Element).closest<HTMLButtonElement>('.fd-pin');
    if (!button || readonly || event.button !== 0) return;
    const n = Number(button.dataset['at']);
    dragging = { n, from: { x: pins[n].x, y: pins[n].y }, startX: event.clientX, startY: event.clientY, moved: false, pointer: event.pointerId };
    button.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  stage.addEventListener('pointermove', (event) => {
    if (!dragging || event.pointerId !== dragging.pointer) return;
    if (!dragging.moved && Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) < 4) return;
    dragging.moved = true;
    const to = shareOf(event);
    place(buttons[dragging.n], { x: share(to.x), y: share(to.y) });
  });
  const drop = (event: PointerEvent, keep: boolean) => {
    if (!dragging || event.pointerId !== dragging.pointer) return;
    const { n, from, moved } = dragging;
    dragging = null;
    if (!moved) return rows[n]?.note.focus();
    if (keep) move(n, shareOf(event));
    else place(buttons[n], from);
    buttons[n]?.focus();
  };
  stage.addEventListener('pointerup', (event) => drop(event, true));
  stage.addEventListener('pointercancel', (event) => drop(event, false));
  stage.addEventListener('keydown', (event) => {
    if (readonly) return;
    const button = (event.target as Element).closest<HTMLButtonElement>('.fd-pin');
    if (dragging && event.key === 'Escape') {
      event.preventDefault();
      place(buttons[dragging.n], dragging.from);
      dragging = null;
      return;
    }
    // The picture is never mirrored: left is its left, right to left too.
    const step = event.shiftKey ? 0.1 : 0.02;
    const by = ({ ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] } as Record<string, [number, number]>)[event.key];
    if (button) {
      const n = Number(button.dataset['at']);
      if (by) move(n, { x: pins[n].x + by[0], y: pins[n].y + by[1] });
      else if (event.key === 'Delete' || event.key === 'Backspace') remove(n);
      else if (event.key === 'Enter') rows[n]?.note.focus();
      else return;
      event.preventDefault();
      if (by) buttons[n]?.focus();
      return;
    }
    if (event.target !== stage) return;
    if (by) {
      at.x = share(at.x + by[0]);
      at.y = share(at.y + by[1]);
      stage.classList.add('fd-pins-keyed');
      place(cross, at);
    } else if (event.key === 'Enter' || event.key === ' ') add(at);
    else return;
    event.preventDefault();
  });
  // A note typed: kept as it is typed, the pin named by it.
  list.addEventListener('input', (event) => {
    const box = (event.target as Element).closest<HTMLInputElement>('.fd-pin-note');
    if (!box) return;
    const n = Number(box.dataset['at']);
    write(pins.map((pin, i) => (i === n ? { ...pin, note: box.value } : pin)));
  });
  list.addEventListener('click', (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>('.fd-pin-remove');
    if (button) remove(Number(button.dataset['at']));
  });
  const showPicture = (ok: boolean) => {
    setHidden(stage, !ok);
    setHidden(missing, ok);
  };
  image.addEventListener('load', () => showPicture(true));
  image.addEventListener('error', () => showPicture(false));

  return {
    element,
    focus: () => (readonly ? (buttons[0] ?? stage) : stage).focus(),
    update(state) {
      readonly = state.readonly;
      const src = pictureOf(options, state.values);
      if (image.getAttribute('src') !== src) {
        if (src) image.setAttribute('src', src);
        else image.removeAttribute('src');
        showPicture(!!src);
      }
      if (state.value !== held) {
        held = state.value;
        pins = pinsOf(state.value);
      }
      draw();
    },
  };
};
