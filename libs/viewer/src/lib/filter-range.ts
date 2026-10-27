import { fill, numberMisfit, readNumber, wallClock, wallDay, wallTime, type Field, type JsonValue, type LineField, type Locale, type Page, type ResolvedFilterCondition } from '@fieldia/core';
import { dateExample, dateOrderOf, dateShape, displayValue, guard, numberRules, readDateText, refusalHint, refusalWords, typingText, WIDGET_LABELS, type Guard, type RefusalHint } from '@fieldia/widgets';
import type { El } from './dom';
import { countMark } from './filter-count';
import type { ViewerLabels } from './labels';

/**
 * A field's range in a filter: its two ends — From and To, either left open — read as every box reads a number or a
 * day (FIELDIA INPUT RULES), written as the page writes them, and kept as one value of one chip ("Price: 1,000,000 –
 * 3,000,000", "Bedrooms: 2+"), which a data source reads as `>=` and `<=` (facetsToFilter in @fieldia/core). The
 * filter bar's range (`filterRanges`) and a custom filter's "is between" are both made of it.
 */

/** A range's ends: a number, or a day ("2026-10-19") for a date or a date and time; null where it is left open. */
export interface RangeEnds {
  from: number | string | null;
  to: number | string | null;
}

export type RangeWords = Pick<ViewerLabels, 'rangeFrom' | 'rangeTo' | 'rangeBetween' | 'rangeOrMore' | 'rangeUpTo' | 'rangeSince' | 'rangeUntil' | 'rangeOrder' | 'rangeOrderDate'>;
/** A range's value in a field's chip. */
export type RangeValue = { op: Extract<ResolvedFilterCondition['op'], 'between' | '>=' | '<='>; value: JsonValue; label: string };

const NUMBERS: ReadonlySet<string> = new Set(['integer', 'float', 'monetary']);
/** Whether a field's range ends are numbers; else they are days. */
export const numberRange = (def: Field) => NUMBERS.has(def.type);
/** The kinds of field a range filters: a number's, a date's, a date and time's (by its days). */
export const RANGED: ReadonlySet<string> = new Set([...NUMBERS, 'date', 'datetime']);
/** The kinds whose range is all a filter bar can take of them: no list of their values. */
export const RANGE_ONLY: ReadonlySet<string> = new Set(['float', 'monetary', 'date', 'datetime']);

/** An end as the page writes it: a number with its grouping, an amount in its own currency where the field fixes one, a day as days are written. */
export function endWords(def: Field, end: number | string, locale: Locale): string {
  if (!numberRange(def)) return displayValue({ ...def, type: 'date' } as LineField, end, {}, locale);
  if (def.type === 'monetary') return displayValue(def as LineField, end, {}, locale);
  return displayValue({ ...def, type: 'float', digits: [16, 0] } as LineField, end, {}, locale);
}

/** An end as it is typed back into its box: a number in the page's way without a currency, a day in the page's order. */
function endTyped(page: Page, def: Field, end: number | string | null, locale: Locale): string {
  if (end === null) return '';
  if (numberRange(def)) return displayValue({ ...def, type: 'float', digits: [16, 0] } as LineField, end, {}, locale);
  return typingText(String(end), 'date', dateOrderOf({ page }), locale);
}

/** A range in words: "1,000,000 – 3,000,000", "2+", "up to 3,000,000"; a date's "from 1 Oct 2026", "until 15 Oct 2026". */
export function rangeWords(def: Field, ends: RangeEnds, labels: RangeWords, locale: Locale): string {
  const { from, to } = ends;
  const number = numberRange(def);
  if (from !== null && to !== null) return from === to ? endWords(def, from, locale) : fill(labels.rangeBetween, { from: endWords(def, from, locale), to: endWords(def, to, locale) });
  if (from !== null) return fill(number ? labels.rangeOrMore : labels.rangeSince, { from: endWords(def, from, locale) });
  if (to !== null) return fill(number ? labels.rangeUpTo : labels.rangeUntil, { to: endWords(def, to, locale) });
  return '';
}

