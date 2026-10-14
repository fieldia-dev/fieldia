import type { CalendarCore, Column } from './calendar-core';
import { atMinutes, dayKey, format, readDay } from './dates';
import { moved, whereTo, type CalendarEvent } from './events';
import { fill } from './labels';

/** How far Move to… reaches, in years either side of the record's own day: a year typed short (26) or long (2062) is caught. */
const YEARS = 10;

/** A small box of the calendar's own (Move to…, a crowded slot's list) put under what opened it, kept inside the calendar. */
export function placeUnder(cal: CalendarCore, box: HTMLElement, under: HTMLElement) {
  cal.element.append(box);
  const room = cal.element.getBoundingClientRect();
  const mark = under.getBoundingClientRect();
  box.style.top = `${Math.max(0, mark.bottom - room.top + 4)}px`;
  box.style.insetInlineStart = `${Math.max(8, Math.min(cal.rtl() ? room.right - mark.right : mark.left - room.left, room.width - 328))}px`;
  box.scrollIntoView?.({ block: 'nearest' });
}

/**
 * "Move to…", the keyboard's way to move a record and a phone's: a small
 * dialog under the record with its day, its time and its person, kept inside
 * the calendar. Move writes it as a drag does, with Undo; Escape, Cancel or a
 * press outside closes it, the focus back on the record. A day that is no
 * day, or one more than ten years from the record's, is refused in words.
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
    const { body, labels, make, page, spec } = cal;
    /** The record again, as it was: its block, or the one drawn in its place, else wherever the record is now. */
    const again = () => (block.isConnected ? block : (body.querySelector<HTMLElement>(`[data-focus="${block.dataset['focus']}"]`) ?? cal.place(event.id, event.start)));
    const heading = make('h3', { class: 'fd-cal-move-title', id: `${cal.id}-move` }, fill(labels.moveTitle, { name: event.title }));
    // The days it may go to, which a browser's own picker keeps to as well.
    const [first, last] = [-YEARS, YEARS].map((by) => {
      const d = new Date(event.start);
      d.setFullYear(d.getFullYear() + by);
      return d;
    });
    const day = make('input', { type: 'date', class: 'fd-input', min: dayKey(first), max: dayKey(last) });
    day.value = dayKey(event.start);
    const at = make('input', { type: 'time', class: 'fd-input', step: String(cal.slot * 60) });
    at.value = `${String(event.start.getHours()).padStart(2, '0')}:${String(event.start.getMinutes()).padStart(2, '0')}`;
    const who = make('select', { class: 'fd-input fd-select' });
    const people = cal.state.resources.filter((r): r is NonNullable<Column['resource']> => !!r);
    for (const person of people) who.append(make('option', { value: person.key }, person.label));
    who.value = event.resource ?? '';
    const moveButton = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, labels.move);
    const cancel = make('button', { type: 'button', class: 'fd-button' }, labels.cancel);
    const problem = make('p', { class: 'fd-cal-move-problem', id: `${cal.id}-move-problem`, role: 'alert' });
    const rows: Node[] = [heading, make('label', {}, labels.moveDay, day)];
    if (!event.allDay) rows.push(make('label', {}, labels.moveTime, at));
    if (spec.resource && people.length) rows.push(make('label', {}, page.fields[spec.resource]?.label ?? '', who));
    rows.push(problem, make('div', { class: 'fd-cal-move-actions' }, cancel, moveButton));
    const opened = make('div', { class: 'fd-cal-move', role: 'dialog', 'aria-labelledby': heading.id }, ...rows);
    box = opened;
    placeUnder(cal, opened, block);
    day.focus();
    /** Said what is wrong, under the box it is wrong in, and the keys back in that box. */
    const refuse = (input: HTMLInputElement, words: string) => {
      for (const one of [day, at]) {
        one.removeAttribute('aria-invalid');
        one.removeAttribute('aria-describedby');
      }
      problem.textContent = words;
      input.setAttribute('aria-invalid', 'true');
      input.setAttribute('aria-describedby', problem.id);
      input.focus();
    };
    const apply = () => {
      const when = readDay(day.value);
      const shortDay = (d: Date) => format(cal.locale, { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
      if (!when || when < new Date(first.getFullYear(), first.getMonth(), first.getDate()) || when > last) return refuse(day, fill(labels.badDay, { from: shortDay(first), to: shortDay(last) }));
      const time = /^(\d\d):(\d\d)/.exec(at.value);
      if (!event.allDay && !time) return refuse(at, labels.badTime);
      const start = time && !event.allDay ? atMinutes(when, Number(time[1]) * 60 + Number(time[2])) : when;
      const person = people.find((p) => p.key === who.value);
      const values = moved(event, start, spec, page, person ?? undefined);
      close();
      if (!Object.keys(values).length) return again().focus();
      void cal.commit(event, values, fill(labels.moved, { name: event.title, when: whereTo(event, start, cal.locale) })).then((saved) => {
        // Where the record now is (its new day, when shown), or the bar's step toward that day; as it was, when refused.
        // Unless the person has gone on somewhere else meanwhile.
        const active = cal.doc.activeElement;
        if (!active || active === cal.doc.body) (saved ? cal.place(event.id, start) : again()).focus();
      });
    };
    moveButton.addEventListener('click', apply);
    cancel.addEventListener('click', () => close(again()));
    opened.addEventListener('keydown', (k) => {
      if (k.key === 'Escape') {
        k.preventDefault();
        k.stopPropagation();
        close(again());
      } else if (k.key === 'Enter' && (k.target as HTMLElement).tagName === 'INPUT') {
        k.preventDefault();
        apply();
      }
    });
    cal.doc.addEventListener('pointerdown', outside, true);
  }

  return { open, close };
}
