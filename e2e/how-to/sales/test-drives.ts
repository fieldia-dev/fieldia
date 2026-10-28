import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { berlinDay } from './support';

/** A drive's day and times on Berlin's clock, as the calendar names it: "Wednesday 28 October", "09:00", "09:45". */
function inBerlin(iso: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
      .formatToParts(new Date(iso))
      .map((p) => [p.type, p.value])
  );
  return { day: `${parts.weekday} ${parts.day} ${parts.month}`, time: `${parts.hour}:${parts.minute}` };
}
type Drive = { customer: string; start: string; stop: string; car: { label: string } };
/**
 * A drive's block as the calendar names it, holding the words it shows first (WCAG 2.5.3, 0.36): "11:00 Jonas Becker
 * Family estate, hybrid, Tuesday 27 October, 11:00 to 11:45" — its time (on a phone's agenda its two, "11:00 – 11:45"),
 * customer and car, then its day and times.
 */
const blockName = (drive: Drive, day: string, from: string, to: string) =>
  new RegExp(`^${from}(?: – ${to})? ${drive.customer} ${drive.car.label}, ${day}, ${from} to ${to}$`);
/** A day with its year as this engine's Intl writes it: Chromium 156 puts a comma after the weekday, 141 did not. */
const withYear = (day: string, year: string) => new RegExp(`^${day.replace(' ', ',? ')} ${year}$`);

/** Whether the first step looked on to the next week, its own having few drives left in it (a Saturday's, a Sunday's). */
let lookedOn = false;

