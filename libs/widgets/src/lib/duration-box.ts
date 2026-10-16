import type { NumberLimits, Value } from '@fieldia/core';
import { describeState, fillIn, maker, setAttr, wordsFor } from './kind-parts';
import { guard, leftWords, numberFits, numberKeyboard, numberRules, quoted, refusalHint, unreadWords, type NumberBox } from './input-rules';
import { formatDuration, parseDuration, parsePercentage, percentFormat, percentPlaces } from './duration';
import type { WidgetContext, WidgetFactory } from './widgets';

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
    const parsed = way.parse(text);
    const unreadable = parsed === undefined ? (unreadWords(text, box) ?? fillIn(wordsFor(labels, locale).notANumber, { label: box.label, text: quoted(text) })) : null;
    // A value the box held as it was entered (one from outside with more places) is let be: check names it.
    const words = unreadable ?? (!held && parsed === (entered ?? null) ? null : leftWords(text, box));
    if (words === null) {
      if (unreadNow()) form.setUnread(name, null);
      // What reads and fits is the field's, as typed ("-3" held after its refused minus): check says its least and most.
      if (parsed !== undefined && parsed !== (form.getState().values[name] ?? null)) form.setValue(name, parsed);
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

/** Hours typed and shown as HH:MM. */
export const durationWidget: WidgetFactory = (context) => {
  const locale = context.locale ?? 'en';
  return shownBox(context, { show: formatDuration, parse: (text) => parseDuration(text, locale), className: 'fd-duration', duration: true });
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
