import type { CalendarCore } from './calendar-core';
import { addDays, atMinutes, dayKey, minutesOf, startOfDay, stepFrom } from './dates';
import type { CalendarEvent } from './events';

/**
 * A calendar's keys. On a record: Enter opens it, M (or the menu key, or
 * Shift+F10) opens Move to…, up and down reach the record before or after,
 * left and right the day or person beside. On the slots: the arrows move a
 * slot or a column, Home and End to the first and last hour, Page Up and
 * Page Down a span, Enter makes a record there. On a month's days: the arrows
 * move a day or a week, Home and End to the week's ends, Page Up and Page
 * Down a month. Left and right go as the line reads, so they flip right to
 * left.
 */

const sideways = (cal: CalendarCore, key: string) => (key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0) * (cal.rtl() ? -1 : 1);

export function onEventKey(cal: CalendarCore, e: KeyboardEvent, event: CalendarEvent, block: HTMLElement, pressed = false) {
  if (!pressed && e.target !== block) return;
  const { body, state } = cal;
  const movable = !!block.closest('.fd-cal-event')?.hasAttribute('data-moves');
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    if (cal.canOpen) cal.open(event);
    else if (movable) cal.openMove(event, block);
  } else if (movable && (e.key === 'm' || e.key === 'M' || e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey))) {
    e.preventDefault();
    cal.openMove(event, block);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault();
    const all = [...body.querySelectorAll<HTMLElement>('[data-focus^="e:"][tabindex="0"]')];
    if (state.view === 'agenda' || state.view === 'month' || (!e.key.includes('Left') && !e.key.includes('Right'))) {
      // Up and down: the record before or after, in the order they are read.
      const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : sideways(cal, e.key);
      if (state.view === 'day' || state.view === 'week') {
        const here = all.filter((b) => b.parentElement === block.parentElement).sort((a, b) => a.offsetTop - b.offsetTop || all.indexOf(a) - all.indexOf(b));
        here[here.indexOf(block) + step]?.focus();
      } else all[all.indexOf(block) + step]?.focus();
      return;
    }
    // Left and right: the day or person beside, at the same time.
    const col = block.closest<HTMLElement>('[data-column]');
    const next = Number(col?.dataset['column'] ?? 0) + sideways(cal, e.key);
    const minutes = cal.clampMinutes(minutesOf(event.start));
    const target = body.querySelector<HTMLElement>(`[data-focus="s:${next}:${minutes}"]`) ?? body.querySelector<HTMLElement>(`[data-column="${next}"] [data-focus^="e:"][tabindex="0"]`);
    target?.focus();
  }
}

export function onSlotKey(cal: CalendarCore, e: KeyboardEvent, column: number, minutes: number) {
  const { body, state, slot } = cal;
  let next = { column, minutes };
  if (e.key === 'ArrowUp') next.minutes -= slot;
  else if (e.key === 'ArrowDown') next.minutes += slot;
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') next.column += sideways(cal, e.key);
  else if (e.key === 'Home') next.minutes = state.shownHours.start * 60;
  else if (e.key === 'End') next.minutes = state.shownHours.end * 60 - slot;
  else if (e.key === 'PageUp' || e.key === 'PageDown') {
    e.preventDefault();
    state.cursor = { ...state.cursor, day: stepFrom(state.view, state.columns[column].day, e.key === 'PageUp' ? -1 : 1), minutes };
    state.anchor = startOfDay(state.cursor.day);
    void cal.reload().then(() => body.querySelector<HTMLElement>('.fd-cal-slot[tabindex="0"]')?.focus());
    return;
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    const col = state.columns[column];
    void cal.createAt(atMinutes(col.day, minutes), null, col);
    return;
  } else return;
  e.preventDefault();
  // Past the first or the last column: the span before or after.
  if (next.column < 0 || next.column >= state.columns.length) {
    if (state.view === 'day' && cal.spec.resource) return;
    const by = next.column < 0 ? -1 : 1;
    const day = addDays(state.columns[column].day, by);
    state.cursor = { day, minutes, column: by < 0 ? 6 : 0 };
    state.anchor = startOfDay(day);
    void cal.reload().then(() => body.querySelector<HTMLElement>('.fd-cal-slot[tabindex="0"]')?.focus());
    return;
  }
  next = { column: next.column, minutes: cal.clampMinutes(next.minutes) };
  const target = body.querySelector<HTMLElement>(`[data-focus="s:${next.column}:${next.minutes}"]`);
  if (!target) return;
  for (const cell of body.querySelectorAll<HTMLElement>('.fd-cal-slot[tabindex="0"]')) cell.tabIndex = -1;
  target.tabIndex = 0;
  target.focus();
  target.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
}

export function onDayKey(cal: CalendarCore, e: KeyboardEvent, day: Date) {
  const { body, state, firstDay } = cal;
  let by: number;
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') by = sideways(cal, e.key);
  else if (e.key === 'ArrowUp') by = -7;
  else if (e.key === 'ArrowDown') by = 7;
  else if (e.key === 'Home') by = -((day.getDay() - firstDay + 7) % 7);
  else if (e.key === 'End') by = 6 - ((day.getDay() - firstDay + 7) % 7);
  else if (e.key === 'PageUp' || e.key === 'PageDown') {
    e.preventDefault();
    const next = stepFrom('month', day, e.key === 'PageUp' ? -1 : 1);
    state.cursor = { ...state.cursor, day: next };
    state.anchor = startOfDay(next);
    void cal.reload().then(() => body.querySelector<HTMLElement>(`[data-focus="d:${dayKey(next)}"]`)?.focus());
    return;
  } else return;
  e.preventDefault();
  const next = addDays(day, by);
  state.cursor = { ...state.cursor, day: next };
  const target = body.querySelector<HTMLElement>(`[data-focus="d:${dayKey(next)}"]`);
  if (target) {
    for (const n of body.querySelectorAll<HTMLElement>('.fd-cal-daynum[tabindex="0"]')) n.tabIndex = -1;
    target.tabIndex = 0;
    target.focus();
    return;
  }
  // Into the month before or after.
  state.anchor = startOfDay(next);
  void cal.reload().then(() => body.querySelector<HTMLElement>(`[data-focus="d:${dayKey(next)}"]`)?.focus());
}
