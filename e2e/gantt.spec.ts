import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * A list's Gantt timeline (@fieldia/gantt, `gantt` on a list): a café's
 * fit-out, driven as a person drives it — a bar dragged to other days and
 * stretched by its end, Undo; a bar moved a day at a time from the keys;
 * the scales and a phase folded away; right to left; on paper; in another
 * time zone; in the dark; on a phone; and in the screen designer. "Now" is
 * pinned (`now=`), so the plan the demo makes round it — started on Monday
 * 28 September — is the same on every run.
 */

const NOW = 'now=2026-10-14T09:40';
const PLAN = `page=fitout-plan&skin=outlined&${NOW}`;

const gantt = (page: Page) => page.locator('.fd-gantt');
const settled = (page: Page) => expect(page.locator('.fd-gantt-body')).not.toHaveAttribute('aria-busy', 'true');
const bar = (page: Page, name: string) => page.locator('.fd-gantt-task').filter({ has: page.locator('.fd-gantt-task-text', { hasText: new RegExp(`^${name}$`) }) });
const said = (page: Page) => page.locator('.fd-gantt-said');
/** A task of the demo's in-memory source, by its id. */
const task = (page: Page, id: number) => page.evaluate((i) => (window as any).fieldiaDemo.dataSource.records['cafe.task'][i], id);

