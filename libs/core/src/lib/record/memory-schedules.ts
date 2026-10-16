import type { SlotDay, SlotsRequest, SlotsResult } from './data-source';
import type { MemoryDataSourceOptions } from './memory-data-source';
import type { RelatedRecord, Values } from './values';
import { instantsAt, wallOf } from './zones';

/**
 * A booking schedule, as `scheduleSlots` answers from it: the hours it opens each day of the week on its zone's clock —
 * the days named as its zone names them, which a page in another zone places by their times — the minutes a booking
 * lasts and those kept free after one, its holidays, and the records its bookings are kept as: a time one of them
 * holds is not free, but to the record itself.
 */
export interface MemorySchedule {
  /** The zone its hours are on the clock of, by its IANA name: "Europe/Berlin". */
  timeZone: string;
  /** Its hours by the day of the week, ISO-numbered (1 Monday … 7 Sunday): each a from and a to, ["09:00", "13:00"]. A day not named is closed. */
  hours: { [day: number]: [string, string][] };
  /** The minutes a booking lasts: the page's (`options.length`), else 30. */
  length?: number;
  /** The minutes kept free after each booking: the page's (`options.between`), else none. */
  between?: number;
  /** The days it is closed for, by date, with their names: { "2026-12-25": "Christmas Day" }. */
  holidays?: Record<string, string>;
  /**
   * Its bookings: records of `model`, starting at `field` (the field booked unless said) and ending at `endField`
   * (else lasting `length`); with `same`, only those holding the form's value in each of these fields — a doctor's.
   */
  bookings?: { model: string; field?: string; endField?: string; same?: string[] };
}

const MINUTE = 60000;
/** "09:30" as minutes into its day. */
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
/** A value as bookings are matched by it: a link by its id. */
const keyed = (value: unknown) => JSON.stringify(value && typeof value === 'object' && 'id' in value ? (value as RelatedRecord).id : (value ?? null));

/** The spans a schedule's bookings hold, as instants from and to: the record booked aside, and only those of the same doctor where it says. */
function bookedIn(schedule: MemorySchedule, request: SlotsRequest, stored: Record<string, Values>): [number, number][] {
  const { field = request.field, endField, same = [] } = schedule.bookings ?? { model: '' };
  const length = (request.length ?? schedule.length ?? 30) * MINUTE;
  const spans: [number, number][] = [];
  for (const [key, values] of Object.entries(stored)) {
    if (request.recordId !== null && String(request.recordId) === key) continue;
    if (!same.every((name) => keyed(values[name]) === keyed(request.values[name]))) continue;
    const start = Date.parse(String(values[field] ?? ''));
    if (Number.isNaN(start)) continue;
    const end = endField ? Date.parse(String(values[endField] ?? '')) : NaN;
    spans.push([start, Number.isNaN(end) ? start + length : end]);
  }
  return spans;
}

/**
 * The memory data source's `slots`, answered from booking schedules by name (`options.schedule`, else the field's
 * name): each day asked, its times from its hours a booking's length apart (and the minutes kept free after one), on
 * the schedule's clock — a time the clocks skip that day left out, one they repeat taken the first time — less those
 * a booking holds and those gone by (by `now`, the computer's clock unless given). Open with times left; full with
 * none left; closed where it has no hours, or every time has gone by; a holiday by its name.
 *
 *   createMemoryDataSource({ records, slots: scheduleSlots({ showroom: { timeZone: 'Europe/Berlin', hours: … } }) })
 *
 * For demos and tests, beside the memory source: the one-tag script carries neither.
 */
export function scheduleSlots(schedules: Record<string, MemorySchedule>, options: { now?: () => Date } = {}): NonNullable<MemoryDataSourceOptions['slots']> {
  return (request: SlotsRequest, records: Readonly<Record<string, Record<string, Values>>>): SlotsResult => {
    const schedule = schedules[request.schedule];
    if (!schedule) throw new Error(`No schedule "${request.schedule}"`);
    const booked = schedule.bookings ? bookedIn(schedule, request, records[schedule.bookings.model] ?? {}) : [];
    const now = (options.now?.() ?? new Date()).getTime();
    const length = request.length ?? schedule.length ?? 30;
    const between = request.between ?? schedule.between ?? 0;
    const days: Record<string, SlotDay> = {};
    const first = wallOf(request.from);
    const last = wallOf(request.to);
    if (!first || !last) return { days, length };
    for (let at = Date.UTC(first.year, first.month - 1, first.day); at <= Date.UTC(last.year, last.month - 1, last.day); at += 86400000) {
      const date = new Date(at);
      const day = date.toISOString().slice(0, 10);
      const holiday = schedule.holidays?.[day];
      if (holiday) {
        days[day] = { state: 'holiday', note: holiday };
        continue;
      }
      const free: string[] = [];
      let any = false;
      for (const [from, to] of schedule.hours[date.getUTCDay() || 7] ?? []) {
        for (let minutes = minutesOf(from); minutes + length <= minutesOf(to); minutes += length + between) {
          const start = instantsAt({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate(), hour: Math.floor(minutes / 60), minute: minutes % 60 }, schedule.timeZone)[0];
          if (start === undefined || start <= now) continue;
          any = true;
          const end = start + length * MINUTE;
          // Taken where a booking, and the minutes kept free after it, meet this time and those kept free after it.
          if (booked.some(([from, until]) => start < until + between * MINUTE && from < end + between * MINUTE)) continue;
          free.push(new Date(start).toISOString());
        }
      }
      days[day] = free.length ? { state: 'open', free } : { state: any ? 'full' : 'closed' };
    }
    return { days, length };
  };
}
