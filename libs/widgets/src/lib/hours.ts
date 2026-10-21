import type { Field, FieldNode, Form, FormState, JsonValue, Locale, Value } from '@fieldia/core';
import { fillIn, maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import type { WidgetLabels } from './labels';
import { weekdayName, WEEKDAYS } from './repeat-rule';
import { installScheduleStyles } from './styles-schedule';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A week's opening hours (`"widget": "hours"` on a json field): a row a weekday, each open or closed, its shifts from
 * and to — a break between two — "Add a break" splitting the last, a shift removed, and a day's hours copied to every
 * day. The value is what a booking schedule reads (`MemorySchedule.hours`, the slots a booking is offered): by the
 * ISO weekday, 1 Monday … 7 Sunday, each day's shifts as `["09:00", "13:00"]` in order; a day not named is closed.
 *
 *   { "1": [["09:00", "13:00"], ["14:00", "18:00"]], "2": [["09:00", "18:00"]], "6": [["10:00", "14:00"]] }
 *
 * The times are Fieldia's time boxes, with their input rules; a shift that ends before it starts, or overlaps
 * another, is said under its day and the field refuses a save until it is put right — the times stay as typed. The
 * week starts on the page's `options.weekStart` (1 Monday … 7 Sunday), Monday unless it says. At rest, in words:
 * "Mon–Fri 09:00–13:00, 14:00–18:00 · Sat 10:00–14:00 · Sun closed".
 *
 * Each time box is drawn by `widgetFor`, the main script's createWidget, as a property's row is. It comes in the
 * schedule part (schedule-part.ts), with the date part beside it.
 */

export type Shift = [string, string];
/** A week's hours by ISO weekday ("1" Monday … "7" Sunday): a day not named is closed. */
export type WeekHours = Partial<Record<string, Shift[]>>;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
const timeOf = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** A field's value read as a week's hours: only days 1 to 7, each a list of [from, to] pairs. */
export function weekHours(value: unknown): WeekHours {
  const out: WeekHours = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (let day = 1; day <= 7; day++) {
    const shifts = (value as Record<string, unknown>)[String(day)];
    if (!Array.isArray(shifts) || !shifts.length) continue;
    out[String(day)] = shifts.filter((one): one is Shift => Array.isArray(one) && one.length === 2).map(([from, to]) => [String(from ?? ''), String(to ?? '')]);
  }
  return out;
}

/** What is wrong with a day's shifts: one with no start or end, one ending before it starts, two that overlap. */
export function shiftProblem(shifts: readonly Shift[], day: string, words: WidgetLabels): string | null {
  for (const [from, to] of shifts) {
    if (!TIME.test(from) || !TIME.test(to)) return fillIn(words.hoursNoTime, { day });
    if (minutes(to) <= minutes(from)) return fillIn(words.hoursEndsFirst, { day, from, to });
  }
  const sorted = [...shifts].sort((a, b) => minutes(a[0]) - minutes(b[0]));
  for (let i = 1; i < sorted.length; i++) {
    if (minutes(sorted[i][0]) < minutes(sorted[i - 1][1])) return fillIn(words.hoursOverlap, { day, one: sorted[i - 1].join('–'), other: sorted[i].join('–') });
  }
  return null;
}

/** The days in the order the week shows them, from `start` (1 Monday … 7 Sunday). */
const weekFrom = (start: number) => Array.from({ length: 7 }, (_, i) => ((start - 1 + i) % 7) + 1);

/**
 * A week's hours in words, days in a row with the same hours together: "Mon–Fri 09:00–13:00, 14:00–18:00 · Sat
 * 10:00–14:00 · Sun closed"; "Closed every day" with none.
 */
export function hoursWords(value: unknown, locale: Locale, words: WidgetLabels, start = 1): string {
  const week = weekHours(value);
  const days = weekFrom(start);
  if (!days.some((day) => week[String(day)]?.length)) return words.hoursAllClosed;
  const said = (day: number) => week[String(day)]?.map((shift) => shift.join('–')).join(', ') ?? words.hoursClosed.toLowerCase();
  const name = (day: number) => weekdayName(WEEKDAYS[day - 1], locale, 'short');
  const runs: { first: number; last: number; words: string }[] = [];
  for (const day of days) {
    const last = runs[runs.length - 1];
    if (last && last.words === said(day)) last.last = day;
    else runs.push({ first: day, last: day, words: said(day) });
  }
  return runs.map((run) => `${run.first === run.last ? name(run.first) : fillIn(words.hoursDays, { first: name(run.first), last: name(run.last) })} ${run.words}`).join(' · ');
}

export const hoursWidget = (widgetFor: (context: WidgetContext) => Widget): WidgetFactory => (context) => {
  const { form, name, node, id, document, labels, locale = 'en' } = context;
  installScheduleStyles(document);
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const start = Number(node.options?.['weekStart'] ?? 1);
  const days = weekFrom(start >= 1 && start <= 7 ? start : 1);
  const current = () => weekHours(form.getState().values[name]);
  const write = (week: WeekHours) => {
    const out: Record<string, JsonValue> = {};
    for (let day = 1; day <= 7; day++) if (week[String(day)]?.length) out[String(day)] = week[String(day)] as JsonValue;
    form.setValue(name, out);
  };
  const dayName = (day: number) => weekdayName(WEEKDAYS[day - 1], locale);

  // Each time box sees the week as a record of its own, by `day-shift-from` / `day-shift-to`, and writes into it.
  const pathOf = (part: string) => `${name}.${part}`;
  const own = <T>(kept: Readonly<Record<string, T>> | undefined): Record<string, T> => {
    const found: Record<string, T> = {};
    for (const [path, item] of Object.entries(kept ?? {})) if (path.startsWith(`${name}.`)) found[path.slice(name.length + 1)] = item;
    return found;
  };
  const flat = (): Record<string, Value> => {
    const out: Record<string, Value> = {};
    for (const [day, shifts] of Object.entries(current())) shifts?.forEach(([from, to], i) => ((out[`${day}-${i}-from`] = from || null), (out[`${day}-${i}-to`] = to || null)));
    return out;
  };
  const times: Form = {
    ...form,
    getState: (): FormState => {
      const state = form.getState();
      return { ...state, values: flat(), unread: own(state.unread), errors: own(state.errors) };
    },
    setValue: (part: string, value: Value) => {
      const [day, at, end] = part.split('-');
      const week = current();
      const shifts = [...(week[day] ?? [])];
      const shift: Shift = [...(shifts[Number(at)] ?? ['', ''])] as Shift;
      shift[end === 'from' ? 0 : 1] = typeof value === 'string' ? value.slice(0, 5) : '';
      shifts[Number(at)] = shift;
      write({ ...week, [day]: shifts });
    },
    setUnread: (part, unread) => form.setUnread(pathOf(part), unread),
    boxLeft: (part) => form.boxLeft(pathOf(part)),
  };

  const announce = make('div', { class: 'fd-sr-only', role: 'status', 'aria-live': 'polite' });
  const said = make('p', { class: 'fd-hours-words', id: `${id}-words` });
  const rows = days.map((day) => {
    const open = make('input', { type: 'checkbox', class: 'fd-checkbox', 'aria-label': fillIn(words.hoursOpenOn, { day: dayName(day) }) });
    open.addEventListener('change', () => {
      const week = current();
      // Opened: the hours of the nearest open day before it, else nine to five.
      const before = days.slice(0, days.indexOf(day)).reverse().find((other) => week[String(other)]?.length);
      write({ ...week, [String(day)]: open.checked ? [...(before ? (week[String(before)] as Shift[]) : [['09:00', '17:00'] as Shift])] : [] });
    });
    const shifts = make('div', { class: 'fd-hours-shifts' });
    const closed = make('span', { class: 'fd-hours-closed' }, words.hoursClosed);
    const addBreak = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.hoursAddBreak);
    addBreak.addEventListener('click', () => {
      const week = current();
      const list = [...(week[String(day)] ?? [])];
      const [from, to] = list[list.length - 1] ?? ['09:00', '17:00'];
      // The last shift split at its middle, an hour's break between, on the quarter hour.
      const middle = Math.round((minutes(from) + minutes(to)) / 2 / 15) * 15;
      list.splice(list.length - 1, 1, [from, timeOf(middle - 30)], [timeOf(middle + 30), to]);
      write({ ...week, [String(day)]: list });
    });
    const copy = make('button', { type: 'button', class: 'fd-button fd-button-link' }, words.hoursCopyAll);
    copy.addEventListener('click', () => {
      const week = current();
      const these = week[String(day)] ?? [];
      write(Object.fromEntries(days.map((other) => [String(other), these.map((shift) => [...shift] as Shift)])));
      announce.textContent = fillIn(words.hoursCopied, { day: dayName(day) });
    });
    const tools = make('div', { class: 'fd-hours-tools' }, addBreak, copy);
    const error = make('div', { class: 'fd-error fd-hours-error', id: `${id}-${day}-error`, hidden: '' });
    const element = make(
      'div',
      { class: 'fd-hours-day', role: 'group', 'aria-label': dayName(day), 'data-day': String(day) },
      make('span', { class: 'fd-hours-name', 'aria-hidden': 'true' }, dayName(day)),
      make('label', { class: 'fd-hours-open' }, open, make('span', {}, words.hoursOpen)),
      make('div', { class: 'fd-hours-times' }, closed, shifts, tools),
      error
    );
    return { day, open, shifts, closed, addBreak, copy, tools, error, element, boxes: [] as { key: string; widget: Widget; remove: HTMLButtonElement; line: HTMLElement }[], drawn: -1 };
  });

  /** A day's shifts drawn again only when how many it has changed: a box being typed in is never taken away. */
  function drawShifts(row: (typeof rows)[number], count: number) {
    for (const box of row.boxes) box.widget.destroy?.();
    row.boxes = [];
    const lines: HTMLElement[] = [];
    for (let i = 0; i < count; i++) {
      const pair = (['from', 'to'] as const).map((end) => {
        const key = `${row.day}-${i}-${end}`;
        const field: Field = { type: 'char', label: fillIn(end === 'from' ? words.hoursOpens : words.hoursCloses, { day: dayName(row.day) }) };
        const widget = widgetFor({ ...context, form: times, name: key, field, node: { type: 'field', id: `${node.id}.${key}`, field: key, widget: 'time' } as FieldNode, id: `${id}-${key}` });
        // Named by its day and end: the box itself, or the input in it.
        (widget.element.matches('input') ? widget.element : widget.element.querySelector('input'))?.setAttribute('aria-label', field.label);
        return { key, widget };
      });
      const remove = make('button', { type: 'button', class: 'fd-alert-close fd-hours-remove' }, '×');
      remove.addEventListener('click', () => {
        const week = current();
        const list = (week[String(row.day)] ?? []).filter((_, at) => at !== i);
        write({ ...week, [String(row.day)]: list });
      });
      const line = make('div', { class: 'fd-hours-shift' }, pair[0].widget.element, make('span', { 'aria-hidden': 'true' }, '–'), pair[1].widget.element, remove);
      lines.push(line);
      for (const one of pair) row.boxes.push({ ...one, remove, line });
    }
    row.shifts.replaceChildren(...lines);
    row.drawn = count;
  }

  const element = make('div', { class: 'fd-hours', role: 'group', 'aria-labelledby': `${id}-label`, 'aria-describedby': said.id }, said, ...rows.map((row) => row.element), announce);
  // The field's label points at its first box: the first day's switch.
  if (rows[0]) rows[0].open.id = id;

  return {
    element,
    focus: () => rows[0]?.open.focus(),
    destroy: () => rows.forEach((row) => row.boxes.forEach((box) => box.widget.destroy?.())),
    update(state) {
      const week = current();
      const inner = times.getState();
      const locked = state.readonly;
      setText(said, hoursWords(week, locale, words, days[0]));
      for (const row of rows) {
        const shifts = week[String(row.day)] ?? [];
        row.open.checked = shifts.length > 0;
        row.open.disabled = locked;
        if (row.drawn !== shifts.length) drawShifts(row, shifts.length);
        setHidden(row.closed, shifts.length > 0);
        setHidden(row.shifts, !shifts.length);
        // What a day may do is shown only where it can: a break where its last shift is an hour or more, copying where it is open.
        const last = shifts[shifts.length - 1];
        setHidden(row.addBreak, locked || !last || !TIME.test(last[0]) || !TIME.test(last[1]) || minutes(last[1]) - minutes(last[0]) < 90);
        setHidden(row.copy, locked || !shifts.length);
        setHidden(row.tools, row.addBreak.hidden && row.copy.hidden);
        const problem = shiftProblem(shifts, weekdayName(WEEKDAYS[row.day - 1], locale), words);
        // Its own words where it has none: a box's text that does not read.
        const typed = row.boxes.map((box) => inner.unread[box.key]?.message).find(Boolean);
        const message = typed ?? problem ?? '';
        setText(row.error, message);
        setHidden(row.error, !message);
        // A day that is wrong keeps the field from being saved, as text that does not read does: told once this update
        // is done, never from inside the form's own telling.
        const marked = form.getState().unread[pathOf(`day-${row.day}`)]?.message ?? null;
        const shown = form.recordShown();
        if (marked !== problem) queueMicrotask(() => shown() && form.setUnread(pathOf(`day-${row.day}`), problem ? { text: '', message: problem } : null));
        row.boxes.forEach((box, at) => {
          const value = inner.values[box.key] ?? null;
          box.widget.update({ value, values: inner.values, readonly: locked, required: true, invalid: !!inner.unread[box.key] || !!problem, ...(message ? { describedBy: row.error.id } : {}) });
          // A day's one shift goes with Open unticked, never ×.
          setHidden(box.remove, locked || shifts.length < 2);
          setAttr(box.remove, 'aria-label', fillIn(words.hoursRemove, { from: shifts[Math.floor(at / 2)]?.[0] ?? '', to: shifts[Math.floor(at / 2)]?.[1] ?? '' }));
        });
      }
    },
  };
};
