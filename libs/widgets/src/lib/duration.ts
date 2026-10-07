import type { Field, Locale, Value } from '@fieldia/core';
import { normalizeNumber } from './numbers';
import { describeState, maker, setAttr } from './kind-parts';
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
 * What was typed as hours: "6:30", "06:30" or "6.5" (in the page's language,
 * "6,5"). Null when emptied; undefined while it is still being typed ("6:");
 * the text itself when it is no time, for the form to say so.
 */
export function parseDuration(raw: string, locale: Locale = 'en'): Value | undefined {
  const text = normalizeNumber(raw.trim(), locale);
  if (text === '') return null;
  const time = /^(-?)(\d+):(\d{1,2})$/.exec(text);
  if (time) {
    const minutes = Number(time[3]);
    if (minutes > 59) return raw.trim();
    const hours = Number(time[2]) + minutes / 60;
    return time[1] ? -hours : hours;
  }
  if (/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return Number(text);
  if (/^-?(\d+:?)?\.?$/.test(text)) return undefined;
  return raw.trim();
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

/** A box whose value is shown and typed in its own way, with words after it inside the box. */
function shownBox(context: WidgetContext, way: { show(value: number): string; parse(text: string): Value | undefined; unit?: string; inputMode: string; className: string }) {
  const { form, name, node, id, document } = context;
  const make = maker(document);
  const input = make('input', { id, type: 'text', class: `fd-input fd-number-input ${way.className}`, autocomplete: 'off', inputmode: way.inputMode });
  if (node.placeholder) input.placeholder = node.placeholder;
  const shown = (value: Value | undefined) => (typeof value === 'number' ? way.show(value) : value === null || value === undefined ? '' : String(value));
  input.addEventListener('input', () => {
    const value = way.parse(input.value);
    if (value !== undefined) form.setValue(name, value);
  });
  input.addEventListener('blur', () => {
    input.value = shown(form.getState().values[name]);
  });
  // Inside the box after the value, as a number's unit is.
  const suffix = typeof node.options?.['suffix'] === 'string' && node.options['suffix'] ? node.options['suffix'] : way.unit;
  const unit = suffix ? make('span', { class: 'fd-unit', id: `${id}-unit2` }, suffix) : null;
  const element = unit ? make('span', { class: 'fd-number' }, input, unit) : input;
  if (unit) input.style.setProperty('padding-inline-end', `calc(var(--fd-pad-x) + ${suffix?.length ?? 0}ch + 4px)`);
  return {
    element,
    focus: () => input.focus(),
    update(state: { value: Value | undefined; readonly: boolean; invalid: boolean; required: boolean; describedBy?: string }) {
      const typing = document.activeElement === input;
      const parsed = way.parse(input.value);
      if (!(typing && (parsed === undefined || parsed === state.value))) {
        const text = shown(state.value);
        if (input.value !== text) input.value = text;
      }
      if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
      setAttr(input, 'aria-required', String(state.required));
      describeState(input, { ...state, describedBy: [state.describedBy, unit?.id].filter(Boolean).join(' ') });
    },
  };
}

/** Hours typed and shown as HH:MM. */
export const durationWidget: WidgetFactory = (context) => {
  const locale = context.locale ?? 'en';
  return shownBox(context, { show: formatDuration, parse: (text) => parseDuration(text, locale), inputMode: 'text', className: 'fd-duration' });
};

/** A fraction typed and shown as a per cent: 0.25 is "25", "%" after it. */
export const percentageWidget: WidgetFactory = (context) => {
  const locale = context.locale ?? 'en';
  const places = placesOf(context.field);
  return shownBox(context, {
    show: (value) => percentFormat(locale, places, 'decimal').format(Math.round(value * 100 * 10 ** places) / 10 ** places),
    parse(raw) {
      const text = normalizeNumber(raw.trim(), locale).replace(/%$/, '');
      if (text === '') return null;
      if (/^-?(\d+\.?\d*|\.\d+)$/.test(text)) return Math.round((Number(text) / 100) * 1e10) / 1e10;
      if (/^-?\.?$/.test(text)) return undefined;
      return raw.trim();
    },
    unit: '%',
    inputMode: 'decimal',
    className: 'fd-percentage',
  });
};

/** A duration's or a percentage's value as words, where it is not edited: a cell, a total, a read-only part. Null for any other widget. */
export function shownNumber(widget: string | undefined, field: Field, value: Value | undefined, locale: Locale, options: Record<string, unknown> = {}): string | null {
  if (typeof value !== 'number' || (widget !== 'duration' && widget !== 'percentage')) return null;
  const suffix = typeof options['suffix'] === 'string' && options['suffix'] ? ` ${options['suffix']}` : '';
  return widget === 'duration' ? formatDuration(value) + suffix : formatPercentage(value, locale, placesOf(field));
}
