import type { Locale, Value } from '@fieldia/core';
import { describeState, maker, rightToLeft, setAttr, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * A range of dates in one box, from → to: Flectra's widget="daterange". The
 * node's field is the first day, `options.endField` the last; each is typed in
 * its own date box, or the range is picked on a calendar — the first day, then
 * the last, put the right way round if picked the other way. A date and
 * time keeps its hours when its day is picked. The calendar is the ARIA date
 * picker: arrows by day and week, mirrored right to left, PageUp and PageDown
 * by month, Enter to pick, Escape to close.
 */

const pad = (n: number) => String(n).padStart(2, '0');
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate()));
const sameDay = (a: Date | null, b: Date | null) => !!a && !!b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const CALENDAR = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="1.5"></rect><path d="M2 6.5h12M5 1.5v3M11 1.5v3"></path></svg>';
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const dateRangeWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale = 'en' as Locale }) => {
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const kind = field.type === 'datetime' ? 'datetime' : 'date';
  const endName = typeof node.options?.['endField'] === 'string' ? (node.options['endField'] as string) : null;
  const endLabel = endName ? (form.page.fields[endName]?.label ?? endName) : '';
  const lang = locale === 'en' ? 'en-GB' : locale;
  const monthName = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const dayName = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const weekday = new Intl.DateTimeFormat(lang, { weekday: 'short' });

  /** A field's value as its box shows it, and the day it falls on. */
  const boxText = (value: Value | undefined) => {
    if (typeof value !== 'string' || !value) return '';
    if (kind === 'date') return value.slice(0, 10);
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '' : `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const dayOf = (value: Value | undefined): Date | null => {
    const text = boxText(value);
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)) : null;
  };
  /** A day as the field keeps it: a date, or the day at the hours it had. */
  const valueOn = (day: Date, was: Value | undefined): string => {
    if (kind === 'date') return dayKey(day);
    const before = dayOf(was);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), before?.getHours() ?? 0, before?.getMinutes() ?? 0).toISOString();
  };

  const box = (fieldName: string, label: string, boxId?: string) => {
    const input = make('input', { type: kind === 'date' ? 'date' : 'datetime-local', class: 'fd-input fd-range-input', 'aria-label': label, ...(boxId ? { id: boxId } : {}) });
    input.addEventListener('input', () => {
      if (!input.value) return form.setValue(fieldName, null);
      if (kind === 'date') return form.setValue(fieldName, input.value);
      const d = new Date(input.value);
      if (!Number.isNaN(d.getTime())) form.setValue(fieldName, d.toISOString());
    });
    return input;
  };
  const from = box(name, field.label, id);
  const to = endName ? box(endName, endLabel) : null;
  const button = make('button', { type: 'button', class: 'fd-calendar-button fd-range-button', 'aria-label': words.chooseDate, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': `${id}-range` });
  button.innerHTML = CALENDAR; // a constant drawing, never words from the page
  const prev = make('button', { type: 'button', 'aria-label': words.previousMonth }, '‹');
  const next = make('button', { type: 'button', 'aria-label': words.nextMonth }, '›');
  const title = make('span', { class: 'fd-calendar-title', 'aria-live': 'polite' });
  const grid = make('table', { class: 'fd-calendar-grid', role: 'grid' });
  const calendar = make('div', { id: `${id}-range`, class: 'fd-calendar fd-range-calendar', role: 'dialog', hidden: '' }, make('div', { class: 'fd-calendar-head' }, prev, title, next), grid);
  const element = make('div', { class: 'fd-range', role: 'group' }, make('span', { class: 'fd-range-box' }, from, ...(to ? [make('span', { class: 'fd-range-arrow', 'aria-hidden': 'true' }, '→'), to] : [])), button, calendar);

  let focused = new Date();
  /** The first day picked on the calendar, while the last is still to pick. */
  let starting: Date | null = null;
  let hovered: Date | null = null;

  function pick(day: Date) {
    const values = form.getState().values;
    if (!endName) {
      form.setValue(name, valueOn(day, values[name]));
      return close();
    }
    if (!starting) {
      starting = day;
      focused = day;
      return draw(true);
    }
    const [first, last] = day < starting ? [day, starting] : [starting, day];
    starting = null;
    // Each as a person's change, so the page's own steps for either run.
    form.setValue(name, valueOn(first, values[name]));
    form.setValue(endName, valueOn(last, values[endName]));
    close();
  }

  function draw(focus: boolean) {
    const values = form.getState().values;
    const start = starting ?? dayOf(values[name]);
    const end = starting ? (hovered && hovered >= starting ? hovered : null) : endName ? dayOf(values[endName]) : null;
    const label = monthName.format(focused);
    title.textContent = label;
    calendar.setAttribute('aria-label', label);
    const first = new Date(focused.getFullYear(), focused.getMonth(), 1);
    const monday = addDays(first, -((first.getDay() + 6) % 7));
    const head = make('tr', {}, ...Array.from({ length: 7 }, (_, i) => make('th', { scope: 'col' }, weekday.format(addDays(monday, i)).replace(/\.$/, ''))));
    const body = make('tbody');
    for (let row = monday; row <= new Date(focused.getFullYear(), focused.getMonth() + 1, 0); row = addDays(row, 7)) {
      const tr = make('tr');
      for (let i = 0; i < 7; i++) {
        const d = addDays(row, i);
        const button = make('button', { type: 'button', 'data-day': dayKey(d), 'aria-label': dayName.format(d), tabindex: sameDay(d, focused) ? '0' : '-1' }, String(d.getDate()));
        if (d.getMonth() !== focused.getMonth()) button.classList.add('fd-outside');
        const edge = sameDay(d, start) || sameDay(d, end);
        if (edge) button.setAttribute('aria-selected', 'true');
        if (start && end && d > start && d < end && !edge) button.classList.add('fd-in-range');
        if (sameDay(d, new Date())) button.setAttribute('aria-current', 'date');
        button.addEventListener('click', () => pick(d));
        button.addEventListener('pointerenter', () => {
          if (!starting) return;
          hovered = d;
          for (const other of grid.querySelectorAll<HTMLElement>('button[data-day]')) {
            const at = dayOf(other.dataset['day']);
            other.classList.toggle('fd-in-range', !!at && at > (starting as Date) && at < d);
          }
        });
        button.addEventListener('keydown', (event) => onKey(event, d));
        tr.append(make('td', {}, button));
      }
      body.append(tr);
    }
    grid.replaceChildren(make('thead', {}, head), body);
    if (focus) grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }

  function onKey(event: KeyboardEvent, day: Date) {
    const rtl = rightToLeft(element);
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(day, rtl ? 1 : -1),
      ArrowRight: () => addDays(day, rtl ? -1 : 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      PageUp: () => addMonths(day, -1),
      PageDown: () => addMonths(day, 1),
      Home: () => addDays(day, -((day.getDay() + 6) % 7)),
      End: () => addDays(day, 6 - ((day.getDay() + 6) % 7)),
    };
    if (moves[event.key]) {
      event.preventDefault();
      focused = moves[event.key]();
      if (starting) hovered = focused;
      draw(true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(day);
    }
  }

  function open() {
    starting = null;
    hovered = null;
    focused = dayOf(form.getState().values[name]) ?? new Date();
    calendar.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    draw(true);
  }
  function close() {
    if (calendar.hidden) return;
    calendar.hidden = true;
    starting = null;
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  }
  button.addEventListener('click', () => (calendar.hidden ? open() : close()));
  prev.addEventListener('click', () => ((focused = addMonths(focused, -1)), draw(false)));
  next.addEventListener('click', () => ((focused = addMonths(focused, 1)), draw(false)));
  calendar.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopPropagation();
    close();
  });
  const outside = (event: Event) => {
    if (calendar.hidden || element.contains(event.target as Node)) return;
    calendar.hidden = true;
    starting = null;
    button.setAttribute('aria-expanded', 'false');
  };
  document.addEventListener('mousedown', outside);

  return {
    element,
    focus: () => from.focus(),
    destroy: () => document.removeEventListener('mousedown', outside),
    update(state) {
      for (const [input, value] of [[from, state.value], ...(to && endName ? [[to, state.values[endName]] as const] : [])] as const) {
        const text = boxText(value);
        if (document.activeElement !== input && input.value !== text) input.value = text;
        if (input.readOnly !== state.readonly) input.readOnly = state.readonly;
        input.classList.toggle('fd-blank', !text);
      }
      button.hidden = state.readonly;
      if (state.readonly) calendar.hidden = true;
      setAttr(element, 'aria-labelledby', null);
      describeState(from, state);
    },
  };
};
