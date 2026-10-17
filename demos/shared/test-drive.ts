import { dayIn, instantsAt, wallOf, type MemorySchedule, type Page, type Values } from '@fieldia/core';
import testDrive from '../../examples/pages/test-drive.page.json';
import testDrives from '../../examples/pages/test-drives.page.json';
import { demoNow } from './calendar';

/**
 * Test drives at a showroom in Berlin, booked from anywhere: the page's times
 * are on Berlin's clock (`timeZone`), and the free times come from the
 * showroom's schedule, which the memory data source answers `slots` from —
 * Monday to Friday 09:00 to 13:00 and 14:00 to 18:00, Saturday 10:00 to
 * 14:00, a drive 45 minutes long with 15 kept free after it, a staff day
 * closed, and each car's own bookings. Its bookings are made round now (the
 * reader's own, or `?now=` as the browser tests pin it): the next Wednesday
 * fully booked for the hatchback, a few drives on most other days.
 */

const ZONE = 'Europe/Berlin';
const CARS = ['City hatchback, electric', 'Family estate, hybrid', 'Compact SUV'];
const CUSTOMERS = ['Lena Vogel', 'Jonas Becker', 'Amira Haddad', 'Tom Schulz', 'Sofia Rossi', 'Malik Osei', 'Hannah Wolf', 'Yusuf Demir'];

/** A day on Berlin's calendar some days on from another, as 2026-10-15. */
function dayAfter(day: string, days: number): string {
  const wall = wallOf(day) as { year: number; month: number; day: number };
  return new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days)).toISOString().slice(0, 10);
}
/** The instant a time on Berlin's clock is, that day: the first, where the clocks repeat it. */
function at(day: string, time: string): number {
  const wall = wallOf(day) as { year: number; month: number; day: number };
  return instantsAt({ ...wall, hour: Number(time.slice(0, 2)), minute: Number(time.slice(3, 5)) }, ZONE)[0];
}
const iso = (ms: number) => new Date(ms).toISOString();

/** The showroom's schedule, a staff day ten days on closed. */
export function showroom(now = demoNow()): MemorySchedule {
  const today = dayIn(now, ZONE);
  const weekday: [string, string][] = [['09:00', '13:00'], ['14:00', '18:00']];
  return {
    timeZone: ZONE,
    hours: { 1: weekday, 2: weekday, 3: weekday, 4: weekday, 5: weekday, 6: [['10:00', '14:00']] },
    length: 45,
    between: 15,
    holidays: { [dayAfter(today, 10)]: 'Staff training day', '2026-12-25': 'Christmas Day', '2026-12-26': 'Boxing Day', '2027-01-01': 'New Year’s Day' },
    bookings: { model: 'drive.booking', field: 'start', endField: 'stop', same: ['car'] },
  };
}

/** The showroom's cars and three weeks of its bookings round now: the next Wednesday full for the hatchback. */
export function testDriveRecords(now = demoNow()): Record<string, Record<number, Values>> {
  const today = dayIn(now, ZONE);
  const drives: Record<number, Values> = {};
  let id = 1;
  const book = (day: string, time: string, car: number, who: number) => {
    const start = at(day, time);
    drives[id++] = { customer: CUSTOMERS[who % CUSTOMERS.length], phone: null, email: null, car: { id: car, label: CARS[car - 1] }, start: iso(start), stop: iso(start + 45 * 60000), licence: false, call_back: null, notes: null };
  };
  const times = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
  for (let n = 0; n < 21; n++) {
    const day = dayAfter(today, n);
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (weekday === 0) continue;
    // The next Wednesday: every time taken for the hatchback.
    if (weekday === 3 && n > 0 && n <= 7) {
      times.forEach((time, i) => book(day, time, 1, i));
      continue;
    }
    // Two drives on other days, at times of the day's hours, the same each visit.
    const open = weekday === 6 ? ['10:00', '11:00', '12:00', '13:00'] : times;
    for (const [k, car] of [1, 2, 3].entries()) if ((n + k) % 3 !== 0) book(day, open[(n * 3 + k * 2) % open.length], car, n + k);
  }
  return {
    'showroom.car': Object.fromEntries(CARS.map((name, i) => [i + 1, { name }])),
    'drive.booking': drives,
  };
}

export const testDriveDemo = {
  page: testDrive as Page,
  /** The showroom's week of test drives on a calendar, on Berlin's clock as the booking page is: each opens in it. */
  list: testDrives as Page,
};
