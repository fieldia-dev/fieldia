import { saveProblemOf, type CalendarView, type ListCalendar, type ListedRecord, type RecordVersion, type ResolvedFilter, type Value, type Values } from '@fieldia/core';
import type { ListViewContext, ListViewPart } from '@fieldia/viewer';
import { moneyReads } from '@fieldia/widgets';
import { addDays, addMinutes, atMinutes, dayKey, firstDayOf, format, minutesOf, rangeOf, sameDay, startOfDay, stepFrom, writeWhen, type Range } from './dates';
import { colourOf, eventsOf, keyOf, kindOf, moved, sideBySide, whereTo, type CalendarEvent, type Resource } from './events';
import { calendarLabels, fill, type CalendarLabels } from './labels';
import type { CalendarSettings } from './settings';
import { installCalendarStyles } from './styles';

const ALL_VIEWS: CalendarView[] = ['day', 'week', 'month', 'agenda'];
/** The least a slot or a record is tall, so a finger or a pointer can hit it (WCAG's 24 pixels). */
const TARGET = 24;
/** How far a press moves before it is a drag rather than a click. */
const DRAG_FROM = 4;
/** How long a record pressed into an empty slot lasts, in minutes. */
const NEW_LENGTH = 60;
/** How many records a month's day shows before "+2 more". */
const IN_A_DAY = 3;
/** Back and on, as the line reads left to right: flipped right to left by the stylesheet. */
const CHEVRON = (back: boolean) => `<path d="${back ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;

let made = 0;

/** A column of the day or the week: a day, and a person or room when the day shows one each. */
interface Column {
  day: Date;
  resource: (Resource & { label: string }) | null;
}

/**
 * A list's records on a calendar, for the list's switcher: the list's own
 * search, its records by day, week or month, or as an agenda; a column for
 * each person or room in the day view; dragged to move and stretched by
 * their end, or moved from the keyboard with "Move to…", written through
 * the data source's save with Undo; an empty slot pressed for a new record.
 */
export function calendarPart(context: ListViewContext, settings: CalendarSettings = {}): ListViewPart {
  const { page, node, document: doc, locale } = context;
  const spec = node.calendar as ListCalendar;
  const source = context.dataSource;
  const model = page.data.kind === 'record' ? page.data.model : '';
  const labels: CalendarLabels = calendarLabels(locale, settings.labels?.[locale]);
  const now = () => settings.now?.() ?? new Date();
  const kind = kindOf(page, spec);
  const views = (spec.views?.length ? spec.views : ALL_VIEWS).filter((v, i, all) => all.indexOf(v) === i);
  const firstDay = firstDayOf(locale, spec.firstDay);
  const slot = spec.slot ?? 30;
  /** Pixels an hour takes in the day and the week (--fd-cal-hour): 48, or more where a slot would be under 24 pixels. */
  const HOUR = Math.max(48, Math.ceil((TARGET * 60) / slot));
  const hours = spec.hours ?? { start: 8, end: 20 };
  const limit = settings.limit ?? 500;
  const id = `fd-cal-${++made}`;
  const rtl = () => element.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const phone = !!doc.defaultView?.matchMedia?.('(max-width: 640px)').matches;
  let view: CalendarView = phone && views.includes('agenda') ? 'agenda' : spec.view && views.includes(spec.view) ? spec.view : views[0];
  let anchor = startOfDay(now());
  let records: ListedRecord[] = [];
  let events: CalendarEvent[] = [];
  let total = 0;
  let resources: Column['resource'][] = [];
  let knownResources: (Resource & { label: string })[] | null = null;
  let asking = 0;
  let destroyed = false;
  let failed = false;
  /** Where the slots' and days' one stop is: a day, a time, a column. */
  let cursor: { day: Date; minutes: number; column: number } = { day: anchor, minutes: hours.start * 60, column: 0 };
  /** What Undo writes back, and the version the record holds after the move. */
  let undo: { record: ListedRecord; values: Values; version?: RecordVersion; name: string } | null = null;
  const canSave = !!source?.save;
  const canCreate = !!context.create;
  const canOpen = !!context.open;
  const fields = [...new Set([spec.start, spec.end, spec.title, spec.colour, spec.resource, ...moneyReads(page.fields[spec.title])].filter((name): name is string => !!name && !!page.fields[name]))];

  installCalendarStyles(doc);
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) => {
    const node = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(key, value);
    node.append(...children);
    return node;
  };
  const chevron = (back: boolean) => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 16 16');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = CHEVRON(back);
    return svg;
  };

  // ---- the bar: Today, back and on, the span in words, the views, New ----------------------------------------

  const today = make('button', { type: 'button', class: 'fd-button' }, labels.today);
  const back = make('button', { type: 'button', class: 'fd-button fd-cal-step' }, chevron(true));
  const on = make('button', { type: 'button', class: 'fd-button fd-cal-step' }, chevron(false));
  const title = make('h2', { class: 'fd-cal-title', id: `${id}-title`, 'aria-live': 'polite' });
  const viewButtons = views.map((name) => {
    const button = make('button', { type: 'button', class: 'fd-button', 'data-range': name, 'aria-pressed': 'false' }, labels.views[name]);
    button.addEventListener('click', () => showView(name));
    return button;
  });
  const ranges = make('div', { class: 'fd-cal-ranges', role: 'group', 'aria-label': labels.showAs }, ...viewButtons);
  ranges.hidden = views.length < 2;
  const newButton = make('button', { type: 'button', class: 'fd-button fd-button-primary fd-cal-new' }, labels.newRecord);
  newButton.hidden = !canCreate;
  today.addEventListener('click', () => go(startOfDay(now())));
  back.addEventListener('click', () => go(stepFrom(view, anchor, -1)));
  on.addEventListener('click', () => go(stepFrom(view, anchor, 1)));
  newButton.addEventListener('click', () => void createAt(...newPlace()));
  const bar = make('div', { class: 'fd-cal-bar' }, make('div', { class: 'fd-cal-nav', role: 'group', 'aria-label': labels.moveThrough }, today, back, on), title, ranges, newButton);

  // What a move says, with Undo; what went wrong, at once; how many it shows, when it cannot show all.
  const said = make('div', { class: 'fd-cal-said', role: 'status' });
  const alert = make('div', { class: 'fd-cal-alert', role: 'alert' });
  const note = make('p', { class: 'fd-cal-note', hidden: '' });
  const body = make('div', { class: 'fd-cal-body', role: 'region', 'aria-labelledby': `${id}-title` });
  const keysEvent = make('span', { id: `${id}-keys-event`, class: 'fd-sr-only' }, canOpen && canSave ? labels.keysOpenMove : canOpen ? labels.keysOpen : labels.keysMove);
  const keysSlot = make('span', { id: `${id}-keys-slot`, class: 'fd-sr-only' }, labels.keysSlots);
  const keysDay = make('span', { id: `${id}-keys-day`, class: 'fd-sr-only' }, labels.keysDays);
  const element = make('div', { class: 'fd-cal', 'data-creates': canCreate ? '' : undefined, 'aria-label': labels.calendar }, bar, said, alert, note, body, keysEvent, keysSlot, keysDay);
  element.setAttribute('role', 'group');
  element.style.setProperty('--fd-cal-hour', `${HOUR}px`);

  // ---- asking for the records of the span shown ---------------------------------------------------------------

  const range = (): Range => rangeOf(view, anchor, firstDay);
  /** The records in the span: starting before it ends, and ending after it starts (or starting in it, with no end). */
  function spanFilter({ from, to }: Range): ResolvedFilter[] {
    const last = kind === 'date' ? dayKey(addDays(to, -1)) : writeWhen(to, kind);
    const first = writeWhen(from, kind);
    const starts: ResolvedFilter = { field: spec.start, op: kind === 'date' ? '<=' : '<', value: last };
    if (!spec.end) return [starts, { field: spec.start, op: '>=', value: first }];
    return [starts, { any: [{ field: spec.end, op: kind === 'date' ? '>=' : '>', value: first }, { field: spec.start, op: '>=', value: first }] }];
  }

  async function reload(): Promise<void> {
    const mine = ++asking;
    body.setAttribute('aria-busy', 'true');
    try {
      const answer = source?.list ? await source.list({ model, fields, filter: [...context.filter(), ...spanFilter(range())], sort: [{ field: spec.start }], offset: 0, limit }) : { records: [], total: 0 };
      const people = await resourcesFor(answer.records);
      if (mine !== asking || destroyed) return;
      records = answer.records;
      total = answer.total;
      resources = people;
      failed = false;
    } catch {
      if (mine !== asking || destroyed) return;
      failed = true;
    }
    body.removeAttribute('aria-busy');
    events = eventsOf(records, spec, page, locale);
    draw();
  }

  /**
   * The people or rooms the day shows a column for: a choice's options, a link's records (asked for once), the
   * values the records hold besides; "No one" for records with none. Kept to those with records when the search
   * names the field itself.
   */
  async function resourcesFor(found: readonly ListedRecord[]): Promise<Column['resource'][]> {
    const field = spec.resource ? page.fields[spec.resource] : undefined;
    if (!spec.resource || !field) return [null];
    const name = spec.resource;
    if (knownResources === null) {
      knownResources = [];
      if (field.type === 'selection') knownResources = field.options.map((o) => ({ value: o.value, key: String(o.value), label: o.label }));
      else if (field.type === 'many2one' && source?.search) {
        try {
          knownResources = (await source.search({ model: field.relation, query: '', limit: 40 })).map((r) => ({ value: { id: r.id, label: r.label }, key: String(r.id), label: r.label }));
        } catch {
          knownResources = [];
        }
      }
    }
    const seen = new Map<string, Resource & { label: string }>();
    let none = false;
    for (const record of found) {
      const value = record.values[name];
      const key = keyOf(value);
      if (key === null) none = true;
      else if (!seen.has(key)) seen.set(key, { value: value as Value, key, label: eventsOf([record], { ...spec, title: name }, page, locale)[0]?.title ?? key });
    }
    const searched = JSON.stringify(context.filter()).includes(`"field":"${name}"`);
    const listed = (searched ? knownResources.filter((r) => seen.has(r.key)) : knownResources).map((r) => seen.get(r.key) ?? r);
    const more = [...seen.values()].filter((r) => !listed.some((l) => l.key === r.key));
    const all: Column['resource'][] = [...listed, ...more];
    if (none) all.push({ value: null, key: '', label: labels.noResource });
    return all.length ? all : [null];
  }

  // ---- drawing ----------------------------------------------------------------------------------------------

  const longDay = (d: Date) => format(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(d);
  const time = (d: Date) => format(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  const isToday = (d: Date) => sameDay(d, now());

  function drawTitle({ from, to }: Range) {
    const last = addDays(to, -1);
    if (view === 'day') title.textContent = format(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(from);
    else if (view === 'month') title.textContent = format(locale, { month: 'long', year: 'numeric' }).format(anchor);
    else {
      const days = format(locale, { day: 'numeric', month: 'short', year: 'numeric' });
      title.textContent = typeof days.formatRange === 'function' ? days.formatRange(from, last) : `${days.format(from)} – ${days.format(last)}`;
    }
    back.setAttribute('aria-label', labels.previous[view]);
    back.title = labels.previous[view];
    on.setAttribute('aria-label', labels.next[view]);
    on.title = labels.next[view];
    for (const button of viewButtons) button.setAttribute('aria-pressed', String(button.dataset['range'] === view));
  }

  function draw() {
    const active = doc.activeElement as HTMLElement | null;
    const focusKey = active && body.contains(active) ? active.dataset['focus'] : undefined;
    const shown = range();
    element.dataset['range'] = view;
    drawTitle(shown);
    note.hidden = total <= records.length;
    note.textContent = fill(labels.tooMany, { shown: records.length, total });
    if (failed) {
      const retry = make('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
      retry.addEventListener('click', () => void reload());
      body.replaceChildren(make('p', { class: 'fd-cal-failed', role: 'alert' }, labels.loadFailed, ' ', retry));
      return;
    }
    if (view === 'month') body.replaceChildren(monthView(shown));
    else if (view === 'agenda') body.replaceChildren(agendaView(shown));
    else body.replaceChildren(timeView(shown));
    if (focusKey) body.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`)?.focus();
    placeNow();
  }

  /**
   * A record's block: its time, its words, its person; what it says to a screen reader; what a press does. In the day,
   * the week and the month the block itself is the press; in the agenda, a row with its own Move to… button beside it,
   * which a phone has no keys for.
   */
  function eventBlock(event: CalendarEvent, day: Date, compact: boolean, inOwnColumn = false): HTMLElement {
    const movable = canSave && event.record.can?.edit !== false;
    const why = canSave && !movable ? (event.record.can?.reason ?? labels.cannotMove) : '';
    const span = event.allDay ? '' : fill(labels.fromTo, { from: time(event.start), to: time(event.end) });
    const who = event.resourceLabel ? fill(labels.withWho, { name: event.resourceLabel }) : '';
    const block = make('div', {
      class: 'fd-cal-event',
      'data-id': String(event.id),
      'data-opens': canOpen ? '' : undefined,
      'data-moves': movable ? '' : undefined,
      // Its words whole when pointed at, as a narrow block cuts them; or why it stays where it is.
      title: why || [span, event.title, event.resourceLabel].filter(Boolean).join(' · '),
    });
    block.style.setProperty('--fd-cal-c', colourOf(event.colour) ?? 'var(--fd-accent)');
    const row = view === 'agenda';
    /** What the keys and a press reach: the block, or the agenda row's own part. */
    const target = row ? make('div', { class: 'fd-cal-event-open' }) : block;
    target.dataset['focus'] = `e:${event.id}:${dayKey(day)}`;
    if (canOpen || movable) {
      target.tabIndex = 0;
      target.setAttribute('role', 'button');
      target.setAttribute('aria-describedby', keysEvent.id);
    }
    target.setAttribute('aria-label', [event.title, event.allDay ? longDay(event.start) : `${longDay(event.start)}, ${span}`, who, why].filter(Boolean).join(', '));
    if (!event.allDay) target.append(make('span', { class: 'fd-cal-event-time' }, row ? `${time(event.start)} – ${time(event.end)}` : time(event.start)), ' ');
    target.append(make('span', { class: 'fd-cal-event-title' }, make('bdi', {}, event.title)));
    if (event.resourceLabel && !compact && !inOwnColumn) target.append(make('span', { class: 'fd-cal-event-who' }, make('bdi', {}, event.resourceLabel)));
    if (row) block.append(target);
    if (movable) {
      // In a block, for a pointer alone: the keys reach Move to… by M, as the block tells a screen reader, and a
      // button inside a button is no button. Beside an agenda's row, a button of its own, for a phone too.
      const menu = row
        ? make('button', { type: 'button', class: 'fd-cal-event-menu', tabindex: '-1', 'aria-label': fill(labels.moveTitle, { name: event.title }), title: labels.moveTo }, '⋯')
        : make('button', { type: 'button', class: 'fd-cal-event-menu', tabindex: '-1', 'aria-hidden': 'true', title: labels.moveTo }, '⋯');
      menu.addEventListener('pointerdown', (e) => e.stopPropagation());
      menu.addEventListener('click', (e) => {
        e.stopPropagation();
        openMove(event, target);
      });
      block.append(menu);
    }
    target.addEventListener('keydown', (e) => onEventKey(e, event, target));
    if (!row) {
      block.addEventListener('pointerdown', (e) => pressEvent(e, event, block, movable));
      // A screen reader's press is a click with no pointer behind it: it opens the record as Enter does.
      block.addEventListener('click', (e) => {
        if (e.detail === 0 && e.target === block) onEventKey(new KeyboardEvent('keydown', { key: 'Enter' }), event, block, true);
      });
    } else target.addEventListener('click', () => open(event));
    return block;
  }

  // ---- the day and the week ------------------------------------------------------------------------------------

  let columns: Column[] = [];
  /** The hours shown: the page's, stretched to the records outside them. */
  let shownHours = hours;

  function timeView(shown: Range): HTMLElement {
    columns = view === 'day' && spec.resource ? resources.map((resource) => ({ day: shown.from, resource })) : shown.days.map((day) => ({ day, resource: null }));
    if (cursor.column >= columns.length || !sameDay(columns[cursor.column].day, cursor.day)) {
      const at = columns.findIndex((column) => sameDay(column.day, cursor.day));
      cursor = { ...cursor, column: Math.max(0, at), day: columns[Math.max(0, at)].day };
    }
    const timed = events.filter((event) => !event.allDay);
    let from = hours.start;
    let to = hours.end;
    for (const event of timed) {
      for (const column of columns) {
        const seg = segment(event, column.day);
        if (!seg) continue;
        from = Math.min(from, Math.floor(minutesOf(seg.start) / 60));
        to = Math.max(to, sameDay(seg.end, column.day) ? Math.ceil(minutesOf(seg.end) / 60) : 24);
      }
    }
    shownHours = { start: from, end: to };
    const grid = make('div', { class: 'fd-cal-grid' });
    grid.style.setProperty('--fd-cal-cols', String(columns.length));
    grid.style.setProperty('--fd-cal-span', String(to - from));
    grid.style.setProperty('--fd-cal-slot', String(slot));
    if (columns.length > 7 || (view === 'day' && spec.resource)) grid.style.setProperty('--fd-cal-min', '120px');
    // The heads: each day (a press shows it alone), or each person under the day.
    grid.append(make('div', { class: 'fd-cal-corner', 'aria-hidden': 'true' }));
    for (const column of columns) {
      const head = make('div', { class: 'fd-cal-head', 'aria-current': isToday(column.day) && !column.resource ? 'date' : undefined });
      if (column.resource) head.append(make('span', { class: 'fd-cal-head-who' }, make('bdi', {}, column.resource.label)));
      else {
        const button = make(
          'button',
          { type: 'button', class: 'fd-cal-head-day', 'aria-label': longDay(column.day) },
          make('span', {}, format(locale, { weekday: 'short' }).format(column.day)),
          make('span', { class: 'fd-cal-head-num' }, format(locale, { day: 'numeric' }).format(column.day))
        );
        if (view === 'week' && views.includes('day')) button.addEventListener('click', () => showView('day', column.day));
        else button.tabIndex = -1;
        head.append(button);
      }
      grid.append(head);
    }
    // A whole day's records over the hours; for a calendar of days alone, the whole of it.
    const daysOnly = kind === 'date';
    const allDay = events.filter((event) => event.allDay);
    if (daysOnly || allDay.length) {
      grid.append(make('div', { class: 'fd-cal-corner' }, labels.allDay));
      columns.forEach((column, i) => {
        const cell = make('div', { class: 'fd-cal-allday', 'data-day': dayKey(column.day), 'data-column': String(i), 'data-alone': daysOnly ? '' : undefined });
        for (const event of allDay) if (covers(event, column.day) && inColumn(event, column)) cell.append(eventBlock(event, column.day, true));
        cell.addEventListener('pointerdown', (e) => {
          if (e.target !== cell || !canCreate || e.button !== 0) return;
          void createAt(column.day, null, column, true);
        });
        grid.append(cell);
      });
    }
    if (daysOnly) return make('div', { class: 'fd-cal-scroll' }, grid);
    // The hours down the side, then a column of slots for each day or person, its records over them.
    const side = make('div', { class: 'fd-cal-hours', 'aria-hidden': 'true' });
    for (let h = from; h < to; h++) {
      const label = make('span', { class: 'fd-cal-hour' }, time(atMinutes(new Date(2026, 0, 1), h * 60)));
      label.style.top = `${(h - from) * HOUR}px`;
      side.append(label);
    }
    grid.append(side);
    columns.forEach((column, i) => {
      const col = make('div', {
        class: 'fd-cal-col',
        role: 'group',
        'aria-label': [longDay(column.day), column.resource?.label].filter(Boolean).join(', '),
        'data-column': String(i),
        'data-day': dayKey(column.day),
        'data-today': isToday(column.day) ? '' : undefined,
      });
      if (canCreate) {
        for (let m = from * 60; m < to * 60; m += slot) {
          const at = atMinutes(column.day, m);
          const busy = timed.filter((event) => event.start <= at && event.end > at && inColumn(event, column)).length;
          const words = [longDay(column.day), time(at), column.resource?.label, busy ? (busy === 1 ? labels.holdsOne : fill(labels.holds, { n: busy })) : labels.free].filter(Boolean).join(', ');
          const cell = make('div', { class: 'fd-cal-slot', role: 'button', tabindex: '-1', 'data-minutes': String(m), 'data-focus': `s:${i}:${m}`, 'aria-label': words, 'aria-describedby': keysSlot.id });
          cell.addEventListener('keydown', (e) => onSlotKey(e, i, m));
          // A screen reader's press, with no pointer behind it: a new record there, as Enter makes one.
          cell.addEventListener('click', (e) => {
            if (e.detail === 0) void createAt(atMinutes(column.day, m), null, column);
          });
          cell.addEventListener('focus', () => (cursor = { day: column.day, minutes: m, column: i }));
          col.append(cell);
        }
        col.addEventListener('pointerdown', (e) => pressSlot(e, col, i));
      }
      const mine = timed.flatMap((event) => {
        const seg = segment(event, column.day);
        return seg && inColumn(event, column) ? [{ event, ...seg }] : [];
      });
      const placed = sideBySide(mine.map(({ event, start, end }) => ({ id: event.id, start, end })));
      for (const { event, start, end } of mine) {
        // In a person's own column, the block need not name them again.
        const block = eventBlock(event, column.day, false, !!column.resource);
        const top = (minutesOf(start) - from * 60) * (HOUR / 60);
        const length = (sameDay(end, column.day) ? minutesOf(end) : 24 * 60) - minutesOf(start);
        const height = Math.max(TARGET, length * (HOUR / 60) - 2);
        const place = placed.get(event.id) ?? { column: 0, columns: 1 };
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.insetInlineStart = `calc(${(place.column / place.columns) * 100}% + 1px)`;
        block.style.width = `calc(${100 / place.columns}% - 3px)`;
        if (height < 36) block.setAttribute('data-short', '');
        // Its end stretches, when it has one to write and it ends on this day.
        if (block.hasAttribute('data-moves') && spec.end && sameDay(end, column.day) && sameDay(start, event.start)) {
          const grip = make('span', { class: 'fd-cal-resize', 'aria-hidden': 'true' });
          grip.addEventListener('pointerdown', (e) => stretch(e, event, block, col));
          block.append(grip);
        }
        col.append(block);
      }
      grid.append(col);
    });
    // The slots' one stop: where the cursor is.
    const stop = grid.querySelector<HTMLElement>(`[data-focus="s:${cursor.column}:${clampMinutes(cursor.minutes)}"]`) ?? grid.querySelector<HTMLElement>('.fd-cal-slot');
    if (stop) stop.tabIndex = 0;
    return make('div', { class: 'fd-cal-scroll' }, grid);
  }

  const clampMinutes = (m: number) => Math.min(Math.max(shownHours.start * 60, m - (m % slot)), shownHours.end * 60 - slot);
  /** The part of an event on one day. */
  function segment(event: CalendarEvent, day: Date): { start: Date; end: Date } | null {
    const dayStart = startOfDay(day);
    const dayEnd = addDays(dayStart, 1);
    if (event.end <= dayStart || event.start >= dayEnd) return null;
    return { start: event.start > dayStart ? event.start : dayStart, end: event.end < dayEnd ? event.end : dayEnd };
  }
  const covers = (event: CalendarEvent, day: Date) => !!segment(event, day);
  const inColumn = (event: CalendarEvent, column: Column) => !column.resource || column.resource.key === (event.resource ?? '');

  // ---- the month -----------------------------------------------------------------------------------------------

  function monthView(shown: Range): HTMLElement {
    const grid = make('div', { class: 'fd-cal-month' });
    for (const day of shown.days.slice(0, 7)) grid.append(make('div', { class: 'fd-cal-weekday', 'aria-hidden': 'true' }, format(locale, { weekday: 'short' }).format(day)));
    const cursorKey = shown.days.some((d) => sameDay(d, cursor.day)) ? dayKey(cursor.day) : dayKey(shown.days.find(isToday) ?? anchor);
    for (const day of shown.days) {
      const mine = events.filter((event) => covers(event, day));
      const cell = make('div', { class: 'fd-cal-day', 'data-day': dayKey(day), 'data-out': day.getMonth() !== anchor.getMonth() ? '' : undefined, 'aria-current': isToday(day) ? 'date' : undefined });
      const number = make(
        'button',
        { type: 'button', class: 'fd-cal-daynum', tabindex: dayKey(day) === cursorKey ? '0' : '-1', 'data-focus': `d:${dayKey(day)}`, 'aria-label': [longDay(day), mine.length ? (mine.length === 1 ? labels.holdsOne : fill(labels.holds, { n: mine.length })) : ''].filter(Boolean).join(', '), 'aria-describedby': keysDay.id },
        format(locale, { day: 'numeric' }).format(day)
      );
      number.addEventListener('click', () => (views.includes('day') ? showView('day', day) : undefined));
      number.addEventListener('keydown', (e) => onDayKey(e, day));
      number.addEventListener('focus', () => (cursor = { ...cursor, day }));
      cell.append(number);
      for (const event of mine.slice(0, IN_A_DAY)) cell.append(eventBlock(event, day, true));
      if (mine.length > IN_A_DAY) {
        const n = mine.length - IN_A_DAY;
        const more = make('button', { type: 'button', class: 'fd-cal-more', 'aria-label': fill(labels.moreOn, { n, when: longDay(day) }) }, fill(labels.more, { n }));
        more.addEventListener('click', () => (views.includes('day') ? showView('day', day) : showView(views.includes('agenda') ? 'agenda' : view, day)));
        cell.append(more);
      }
      cell.addEventListener('pointerdown', (e) => {
        if (e.target !== cell || !canCreate || e.button !== 0) return;
        void createAt(day, null, null, kind === 'date');
      });
      grid.append(cell);
    }
    return grid;
  }

  // ---- the agenda ---------------------------------------------------------------------------------------------

  function agendaView(shown: Range): HTMLElement {
    const list = make('div', { class: 'fd-cal-agenda' });
    for (const day of shown.days) {
      const mine = events.filter((event) => covers(event, day));
      if (!mine.length) continue;
      const items = make('ul', { class: 'fd-cal-agenda-list' });
      for (const event of mine) items.append(make('li', {}, eventBlock(event, day, false)));
      list.append(make('section', { class: 'fd-cal-agenda-day', 'aria-current': isToday(day) ? 'date' : undefined, 'aria-label': longDay(day) }, make('h3', { class: 'fd-cal-agenda-head' }, longDay(day)), items));
    }
    if (!list.childElementCount) list.append(make('p', { class: 'fd-cal-empty' }, labels.nothing));
    return list;
  }

  // ---- now --------------------------------------------------------------------------------------------------

  /** The line across today's columns at this minute, moved on each minute. */
  function placeNow() {
    for (const old of body.querySelectorAll('.fd-cal-now')) old.remove();
    if (view !== 'day' && view !== 'week') return;
    const at = now();
    const minutes = minutesOf(at);
    if (minutes < shownHours.start * 60 || minutes >= shownHours.end * 60) return;
    for (const col of body.querySelectorAll<HTMLElement>('.fd-cal-col[data-today]')) {
      const line = make('div', { class: 'fd-cal-now', 'aria-hidden': 'true' });
      line.style.top = `${(minutes - shownHours.start * 60) * (HOUR / 60)}px`;
      col.append(line);
    }
  }
  const ticking = setInterval(placeNow, 60000);

  // ---- going somewhere ------------------------------------------------------------------------------------------

  function go(day: Date) {
    anchor = startOfDay(day);
    cursor = { ...cursor, day: anchor, column: 0 };
    void reload();
  }

  function showView(next: CalendarView, day?: Date) {
    view = next;
    if (day) anchor = startOfDay(day);
    cursor = { ...cursor, day: day ? startOfDay(day) : cursor.day, column: 0 };
    void reload();
  }

  // ---- making a record --------------------------------------------------------------------------------------

  /** Where New puts a record: the slot the keys stand on, else the next whole hour today in the span, else its first day. */
  function newPlace(): [Date, Date | null, Column | null, boolean] {
    const shown = range();
    if ((view === 'day' || view === 'week') && kind === 'datetime' && body.querySelector('.fd-cal-slot')) {
      const column = columns[cursor.column] ?? columns[0];
      return [atMinutes(column.day, clampMinutes(cursor.minutes)), null, column, false];
    }
    const at = now();
    const inSpan = at >= shown.from && at < shown.to;
    const day = inSpan ? startOfDay(at) : shown.from;
    if (kind === 'date') return [day, null, null, true];
    const minutes = inSpan ? Math.min(Math.max(hours.start * 60, (Math.floor(minutesOf(at) / 60) + 1) * 60), (hours.end - 1) * 60) : hours.start * 60;
    return [atMinutes(day, minutes), null, null, false];
  }

  /** A new record from `start` (to `end`, or an hour on; the whole day for a day's), with its column's person. */
  async function createAt(start: Date, end: Date | null, column: Column | null, wholeDay = false) {
    if (!context.create) return;
    const values: Values = {};
    if (kind === 'date') {
      values[spec.start] = writeWhen(start, 'date');
      if (spec.end) values[spec.end] = writeWhen(end ? addDays(end, -1) : start, 'date');
    } else {
      const from = wholeDay ? startOfDay(start) : start;
      const until = end ?? (wholeDay ? addDays(from, 1) : addMinutes(from, NEW_LENGTH));
      values[spec.start] = writeWhen(from, 'datetime');
      if (spec.end) values[spec.end] = writeWhen(until, 'datetime');
    }
    if (spec.resource && column?.resource && column.resource.key !== '') values[spec.resource] = column.resource.value;
    await context.create(values);
  }

  /** A press on an empty slot: a new record there, or, dragged down or up, over the slots it crossed. */
  function pressSlot(e: PointerEvent, col: HTMLElement, i: number) {
    const target = e.target as HTMLElement;
    if (e.button !== 0 || !target.classList.contains('fd-cal-slot')) return;
    e.preventDefault();
    const top = col.getBoundingClientRect().top;
    const minutesAt = (y: number) => Math.min(Math.max(shownHours.start * 60, shownHours.start * 60 + Math.floor((y - top) / (HOUR / 60) / slot) * slot), shownHours.end * 60 - slot);
    const first = Number(target.dataset['minutes']);
    let last = first;
    const picking = make('div', { class: 'fd-cal-picking' });
    const drawPick = () => {
      const [a, b] = [Math.min(first, last), Math.max(first, last) + slot];
      picking.style.top = `${(a - shownHours.start * 60) * (HOUR / 60)}px`;
      picking.style.height = `${(b - a) * (HOUR / 60)}px`;
    };
    drawPick();
    col.append(picking);
    const move = (m: PointerEvent) => {
      last = minutesAt(m.clientY);
      drawPick();
    };
    const up = () => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      picking.remove();
      const column = columns[i];
      const [a, b] = [Math.min(first, last), Math.max(first, last) + slot];
      const dragged = a !== first || b !== first + slot;
      void createAt(atMinutes(column.day, a), dragged ? atMinutes(column.day, b) : null, column);
    };
    const cancel = () => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      picking.remove();
    };
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', cancel);
  }

  // ---- opening, moving, stretching ------------------------------------------------------------------------------

  function open(event: CalendarEvent) {
    if (!context.open) return;
    const answer = context.open(event.id);
    if (answer instanceof Promise) void answer.then(() => (destroyed ? undefined : reload()));
  }

  /**
   * A press on a record: a click opens it; a drag moves it — to another time, day or person — where it is let go,
   * by the slot; Escape while dragging puts it back.
   */
  function pressEvent(e: PointerEvent, event: CalendarEvent, block: HTMLElement, movable: boolean) {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('.fd-cal-resize, .fd-cal-event-menu')) return;
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const home = block.parentElement as HTMLElement;
    const timedHere = home.classList.contains('fd-cal-col');
    const homeTop = timedHere ? home.getBoundingClientRect().top : 0;
    /** Minutes between the record's start (on this day) and where it was taken hold of. */
    const day = new Date(`${(block.dataset['focus'] ?? '').split(':').pop()}T00:00:00`);
    const segStart = segment(event, day)?.start ?? event.start;
    const grabbed = timedHere ? Math.round((startY - homeTop) / (HOUR / 60)) - (minutesOf(segStart) - shownHours.start * 60) : 0;
    /** How far into the record this day's part begins: a record from the night before is taken by its morning's part. */
    const into = Math.round((segStart.getTime() - event.start.getTime()) / 60000);
    let moving = false;
    let landing: { start: Date; column: Column | null } | null = null;
    const move = (m: PointerEvent) => {
      if (!movable) return;
      if (!moving && Math.hypot(m.clientX - startX, m.clientY - startY) < DRAG_FROM) return;
      if (!moving) {
        moving = true;
        block.setAttribute('data-moving', '');
      }
      landing = landingAt(m.clientX, m.clientY, event, timedHere, grabbed, block);
      if (landing && into) landing = { ...landing, start: addMinutes(landing.start, -into) };
    };
    const finish = (commitIt: boolean) => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      doc.removeEventListener('keydown', escape, true);
      if (!moving) return;
      block.removeAttribute('data-moving');
      if (!commitIt || !landing) return draw();
      const values = moved(event, landing.start, spec, page, landing.column?.resource ?? undefined);
      void commit(event, values, fill(labels.moved, { name: event.title, when: whereTo(event, landing.start, locale) }));
    };
    const up = () => {
      const wasMoving = moving;
      finish(true);
      if (!wasMoving) open(event);
    };
    const cancel = () => finish(false);
    const escape = (k: KeyboardEvent) => {
      if (k.key !== 'Escape') return;
      k.preventDefault();
      k.stopPropagation();
      finish(false);
    };
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', cancel);
    doc.addEventListener('keydown', escape, true);
  }

  /** Where a record dragged to (x, y) lands: a day's column and the slot under it, or a day (a whole day's record, the month). */
  function landingAt(x: number, y: number, event: CalendarEvent, timed: boolean, grabbed: number, block: HTMLElement): { start: Date; column: Column | null } | null {
    const under = doc.elementFromPoint(x, y) as HTMLElement | null;
    if (timed) {
      const col = under?.closest<HTMLElement>('.fd-cal-col');
      if (!col || !body.contains(col)) return null;
      const column = columns[Number(col.dataset['column'])];
      const top = col.getBoundingClientRect().top;
      const length = Math.round((event.end.getTime() - event.start.getTime()) / 60000);
      let minutes = shownHours.start * 60 + Math.round(((y - top) / (HOUR / 60) - grabbed) / slot) * slot;
      minutes = Math.min(Math.max(0, minutes), 24 * 60 - Math.min(length, slot));
      const start = atMinutes(column.day, minutes);
      // It shows where it would land: in that column, at that time.
      if (block.parentElement !== col) col.append(block);
      block.style.top = `${(minutes - shownHours.start * 60) * (HOUR / 60)}px`;
      block.style.insetInlineStart = '1px';
      block.style.width = 'calc(100% - 3px)';
      const shownTime = block.querySelector('.fd-cal-event-time');
      if (shownTime) shownTime.textContent = time(start);
      return { start, column };
    }
    const cell = under?.closest<HTMLElement>('[data-day]');
    if (!cell || !body.contains(cell) || cell.classList.contains('fd-cal-col')) return null;
    const [y4, mo, d] = (cell.dataset['day'] ?? '').split('-').map(Number);
    const start = new Date(y4, mo - 1, d, event.start.getHours(), event.start.getMinutes());
    if (block.parentElement !== cell) cell.append(block);
    const column = cell.dataset['column'] !== undefined ? (columns[Number(cell.dataset['column'])] ?? null) : null;
    return { start, column };
  }

  /** Its end dragged: a longer or shorter record, by the slot, never shorter than one. */
  function stretch(e: PointerEvent, event: CalendarEvent, block: HTMLElement, col: HTMLElement) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const top = col.getBoundingClientRect().top;
    const startMinutes = minutesOf(event.start);
    let end = event.end;
    let moving = false;
    const move = (m: PointerEvent) => {
      moving = true;
      block.setAttribute('data-moving', '');
      const minutes = Math.max(startMinutes + slot, Math.min(24 * 60, shownHours.start * 60 + Math.round((m.clientY - top) / (HOUR / 60) / slot) * slot));
      end = atMinutes(event.start, minutes);
      block.style.height = `${(minutes - startMinutes) * (HOUR / 60) - 2}px`;
    };
    const up = () => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      block.removeAttribute('data-moving');
      if (!moving || end.getTime() === event.end.getTime()) return draw();
      void commit(event, moved(event, event.start, spec, page, undefined, end), fill(labels.stretched, { name: event.title, when: time(end) }));
    };
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
  }

  /**
   * Write a move through the data source's save — at once on the page, put back if the save is refused — and offer
   * Undo, which writes back what it held.
   */
  async function commit(event: CalendarEvent, values: Values, words: string) {
    if (!source?.save || !Object.keys(values).length) return draw();
    const record = event.record;
    const before: Values = Object.fromEntries(Object.keys(values).map((key) => [key, record.values[key] ?? null]));
    const after: ListedRecord = { ...record, values: { ...record.values, ...values } };
    records = records.map((r) => (r === record ? after : r));
    events = eventsOf(records, spec, page, locale);
    draw();
    for (const block of body.querySelectorAll<HTMLElement>('.fd-cal-event')) if (block.dataset['id'] === String(event.id)) block.setAttribute('aria-busy', 'true');
    say('');
    alert.replaceChildren();
    try {
      const result = await source.save({ model, id: event.id, fields: page.fields, changes: { values, lines: {}, links: {} }, values: after.values, ...(record.version ? { version: record.version } : {}) });
      undo = { record: { ...after, ...(result.version ? { version: result.version } : {}) }, values: before, ...(result.version ? { version: result.version } : {}), name: event.title };
      say(words, true);
    } catch (error) {
      records = records.map((r) => (r === after ? record : r));
      events = eventsOf(records, spec, page, locale);
      const problem = saveProblemOf(error);
      const why = problem.message || Object.values(problem.fields ?? {}).join(' ');
      alert.textContent = fill(labels.notMoved, { why });
      draw();
    }
    if (!destroyed) await reload();
  }

  async function undoLast() {
    const last = undo;
    if (!last || !source?.save) return;
    undo = null;
    say('');
    try {
      await source.save({ model, id: last.record.id, fields: page.fields, changes: { values: last.values, lines: {}, links: {} }, values: { ...last.record.values, ...last.values }, ...(last.version ? { version: last.version } : {}) });
      say(labels.undone);
    } catch (error) {
      alert.textContent = fill(labels.notMoved, { why: saveProblemOf(error).message });
    }
    if (!destroyed) await reload();
  }

  /** Words in the status line, with Undo after a move and a way to close them. */
  function say(words: string, withUndo = false) {
    said.replaceChildren();
    if (!words) return;
    said.append(make('span', {}, words));
    if (withUndo) {
      const undoButton = make('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.undo);
      undoButton.addEventListener('click', () => void undoLast());
      said.append(undoButton);
    }
    const close = make('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-label': labels.close, title: labels.close }, '×');
    close.addEventListener('click', () => said.replaceChildren());
    said.append(close);
  }

  // ---- "Move to…": the keyboard's way to move ----------------------------------------------------------------

  let moveBox: HTMLElement | null = null;

  function closeMove(back?: HTMLElement) {
    moveBox?.remove();
    moveBox = null;
    doc.removeEventListener('pointerdown', outside, true);
    back?.focus();
  }
  const outside = (e: PointerEvent) => {
    if (moveBox && !moveBox.contains(e.target as Node)) closeMove();
  };

  function openMove(event: CalendarEvent, block: HTMLElement) {
    closeMove();
    /** The record again, wherever it now is: on the same day, else its first. */
    const focusBack = () => body.querySelector<HTMLElement>(`[data-focus="${block.dataset['focus']}"]`) ?? body.querySelector<HTMLElement>(`[data-focus^="e:${event.id}:"]`) ?? block;
    const heading = make('h3', { class: 'fd-cal-move-title', id: `${id}-move` }, fill(labels.moveTitle, { name: event.title }));
    const day = make('input', { type: 'date', class: 'fd-input' }) as HTMLInputElement;
    day.value = dayKey(event.start);
    const at = make('input', { type: 'time', class: 'fd-input', step: String(slot * 60) }) as HTMLInputElement;
    at.value = `${String(event.start.getHours()).padStart(2, '0')}:${String(event.start.getMinutes()).padStart(2, '0')}`;
    const who = make('select', { class: 'fd-input fd-select' }) as HTMLSelectElement;
    const people = resources.filter((r): r is NonNullable<Column['resource']> => !!r);
    for (const person of people) who.append(make('option', { value: person.key }, person.label));
    who.value = event.resource ?? '';
    const moveButton = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.move);
    const cancel = make('button', { type: 'button', class: 'fd-button' }, labels.cancel);
    const rows: Node[] = [heading, make('label', {}, labels.moveDay, day)];
    if (!event.allDay) rows.push(make('label', {}, labels.moveTime, at));
    if (spec.resource && people.length) rows.push(make('label', {}, page.fields[spec.resource]?.label ?? '', who));
    rows.push(make('div', { class: 'fd-cal-move-actions' }, cancel, moveButton));
    const box = make('div', { class: 'fd-cal-move', role: 'dialog', 'aria-labelledby': heading.id }, ...rows);
    moveBox = box;
    element.append(box);
    // Under the record, kept inside the calendar.
    const room = element.getBoundingClientRect();
    const mark = block.getBoundingClientRect();
    box.style.top = `${Math.max(0, mark.bottom - room.top + 4)}px`;
    box.style.insetInlineStart = `${Math.max(8, Math.min(rtl() ? room.right - mark.right : mark.left - room.left, room.width - 328))}px`;
    box.scrollIntoView?.({ block: 'nearest' });
    day.focus();
    const apply = () => {
      const [y4, mo, d] = day.value.split('-').map(Number);
      if (!y4 || !mo || !d) return day.focus();
      const [hh, mm] = (at.value || '00:00').split(':').map(Number);
      const start = event.allDay ? new Date(y4, mo - 1, d) : new Date(y4, mo - 1, d, hh || 0, mm || 0);
      const person = people.find((p) => p.key === who.value);
      const values = moved(event, start, spec, page, person ?? undefined);
      closeMove();
      if (!Object.keys(values).length) return focusBack().focus();
      void commit(event, values, fill(labels.moved, { name: event.title, when: whereTo(event, start, locale) })).then(() => focusBack().focus());
    };
    moveButton.addEventListener('click', apply);
    cancel.addEventListener('click', () => closeMove(focusBack()));
    box.addEventListener('keydown', (k) => {
      if (k.key === 'Escape') {
        k.preventDefault();
        k.stopPropagation();
        closeMove(focusBack());
      } else if (k.key === 'Enter' && (k.target as HTMLElement).tagName === 'INPUT') {
        k.preventDefault();
        apply();
      }
    });
    doc.addEventListener('pointerdown', outside, true);
  }

  // ---- the keys -------------------------------------------------------------------------------------------------

  /** Left and right as the line reads: flipped right to left. */
  const sideways = (key: string) => (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0) * (rtl() ? -1 : 1);

  function onEventKey(e: KeyboardEvent, event: CalendarEvent, block: HTMLElement, pressed = false) {
    if (!pressed && e.target !== block) return;
    const movable = !!block.closest('.fd-cal-event')?.hasAttribute('data-moves');
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (canOpen) open(event);
      else if (movable) openMove(event, block);
    } else if (movable && (e.key === 'm' || e.key === 'M' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) {
      e.preventDefault();
      openMove(event, block);
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const all = [...body.querySelectorAll<HTMLElement>('[data-focus^="e:"][tabindex="0"]')];
      if (view === 'agenda' || view === 'month' || !e.key.includes('Left') && !e.key.includes('Right')) {
        // Up and down: the record before or after, in the order they are read.
        const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : sideways(e.key);
        if (view === 'day' || view === 'week') {
          const here = all.filter((b) => b.parentElement === block.parentElement).sort((a, b) => a.offsetTop - b.offsetTop || all.indexOf(a) - all.indexOf(b));
          here[here.indexOf(block) + step]?.focus();
        } else all[all.indexOf(block) + step]?.focus();
        return;
      }
      // Left and right: the day or person beside, at the same time.
      const col = block.closest<HTMLElement>('[data-column]');
      const next = Number(col?.dataset['column'] ?? 0) + sideways(e.key);
      const minutes = clampMinutes(minutesOf(event.start));
      const target = body.querySelector<HTMLElement>(`[data-focus="s:${next}:${minutes}"]`) ?? body.querySelector<HTMLElement>(`[data-column="${next}"] [data-focus^="e:"][tabindex="0"]`);
      target?.focus();
    }
  }

  function onSlotKey(e: KeyboardEvent, column: number, minutes: number) {
    let next = { column, minutes };
    if (e.key === 'ArrowUp') next.minutes -= slot;
    else if (e.key === 'ArrowDown') next.minutes += slot;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') next.column += sideways(e.key);
    else if (e.key === 'Home') next.minutes = shownHours.start * 60;
    else if (e.key === 'End') next.minutes = shownHours.end * 60 - slot;
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      cursor = { ...cursor, day: stepFrom(view, columns[column].day, e.key === 'PageUp' ? -1 : 1), minutes };
      anchor = startOfDay(cursor.day);
      void reload().then(() => body.querySelector<HTMLElement>('.fd-cal-slot[tabindex="0"]')?.focus());
      return;
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const col = columns[column];
      void createAt(atMinutes(col.day, minutes), null, col);
      return;
    } else return;
    e.preventDefault();
    // Past the first or the last column: the span before or after.
    if (next.column < 0 || next.column >= columns.length) {
      if (view === 'day' && spec.resource) return;
      const by = next.column < 0 ? -1 : 1;
      const day = addDays(columns[column].day, by);
      cursor = { day, minutes, column: by < 0 ? 6 : 0 };
      anchor = startOfDay(day);
      void reload().then(() => body.querySelector<HTMLElement>('.fd-cal-slot[tabindex="0"]')?.focus());
      return;
    }
    next = { column: next.column, minutes: clampMinutes(next.minutes) };
    const target = body.querySelector<HTMLElement>(`[data-focus="s:${next.column}:${next.minutes}"]`);
    if (!target) return;
    for (const cell of body.querySelectorAll<HTMLElement>('.fd-cal-slot[tabindex="0"]')) cell.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
    target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }

  function onDayKey(e: KeyboardEvent, day: Date) {
    let by: number;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') by = sideways(e.key);
    else if (e.key === 'ArrowUp') by = -7;
    else if (e.key === 'ArrowDown') by = 7;
    else if (e.key === 'Home') by = -((day.getDay() - firstDay + 7) % 7);
    else if (e.key === 'End') by = 6 - ((day.getDay() - firstDay + 7) % 7);
    else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      const next = stepFrom('month', day, e.key === 'PageUp' ? -1 : 1);
      cursor = { ...cursor, day: next };
      anchor = startOfDay(next);
      void reload().then(() => body.querySelector<HTMLElement>(`[data-focus="d:${dayKey(next)}"]`)?.focus());
      return;
    } else return;
    e.preventDefault();
    const next = addDays(day, by);
    cursor = { ...cursor, day: next };
    const target = body.querySelector<HTMLElement>(`[data-focus="d:${dayKey(next)}"]`);
    if (target) {
      for (const n of body.querySelectorAll<HTMLElement>('.fd-cal-daynum[tabindex="0"]')) n.tabIndex = -1;
      target.tabIndex = 0;
      target.focus();
      return;
    }
    // Into the month before or after.
    anchor = startOfDay(next);
    void reload().then(() => body.querySelector<HTMLElement>(`[data-focus="d:${dayKey(next)}"]`)?.focus());
  }

  drawTitle(range());
  return {
    element,
    reload,
    highlight(recordId) {
      for (const block of body.querySelectorAll('.fd-cal-event')) block.classList.toggle('fd-cal-hot', recordId !== null && (block as HTMLElement).dataset['id'] === String(recordId));
    },
    chosenChanged() {
      // A calendar has no boxes to choose a record: what is chosen is the table's.
    },
    shown() {
      placeNow();
    },
    destroy() {
      destroyed = true;
      clearInterval(ticking);
      closeMove();
      element.remove();
    },
  };
}
