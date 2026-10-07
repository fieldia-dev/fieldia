import type { Locale, Value } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { Widget, WidgetContext } from './widgets';

/**
 * A calendar beside a date, for when the person needs the week numbers
 * (`options.weekNumbers` on a date or date-and-time node). The ARIA
 * date-picker dialog: a grid of days, Monday first, an ISO 8601 week number at
 * the start of each row, arrow keys by day and week, PageUp and PageDown by
 * month, Enter to pick, Escape to close. A pick says so: a bubbling
 * `fd-picked` event, its `detail.value` the value set, for what holds the
 * field — a grid's cell closes on it.
 */

/** The ISO 8601 week a day falls in: weeks start on Monday, week 1 holds the year's first Thursday. */
export function isoWeek(day: Date): number {
  const t = new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const yearStart = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.ceil(((t.getTime() - yearStart) / 86400000 + 1) / 7);
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

export function withCalendar(inner: Widget, context: WidgetContext, kind: 'date' | 'datetime'): Widget {
  const { form, name, id, document: doc, locale = 'en' as Locale } = context;
  const labels: WidgetLabels = context.labels ?? WIDGET_LABELS.en;
  const lang = locale === 'en' ? 'en-GB' : locale;
  const monthName = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const dayName = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const weekdayShort = new Intl.DateTimeFormat(lang, { weekday: 'short' });
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
  dialog.append(head, grid);

  const element = doc.createElement('span');
  element.className = 'fd-date-pick';
  element.append(inner.element, button, dialog);

  let focused = new Date();
  let readonly = false;

  function pick(day: Date) {
    if (kind === 'date') {
      form.setValue(name, `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`);
    } else {
      const was = dayOf('datetime', form.getState().values[name]);
      const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), was?.getHours() ?? 0, was?.getMinutes() ?? 0);
      form.setValue(name, at.toISOString());
    }
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
    const weekHead = doc.createElement('th');
    weekHead.scope = 'col';
    weekHead.textContent = labels.weekShort;
    weekHead.setAttribute('abbr', labels.week);
    headRow.append(weekHead);
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      const th = doc.createElement('th');
      th.scope = 'col';
      th.textContent = weekdayShort.format(d).replace(/\.$/, '');
      th.setAttribute('abbr', weekdayLong.format(d));
      headRow.append(th);
    }
    const thead = doc.createElement('thead');
    thead.append(headRow);
    const tbody = doc.createElement('tbody');
    for (let row = start; row <= new Date(focused.getFullYear(), focused.getMonth() + 1, 0); row = addDays(row, 7)) {
      const tr = doc.createElement('tr');
      const week = doc.createElement('th');
      week.scope = 'row';
      week.className = 'fd-week';
      week.textContent = String(isoWeek(row));
      tr.append(week);
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
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(day, -1),
      ArrowRight: () => addDays(day, 1),
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

  function close() {
    if (dialog.hidden) return;
    dialog.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.focus();
  }

  button.addEventListener('click', () => (dialog.hidden ? open() : close()));
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