/** A range as one value of its field's chip: both ends `between`, one `>=` or `<=`; null with neither. */
export function rangeValue(def: Field, ends: RangeEnds, labels: RangeWords, locale: Locale): RangeValue | null {
  const { from, to } = ends;
  if (from === null && to === null) return null;
  const label = rangeWords(def, ends, labels, locale);
  if (from !== null && to !== null) return { op: 'between', value: [from, to], label };
  return from !== null ? { op: '>=', value: from, label } : { op: '<=', value: to, label };
}

/** The ends of a chip's value that is a range; null for any other value. */
export function endsOf(value: { op: string; value: JsonValue }): RangeEnds | null {
  const end = (v: JsonValue | undefined) => (typeof v === 'number' || (typeof v === 'string' && v !== '') ? v : null);
  if (value.op === 'between' && Array.isArray(value.value) && value.value.length === 2) return { from: end(value.value[0]), to: end(value.value[1]) };
  if (value.op === '>=') return { from: end(value.value), to: null };
  if (value.op === '<=') return { from: null, to: end(value.value) };
  return null;
}

export interface RangeBoxesContext {
  page: Page;
  /** The field, with the name its filter goes by (its label, or the bar's own for it). */
  def: Field;
  el: El;
  labels: RangeWords;
  locale?: Locale;
  /** Both boxes read and taken, from a box's change or its Enter: what the range is now. */
  onRead?: (ends: RangeEnds) => void;
}

export interface RangeBoxes {
  element: HTMLElement;
  from: HTMLInputElement;
  to: HTMLInputElement;
  /**
   * Both boxes read: their ends, or false where one holds text that is no number (no day), or From is past To — said
   * under the box, the text kept as typed, the focus on it when `focus`.
   */
  read(focus?: boolean): RangeEnds | false;
  /** Why the last read refused them, in words: none where it read them. */
  why(): string;
  /** The ends written into the boxes, as the page writes them. */
  show(ends: RangeEnds): void;
  /** Words under a box, the focus on it: what goes there. */
  say(input: HTMLInputElement, words: string): void;
  destroy(): void;
}

/**
 * From and To for a number or a day: the browser's own number and date boxes never (they follow the browser's language,
 * not the page's, and drop Arabic digits). A number is read in the page's language and refused as typed where it can
 * never be one, a whole number's box takes no fraction; a day is read in the page's order, one that is no day said.
 */
