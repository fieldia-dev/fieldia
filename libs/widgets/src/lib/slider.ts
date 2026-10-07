import { clearSelection, describeState, maker, wordsFor } from './kind-parts';
import { formatNumber } from './numbers';
import type { WidgetFactory } from './widgets';

/**
 * A number picked on a slider (`integer.slider`, `float.slider`): the field's
 * `min` to `max` (0 to 100 when it has none), `options.step` at a time (1),
 * the value shown beside it and the ends under it, written as the page's
 * readers write numbers. A native range, so the arrow keys, Home and End move
 * it, a screen reader reads it, and it runs right to left on such a page.
 * Until it is slid it is not answered, and says so.
 */
export const sliderWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale = 'en' }) => {
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
  const element = make('div', { class: 'fd-slider' }, make('div', { class: 'fd-slider-track' }, input, output), ends, clear.button);
  if (endWords.some(Boolean)) input.setAttribute('aria-description', endWords.filter(Boolean).join(' … '));
  input.addEventListener('input', () => form.setValue(name, Number(input.value)));

  return {
    element,
    focus: () => input.focus(),
    update(state) {
      const value = typeof state.value === 'number' ? state.value : null;
      element.classList.toggle('fd-slider-empty', value === null);
      // Not answered: the thumb waits halfway, dimmed, and says so.
      const at = String(value ?? (min + max) / 2);
      if (input.value !== at) input.value = at;
      output.textContent = value === null ? '–' : written(value);
      input.setAttribute('aria-valuetext', value === null ? words.notAnswered : written(value));
      input.disabled = state.readonly;
      clear.allow(state);
      clear.show(value !== null);
      describeState(input, state);
    },
  };
};
