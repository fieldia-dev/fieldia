import { isOwnZone, recordSentence, saveProblemOf, type Fields, type GanttZoom, type ListGantt, type ListedRecord, type RecordId, type RecordVersion, type SaveRequest, type Values } from '@fieldia/core';
import type { ListViewContext, ListViewPart } from '@fieldia/viewer';
import { moneyReads, zoneName } from '@fieldia/widgets';
import { addDays, comma, daysFrom, firstDayOf, format, toWall, zoneOfGantt } from './dates';
import { fill, ganttLabels, type GanttLabels } from './labels';
import { DAY_WIDTH, spanOf, ticksOf, type Span } from './scale';
import { clampBy, groupsOf, kindOf, linksOf, movedBy, shifted, stretches, tasksOf, type Edge, type GanttGroup, type GanttLink, type GanttTask } from './tasks';
import type { GanttSettings } from './settings';
import { installGanttStyles } from './styles';

const ALL_ZOOMS: GanttZoom[] = ['day', 'week', 'month'];
/** A row's height and a group heading's, in pixels: the stylesheet's (styles.ts), which the arrows are drawn by. */
const ROW = 36;
const HEAD = 32;
/** How far a press moves before it is a drag rather than a click. */
const DRAG_FROM = 4;
/** How long the keys may rest before the days they moved a bar by are written: a run of presses is one move, and one Undo. */
const SETTLE = 700;
/** The pixels an arrow runs out of a bar before it turns. */
const OUT = 8;
const SVG = 'http://www.w3.org/2000/svg';
/** A heading's arrow, open; turned a quarter when its group is closed. */
const CHEVRON = '<path d="M3 6l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
/** A value as an attribute selector reads it, its quotes and backslashes kept. */
const quoted = (value: string | number) => String(value).replace(/["\\]/g, '\\$&');
/** Eight colours that read on a light page and a dark one alike, each drawn as a tint of the surface: the same value, the same one. */
const PALETTE = ['#2563eb', '#0d9488', '#c2410c', '#be185d', '#7c3aed', '#15803d', '#0e7490', '#a16207'];

/** A value's colour: one it names itself (#rrggbb), else one of the palette's, the same for the same value. */
export function colourOf(key: string | null): string | null {
  if (key === null) return null;
  if (/^#[0-9a-fA-F]{6}$/.test(key)) return key;
  let hash = 0;
  for (const char of key) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

let made = 0;

/**
 * A list's records on a Gantt timeline, for the list's switcher: the list's own search, its records as bars on a time
 * axis by days, weeks or months, in groups under their headings, each joined by an arrow to the records it waits for
 * (finish to start, red where it starts too soon); today's line; a bar dragged to move it or by its ends to stretch it,
 * or moved a day at a time from the keyboard, written through the data source's save with Undo; on paper, the whole
 * plan on the page's width.
 */
export function ganttPart(context: ListViewContext, settings: GanttSettings = {}): ListViewPart {
  const { page, node, document: doc, locale } = context;
  const spec = node.gantt as ListGantt;
  const source = context.dataSource;
  const model = page.data.kind === 'record' ? page.data.model : '';
  const labels: GanttLabels = ganttLabels(locale, settings.labels?.[locale]);
  /** One of its sentences in the words the list's page names its records by (`records`), else as it says them plainly. */
  const sentence = (noun: string | undefined, words: string) => recordSentence(page.records, noun, words, locale);
  const holds = (n: number) => (n === 1 ? sentence(labels.holdsNounOne, labels.holdsOne) : fill(sentence(labels.holdsNoun, labels.holds), { n }));
  const kind = kindOf(page, spec);
  /** The zone its clock is: its start's, else its page's, else the reader's own (dates.ts). */
  const zone = zoneOfGantt(page, spec);
  /** The moment it is now (the app's, as a demo or a test pins it), on the timeline's clock. */
  const now = () => toWall(settings.now?.() ?? new Date(), zone);
  const zooms = (spec.zooms?.length ? spec.zooms : ALL_ZOOMS).filter((z, i, all) => all.indexOf(z) === i);
  let zoom: GanttZoom = spec.zoom && zooms.includes(spec.zoom) ? spec.zoom : zooms.includes('week') ? 'week' : zooms[0];
  const firstDay = firstDayOf(locale, spec.firstDay);
  const limit = settings.limit ?? 500;
  const id = `fd-gantt-${++made}`;
  const rtl = () => element.closest('[dir]')?.getAttribute('dir') === 'rtl';
  /** The fields a move writes. When the page locks one, nothing moves; when a record's source locks or hides one, that record stays. */
  const moveFields = [spec.start, spec.end, spec.duration].filter((name): name is string => !!name);
  const canSave = !!source?.save && !moveFields.some((name) => page.fields[name]?.readonly);
  const canOpen = !!context.open;
  const fields = [...new Set([spec.start, spec.end, spec.duration, spec.title, spec.group, spec.colour, spec.dependsOn, ...moneyReads(page.fields[spec.title])].filter((name): name is string => !!name && !!page.fields[name]))];

  let records: ListedRecord[] = [];
  let tasks: GanttTask[] = [];
  /** Each record's waits among those shown, as arrows: worked out as the records come. */
  let links: GanttLink[] = [];
  const setTasks = () => {
    tasks = tasksOf(records, spec, page, locale);
    links = linksOf(tasks);
  };
  let total = 0;
  let asking = 0;
  let destroyed = false;
  let failed = false;
  /** The pixels a day takes: its scale's, or on paper, the page's width over the days. */
  let dayWidth = DAY_WIDTH[zoom];
  let span: Span = { from: addDays(now(), 0), days: 1 };
  /** The groups closed, by their key. */
  const closed = new Set<string>();
  /** The record the keys stand on (one stop for the whole timeline), by its id. */
  let current: string | null = null;
  /** Whether the timeline has been brought to today once, as it is first shown. */
  let placed = false;
  /** What Undo writes back, and the version the record holds after the move. */
  let undo: { id: RecordId; values: Values; version?: RecordVersion } | null = null;
  /** A move from the keys not written yet: so many days, of the whole bar or its end. */
  let pending: { task: GanttTask; by: number; edge: Edge; timer: ReturnType<typeof setTimeout> } | null = null;
  /** The saves in turn: a move waits for the one before it, and its answer. */
  let saving: Promise<unknown> = Promise.resolve();

  installGanttStyles(doc);
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] => {
    const el = doc.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) if (value !== undefined) el.setAttribute(key, value);
    el.append(...children);
    return el;
  };
  const svg = (tag: string, attrs: Record<string, string | undefined> = {}) => {
    const el = doc.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) if (value !== undefined) el.setAttribute(key, value);
    return el;
  };

  // ---- the bar: Today, the plan's span in words, its zone, the scales ---------------------------------------

  const today = make('button', { type: 'button', class: 'fd-button' }, labels.today);
  today.addEventListener('click', () => toToday(true));
  const title = make('h2', { class: 'fd-gantt-title', id: `${id}-title` });
  const zoomButtons = zooms.map((name) => {
    const button = make('button', { type: 'button', class: 'fd-button', 'data-zoom': name, 'aria-pressed': 'false' }, labels.zooms[name]);
    button.addEventListener('click', () => setZoom(name));
    return button;
  });
  const zoomGroup = make('div', { class: 'fd-gantt-zooms', role: 'group', 'aria-label': labels.showAs }, ...zoomButtons);
  zoomGroup.hidden = zooms.length < 2;
  // The zone its times are on, where they have times and it is not the reader's own: its short name, its long one read out.
  const shownZone = kind === 'datetime' && zone && !isOwnZone(zone) ? make('span', { class: 'fd-gantt-zone', role: 'note' }) : null;
  if (shownZone && zone) {
    const at = (settings.now?.() ?? new Date()).getTime();
    shownZone.textContent = zoneName(at, zone, locale);
    shownZone.title = zoneName(at, zone, locale, 'longGeneric');
    shownZone.setAttribute('aria-label', shownZone.title);
  }
  const bar = make('div', { class: 'fd-gantt-bar' }, today, title, ...(shownZone ? [shownZone] : []), zoomGroup);

  // What a move says, with Undo; what went wrong, at once; how many it shows, when it cannot show all; a move by the keys as it goes.
  const said = make('div', { class: 'fd-gantt-said', role: 'status' });
  const alert = make('div', { class: 'fd-gantt-alert', role: 'alert' });
  const note = make('p', { class: 'fd-gantt-note', hidden: '' });
  const live = make('span', { class: 'fd-sr-only', 'aria-live': 'polite' });
  const body = make('div', { class: 'fd-gantt-body', role: 'region', 'aria-labelledby': `${id}-title` });
  const keysWords = [canOpen ? labels.keysOpen : '', labels.keysMove, labels.keysRows];
  const keysMoves = make('span', { id: `${id}-keys`, class: 'fd-sr-only' }, keysWords.filter(Boolean).join(' '));
  const keysStill = make('span', { id: `${id}-keys-still`, class: 'fd-sr-only' }, [keysWords[0], labels.keysRows].filter(Boolean).join(' '));
  const element = make('div', { class: 'fd-gantt', role: 'group', 'aria-label': labels.timeline }, bar, said, alert, note, body, live, keysMoves, keysStill);

  // ---- asking for the records ------------------------------------------------------------------------------

  async function reload(): Promise<void> {
    const mine = ++asking;
    body.setAttribute('aria-busy', 'true');
    try {
      const answer = source?.list ? await source.list({ model, fields, filter: context.filter(), sort: [{ field: spec.start }], offset: 0, limit }) : { records: [], total: 0 };
      if (mine !== asking || destroyed) return;
      records = answer.records;
      total = answer.total;
      failed = false;
    } catch {
      if (mine !== asking || destroyed) return;
      failed = true;
    }
    body.removeAttribute('aria-busy');
    setTasks();
    draw();
  }

  // ---- words ----------------------------------------------------------------------------------------------

  const joined = comma(locale);
  const day = (d: Date) => format(locale, { weekday: 'short', day: 'numeric', month: 'short', ...(d.getUTCFullYear() !== now().getUTCFullYear() ? { year: 'numeric' } : {}) }).format(d);
  const time = (d: Date) => format(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  /** A moment as a bar says it: its day, and its time where the timeline keeps times. */
  const when = (d: Date) => (kind === 'date' ? day(d) : `${day(d)}${joined}${time(d)}`);
  /** A bar's first and last moments in words: its last day, for a date. */
  const fromTo = (start: Date, end: Date) => ({ from: when(start), to: when(kind === 'date' ? addDays(end, -1) : end) });
  const lasting = (start: Date, end: Date) => {
    const n = Math.round(daysFrom(start, end) * 10) / 10;
    return n === 1 ? labels.dayOne : fill(labels.days, { n: n.toLocaleString(locale === 'en' ? 'en-GB' : locale, { numberingSystem: 'latn' } as Intl.NumberFormatOptions) });
  };
  /** What a bar says to a screen reader: its words, its days, how long, what it waits for, and whether too soon. */
  function spoken(task: GanttTask, at: { start: Date; end: Date } | null = task.start && task.end ? { start: task.start, end: task.end } : null, why = '') {
    if (!at) return [task.title, labels.notPlanned, why].filter(Boolean).join(joined);
    const span = task.milestone ? fill(labels.on, { day: when(at.start) }) : `${fill(labels.fromTo, fromTo(at.start, at.end))}${joined}${lasting(at.start, at.end)}`;
    const waits = task.waitsFor.map((key) => tasks.find((t) => String(t.id) === key)?.title).filter(Boolean);
    const late = links.filter((link) => link.to === task && link.late).map((link) => fill(labels.late, { name: link.from.title }));
    return [task.title, span, waits.length ? fill(labels.waitsFor, { names: waits.join(joined) }) : '', ...late, why].filter(Boolean).join(joined);
  }

  // ---- drawing ----------------------------------------------------------------------------------------------

  /** Where a moment is across the timeline, in pixels from its first day. */
  const x = (d: Date) => daysFrom(span.from, d) * dayWidth;
  /** Whether a record may be moved here, and why not when it may not. */
  function movable(task: GanttTask): { moves: boolean; why: string } {
    const can = task.record.can;
    const moves = canSave && !!task.start && can?.edit !== false && !moveFields.some((name) => can?.readonlyFields?.includes(name) || can?.hiddenFields?.includes(name));
    return { moves, why: canSave && task.start && !moves ? (can?.reason ?? labels.cannotMove) : '' };
  }

  function drawTitle(planned: GanttTask[]) {
    for (const button of zoomButtons) button.setAttribute('aria-pressed', String(button.dataset['zoom'] === zoom));
    element.dataset['zoom'] = zoom;
    if (!planned.length) return void (title.textContent = labels.timeline);
    const first = new Date(Math.min(...planned.map((t) => (t.start as Date).getTime())));
    // Its last moment: a day's last day, a milestone's own.
    const end = new Date(Math.max(...planned.map((t) => (t.milestone ? (t.start as Date) : kind === 'date' ? addDays(t.end as Date, -1) : (t.end as Date)).getTime())));
    const days = format(locale, { day: 'numeric', month: 'short', year: 'numeric' });
    title.textContent = end <= first ? days.format(first) : typeof days.formatRange === 'function' ? days.formatRange(first, end) : `${days.format(first)} – ${days.format(end)}`;
  }

  function draw() {
    const active = doc.activeElement as HTMLElement | null;
    const keys = active && body.contains(active) ? active.dataset['focus'] : undefined;
    const scroller = body.querySelector<HTMLElement>('.fd-gantt-scroll');
    const scrolled = scroller ? [scroller.scrollLeft, scroller.scrollTop] : null;
    const planned = tasks.filter((t) => t.start && t.end);
    drawTitle(planned);
    note.hidden = total <= records.length;
    note.textContent = fill(labels.tooMany, { shown: records.length, total });
    if (failed) {
      const retry = make('button', { type: 'button', class: 'fd-button fd-button-link' }, labels.retry);
      retry.addEventListener('click', () => void reload());
      return void body.replaceChildren(make('p', { class: 'fd-gantt-failed', role: 'alert' }, labels.loadFailed, ' ', retry));
    }
    if (!tasks.length) return void body.replaceChildren(make('p', { class: 'fd-gantt-empty' }, labels.nothing));
    measured = body.clientWidth;
    const names = measured > 0 && measured <= 640 ? 140 : 240;
    span = spanOf(planned, now(), zoom, firstDay, Math.max(0, body.clientWidth - names - 2));
    const width = span.days * dayWidth;
    const groups = groupsOf(tasks, spec, page, labels.noGroup);
    // No stop of its own for the keys (Firefox gives a box that scrolls one): its bars are, each brought into view.
    const scroll = make('div', { class: 'fd-gantt-scroll', tabindex: '-1' }, make('div', { class: 'fd-gantt-sheet' }, axis(width), rows(groups, width)));
    body.replaceChildren(scroll);
    if (scrolled) [scroll.scrollLeft, scroll.scrollTop] = scrolled;
    // The keys' one stop: where they stood, else the first bar.
    const stops = [...body.querySelectorAll<HTMLElement>('[data-focus]')];
    const stop = stops.find((s) => s.dataset['focus'] === `t:${current}`) ?? stops[0];
    if (stop) {
      stop.tabIndex = 0;
      if (keys && stop.dataset['focus'] === keys) stop.focus({ preventScroll: true });
    }
    if (!placed && body.clientWidth > 0) {
      placed = true;
      toToday(false);
    }
  }

  /** The axis: a corner over the names, then months over days or weeks, or years over months, today's day marked. */
  function axis(width: number): HTMLElement {
    const { upper, lower } = ticksOf(span, zoom, locale, firstDay);
    const strip = make('div', { class: 'fd-gantt-axis', 'aria-hidden': 'true' });
    strip.style.width = `${width}px`;
    const todayAt = Math.floor(daysFrom(span.from, now()));
    for (const [row, ticks] of [['upper', upper], ['lower', lower]] as const) {
      for (const tick of ticks) {
        const mark = make('div', { class: 'fd-gantt-tick', 'data-row': row, title: tick.full, 'data-sub': tick.sub ? '' : undefined, 'aria-current': row === 'lower' && zoom === 'day' && tick.at === todayAt ? 'date' : undefined });
        if (tick.sub) mark.append(make('span', { class: 'fd-gantt-tick-sub' }, tick.sub), make('span', {}, tick.text));
        else mark.append(make('span', {}, tick.text));
        mark.style.insetInlineStart = `${tick.at * dayWidth}px`;
        mark.style.width = `${tick.days * dayWidth}px`;
        strip.append(mark);
      }
    }
    const corner = make('div', { class: 'fd-gantt-corner' }, page.fields[spec.title]?.label ?? '');
    return make('div', { class: 'fd-gantt-head' }, corner, strip);
  }

  /** The rows: each group's heading (where the timeline has groups), then a row for each of its records. */
  function rows(groups: GanttGroup[], width: number): HTMLElement {
    const holder = make('div', { class: 'fd-gantt-rows' });
    /** Each record's row's top, for the arrows: those of a closed group have none. */
    const tops = new Map<string, number>();
    let y = 0;
    const lines: HTMLElement[] = [];
    for (const group of groups) {
      const open = !closed.has(group.key);
      const section = make('div', spec.group ? { class: 'fd-gantt-group', role: 'group', 'aria-label': `${group.label}${joined}${holds(group.tasks.length)}` } : { class: 'fd-gantt-group' });
      if (spec.group) {
        const chevron = svg('svg', { viewBox: '0 0 16 16', 'aria-hidden': 'true' });
        chevron.innerHTML = CHEVRON;
        const toggle = make(
          'button',
          { type: 'button', class: 'fd-gantt-toggle', 'aria-expanded': String(open), 'aria-label': fill(open ? labels.collapse : labels.expand, { name: group.label }) },
          chevron,
          make('bdi', {}, group.label),
          make('span', { class: 'fd-gantt-count' }, String(group.tasks.length))
        );
        toggle.addEventListener('click', () => {
          if (closed.has(group.key)) closed.delete(group.key);
          else closed.add(group.key);
          draw();
          body.querySelector<HTMLElement>(`.fd-gantt-toggle[data-group="${quoted(group.key)}"]`)?.focus();
        });
        toggle.dataset['group'] = group.key;
        const track = make('div', { class: 'fd-gantt-track', 'aria-hidden': 'true' });
        track.style.width = `${width}px`;
        // The span its records take together.
        if (group.start && group.end) {
          const sum = make('div', { class: 'fd-gantt-sum' });
          sum.style.insetInlineStart = `${x(group.start)}px`;
          sum.style.width = `${Math.max(2, x(group.end) - x(group.start))}px`;
          track.append(sum);
        }
        section.append(make('div', { class: 'fd-gantt-row', 'data-head': '' }, make('div', { class: 'fd-gantt-name' }, toggle), track));
        y += HEAD;
      }
      if (open) {
        for (const task of group.tasks) {
          tops.set(String(task.id), y);
          section.append(taskRow(task, width));
          y += ROW;
        }
      }
      holder.append(section);
    }
    // Under the rows: a line at each day, week or month; today's; the arrows.
    const layer = make('div', { class: 'fd-gantt-layer', 'aria-hidden': 'true' });
    layer.style.width = `${width}px`;
    layer.style.height = `${y}px`;
    for (const tick of ticksOf(span, zoom, locale, firstDay).lower) {
      const line = make('div', { class: 'fd-gantt-line' });
      line.style.insetInlineStart = `${tick.at * dayWidth}px`;
      lines.push(line);
    }
    layer.append(...lines);
    const at = now();
    if (at >= span.from && daysFrom(span.from, at) <= span.days) {
      const line = make('div', { class: 'fd-gantt-today', 'data-today': '' });
      line.style.insetInlineStart = `${x(at)}px`;
      layer.append(line);
    }
    layer.append(arrows(tops, width, y));
    holder.prepend(layer);
    return holder;
  }

  /** A record's row: its name, kept in sight, and its bar on its days — or, with no start yet, its words saying so. */
  function taskRow(task: GanttTask, width: number): HTMLElement {
    const key = String(task.id);
    const { moves, why } = movable(task);
    const name = make('div', { class: 'fd-gantt-name', 'data-opens': canOpen ? '' : undefined }, make('bdi', { dir: 'auto' }, task.title));
    name.addEventListener('click', () => open(task));
    const track = make('div', { class: 'fd-gantt-track' });
    track.style.width = `${width}px`;
    const row = make('div', { class: 'fd-gantt-row', 'data-id': key }, name, track);
    if (!task.start || !task.end) {
      track.append(make('span', { class: 'fd-gantt-unplanned' }, labels.notPlanned));
      // Its name is its stop for the keys: Enter opens it.
      name.dataset['focus'] = `t:${key}`;
      name.tabIndex = -1;
      name.setAttribute('role', 'button');
      name.setAttribute('aria-label', spoken(task));
      if (canOpen) name.setAttribute('aria-describedby', keysStill.id);
      name.addEventListener('keydown', (e) => onKey(e, task, name));
      name.addEventListener('focus', () => standOn(name, key));
      return row;
    }
    const block = make('div', {
      class: 'fd-gantt-task',
      role: 'button',
      tabindex: '-1',
      'data-id': key,
      'data-focus': `t:${key}`,
      'data-opens': canOpen ? '' : undefined,
      'data-moves': moves ? '' : undefined,
      'data-milestone': task.milestone ? '' : undefined,
      'data-late': links.some((link) => link.to === task && link.late) ? '' : undefined,
      'aria-describedby': moves ? keysMoves.id : keysStill.id,
      title: why || spoken(task),
    });
    block.style.setProperty('--fd-gantt-c', colourOf(task.colour) ?? 'var(--fd-accent)');
    place(block, task);
    block.setAttribute('aria-label', spoken(task, undefined, why));
    block.append(make('span', { class: 'fd-gantt-task-text', dir: 'auto' }, task.title));
    if (moves && stretches(task, spec)) {
      for (const edge of ['start', 'end'] as const) {
        const grip = make('span', { class: 'fd-gantt-grip', 'data-edge': edge, 'aria-hidden': 'true' });
        grip.addEventListener('pointerdown', (e) => press(e, task, block, edge, moves));
        block.append(grip);
      }
    }
    block.addEventListener('pointerdown', (e) => press(e, task, block, 'both', moves));
    // A screen reader's press is a click with no pointer behind it: it opens the record as Enter does.
    block.addEventListener('click', (e) => e.detail === 0 && open(task));
    block.addEventListener('keydown', (e) => onKey(e, task, block));
    block.addEventListener('focus', () => standOn(block, key));
    block.addEventListener('blur', () => pending?.task === task && flush());
    track.append(block);
    return row;
  }

  /** The keys' one stop moved to a record's bar (or its name, with no bar): Tab comes back to it. */
  function standOn(stop: HTMLElement, key: string) {
    current = key;
    for (const other of body.querySelectorAll<HTMLElement>('[data-focus][tabindex="0"]')) if (other !== stop) other.tabIndex = -1;
    stop.tabIndex = 0;
  }

  /** A bar where it is, or where a move would take it: its start across the days, its length (a milestone, a point). */
  function place(block: HTMLElement, task: GanttTask, at = task.start && task.end ? { start: task.start, end: task.end } : null) {
    if (!at) return;
    block.style.insetInlineStart = `${x(at.start)}px`;
    if (task.milestone) return;
    const wide = x(at.end) - x(at.start);
    block.style.width = `${Math.max(8, wide)}px`;
    // Too narrow for a word: its colour alone, its words in its row's name and said to a screen reader.
    block.toggleAttribute('data-narrow', wide < 36);
  }

  /**
   * The arrows: from the end of each record waited for to the start of the one waiting, out of the one and into the
   * other; back round between the rows where it starts before that one ends (red, dashed: too soon). Drawn left to
   * right, and turned over right to left by the stylesheet.
   */
  function arrows(tops: Map<string, number>, width: number, height: number): SVGElement {
    const drawing = svg('svg', { class: 'fd-gantt-links', width: String(width), height: String(height), viewBox: `0 0 ${width} ${height}` });
    const defs = svg('defs');
    for (const late of [false, true]) {
      const marker = svg('marker', { id: `${id}-head${late ? '-late' : ''}`, viewBox: '0 0 8 8', refX: '7', refY: '4', markerWidth: '7', markerHeight: '7', orient: 'auto' });
      marker.append(svg('path', { d: 'M0 0L8 4L0 8z', class: 'fd-gantt-head-mark', 'data-late': late ? '' : undefined }));
      defs.append(marker);
    }
    drawing.append(defs);
    for (const link of links) {
      const [a, b] = [tops.get(String(link.from.id)), tops.get(String(link.to.id))];
      if (a === undefined || b === undefined || !link.from.end || !link.to.start) continue;
      const x1 = link.from.milestone ? x(link.from.end) + 7 : x(link.from.end);
      const x2 = link.to.milestone ? x(link.to.start) - 9 : x(link.to.start);
      const [y1, y2] = [a + ROW / 2, b + ROW / 2];
      // Out of the one, then down (or up) and into the other; where there is no room ahead, back round along the row's edge.
      const d =
        x2 - OUT >= x1 + OUT
          ? `M${x1} ${y1}H${x1 + OUT}V${y2}H${x2}`
          : `M${x1} ${y1}H${x1 + OUT}V${b > a ? b : b + ROW}H${x2 - OUT}V${y2}H${x2}`;
      drawing.append(svg('path', { d, class: 'fd-gantt-link', 'data-from': String(link.from.id), 'data-to': String(link.to.id), 'data-late': link.late ? '' : undefined, 'marker-end': `url(#${id}-head${link.late ? '-late' : ''})` }));
    }
    return drawing;
  }

  // ---- scale, today and paper ----------------------------------------------------------------------------------

  function setZoom(next: GanttZoom) {
    if (next === zoom) return;
    // Keep the day at the timeline's start in view across the change of scale.
    const scroller = body.querySelector<HTMLElement>('.fd-gantt-scroll');
    const shownDay = scroller ? addDays(span.from, Math.floor(Math.abs(scroller.scrollLeft) / dayWidth)) : null;
    zoom = next;
    dayWidth = DAY_WIDTH[zoom];
    draw();
    const again = body.querySelector<HTMLElement>('.fd-gantt-scroll');
    if (again && shownDay) again.scrollLeft = Math.round(x(shownDay)) * (rtl() ? -1 : 1);
  }

  /** Today brought into view, a little in from the timeline's start; the keys on the bar nearest it, when asked by its button. */
  function toToday(keys: boolean) {
    const scroller = body.querySelector<HTMLElement>('.fd-gantt-scroll');
    if (!scroller) return;
    const names = (body.querySelector<HTMLElement>('.fd-gantt-corner')?.offsetWidth ?? 0) || 0;
    // Whole pixels: a bar half a pixel past the names would show a sliver of itself beside them.
    const target = Math.round(Math.max(0, x(now()) - Math.max(0, scroller.clientWidth - names) / 4));
    scroller.scrollLeft = target * (rtl() ? -1 : 1);
    if (!keys) return;
    const at = now().getTime();
    const nearest = tasks.filter((t) => t.start && t.end && !closed.has(t.group ?? '')).sort((a, b) => distance(a, at) - distance(b, at))[0];
    if (nearest) body.querySelector<HTMLElement>(`[data-focus="t:${nearest.id}"]`)?.focus({ preventScroll: true });
  }
  const distance = (t: GanttTask, at: number) => ((t.start as Date).getTime() <= at && (t.end as Date).getTime() >= at ? 0 : Math.min(Math.abs((t.start as Date).getTime() - at), Math.abs((t.end as Date).getTime() - at)));

  /**
   * On paper, the whole plan on the page's width: as wide as the timeline is on screen, every day of it in, and its
   * scale's width back after. Told by the browser as it prints, and by the print look a test or a preview puts on.
   */
  let printing = false;
  const toPaper = (on: boolean) => {
    if (on === printing || destroyed) return;
    printing = on;
    const room = Math.max(480, (body.clientWidth || 960) - (body.clientWidth > 0 && body.clientWidth <= 640 ? 140 : 240) - 2);
    dayWidth = on ? Math.max(1, Math.min(DAY_WIDTH[zoom], room / Math.max(1, span.days))) : DAY_WIDTH[zoom];
    draw();
  };
  const view = doc.defaultView;
  const before = () => toPaper(true);
  const after = () => toPaper(false);
  view?.addEventListener('beforeprint', before);
  view?.addEventListener('afterprint', after);
  const paper = view?.matchMedia?.('print');
  const onPaper = (e: MediaQueryListEvent) => toPaper(e.matches);
  paper?.addEventListener?.('change', onPaper);

  // Made wider or narrower: drawn again where its days no longer fill it, never under a drag or a move of the keys.
  let measured = 0;
  const resized =
    typeof ResizeObserver === 'function'
      ? new ResizeObserver(() => {
          const width = body.clientWidth;
          if (Math.abs(width - measured) < 40 || !tasks.length || failed || pending || printing || body.querySelector('[data-moving]')) return;
          measured = width;
          draw();
        })
      : null;
  resized?.observe(body);

  /** Today's line, moved on as the day goes. */
  const ticking = setInterval(() => {
    const line = body.querySelector<HTMLElement>('.fd-gantt-today');
    if (line) line.style.insetInlineStart = `${x(now())}px`;
  }, 60000);

  // ---- the pointer: a bar dragged to move it, or by an end to stretch it ------------------------------------------

  function press(e: PointerEvent, task: GanttTask, block: HTMLElement, edge: Edge, moves: boolean) {
    if (e.button !== 0) return;
    if (edge === 'both' && (e.target as HTMLElement).closest('.fd-gantt-grip')) return;
    e.stopPropagation();
    if (edge !== 'both') e.preventDefault();
    flush();
    const startX = e.clientX;
    const startY = e.clientY;
    const flip = rtl() ? -1 : 1;
    let moving = false;
    let dragged = false;
    let by = 0;
    const itsLinks = () => [...body.querySelectorAll<SVGElement>(`.fd-gantt-link[data-from="${quoted(task.id)}"], .fd-gantt-link[data-to="${quoted(task.id)}"]`)];
    const move = (m: PointerEvent) => {
      if (!moving && Math.hypot(m.clientX - startX, m.clientY - startY) < DRAG_FROM) return;
      dragged = true;
      if (!moves) return;
      if (!moving) {
        moving = true;
        block.setAttribute('data-moving', '');
        // Its arrows wait for it to land.
        for (const link of itsLinks()) link.style.visibility = 'hidden';
      }
      by = clampBy(task, Math.round(((m.clientX - startX) * flip) / dayWidth), edge);
      const at = shifted(task, by, edge);
      place(block, task, at);
      if (at) block.title = fill(labels.fromTo, fromTo(at.start, at.end));
    };
    const finish = (keep: boolean) => {
      doc.removeEventListener('pointermove', move);
      doc.removeEventListener('pointerup', up);
      doc.removeEventListener('pointercancel', cancel);
      doc.removeEventListener('keydown', escape, true);
      if (!moving) return;
      block.removeAttribute('data-moving');
      if (keep && by) return void commit(task, by, edge);
      draw();
    };
    const up = () => {
      finish(true);
      if (!dragged) open(task);
    };
    const cancel = () => finish(false);
    const escape = (k: KeyboardEvent) => {
      if (k.key !== 'Escape') return;
      k.preventDefault();
      k.stopPropagation();
      cancel();
    };
    doc.addEventListener('pointermove', move);
    doc.addEventListener('pointerup', up);
    doc.addEventListener('pointercancel', cancel);
    doc.addEventListener('keydown', escape, true);
  }

  // ---- the keys -------------------------------------------------------------------------------------------------

  function onKey(e: KeyboardEvent, task: GanttTask, target: HTMLElement) {
    if (e.target !== target) return;
    const sideways = (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0) * (rtl() ? -1 : 1);
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      flush();
      open(task);
    } else if (e.key === 'Escape' && pending) {
      // A move not written yet, put back.
      e.preventDefault();
      e.stopPropagation();
      clearTimeout(pending.timer);
      pending = null;
      live.textContent = '';
      draw();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      flush();
      const stops = [...body.querySelectorAll<HTMLElement>('[data-focus]')];
      const at = stops.indexOf(target);
      const next = e.key === 'Home' ? stops[0] : e.key === 'End' ? stops[stops.length - 1] : stops[at + (e.key === 'ArrowUp' ? -1 : 1)];
      if (next) {
        next.focus();
        next.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    } else if (sideways && task.start && target.hasAttribute('data-moves')) {
      e.preventDefault();
      const edge: Edge = e.shiftKey && stretches(task, spec) ? 'end' : 'both';
      if (e.shiftKey && edge !== 'end') return;
      if (pending && pending.edge !== edge) flush();
      const by = clampBy(task, (pending?.by ?? 0) + sideways, edge);
      if (pending) clearTimeout(pending.timer);
      pending = { task, by, edge, timer: setTimeout(flush, SETTLE) };
      const at = shifted(task, by, edge);
      place(target, task, at);
      if (at) {
        target.setAttribute('aria-label', spoken(task, at));
        live.textContent = `${task.title}${joined}${task.milestone ? fill(labels.on, { day: when(at.start) }) : fill(labels.fromTo, fromTo(at.start, at.end))}`;
      }
      target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }
  }

  /** A move from the keys written now: as they come to rest, or the bar is left. */
  function flush() {
    if (!pending) return;
    const { task, by, edge, timer } = pending;
    clearTimeout(timer);
    pending = null;
    if (by) void commit(task, by, edge);
  }

  // ---- opening, and writing a move ------------------------------------------------------------------------------

  function open(task: GanttTask) {
    if (!context.open) return;
    const answer = context.open(task.id);
    if (answer instanceof Promise) void answer.then(() => (destroyed ? undefined : reload()));
  }

  /**
   * A move's save: the fields it writes and no others, in `values` as in `changes`, and `partial` saying so, so a
   * source that saves whole records keeps every field the timeline never had, and every change made elsewhere since.
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
   * A move by whole days written through the data source's save — at once on the page, put back if the save is
   * refused — with Undo, which writes back what those fields held. Each waits for the one before it.
   */
  function commit(task: GanttTask, by: number, edge: Edge): Promise<unknown> {
    const values = movedBy(task, by, edge, spec, page);
    const at = shifted(task, by, edge);
    if (!source?.save || !Object.keys(values).length || !at) {
      draw();
      return Promise.resolve();
    }
    const words =
      edge === 'end' ? fill(labels.stretched, { name: task.title, when: fromTo(at.start, at.end).to }) : edge === 'start' ? fill(labels.started, { name: task.title, when: when(at.start) }) : fill(labels.moved, { name: task.title, ...fromTo(at.start, at.end) });
    const key = String(task.id);
    // At once on the page.
    const before: Values = Object.fromEntries(Object.keys(values).map((name) => [name, task.record.values[name] ?? null]));
    records = records.map((r) => (String(r.id) === key ? { ...r, values: { ...r.values, ...values } } : r));
    setTasks();
    draw();
    for (const block of body.querySelectorAll<HTMLElement>(`.fd-gantt-task[data-id="${quoted(key)}"]`)) block.setAttribute('aria-busy', 'true');
    say('');
    alert.replaceChildren();
    live.textContent = '';
    const run = saving.then(async () => {
      if (destroyed) return;
      const version = records.find((r) => String(r.id) === key)?.version;
      try {
        const result = await source.save?.(moveSave(task.id, values, version));
        undo = { id: task.id, values: before, ...(result?.version ? { version: result.version } : {}) };
        say(words, task.id, true);
      } catch (error) {
        const problem = saveProblemOf(error);
        alert.textContent = fill(labels.notMoved, { why: problem.message || Object.values(problem.fields ?? {}).join(' ') });
      }
      if (!destroyed) await reload();
    });
    saving = run.catch(() => undefined);
    return run;
  }

  /** Undo: the moved fields as they were, and no others; the keys, when they were on Undo, back on the record. */
  async function undoLast() {
    const last = undo;
    if (!last || !source?.save) return;
    const keys = said.contains(doc.activeElement);
    undo = null;
    say('');
    await saving;
    try {
      await source.save(moveSave(last.id, last.values, last.version ?? records.find((r) => String(r.id) === String(last.id))?.version));
      say(labels.undone, last.id);
    } catch (error) {
      alert.textContent = fill(labels.notMoved, { why: saveProblemOf(error).message });
    }
    if (destroyed) return;
    await reload();
    if (keys && (!doc.activeElement || doc.activeElement === doc.body)) body.querySelector<HTMLElement>(`[data-focus="t:${last.id}"]`)?.focus();
  }

  /** Words in the status line about a record, with Undo after a move and a way to close them, which leaves the keys on that record. */
  function say(words: string, about?: RecordId, withUndo = false) {
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
      if (keys && about !== undefined) body.querySelector<HTMLElement>(`[data-focus="t:${about}"]`)?.focus();
    });
    said.append(close);
  }

  drawTitle([]);
  return {
    element,
    reload,
    highlight(recordId) {
      for (const row of body.querySelectorAll<HTMLElement>('.fd-gantt-row[data-id]')) {
        const hot = recordId !== null && row.dataset['id'] === String(recordId);
        row.classList.toggle('fd-gantt-hot', hot);
        row.querySelector('.fd-gantt-task')?.classList.toggle('fd-gantt-hot', hot);
      }
    },
    chosenChanged() {
      // A timeline has no boxes to choose a record: what is chosen is the table's.
    },
    shown() {
      // Shown after being hidden: measured again, and brought to today the first time.
      if (tasks.length && !failed) draw();
    },
    destroy() {
      destroyed = true;
      if (pending) clearTimeout(pending.timer);
      clearInterval(ticking);
      resized?.disconnect();
      view?.removeEventListener('beforeprint', before);
      view?.removeEventListener('afterprint', after);
      paper?.removeEventListener?.('change', onPaper);
      element.remove();
    },
  };
}
