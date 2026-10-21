import { hijriWords, type Locale } from '@fieldia/core';
import type { CalendarHost, CalendarKind } from './calendar';
import { hijriOf } from './hijri';
import { wordsFor } from './kind-parts';
import type { WidgetLabels } from './labels';
import { installMonthsStyles } from './styles-months';

/**
 * The calendars of a month alone, a year alone and a Hijri date, as the date part's calendar draws them
 * (calendar.ts `CalendarKind`): a year's twelve months, or twelve years, three to a row — the one held picked, this
 * month (or year) marked, one past the field's limits faint and refused with why; the arrows move by one and by a row
 * (mirrored right to left), Page Up and Page Down by a year (or twelve), Enter picks — and a Hijri date's month of
 * days, each with its Hijri day under it and said after its own, the month's title with the Hijri months it spans. In
 * the months part.
 */

const lang = (locale: Locale) => (locale === 'en' ? 'en-GB' : locale);

/** A year's twelve months, or twelve years, to pick a month or a year from: each kept as its first day. */
export function periodCalendar(grain: 'month' | 'year', doc: Document, labels: WidgetLabels | undefined, locale: Locale): CalendarKind {
  installMonthsStyles(doc);
  const words = wordsFor(labels, locale);
  const years = grain === 'year';
  const short = new Intl.DateTimeFormat(lang(locale), { month: 'short', numberingSystem: 'latn' });
  const long = new Intl.DateTimeFormat(lang(locale), { month: 'long', year: 'numeric', numberingSystem: 'latn' });
  /** A month or a year moved by `n`. */
  const shift = (at: Date, n: number) => (years ? new Date(at.getFullYear() + n, 0, 1) : new Date(at.getFullYear(), at.getMonth() + n, 1));
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    choose: years ? words.chooseYear : words.chooseMonth,
    previous: years ? words.earlierYears : words.previousYear,
    next: years ? words.laterYears : words.nextYear,
    className: 'fd-calendar-periods',
    valueOn: (at) => `${at.getFullYear()}-${years ? '01' : pad(at.getMonth() + 1)}-01`,
    start: (at) => new Date(at.getFullYear(), years ? 0 : at.getMonth(), 1),
    turn: (at, by) => shift(at, by * 12),
    draw(host: CalendarHost, focus: boolean) {
      const { doc: d, focused } = host;
      const first = years ? focused.getFullYear() - (((focused.getFullYear() % 12) + 12) % 12) : focused.getFullYear();
      host.heading(years ? `${first} – ${first + 11}` : String(first));
      const body = d.createElement('tbody');
      for (let row = 0; row < 4; row++) {
        const tr = d.createElement('tr');
        for (let col = 0; col < 3; col++) {
          const at = years ? new Date(first + row * 3 + col, 0, 1) : new Date(first, row * 3 + col, 1);
          const same = (other?: Date) => !!other && other.getFullYear() === at.getFullYear() && (years || other.getMonth() === at.getMonth());
          const pick = d.createElement('button');
          pick.type = 'button';
          pick.textContent = years ? String(at.getFullYear()) : short.format(at).replace(/\.$/, '');
          pick.setAttribute('aria-label', years ? String(at.getFullYear()) : long.format(at));
          pick.tabIndex = same(focused) ? 0 : -1;
          if (same(host.held)) pick.setAttribute('aria-selected', 'true');
          if (same(host.today)) pick.setAttribute('aria-current', years ? 'true' : 'date');
          if (host.refused(at)) pick.classList.add('fd-off');
          pick.disabled = host.readonly;
          pick.addEventListener('click', () => host.pick(at));
          pick.addEventListener('keydown', (event) => {
            // Page Up and Page Down turn the page: a year of months, or twelve years.
            const moves: Record<string, number> = { ArrowLeft: host.rtl ? 1 : -1, ArrowRight: host.rtl ? -1 : 1, ArrowUp: -3, ArrowDown: 3, PageUp: -12, PageDown: 12 };
            if (event.key in moves) {
              event.preventDefault();
              host.move(shift(at, moves[event.key]));
            } else if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              host.pick(at);
            }
          });
          const cell = d.createElement('td');
          cell.append(pick);
          tr.append(cell);
        }
        body.append(tr);
      }
      host.grid.replaceChildren(body);
      if (focus) host.grid.querySelector<HTMLButtonElement>('button[tabindex="0"]')?.focus();
    },
  };
}

/** A Hijri date's month of days: each day's Hijri day small under it and said after its own; the Hijri months in its title. */
export function hijriCalendar(doc: Document, labels: WidgetLabels | undefined, locale: Locale): CalendarKind {
  installMonthsStyles(doc);
  const words = wordsFor(labels, locale);
  const months = new Intl.DateTimeFormat(`${lang(locale)}-u-ca-islamic-umalqura`, { month: 'long', year: 'numeric', numberingSystem: 'latn', timeZone: 'UTC' });
  const utc = (day: Date) => Date.UTC(day.getFullYear(), day.getMonth(), day.getDate());
  const iso = (day: Date) => new Date(utc(day)).toISOString().slice(0, 10);
  return {
    choose: words.chooseDate,
    previous: words.previousMonth,
    next: words.nextMonth,
    className: 'fd-calendar-hijris',
    heading: (first, last) => months.formatRange(utc(first), utc(last)),
    mark(button, day, label) {
      const small = doc.createElement('span');
      small.className = 'fd-calendar-hijri';
      small.setAttribute('aria-hidden', 'true');
      small.textContent = String(hijriOf(iso(day))?.day ?? '');
      button.append(small);
      button.setAttribute('aria-label', `${label}, ${hijriWords(iso(day), locale)}`);
    },
  };
}
