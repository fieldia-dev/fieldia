import { linesIn, type CalendarCore, type Column } from './calendar-core';
import { addMinutes, atMinutes, dayOn, minutesOf, readDay } from './dates';
import { moved, whereTo, type CalendarEvent } from './events';
import { fill } from './labels';

/**
 * A calendar's pointer: an empty slot pressed or dragged across for a new
 * record, a record dragged to another time, day or person, and its end
 * stretched. Each drag follows the pointer over the whole document until it
 * is let go.
 */

/** How far a press moves before it is a drag rather than a click. */
const DRAG_FROM = 4;

/** Escape while a drag is held: `cancel` lets go of it, the key kept from anything else (a dialog round the calendar). */
function onEscape(doc: Document, cancel: () => void) {
  const escape = (k: KeyboardEvent) => {
    if (k.key !== 'Escape') return;
    k.preventDefault();
    k.stopPropagation();
    cancel();
  };
  doc.addEventListener('keydown', escape, true);
  return () => doc.removeEventListener('keydown', escape, true);
}

/** A press on an empty slot: a new record there, or, dragged down or up, over the slots it crossed; none after Escape. */
export function pressSlot(cal: CalendarCore, e: PointerEvent, col: HTMLElement, i: number) {
  const { doc, state, slot } = cal;
  const target = e.target as HTMLElement;
  if (e.button !== 0 || !target.classList.contains('fd-cal-slot')) return;
  e.preventDefault();
  const perMinute = cal.hour / 60;
  const top = col.getBoundingClientRect().top;
  const minutesAt = (y: number) => Math.min(Math.max(state.shownHours.start * 60, state.shownHours.start * 60 + Math.floor((y - top) / perMinute / slot) * slot), state.shownHours.end * 60 - slot);
  const first = Number(target.dataset['minutes']);
  let last = first;
  const picking = cal.make('div', { class: 'fd-cal-picking' });
  const drawPick = () => {
    const [a, b] = [Math.min(first, last), Math.max(first, last) + slot];
    picking.style.top = `${(a - state.shownHours.start * 60) * perMinute}px`;
    picking.style.height = `${(b - a) * perMinute}px`;
  };
  drawPick();
  col.append(picking);
  const move = (m: PointerEvent) => {
    last = minutesAt(m.clientY);
    drawPick();
  };
  const stop = () => {
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerup', up);
    doc.removeEventListener('pointercancel', stop);
    unescape();
    picking.remove();
  };
  const unescape = onEscape(doc, stop);
  const up = () => {
    stop();
    const column = state.columns[i];
    const [a, b] = [Math.min(first, last), Math.max(first, last) + slot];
    const dragged = a !== first || b !== first + slot;
    void cal.createAt(atMinutes(column.day, a), dragged ? atMinutes(column.day, b) : null, column);
  };
  doc.addEventListener('pointermove', move);
  doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', stop);
}

/**
 * A press on a record: a click opens it; a drag moves it — to another time, day or person — where it is let go,
 * by the slot; Escape while dragging puts it back. A drag of one that cannot move goes nowhere, and opens nothing.
 */
export function pressEvent(cal: CalendarCore, e: PointerEvent, event: CalendarEvent, block: HTMLElement, movable: boolean) {
  if (e.button !== 0) return;
  if ((e.target as HTMLElement).closest('.fd-cal-resize, .fd-cal-event-menu')) return;
  e.stopPropagation();
  const { doc, state } = cal;
  const startX = e.clientX;
  const startY = e.clientY;
  const home = block.parentElement as HTMLElement;
  const timedHere = home.classList.contains('fd-cal-col');
  const homeTop = timedHere ? home.getBoundingClientRect().top : 0;
  /** Minutes between the record's start (on this day) and where it was taken hold of. */
  const day = readDay((block.dataset['focus'] ?? '').split(':').pop() ?? '');
  const segStart = (day && cal.segment(event, day)?.start) || event.start;
  const grabbed = timedHere ? Math.round((startY - homeTop) / (cal.hour / 60)) - (minutesOf(segStart) - state.shownHours.start * 60) : 0;
  /** How far into the record this day's part begins: a record from the night before is taken by its morning's part. */
  const into = Math.round((segStart.getTime() - event.start.getTime()) / 60000);
  let moving = false;
  let dragged = false;
  let landing: { start: Date; column: Column | null } | null = null;
  const move = (m: PointerEvent) => {
    if (!moving && Math.hypot(m.clientX - startX, m.clientY - startY) < DRAG_FROM) return;
    dragged = true;
    if (!movable) return;
    if (!moving) {
      moving = true;
      block.setAttribute('data-moving', '');
    }
    landing = landingAt(cal, m.clientX, m.clientY, event, timedHere, grabbed, block);
    if (landing && into) landing = { ...landing, start: addMinutes(landing.start, -into) };
  };
  const finish = (commitIt: boolean) => {
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerup', up);
    doc.removeEventListener('pointercancel', cancel);
    unescape();
    if (!moving) return;
    block.removeAttribute('data-moving');
    if (!commitIt || !landing) return cal.draw();
    const values = moved(event, landing.start, cal.spec, cal.page, landing.column?.resource ?? undefined);
    void cal.commit(event, values, fill(cal.labels.moved, { name: event.title, when: whereTo(event, landing.start, cal.locale) }));
  };
  const up = () => {
    finish(true);
    if (!dragged) cal.open(event);
  };
  const cancel = () => finish(false);
  const unescape = onEscape(doc, cancel);
  doc.addEventListener('pointermove', move);
  doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', cancel);
}

