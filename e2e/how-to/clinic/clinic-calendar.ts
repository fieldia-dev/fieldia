import type { Locator, Page } from '@playwright/test';
import { expect } from '../../fixtures';
import type { DemoReplay } from '../hand';
import { choose, hhmm } from './support';

/** The clinic's calendar: a doctor's column today, a visit by its patient, and what it says of a change. */
const calColumn = (page: Page, doctor: string) => page.locator(`.fd-cal-col[aria-label$=", ${doctor}"]`).first();
const calVisit = (page: Page, patient: string) => page.locator('.fd-cal-event').filter({ has: page.locator('.fd-cal-event-title', { hasText: patient }) }).first();
const calSaid = (page: Page) => page.locator('.fd-cal-said');
const calSettled = (page: Page) => expect(page.locator('.fd-cal-body')).not.toHaveAttribute('aria-busy', 'true');
/** The first slot of a column, from a time on, free for so many quarters of an hour after it: its minutes after midnight. */
const freeFrom = (column: Locator, from: number, quarters: number) =>
  column.evaluate((col, [start, count]) => {
    const free = new Set([...col.querySelectorAll('.fd-cal-slot')].filter((s) => s.getAttribute('aria-label')!.endsWith(', free')).map((s) => Number((s as HTMLElement).dataset['minutes'])));
    return [...free].sort((a, b) => a - b).find((m) => m >= start && Array.from({ length: count }, (_, i) => m + i * 15).every((q) => free.has(q)));
  }, [from, quarters] as const);
/** The window scrolled by the mouse's wheel toward a part of the page standing so far under its top (or as far as it goes). */
async function wheelTo(page: Page, part: Locator, top: number) {
  const box = (await part.boundingBox())!;
  await page.mouse.wheel(0, box.y - top);
  // Scrolled as far as it would: the part where it came to rest, in sight.
  let last = Number.NaN;
  await expect.poll(async () => {
    const now = (await part.boundingBox())!.y;
    const still = Math.abs(now - last) < 1;
    last = now;
    return still;
  }).toBe(true);
  await expect(part).toBeInViewport();
}
/** The mouse pressed, carried at a hand's pace, let go. */
async function carry(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await page.mouse.up();
}

