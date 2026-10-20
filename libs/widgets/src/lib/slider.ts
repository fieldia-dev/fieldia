import { foldTyped, readNumber } from '@fieldia/core';
import { clearSelection, describeState, maker, wordsFor } from './kind-parts';
import { formatNumber } from './numbers';
import { installSurveyStyles } from './styles-survey';
import type { WidgetFactory } from './widgets';

/**
 * A number picked on a slider (`integer.slider`, `float.slider`): the field's
 * `min` to `max` (0 to 100 when it has none), `options.step` at a time (1),
 * the value shown beside it and the ends under it, written as the page's
 * readers write numbers. A native range, so the arrow keys, Home and End move
 * it, a screen reader reads it, and it runs right to left on such a page.
 * Until it is slid it is not answered, and says so: no knob of its own, a
 * hollow ring at the start of a track with nothing filled, "Not answered"
 * beside it — the native range over it, out of sight, still taking the
 * pointer and the keys, which answer from the start.
 */
export const sliderWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale = 'en' }) => {
  installSurveyStyles(document);
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const has = (key: 'min' | 'max') => (key in field && typeof (field as Record<string, unknown>)[key] === 'number' ? ((field as Record<string, unknown>)[key] as number) : undefined);
  const min = has('min') ?? 0;
  const max = has('max') ?? 100;
  const step = typeof node.options?.['step'] === 'number' && node.options['step'] > 0 ? node.options['step'] : 1;
  const decimals = field.type === 'integer' ? 0 : field.type === 'float' && field.digits ? field.digits[1] : Math.max(0, -Math.floor(Math.log10(step)));
  const written = (n: number) => formatNumber(n, decimals, locale);

  const input = make('input', { id, type: 'range', class: 'fd-slider-input', min: String(min), max: String(max), step: String(step) });
  const output = make('output', { class: 'fd-slider-value', for: id, 'aria-hidden': 'true' });
  // Words under the ends' numbers, when the page has them: "Never" … "Every day".
  const endWords = [node.options?.['startLabel'], node.options?.['endLabel']].map((v) => (typeof v === 'string' ? v : ''));
  const end = (n: number, i: number) => make('span', { class: i ? 'fd-slider-last' : undefined }, written(n), ...(endWords[i] ? [make('span', { class: 'fd-slider-word' }, endWords[i])] : []));
  const ends = make('div', { class: 'fd-slider-ends', 'aria-hidden': 'true' }, end(min, 0), end(max, 1));
  const clear = clearSelection(document, words, () => {
    form.setValue(name, null);
    input.focus();
  }, node);
  // Not answered: a track with nothing filled and a hollow ring at its start, drawn under the range, which is out of sight.
  const blank = make('span', { class: 'fd-slider-blank', 'aria-hidden': 'true' }, make('span', { class: 'fd-slider-ring' }));
  // The room "Not answered" takes, kept beside the value once it is answered: the track never grows under the pointer.
  const room = make('span', { class: 'fd-slider-room', 'aria-hidden': 'true' }, words.notAnswered);
  const element = make('div', { class: 'fd-slider' }, make('div', { class: 'fd-slider-track' }, make('span', { class: 'fd-slider-rail' }, input, blank), output, room), ends, clear.button);
  if (endWords.some(Boolean)) input.setAttribute('aria-description', endWords.filter(Boolean).join(' … '));
  // Text the number box drawn before the slider came kept unread ("1.5" in whole days): the slider says so, and a value
  // slid to replaces it.
  const unread = () => form.getState().unread?.[name];
  input.addEventListener('input', () => {
    form.setValue(name, Number(input.value));
    if (unread()) form.setUnread(name, null);
  });
  let readonly = false;
  /** A press, or a key, that leaves the knob where it starts — its least — answers it all the same: the person chose it. */
  const answerAsIs = () => {
    if (readonly || typeof form.getState().values[name] === 'number') return;
    form.setValue(name, Number(input.value));
    if (unread()) form.setUnread(name, null);
  };
  input.addEventListener('pointerup', answerAsIs);
  input.addEventListener('keydown', (event) => {
    // After the key has moved it, if it did: Home at the start, or the arrow back, moves nothing and sends no input.
    if (['Home', 'End', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(event.key)) setTimeout(answerAsIs, 0);
  });

  return {
    element,
    focus: () => input.focus(),
    // Typed in the number box drawn before the slider came: a number it holds as typed ("4") is the slider's, focused;
    // one on its way ("2." of 2.5) it cannot show, so that box stays until it is left.
    takeTyped(typed) {
      const reading = readNumber(typed.text, locale);
      if (!reading.ok || reading.value !== (form.getState().values[name] ?? null) || reading.plain !== foldTyped(typed.text).trim()) return false;
      input.focus();
      return true;
    },
    update(state) {
      const value = typeof state.value === 'number' ? state.value : null;
      element.classList.toggle('fd-slider-empty', value === null);
      // Not answered: no knob halfway, which reads as an answer — a ring at the start, the keys moving from there.
      const at = String(value ?? min);
      if (input.value !== at) input.value = at;
      blank.hidden = value !== null;
      output.textContent = value === null ? words.notAnswered : written(value);
      input.setAttribute('aria-valuetext', value === null ? words.notAnswered : written(value));
      readonly = state.readonly;
      input.disabled = state.readonly;
      clear.allow(state);
      clear.show(value !== null);
      describeState(input, { ...state, invalid: state.invalid || !!unread() });
    },
  };
};