/** Where a record dragged to (x, y) lands: a day's column and the slot under it, or a day (a whole day's record, the month). */
function landingAt(cal: CalendarCore, x: number, y: number, event: CalendarEvent, timed: boolean, grabbed: number, block: HTMLElement): { start: Date; column: Column | null } | null {
  const { body, state, slot } = cal;
  const under = cal.doc.elementFromPoint(x, y) as HTMLElement | null;
  if (timed) {
    const col = under?.closest<HTMLElement>('.fd-cal-col');
    if (!col || !body.contains(col)) return null;
    const column = state.columns[Number(col.dataset['column'])];
    const top = col.getBoundingClientRect().top;
    const length = Math.round((event.end.getTime() - event.start.getTime()) / 60000);
    let minutes = state.shownHours.start * 60 + Math.round(((y - top) / (cal.hour / 60) - grabbed) / slot) * slot;
    minutes = Math.min(Math.max(0, minutes), 24 * 60 - Math.min(length, slot));
    const start = atMinutes(column.day, minutes);
    // It shows where it would land: in that column, at that time.
    if (block.parentElement !== col) col.append(block);
    block.style.top = `${(minutes - state.shownHours.start * 60) * (cal.hour / 60)}px`;
    block.style.insetInlineStart = '1px';
    block.style.width = 'calc(100% - 3px)';
    const shownTime = block.querySelector('.fd-cal-event-time');
    if (shownTime) shownTime.textContent = cal.time(start);
    return { start, column };
  }
  const cell = under?.closest<HTMLElement>('[data-day]');
  if (!cell || !body.contains(cell) || cell.classList.contains('fd-cal-col')) return null;
  const [y4, mo, d] = (cell.dataset['day'] ?? '').split('-').map(Number);
  const start = dayOn(y4, mo - 1, d, minutesOf(event.start));
  if (block.parentElement !== cell) cell.append(block);
  const column = cell.dataset['column'] !== undefined ? (state.columns[Number(cell.dataset['column'])] ?? null) : null;
  return { start, column };
}

/** Its end dragged: a longer or shorter record, by the slot, never shorter than one; as it was after Escape. */
export function stretch(cal: CalendarCore, e: PointerEvent, event: CalendarEvent, block: HTMLElement, col: HTMLElement) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const { doc, state, slot } = cal;
  const perMinute = cal.hour / 60;
  const top = col.getBoundingClientRect().top;
  const startMinutes = minutesOf(event.start);
  let end = event.end;
  let moving = false;
  const move = (m: PointerEvent) => {
    moving = true;
    block.setAttribute('data-moving', '');
    const minutes = Math.max(startMinutes + slot, Math.min(24 * 60, state.shownHours.start * 60 + Math.round((m.clientY - top) / perMinute / slot) * slot));
    end = atMinutes(event.start, minutes);
    const height = (minutes - startMinutes) * perMinute - 2;
    block.style.height = `${height}px`;
    block.style.setProperty('--fd-cal-lines', String(linesIn(height)));
  };
  const stop = () => {
    doc.removeEventListener('pointermove', move);
    doc.removeEventListener('pointerup', up);
    doc.removeEventListener('pointercancel', cancel);
    unescape();
    block.removeAttribute('data-moving');
  };
  const up = () => {
    stop();
    if (!moving || end.getTime() === event.end.getTime()) return cal.draw();
    void cal.commit(event, moved(event, event.start, cal.spec, cal.page, undefined, end), fill(cal.labels.stretched, { name: event.title, when: cal.time(end) }));
  };
  // Taken away by the browser (a touch become a scroll), or Escape: drawn back as it was, and nothing follows the pointer after.
  const cancel = () => {
    stop();
    cal.draw();
  };
  const unescape = onEscape(doc, cancel);
  doc.addEventListener('pointermove', move);
  doc.addEventListener('pointerup', up);
  doc.addEventListener('pointercancel', cancel);
}
