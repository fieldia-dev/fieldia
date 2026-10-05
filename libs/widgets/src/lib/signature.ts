import type { FileValue } from '@fieldia/core';
import { readFile } from './files';
import { describeState, maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A signature on a file field (`binary.signature`): drawn on a pad with a
 * mouse, a finger or a pen, or — for anyone without a pointer — typed as a
 * name and drawn as a signature, the name kept as the value's `text`. Kept
 * as a PNG picture, the value a file upload has. A signature already kept
 * shows as its picture until Clear. Undo takes the last stroke away.
 *
 * `options.color` (#rrggbb) and `options.penWidth` set the pen; the node's
 * `placeholder` is the words on the blank pad ("Sign here"); `options.footerLabel`
 * the words kept under it; `options.upload` lets a picture of a signature be
 * uploaded as a third way.
 */

/** The pad's own size, in the picture's pixels; it is drawn at whatever width its box has. */
const WIDTH = 600;
const HEIGHT = 180;
/** Blue-black ink on a clear ground, so the picture reads on any paper. */
const INK = '#1b2a5c';
const SCRIPT = '"Segoe Script", "Snell Roundhand", "Brush Script MT", "Apple Chancery", cursive';

/** The bytes a base64 text holds. */
const bytesOf = (base64: string) => Math.floor((base64.length * 3) / 4) - (base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0);
const keyOf = (file: FileValue) => file.data ?? file.url ?? '';
type Point = { x: number; y: number };

export const signatureWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const options = node.options ?? {};
  const color = options['color'];
  const ink = typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color : INK;
  const penWidth = options['penWidth'];
  const width = typeof penWidth === 'number' && penWidth > 0 ? penWidth : 3;
  const footerWords = options['footerLabel'];
  const canvas = make('canvas', { class: 'fd-signature-pad', width: String(WIDTH), height: String(HEIGHT), role: 'img', 'aria-label': words.signaturePad });
  const hint = make('span', { class: 'fd-signature-hint', 'aria-hidden': 'true' }, node.placeholder || words.signHere);
  const image = make('img', { class: 'fd-signature-image', alt: field.label, hidden: '' });
  const typed = make('input', { type: 'text', class: 'fd-input fd-signature-typed', 'aria-label': words.typeSignature, placeholder: words.typeSignature, autocomplete: 'name' });
  const button = (words: string) => make('button', { type: 'button', class: 'fd-button fd-button-link', hidden: '' }, words);
  const undo = button(words.undo);
  const clear = button(words.clearDrawing);
  clear.classList.add('fd-signature-clear');
  // A picture of a signature, from this computer or a phone's camera.
  const upload = options['upload'] === true ? button(words.uploadSignature) : null;
  const file = make('input', { type: 'file', accept: 'image/*', class: 'fd-sr-only', tabindex: '-1', 'aria-hidden': 'true' });
  const element = make(
    'div',
    { id, class: 'fd-signature', role: 'group' },
    make('div', { class: 'fd-signature-box' }, canvas, image, hint),
    ...(typeof footerWords === 'string' && footerWords ? [make('span', { class: 'fd-signature-footer' }, footerWords)] : []),
    make('div', { class: 'fd-signature-tools' }, typed, undo, ...(upload ? [upload, file] : []), clear)
  );

  const pen = () => {
    const context = canvas.getContext('2d');
    if (context) {
      context.strokeStyle = context.fillStyle = ink;
      context.lineWidth = width;
      context.lineCap = context.lineJoin = 'round';
    }
    return context;
  };
  /** The picture this pad last kept: coming back from the form, it leaves the pad as it is. */
  let mine: string | null = null;
  let readonly = false;
  /** What is on the pad: a typed name, and the strokes drawn, each its points. */
  let typedName: string | null = null;
  let strokes: Point[][] = [];
  let last: Point | null = null;

  const blank = () => !strokes.length && !typedName;
  /** The pad drawn again from what is on it: the name, then each stroke — a dot for a press that never moved. */
  function redraw() {
    const context = pen();
    if (!context) return;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    if (typedName) {
      context.font = `italic 64px ${SCRIPT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(typedName, WIDTH / 2, HEIGHT / 2, WIDTH - 40);
    }
    for (const stroke of strokes) {
      context.beginPath();
      context.arc(stroke[0].x, stroke[0].y, width / 2, 0, Math.PI * 2);
      context.fill();
      for (let i = 1; i < stroke.length; i++) line(stroke[i - 1], stroke[i]);
    }
  }
  function line(from: Point, to: Point) {
    const context = pen();
    context?.beginPath();
    context?.moveTo(from.x, from.y);
    context?.lineTo(to.x, to.y);
    context?.stroke();
  }
  function wipe() {
    strokes = [];
    typedName = null;
    redraw();
  }
  /** What is on the pad, as the field's value: nothing when it is blank. */
  function keep() {
    hint.hidden = !blank();
    if (blank()) {
      mine = null;
      return form.setValue(name, null);
    }
    let url: string | undefined;
    try {
      url = canvas.toDataURL('image/png');
    } catch {
      return; // a pad that cannot be read back keeps nothing
    }
    if (!url) return;
    const data = url.slice(url.indexOf(',') + 1);
    mine = data;
    form.setValue(name, { name: 'signature.png', type: 'image/png', size: bytesOf(data), data, ...(typedName && !strokes.length ? { text: typedName } : {}) });
  }
  /** The pad's point under the pointer: the pad is drawn smaller or larger than its own size. */
  function at(event: PointerEvent) {
    const box = canvas.getBoundingClientRect();
    return { x: ((event.clientX - box.left) * WIDTH) / (box.width || WIDTH), y: ((event.clientY - box.top) * HEIGHT) / (box.height || HEIGHT) };
  }

  canvas.addEventListener('pointerdown', (event) => {
    if (readonly || event.button !== 0) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    last = at(event);
    strokes.push([last]);
    hint.hidden = true;
    redraw();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!last) return;
    const next = at(event);
    line(last, next);
    strokes[strokes.length - 1].push(next);
    last = next;
  });
  const end = () => {
    if (!last) return;
    last = null;
    keep();
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  // A name typed is drawn in a hand's script, in place of whatever was drawn.
  typed.addEventListener('input', () => {
    showPad();
    strokes = [];
    typedName = typed.value.trim() || null;
    redraw();
    keep();
  });

  undo.addEventListener('click', () => {
    strokes.pop();
    redraw();
    keep();
  });

  upload?.addEventListener('click', () => file.click());
  file.addEventListener('change', () => {
    const chosen = file.files?.[0];
    file.value = '';
    if (chosen) void readFile(chosen).then((value) => form.setValue(name, value));
  });

  clear.addEventListener('click', () => {
    wipe();
    mine = null;
    typed.value = '';
    showPad();
    form.setValue(name, null);
    typed.focus();
  });

  function showPad() {
    image.hidden = true;
    canvas.hidden = false;
  }

  return {
    element,
    focus: () => (typed.hidden ? clear : typed).focus(),
    update(state) {
      readonly = state.readonly;
      const value = state.value && typeof state.value === 'object' && !Array.isArray(state.value) ? (state.value as FileValue) : null;
      const away = document.activeElement !== typed;
      if (value && keyOf(value) !== mine) {
        // Kept before, uploaded, or set from outside: its picture, until Clear.
        const src = value.data ? `data:${value.type};base64,${value.data}` : (value.url ?? '');
        if (image.getAttribute('src') !== src) image.src = src;
        image.hidden = false;
        canvas.hidden = true;
        mine = null;
        wipe();
        if (away) typed.value = value.text ?? '';
      } else if (!value) {
        if (mine !== null || !image.hidden) {
          // Emptied from outside.
          mine = null;
          wipe();
          if (away) typed.value = '';
        }
        showPad();
      }
      hint.hidden = readonly || !blank() || !image.hidden;
      typed.hidden = readonly;
      typed.readOnly = readonly;
      clear.hidden = readonly || !value;
      undo.hidden = readonly || !strokes.length || !image.hidden;
      if (upload) upload.hidden = readonly;
      canvas.classList.toggle('fd-signature-locked', readonly);
      describeState(element, state);
      typed.setAttribute('aria-invalid', String(state.invalid));
    },
  };
};
