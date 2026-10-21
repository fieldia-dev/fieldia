import type { Field, FieldNode, Form, FormState, Value } from '@fieldia/core';
import { maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { readRule, RuleBeyond, ruleWords, weekdayName, weekdayOf, WEEKDAYS, writeRule, type RepeatFrequency, type RepeatRule, type Weekday } from './repeat-rule';
import { installScheduleStyles } from './styles-schedule';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A repeat field (`"widget": "repeat"` on a char field): how often something comes back — a treatment course every
 * week on Tuesday and Thursday, a hearing every month on the first Monday, a check every 3 months — and when it ends,
 * on a day or after a number of times. The value is an iCalendar rule (RFC 5545's RRULE, `FREQ=WEEKLY;BYDAY=TU,TH;
 * COUNT=6`), which a calendar or a server reads as it is; it is said in words under the boxes, and at rest ("Every
 * week on Tuesday and Thursday, 6 times"). `options.startField` names the date it starts from: a new week's day, a
 * month's day, come from it.
 *
 * A rule it cannot change (an hour, a month's several days) is kept as it is and said so; nothing is written over
 * it until the person picks another. The numbers are Fieldia's number boxes and the end day its date box, with
 * their input rules: what does not read stays as typed, said, and a save is refused meanwhile.
 *
 * Each box is drawn by `widgetFor`, the main script's createWidget, as a property's row is: the part never imports
 * the registry. It comes in the schedule part (schedule-part.ts), with the date part beside it.
 */

const FREQUENCIES: readonly RepeatFrequency[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];
const today = () => new Date().toISOString().slice(0, 10);

export const repeatWidget = (widgetFor: (context: WidgetContext) => Widget): WidgetFactory => (context) => {
  const { form, name, node, id, document, labels, locale = 'en' } = context;
  installScheduleStyles(document);
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const startField = typeof node.options?.['startField'] === 'string' ? (node.options['startField'] as string) : undefined;
  /** The day it starts from: its start field's, else today. */
  const start = () => {
    const value = startField ? form.getState().values[startField] : null;
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : today();
  };
  /** The rule the field holds: null for none; `kept`, the words of one this box cannot change. */
  const held = (): { rule: RepeatRule | null; kept?: string } => {
    const value = form.getState().values[name];
    try {
      return { rule: readRule(typeof value === 'string' ? value : '') };
    } catch (error) {
      return { rule: null, kept: error instanceof RuleBeyond ? String(value) : String(value) };
    }
  };
  const write = (rule: RepeatRule | null) => form.setValue(name, rule ? writeRule(rule) : null);
  /** Read-only now: its choices show the rule, and nothing pressed changes it. */
  let locked = false;
  /** Changed in place, from the rule held — or, where none is, one starting today every week. */
  const change = (edit: (rule: RepeatRule) => void) => {
    const rule: RepeatRule = { ...(held().rule ?? { freq: 'WEEKLY', interval: 1 }) };
    edit(rule);
    write(rule);
  };

  const label = (text: string, control: HTMLElement) => make('label', { class: 'fd-repeat-part' }, make('span', { class: 'fd-repeat-name' }, text), control);
  const select = (text: string, options: [string, string][]) => make('select', { class: 'fd-input fd-select', 'aria-label': text }, ...options.map(([value, words]) => make('option', { value }, words)));

  // ---- how often ------------------------------------------------------------------------------------
  const kinds = words.repeatKinds.split('|');
  const how = select(words.repeatLabel, [['', words.repeatNever], ...FREQUENCIES.map((freq, i): [string, string] => [freq, kinds[i] ?? freq])]);
  how.id = id;
  how.addEventListener('change', () => {
    const freq = how.value as RepeatFrequency | '';
    if (!freq) return write(null);
    const was = held().rule;
    const from = start();
    // A week's day and a month's day come from the day it starts.
    const rule: RepeatRule = { freq, interval: 1, ...(was?.count !== undefined ? { count: was.count } : {}), ...(was?.until ? { until: was.until } : {}) };
    if (freq === 'WEEKLY') rule.days = was?.freq === 'WEEKLY' && was.days?.length ? was.days : [weekdayOf(from)];
    if (freq === 'MONTHLY') rule.monthDay = Number(from.slice(8, 10));
    write(rule);
  });

  // The numbers and the end day: Fieldia's own boxes, on the rule's parts as a record of their own.
  const pathOf = (part: string) => `${name}.${part}`;
  const own = <T>(kept: Readonly<Record<string, T>> | undefined): Record<string, T> => {
    const found: Record<string, T> = {};
    for (const [path, item] of Object.entries(kept ?? {})) if (path.startsWith(`${name}.`)) found[path.slice(name.length + 1)] = item;
    return found;
  };
  const partsNow = (): Record<string, Value> => {
    const rule = held().rule;
    return { interval: rule?.interval ?? 1, count: rule?.count ?? null, until: rule?.until ?? null };
  };
  /** A number refused, by its part: kept unread with why, whatever its box says of it after (it reads it as a number). */
  const refused = new Map<string, { text: string; message: string }>();
  const parts: Form = {
    ...form,
    getState: (): FormState => {
      const state = form.getState();
      return { ...state, values: partsNow(), unread: own(state.unread), errors: own(state.errors) };
    },
    setValue: (part: string, value: Value) => {
      // Every how many, and how many times: a whole number, 1 or more; else kept as typed, said, and never written.
      if ((part === 'interval' || part === 'count') && value !== null && (typeof value !== 'number' || value < 1 || !Number.isInteger(value))) {
        const unread = { text: String(value), message: words.repeatAtLeastOne };
        refused.set(part, unread);
        form.setUnread(pathOf(part), unread);
        return;
      }
      refused.delete(part);
      form.setUnread(pathOf(part), null);
      change((rule) => {
        if (part === 'interval') rule.interval = (value as number | null) ?? 1;
        if (part === 'count') {
          delete rule.until;
          if (value === null) delete rule.count;
          else rule.count = value as number;
        }
        if (part === 'until') {
          delete rule.count;
          if (typeof value === 'string' && value) rule.until = value.slice(0, 10);
          else delete rule.until;
        }
      });
    },
    setUnread: (part, unread) => {
      if (!unread && refused.has(part)) return;
      refused.delete(part);
      form.setUnread(pathOf(part), unread);
    },
    boxLeft: (part) => form.boxLeft(pathOf(part)),
  };
  const box = (part: string, field: Field) =>
    widgetFor({ ...context, form: parts, name: part, field, node: { type: 'field', id: `${node.id}.${part}`, field: part } as FieldNode, id: `${id}-${part}` });
  const every = box('interval', { type: 'integer', label: words.repeatEveryLabel });
  const unit = make('span', { class: 'fd-repeat-unit' });
  const everyPart = make('span', { class: 'fd-repeat-every' }, make('label', { class: 'fd-repeat-name', for: `${id}-interval` }, words.repeatEveryLabel), every.element, unit);

  // ---- which days: a week's, toggled; a month's, by its number or a weekday's place ----------------------
  const dayButtons = WEEKDAYS.map((day) => {
    const button = make('button', { type: 'button', class: 'fd-repeat-day', 'aria-pressed': 'false', 'aria-label': weekdayName(day, locale), 'data-day': day }, weekdayName(day, locale, 'short'));
    button.addEventListener('click', () =>
      !locked && change((rule) => {
        const on = new Set(rule.days ?? []);
        if (on.has(day)) on.delete(day);
        else on.add(day);
        rule.days = WEEKDAYS.filter((one) => on.has(one));
      })
    );
    return button;
  });
  const days = make('div', { class: 'fd-repeat-days', role: 'group', 'aria-label': words.repeatOnDays }, ...dayButtons);
  const monthHow = words.repeatMonthHow.split('|');
  const monthWay = select(words.repeatOnDays, [['day', monthHow[0] ?? ''], ['last', monthHow[1] ?? ''], ['nth', monthHow[2] ?? '']]);
  const monthDay = select(words.repeatMonthDay, Array.from({ length: 31 }, (_, i): [string, string] => [String(i + 1), String(i + 1)]));
  const nthWords = words.repeatNth.split('|');
  const nth = select(monthHow[2] ?? '', [1, 2, 3, 4, -1].map((n, i): [string, string] => [String(n), nthWords[i] ?? String(n)]));
  const weekday = select(words.repeatWeekday, WEEKDAYS.map((day): [string, string] => [day, weekdayName(day, locale)]));
  const month = make('div', { class: 'fd-repeat-month' }, monthWay, monthDay, nth, weekday);
  monthWay.addEventListener('change', () =>
    change((rule) => {
      const from = start();
      delete rule.nth;
      delete rule.monthDay;
      if (monthWay.value === 'last') rule.monthDay = -1;
      else if (monthWay.value === 'day') rule.monthDay = Number(from.slice(8, 10));
      // The weekday it starts on, in the place it has in its month: its last where it is past the fourth.
      else rule.nth = { n: Math.ceil(Number(from.slice(8, 10)) / 7) > 4 ? -1 : Math.ceil(Number(from.slice(8, 10)) / 7), day: weekdayOf(from) };
    })
  );
  monthDay.addEventListener('change', () => change((rule) => ((rule.monthDay = Number(monthDay.value)), delete rule.nth)));
  const placed = () => change((rule) => ((rule.nth = { n: Number(nth.value), day: weekday.value as Weekday }), delete rule.monthDay));
  nth.addEventListener('change', placed);
  weekday.addEventListener('change', placed);

  // ---- when it ends ---------------------------------------------------------------------------------
  const endWords = words.repeatEnds.split('|');
  const ends = select(words.repeatEndsLabel, [['never', endWords[0] ?? ''], ['until', endWords[1] ?? ''], ['count', endWords[2] ?? '']]);
  ends.addEventListener('change', () =>
    change((rule) => {
      delete rule.count;
      delete rule.until;
      // A day a few weeks on, or a few times: something to change, never an end already gone by.
      if (ends.value === 'count') rule.count = 6;
      if (ends.value === 'until') rule.until = new Date(Date.parse(`${start()}T00:00:00Z`) + 90 * 86400000).toISOString().slice(0, 10);
    })
  );
  const until = box('until', { type: 'date', label: words.repeatUntilDay });
  const count = box('count', { type: 'integer', label: words.repeatCount });
  const timesWord = make('span', { class: 'fd-repeat-unit' }, words.repeatCount);
  const untilPart = make('span', { class: 'fd-repeat-end-part' }, until.element);
  const countPart = make('span', { class: 'fd-repeat-end-part fd-repeat-count' }, count.element, timesWord);
  const endsPart = make('div', { class: 'fd-repeat-ends' }, label(words.repeatEndsLabel, ends), untilPart, countPart);

  // ---- in words ------------------------------------------------------------------------------------
  const said = make('p', { class: 'fd-repeat-words', id: `${id}-words` });
  const problems = make('div', { class: 'fd-error fd-repeat-error', id: `${id}-error`, hidden: '' });
  const head = make('div', { class: 'fd-repeat-head' }, how, everyPart);
  const element = make('div', { class: 'fd-repeat', role: 'group', 'aria-labelledby': `${id}-label`, 'aria-describedby': said.id }, head, days, month, endsPart, said, problems);

  return {
    element,
    focus: () => how.focus(),
    destroy: () => [every, until, count].forEach((widget) => widget.destroy?.()),
    update(state) {
      // A number refused on a record no longer shown, or let go by the form (Discard): refused no more.
      for (const part of [...refused.keys()]) if (!form.getState().unread[pathOf(part)]) refused.delete(part);
      const { rule, kept } = held();
      locked = state.readonly;
      how.value = rule?.freq ?? '';
      setAttr(how, 'aria-invalid', String(state.invalid));
      for (const control of [how, monthWay, monthDay, nth, weekday, ends]) control.disabled = locked;
      for (const button of dayButtons) setAttr(button, 'aria-disabled', locked ? 'true' : null);
      // What shows follows the rule: a week's days, a month's day, how it ends — hidden, never disabled, where it has none.
      setHidden(everyPart, !rule);
      setHidden(days, rule?.freq !== 'WEEKLY');
      setHidden(month, rule?.freq !== 'MONTHLY');
      setHidden(endsPart, !rule);
      if (rule) {
        const at = FREQUENCIES.indexOf(rule.freq);
        setText(unit, (rule.interval === 1 ? words.repeatUnits : words.repeatUnitsMany).split('|')[at] ?? '');
        for (const button of dayButtons) setAttr(button, 'aria-pressed', String(!!rule.days?.includes(button.dataset['day'] as Weekday)));
        monthWay.value = rule.nth ? 'nth' : rule.monthDay === -1 ? 'last' : 'day';
        monthDay.value = String(rule.monthDay && rule.monthDay > 0 ? rule.monthDay : Number(start().slice(8, 10)));
        setHidden(monthDay, monthWay.value !== 'day');
        setHidden(nth, monthWay.value !== 'nth');
        setHidden(weekday, monthWay.value !== 'nth');
        if (rule.nth) {
          nth.value = String(rule.nth.n);
          weekday.value = rule.nth.day;
        }
        ends.value = rule.count !== undefined ? 'count' : rule.until ? 'until' : 'never';
        setHidden(untilPart, ends.value !== 'until');
        setHidden(countPart, ends.value !== 'count');
      }
      const inner = parts.getState();
      const errors = inner.errors;
      for (const [part, widget] of [['interval', every], ['until', until], ['count', count]] as const) {
        const unread = inner.unread[part];
        widget.update({ value: inner.values[part], values: inner.values, readonly: locked, required: false, invalid: !!(unread || errors[part]) });
      }
      const wrong = Object.values(inner.unread).map((one) => one.message)[0] ?? Object.values(errors)[0] ?? '';
      setText(problems, wrong);
      setHidden(problems, !wrong);
      setText(said, kept !== undefined ? words.repeatKept.replace('{rule}', kept) : rule ? ruleWords(rule, locale, words) : words.repeatNever);
    },
  };
};
