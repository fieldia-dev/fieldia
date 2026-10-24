import { clocksSkip, dayIn, fill, firstWeekday, instantsAt, wallClock, wallOf, wallTime, dayTag, type Locale, type Value, intlFormat } from '@fieldia/core';
import { isoWeek, restingText, zoneName, zoneOf } from './date-text';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { rightToLeft, setHidden, setText } from './kind-parts';
import type { Widget, WidgetContext } from './widgets';
import { openOnClick } from './quiet';
import { weekdayHead } from './weekday-head';
import { openToRoom } from './room';

export { weekdayHead };

/**
 * A calendar beside a date: Fieldia's own date box has one, with the week
 * numbers when the person needs them (`options.weekNumbers` on a date or
 * date-and-time node). The ARIA date-picker dialog: a grid of days from the
 * week's first day where the page is read (`firstWeekday`: Sunday for an
 * English page read in the United States, Saturday in Egypt, Monday in
 * Britain), or Monday first with an ISO 8601 week number at the start of each
 * row when asked (an ISO week is Monday's to Sunday's), arrow
 * keys by day and week (mirrored right to left), Home and End to the row's
 * first and last day, PageUp and PageDown by
 * month, Enter to pick, Escape to close. A day past the field's limits is
 * drawn faint, and picking it says why under the month, and picks nothing. A
 * pick says so: a bubbling `fd-picked` event, its `detail.value` the value
 * set, for what holds the field — a grid's cell closes on it.
 *
 * It never covers why the box's text was not read: the focus leaving the box
 * for anything but the month (Tab to its button, or past it) closes it, as
 * does the focus leaving the field from inside it; and opened on text left
 * unread, the month says why under it.
 *
 * It comes in the date part (date-part.ts), with the date box it is beside:
 * `(await datePart.load()).withCalendar(…)`.
 */

/** How a calendar is drawn, and what it keeps to. */
export interface CalendarOptions {
  /** ISO week numbers at the start of each row, each row an ISO week (Monday first): shown unless false. */
  weekNumbers?: boolean;
  /** Why a day — as the field would hold it — may not be picked (before the earliest, after the latest, a day of the week it may not fall on), in words; undefined when it may. */
  refuse?: (value: string) => string | undefined;
  /** The element the box and its calendar are drawn in: a new one unless given. */
  into?: HTMLElement;
  /** What is drawn between the box and its button: a date and time's zone. */
  beside?: HTMLElement;
  /**
   * A calendar of another kind than a month of days, or one that says more of each day — a year's twelve months or
   * twelve years for a month or a year alone, a Hijri date's days (the months part's): what it draws and names.
   */
  kind?: CalendarKind;
}

/** What a calendar of another kind draws in, and reads of the one it is in (`CalendarKind.draw`). */
export interface CalendarHost {
  doc: Document;
  grid: HTMLTableElement;
  /** The month, or the year, the keys have reached. */
  focused: Date;
  /** The day the field holds; today, on the form's clock. */
  held?: Date;
  today: Date;
  readonly: boolean;
  /** Right to left, where the arrows run the other way. */
  rtl: boolean;
  /** Whether a day (or a month, a year) may not be picked, by the field's limits. */
  refused(at: Date): boolean;
  pick(at: Date): void;
  move(at: Date): void;
  /** The calendar's title, which names it too. */
  heading(text: string): void;
}

/**
 * A calendar of another kind (`CalendarOptions.kind`): the names of its button and of the buttons that turn it, its
 * grid's class; for a month or a year alone, the value of what is picked (its first day), where it opens, how it turns
 * and its grid; for a Hijri date, its title beside a month's name and what each day's button says beside its own.
 */
export interface CalendarKind {
  choose: string;
  previous: string;
  next: string;
  className: string;
  valueOn?(at: Date): string;
  start?(at: Date): Date;
  turn?(at: Date, by: -1 | 1): Date;
  draw?(host: CalendarHost, focus: boolean): void;
  heading?(first: Date, last: Date): string;
  mark?(button: HTMLButtonElement, at: Date, label: string): void;
}


const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** The same day of another month, or that month's last day when it is shorter. */
function addMonths(d: Date, n: number) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
}

/**
 * The day a date field holds ("2026-10-11"), or a date and time (an ISO instant) on its zone's clock (the browser's
 * without one), as a day of the calendar drawn — a date at the browser's midnight — and the time it holds then.
 */
