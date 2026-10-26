import { isOwnZone, recordSentence, saveProblemOf, type CalendarView, type Fields, type ListCalendar, type ListedRecord, type RecordId, type RecordVersion, type ResolvedFilter, type SaveRequest, type Value, type Values } from '@fieldia/core';
import type { ListViewContext, ListViewPart } from '@fieldia/viewer';
import { moneyReads, startLoading, zoneName } from '@fieldia/widgets';
import { linesIn, maker, type CalendarCore, type CalendarState, type Column } from './calendar-core';
import { addDays, addMinutes, atMinutes, dayKey, dayOn, firstDayOf, format, minutesOf, rangeOf, sameDay, startOfDay, stepFrom, fromWall, toWall, writeWhen, zoneOfCalendar, type Range } from './dates';
import { colourOf, comma, eventsOf, keyOf, kindOf, sideBySide, type CalendarEvent, type Resource } from './events';
import { pressEvent, pressSlot, stretch } from './gestures';
import { onDayKey, onEventKey, onSlotKey } from './keys';
import { calendarLabels, fill, type CalendarLabels } from './labels';
import { moveTo, placeUnder } from './move-to';
import type { CalendarSettings } from './settings';
import { installCalendarStyles } from './styles';

/** Its words, fetched first where they come in a chunk of their own (Turkish, Persian, Urdu, Spanish). */
export { calendarWordsReady } from './labels';

