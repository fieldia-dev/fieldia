import type { NumberLimits, Value } from '@fieldia/core';
import { boxPurpose, describeState, fillIn, maker, setAttr, typeInto, wordsFor } from './kind-parts';
import { guard, leftWords, numberFits, numberKeyboard, numberRules, quoted, refusalHint, unreadWords, type NumberBox } from './input-rules';
import { decimalHours, formatDuration, hoursKept, parseDuration, parsePercentage, percentFormat, percentPlaces } from './duration';
import type { TypedText, WidgetContext, WidgetFactory } from './widgets';

/**
 * The boxes hours and a per cent are typed in, as they are shown — hours as
 * HH:MM (Flectra's float_time, `duration`), a fraction as a per cent
 * (Flectra's `percentage`) — each kept as the number. Options: `suffix`,
 * words inside the box after the value ("hours"). In the business part
 * (business-part.ts); how they are written is the main script's
 * (duration.ts), as a cell and a total write them too.
 */

/**
 * A box whose value is shown and typed in its own way, with words after it inside the box. The input rules
 * guard it as a number box (`duration` takes a colon and an h too); text left that does not read stays, marked,
 * and the field keeps what it held as the box was entered.
 */
function shownBox(
  context: WidgetContext,
  way: {
    show(value: number): string;
    parse(text: string): number | null | undefined;
    /** What is said of text read (its reading named), under the box once it is read. */
    said?(text: string, value: number | null): string | null;
    unit?: string;
    className: string;
    percent?: boolean;
    duration?: boolean;
    places?: number;
  }
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
  const input = make('input', { id, type: 'text', class: `fd-input fd-number-input ${way.className}`, ...boxPurpose(node, { autocomplete: 'off', inputmode: way.duration ? 'text' : numberKeyboard(limits()) }) });
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
  /**
   * The text the box showed for the value as it was entered: shown rounded — hours to the minute, a per cent to its
   * places — it is never read back as the value. Nothing typed, or typed back to it, the value stays as it came.
   */
  let enteredText: string | null = null;
  input.addEventListener('focus', () => {
    entered = form.getState().values[name];
    enteredText = input.value;
  });
  input.addEventListener('input', () => {
    // Written while the person is elsewhere (the browser's autofill): what the field held as it came is kept should it not read.
    if (document.activeElement !== input) {
      entered = form.getState().values[name];
      enteredText = null;
    }
    if (input.value === enteredText) {
      if ((form.getState().values[name] ?? null) !== (entered ?? null)) form.setValue(name, (entered ?? null) as Value);
      if (unreadNow()) form.setUnread(name, null);
      return;
    }
    const value = way.parse(input.value);
    // Not yet, or not as it stands ("25.555" in a box of two places, on its way to "25.555,5"): left, it is said.
    if (value === undefined || (!way.duration && !numberFits(input.value, box))) return;
    form.setValue(name, value);
    if (unreadNow()) form.setUnread(name, null);
  });
  /** What is typed, read as the box is left or as a save reads it first (a change), never a value passed on the way. True when taken. */
  const read = (): boolean => {
    // Keys held after a refused one are part of what was typed: the box's now, and the field's own words take over from the hint.
    const held = checks.held();
    if (held) {
      hint.hide();
      input.value = held.text;
      checks.accept();
    }
    const text = input.value;
    // Passed through, nothing typed: the value stays as it came, never the rounded picture of it read back.
    if (!held && text === enteredText && !unreadNow()) return true;
    const parsed = way.parse(text);
    const unreadable = parsed === undefined ? (unreadWords(text, box) ?? fillIn(wordsFor(labels, locale).notANumber, { label: box.label, text: quoted(text) })) : null;
    // A value the box held as it was entered (one from outside with more places) is let be: check names it.
    const words = unreadable ?? (!held && parsed === (entered ?? null) ? null : leftWords(text, box));
    if (words === null) {
      if (unreadNow()) form.setUnread(name, null);
      // What reads and fits is the field's, as typed ("-3" held after its refused minus): check says its least and most.
      if (parsed !== undefined && parsed !== (form.getState().values[name] ?? null)) form.setValue(name, parsed);
      // Hours written with a point and two digits are hours with a decimal, as Flectra reads them: "6.45" is 06:27,
      // never 06:45. Said once the box is read, never taken so in silence.
      const said = way.said?.(text, parsed ?? null);
      if (said) hint.show(said);
      return true;
    }
    if (form.getState().values[name] !== entered) form.setValue(name, (entered ?? null) as Value);
    form.setUnread(name, { text, message: words });
    return false;
  };
  input.addEventListener('change', () => !input.readOnly && read());
  input.addEventListener('blur', () => {
    if (input.readOnly) return;
    if (read()) input.value = shown(form.getState().values[name]);
    enteredText = null;
  });
  return {
    element,
    focus: () => input.focus(),
    destroy: () => checks.destroy(),
    // What was typed in the plain box before this one came: this box's own, as typed, never the value made of it.
    takeTyped: (typed: TypedText) => {
      typeInto(input, typed, () => {
        entered = typed.entered;
        enteredText = shown(typed.entered);
        checks.accept();
      });
      return true;
    },
    update(state: { value: Value | undefined; readonly: boolean; invalid: boolean; required: boolean; describedBy?: string }) {
      const typing = document.activeElement === input;
      const unread = unreadNow();
      if (typing) {
        const parsed = way.parse(input.value);
        if (parsed !== undefined && (way.duration || numberFits(input.value, box)) && parsed !== (state.value ?? null)) {
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

/** Hours typed and shown as HH:MM; typed, kept to the field's places when it has them (`hoursKept`). */
export const durationWidget: WidgetFactory = (context) => {
  const { field, node, labels, locale = 'en' } = context;
  return shownBox(context, {
    show: formatDuration,
    parse: (text) => hoursKept(parseDuration(text, locale), field),
    said: (text, value) => (value !== null && decimalHours(text) ? fillIn(wordsFor(labels, locale).hoursDecimal, { label: node.label ?? field.label, text: quoted(text.trim()), time: formatDuration(value) }) : null),
    className: 'fd-duration',
    duration: true,
  });
};

/** A fraction typed and shown as a per cent: 0.25 is "25", "%" after it. */
export const percentageWidget: WidgetFactory = (context) => {
  const locale = context.locale ?? 'en';
  const places = percentPlaces(context.field);
  return shownBox(context, {
    show: (value) => percentFormat(locale, places, 'decimal').format(Math.round(value * 100 * 10 ** places) / 10 ** places),
    parse: (text) => parsePercentage(text, locale),
    unit: '%',
    className: 'fd-percentage',
    percent: true,
    places,
  });
};
