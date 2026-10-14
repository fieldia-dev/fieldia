import type { Locale, Value } from '@fieldia/core';
import { isoWeek } from './date-text';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { rightToLeft, setHidden, setText } from './kind-parts';
import type { Widget, WidgetContext } from './widgets';
import { openOnClick } from './quiet';

/**
 * A calendar beside a date: Fieldia's own date box has one, with the week
 * numbers when the person needs them (`options.weekNumbers` on a date or
 * date-and-time node). The ARIA date-picker dialog: a grid of days, Monday
 * first, an ISO 8601 week number at the start of each row when asked, arrow
 * keys by day and week (mirrored right to left), PageUp and PageDown by
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
  /** ISO week numbers at the start of each row: shown unless false. */
  weekNumbers?: boolean;
  /** Why a day — as the field would hold it — may not be picked (before the earliest, after the latest, a day of the week it may not fall on), in words; undefined when it may. */
  refuse?: (value: string) => string | undefined;
  /** The element the box and its calendar are drawn in: a new one unless given. */
  into?: HTMLElement;
}

/**
 * A day of the week as a calendar's column heads it: its short name ("Mon", "lun", "Mo"), or — where the short name
 * is a whole word, as Arabic's are (الاثنين) — its narrow one (ن), which fits the column; the head's `abbr` says it whole.
 */
export function weekdayHead(lang: string): (day: Date) => string {
  const short = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const narrow = new Intl.DateTimeFormat(lang, { weekday: 'narrow' });
  return (day) => {
    const name = short.format(day).replace(/\.$/, '');
    return [...name].length > 4 ? narrow.format(day) : name;
  };
}

const pad = (n: number) => String(n).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
/** The same day of another month, or that month's last day when it is shorter. */
function addMonths(d: Date, n: number) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
}

/** The day a date field holds ("2026-10-11"), or a date and time (an ISO instant), in local time. */
function dayOf(kind: 'date' | 'datetime', value: Value | undefined): Date | null {
  if (typeof value !== 'string' || !value) return null;
  if (kind === 'date') {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function withCalendar(inner: Widget, context: WidgetContext, kind: 'date' | 'datetime', options: CalendarOptions = {}): Widget {
  const { form, name, id, document: doc, locale = 'en' as Locale } = context;
  const labels: WidgetLabels = context.labels ?? WIDGET_LABELS.en;
  const lang = locale === 'en' ? 'en-GB' : locale;
  const monthName = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const dayName = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const weekdayShort = weekdayHead(lang);
  const weekdayLong = new Intl.DateTimeFormat(lang, { weekday: 'long' });

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
  button.setAttribute('aria-label', labels.chooseDate);
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
  prev.setAttribute('aria-label', labels.previousMonth);
  const title = doc.createElement('span');
  title.className = 'fd-calendar-title';
  title.setAttribute('aria-live', 'polite');
  const next = doc.createElement('button');
  next.type = 'button';
  next.textContent = '›';
  next.setAttribute('aria-label', labels.nextMonth);
  head.append(prev, title, next);
  const grid = doc.createElement('table');
  grid.className = 'fd-calendar-grid';
  grid.setAttribute('role', 'grid');
  // Why the day pressed was not picked: said politely, under the month, while the month stays open.
  const note = doc.createElement('div');
  note.className = 'fd-calendar-note';
  note.setAttribute('role', 'status');
  note.hidden = true;
  dialog.append(head, grid, note);
  const weeks = options.weekNumbers !== false;

  const element = options.into ?? doc.createElement('span');
  element.classList.add('fd-date-pick');
  element.append(inner.element, button, dialog);

  let focused = new Date();
  let readonly = false;

  /** A day as the field would hold it: the date, or the day at the hours the field has. */
  function valueOn(day: Date): string {
    if (kind === 'date') return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
    const was = dayOf('datetime', form.getState().values[name]);
    return new Date(day.getFullYear(), day.getMonth(), day.getDate(), was?.getHours() ?? 0, was?.getMinutes() ?? 0).toISOString();
  }

  function pick(day: Date) {
    const value = valueOn(day);
    const refused = options.refuse?.(value);
    if (refused) {
      // Said again when the same day is pressed twice: the region is emptied first.
      setText(note, '');
      setText(note, refused);
      setHidden(note, false);
      return;
    }
    form.setValue(name, value);
    // A day picked is what the box holds now: text left in it that did not read goes.
    if (form.getState().unread?.[name]) form.setUnread(name, null);
    close();
    // A day picked is the whole answer: what holds the field (a table's cell) may close on it.
    element.dispatchEvent(new CustomEvent('fd-picked', { bubbles: true, detail: { value: form.getState().values[name] } }));
  }

  function draw(focus: boolean) {
    const chosen = dayOf(kind, form.getState().values[name]);
    const today = new Date();
    const label = monthName.format(focused);
    title.textContent = label;
    dialog.setAttribute('aria-label', label);
    const first = new Date(focused.getFullYear(), focused.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7)); // back to Monday
    const headRow = doc.createElement('tr');
    if (weeks) {
      const weekHead = doc.createElement('th');
      weekHead.scope = 'col';
      weekHead.textContent = labels.weekShort;
      weekHead.setAttribute('abbr', labels.week);
      headRow.append(weekHead);
    }
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = weekdayShort(d);
      th.setAttribute('abbr', weekdayLong.format(d));
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
        day.setAttribute('aria-label', dayName.format(d));
        day.tabIndex = sameDay(d, focused) ? 0 : -1;
        if (d.getMonth() !== focused.getMonth()) day.classList.add('fd-outside');
        if (chosen && sameDay(d, chosen)) day.setAttribute('aria-selected', 'true');
        if (sameDay(d, today)) day.setAttribute('aria-current', 'date');
        // Past the field's limits: faint, and a press says why.
        if (options.refuse?.(valueOn(d))) day.classList.add('fd-off');
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
      Home: () => addDays(day, -((day.getDay() + 6) % 7)),
      End: () => addDays(day, 6 - ((day.getDay() + 6) % 7)),
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
    focused = dayOf(kind, form.getState().values[name]) ?? new Date();
    // Over the field's error, the month says it too: why the text typed was not read.
    const unread = form.getState().unread?.[name]?.message ?? '';
    setText(note, unread);
    setHidden(note, !unread);
    dialog.hidden = false;
    button.setAttribute('aria-expanded', 'true');
    draw(true);
    keepOnScreen();
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
    focused = addMonths(focused, -1);
    draw(false);
  });
  next.addEventListener('click', () => {
    focused = addMonths(focused, 1);
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
    focus: () => inner.focus(),
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