const ALL_VIEWS: CalendarView[] = ['day', 'week', 'month', 'agenda'];
/** The least a slot or a record is tall, so a finger or a pointer can hit it (WCAG's 24 pixels). */
const TARGET = 24;
/** How long a record pressed into an empty slot lasts, in minutes. */
const NEW_LENGTH = 60;
/** How many records a month's day shows before "+2 more". */
const IN_A_DAY = 3;
/** The narrowest a record beside others may be, in pixels, and still show its name's start: past it, "+N more". */
const LANE = 64;
/** How many sit side by side where no width is measured (a calendar not yet laid out): two, and "+N more" in the third. */
const LANES = 3;
/** Back and on, as the line reads left to right: flipped right to left by the stylesheet. */
const CHEVRON = (back: boolean) => `<path d="${back ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;

let made = 0;

/**
 * A list's records on a calendar, for the list's switcher: the list's own
 * search, its records by day, week or month, or as an agenda; a column for
 * each person or room in the day view; dragged to move and stretched by
 * their end (gestures.ts), or moved from the keyboard (keys.ts) with "Move
 * to…" (move-to.ts), written through the data source's save with Undo; an
 * empty slot pressed for a new record.
 */
export function calendarPart(context: ListViewContext, settings: CalendarSettings = {}, firstNow = false): ListViewPart {
  const { page, node, document: doc, locale } = context;
  const spec = node.calendar as ListCalendar;
  const source = context.dataSource;
  const model = page.data.kind === 'record' ? page.data.model : '';
  const labels: CalendarLabels = calendarLabels(locale, settings.labels?.[locale]);
  /** One of its sentences in the words the list's page names its records by (`records`), else as it says them plainly. */
  const sentence = (noun: string | undefined, words: string, values?: Record<string, string | number>) => recordSentence(page.records, noun, words, locale, values);
  const holds = (n: number) => (n === 1 ? sentence(labels.holdsNounOne, labels.holdsOne) : sentence(labels.holdsNoun, labels.holds, { n }));
  const kind = kindOf(page, spec);
  /** The zone its clock is: its start's, else its page's, else the reader's own (dates.ts). */
  const zone = zoneOfCalendar(page, spec);
  /** The moment it is now (the app's, as a demo or a test pins it), on the calendar's clock: today is that zone's day. */
  const now = () => toWall(settings.now?.() ?? new Date(), zone);
  const views = (spec.views?.length ? spec.views : ALL_VIEWS).filter((v, i, all) => all.indexOf(v) === i);
  const firstDay = firstDayOf(locale, page, spec.firstDay);
  const slot = spec.slot ?? 30;
  /** Pixels an hour takes in the day and the week (--fd-cal-hour): 48, or more where a slot would be under 24 pixels. */
  const HOUR = Math.max(48, Math.ceil((TARGET * 60) / slot));
  const hours = spec.hours ?? { start: 8, end: 20 };
  const limit = settings.limit ?? 500;
  const id = `fd-cal-${++made}`;
  const rtl = () => element.closest('[dir]')?.getAttribute('dir') === 'rtl';
  const phone = !!doc.defaultView?.matchMedia?.('(max-width: 640px)').matches;
  const opened = startOfDay(now());
  /** What it shows now: its view, its span, the keys' stop, its columns and hours as drawn, its people. */
  const state: CalendarState = {
    view: phone && views.includes('agenda') ? 'agenda' : spec.view && views.includes(spec.view) ? spec.view : views[0],
    anchor: opened,
    cursor: { day: opened, minutes: hours.start * 60, column: 0 },
    columns: [],
    shownHours: hours,
    resources: [],
  };
  let records: ListedRecord[] = [];
  let events: CalendarEvent[] = [];
  let total = 0;
  let knownResources: (Resource & { label: string })[] | null = null;
  let asking = 0;
  let destroyed = false;
  let failed = false;
  /** What Undo writes back, the version the record holds after the move, and the moment it started at before. */
  let undo: { record: ListedRecord; values: Values; version?: RecordVersion; at: Date } | null = null;
  /** Whether the person put the keys on a slot (a slot took the focus): New makes its record there. */
  let chosen = false;
  /** The fields a move writes. When the page locks one, nothing moves; when a record's source locks or hides one, that record stays. */
  const moveFields = [spec.start, spec.end, spec.resource].filter((name): name is string => !!name);
  const canSave = !!source?.save && !moveFields.some((name) => page.fields[name]?.readonly);
  const canCreate = !!context.create;
  const canOpen = !!context.open;
  const fields = [...new Set([spec.start, spec.end, spec.title, spec.colour, spec.resource, ...moneyReads(page.fields[spec.title])].filter((name): name is string => !!name && !!page.fields[name]))];

  installCalendarStyles(doc);
  const make = maker(doc);
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
  const newButton = make('button', { type: 'button', class: 'fd-button fd-button-primary fd-cal-new' }, sentence(labels.newRecordNoun, labels.newRecord));
  newButton.hidden = !canCreate;
  today.addEventListener('click', () => go(startOfDay(now())));
  back.addEventListener('click', () => go(stepFrom(state.view, state.anchor, -1)));
  on.addEventListener('click', () => go(stepFrom(state.view, state.anchor, 1)));
  newButton.addEventListener('click', () => void createAt(...newPlace()));
  // The zone its times are on, where it is not the reader's own: its short name ("CEST"), its long one read out.
  const shownZone = zone && !isOwnZone(zone) ? make('span', { class: 'fd-cal-zone', role: 'note' }) : null;
  const nameZone = (at = (settings.now?.() ?? new Date()).getTime()) => {
    if (!shownZone || !zone) return;
    shownZone.textContent = zoneName(at, zone, locale);
    shownZone.title = zoneName(at, zone, locale, 'longGeneric');
    shownZone.setAttribute('aria-label', shownZone.title);
  };
  nameZone();
  const bar = make('div', { class: 'fd-cal-bar' }, make('div', { class: 'fd-cal-nav', role: 'group', 'aria-label': labels.moveThrough }, today, back, on), title, ...(shownZone ? [shownZone] : []), ranges, newButton);

  // What a move says, with Undo; what went wrong, at once; how many it shows, when it cannot show all.
  const said = make('div', { class: 'fd-cal-said', role: 'status' });
  const alert = make('div', { class: 'fd-cal-alert', role: 'alert' });
  const note = make('p', { class: 'fd-cal-note', hidden: '' });
  const body = make('div', { class: 'fd-cal-body', role: 'region', 'aria-labelledby': `${id}-title` });
  // What a record's keys do: Enter and M, or Enter alone for one that stays where it is.
  const keysEvent = make('span', { id: `${id}-keys-event`, class: 'fd-sr-only' }, canOpen ? labels.keysOpenMove : labels.keysMove);
  const keysStill = make('span', { id: `${id}-keys-still`, class: 'fd-sr-only' }, labels.keysOpen);
  const keysSlot = make('span', { id: `${id}-keys-slot`, class: 'fd-sr-only' }, sentence(labels.keysSlotsNoun, labels.keysSlots));
  const keysDay = make('span', { id: `${id}-keys-day`, class: 'fd-sr-only' }, sentence(labels.keysDaysNoun, labels.keysDays));
  const element = make('div', { class: 'fd-cal', 'data-creates': canCreate ? '' : undefined, 'aria-label': labels.calendar }, bar, said, alert, note, body, keysEvent, keysStill, keysSlot, keysDay);
  element.setAttribute('role', 'group');
  element.style.setProperty('--fd-cal-hour', `${HOUR}px`);

  // ---- asking for the records of the span shown ---------------------------------------------------------------

  const range = (): Range => rangeOf(state.view, state.anchor, firstDay);
  /** The records in the span: starting before it ends, and ending after it starts (or starting in it, with no end). */
  function spanFilter({ from, to }: Range): ResolvedFilter[] {
    const last = kind === 'date' ? dayKey(addDays(to, -1)) : writeWhen(to, kind, zone);
    const first = writeWhen(from, kind, zone);
    const starts: ResolvedFilter = { field: spec.start, op: kind === 'date' ? '<=' : '<', value: last };
    if (!spec.end) return [starts, { field: spec.start, op: '>=', value: first }];
    return [starts, { any: [{ field: spec.end, op: kind === 'date' ? '>=' : '>', value: first }, { field: spec.start, op: '>=', value: first }] }];
  }

  /** Whether its records were drawn once: a wait after that asks again (`refresh`). */
  let drew = false;
  async function reload(): Promise<void> {
    const mine = ++asking;
    // Its wait, as the list's (loading.ts in @fieldia/widgets): drawn the first time, then asked again — what it shows
    // kept, a bar over it, unless the page says otherwise; a failure said its own way, with Retry.
    const wait = startLoading(body, drew ? 'refresh' : 'first', context.loading, {
      part: `${context.node.id}-calendar`,
      // Its first, going on from its place's wait while its code came (list-view.ts): drawn at once where that one was in sight.
      now: !drew && firstNow,
      failed: () => {
        failed = true;
        draw();
        return true;
      },
    });
    try {
      const answer = source?.list ? await source.list({ model, fields, filter: [...context.filter(), ...spanFilter(range())], sort: [{ field: spec.start }], offset: 0, limit }) : { records: [], total: 0 };
      const people = await resourcesFor(answer.records);
      if (mine !== asking || destroyed) return wait.stop();
      await wait.done(() => {
        records = answer.records;
        total = answer.total;
        state.resources = people;
        failed = false;
        drew = true;
        events = eventsOf(records, spec, page, locale);
        draw();
      });
    } catch (error) {
      if (mine !== asking || destroyed) return wait.stop();
      wait.fail(error);
    }
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
  /** The parts of what a block, a slot or a day says joined as the language joins them: in Arabic, "، ". */
  const joined = comma(locale);
  const time = (d: Date) => format(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  const isToday = (d: Date) => sameDay(d, now());

  function drawTitle({ from, to }: Range) {
    const { view } = state;
    // Its name in summer or winter, as the span shown starts in it.
    nameZone(fromWall(from, zone));
    const last = addDays(to, -1);
    if (view === 'day') title.textContent = format(locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(from);
    else if (view === 'month') title.textContent = format(locale, { month: 'long', year: 'numeric' }).format(state.anchor);
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
    // Where the keys stand, to stand there again: a record or a slot; in a crowded slot's list, its record or its "+N more".
    const inList = !!active && !!crowdBox?.contains(active);
    const focusKeys = active && (body.contains(active) || inList) ? [active.dataset['focus'], inList ? crowdFrom : undefined] : [];
    closeCrowd();
    const shown = range();
    element.dataset['range'] = state.view;
    drawTitle(shown);
    note.hidden = total <= records.length;
    note.textContent = fill(labels.tooMany, { shown: records.length, total });
    if (failed) {
      const retry = make('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
      retry.addEventListener('click', () => void reload());
      body.replaceChildren(make('p', { class: 'fd-cal-failed', role: 'alert' }, labels.loadFailed, ' ', retry));
      return;
    }
    if (state.view === 'month') body.replaceChildren(monthView(shown));
    else if (state.view === 'agenda') body.replaceChildren(agendaView(shown));
    else body.replaceChildren(timeView(shown));
    for (const key of focusKeys) {
      const again = key ? body.querySelector<HTMLElement>(`[data-focus="${key}"]`) : null;
      if (again) {
        again.focus();
        break;
      }
    }
    placeNow();
  }

  /**
   * Each record's block's Move to… button (its "⋯"), beside the block, never inside it: the block is a button itself,
   * and a button in a button is no button (axe: nested-interactive). Where it goes: `inColumn`, `inFlow`.
   */
  const menus = new WeakMap<HTMLElement, HTMLElement>();
  /** A block in the flow of a day's cell (all day, the month) with its "⋯" beside it, over its end corner. */
  const inFlow = (block: HTMLElement): HTMLElement => {
    const menu = menus.get(block);
    return menu ? make('div', { class: 'fd-cal-visit' }, block, menu) : block;
  };

  /**
   * A record's block: its time, its words, its person; what it says to a screen reader; what a press does. In the day,
   * the week and the month the block itself is the press, its Move to… button beside it (`menus`); in the agenda and a
   * crowded slot's list (`row`), a row with its own Move to… button beside it, which a phone has no keys for.
   */
  function eventBlock(event: CalendarEvent, day: Date, compact: boolean, inOwnColumn = false, row = state.view === 'agenda'): HTMLElement {
    const can = event.record.can;
    const movable = canSave && can?.edit !== false && !moveFields.some((name) => can?.readonlyFields?.includes(name) || can?.hiddenFields?.includes(name));
    const why = canSave && !movable ? (can?.reason ?? labels.cannotMove) : '';
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
    /** What the keys and a press reach: the block, or the agenda row's own part. */
    const target = row ? make('div', { class: 'fd-cal-event-open' }) : block;
    target.dataset['focus'] = `e:${event.id}:${dayKey(day)}`;
    if (canOpen || movable) {
      target.tabIndex = 0;
      target.setAttribute('role', 'button');
      target.setAttribute('aria-describedby', movable ? keysEvent.id : keysStill.id);
    }
    target.setAttribute('aria-label', [event.title, event.allDay ? longDay(event.start) : `${longDay(event.start)}${joined}${span}`, who, why].filter(Boolean).join(joined));
    // Its words; in a block, in a box of their own, which the hours keep to whole lines (--fd-cal-lines).
    const words = row ? target : make('span', { class: 'fd-cal-event-text' });
    if (!event.allDay) words.append(make('span', { class: 'fd-cal-event-time' }, row ? `${time(event.start)} – ${time(event.end)}` : time(event.start)), ' ');
    // Its own direction: a Latin name on a right-to-left page reads, and is cut short, as Latin.
    words.append(make('span', { class: 'fd-cal-event-title', dir: 'auto' }, event.title));
    if (event.resourceLabel && !compact && !inOwnColumn) words.append(make('span', { class: 'fd-cal-event-who' }, make('bdi', {}, event.resourceLabel)));
    block.append(row ? target : words);
    if (movable) {
      // A button of its own beside the block, or beside an agenda's row: for a pointer and a phone's finger, and named
      // for a screen reader; the keys reach Move to… by M on the block, as the block says. Never inside the block, which
      // is a button itself (a button in a button is no button): `inFlow` and `inColumn` put it beside it.
      const menu = make('button', { type: 'button', class: 'fd-cal-event-menu', tabindex: '-1', 'aria-label': fill(labels.moveTitle, { name: event.title }), title: labels.moveTo }, '⋯');
      menu.addEventListener('pointerdown', (e) => e.stopPropagation());
      menu.addEventListener('click', (e) => {
        e.stopPropagation();
        mover.open(event, target);
      });
      if (row) block.append(menu);
      else menus.set(block, menu);
    }
    target.addEventListener('keydown', (e) => onEventKey(cal, e, event, target));
    if (!row) {
      block.addEventListener('pointerdown', (e) => pressEvent(cal, e, event, block, movable));
      // A screen reader's press is a click with no pointer behind it: it opens the record as Enter does.
      block.addEventListener('click', (e) => {
        if (e.detail === 0 && e.target === block) onEventKey(cal, new KeyboardEvent('keydown', { key: 'Enter' }), event, block, true);
      });
    } else target.addEventListener('click', () => open(event));
    return block;
  }

  // ---- the day and the week ------------------------------------------------------------------------------------

  function timeView(shown: Range): HTMLElement {
    const columns: Column[] = state.view === 'day' && spec.resource ? state.resources.map((resource) => ({ day: shown.from, resource })) : shown.days.map((day) => ({ day, resource: null }));
    state.columns = columns;
    const { cursor } = state;
    if (cursor.column >= columns.length || !sameDay(columns[cursor.column].day, cursor.day)) {
      const at = Math.max(0, columns.findIndex((column) => sameDay(column.day, cursor.day)));
      state.cursor = { ...cursor, column: at, day: columns[at].day };
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
    state.shownHours = { start: from, end: to };
    const lanes = (drawnLanes = lanesFor(columns.length));
    const grid = make('div', { class: 'fd-cal-grid' });
    grid.style.setProperty('--fd-cal-cols', String(columns.length));
    grid.style.setProperty('--fd-cal-span', String(to - from));
    grid.style.setProperty('--fd-cal-slot', String(slot));
    if (columns.length > 7 || (state.view === 'day' && spec.resource)) grid.style.setProperty('--fd-cal-min', '120px');
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
        if (state.view === 'week' && views.includes('day')) button.addEventListener('click', () => showView('day', column.day));
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
        for (const event of allDay) if (covers(event, column.day) && inColumn(event, column)) cell.append(inFlow(eventBlock(event, column.day, true)));
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
      const label = make('span', { class: 'fd-cal-hour' }, time(atMinutes(dayOn(2026, 0, 1), h * 60)));
      label.style.top = `${(h - from) * HOUR}px`;
      side.append(label);
    }
    grid.append(side);
    columns.forEach((column, i) => {
      const col = make('div', {
        class: 'fd-cal-col',
        role: 'group',
        'aria-label': [longDay(column.day), column.resource?.label].filter(Boolean).join(joined),
        'data-column': String(i),
        'data-day': dayKey(column.day),
        'data-today': isToday(column.day) ? '' : undefined,
      });
      if (canCreate) {
        for (let m = from * 60; m < to * 60; m += slot) {
          const at = atMinutes(column.day, m);
          const busy = timed.filter((event) => event.start <= at && event.end > at && inColumn(event, column)).length;
          const words = [longDay(column.day), time(at), column.resource?.label, busy ? holds(busy) : labels.free].filter(Boolean).join(joined);
          const cell = make('div', { class: 'fd-cal-slot', role: 'button', tabindex: '-1', 'data-minutes': String(m), 'data-focus': `s:${i}:${m}`, 'aria-label': words, 'aria-describedby': keysSlot.id });
          cell.addEventListener('keydown', (e) => onSlotKey(cal, e, i, m));
          // A screen reader's press, with no pointer behind it: a new record there, as Enter makes one.
          cell.addEventListener('click', (e) => {
            if (e.detail === 0) void createAt(atMinutes(column.day, m), null, column);
          });
          cell.addEventListener('focus', () => {
            state.cursor = { day: column.day, minutes: m, column: i };
            chosen = true;
          });
          col.append(cell);
        }
        col.addEventListener('pointerdown', (e) => pressSlot(cal, e, col, i));
      }
      const mine = timed.flatMap((event) => {
        const seg = segment(event, column.day);
        return seg && inColumn(event, column) ? [{ event, ...seg }] : [];
      });
      const placed = sideBySide(mine.map(({ event, start, end }) => ({ id: event.id, start, end })));
      /** Where a part of a day sits in the column: its top and its height, never under a finger's target. */
      const span = (start: Date, end: Date) => [(minutesOf(start) - from * 60) * (HOUR / 60), Math.max(TARGET, ((sameDay(end, column.day) ? minutesOf(end) : 24 * 60) - minutesOf(start)) * (HOUR / 60) - 2)];
      const across = (el: HTMLElement, lane: number, of: number) => {
        el.style.insetInlineStart = `calc(${(lane / of) * 100}% + 1px)`;
        el.style.width = `calc(${100 / of}% - 3px)`;
      };
      // A crowd wider than its lanes read shows its first records, and "+N more" in the last lane for the rest.
      const held: typeof mine = [];
      /** A record's block in its lane of so many. */
      const put = ({ event, start, end }: (typeof mine)[number], lane: number, of: number) => {
        // In a person's own column, the block need not name them again.
        const block = eventBlock(event, column.day, false, !!column.resource);
        const [top, height] = span(start, end);
        block.style.top = `${top}px`;
        block.style.height = `${height}px`;
        block.style.setProperty('--fd-cal-lines', String(linesIn(height)));
        across(block, lane, of);
        if (height < 36) block.setAttribute('data-short', '');
        // Its end stretches, when it has one to write and it ends on this day.
        if (block.hasAttribute('data-moves') && spec.end && sameDay(end, column.day) && sameDay(start, event.start)) {
          const grip = make('span', { class: 'fd-cal-resize', 'aria-hidden': 'true' });
          grip.addEventListener('pointerdown', (e) => stretch(cal, e, event, block, col));
          block.append(grip);
        }
        // Its "⋯" beside it in the column, over its end corner: top, and its lane's end less its own 24 pixels.
        const menu = menus.get(block);
        if (menu) {
          menu.style.top = `${top}px`;
          menu.style.insetInlineStart = `calc(${((lane + 1) / of) * 100}% - 26px)`;
        }
        col.append(...(menu ? [block, menu] : [block]));
      };
      for (const m of mine) {
        const place = placed.get(m.event.id) ?? { column: 0, columns: 1 };
        if (place.columns > lanes && place.column >= lanes - 1) held.push(m);
        else put(m, place.column, Math.min(place.columns, lanes));
      }
      // Those held back, a "+N more" for each run of them that meet, over their own time, which lists all the column holds
      // then; one alone is drawn itself in the last lane.
      const holdBack = (out: typeof mine) => {
        if (out.length < 2) return out.length && put(out[0], lanes - 1, lanes);
        const [first, last] = [Math.min(...out.map((m) => m.start.getTime())), Math.max(...out.map((m) => m.end.getTime()))].map((t) => new Date(t));
        const [top, height] = span(first, last);
        const n = out.length;
        const words = fill(labels.moreOn, { n, when: [longDay(column.day), time(first), column.resource?.label].filter(Boolean).join(joined) });
        const more = make('button', { type: 'button', class: 'fd-cal-more', 'data-holds': out.map((m) => String(m.event.id)).join(' '), 'data-focus': `m:${i}:${minutesOf(first)}`, 'aria-haspopup': 'dialog', 'aria-label': words, title: words }, fill(labels.more, { n }));
        more.style.top = `${top}px`;
        more.style.height = `${height}px`;
        across(more, lanes - 1, lanes);
        more.addEventListener('click', () => openCrowd(mine.filter((m) => m.start < last && m.end > first), column, more));
        col.append(more);
      };
      let run: typeof mine = [];
      let until = 0;
      for (const m of held.sort((a, b) => a.start.getTime() - b.start.getTime())) {
        if (m.start.getTime() >= until) {
          holdBack(run);
          run = [];
        }
        run.push(m);
        until = Math.max(until, m.end.getTime());
      }
      holdBack(run);
      grid.append(col);
    });
    // The slots' one stop: where the cursor is.
    const stop = grid.querySelector<HTMLElement>(`[data-focus="s:${state.cursor.column}:${clampMinutes(state.cursor.minutes)}"]`) ?? grid.querySelector<HTMLElement>('.fd-cal-slot');
    if (stop) stop.tabIndex = 0;
    return make('div', { class: 'fd-cal-scroll' }, grid);
  }

  /**
   * How many records may sit side by side in a column of the day or the week, past which "+N more" holds the rest: as
   * many as its width shows the start of a name in, two at least.
   */
  function lanesFor(count: number): number {
    const width = body.clientWidth;
    if (!width) return LANES;
    return Math.max(2, Math.floor(Math.max((width - 52) / count, count > 7 || (state.view === 'day' && spec.resource) ? 120 : 0) / LANE));
  }
  let drawnLanes = 0;
  // A calendar made wider or narrower, or shown after being hidden, draws its crowds again when their lanes change.
  // Never under a drag, whose block it would take away.
  const resized = typeof ResizeObserver === 'function' ? new ResizeObserver(() => (state.view === 'day' || state.view === 'week') && state.columns.length && lanesFor(state.columns.length) !== drawnLanes && !failed && !body.querySelector('[data-moving]') && draw()) : null;
  resized?.observe(body);

  // ---- a crowded slot's list ------------------------------------------------------------------------------------

  let crowdBox: HTMLElement | null = null;
  /** The "+N more" the list opened from, by its key, as a redraw makes it again: where Escape puts the keys back. */
  let crowdFrom = '';
  const crowdOutside = (e: PointerEvent) => crowdBox && !crowdBox.contains(e.target as Node) && closeCrowd();
  function closeCrowd(back = false) {
    crowdBox?.remove();
    crowdBox = null;
    doc.removeEventListener('pointerdown', crowdOutside, true);
    if (back) body.querySelector<HTMLElement>(`[data-focus="${crowdFrom}"]`)?.focus();
  }

  /** The records of a crowd too wide to read side by side, as a list under its "+N more": each opened, or moved, as an agenda's row. */
  function openCrowd(crowd: { event: CalendarEvent; start: Date; end: Date }[], column: Column, more: HTMLElement) {
    closeCrowd();
    crowdFrom = more.dataset['focus'] ?? '';
    const [first, last] = [Math.min(...crowd.map((m) => m.start.getTime())), Math.max(...crowd.map((m) => m.end.getTime()))].map((t) => new Date(t));
    const heading = make('h3', { class: 'fd-cal-move-title', id: `${id}-crowd` }, [longDay(column.day), fill(labels.fromTo, { from: time(first), to: time(last) }), column.resource?.label].filter(Boolean).join(joined));
    const shut = make('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-label': labels.close, title: labels.close }, '×');
    shut.addEventListener('click', () => closeCrowd(true));
    const list = make('ul', { class: 'fd-cal-agenda-list' }, ...crowd.map(({ event }) => make('li', {}, eventBlock(event, column.day, false, !!column.resource, true))));
    crowdBox = make('div', { class: 'fd-cal-crowd', role: 'dialog', 'aria-labelledby': heading.id }, make('div', { class: 'fd-cal-crowd-head' }, heading, shut), list);
    crowdBox.addEventListener('keydown', (k) => {
      if (k.key !== 'Escape') return;
      k.preventDefault();
      k.stopPropagation();
      closeCrowd(true);
    });
    placeUnder(cal, crowdBox, more);
    list.querySelector<HTMLElement>('[data-focus]')?.focus();
    doc.addEventListener('pointerdown', crowdOutside, true);
  }

  const clampMinutes = (m: number) => Math.min(Math.max(state.shownHours.start * 60, m - (m % slot)), state.shownHours.end * 60 - slot);
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
    const cursorKey = shown.days.some((d) => sameDay(d, state.cursor.day)) ? dayKey(state.cursor.day) : dayKey(shown.days.find(isToday) ?? state.anchor);
    for (const day of shown.days) {
      const mine = events.filter((event) => covers(event, day));
      const cell = make('div', { class: 'fd-cal-day', 'data-day': dayKey(day), 'data-out': day.getUTCMonth() !== state.anchor.getUTCMonth() ? '' : undefined, 'aria-current': isToday(day) ? 'date' : undefined });
      const number = make(
        'button',
        { type: 'button', class: 'fd-cal-daynum', tabindex: dayKey(day) === cursorKey ? '0' : '-1', 'data-focus': `d:${dayKey(day)}`, 'aria-label': [longDay(day), mine.length ? holds(mine.length) : ''].filter(Boolean).join(joined), 'aria-describedby': keysDay.id },
        format(locale, { day: 'numeric' }).format(day)
      );
      number.addEventListener('click', () => (views.includes('day') ? showView('day', day) : undefined));
      number.addEventListener('keydown', (e) => onDayKey(cal, e, day));
      number.addEventListener('focus', () => (state.cursor = { ...state.cursor, day }));
      cell.append(number);
      for (const event of mine.slice(0, IN_A_DAY)) cell.append(inFlow(eventBlock(event, day, true)));
      if (mine.length > IN_A_DAY) {
        const n = mine.length - IN_A_DAY;
        const more = make('button', { type: 'button', class: 'fd-cal-more', 'data-holds': mine.slice(IN_A_DAY).map((event) => String(event.id)).join(' '), 'aria-label': fill(labels.moreOn, { n, when: longDay(day) }) }, fill(labels.more, { n }));
        more.addEventListener('click', () => (views.includes('day') ? showView('day', day) : showView(views.includes('agenda') ? 'agenda' : state.view, day)));
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
    if (state.view !== 'day' && state.view !== 'week') return;
    const at = now();
    const minutes = minutesOf(at);
    if (minutes < state.shownHours.start * 60 || minutes >= state.shownHours.end * 60) return;
    for (const col of body.querySelectorAll<HTMLElement>('.fd-cal-col[data-today]')) {
      const line = make('div', { class: 'fd-cal-now', 'aria-hidden': 'true' });
      line.style.top = `${(minutes - state.shownHours.start * 60) * (HOUR / 60)}px`;
      col.append(line);
    }
  }
  const ticking = setInterval(placeNow, 60000);

  // ---- going somewhere ------------------------------------------------------------------------------------------

  function go(day: Date) {
    state.anchor = startOfDay(day);
    state.cursor = { ...state.cursor, day: state.anchor, column: 0 };
    chosen = false;
    void reload();
  }

  function showView(next: CalendarView, day?: Date) {
    state.view = next;
    if (day) state.anchor = startOfDay(day);
    state.cursor = { ...state.cursor, day: day ? startOfDay(day) : state.cursor.day, column: 0 };
    chosen = false;
    void reload();
  }

  // ---- making a record --------------------------------------------------------------------------------------

  /**
   * Where New puts a record: the slot the person put the keys on, past or not (they chose it); else the next free time
   * from now on the calendar's clock — rounded up to its slot, within its hours, where none of the records it shows is
   * (a new record's hour) — from the span shown where that is still to come. A date's calendar: today, or the span's
   * first day to come. 0.25 took the slot the keys had never left: 08:00, at 12:30.
   */
  function newPlace(): [Date, Date | null, Column | null, boolean] {
    if (chosen && (state.view === 'day' || state.view === 'week') && kind === 'datetime' && body.querySelector('.fd-cal-slot')) {
      const column = state.columns[state.cursor.column] ?? state.columns[0];
      return [atMinutes(column.day, clampMinutes(state.cursor.minutes)), null, column, false];
    }
    const shown = range();
    const at = now();
    const from = shown.from > at ? shown.from : at;
    if (kind === 'date') return [startOfDay(from), null, null, true];
    const taken = (start: Date) => {
      const end = addMinutes(start, NEW_LENGTH);
      return events.some((event) => !event.allDay && event.start < end && event.end > start);
    };
    const last = hours.end * 60 - slot;
    for (let day = startOfDay(from), n = 0; n < 366; day = addDays(day, 1), n++) {
      const first = n === 0 ? Math.max(hours.start * 60, Math.ceil(minutesOf(from) / slot) * slot) : hours.start * 60;
      for (let minutes = first; minutes <= last; minutes += slot) if (!taken(atMinutes(day, minutes))) return [atMinutes(day, minutes), null, null, false];
    }
    return [atMinutes(startOfDay(from), hours.start * 60), null, null, false];
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
      values[spec.start] = writeWhen(from, 'datetime', zone);
      if (spec.end) values[spec.end] = writeWhen(until, 'datetime', zone);
    }
    if (spec.resource && column?.resource && column.resource.key !== '') values[spec.resource] = column.resource.value;
    await context.create(values);
  }

  // ---- opening, and writing a move --------------------------------------------------------------------------

  function open(event: CalendarEvent) {
    if (!context.open) return;
    const answer = context.open(event.id);
    if (answer instanceof Promise) void answer.then(() => (destroyed ? undefined : reload()));
  }

  /**
   * Where a record is now, for the keys to stand on: its block on that day, else any of its blocks, else the "+N more"
   * that holds it; else, when the record is in none of the days shown, the bar's step toward its day.
   */
  function place(recordId: RecordId, day: Date): HTMLElement {
    const key = String(recordId);
    const found =
      body.querySelector<HTMLElement>(`[data-focus="e:${key}:${dayKey(day)}"][tabindex="0"]`) ??
      body.querySelector<HTMLElement>(`[data-focus^="e:${key}:"][tabindex="0"]`) ??
      [...body.querySelectorAll<HTMLElement>('[data-holds]')].find((more) => more.dataset['holds']?.split(' ').includes(key));
    if (found) return found;
    const shown = range();
    return day < shown.from ? back : day >= shown.to ? on : today;
  }

  /**
   * A move's save: the fields it writes and no others, in `values` as in `changes`, and `partial` saying so, so a
   * source that saves whole records keeps every field the calendar never had, and every change made elsewhere since.
   */
  const moveSave = (recordId: RecordId, values: Values, version?: RecordVersion): SaveRequest => ({
    model,
    id: recordId,
    fields: Object.fromEntries(Object.keys(values).map((name) => [name, page.fields[name]])) as Fields,
    changes: { values, lines: {}, links: {} },
    values: { ...values },
    partial: true,
    ...(version ? { version } : {}),
  });

  /**
   * Write a move through the data source's save — at once on the page, put back if the save is refused — and offer
   * Undo, which writes back what those fields held. Whether it was saved.
   */
  async function commit(event: CalendarEvent, values: Values, words: string): Promise<boolean> {
    if (!source?.save || !Object.keys(values).length) {
      draw();
      return false;
    }
    const record = event.record;
    const before: Values = Object.fromEntries(Object.keys(values).map((key) => [key, record.values[key] ?? null]));
    const after: ListedRecord = { ...record, values: { ...record.values, ...values } };
    records = records.map((r) => (r === record ? after : r));
    events = eventsOf(records, spec, page, locale);
    draw();
    for (const block of body.querySelectorAll<HTMLElement>('.fd-cal-event')) if (block.dataset['id'] === String(event.id)) block.setAttribute('aria-busy', 'true');
    say('');
    alert.replaceChildren();
    let saved = false;
    try {
      const result = await source.save(moveSave(event.id, values, record.version));
      undo = { record: { ...after, ...(result.version ? { version: result.version } : {}) }, values: before, ...(result.version ? { version: result.version } : {}), at: event.start };
      say(words, { id: event.id, at: eventsOf([after], spec, page, locale)[0]?.start ?? event.start }, true);
      saved = true;
    } catch (error) {
      records = records.map((r) => (r === after ? record : r));
      events = eventsOf(records, spec, page, locale);
      const problem = saveProblemOf(error);
      const why = problem.message || Object.values(problem.fields ?? {}).join(' ');
      alert.textContent = fill(labels.notMoved, { why });
      draw();
    }
    if (!destroyed) await reload();
    return saved;
  }

  /** Undo: the moved fields as they were, and no others; the keys, when they were on Undo, on the record where it is put back. */
  async function undoLast() {
    const last = undo;
    if (!last || !source?.save) return;
    const keys = said.contains(doc.activeElement);
    undo = null;
    say('');
    try {
      await source.save(moveSave(last.record.id, last.values, last.version));
      say(labels.undone, { id: last.record.id, at: last.at });
    } catch (error) {
      alert.textContent = fill(labels.notMoved, { why: saveProblemOf(error).message });
    }
    if (destroyed) return;
    await reload();
    if (keys && (!doc.activeElement || doc.activeElement === doc.body)) place(last.record.id, last.at).focus();
  }

  /** Words in the status line about a record, with Undo after a move and a way to close them, which leaves the keys on that record. */
  function say(words: string, about?: { id: RecordId; at: Date }, withUndo = false) {
    said.replaceChildren();
    if (!words) return;
    said.append(make('span', {}, words));
    if (withUndo) {
      const undoButton = make('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.undo);
      undoButton.addEventListener('click', () => void undoLast());
      said.append(undoButton);
    }
    const close = make('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-label': labels.close, title: labels.close }, '×');
    close.addEventListener('click', () => {
      const keys = said.contains(doc.activeElement);
      said.replaceChildren();
      if (keys && about) place(about.id, about.at).focus();
    });
    said.append(close);
  }

  // ---- what its gestures, its keys and Move to… reach ------------------------------------------------------------

  const cal: CalendarCore = {
    id,
    doc,
    element,
    body,
    page,
    spec,
    locale,
    labels,
    slot,
    hour: HOUR,
    firstDay,
    canOpen,
    state,
    make,
    rtl,
    time,
    segment,
    clampMinutes,
    draw,
    reload,
    open,
    createAt,
    commit,
    place,
    openMove: (event, target) => mover.open(event, target),
  };
  const mover = moveTo(cal);

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
      resized?.disconnect();
      mover.close();
      closeCrowd();
      element.remove();
    },
  };
}