/** The clinic-calendar demo’s how-to steps, replayed by hand (e2e/how-to.spec.ts). */
export const replay: DemoReplay = {
  timeout: 90_000,
  steps: [
    {
      says: 'Drag a visit to another doctor’s column',
      notOnPhone: 'a visit is dragged by a finger (Playwright’s WebKit has no touch drag), and a phone opens on the agenda, which has no columns',
      async run({ page, press, see }) {
        await calSettled(page);
        const walkIn = calVisit(page, 'Walk-in: Samir Fouad');
        await see(calColumn(page, 'Dr Karim Fawzy').locator('.fd-cal-event', { hasText: 'Walk-in: Samir Fouad' })).toBeVisible();
        await wheelTo(page, walkIn, 140);
        // To Dr Hany Mostafa's column, later in the day: the first time from 13:00 free for its 45 minutes.
        const hany = calColumn(page, 'Dr Hany Mostafa');
        const minutes = (await freeFrom(hany, 13 * 60, 3))!;
        expect(minutes).toBeDefined();
        const slot = (await hany.locator(`.fd-cal-slot[data-minutes="${minutes}"]`).boundingBox())!;
        const box = (await walkIn.boundingBox())!;
        expect(slot.y + slot.height).toBeLessThan(page.viewportSize()!.height);
        await carry(page, { x: box.x + 20, y: box.y + 6 }, { x: slot.x + slot.width / 2, y: slot.y + 6 });
        await see(calSaid(page)).toContainText(new RegExp(`Moved Walk-in: Samir Fouad to \\w{3},? \\d{1,2} \\w{3}, ${hhmm(minutes)}\\.`));
        await calSettled(page);
        await see(hany.locator('.fd-cal-event', { hasText: 'Walk-in: Samir Fouad' })).toBeVisible();
        // Saved at once: the list's own record says so.
        const saved = await page.evaluate(() => Object.values((window as any).fieldiaDemo.dataSource.records['clinic.visit']).find((r: any) => r.patient === 'Walk-in: Samir Fouad') as { doctor: { label: string } });
        expect(saved.doctor.label).toBe('Dr Hany Mostafa');
        await press(calSaid(page).getByRole('button', { name: 'Undo' }));
        await see(calSaid(page)).toHaveText(/Put back as it was\./);
        await calSettled(page);
        await see(calColumn(page, 'Dr Karim Fawzy').locator('.fd-cal-event', { hasText: 'Walk-in: Samir Fouad' })).toBeVisible();
        await see(hany.locator('.fd-cal-event', { hasText: 'Walk-in: Samir Fouad' })).toHaveCount(0);
      },
    },
    {
      says: 'Drag a visit’s lower edge down: it takes longer',
      notOnPhone: 'a visit’s edge is dragged by a finger (Playwright’s WebKit has no touch drag), and the agenda has no edges to drag',
      async run({ page, see }) {
        // Yasmine Raafat, 13:00 to 13:30 with no one: her lower edge down three quarters of an hour.
        const yasmine = calVisit(page, 'Yasmine Raafat');
        await wheelTo(page, yasmine, 200);
        const box = (await yasmine.boundingBox())!;
        const hour = await yasmine.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--fd-cal-hour')));
        await carry(page, { x: box.x + box.width / 2, y: box.y + box.height - 2 }, { x: box.x + box.width / 2, y: box.y + box.height - 2 + (45 * hour) / 60 });
        await see(calSaid(page)).toContainText('Yasmine Raafat now ends at 14:15.');
        await calSettled(page);
        await expect.poll(async () => (await calVisit(page, 'Yasmine Raafat').boundingBox())!.height).toBeGreaterThan(box.height * 2);
        await see(calVisit(page, 'Yasmine Raafat')).toContainText('13:00');
      },
    },
    {
      says: 'Press an empty slot, or drag down across a few',
      async run({ page, phone, press, see }) {
        // On a phone, which opens on the agenda: its day by doctor first, from Day.
        if (phone) {
          await press(page.getByRole('group', { name: 'Show the calendar by' }).getByRole('button', { name: 'Day' }));
          await calSettled(page);
        }
        const nour = calColumn(page, 'Dr Nour Adel');
        const minutes = (await freeFrom(nour, 15 * 60, 4))!;
        expect(minutes).toBeDefined();
        await press(nour.locator(`.fd-cal-slot[data-minutes="${minutes}"]`));
        const dialog = page.getByRole('dialog', { name: 'New' });
        await see(dialog).toBeVisible();
        await see(dialog.locator('[data-node="f-doctor"] input')).toHaveValue('Dr Nour Adel');
        await see(dialog.locator('[data-node="f-start"] input')).toHaveValue(new RegExp(`, ${hhmm(minutes)}$`));
        await see(dialog.locator('[data-node="f-stop"] input')).toHaveValue(new RegExp(`, ${hhmm(minutes + 60)}$`));
        await press(dialog.getByRole('button', { name: 'Discard' }));
        await see(dialog).toBeHidden();
        if (phone) return;
        // Dragged down across three slots of no one's from 16:00: its start, and its end at the last slot's end.
        const nobody = calColumn(page, 'No one');
        const free = (await freeFrom(nobody, 16 * 60, 3))!;
        const first = nobody.locator(`.fd-cal-slot[data-minutes="${free}"]`);
        await wheelTo(page, first, 200);
        const a = (await first.boundingBox())!;
        const b = (await nobody.locator(`.fd-cal-slot[data-minutes="${free + 30}"]`).boundingBox())!;
        await carry(page, { x: a.x + a.width / 2, y: a.y + 5 }, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
        await see(dialog).toBeVisible();
        await see(dialog.locator('[data-node="f-start"] input')).toHaveValue(new RegExp(`, ${hhmm(free)}$`));
        await see(dialog.locator('[data-node="f-stop"] input')).toHaveValue(new RegExp(`, ${hhmm(free + 45)}$`));
        await see(dialog.locator('[data-node="f-doctor"] input')).toHaveValue('');
        await press(dialog.getByRole('button', { name: 'Discard' }));
        await see(dialog).toBeHidden();
      },
    },
    {
      says: 'Without a mouse: Tab to a visit and press M for Move to…',
      notOnPhone: 'Tab, M, the arrow keys and Enter are keys a phone has none of (its agenda’s rows have a Move button of their own)',
      async run(hand) {
        const { page, press, type, keys, see } = hand;
        // From the page's heading, Tab after Tab: the slots' one stop, then the first visit.
        await press(page.locator('main h1').first());
        const stop = page.locator('.fd-cal-slot[tabindex="0"]');
        for (let i = 0; i < 20 && !(await stop.evaluate((at) => at === document.activeElement)); i++) await keys('Tab');
        await see(stop).toBeFocused();
        await keys('Tab');
        const first = page.locator('.fd-cal-event:focus');
        await see(first).toHaveCount(1);
        const name = (await first.locator('.fd-cal-event-title').textContent())!.trim();
        await keys('m');
        const dialog = page.getByRole('dialog', { name: `Move ${name}` });
        await see(dialog.getByLabel('Day')).toBeFocused();
        await see(dialog.getByLabel('Starts at')).toBeVisible();
        await see(dialog.getByLabel('Doctor')).toBeVisible();
        await type(dialog.getByLabel('Starts at'), '17:15', { clear: true });
        await choose(hand, dialog.getByLabel('Doctor'), 'Dr Nour Adel');
        await press(dialog.getByRole('button', { name: 'Move', exact: true }));
        await see(calSaid(page)).toContainText(new RegExp(`Moved ${name} to \\w{3},? \\d{1,2} \\w{3}, 17:15\\.`));
        await calSettled(page);
        await see(calColumn(page, 'Dr Nour Adel').locator('.fd-cal-event', { hasText: name })).not.toHaveCount(0);
        // The arrows between the slots, then Enter: a new appointment at the slot reached.
        for (let i = 0; i < 40 && !(await stop.evaluate((at) => at === document.activeElement)); i++) await keys('Shift+Tab');
        await see(stop).toBeFocused();
        const before = (await stop.getAttribute('aria-label'))!;
        await keys('ArrowDown', 'ArrowRight');
        const reached = page.locator('.fd-cal-slot:focus');
        await see(reached).toHaveCount(1);
        const label = (await reached.getAttribute('aria-label'))!;
        expect(label).not.toBe(before);
        // "Monday 26 October, 09:15, Dr Salma Nabil, free": its time and its doctor.
        const [, time, doctor] = label.split(', ');
        await keys('Enter');
        const created = page.getByRole('dialog', { name: 'New' });
        await see(created.locator('[data-node="f-doctor"] input')).toHaveValue(doctor);
        await see(created.locator('[data-node="f-start"] input')).toHaveValue(new RegExp(`, ${time}$`));
        await press(created.getByRole('button', { name: 'Discard' }));
      },
    },
    {
      says: 'Pick Scans from the search menu',
      async run({ page, press, see }) {
        await calSettled(page);
        const all = await page.locator('.fd-cal-event').count();
        await press(page.getByRole('button', { name: 'Search options' }));
        await press(page.locator('.fd-search-option[data-filter="scans"]'));
        // The menu closed again by its own button, the calendar in sight.
        await press(page.getByRole('button', { name: 'Search options' }));
        await see(page.locator('.fd-search-option[data-filter="scans"]')).toBeHidden();
        await calSettled(page);
        await expect.poll(() => page.locator('.fd-cal-event').count()).toBeLessThan(all);
        await see(page.locator('.fd-cal-event').first()).toBeVisible();
        // Each one a scan: the scans' colour alone.
        const colours = await page.locator('.fd-cal-event').evaluateAll((blocks) => new Set(blocks.map((b) => (b as HTMLElement).style.getPropertyValue('--fd-cal-c'))).size);
        expect(colours).toBe(1);
        await see(calVisit(page, 'Walk-in: Samir Fouad')).toBeVisible();
      },
    },
    {
      says: 'Press Week, Month or Agenda over the calendar',
      async run({ page, phone, press, see }) {
        const ranges = page.getByRole('group', { name: 'Show the calendar by' });
        const calendar = page.locator('.fd-cal');
        await press(ranges.getByRole('button', { name: 'Week' }));
        await see(calendar).toHaveAttribute('data-range', 'week');
        await see(page.locator('.fd-cal-head')).not.toHaveCount(0);
        await press(ranges.getByRole('button', { name: 'Month' }));
        await see(calendar).toHaveAttribute('data-range', 'month');
        await see(page.locator('.fd-cal-day')).not.toHaveCount(0);
        await press(ranges.getByRole('button', { name: 'Agenda' }));
        await see(calendar).toHaveAttribute('data-range', 'agenda');
        await see(page.locator('.fd-cal-agenda-head').first()).toBeVisible();
        if (phone) {
          // Opened again on the phone: on the agenda.
          await page.reload();
          await see(page.locator('.fd-cal')).toHaveAttribute('data-range', 'agenda');
        }
      },
    },
  ],
};
