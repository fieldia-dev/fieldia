import { dayIn, instantsAt, wallOf, type Form, type MemoryDataSource, type MemorySchedule, type Page, type Values } from '@fieldia/core';
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

/** The time a person is most likely to pick, which someone else takes first: 10:00 where it is free. */
const LIKELY = '10:00';

/**
 * Over the test drive, for a person trying it: "Someone else books 10:00" — a drive booked on another screen, for the
 * car and the day shown, at a time shown (10:00 where it is free, else the first). This screen is not told, as another
 * screen's booking would leave it: its times stay as they were drawn. Press that time, and the page says it was just
 * booked and books nothing; the times are asked again, without it.
 */
export function meanwhileBar(dataSource: MemoryDataSource): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'demo-bar demo-panel-bar demo-meanwhile-bar fd-theme';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fd-button';
  const said = document.createElement('span');
  said.className = 'demo-meanwhile-said';
  said.setAttribute('role', 'status');
  bar.append(button, said);
  /** The times taken from this bar, by their instant: never booked twice. */
  const taken = new Set<string>();
  const form = () => (window as unknown as { fieldiaDemo?: { handle?: { form?: Form } } }).fieldiaDemo?.handle?.form;
  /** The time it would book: among those the screen shows, not this record's own nor one it took. */
  const next = () => {
    const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-node="f-start"] .fd-slots-chip')].filter((chip) => chip.getAttribute('aria-pressed') !== 'true' && !taken.has(chip.dataset['at'] ?? ''));
    return chips.find((chip) => chip.textContent === LIKELY) ?? chips[0] ?? null;
  };
  let showing: HTMLButtonElement | null = null;
  /** What happened last on the other screen, once something has; and the time it took, while this screen still shows it. */
  let last = '';
  let pending: { at: string; time: string } | null = null;
  const draw = () => {
    // The time taken pressed here: the field says it was just booked, and it is gone from the times.
    const told = document.querySelector('[data-node="f-start"] .fd-slots-said')?.textContent ?? '';
    if (pending && told.includes(pending.time) && !document.querySelector(`[data-node="f-start"] .fd-slots-chip[data-at="${pending.at}"]`)) {
      last = `Tom Schulz booked ${pending.time} first, on another screen: this page said so, and booked nothing.`;
      pending = null;
    }
    showing = next();
    button.hidden = !showing;
    if (showing) button.textContent = `Someone else books ${showing.textContent}`;
    said.textContent = last || (showing ? 'Another customer may be booking this car on another screen right now.' : 'Pick a car and a day: then someone else, on another screen, can book one of its times before you do.');
  };
  button.addEventListener('click', () => {
    const chip = showing;
    const car = form()?.getState().values['car'];
    if (!chip || !car) return;
    const at = Number(chip.dataset['at']);
    const bookings = dataSource.records['drive.booking'] ?? (dataSource.records['drive.booking'] = {});
    const id = Math.max(0, ...Object.keys(bookings).map(Number)) + 1;
    bookings[id] = { customer: 'Tom Schulz', phone: null, email: null, car, start: iso(at), stop: iso(at + 45 * 60000), licence: false, call_back: null, notes: null };
    taken.add(String(at));
    pending = { at: String(at), time: chip.textContent ?? '' };
    last = `Tom Schulz booked ${chip.textContent} on another screen, just now. Yours still shows it: press ${chip.textContent} and see.`;
    draw();
  });
  // The times follow the car and the day picked: the bar follows them.
  const watch = new MutationObserver(draw);
  const look = (tries = 0) => {
    const app = document.getElementById('app');
    if (app) watch.observe(app, { subtree: true, childList: true });
    else if (tries < 50) setTimeout(() => look(tries + 1), 100);
    draw();
  };
  look();
  return bar;
}
