import type { FileValue } from '@fieldia/core';
import { describeState, maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A signature on a file field (`binary.signature`): drawn on a pad with a
 * mouse, a finger or a pen, or — for anyone without a pointer — typed as a
 * name and drawn as a signature. Kept as a PNG picture, the value a file
 * upload has. A signature already kept shows as its picture until Clear.
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

export const signatureWidget: WidgetFactory = ({ form, name, field, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const canvas = make('canvas', { class: 'fd-signature-pad', width: String(WIDTH), height: String(HEIGHT), role: 'img', 'aria-label': words.signaturePad });
  const hint = make('span', { class: 'fd-signature-hint', 'aria-hidden': 'true' }, words.signHere);
  const image = make('img', { class: 'fd-signature-image', alt: field.label, hidden: '' });
  const typed = make('input', { type: 'text', class: 'fd-input fd-signature-typed', 'aria-label': words.typeSignature, placeholder: words.typeSignature, autocomplete: 'name' });
  const clear = make('button', { type: 'button', class: 'fd-button fd-button-link fd-signature-clear', hidden: '' }, words.clearDrawing);
  const element = make(
    'div',
    { id, class: 'fd-signature', role: 'group' },
    make('div', { class: 'fd-signature-box' }, canvas, image, hint),
    make('div', { class: 'fd-signature-tools' }, typed, clear)
  );

  const pen = () => {
    const context = canvas.getContext('2d');
    if (context) {
      context.strokeStyle = context.fillStyle = INK;
      context.lineWidth = 3;
      context.lineCap = context.lineJoin = 'round';
    }
    return context;
  };
  /** The picture this pad last kept: coming back from the form, it leaves the pad as it is. */
  let mine: string | null = null;
  let readonly = false;
  let blank = true;
  let last: { x: number; y: number } | null = null;

  function wipe() {
    pen()?.clearRect(0, 0, WIDTH, HEIGHT);
    blank = true;
  }
  function keep() {
    let url: string | undefined;
    try {
      url = canvas.toDataURL('image/png');
    } catch {
      return; // a pad that cannot be read back keeps nothing
    }
    if (!url) return;
    const data = url.slice(url.indexOf(',') + 1);
    mine = data;
    form.setValue(name, { name: 'signature.png', type: 'image/png', size: bytesOf(data), data });
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
    blank = false;
    hint.hidden = true;
    // A dot for a press that never moves: the dot on an i.
    const context = pen();
    context?.beginPath();
    context?.arc(last.x, last.y, 1.5, 0, Math.PI * 2);
    context?.fill();
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!last) return;
    const next = at(event);
    const context = pen();
    context?.beginPath();
    context?.moveTo(last.x, last.y);
    context?.lineTo(next.x, next.y);
    context?.stroke();
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
    wipe();
    showPad();
    const text = typed.value.trim();
    if (!text) {
      mine = null;
      form.setValue(name, null);
      return;
    }
    const context = pen();
    if (context) {
      context.font = `italic 64px ${SCRIPT}`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(text, WIDTH / 2, HEIGHT / 2, WIDTH - 40);
    }
    blank = false;
    keep();
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
      const file = state.value && typeof state.value === 'object' && !Array.isArray(state.value) ? (state.value as FileValue) : null;
      if (file && keyOf(file) !== mine) {
        // Kept before, or set from outside: its picture, until Clear.
        const src = file.data ? `data:${file.type};base64,${file.data}` : (file.url ?? '');
        if (image.getAttribute('src') !== src) image.src = src;
        image.hidden = false;
        canvas.hidden = true;
        mine = null;
        wipe();
        if (document.activeElement !== typed) typed.value = '';
      } else if (!file) {
        if (mine !== null || !image.hidden) {
          // Emptied from outside.
          mine = null;
          wipe();
          if (document.activeElement !== typed) typed.value = '';
        }
        showPad();
      }
      hint.hidden = readonly || !blank || !image.hidden;
      typed.hidden = readonly;
      typed.readOnly = readonly;
      clear.hidden = readonly || !file;
      canvas.classList.toggle('fd-signature-locked', readonly);
      describeState(element, state);
      typed.setAttribute('aria-invalid', String(state.invalid));
    },
  };
};