export function rangeBoxes(context: RangeBoxesContext): RangeBoxes {
  const { page, def, el, labels } = context;
  const locale = context.locale ?? 'en';
  const words = WIDGET_LABELS[locale] ?? WIDGET_LABELS.en;
  const order = dateOrderOf({ page });
  const number = numberRange(def);
  const placeholder = number ? undefined : dateShape('date', order, words);
  const box = (word: string) => el('input', { class: 'fd-input fd-filter-range-box', type: 'text', autocomplete: 'off', 'aria-label': `${def.label}: ${word}`, ...(number ? { inputmode: 'decimal' } : {}), ...(placeholder ? { placeholder } : {}) });
  const from = box(labels.rangeFrom);
  const to = box(labels.rangeTo);
  const end = (input: HTMLInputElement, word: string) => el('label', { class: 'fd-filter-range-end' }, el('span', { class: 'fd-filter-range-word', 'aria-hidden': 'true' }, word), input);
  const element = el('div', { class: 'fd-filter-range-boxes' }, end(from, labels.rangeFrom), end(to, labels.rangeTo));
  const hints = new Map<HTMLInputElement, RefusalHint>([
    [from, refusalHint(from, from.parentElement as HTMLElement)],
    [to, refusalHint(to, to.parentElement as HTMLElement)],
  ]);
  const checks = new Map<HTMLInputElement, Guard>();
  if (number) for (const input of [from, to]) checks.set(input, guard(input, numberRules({ label: def.label, locale, labels: words, limits: () => ({ integer: def.type === 'integer' }) }), hints.get(input) as RefusalHint));

  /** One box's end: none for no text, else the number or day it reads as, or why it reads as none. */
  const readEnd = (input: HTMLInputElement): { ok: true; value: number | string | null } | { ok: false; words: string } => {
    const text = input.value.trim();
    if (!text) return { ok: true, value: null };
    if (number) {
      // Keys held after a refused one are part of what was typed ("1.5" where the box shows "1"): they stay, with why.
      const held = checks.get(input)?.held();
      if (held) {
        input.value = held.text;
        return { ok: false, words: held.words };
      }
      const read = readNumber(text, locale);
      if (!read.ok || read.value === null) return { ok: false, words: words.enterNumber };
      const misfit = numberMisfit(read.value, { integer: def.type === 'integer' });
      if (misfit) return { ok: false, words: refusalWords(misfit, { label: def.label, locale, labels: words }) };
      return { ok: true, value: read.value };
    }
    // As a date box reads a day, in the page's order; a day and time written where a day goes keeps its day and says the time.
    const reader = { order, locale, label: def.label, labels: words, ...(page.timeZone ? { zone: page.timeZone } : {}) };
    const read = readDateText(text, { kind: 'date', ...reader });
    if (!read.ok) {
      const moment = readDateText(text, { kind: 'datetime', ...reader });
      if (!moment.ok || !moment.value) return { ok: false, words: read.words };
      const at = wallTime(Date.parse(moment.value), page.timeZone);
      input.value = typingText(wallDay(at), 'date', order, locale);
      return { ok: false, words: fill(words.timeLeftOut, { label: def.label, time: wallClock(at) }) };
    }
    if (read.value === null) return { ok: false, words: words.enterDate.split('{example}').join(dateExample({ kind: 'date', order, locale })) };
    if (read.timeLeftOut) {
      input.value = typingText(read.value, 'date', order, locale);
      return { ok: false, words: fill(words.timeLeftOut, { label: def.label, time: read.timeLeftOut }) };
    }
    return { ok: true, value: read.value };
  };

  let refused = '';
  const read = (focus = true): RangeEnds | false => {
    refused = '';
    const said = (input: HTMLInputElement, why: string) => {
      hints.get(input)?.show((refused = why));
      if (focus) input.focus();
      return false as const;
    };
    const low = readEnd(from);
    const high = readEnd(to);
    for (const input of [from, to]) hints.get(input)?.hide();
    if (!low.ok) return said(from, low.words);
    if (!high.ok) return said(to, high.words);
    if (low.value !== null && high.value !== null && low.value > high.value) return said(to, number ? labels.rangeOrder : labels.rangeOrderDate);
    return { from: low.value, to: high.value };
  };

  const taken = () => {
    const ends = read(false);
    if (ends) context.onRead?.(ends);
  };
  for (const input of [from, to]) {
    input.addEventListener('change', taken);
    input.addEventListener('keydown', (event) => {
      if (event.isComposing || event.key !== 'Enter') return;
      // Never the form's Enter: a filter has nothing to send.
      event.preventDefault();
      const ends = read(true);
      if (ends) context.onRead?.(ends);
    });
  }

  return {
    element,
    from,
    to,
    read,
    why: () => refused,
    show(ends) {
      from.value = endTyped(page, def, ends.from, locale);
      to.value = endTyped(page, def, ends.to, locale);
      for (const input of [from, to]) hints.get(input)?.hide();
    },
    say(input, words) {
      input.focus();
      hints.get(input)?.show(words);
    },
    destroy() {
      for (const guarded of checks.values()) guarded.destroy();
    },
  };
}

/**
 * What the list part hands its filter bar (the filters part's) of a range and of a count: their code is the list
 * part's own, which its search bar and a custom filter's "is between" draw with too — a part's code is in one part.
 */
export const filterKit = { rangeBoxes, rangeValue, rangeWords, endWords, endsOf, countMark, numberRange, rangeOnly: RANGE_ONLY };
export type FilterKit = typeof filterKit;
