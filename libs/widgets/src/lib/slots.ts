import { dayIn, firstWeekday, isOwnZone, wallClock, wallOf, wallTime, dayTag, type Locale, type SlotDay, type SlotsResult, type Value } from '@fieldia/core';
import { markedIn, plainDateWidget, restingText, zoneName, zoneOf } from './date-text';
import { fillIn, maker, rightToLeft, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { inPlural } from './labels';
import { installSlotsStyles } from './styles-slots';
import { datePartIn } from './widget-parts';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * A booking's time picked from the times free (`"widget": "slots"` on a date
 * and time): the days of a month shaded by how they are booked — free times
 * left, fully booked, closed, a holiday by its name — and the chosen day's
 * free times as chips, each a booking's length long. All of it is asked of the
 * app, through the data source's `slots` (`form.findSlots`): a month at a
 * time, again when a field it depends on changes (`options.dependsOn`: the
 * doctor, the car) and once a page of responses sends one (the next booking
 * never offered the time the last one took), and once more for the day of a
 * time picked, so a time someone else booked meanwhile is said and the day's
 * times drawn again, never booked over. The time picked is the field's instant; with
 * `options.endField`, the booking's end goes there too.
 *
 * On the field's time zone's clock — its own, its page's, or the browser's —
 * its name said under the picker where the zone is not the browser's. Today
 * is that zone's day, and the days before it are closed. Each row a week from
 * its first day where the page is read (`firstWeekday`).
 *
 * Keyboard first: the month is one stop, the arrows moving by day and week
 * (mirrored right to left), PageUp and PageDown by month, Home and End to the
 * week's ends, the times of the day in focus shown as it moves; Enter goes to
 * its times, one stop, the arrows moving among them, Enter or Space picking
 * one, Escape going back to the day.
 *
 * Without `slots` in the data source it is the date and time box, its own
 * (date part): hidden, never disabled. It comes in the slots part
 * (slots-part.ts), with the date part beside it.
 */

const pad = (n: number) => String(n).padStart(2, '0');
/** A day of the calendar drawn, a date at the browser's midnight, as the key a source names it by: 2026-10-15. */
const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dateOf = (key: string) => {
  const wall = wallOf(key);
  return wall ? new Date(wall.year, wall.month - 1, wall.day) : new Date();
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const firstOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
/** The same day of another month, or that month's last day when it is shorter. */
function addMonths(d: Date, n: number) {
  const last = new Date(d.getFullYear(), d.getMonth() + n + 1, 0).getDate();
  return new Date(d.getFullYear(), d.getMonth() + n, Math.min(d.getDate(), last));
}
/** How many days a day is past the first of its week, the week starting on `firstDay` (0 Sunday … 6 Saturday). */
const intoWeek = (day: Date, firstDay: number) => (day.getDay() - firstDay + 7) % 7;
/** The day a month's first row starts on, and the day its last ends on: weeks from `firstDay`. */
const monthGrid = (first: Date, firstDay: number): [Date, Date] => {
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  return [addDays(first, -intoWeek(first, firstDay)), addDays(last, 6 - intoWeek(last, firstDay))];
};
/** A value a field depends on, as its free times are keyed by it: a link by its id. */
const keyed = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? (value as { id: unknown }).id : (value ?? null));

/** A day as the picker draws it: its state (before today, past), its free times as instants, and its words. */
interface Day {
  state: SlotDay['state'] | 'past';
  free: number[];
  note?: string;
}
/** A month asked of the source: its days by their keys, each day's free times by the day they fall on in the zone. */
interface Month {
  days: Record<string, SlotDay>;
  free: Map<string, number[]>;
}

