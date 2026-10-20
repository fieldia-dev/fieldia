/**
 * Days as a form's expressions count them: a date is YYYY-MM-DD, a date and
 * time the same day with its time after it, as the record keeps it. A month
 * added to the 31st ends on the last day of a shorter month, as people and
 * contracts count months, and the months between two days are the most that
 * can be added to the first without passing the second — so the two agree:
 * 31 January and a month is 28 February, and from one to the other is a month.
 */

/** A day's year, month and day, and what came after it (a time), from a date or a date and time; null when it is neither. */
export function dayParts(value: unknown): { year: number; month: number; day: number; rest: string } | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})(.*)$/s.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (month < 1 || month > 12 || day < 1 || day > daysIn(year, month)) return null;
  return { year, month, day, rest: match[4] };
}

/** How many days a month has: 1 is January. */
function daysIn(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** A day written as a date, with the time it had after it. */
function written(year: number, month: number, day: number, rest: string): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}${rest}`;
}

/** A day a whole number of days later (earlier when negative); null when it is not a day. */
export function addDays(value: unknown, days: number): string | null {
  const parts = dayParts(value);
  if (!parts) return null;
  const moved = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + Math.trunc(days)));
  return written(moved.getUTCFullYear(), moved.getUTCMonth() + 1, moved.getUTCDate(), parts.rest);
}

/** A day so many whole months later (earlier when negative): past a shorter month's end, on its last day. */
export function addMonths(value: unknown, months: number): string | null {
  const parts = dayParts(value);
  if (!parts) return null;
  const index = parts.year * 12 + (parts.month - 1) + Math.trunc(months);
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  if (year < 0 || year > 9999) return null;
  return written(year, month, Math.min(parts.day, daysIn(year, month)), parts.rest);
}

/** The whole months from one day to another — negative when the second comes first — counted as `addMonths` adds them. */
export function monthsBetween(from: unknown, to: unknown): number | null {
  const a = dayParts(from);
  const b = dayParts(to);
  if (!a || !b) return null;
  const key = (p: { year: number; month: number; day: number }) => p.year * 10000 + p.month * 100 + p.day;
  if (key(b) < key(a)) {
    const back = monthsBetween(to, from);
    return back === null ? null : -back;
  }
  let months = (b.year - a.year) * 12 + (b.month - a.month);
  const reached = dayParts(addMonths(written(a.year, a.month, a.day, ''), months));
  if (reached && key(reached) > key(b)) months--;
  return months;
}