async function openPlan(page: Page, query = PLAN, variant = 'plain') {
  const opened = await open(page, variant, query);
  await expect(gantt(page)).toBeVisible();
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

test.describe("a list's timeline", () => {
  test.use({ viewport: { width: 1280, height: 1100 } });

  test('opens on the plan: its phases in order, a bar for each task, the arrows, the red one too soon, today’s line in view', async ({ page }) => {
    const { problems } = await openPlan(page);
    await expect(page.locator('.fd-list')).toHaveAttribute('data-view', 'gantt');
    await expect(page.locator('.fd-list-views').getByRole('button', { name: 'Timeline' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fd-gantt-title')).toHaveText(/28 Sept?.*5 Nov 2026/);
    await expect(page.locator('.fd-gantt-toggle bdi')).toHaveText(['Survey and design', 'Strip-out', 'First fix', 'Walls and ceilings', 'Second fix', 'Finishes', 'Handover']);
    await expect(page.locator('.fd-gantt-task')).toHaveCount(16);
    // The shop sign has no start yet: its row says so.
    await expect(page.locator('.fd-gantt-row', { hasText: 'Shop sign' }).locator('.fd-gantt-unplanned')).toHaveText('No start yet');
    // Nineteen arrows, one red: the ceiling planned the day before the partitions are done.
    await expect(page.locator('.fd-gantt-link')).toHaveCount(19);
    await expect(page.locator('.fd-gantt-link[data-late]')).toHaveCount(1);
    await expect(bar(page, 'Suspended ceiling')).toHaveAttribute('data-late', '');
    await expect(bar(page, 'Suspended ceiling')).toHaveAttribute('aria-label', /starts before Partitions ends/);
    await expect(bar(page, 'Partitions')).toHaveAttribute('aria-label', /^Partitions, Wed,? 14 Oct to Sat,? 17 Oct, 4 days, waits for Electrical first fix, Plumbing first fix$/);
    // The handover, a milestone: a diamond.
    await expect(bar(page, 'Handover to the tenant')).toHaveAttribute('data-milestone', '');
    // Today's line, in view, on Wednesday 14 October; each bar from its own first day.
    const today = page.locator('.fd-gantt-today');
    await expect(today).toBeInViewport();
    const line = (await today.boundingBox())!;
    const partitions = (await bar(page, 'Partitions').boundingBox())!;
    expect(Math.abs(line.x - (partitions.x + (9 * 40) / 24))).toBeLessThan(4);
    await screen(page, 'gantt-plan', { viewport: true });
    expect(problems).toEqual([]);
  });

  test('a bar dragged two days on is saved there, its arrows with it, and Undo puts it back; its end dragged gives it a day more', async ({ page }) => {
    const { problems } = await openPlan(page);
    const painting = bar(page, 'Painting');
    await painting.scrollIntoViewIfNeeded();
    const box = (await painting.boundingBox())!;
    await dragTo(page, { x: box.x + 20, y: box.y + box.height / 2 }, { x: box.x + 20 + 2 * 40 + 6, y: box.y + box.height / 2 });
    await expect(said(page)).toContainText(/Moved Painting: Mon,? 26 Oct to Thu,? 29 Oct\./);
    expect(await task(page, 12)).toMatchObject({ start: '2026-10-26', days: 4 });
    await settled(page);
    // The arrow into it now starts out of the second fix and ends at its new start.
    const moved = (await bar(page, 'Painting').boundingBox())!;
    expect(Math.round(moved.x - box.x)).toBe(80);
    await screen(page, 'gantt-dragged', { viewport: true });
    await said(page).getByRole('button', { name: 'Undo' }).click();
    await expect(said(page)).toHaveText(/Put back as it was\./);
    expect(await task(page, 12)).toMatchObject({ start: '2026-10-24' });
    await settled(page);
    // Its end, a day on: five days.
    await bar(page, 'Flooring').scrollIntoViewIfNeeded();
    const flooring = (await bar(page, 'Flooring').boundingBox())!;
    await dragTo(page, { x: flooring.x + flooring.width - 3, y: flooring.y + flooring.height / 2 }, { x: flooring.x + flooring.width - 3 + 40, y: flooring.y + flooring.height / 2 });
    await expect(said(page)).toContainText(/Flooring now ends Sun,? 1 Nov\./);
    expect(await task(page, 13)).toMatchObject({ start: '2026-10-28', days: 5 });
    // A drag let go with Escape: nothing saved.
    await settled(page);
    await bar(page, 'Waste removal').scrollIntoViewIfNeeded();
    const strip = (await bar(page, 'Waste removal').boundingBox())!;
    await page.mouse.move(strip.x + 10, strip.y + 10);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(strip.x + 10 + i * 20, strip.y + 10);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    expect(await task(page, 4)).toMatchObject({ start: '2026-10-07' });
    expect(problems).toEqual([]);
  });

  test('from the keys: one stop, up and down between bars, left and right a day, Shift its end, written once they rest; Enter opens the task', async ({ page }) => {
    const { problems } = await openPlan(page);
    // Today, the three scales, the first phase's heading, then the timeline's one stop: its first bar.
    await page.locator('.fd-gantt-bar').getByRole('button', { name: 'Today' }).focus();
    for (let i = 0; i < 4; i++) await page.keyboard.press('Tab');
    await expect(page.locator('.fd-gantt-toggle').first()).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toHaveText('Site survey');
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
    await expect(page.locator(':focus')).toHaveText('Partitions');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    // Said as it goes; written once the keys rest.
    await expect(page.locator('.fd-gantt > [aria-live]')).toHaveText(/Partitions, Sat,? 17 Oct to Tue,? 20 Oct/);
    await expect(said(page)).toContainText(/Moved Partitions: Sat,? 17 Oct to Tue,? 20 Oct\./);
    expect(await task(page, 8)).toMatchObject({ start: '2026-10-17', days: 4 });
    await settled(page);
    await expect(bar(page, 'Partitions')).toBeFocused();
    await page.keyboard.press('Shift+ArrowLeft');
    await expect(said(page)).toContainText(/Partitions now ends Mon,? 19 Oct\./);
    expect(await task(page, 8)).toMatchObject({ start: '2026-10-17', days: 3 });
    await settled(page);
    await screen(page, 'gantt-keys', { viewport: true });
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/page=fitout-task&.*record=8/);
    await expect(page.locator('[data-node="f-name"] input')).toHaveValue('Partitions');
    expect(problems).toEqual([]);
  });

  test('weeks and months are a press away, and a phase folds away under its heading', async ({ page }) => {
    await openPlan(page);
    const width = async () => (await bar(page, 'Partitions').boundingBox())!.width;
    expect(Math.round(await width())).toBe(160);
    await page.locator('.fd-gantt-zooms').getByRole('button', { name: 'Weeks' }).click();
    await expect(gantt(page)).toHaveAttribute('data-zoom', 'week');
    expect(Math.round(await width())).toBe(72);
    await screen(page, 'gantt-weeks', { viewport: true });
    await page.locator('.fd-gantt-zooms').getByRole('button', { name: 'Months' }).click();
    expect(Math.round(await width())).toBe(20);
    await page.getByRole('button', { name: 'Hide First fix' }).click();
    await expect(bar(page, 'Electrical first fix')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Show First fix' })).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('button', { name: 'Show First fix' })).toBeFocused();
    await page.getByRole('button', { name: 'Show First fix' }).click();
    await expect(bar(page, 'Electrical first fix')).toHaveCount(1);
  });

  test('keeps to the list’s search: Electrics leaves the electrician’s tasks alone', async ({ page }) => {
    await openPlan(page);
    await page.getByRole('button', { name: 'Search options' }).click();
    await page.locator('.fd-search-panel').getByRole('button', { name: 'Electrics' }).click();
    await expect(page.locator('.fd-gantt-task')).toHaveText(['Electrical first fix', 'Electrical second fix']);
  });

  test('right to left: the days run from the right, a drag to the left is later, and the left arrow moves a bar on', async ({ page }) => {
    const { problems } = await openPlan(page, `${PLAN}&locale=ar&dir=rtl`);
    await expect(page.locator('.fd-gantt-bar').getByRole('button').first()).toHaveText('اليوم');
    const [first, later] = [(await bar(page, 'Site survey').boundingBox())!, (await bar(page, 'Partitions').boundingBox())!];
    expect(first.x).toBeGreaterThan(later.x);
    // The arrows turned over with the days: from the waste removal's end, at its left, to the ducts' start, at their right.
    const [waste, ducts] = [(await bar(page, 'Waste removal').boundingBox())!, (await bar(page, 'Air-conditioning ducts').boundingBox())!];
    const link = (await page.locator('.fd-gantt-link[data-from="4"][data-to="7"]').boundingBox())!;
    expect(Math.abs(link.x + link.width - waste.x)).toBeLessThan(5);
    expect(Math.abs(link.x - (ducts.x + ducts.width))).toBeLessThan(5);
    await screen(page, 'gantt-rtl', { viewport: true });
    const box = (await bar(page, 'Partitions').boundingBox())!;
    await dragTo(page, { x: box.x + box.width / 2, y: box.y + box.height / 2 }, { x: box.x + box.width / 2 - 40 - 6, y: box.y + box.height / 2 });
    await expect(said(page)).toContainText('نُقل');
    expect(await task(page, 8)).toMatchObject({ start: '2026-10-15' });
    await settled(page);
    await bar(page, 'Partitions').focus();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(async () => (await task(page, 8)).start).toBe('2026-10-16');
    expect(problems).toEqual([]);
  });

  test('on paper, every day of the plan fits the timeline’s width, its buttons left off; on screen again, its scale back', async ({ page }) => {
    await openPlan(page);
    const scroll = page.locator('.fd-gantt-scroll');
    expect(await scroll.evaluate((el) => el.scrollWidth > el.clientWidth + 1)).toBe(true);
    await page.emulateMedia({ media: 'print' });
    // Drawn again for paper: the sheet no wider than the timeline's box.
    const fits = () =>
      page.evaluate(() => {
        const [sheet, box] = [document.querySelector('.fd-gantt-sheet'), document.querySelector('.fd-gantt-body')];
        return !!sheet && !!box && sheet.getBoundingClientRect().width <= box.getBoundingClientRect().width + 1;
      });
    await expect.poll(fits).toBe(true);
    await expect(page.locator('.fd-gantt-zooms')).toBeHidden();
    await expect(bar(page, 'Handover to the tenant')).toBeVisible();
    await screen(page, 'gantt-print');
    await page.emulateMedia({ media: 'screen' });
    await expect(bar(page, 'Partitions')).toHaveCSS('width', '160px');
  });

  test('reads well in the dark, and passes the accessibility checks by days and by months', async ({ page }) => {
    await openPlan(page);
    expect(await axeFindings(page, 'timeline by days')).toEqual([]);
    await page.emulateMedia({ colorScheme: 'dark' });
    await openPlan(page, `${PLAN}&scheme=dark`);
    await screen(page, 'gantt-dark', { viewport: true });
    expect(await axeFindings(page, 'timeline in the dark')).toEqual([]);
    await page.locator('.fd-gantt-zooms').getByRole('button', { name: 'Months' }).click();
    await settled(page);
    expect(await axeFindings(page, 'timeline by months')).toEqual([]);
  });

  test('on a phone: the names narrower, the timeline scrolling inside itself, nothing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openPlan(page);
    await expect(page.locator('.fd-gantt-name').first()).toHaveCSS('width', '140px');
    await expectNoSidewaysScroll(page);
    await screen(page, 'gantt-phone', { viewport: true });
  });
});

test.describe('a timeline looked at from another time zone', () => {
  test.use({ timezoneId: 'America/Los_Angeles', viewport: { width: 1280, height: 1000 } });

  test('keeps each task on its own days and today on the reader’s day, a move writing the day dragged to', async ({ page }) => {
    await openPlan(page);
    await expect(bar(page, 'Partitions')).toHaveAttribute('aria-label', /Wed,? 14 Oct to Sat,? 17 Oct/);
    await expect(page.locator('.fd-gantt-tick[aria-current]')).toHaveAttribute('title', /Wednesday,? 14 October 2026/);
    const box = (await bar(page, 'Partitions').boundingBox())!;
    await dragTo(page, { x: box.x + 20, y: box.y + 10 }, { x: box.x + 20 + 40 + 6, y: box.y + 10 });
    await expect.poll(async () => (await task(page, 8)).start).toBe('2026-10-15');
  });
});

test.describe('a list on a timeline, in the screen designer', () => {
  test('its Timeline in the list’s panel, after Calendar, and Try it shows the records on the timeline', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/screen/?start=fitout');
    const part = page.locator('[data-part="gantt"]');
    await expect(part.getByLabel('Show the records on a timeline too')).toBeChecked();
    await expect(part.getByLabel('Starts', { exact: true })).toHaveValue('start');
    await expect(part.getByLabel('Lasts (days)')).toHaveValue('days');
    await expect(part.getByLabel('Waits for')).toHaveValue('after');
    await part.getByLabel('Shows first').selectOption({ label: 'Weeks' });
    await part.getByRole('checkbox', { name: 'Months' }).uncheck();
    const layout = () => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().layout.gantt);
    // Weeks, the timeline's own first scale, is said by leaving it out.
    await expect.poll(layout).toMatchObject({ zooms: ['day', 'week'] });
    expect((await layout()).zoom).toBeUndefined();
    await part.scrollIntoViewIfNeeded();
    await screen(page, 'gantt-designer', { viewport: true });
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try-frame');
    await expect(tried.locator('.fd-list-views').getByRole('button', { name: 'Timeline', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(tried.locator('.fd-gantt-zooms').getByRole('button', { name: 'Weeks' })).toHaveAttribute('aria-pressed', 'true');
    await expect(tried.locator('.fd-gantt-zooms').getByRole('button', { name: 'Months' })).toHaveCount(0);
    // Made-up tasks round today, each third waiting for the one before it.
    await expect.poll(() => tried.locator('.fd-gantt-task').count()).toBeGreaterThan(5);
    await expect.poll(() => tried.locator('.fd-gantt-link').count()).toBeGreaterThan(2);
    expect(problems).toEqual([]);
  });
});