export const slotsWidget: WidgetFactory = (context: WidgetContext): Widget => {
  const { form, name, field, node, id, document: doc, locale = 'en' as Locale } = context;
  // No free times to ask for: the date and time box, as the field would be without the widget.
  if (!form.canFindSlots()) {
    const dates = datePartIn();
    return dates ? dates.dateBoxWidget('datetime')(context) : plainDateWidget('datetime')(context);
  }
  installSlotsStyles(doc);
  const words = wordsFor(context.labels, locale);
  // The week's first day where the page is read (`firstWeekday`), each row of the month from it.
  const firstDay = firstWeekday(locale, form.page);
  const make = maker(doc);
  const options = node.options ?? {};
  const schedule = typeof options['schedule'] === 'string' ? options['schedule'] : undefined;
  const pageLength = typeof options['length'] === 'number' ? options['length'] : undefined;
  const between = typeof options['between'] === 'number' ? options['between'] : undefined;
  const end = options['endField'];
  const endName = typeof end === 'string' && form.page.fields[end]?.type === 'datetime' ? end : null;
  const dependsOn = Array.isArray(options['dependsOn']) ? options['dependsOn'].filter((one): one is string => typeof one === 'string') : [];
  const zone = zoneOf(form, field);
  const lang = dayTag(locale);
  const monthName = new Intl.DateTimeFormat(lang, { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const dayName = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', numberingSystem: 'latn' });
  const shortName = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'long', numberingSystem: 'latn' });
  const weekdayLong = new Intl.DateTimeFormat(lang, { weekday: 'long' });
  /**
   * A day's column head: its short name, or its narrow one where the short is a whole word (Arabic's) — in its own
   * script — by the date part's rule, in with this part. Its short name until it is.
   */
  const weekdayShort = new Intl.DateTimeFormat(lang, { weekday: 'short' });
  const weekday = datePartIn()?.weekdayHead(lang) ?? ((d: Date) => weekdayShort.format(d));
  /** A time on the zone's clock: 09:30. */
  const clock = (at: number) => wallClock(wallTime(at, zone));
  /** Today, on the zone's clock: the page's day by the form's clock, or the zone's own. */
  const todayKey = () => (zone === form.page.timeZone ? form.today() : dayIn(Date.now(), zone));

  const prev = make('button', { type: 'button', class: 'fd-slots-step', 'aria-label': words.previousMonth }, '‹');
  const next = make('button', { type: 'button', class: 'fd-slots-step', 'aria-label': words.nextMonth }, '›');
  const title = make('span', { class: 'fd-calendar-title', 'aria-live': 'polite' });
  const grid = make('table', { class: 'fd-calendar-grid fd-slots-days', role: 'grid', id });
  const legend = make(
    'div',
    { class: 'fd-slots-legend', 'aria-hidden': 'true' },
    ...([['open', words.slotsOpen], ['full', words.slotsFull], ['closed', words.slotsClosed], ['holiday', words.slotsHoliday]] as const).map(([state, said]) => make('span', { 'data-state': state }, said))
  );
  const heading = make('p', { class: 'fd-slots-heading', id: `${id}-times` });
  const chips = make('div', { class: 'fd-slots-chips', role: 'group', 'aria-labelledby': `${id}-times` });
  const note = make('span', { class: 'fd-slots-said' });
  const retry = make('button', { type: 'button', class: 'fd-button fd-slots-retry', hidden: '' }, words.slotsRetry);
  const status = make('p', { class: 'fd-slots-note', role: 'status' }, note, retry);
  const chosen = make('p', { class: 'fd-slots-chosen', id: `${id}-chosen`, hidden: '' });
  const zoneNote = make('p', { class: 'fd-slots-zone', hidden: '' });
  const picker = make(
    'div',
    { class: 'fd-slots-picker' },
    make('div', { class: 'fd-slots-month' }, make('div', { class: 'fd-calendar-head' }, prev, title, next), grid, legend),
    make('div', { class: 'fd-slots-times' }, heading, chips, status)
  );
  const resting = make('span', { class: 'fd-slots-resting', hidden: '' });
  const element = make('div', { class: 'fd-slots', role: 'group', 'aria-labelledby': `${id}-label` }, picker, chosen, zoneNote, resting);

  let value: Value | undefined = form.getState().values[name];
  const held = () => (typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? Date.parse(value) : null);
  const start = held();
  /** The month shown, the day in focus in it, and the day whose times are shown. */
  let month = firstOf(dateOf(start === null ? todayKey() : dayIn(start, zone)));
  let focused = start === null ? dateOf(todayKey()) : dateOf(dayIn(start, zone));
  let shown: string | null = start === null ? null : dayIn(start, zone);
  /** Each month asked, by its first day and the values it depends on: its days, being asked, or not found. */
  const months = new Map<string, Month | 'asking' | 'failed'>();
  let depends = JSON.stringify(dependsOn.map((other) => keyed(form.getState().values[other])));
  const keyFor = (first: Date) => `${keyOf(first)}|${depends}`;
  /** The response a page of responses last sent, or none: once one is sent, the times it booked are no one else's. */
  let sentAs = form.getState().sent;
  /** A booking's length, in minutes: the source's, else the page's, else 30. */
  let length = pageLength ?? 30;
  let readonly = false;
  /** A time picked being checked, and what the picker says under the times now. */
  let checking: number | null = null;
  let said: { words: string; tone?: 'warning'; again?: () => void } | null = null;

  /** What the source is asked for the days from and to: the schedule, the length and the minutes between as the page says. */
  const ask = (from: string, to: string) => ({ from, to, ...(schedule ? { schedule } : {}), ...(pageLength ? { length: pageLength } : {}), ...(between !== undefined ? { between } : {}) });
  /** A month's days, each day's free times by the day they fall on in the zone, whatever day the source named. */
  function monthOf(result: SlotsResult): Month {
    const free = new Map<string, number[]>();
    for (const day of Object.values(result.days)) {
      for (const iso of day.free ?? []) {
        const at = Date.parse(iso);
        if (Number.isNaN(at)) continue;
        const key = dayIn(at, zone);
        free.set(key, [...(free.get(key) ?? []), at]);
      }
    }
    for (const times of free.values()) times.sort((a, b) => a - b);
    return { days: result.days, free };
  }
  function take(result: SlotsResult) {
    if (typeof result.length === 'number' && result.length > 0) length = result.length;
  }
  /** A month's days asked of the source, once for the values it depends on — or again, after it failed. */
  function load(first: Date) {
    const key = keyFor(first);
    const had = months.get(key);
    if (had && had !== 'failed') return;
    months.set(key, 'asking');
    const [from, to] = monthGrid(first, firstDay);
    form.findSlots(name, ask(keyOf(from), keyOf(to))).then(
      (result) => {
        take(result);
        months.set(key, monthOf(result));
        if (key === keyFor(month)) draw(false);
      },
      () => {
        months.set(key, 'failed');
        if (key === keyFor(month)) draw(false);
      }
    );
  }

  /** A day as the month shown knows it: its state and free times, or still being asked, or not found. */
  function dayOf(key: string): Day | 'asking' | 'failed' {
    const loaded = months.get(keyFor(month));
    if (!loaded || loaded === 'asking') return 'asking';
    if (loaded === 'failed') return 'failed';
    if (key < todayKey()) return { state: 'past', free: [] };
    const day = loaded.days[key];
    const free = loaded.free.get(key) ?? [];
    const state = free.length ? 'open' : day?.state === 'holiday' ? 'holiday' : day?.state === 'open' || day?.state === 'full' ? 'full' : 'closed';
    return { state, free, ...(day?.note ? { note: day.note } : {}) };
  }
  /** A day's state as a person is told of it. */
  function stateWords(day: Day): string {
    if (day.state === 'open') return inPlural(words.slotsFree, words.slotsFreeOne, day.free.length, locale);
    if (day.state === 'full') return words.slotsFull;
    if (day.state === 'holiday') return day.note ? `${words.slotsHoliday}: ${day.note}` : words.slotsHoliday;
    return words.slotsClosed;
  }

  function say(words: string, how: { tone?: 'warning'; again?: () => void } = {}) {
    said = words ? { words, ...how } : null;
  }

  function draw(focus: boolean) {
    // The focus on a day stays on the month as it is drawn again: a day clicked, then the arrows.
    const inMonth = grid.contains(doc.activeElement);
    const label = monthName.format(month);
    setText(title, label);
    setAttr(grid, 'aria-label', label);
    const loaded = months.get(keyFor(month));
    setAttr(grid, 'aria-busy', loaded === 'asking' ? 'true' : null);
    const [from, to] = monthGrid(month, firstDay);
    const today = todayKey();
    const head = make('tr', {});
    for (let i = 0; i < 7; i++) head.append(make('th', { scope: 'col', abbr: weekdayLong.format(addDays(from, i)) }, weekday(addDays(from, i))));
    const body = make('tbody', {});
    for (let row = from; row <= to; row = addDays(row, 7)) {
      const tr = make('tr', {});
      for (let i = 0; i < 7; i++) {
        const d = addDays(row, i);
        const key = keyOf(d);
        const day = dayOf(key);
        const button = make('button', { type: 'button', 'data-day': key, tabindex: key === keyOf(focused) ? '0' : '-1' }, String(d.getDate()));
        setAttr(button, 'aria-label', typeof day === 'string' ? dayName.format(d) : `${dayName.format(d)}, ${stateWords(day)}`);
        if (typeof day !== 'string') button.dataset['state'] = day.state;
        if (d.getMonth() !== month.getMonth()) button.classList.add('fd-outside');
        // The day whose times are shown: pressed, as a button says it (a button is never "selected").
        setAttr(button, 'aria-pressed', String(key === shown));
        if (key === today) setAttr(button, 'aria-current', 'date');
        button.disabled = readonly;
        button.addEventListener('click', () => go(d, false));
        button.addEventListener('keydown', (event) => onDayKey(event, d));
        tr.append(make('td', {}, button));
      }
      body.append(tr);
    }
    grid.replaceChildren(make('thead', {}, head), body);
    drawTimes();
    drawChosen();
    if (focus || inMonth) dayButton()?.focus();
  }

  const dayButton = () => grid.querySelector<HTMLButtonElement>('button[tabindex="0"]');
  const chipButtons = () => [...chips.querySelectorAll<HTMLButtonElement>('button')];

  /** The times of the day shown, the time held among them where it falls that day, and what is said under them. */
  function drawTimes() {
    const keep = chips.contains(doc.activeElement) ? (doc.activeElement as HTMLElement).dataset['at'] : undefined;
    chips.replaceChildren();
    if (!shown) {
      setText(heading, words.slotsPickDay);
    } else {
      const dayWords = shortName.format(dateOf(shown));
      const day = dayOf(shown);
      const at = held();
      const times = typeof day === 'string' ? [] : [...day.free];
      // The time this record holds is its own, free or not: drawn among the others, pressed.
      if (at !== null && dayIn(at, zone) === shown && !times.includes(at)) times.push(at);
      times.sort((a, b) => a - b);
      setText(heading, fillIn(times.length || typeof day === 'string' ? words.slotsOn : words.slotsNoneOn, { day: dayWords }));
      const active = times.find((one) => String(one) === keep) ?? times.find((one) => one === at) ?? times[0];
      for (const one of times) {
        const chip = make('button', { type: 'button', class: 'fd-slots-chip', 'data-at': String(one), 'aria-pressed': String(one === at), tabindex: one === active ? '0' : '-1', 'aria-label': fillIn(words.slotSpan, { from: clock(one), to: clock(one + length * 60000) }) }, clock(one));
        if (one === checking) setAttr(chip, 'aria-busy', 'true');
        chip.disabled = readonly;
        chip.addEventListener('click', () => void pick(one));
        chip.addEventListener('keydown', (event) => onChipKey(event, chip));
        chips.append(chip);
      }
      if (keep) chipButtons().find((chip) => chip.dataset['at'] === keep)?.focus();
    }
    // What is said under the times: a time checked or taken, then the month being asked for or not found.
    const loaded = months.get(keyFor(month));
    const now = said ?? (loaded === 'failed' ? { words: words.slotsFailed, tone: 'warning' as const, again: () => load(month) } : loaded === 'asking' && shown ? { words: words.slotsFinding } : null);
    setText(note, now?.words ?? '');
    status.dataset['tone'] = now?.tone ?? '';
    setHidden(retry, !now?.again);
    retryWith = now?.again ?? null;
  }
  let retryWith: (() => void) | null = null;
  retry.addEventListener('click', () => {
    const again = retryWith;
    said = null;
    again?.();
    draw(false);
  });

  /** The booking held, in words: its day, from and to, the zone's name where it is not the browser's. */
  function drawChosen() {
    const at = held();
    setHidden(chosen, at === null);
    if (at !== null) {
      const booked = fillIn(words.slotChosen, { day: dayName.format(dateOf(dayIn(at, zone))), from: clock(at), to: clock(at + length * 60000) });
      setText(chosen, markedIn(at, zone) ? `${booked} ${zoneName(at, zone, locale)}` : booked);
    }
    const away = !!zone && !isOwnZone(zone);
    setHidden(zoneNote, !away);
    if (away && zone) {
      // The zone by its name all year ("Central European Time"): a month may hold both its seasons — October's CEST,
      // then CET from the 25th — so its season's short name stands beside the times alone, as the day has it. `{mark}`,
      // for a note of the app's own, is the day's: the time held, else the day shown, else the month's middle.
      const dayAt = at ?? (shown ? dateOf(shown).getTime() + 12 * 3600000 : new Date(month.getFullYear(), month.getMonth(), 15, 12).getTime());
      setText(zoneNote, fillIn(words.slotsZone, { zone: zoneName(dayAt, zone, locale, 'longGeneric'), mark: zoneName(dayAt, zone, locale) }));
    }
  }

  /** A day gone to: in focus, its times shown, its month drawn — asked for, the first time. */
  function go(d: Date, focus: boolean) {
    if (readonly) return;
    focused = d;
    shown = keyOf(d);
    said = null;
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
      month = firstOf(d);
      load(month);
    }
    draw(focus);
  }

  function onDayKey(event: KeyboardEvent, day: Date) {
    // Right to left the week runs from the right: the arrows follow the screen.
    const rtl = rightToLeft(element);
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(day, rtl ? 1 : -1),
      ArrowRight: () => addDays(day, rtl ? -1 : 1),
      ArrowUp: () => addDays(day, -7),
      ArrowDown: () => addDays(day, 7),
      PageUp: () => addMonths(day, -1),
      PageDown: () => addMonths(day, 1),
      Home: () => addDays(day, -intoWeek(day, firstDay)),
      End: () => addDays(day, 6 - intoWeek(day, firstDay)),
    };
    if (moves[event.key]) {
      event.preventDefault();
      go(moves[event.key](), true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (keyOf(day) !== shown) go(day, true);
      // Into the day's times: the one held, else the first.
      chips.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
    }
  }

  function onChipKey(event: KeyboardEvent, chip: HTMLButtonElement) {
    const all = chipButtons();
    const at = all.indexOf(chip);
    const rtl = rightToLeft(element);
    /** The chip in the row above or below, nearest across: rows as the chips wrap. */
    const row = (step: number) => {
      const top = chip.offsetTop;
      const others = all.filter((one) => (step > 0 ? one.offsetTop > top : one.offsetTop < top));
      if (!others.length) return all[Math.min(all.length - 1, Math.max(0, at + step))];
      const line = step > 0 ? Math.min(...others.map((one) => one.offsetTop)) : Math.max(...others.map((one) => one.offsetTop));
      const across = others.filter((one) => one.offsetTop === line);
      return across.reduce((best, one) => (Math.abs(one.offsetLeft - chip.offsetLeft) < Math.abs(best.offsetLeft - chip.offsetLeft) ? one : best));
    };
    const moves: Record<string, () => HTMLButtonElement | undefined> = {
      ArrowLeft: () => all[at + (rtl ? 1 : -1)],
      ArrowRight: () => all[at + (rtl ? -1 : 1)],
      ArrowUp: () => row(-1),
      ArrowDown: () => row(1),
      Home: () => all[0],
      End: () => all[all.length - 1],
    };
    if (moves[event.key]) {
      event.preventDefault();
      const to = moves[event.key]();
      if (!to) return;
      for (const one of all) one.tabIndex = one === to ? 0 : -1;
      to.focus();
    } else if (event.key === 'Enter' || event.key === ' ') {
      // Picked from the keyboard as from the pointer, once: the browser's own click for the key is not waited for.
      event.preventDefault();
      void pick(Number(chip.dataset['at']));
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      dayButton()?.focus();
    }
  }

  /**
   * A time picked: its day asked of the source once more, and the time taken only while it is still free — else
   * said, the day's times drawn again as they are now, and the focus among them.
   */
  async function pick(at: number) {
    if (readonly || checking !== null) return;
    const time = clock(at);
    const day = dayIn(at, zone);
    checking = at;
    say(fillIn(words.slotChecking, { time }));
    drawTimes();
    let fresh: SlotsResult;
    try {
      fresh = await form.findSlots(name, ask(day, day));
    } catch {
      checking = null;
      say(words.slotsFailed, { tone: 'warning', again: () => void pick(at) });
      drawTimes();
      return;
    }
    checking = null;
    take(fresh);
    const loaded = months.get(keyFor(month));
    if (loaded && typeof loaded === 'object') months.set(keyFor(month), monthOf({ days: { ...loaded.days, ...fresh.days } }));
    const free = Object.values(fresh.days).some((one) => one.free?.some((iso) => Date.parse(iso) === at));
    if (!free) {
      say(fillIn(words.slotTaken, { time }), { tone: 'warning' });
      draw(false);
      // The focus stays among the day's times, on the nearest one left, else on the day.
      const left = chipButtons();
      (left.find((chip) => Number(chip.dataset['at']) > at) ?? left[left.length - 1] ?? dayButton())?.focus();
      return;
    }
    say('');
    form.setValue(name, new Date(at).toISOString());
    if (endName) form.setValue(endName, new Date(at + length * 60000).toISOString());
  }

  prev.addEventListener('click', () => {
    month = addMonths(month, -1);
    focused = month;
    load(month);
    draw(false);
  });
  next.addEventListener('click', () => {
    month = addMonths(month, 1);
    focused = month;
    load(month);
    draw(false);
  });

  load(month);
  draw(false);

  return {
    element,
    focus: () => dayButton()?.focus(),
    update(state) {
      const lock = state.readonly;
      // The fields it depends on changed: their free times are other ones. Or a response was sent, or the next one
      // started ("Book another"): the time it booked is taken now, others may have gone meanwhile. Either way, every
      // month asked again, never the free times known before.
      const now = JSON.stringify(dependsOn.map((other) => keyed(state.values[other])));
      const sent = form.getState().sent;
      const moved = now !== depends || sent !== sentAs;
      if (moved) {
        depends = now;
        sentAs = sent;
        months.clear();
        said = null;
        load(month);
      }
      const changed = state.value !== value;
      if (changed) {
        value = state.value;
        // A booking held from outside — loaded, set by a step — shows its day.
        const at = held();
        if (at !== null && checking === null) {
          shown = dayIn(at, zone);
          focused = dateOf(shown);
          if (keyOf(firstOf(focused)) !== keyOf(month)) {
            month = firstOf(focused);
            load(month);
          }
        }
      }
      const locked = lock !== readonly;
      readonly = lock;
      setHidden(picker, readonly);
      setHidden(resting, !readonly);
      if (readonly) setText(resting, restingText(value, 'datetime', locale, zone));
      setAttr(element, 'aria-invalid', state.invalid ? 'true' : null);
      setAttr(element, 'aria-describedby', [state.describedBy, held() !== null ? chosen.id : ''].filter(Boolean).join(' ') || null);
      // Drawn again where the day's times may have changed; the focus kept on the time it was on.
      if (changed || moved || locked) draw(false);
      else drawChosen();
    },
  };
};
