import { readDuration, readNumber, type Field, type Locale, type NumberLimits, type Value } from '@fieldia/core';
import { describeState, fillIn, maker, setAttr, wordsFor } from './kind-parts';
import { guard, numberKeyboard, numberRules, quoted, refusalHint, unreadWords, type NumberBox } from './input-rules';
import type { WidgetContext, WidgetFactory } from './widgets';

/**
 * Two numbers shown as people read them rather than as they are kept: hours
 * as hours and minutes, "06:30" for 6.5 (Flectra's float_time, `duration`),
 * and a fraction as a per cent, "25 %" for 0.25 (Flectra's `percentage`).
 * Each is typed as it is shown, and kept as the number. Options: `suffix`,
 * words inside the box after the value ("hours").
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** Hours as HH:MM: 6.5 → "06:30", -1.5 → "-01:30"; the minutes rounded. */
export function formatDuration(hours: number): string {
  const minutes = Math.round(Math.abs(hours) * 60);
  return `${hours < 0 && minutes ? '-' : ''}${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/**
 * What was typed as hours: "6:30", "06:30", "6.5" (in the page's language,
 * "6,5"), "6h30", "6h" or "6:30:00", Arabic digits too (@fieldia/core's
 * readDuration). Null when emptied; undefined while it is still being typed
 * ("6:") or when it does not read ("6 30", "12:75"): a number field never
 * holds words.
 */
export function parseDuration(raw: string, locale: Locale = 'en'): number | null | undefined {
  const read = readDuration(raw, locale);
  return read.ok ? read.value : undefined;
}

const percents = new Map<string, Intl.NumberFormat>();
function percentFormat(locale: Locale, decimals: number, style: 'percent' | 'decimal'): Intl.NumberFormat {
  const key = `${locale}:${decimals}:${style}`;
  let found = percents.get(key);
  if (!found) {
    found = new Intl.NumberFormat(locale, { style, numberingSystem: 'latn', minimumFractionDigits: 0, maximumFractionDigits: decimals });
    percents.set(key, found);
  }
  return found;
}

/** A fraction as a per cent, as the page's language writes one: 0.25 → "25%" ("25 %" in French); at most `decimals` places, none written that are zero. */
export function formatPercentage(fraction: number, locale: Locale = 'en', decimals = 2): string {
  return percentFormat(locale, decimals, 'percent').format(fraction);
}

/** The places a percentage shows: the field's own, else two. */
const placesOf = (field: Field) => (field.type === 'float' ? (field.digits?.[1] ?? 2) : 2);

/**
 * A box whose value is shown and typed in its own way, with words after it inside the box. The input rules
 * guard it as a number box (`duration` takes a colon and an h too); text left that does not read stays, marked,
 * and the field keeps what it held as the box was entered.
 */
function shownBox(
  context: WidgetContext,
  way: { show(value: number): string; parse(text: string): number | null | undefined; unit?: string; className: string; percent?: boolean; duration?: boolean; places?: number }
) {
  const { form, name, field, node, id, document, labels, locale = 'en' } = context;
  const make = maker(document);
  const min = 'min' in field && typeof field.min === 'number' ? field.min : undefined;
  // A per cent's least is the fraction's: 0 is 0 %.
  const limits = (): NumberLimits => ({
    ...(way.percent ? { percent: true } : {}),
    ...(way.places !== undefined ? { places: way.places } : {}),
    ...(min !== undefined ? { min: way.percent ? min * 100 : min } : {}),
  });
  const input = make('input', { id, type: 'text', class: `fd-input fd-number-input ${way.className}`, autocomplete: 'off', inputmode: way.duration ? 'text' : numberKeyboard(limits()) });
  if (node.placeholder) input.placeholder = node.placeholder;
  const shown = (value: Value | undefined) => (typeof value === 'number' ? (Number.isFinite(value) ? way.show(value) : '') : value === null || value === undefined ? '' : String(value));
  // Inside the box after the value, as a number's unit is.
  const suffix = typeof node.options?.['suffix'] === 'string' && node.options['suffix'] ? node.options['suffix'] : way.unit;
  const unit = suffix ? make('span', { class: 'fd-unit', id: `${id}-unit2` }, suffix) : null;
  const element = unit ? make('span', { class: 'fd-number' }, input, unit) : input;
  if (unit) input.style.setProperty('padding-inline-end', `calc(var(--fd-pad-x) + ${suffix?.length ?? 0}ch + 4px)`);
  const box: NumberBox & { percent?: boolean } = { label: node.label ?? field.label, locale, labels, limits, duration: way.duration, percent: way.percent };
  const hint = refusalHint(input, element);
  const checks = guard(input, numberRules(box), hint);
  const unreadNow = () => form.getState().unread?.[name];
  let entered: Value | undefined;
  input.addEventListener('focus', () => (entered = form.getState().values[name]));
  input.addEventListener('input', () => {
    const value = way.parse(input.value);
    if (value === undefined) return;
    form.setValue(name, value);
    if (unreadNow()) form.setUnread(name, null);
  });
  input.addEventListener('blur', () => {
    if (input.readOnly) return;
    const text = input.value;
    const words = way.parse(text) === undefined ? (unreadWords(text, box) ?? fillIn(wordsFor(labels, locale).notANumber, { label: box.label, text: quoted(text) })) : null;
    if (words === null) {
      if (unreadNow()) form.setUnread(name, null);
      input.value = shown(form.getState().values[name]);
      return;
    }
    if (form.getState().values[name] !== entered) form.setValue(name, (entered ?? null) as Value);
    form.setUnread(name, { text, message: words });
  });
  return {
    element,
    focus: () => input.focus(),
    destroy: () => checks.destroy(),
    update(state: { value: Value | undefined; readonly: boolean; invalid: boolean; required: boolean; describedBy?: string }) {
      const typing = document.activeElement === input;
      const unread = unreadNow();
      if (typing) {
        const parsed = way.parse(input.value);
        if (parsed !== undefined && parsed !== (state.value ?? null)) {
          input.value = shown(state.value);
          checks.accept();
        }
      } else {
        const text = unread ? unread.text : shown(state.value);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      setAttr(input, 'aria-required', String(state.required));
      describeState(input, { ...state, invalid: state.invalid || (!!unread && !typing), describedBy: hint.describedBy([state.describedBy, unit?.id].filter(Boolean).join(' ')) });
    },
  };
}

/** Hours typed and shown as HH:MM. */
export const durationWidget: WidgetFactory = (context) => {
  const locale = context.locale ?? 'en';
  return shownBox(context, { show: formatDuration, parse: (text) => parseDuration(text, locale), className: 'fd-duration', duration: true });
};

/** A per cent typed: "25", "25%", "٢٥٪" (and the page's decimal mark); the fraction it is, 0.25. Null when emptied, undefined while it does not read. */
export function parsePercentage(raw: string, locale: Locale = 'en'): number | null | undefined {
  const read = readNumber(raw, locale, { percent: true });
  if (!read.ok) return undefined;
  return read.value === null ? null : Math.round((read.value / 100) * 1e10) / 1e10;
}

/** A fraction typed and shown as a per cent: 0.25 is "25", "%" after it. */
export const percentageWidget: WidgetFactory = (context) => {
  const locale = context.locale ?? 'en';
  const places = placesOf(context.field);
  return shownBox(context, {
    show: (value) => percentFormat(locale, places, 'decimal').format(Math.round(value * 100 * 10 ** places) / 10 ** places),
    parse: (text) => parsePercentage(text, locale),
    unit: '%',
    className: 'fd-percentage',
    percent: true,
    places,
  });
};

/** A duration's or a percentage's value as words, where it is not edited: a cell, a total, a read-only part. Null for any other widget. */
export function shownNumber(widget: string | undefined, field: Field, value: Value | undefined, locale: Locale, options: Record<string, unknown> = {}): string | null {
  if (typeof value !== 'number' || (widget !== 'duration' && widget !== 'percentage')) return null;
  const suffix = typeof options['suffix'] === 'string' && options['suffix'] ? ` ${options['suffix']}` : '';
  return widget === 'duration' ? formatDuration(value) + suffix : formatPercentage(value, locale, placesOf(field));
}
