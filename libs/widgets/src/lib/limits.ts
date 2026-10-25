import { charCount, dayOf, fill, MESSAGES, type Field, type FieldNode } from '@fieldia/core';
import { fillIn, maker, setHidden, setText, wordsFor } from './kind-parts';
import type { Widget, WidgetContext } from './widgets';

/**
 * What a text box shows of its limits: a count of the characters typed
 * against its field's most, under it — "12 / 100", counted as a server counts
 * them (an emoji is one), in the warning colour from nine tenths on, and how
 * many are left said to a screen reader once typing pauses — for a page's own
 * field, not a table's cell. A paste that goes over is kept whole: the count
 * stays a count, in the error colour ("85 / 80"), and the field says the one
 * problem at once, under its box, in the words Save would use ("Notes is 5
 * characters too long: shorten it to 80"), said to a screen reader once typing
 * pauses; shortened, the words follow, and go. Also a paragraph's rows, growing as
 * people type unless the page says not to (`autoGrow: false`); a date's, a
 * date and time's or a time's earliest and latest on its input.
 */
export function counted(widget: Widget, { form, name, field, node, document, labels, locale }: WidgetContext, box: HTMLInputElement | HTMLTextAreaElement): Widget {
  const size = field.type === 'char' || field.type === 'text' ? field.size : undefined;
  if (!size || form.page.fields[name] !== field) return widget;
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const messages = MESSAGES[locale ?? 'en'] ?? MESSAGES.en;
  const label = node.label ?? field.label;
  const shown = make('div', { class: 'fd-count', 'aria-hidden': 'true' });
  const said = make('div', { class: 'fd-sr-only', 'aria-live': 'polite' });
  let pause: ReturnType<typeof setTimeout> | undefined;
  // Gone over its most (a paste: a key at the most is refused): its one problem is said now, under the box, as leaving it would.
  box.addEventListener('input', () => {
    if (charCount(box.value) > size) form.boxLeft(name);
  });
  return {
    ...widget,
    // Its count said a moment after each drawing, as it is typed in: drawn every time.
    reads: undefined,
    element: make('div', { class: 'fd-counted' }, widget.element, shown, said),
    destroy() {
      clearTimeout(pause);
      widget.destroy?.();
    },
    update(state) {
      const n = charCount(typeof state.value === 'string' ? state.value : box.value);
      const past = n - size;
      widget.update(state);
      setText(shown, `${n} / ${size}`);
      shown.classList.toggle('fd-count-near', n >= size * 0.9 && past <= 0);
      shown.classList.toggle('fd-count-past', past > 0);
      setHidden(shown, state.readonly);
      if (document.activeElement !== box) return;
      clearTimeout(pause);
      pause = setTimeout(() => setText(said, past > 0 ? fill(past === 1 ? messages.overByOne : messages.overBy, { label, over: past, max: size }) : fillIn(words.charactersLeft, { n: size - n })), 700);
    },
  };
}

/** A paragraph's rows (`options.rows`), and a way to grow it to what it holds — nothing when it keeps its height. */
export function grower(area: HTMLTextAreaElement, node: FieldNode): () => void {
  const rows = node.options?.['rows'];
  if (typeof rows === 'number') area.rows = rows;
  if (node.options?.['autoGrow'] === false) return () => undefined;
  return () => {
    area.style.height = '';
    // Its height takes its borders too: what scrolls, and the borders round it.
    if (area.scrollHeight) area.style.height = `${area.scrollHeight + area.offsetHeight - area.clientHeight}px`;
  };
}

/** What a date, a date and time or a time keeps to: its earliest and latest (days, "2026-10-13", or times, "09:00"), its days of the week, its minutes' step. */
export interface DayLimits {
  min?: string;
  max?: string;
  /** ISO days of the week it may fall on: 1 Monday … 7 Sunday. */
  days?: number[];
  /** Minutes between the times it takes. */
  step?: number;
}

/**
 * A date's or a date and time's earliest and latest day (the field's `min`
 * and `max`, counted from today where they say so, "today+30") and its days
 * of the week, or a time's earliest and latest (the node's `min` and `max`,
 * "09:00"); and the node's `step` in minutes. Fieldia's own date box keeps
 * them on its calendar; they are written on `input`, when given (`data-min`,
 * `data-max`, `data-step`), for a page's own styles and tests. What is typed
 * past them is said as the box is left, and at Save.
 */
export function bounds(input: HTMLElement | null, field: Field, node: FieldNode): DayLimits {
  const options = node.options ?? {};
  const time = field.type === 'char';
  const limits: DayLimits = {};
  const [min, max] = time ? [options['min'], options['max']] : 'min' in field ? [field.min, field.max] : [];
  if (typeof min === 'string') limits.min = time ? min : dayOf(min);
  if (typeof max === 'string') limits.max = time ? max : dayOf(max);
  if (!time && 'days' in field && Array.isArray(field.days)) limits.days = field.days;
  if (typeof options['step'] === 'number' && options['step'] > 0) limits.step = options['step'];
  if (input) markBounds(input, limits);
  return limits;
}

/** The limits written on a box, as `data-min`, `data-max` and `data-step` (minutes). */
export function markBounds(input: HTMLElement, limits: DayLimits): void {
  for (const [name, value] of [['data-min', limits.min], ['data-max', limits.max], ['data-step', limits.step === undefined ? undefined : String(limits.step)]] as const) {
    if (value === undefined) input.removeAttribute(name);
    else if (input.getAttribute(name) !== value) input.setAttribute(name, value);
  }
}
