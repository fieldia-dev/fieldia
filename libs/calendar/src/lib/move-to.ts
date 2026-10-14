import type { CalendarCore, Column } from './calendar-core';
import { dayKey } from './dates';
import { moved, whereTo, type CalendarEvent } from './events';
import { fill } from './labels';

/**
 * "Move to…", the keyboard's way to move a record and a phone's: a small
 * dialog under the record with its day, its time and its person, kept inside
 * the calendar. Move writes it as a drag does, with Undo; Escape, Cancel or a
 * press outside closes it, the focus back on the record.
 */
export function moveTo(cal: CalendarCore): { open(event: CalendarEvent, block: HTMLElement): void; close(back?: HTMLElement): void } {
  let box: HTMLElement | null = null;
  const outside = (e: PointerEvent) => {
    if (box && !box.contains(e.target as Node)) close();
  };

  function close(back?: HTMLElement) {
    box?.remove();
    box = null;
    cal.doc.removeEventListener('pointerdown', outside, true);
    back?.focus();
  }

  function open(event: CalendarEvent, block: HTMLElement) {
    close();
    const { body, element, labels, make, page, spec } = cal;
    /** The record again, wherever it now is: on the same day, else its first. */
    const focusBack = () => body.querySelector<HTMLElement>(`[data-focus="${block.dataset['focus']}"]`) ?? body.querySelector<HTMLElement>(`[data-focus^="e:${event.id}:"]`) ?? block;
    const heading = make('h3', { class: 'fd-cal-move-title', id: `${cal.id}-move` }, fill(labels.moveTitle, { name: event.title }));
    const day = make('input', { type: 'date', class: 'fd-input' });
    day.value = dayKey(event.start);
    const at = make('input', { type: 'time', class: 'fd-input', step: String(cal.slot * 60) });
    at.value = `${String(event.start.getHours()).padStart(2, '0')}:${String(event.start.getMinutes()).padStart(2, '0')}`;
    const who = make('select', { class: 'fd-input fd-select' });
    const people = cal.state.resources.filter((r): r is NonNullable<Column['resource']> => !!r);
    for (const person of people) who.append(make('option', { value: person.key }, person.label));
    who.value = event.resource ?? '';
    const moveButton = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.move);
    const cancel = make('button', { type: 'button', class: 'fd-button' }, labels.cancel);
    const rows: Node[] = [heading, make('label', {}, labels.moveDay, day)];
    if (!event.allDay) rows.push(make('label', {}, labels.moveTime, at));
    if (spec.resource && people.length) rows.push(make('label', {}, page.fields[spec.resource]?.label ?? '', who));
    rows.push(make('div', { class: 'fd-cal-move-actions' }, cancel, moveButton));
    const opened = make('div', { class: 'fd-cal-move', role: 'dialog', 'aria-labelledby': heading.id }, ...rows);
    box = opened;
    element.append(opened);
    // Under the record, kept inside the calendar.
    const room = element.getBoundingClientRect();
    const mark = block.getBoundingClientRect();
    opened.style.top = `${Math.max(0, mark.bottom - room.top + 4)}px`;
    opened.style.insetInlineStart = `${Math.max(8, Math.min(cal.rtl() ? room.right - mark.right : mark.left - room.left, room.width - 328))}px`;
    opened.scrollIntoView?.({ block: 'nearest' });
    day.focus();
    const apply = () => {
      const [y4, mo, d] = day.value.split('-').map(Number);
      if (!y4 || !mo || !d) return day.focus();
      const [hh, mm] = (at.value || '00:00').split(':').map(Number);
      const start = event.allDay ? new Date(y4, mo - 1, d) : new Date(y4, mo - 1, d, hh || 0, mm || 0);
      const person = people.find((p) => p.key === who.value);
      const values = moved(event, start, spec, page, person ?? undefined);
      close();
      if (!Object.keys(values).length) return focusBack().focus();
      void cal.commit(event, values, fill(labels.moved, { name: event.title, when: whereTo(event, start, cal.locale) })).then(() => focusBack().focus());
    };
    moveButton.addEventListener('click', apply);
    cancel.addEventListener('click', () => close(focusBack()));
    opened.addEventListener('keydown', (k) => {
      if (k.key === 'Escape') {
        k.preventDefault();
        k.stopPropagation();
        close(focusBack());
      } else if (k.key === 'Enter' && (k.target as HTMLElement).tagName === 'INPUT') {
        k.preventDefault();
        apply();
      }
    });
    cal.doc.addEventListener('pointerdown', outside, true);
  }

  return { open, close };
}