function dayOf(kind: 'date' | 'datetime', value: Value | undefined, zone?: string): { day: Date; hour: number; minute: number } | null {
  if (typeof value !== 'string' || !value) return null;
  const at = kind === 'date' ? NaN : Date.parse(value);
  const wall = kind === 'date' ? wallOf(value) : Number.isNaN(at) ? null : wallTime(at, zone);
  return wall ? { day: new Date(wall.year, wall.month - 1, wall.day), hour: wall.hour, minute: wall.minute } : null;
}

export function withCalendar(inner: Widget, context: WidgetContext, kind: 'date' | 'datetime', options: CalendarOptions = {}): Widget {
  const { form, name, id, document: doc, locale = 'en' as Locale } = context;
  const labels: WidgetLabels = context.labels ?? WIDGET_LABELS.en;
  const lang = dayTag(locale);
  // A month's names and its weekday heads, worked out as it first opens: a form of many dates draws none of them.
  const monthName = () => intlFormat('DateTimeFormat', lang, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const dayName = () => intlFormat('DateTimeFormat', lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const weekdayLong = () => intlFormat('DateTimeFormat', lang, { weekday: 'long' });
  const other = kind === 'date' ? options.kind : undefined;

  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'fd-calendar-button';
  // A drawn calendar: an emoji would look different on every system.
  const svg = 'http://www.w3.org/2000/svg';
  const icon = doc.createElementNS(svg, 'svg');
  icon.setAttribute('viewBox', '0 0 16 16');
  icon.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of [
    ['rect', { x: '2', y: '3', width: '12', height: '11', rx: '1.5' }],
    ['path', { d: 'M2 6.5h12M5 1.5v3M11 1.5v3' }],
  ] as const) {
    const shape = doc.createElementNS(svg, tag);
    for (const [k, v] of Object.entries(attrs)) shape.setAttribute(k, v);
    icon.append(shape);
  }
  button.append(icon);
  button.setAttribute('aria-label', other?.choose ?? labels.chooseDate);
  button.setAttribute('aria-haspopup', 'dialog');
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', `${id}-calendar`);

  const dialog = doc.createElement('div');
  dialog.className = 'fd-calendar';
  dialog.id = `${id}-calendar`;
  dialog.setAttribute('role', 'dialog');
  dialog.hidden = true;
  const head = doc.createElement('div');
  head.className = 'fd-calendar-head';
  const prev = doc.createElement('button');
  prev.type = 'button';
  prev.textContent = '‹';
  prev.setAttribute('aria-label', other?.previous ?? labels.previousMonth);
  const title = doc.createElement('span');
  title.className = 'fd-calendar-title';
  title.setAttribute('aria-live', 'polite');
  const next = doc.createElement('button');
  next.type = 'button';
  next.textContent = '›';
  next.setAttribute('aria-label', other?.next ?? labels.nextMonth);
  head.append(prev, title, next);
  const grid = doc.createElement('table');
  grid.className = `fd-calendar-grid${other ? ` ${other.className}` : ''}`;
  grid.setAttribute('role', 'grid');
  // Why the day pressed was not picked: said politely, under the month, while the month stays open.
  const note = doc.createElement('div');
  note.className = 'fd-calendar-note';
  note.setAttribute('role', 'status');
  note.hidden = true;
  dialog.append(head, grid, note);
  const weeks = options.weekNumbers !== false;
  // The week's first day where the page is read; Monday where each row is an ISO week, its number before it.
  let firstDay: number | undefined;
  /** How many days a day is past its row's first. */
  const intoWeek = (day: Date) => (day.getDay() - (firstDay ??= weeks ? 1 : firstWeekday(locale, form.page)) + 7) % 7;

  const element = options.into ?? doc.createElement('span');
  element.classList.add('fd-date-pick');
  element.append(inner.element, ...(options.beside ? [options.beside] : []), button, dialog);
  // A date and time on its zone's clock; today, the day it is there — the page's, by the form's clock.
  const zone = zoneOf(form, context.field);
  const todayOf = () => {
    const day = wallOf(zone === form.page.timeZone ? form.today() : dayIn(Date.now(), zone));
    return day ? new Date(day.year, day.month - 1, day.day) : new Date();
  };

  let focused = new Date();
  let readonly = false;

  /**
   * A day as the field would hold it: the date, or the day at the hours the field has on its zone's clock — the
   * first time, where the clocks repeat it that day (its zone's name then shows which); none where they skip it.
   */
  function valueOn(day: Date): string | null {
    // A month or a year, kept as its first day.
    if (other?.valueOn) return other.valueOn(day);
    if (kind === 'date') return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const was = dayOf('datetime', form.getState().values[name], zone);
    const at = instantsAt({ year: day.getFullYear(), month: day.getMonth() + 1, day: day.getDate(), hour: was?.hour ?? 0, minute: was?.minute ?? 0 }, zone)[0];
    return at === undefined ? null : new Date(at).toISOString();
  }
  /** Why a day cannot be picked at the hours the field has: the clocks skip them there that day. */
  function skipped(day: Date): string {
    const was = dayOf('datetime', form.getState().values[name], zone);
    const wall = { year: day.getFullYear(), month: day.getMonth() + 1, day: day.getDate(), hour: was?.hour ?? 0, minute: was?.minute ?? 0 };
    const skip = clocksSkip(wall, zone);
    const iso = `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`;
    return fill(labels.timeSkipped, { label: context.node.label ?? context.field.label, time: wallClock(wall), day: restingText(iso, 'date', locale), zone: zone ? zoneName(Date.now(), zone, locale, 'longGeneric') : '', from: skip ? wallClock(skip.from) : '', to: skip ? wallClock(skip.to) : '' });
  }

  function pick(day: Date) {
    const value = valueOn(day);
    const refused = value === null ? skipped(day) : options.refuse?.(value);
    if (refused) {
      // Said again when the same day is pressed twice: the region is emptied first.
      setText(note, '');
      setText(note, refused);
      setHidden(note, false);
      return;
    }
    if (value === null) return;
    form.setValue(name, value);
    // A day picked is what the box holds now: text left in it that did not read goes.
    if (form.getState().unread?.[name]) form.setUnread(name, null);
    close();
    // A day picked is the whole answer: what holds the field (a table's cell) may close on it.
    element.dispatchEvent(new CustomEvent('fd-picked', { bubbles: true, detail: { value: form.getState().values[name] } }));
  }

  function draw(focus: boolean) {
    // A year's months, or twelve years: the other kind's own grid.
    if (other?.draw) {
      const held = dayOf(kind, form.getState().values[name], zone)?.day;
      const host: CalendarHost = {
        doc, grid, focused, today: todayOf(), readonly, rtl: rightToLeft(element), pick, move,
        ...(held ? { held } : {}),
        refused: (at) => ((value) => value !== null && !!options.refuse?.(value))(valueOn(at)),
        heading(text) {
          title.textContent = text;
          dialog.setAttribute('aria-label', text);
        },
      };
      return other.draw(host, focus);
    }
    const chosen = dayOf(kind, form.getState().values[name], zone)?.day;
    const today = todayOf();
    // A Hijri date's month says the Hijri months it spans beside its name.
    const label = other?.heading ? `${monthName().format(focused)} · ${other.heading(new Date(focused.getFullYear(), focused.getMonth(), 1), new Date(focused.getFullYear(), focused.getMonth() + 1, 0))}` : monthName().format(focused);
    title.textContent = label;
    dialog.setAttribute('aria-label', label);
    const first = new Date(focused.getFullYear(), focused.getMonth(), 1);
    const start = addDays(first, -intoWeek(first)); // back to the week's first day
    const headRow = doc.createElement('tr');
    if (weeks) {
      const weekHead = doc.createElement('th');
      weekHead.scope = 'col';
      weekHead.textContent = labels.weekShort;
      weekHead.setAttribute('abbr', labels.week);
      headRow.append(weekHead);
    }
    const [head, weekday, days] = [weekdayHead(lang), weekdayLong(), dayName()];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = head(d);
      th.setAttribute('abbr', weekday.format(d));
      headRow.append(th);
    }
    const thead = doc.createElement('thead');
    thead.append(headRow);
    const tbody = doc.createElement('tbody');
    for (let row = start; row <= new Date(focused.getFullYear(), focused.getMonth() + 1, 0); row = addDays(row, 7)) {
      const tr = doc.createElement('tr');
      if (weeks) {
        const week = doc.createElement('th');
        week.scope = 'row';
        week.className = 'fd-week';
        week.textContent = String(isoWeek(row));
        tr.append(week);
      }
      for (let i = 0; i < 7; i++) {
        const d = addDays(row, i);
        const cell = doc.createElement('td');
        const day = doc.createElement('button');
        day.type = 'button';
        day.textContent = String(d.getDate());
        day.setAttribute('aria-label', days.format(d));
        // What the other kind says of each day beside its own: its Hijri day.
        other?.mark?.(day, d, days.format(d));
        day.tabIndex = sameDay(d, focused) ? 0 : -1;
        if (d.getMonth() !== focused.getMonth()) day.classList.add('fd-outside');
        if (chosen && sameDay(d, chosen)) day.setAttribute('aria-selected', 'true');
        if (sameDay(d, today)) day.setAttribute('aria-current', 'date');
        // Past the field's limits: faint, and a press says why.
        const value = valueOn(d);
        if (value !== null && options.refuse?.(value)) day.classList.add('fd-off');
        day.disabled = readonly;
        day.addEventListener('click', () => pick(d));
        day.addEventListener('keydown', (event) => onKey(event, d));
        cell.append(day);
        tr.append(cell);
      }
      tbody.append(tr);
    }
    grid.replaceChildren(thead, tbody);
    if (focus) grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }

  function move(to: Date) {
    focused = to;
    draw(true);
  }

  function onKey(event: KeyboardEvent, day: Date) {
    // Right to left the week runs from the right: the arrows follow the screen.
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
      move(moves[event.key]());
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      pick(day);
    }
  }

  function open() {
    focused = dayOf(kind, form.getState().values[name], zone)?.day ?? todayOf();
    if (other?.start) focused = other.start(focused);
    // Over the field's error, the month says it too: why the text typed was not read.
    const unread = form.getState().unread?.[name]?.message ?? '';
    setText(note, unread);
    setHidden(note, !unread);
    dialog.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    draw(false);
    // Over its box where there is not room under it and more over it (room.ts); then on the screen sideways — placed
    // before its day takes the focus, which would scroll the page to it where it stood.
    if (dialog.offsetParent instanceof HTMLElement) openToRoom(dialog, dialog.offsetParent);
    keepOnScreen();
    grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
  }

  /** The month kept on the screen, 8px from its edges: beside a narrow box (a table's cell on a phone) it would run off. */
  function keepOnScreen() {
    dialog.style.translate = '';
    const rect = dialog.getBoundingClientRect();
    const width = doc.documentElement.clientWidth;
    if (!rect.width || !width) return;
    const shift = rect.left < 8 ? 8 - rect.left : rect.right > width - 8 ? Math.max(8 - rect.left, width - 8 - rect.right) : 0;
    if (shift) dialog.style.translate = `${Math.round(shift)}px 0`;
  }

  /** Closed where the focus already is: the person moved on. */
  function hide() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    button.setAttribute('aria-expanded', 'false');
  }
  function close() {
    if (dialog.hidden) return;
    hide();
    button.focus();
  }

  button.addEventListener('click', () => (dialog.hidden ? open() : close()));
  if (inner.element instanceof HTMLInputElement) openOnClick(inner.element, () => dialog.hidden && open());
  prev.addEventListener('click', () => {
    focused = other?.turn ? other.turn(focused, -1) : addMonths(focused, -1);
    draw(false);
  });
  next.addEventListener('click', () => {
    focused = other?.turn ? other.turn(focused, 1) : addMonths(focused, 1);
    draw(false);
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  const outside = (event: Event) => {
    if (!dialog.hidden && !element.contains(event.target as Node)) {
      dialog.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  };
  doc.addEventListener('mousedown', outside);
  // Typed in and left for anything but the month — Tab to its button or past it — the month goes, and with it
  // nothing over the words that say why the text was not read. (Focus going nowhere, a press inside the month that
  // is no button, keeps it: a press outside is the mousedown's.)
  inner.element.addEventListener('blur', (event) => {
    const to = (event as FocusEvent).relatedTarget;
    if (to instanceof Node && !dialog.contains(to)) hide();
  });
  element.addEventListener('focusout', (event) => {
    const to = event.relatedTarget;
    if (to instanceof Node && !element.contains(to)) hide();
  });

  return {
    element,
    focus: (options?: FocusOptions) => inner.focus(options),
    ...(inner.takeTyped ? { takeTyped: inner.takeTyped } : {}),
    update(state) {
      readonly = state.readonly;
      button.hidden = state.readonly;
      if (state.readonly) dialog.hidden = true;
      inner.update(state);
    },
    destroy() {
      doc.removeEventListener('mousedown', outside);
      inner.destroy?.();
    },
  };
}