/** The test-drives demo's how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  steps: [
    {
      says: 'Look from another time zone (your own, if you are not in Berlin): each drive is at its Berlin time',
      async run({ page, press, see, demo }) {
        // This browser's own zone is not Berlin's: an hour or two apart, as the page's own words say.
        expect(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)).not.toBe('Europe/Berlin');
        await see(page.locator('.fd-cal-zone')).toHaveText(/^(CEST|CET)$/);
        await see(page.locator('.fd-cal-zone')).toHaveAttribute('aria-label', 'Central European Time');
        await see(page.locator('.fd-cal-body, .fd-cal').first()).not.toHaveAttribute('aria-busy', 'true');
        // The week shown, Monday to Sunday round Berlin's today, and its drives at their times there.
        const today = berlinDay(0);
        const monday = (today.weekday + 6) % 7;
        const weekOn = (shift: number) => [0, 1, 2, 3, 4, 5, 6].map((n) => berlinDay(n - monday + shift).label.split(' ').slice(0, 3).join(' '));
        const all = Object.values((await demo<Record<string, Record<string, Drive>>>('dataSource.records'))['drive.booking']).map((drive) => ({ drive, from: inBerlin(drive.start), to: inBerlin(drive.stop) }));
        const inWeek = (week: string[]) => all.filter(({ from }) => week.includes(from.day)).sort((a, b) => (a.drive.start < b.drive.start ? -1 : 1));
        let drives = inWeek(weekOn(0));
        // Late in the week — a Saturday, a Sunday — its drives are behind it (the showroom books from today on): the
        // next week's, as a person looks on to them (0.36's replays on other days).
        lookedOn = drives.length <= 3;
        if (lookedOn) {
          await press(page.locator('.fd-cal-step').nth(1));
          drives = inWeek(weekOn(7));
        }
        expect(drives.length).toBeGreaterThan(3);
        for (const { drive, from, to } of drives.slice(0, 6)) {
          await see(page.getByRole('button', { name: blockName(drive, from.day, from.time, to.time) })).toBeVisible();
        }
      },
    },
    {
      says: 'Drag a drive to another time or day: it keeps its 45 minutes, and the line under the bar says where it went',
      notOnPhone: 'a drag: Playwright’s WebKit has no touch drag (the phone’s own way, a drive’s ⋯ Move, sets its time in the phone’s time picker, which Playwright cannot turn)',
      async run({ page, drag, press, see, demo }) {
        const body = page.locator('.fd-cal-body');
        const drives = async () => Object.values((await demo<Record<string, Record<string, Drive>>>('dataSource.records'))['drive.booking']);
        // The first drive of the week, by its block; moved within its day to the hour nearest it its car has free.
        const block = page.locator('.fd-cal-event').first();
        const name = (await block.getAttribute('aria-label'))!;
        // The drive the block is, found by its name among the source's drives.
        const shown = (await drives()).map((drive) => ({ drive, from: inBerlin(drive.start), to: inBerlin(drive.stop) })).find(({ drive, from, to }) => blockName(drive, from.day, from.time, to.time).test(name))!;
        expect(shown, `a drive named ${name}`).toBeTruthy();
        const { drive: first, from: { day, time: from }, to: { time: to } } = shown;
        const customer = first.customer;
        const column = block.locator('xpath=ancestor::*[contains(@class,"fd-cal-col")][1]');
        const free = async (minutes: number) => (await column.locator(`.fd-cal-slot[data-minutes="${minutes}"]`).getAttribute('aria-label'))?.endsWith('free');
        // The hour nearest the drive's own (in sight with it) with its 45 minutes free.
        const own = Number(from.slice(0, 2));
        let target = 0;
        for (const hour of [own + 1, own - 1, own + 2, own - 2, own + 3, own - 3].filter((h) => h >= 9 && h <= 17 && h !== 13)) {
          if ((await free(hour * 60)) && (await free(hour * 60 + 15)) && (await free(hour * 60 + 30))) {
            target = hour * 60;
            break;
          }
        }
        expect(target, 'an hour free in the drive’s column').toBeGreaterThan(0);
        const at = `${String(target / 60).padStart(2, '0')}:00`;
        // Held by its middle, as a hand takes it, and let go with its top on the hour.
        await block.scrollIntoViewIfNeeded();
        const box = (await block.boundingBox())!;
        const there = (await column.locator(`.fd-cal-slot[data-minutes="${target}"]`).boundingBox())!;
        await drag(block, { x: there.x + there.width / 2, y: there.y + box.height / 2 + 2 });
        const said = page.locator('.fd-cal-said');
        await see(said).toContainText(at);
        await see(said.getByRole('button', { name: 'Undo' })).toBeVisible();
        const end = new Date(Date.UTC(2000, 0, 1, target / 60, 45)).toISOString().slice(11, 16);
        await see(page.getByRole('button', { name: blockName(first, day, at, end) })).toBeVisible();
        // Booked so: the drive at that time in Berlin, 45 minutes long.
        const moved = (await drives()).find((drive) => drive.customer === customer && inBerlin(drive.start).day === day && inBerlin(drive.start).time === at)!;
        expect(new Date(moved.stop).getTime() - new Date(moved.start).getTime()).toBe(45 * 60_000);
        // Undo: back where it was.
        await press(said.getByRole('button', { name: 'Undo' }));
        await see(page.getByRole('button', { name: blockName(first, day, from, to) })).toBeVisible();
        await see(body).toBeVisible();
      },
    },
    {
      says: 'Press a day’s name: that day, a column for each car. Press an empty slot',
      async run({ page, phone, press, see }) {
        // A phone opens on the week's agenda, its days' names headings: Week shows them as names to press.
        if (phone) await press(page.getByRole('button', { name: 'Week', exact: true }));
        const tomorrow = berlinDay(1);
        // In the next week where the first step looked on to it: its Tuesday.
        const pressed = lookedOn ? berlinDay(8 - ((berlinDay(0).weekday + 6) % 7)) : tomorrow.weekday === 1 ? berlinDay(0) : tomorrow;
        const label = pressed.label.split(' ').slice(0, 3).join(' ');
        // A day's head named with the words it shows too (0.36): "Wednesday 28 October, Wed 28".
        await press(page.getByRole('button', { name: new RegExp(`^${label}, \\w+ \\d+$`) }));
        // In the day's own year: tomorrow, on 31 December, is the next year's.
        await see(page.locator('.fd-cal-title')).toHaveText(withYear(label, pressed.label.split(' ')[3]));
        await see(page.locator('.fd-cal-col')).toHaveCount(3);
        for (const car of ['City hatchback, electric', 'Family estate, hybrid', 'Compact SUV']) await see(page.getByRole('group', { name: `${label}, ${car}`, exact: true })).toBeVisible();
        // An empty slot of the estate's column: its first hour from 09:00 with nothing booked.
        const estate = page.getByRole('group', { name: `${label}, Family estate, hybrid`, exact: true });
        const slotAt = (minutes: number) => estate.locator(`.fd-cal-slot[data-minutes="${minutes}"]`);
        let hour = 9;
        while (hour < 18 && !(await slotAt(hour * 60).getAttribute('aria-label'))?.endsWith(', free')) hour++;
        const time = `${String(hour).padStart(2, '0')}:00`;
        const empty = slotAt(hour * 60);
        await see(empty).toHaveAttribute('aria-label', `${label}, ${time}, Family estate, hybrid, free`);
        await press(empty);
        const dialog = page.getByRole('dialog', { name: 'New' });
        await see(dialog).toBeVisible();
        await see(dialog.locator('.fd-slots-chosen')).toHaveText(new RegExp(`^${label.replace(' ', ',? ')} \\d{4}, ${time} to ${time.slice(0, 3)}45 (CEST|CET)$`));
        // Back by its drive's 45 minutes on, as the times say: the calendar's own hour is no drive's length.
        await see(dialog.locator('[data-node="f-stop"]').getByRole('textbox')).toHaveValue(new RegExp(`, ${time.slice(0, 3)}45$`));
        await see(dialog.locator('[data-node="f-car"]').getByRole('combobox')).toHaveValue('Family estate, hybrid');
      },
    },
  ],
};
