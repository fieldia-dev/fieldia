import { clocksSkip, dayIn, fill, firstWeekday, instantsAt, wallClock, wallOf, wallText, wallTime, dayTag, type Field, type FieldNode, type Locale, type Value, intlFormat, plainPart } from '@fieldia/core';
import { weekdayHead } from './calendar';
import { restingText, zoneName, zoneOf } from './date-text';
import { dateBox } from './date-box';
import { maker, rightToLeft, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { bounds } from './limits';
import type { WidgetFactory } from './widgets';
import { openOnClick } from './quiet';
import { afterPress } from './press';
import { openToRoom } from './room';

/**
 * A range of dates in one box, from → to: Flectra's widget="daterange". The
 * node's field is the first day, `options.endField` the last; each is typed in
 * its own date box (Fieldia's, date-box.ts: the page's order, Arabic digits,
 * a paste, text that does not read kept and said), or the range is picked on
 * a calendar — the first day, then the last, put the right way round if picked
 * the other way. A date and time keeps its hours when its day is picked. The
 * calendar is the ARIA date picker, each row a week from its first day where
 * the page is read (`firstWeekday`): arrows by day and week, mirrored right to
 * left, Home and End to the row's ends, PageUp and PageDown by month, Enter to
 * pick, Escape to close.
 *
 * The end is a field of its own: its required, earliest, latest and days, and
 * that it is not before the start ("Ends can’t be before Starts"), are said
 * under the range as either box is left, and at Save; its box is marked and
 * described by them. Both boxes and the calendar keep each field's limits: a
 * day past them is drawn faint, and picking it says why.
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
  const endName = typeof node.options?.['endField'] === 'string' && form.page.fields[node.options['endField'] as string] ? (node.options['endField'] as string) : null;
  const endField = endName ? plainPart(form.page.fields[endName] as Field) : null;
  const endLabel = endField?.label ?? '';
  const lang = dayTag(locale);
  const monthName = intlFormat('DateTimeFormat', lang, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const dayName = intlFormat('DateTimeFormat', lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const weekday = weekdayHead(lang);
  // The week's first day where the page is read (`firstWeekday`), each row of the month from it.
  const firstDay = firstWeekday(locale, form.page);
  const intoWeek = (day: Date) => (day.getDay() - firstDay + 7) % 7;
  const weekdayLong = intlFormat('DateTimeFormat', lang, { weekday: 'long' });

  // A date and time's days and hours on its zone's clock (the browser's without one).
  const zone = zoneOf(form, field);
  /** A field's value as the calendar reads it, and the day it falls on. */
  const boxText = (value: Value | undefined) => {
    if (typeof value !== 'string' || !value) return '';
    if (kind === 'date') return value.slice(0, 10);
    const at = Date.parse(value);
    return Number.isNaN(at) ? '' : wallText(wallTime(at, zone));
  };
  const dayOf = (value: Value | undefined): Date | null => {
    const text = boxText(value);
    const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(text);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] ?? 0), Number(m[5] ?? 0)) : null;
  };
  /** The day at the hours a value had, on the zone's clock. */
  const wallOn = (day: Date, was: Value | undefined) => {
    const before = dayOf(was);
    return { year: day.getFullYear(), month: day.getMonth() + 1, day: day.getDate(), hour: before?.getHours() ?? 0, minute: before?.getMinutes() ?? 0 };
  };
  /**
   * A day as the field keeps it: a date, or the day at the hours it had — the first time where the clocks repeat
   * them that day (its zone's name then shows which); null where they skip them.
   */
  const valueOn = (day: Date, was: Value | undefined): string | null => {
    if (kind === 'date') return dayKey(day);
    const at = instantsAt(wallOn(day, was), zone)[0];
    return at === undefined ? null : new Date(at).toISOString();
  };
  /** Why a day cannot be taken at the hours a value had: the clocks skip them there that day. */
  const skipped = (day: Date, was: Value | undefined, label: string) => {
    const wall = wallOn(day, was);
    const skip = clocksSkip(wall, zone);
    return fill(words.timeSkipped, { label, time: wallClock(wall), day: restingText(dayKey(day), 'date', locale), zone: zone ? zoneName(Date.now(), zone, locale, 'longGeneric') : '', from: skip ? wallClock(skip.from) : '', to: skip ? wallClock(skip.to) : '' });
  };

  const element = make('div', { class: 'fd-range', role: 'group' });
  // Under the range, on a line of their own: what a box refused or could not read, and the end's own problem.
  const mark = make('span', { hidden: '' });
  const endError = make('div', { class: 'fd-error fd-range-error', id: `${id}-end-error`, hidden: '' });
  const notes = make('div', { class: 'fd-range-notes' }, mark, endError);
  // Each box keeps its own field's limits, and says what it cannot read under the range.
  const endNode: FieldNode = { type: 'field', id: `${node.id}.end`, field: endName ?? name };
  /** A box of the range being left now: a problem of the end's it raises is said, politely; a refused Save says its own. */
  let leaving = false;
  const box = (fieldName: string, def: Field, at: FieldNode, label: string, boxId?: string) => {
    const made = dateBox({ form, name: fieldName, field: def, kind, label, document, locale, labels, ...(boxId ? { id: boxId } : {}), limits: bounds(null, def, at), className: 'fd-range-input', anchor: mark, within: element });
    made.input.setAttribute('aria-label', label);
    openOnClick(made.input, () => calendar.hidden && open());
    // The end is said as either box is left, once and politely: its own problems, and that it is not before the start.
    made.input.addEventListener('blur', () => {
      if (!endName) return;
      // Left for a press elsewhere, once that press has ended: nothing moves under it (press.ts).
      afterPress(document, made.input, () => {
        leaving = true;
        try {
          form.boxLeft(endName);
        } finally {
          leaving = false;
        }
      });
    });
    return made;
  };
  const fromBox = box(name, field, node, field.label, id);
  const toBox = endName && endField ? box(endName, endField, endNode, endLabel) : null;
  const [from, to] = [fromBox.input, toBox?.input ?? null];
  const button = make('button', { type: 'button', class: 'fd-calendar-button fd-range-button', 'aria-label': words.chooseDate, 'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-controls': `${id}-range` });
  button.innerHTML = CALENDAR; // a constant drawing, never words from the page
  const prev = make('button', { type: 'button', 'aria-label': words.previousMonth }, '‹');
  const next = make('button', { type: 'button', 'aria-label': words.nextMonth }, '›');
  const title = make('span', { class: 'fd-calendar-title', 'aria-live': 'polite' });
  const grid = make('table', { class: 'fd-calendar-grid', role: 'grid' });
  // Why a day pressed was not picked: said politely under the month, which stays open.
  const note = make('div', { class: 'fd-calendar-note', role: 'status', hidden: '' });
  const calendar = make('div', { id: `${id}-range`, class: 'fd-calendar fd-range-calendar', role: 'dialog', hidden: '' }, make('div', { class: 'fd-calendar-head' }, prev, title, next), grid, note);
  // Each box's zone beside it, where it is on another clock than the browser's.
  const zoned = (box: { zone?: HTMLElement } | null) => (box?.zone ? [box.zone] : []);
  element.append(make('span', { class: 'fd-range-box' }, from, ...zoned(fromBox), ...(to ? [make('span', { class: 'fd-range-arrow', 'aria-hidden': 'true' }, '→'), to, ...zoned(toBox)] : [])), button, calendar, notes);

  /** Today, the day it is on the zone's clock: the page's, by the form's clock. */
  const todayOf = () => {
    const day = wallOf(zone === form.page.timeZone ? form.today() : dayIn(Date.now(), zone));
    return day ? new Date(day.year, day.month - 1, day.day) : new Date();
  };
  let focused = new Date();
  /** The first day picked on the calendar, while the last is still to pick. */
  let starting: Date | null = null;
  let hovered: Date | null = null;

  /** Why a day may not be picked for the start (or the end): its field's limits, or its hours skipped that day, in the page's words. */
  const refused = (day: Date, end: boolean) => {
    const values = form.getState().values;
    const [at, box, label] = end && toBox && endName ? [values[endName], toBox, endLabel] : [values[name], fromBox, field.label];
    const value = valueOn(day, at);
    return value === null ? skipped(day, at, label) : box.refuse(value);
  };
  function say(words: string) {
    setText(note, '');
    setText(note, words);
    setHidden(note, false);
  }

  function pick(day: Date) {
    const values = form.getState().values;
    if (!endName) {
      const why = refused(day, false);
      if (why) return say(why);
      form.setValue(name, valueOn(day, values[name]) as string);
      return close();
    }
    if (!starting) {
      // The first day picked: one the start cannot be, nor the end, is said at once.
      const why = refused(day, false) && refused(day, true);
      if (why) return say(why);
      setHidden(note, true);
      starting = day;
      focused = day;
      return draw(true);
    }
    const [first, last] = day < starting ? [day, starting] : [starting, day];
    const why = refused(first, false) ?? refused(last, true);
    if (why) return say(why);
    starting = null;
    // Each as a person's change, so the page's own steps for either run; text left in a box that did not read goes.
    form.setValue(name, valueOn(first, values[name]) as string);
    form.setValue(endName, valueOn(last, values[endName]) as string);
    for (const at of [name, endName]) if (form.getState().unread?.[at]) form.setUnread(at, null);
    close();
  }

  function draw(focus: boolean) {
    const values = form.getState().values;
    const start = starting ?? dayOf(values[name]);
    const end = starting ? (hovered && hovered >= starting ? hovered : null) : endName ? dayOf(values[endName]) : null;
    const label = monthName.format(focused);
    title.textContent = label;
    calendar.setAttribute('aria-label', label);
    const today = todayOf();
    const first = new Date(focused.getFullYear(), focused.getMonth(), 1);
    const firstRow = addDays(first, -intoWeek(first));
    const head = make('tr', {}, ...Array.from({ length: 7 }, (_, i) => make('th', { scope: 'col', abbr: weekdayLong.format(addDays(firstRow, i)) }, weekday(addDays(firstRow, i)))));
    const body = make('tbody');
    for (let row = firstRow; row <= new Date(focused.getFullYear(), focused.getMonth() + 1, 0); row = addDays(row, 7)) {
      const tr = make('tr');
      for (let i = 0; i < 7; i++) {
        const d = addDays(row, i);
        const button = make('button', { type: 'button', 'data-day': dayKey(d), 'aria-label': dayName.format(d), tabindex: sameDay(d, focused) ? '0' : '-1' }, String(d.getDate()));
        if (d.getMonth() !== focused.getMonth()) button.classList.add('fd-outside');
        const edge = sameDay(d, start) || sameDay(d, end);
        if (edge) button.setAttribute('aria-selected', 'true');
        if (start && end && d > start && d < end && !edge) button.classList.add('fd-in-range');
        if (sameDay(d, today)) button.setAttribute('aria-current', 'date');
        // Past the limits of the day picked now — the start, then the end: faint, and a press says why.
        if (starting ? refused(d, true) : refused(d, false) && (!endName || refused(d, true))) button.classList.add('fd-off');
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
      Home: () => addDays(day, -intoWeek(day)),
      End: () => addDays(day, 6 - intoWeek(day)),
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
    // Over the words under the range, the month says them too: why the text typed in a box was not read.
    const unread = form.getState().unread ?? {};
    const why = unread[name]?.message ?? (endName ? unread[endName]?.message : undefined) ?? '';
    setText(note, why);
    setHidden(note, !why);
    focused = dayOf(form.getState().values[name]) ?? todayOf();
    calendar.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    draw(false);
    // Over its boxes where there is not room under them and more over them (room.ts), before its day takes the focus.
    if (calendar.offsetParent instanceof HTMLElement) openToRoom(calendar, calendar.offsetParent);
    grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }
  /** Closed where the focus already is: the person moved on. */
  function hide() {
    if (calendar.hidden) return;
    calendar.hidden = true;
    starting = null;
    button.setAttribute('aria-expanded', 'false');
  }
  function close() {
    if (calendar.hidden) return;
    hide();
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
  // A box typed in and left for anything but the month — Tab to the other box, to the button or past them — closes
  // it, so it never covers why the text was not read; so does the focus leaving the range from inside the month.
  for (const input of [from, to]) {
    input?.addEventListener('blur', (event) => {
      const next = (event as FocusEvent).relatedTarget;
      if (next instanceof Node && !calendar.contains(next)) hide();
    });
  }
  element.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (next instanceof Node && !element.contains(next)) hide();
  });

  /** The end's problem shown now (the start's is the field's own, which the page shows): said politely when it is new as a box is left. */
  let endSaid = '';
  return {
    element,
    focus: () => from.focus(),
    // The plain box before this range came held its first day: what was typed there is its first box's.
    takeTyped: (typed) => {
      fromBox.take(typed);
      return true;
    },
    destroy: () => {
      document.removeEventListener('mousedown', outside);
      fromBox.destroy();
      toBox?.destroy();
    },
    update(state) {
      fromBox.update(state);
      if (toBox && endName) {
        const problem = form.getState().errors[endName] ?? '';
        setAttr(endError, 'aria-live', leaving && !!problem && problem !== endSaid ? 'polite' : null);
        endSaid = problem;
        setText(endError, problem);
        setHidden(endError, !problem);
        toBox.update({ value: state.values[endName], readonly: state.readonly, invalid: !!problem, describedBy: problem ? endError.id : undefined });
      }
      button.hidden = state.readonly;
      if (state.readonly) calendar.hidden = true;
      setAttr(element, 'aria-labelledby', null);
    },
  };
};
