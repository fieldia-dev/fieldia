import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * A calendar on the clock of the zone its page names (`timeZone`), looked at
 * from browsers in other zones: the Berlin showroom's test drives (the
 * test-drives demo, `"timeZone": "Europe/Berlin"`). Its week, its today, the
 * line for now, each drive's place and a drive dragged are Berlin's, wherever
 * the browser is — New York, six hours behind it, and Tokyo, seven ahead. "Now"
 * is pinned (`now=`, in the browser's own time), and the demo makes its drives
 * round Berlin's today.
 */

const calendar = (page: Page) => page.locator('.fd-cal');
const settled = (page: Page) => expect(page.locator('.fd-cal-body')).not.toHaveAttribute('aria-busy', 'true');
const drives = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['drive.booking'] as Record<string, { customer: string; start: string; stop: string }>);
/** An instant's day and time on Berlin's clock: ["2026-10-15", "11:00"]. */
const inBerlin = (page: Page, iso: string) =>
  page.evaluate((at) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at)).map((p) => [p.type, p.value]));
    return [`${parts.year}-${parts.month}-${parts.day}`, `${parts.hour}:${parts.minute}`];
  }, iso);
const hourOf = (col: Locator) => col.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue('--fd-cal-hour')));

async function openDrives(page: Page, now: string) {
  const opened = await open(page, 'plain', `page=test-drives&skin=outlined&now=${now}`);
  await expect(calendar(page)).toBeVisible();
  await settled(page);
  return opened;
}

/** Press, move at a hand's pace, let go: as a person drags. */
async function dragTo(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 12, from.y + ((to.y - from.y) * i) / 12);
  await page.mouse.up();
}

test.describe('a calendar on Berlin’s clock, from New York', () => {
  test.use({ timezoneId: 'America/New_York', locale: 'en-GB', viewport: { width: 1280, height: 1100 } });

  test('its week, today, the line for now and each drive are Berlin’s; a drive dragged is booked at that time in Berlin', async ({ page }) => {
    // 09:40 in New York on Wednesday 14 October: 15:40 in Berlin.
    const { problems } = await openDrives(page, '2026-10-14T09:40');
    await expect(page.locator('.fd-cal-title')).toHaveText(/^12\s*–\s*18 Oct 2026$/);
    await expect(page.locator('.fd-cal-zone')).toHaveText('CEST');
    await expect(page.locator('.fd-cal-zone')).toHaveAttribute('aria-label', 'Central European Time');
    await expect(page.locator('.fd-cal-head[aria-current="date"]')).toContainText('14');
    // The line for now at 15:40 on Berlin's clock, in Wednesday's column: 7 hours 40 under 08:00.
    const today = page.locator('.fd-cal-col[data-today]');
    await expect(today).toHaveAttribute('data-day', '2026-10-14');
    const hour = await hourOf(today);
    expect(await today.locator('.fd-cal-now').evaluate((line) => parseFloat((line as HTMLElement).style.top))).toBeCloseTo(((15 * 60 + 40 - 8 * 60) * hour) / 60, 1);
    // Each drive in the week at its time in Berlin: its column the day there, its words the hours there.
    const all = await drives(page);
    const shown = Object.entries(all).filter(([, d]) => d.start >= '2026-10-12' && d.start < '2026-10-19');
    expect(shown.length).toBeGreaterThan(3);
    for (const [, drive] of shown.slice(0, 6)) {
      const [day, from] = await inBerlin(page, drive.start);
      const [, to] = await inBerlin(page, drive.stop);
      const block = page.locator(`.fd-cal-col[data-day="${day}"] .fd-cal-event[aria-label*="${from} to ${to}"]`, { hasText: drive.customer });
      await expect(block.first()).toBeVisible();
    }
    await screen(page, 'calendar-zone-new-york');
    // The first drive on Thursday, dragged to 11:00 there: booked at 11:00 in Berlin (09:00 UTC), its 45 minutes kept.
    const [id, thursday] = Object.entries(all).filter(([, d]) => d.start.startsWith('2026-10-15')).sort((a, b) => (a[1].start < b[1].start ? -1 : 1))[0];
    const [, at] = await inBerlin(page, thursday.start);
    const block = page.locator('.fd-cal-col[data-day="2026-10-15"] .fd-cal-event', { hasText: thursday.customer }).filter({ has: page.locator(`.fd-cal-event-time:text-is("${at}")`) }).first();
    const box = (await block.boundingBox())!;
    const column = (await page.locator('.fd-cal-col[data-day="2026-10-15"]').boundingBox())!;
    const target = at === '11:00' ? 12 * 60 : 11 * 60;
    await dragTo(page, { x: box.x + 10, y: box.y + 4 }, { x: column.x + column.width / 2, y: column.y + ((target - 8 * 60) * hour) / 60 + 4 });
    await expect(page.locator('.fd-cal-said')).toContainText(`${String(target / 60).padStart(2, '0')}:00`);
    const moved = (await drives(page))[id];
    expect(moved.start).toBe(new Date(Date.UTC(2026, 9, 15, target / 60 - 2)).toISOString());
    expect(new Date(moved.stop).getTime() - new Date(moved.start).getTime()).toBe(45 * 60000);
    expect(problems).toEqual([]);
  });
});

test.describe('a calendar on Berlin’s clock, from Tokyo', () => {
  test.use({ timezoneId: 'Asia/Tokyo', locale: 'en-GB', viewport: { width: 1280, height: 1100 } });

  test('Berlin’s week and today, a day behind Tokyo’s: Sunday there while it is Monday here', async ({ page }) => {
    // 06:00 on Monday 19 October in Tokyo: 23:00 on Sunday 18 October in Berlin.
    const { problems } = await openDrives(page, '2026-10-19T06:00');
    await expect(page.locator('.fd-cal-title')).toHaveText(/^12\s*–\s*18 Oct 2026$/);
    await expect(page.locator('.fd-cal-head[aria-current="date"]')).toContainText('18');
    await expect(page.locator('.fd-cal-zone')).toHaveText('CEST');
    // The next week: Monday's drives, made round Berlin's today, at their times there.
    await page.locator('.fd-cal-step').nth(1).click();
    await settled(page);
    await expect(page.locator('.fd-cal-title')).toHaveText(/^19\s*–\s*25 Oct 2026$/);
    // Berlin's clocks go back on Sunday 25 October: the week ends in winter time, its name as its first day has it.
    await expect(page.locator('.fd-cal-zone')).toHaveText('CEST');
    const monday = Object.values(await drives(page)).filter((d) => d.start.startsWith('2026-10-19'));
    expect(monday.length).toBeGreaterThan(0);
    for (const drive of monday) {
      const [day, from] = await inBerlin(page, drive.start);
      await expect(page.locator(`.fd-cal-col[data-day="${day}"] .fd-cal-event[aria-label*="${from} to"]`, { hasText: drive.customer }).first()).toBeVisible();
    }
    await screen(page, 'calendar-zone-tokyo');
    expect(problems).toEqual([]);
  });
});
