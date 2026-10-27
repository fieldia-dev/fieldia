import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * A test drive at a showroom in Berlin, booked by a person in Cairo (the
 * browser's zone): the page names its zone (`timeZone`), so every time on it
 * is on Berlin's clock, its short name beside it. The time is booked from the
 * times free (`"widget": "slots"`): the month's days shaded by how they are
 * booked, a day's times as chips, the arrows across both, a time someone else
 * booked meanwhile said and never booked, another car's times its own; and
 * the date and time box saying a time the clocks repeat, or skip, on Berlin's
 * change days. "Now" is pinned (`now=`, in the browser's own time: 08:40 in
 * Berlin on Wednesday 14 October 2026), so the demo's bookings round it are
 * the same on every run.
 */

const NOW = 'now=2026-10-14T09:40';
const DRIVE = `page=test-drive&skin=outlined&record=new&${NOW}`;

test.use({ timezoneId: 'Africa/Cairo', locale: 'en-GB' });

const slots = (page: Page) => node(page, 'f-start');
const day = (page: Page, n: number) => slots(page).locator('.fd-slots-days button:not(.fd-outside)').filter({ hasText: new RegExp(`^${n}$`) });
const chips = (page: Page) => slots(page).locator('.fd-slots-chip');
const said = (page: Page) => slots(page).locator('.fd-slots-said');
const valueOf = (page: Page, name: string) => page.evaluate((field) => (window as any).fieldiaDemo.handle.form.getState().values[field], name);
/** A car chosen as a person chooses one: some of its name typed, then its option. */
async function chooseCar(page: Page, typed: string, name: string) {
  const box = node(page, 'f-car').getByRole('combobox');
  await box.fill(typed);
  await page.getByRole('option', { name }).click();
  await expect(box).toHaveValue(name);
}
/** The month asked of the data source: no day still waiting for its state. */
const settled = (page: Page) => expect(slots(page).locator('.fd-slots-days')).not.toHaveAttribute('aria-busy', 'true');

test.describe('a test drive booked from the times free, on Berlin’s clock', () => {
  test('shades the month by how it is booked, and books a time from the keyboard', async ({ page }) => {
    const { problems } = await open(page, 'plain', DRIVE);
    await chooseCar(page, 'hatch', 'City hatchback, electric');
    await settled(page);
    await expect(slots(page).locator('.fd-calendar-title')).toHaveText('October 2026');
    // The zone by its name all year: the clocks go back on the 25th, and this month holds both CEST and CET.
    await expect(slots(page).locator('.fd-slots-zone')).toHaveText('Times are Central European Time');
    // Today in Berlin; the days before it closed; the hatchback's next Wednesday fully booked; the staff day; Sundays.
    await expect(day(page, 14)).toHaveAttribute('aria-current', 'date');
    await expect(day(page, 13)).toHaveAttribute('data-state', 'past');
    await expect(day(page, 21)).toHaveAttribute('data-state', 'full');
    await expect(day(page, 21)).toHaveAttribute('aria-label', /Wednesday,? 21 October 2026, Fully booked/);
    await expect(day(page, 24)).toHaveAttribute('aria-label', /Saturday,? 24 October 2026, Holiday: Staff training day/);
    await expect(day(page, 18)).toHaveAttribute('data-state', 'closed');
    await expect(day(page, 15)).toHaveAttribute('data-state', 'open');
    await screen(page, 'slots-month');

    // Today's times: from 09:00, the hatchback's day free; then the arrows, the times following the day in focus.
    await day(page, 14).click();
    await expect(slots(page).locator('.fd-slots-heading')).toHaveText(/Free times on Wednesday,? 14 October/);
    await expect(chips(page)).toHaveText(['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00']);
    await page.keyboard.press('ArrowRight');
    await expect(day(page, 15)).toBeFocused();
    await expect(chips(page)).toHaveText(['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']);
    await page.keyboard.press('Enter');
    await expect(chips(page).first()).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(chips(page).nth(1)).toBeFocused();
    await expect(chips(page).nth(1)).toHaveAttribute('aria-label', '10:00 to 10:45');
    await page.keyboard.press('Enter');
    // 10:00 in Berlin is 08:00 UTC; the drive ends 45 minutes later, in Back by.
    await expect.poll(() => valueOf(page, 'start')).toBe('2026-10-15T08:00:00.000Z');
    expect(await valueOf(page, 'stop')).toBe('2026-10-15T08:45:00.000Z');
    await expect(chips(page).nth(1)).toHaveAttribute('aria-pressed', 'true');
    await expect(chips(page).nth(1)).toBeFocused();
    await expect(slots(page).locator('.fd-slots-chosen')).toHaveText(/^Thursday,? 15 October 2026, 10:00 to 10:45 CEST$/);
    // Back by, on Berlin's clock, its zone beside it — not Cairo's 11:45.
    await expect(node(page, 'f-stop').locator('input')).toHaveValue('15 Oct 2026, 10:45');
    await expect(node(page, 'f-stop').locator('.fd-zone')).toHaveText('CEST');
    await screen(page, 'slots-booked');
    // Escape goes back to the month, on the day.
    await page.keyboard.press('Escape');
    await expect(day(page, 15)).toBeFocused();

    await node(page, 'f-customer').locator('input').fill('Ines Moreau');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect
      .poll(() => page.evaluate(() => Object.values((window as any).fieldiaDemo.dataSource.records['drive.booking']).find((r: any) => r.customer === 'Ines Moreau')))
      .toMatchObject({ start: '2026-10-15T08:00:00.000Z', stop: '2026-10-15T08:45:00.000Z', car: { label: 'City hatchback, electric' } });
    expect(await axeFindings(page, 'booking slots')).toEqual([]);
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });

  test('says a time someone else booked meanwhile, and books nothing', async ({ page }) => {
    const { problems } = await open(page, 'plain', DRIVE);
    await chooseCar(page, 'hatch', 'City hatchback, electric');
    await settled(page);
    await day(page, 16).click();
    await expect(chips(page)).toHaveText(['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '17:00']);
    // On another screen, someone books 10:00 that Friday for the hatchback.
    await page.evaluate(() => {
      (window as any).fieldiaDemo.dataSource.records['drive.booking'][999] = { customer: 'Tom Schulz', car: { id: 1, label: 'City hatchback, electric' }, start: '2026-10-16T08:00:00.000Z', stop: '2026-10-16T08:45:00.000Z' };
    });
    await chips(page).filter({ hasText: '10:00' }).click();
    await expect(said(page)).toHaveText('10:00 was just booked by someone else. Pick another time.');
    await expect(chips(page)).toHaveText(['09:00', '11:00', '12:00', '14:00', '15:00', '17:00']);
    expect(await valueOf(page, 'start')).toBeNull();
    await expect(day(page, 16)).toHaveAttribute('aria-label', /6 free times$/);
    await screen(page, 'slots-taken');
    // Another time is booked.
    await chips(page).filter({ hasText: '11:00' }).click();
    await expect.poll(() => valueOf(page, 'start')).toBe('2026-10-16T09:00:00.000Z');
    await expect(said(page)).toHaveText('');
    expect(problems).toEqual([]);
  });

  test('“Someone else books 10:00” over the form: a visitor sees a time taken meanwhile said, and nothing booked', async ({ page }) => {
    // As the walk asked: what only the console could do, a button over the demo does, as the two tabs' "Someone else edits this".
    const { problems } = await open(page, 'plain', DRIVE);
    const bar = page.locator('.demo-meanwhile-bar');
    const someone = bar.getByRole('button');
    await expect(bar).toContainText('Pick a car and a day');
    await expect(someone).toBeHidden();
    await chooseCar(page, 'hatch', 'City hatchback, electric');
    await settled(page);
    await day(page, 16).click();
    await expect(someone).toHaveText('Someone else books 10:00');
    await someone.click();
    await expect(bar).toContainText('Tom Schulz booked 10:00 on another screen, just now. Yours still shows it: press 10:00 and see.');
    // This screen was not told: 10:00 is still there, as another screen's booking leaves it; the button takes the next.
    await expect(chips(page).filter({ hasText: '10:00' })).toHaveCount(1);
    await expect(someone).toHaveText('Someone else books 09:00');
    await screen(page, 'slots-someone-else-books');
    await chips(page).filter({ hasText: '10:00' }).click();
    await expect(said(page)).toHaveText('10:00 was just booked by someone else. Pick another time.');
    expect(await valueOf(page, 'start')).toBeNull();
    await expect(chips(page).filter({ hasText: '10:00' })).toHaveCount(0);
    await expect(bar).toContainText('Tom Schulz booked 10:00 first, on another screen: this page said so, and booked nothing.');
    await screen(page, 'slots-someone-else-booked-first');
    expect(problems).toEqual([]);
  });

  test('26 October, after the clocks go back: CET beside the times, and nothing saying CEST', async ({ page }) => {
    const { problems } = await open(page, 'plain', DRIVE);
    await chooseCar(page, 'estate', 'Family estate, hybrid');
    await settled(page);
    await day(page, 26).click();
    await chips(page).filter({ hasText: '10:00' }).click();
    // 10:00 in Berlin's winter is 09:00 UTC.
    await expect.poll(() => valueOf(page, 'start')).toBe('2026-10-26T09:00:00.000Z');
    await expect(slots(page).locator('.fd-slots-chosen')).toHaveText(/^Monday,? 26 October 2026, 10:00 to 10:45 CET$/);
    await expect(slots(page).locator('.fd-slots-zone')).toHaveText('Times are Central European Time');
    await expect(slots(page)).not.toContainText('CEST');
    await screen(page, 'slots-26-october-cet');
    // A day before the change, the same note; the summer's name beside its times.
    await day(page, 23).click();
    await chips(page).filter({ hasText: '10:00' }).click();
    await expect(slots(page).locator('.fd-slots-chosen')).toHaveText(/^Friday,? 23 October 2026, 10:00 to 10:45 CEST$/);
    await expect(slots(page).locator('.fd-slots-zone')).toHaveText('Times are Central European Time');
    expect(problems).toEqual([]);
  });

  test('a double-click on a time just booked books nothing: the time that slid under the pointer is never taken', async ({ page }) => {
    const { problems } = await open(page, 'plain', DRIVE);
    await chooseCar(page, 'hatch', 'City hatchback, electric');
    await settled(page);
    await day(page, 16).click();
    await expect(chips(page)).toHaveText(['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '17:00']);
    await page.evaluate(() => {
      (window as any).fieldiaDemo.dataSource.records['drive.booking'][999] = { customer: 'Tom Schulz', car: { id: 1, label: 'City hatchback, electric' }, start: '2026-10-16T08:00:00.000Z', stop: '2026-10-16T08:45:00.000Z' };
    });
    // The walk's double-click: its first click asks about 10:00, which is said taken, the times close up and 11:00
    // slides under the pointer — then its second click lands there.
    const box = await chips(page).filter({ hasText: '10:00' }).boundingBox();
    if (!box) throw new Error('no 10:00');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down({ clickCount: 1 });
    await page.mouse.up({ clickCount: 1 });
    await expect(said(page)).toHaveText('10:00 was just booked by someone else. Pick another time.');
    await expect(chips(page)).toHaveText(['09:00', '11:00', '12:00', '14:00', '15:00', '17:00']);
    await page.mouse.down({ clickCount: 2 });
    await page.mouse.up({ clickCount: 2 });
    // 11:00, never pointed at, is not booked; the warning stays until the person picks again.
    await expect(said(page)).toHaveText('10:00 was just booked by someone else. Pick another time.');
    expect(await valueOf(page, 'start')).toBeNull();
    await expect(chips(page).filter({ hasText: '11:00' })).toHaveAttribute('aria-pressed', 'false');
    await screen(page, 'slots-double-click-taken');
    // A click of its own, a moment later, picks it.
    await page.waitForTimeout(600);
    await chips(page).filter({ hasText: '11:00' }).click();
    await expect.poll(() => valueOf(page, 'start')).toBe('2026-10-16T09:00:00.000Z');
    await expect(said(page)).toHaveText('');
    expect(problems).toEqual([]);
  });

  test('another car has its own times: a full day for one is open for another', async ({ page }) => {
    await open(page, 'plain', DRIVE);
    await chooseCar(page, 'hatch', 'City hatchback, electric');
    await settled(page);
    await day(page, 21).click();
    await expect(slots(page).locator('.fd-slots-heading')).toHaveText(/No free times on Wednesday,? 21 October/);
    await expect(chips(page)).toHaveCount(0);
    await chooseCar(page, 'estate', 'Family estate, hybrid');
    await settled(page);
    await expect(day(page, 21)).toHaveAttribute('data-state', 'open');
    await expect(chips(page).first()).toHaveText('09:00');
    // A month on, its days asked as it is shown: after the clocks go back, Berlin is on CET.
    await slots(page).getByRole('button', { name: 'Next month' }).click();
    await settled(page);
    await expect(slots(page).locator('.fd-calendar-title')).toHaveText('November 2026');
    await expect(slots(page).locator('.fd-slots-zone')).toHaveText('Times are Central European Time');
    await day(page, 2).click();
    await chips(page).first().click();
    // 09:00 in Berlin's winter is 08:00 UTC.
    await expect.poll(() => valueOf(page, 'start')).toBe('2026-11-02T08:00:00.000Z');
    await expect(slots(page).locator('.fd-slots-chosen')).toHaveText(/Monday,? 2 November 2026, 09:00 to 09:45 CET$/);
  });

  test('a date and time box on Berlin’s clock says a time the clocks repeat, or skip', async ({ page }) => {
    const { problems } = await open(page, 'plain', DRIVE);
    const callBack = node(page, 'f-call-back');
    const box = callBack.locator('input');
    await expect(callBack.locator('.fd-zone')).toHaveText('CEST');
    await box.fill('20/10/2026 16:30');
    await box.press('Tab');
    // 16:30 in Berlin, 17:30 in Cairo: kept as the instant, shown on Berlin's clock.
    await expect.poll(() => valueOf(page, 'call_back')).toBe('2026-10-20T14:30:00.000Z');
    await expect(box).toHaveValue('20 Oct 2026, 16:30');
    // 02:30 comes twice the night the clocks go back: which is asked, the text kept.
    await box.fill('25/10/2026 02:30');
    await box.press('Tab');
    await expect(callBack.locator('.fd-error').first()).toHaveText('Call back at: 02:30 comes twice on 25 Oct 2026 in Central European Time, as the clocks go back; write 02:30 +02:00 or 02:30 +01:00');
    await expect(box).toHaveValue('25/10/2026 02:30');
    await screen(page, 'zone-twice');
    await box.click();
    await box.press('End');
    // Either offset the words name is typed after it, key by key (the zone's short name, CET, is read too).
    await box.pressSequentially(' +01:00');
    await box.press('Tab');
    await expect.poll(() => valueOf(page, 'call_back')).toBe('2026-10-25T01:30:00.000Z');
    await expect(box).toHaveValue('25 Oct 2026, 02:30');
    await expect(callBack.locator('.fd-zone')).toHaveText('CET');
    await expect(callBack.locator('.fd-error')).toBeHidden();
    // 02:30 is no time the night they go forward.
    await box.fill('28/03/2027 02:30');
    await box.press('Tab');
    await expect(callBack.locator('.fd-error').first()).toHaveText('Call back at: there is no 02:30 on 28 Mar 2027 in Central European Time: the clocks go from 02:00 to 03:00');
    expect(await valueOf(page, 'call_back')).toBe('2026-10-25T01:30:00.000Z');
    await screen(page, 'zone-skipped');
    expect(problems).toEqual([]);
  });

  test('a drive made from the calendar’s empty slot is back as its slot ends, not an hour on, and closes unasked', async ({ page }) => {
    // The showroom's week of drives, its day view a column a car: an hour of the estate's free from 09:00, pressed.
    const { problems } = await open(page, 'plain', `page=test-drives&skin=outlined&${NOW}`);
    await expect(page.locator('.fd-cal-body')).not.toHaveAttribute('aria-busy', 'true');
    await page.locator('.fd-cal-ranges button[data-range="day"]').click();
    const estate = page.locator('.fd-cal-col[data-column="1"]');
    await expect(estate).toHaveAttribute('aria-label', /Family estate, hybrid$/);
    let hour = 9;
    while (hour < 18 && !(await estate.locator(`.fd-cal-slot[data-minutes="${hour * 60}"]`).getAttribute('aria-label'))?.endsWith(', free')) hour++;
    const at = String(hour).padStart(2, '0');
    await estate.locator(`.fd-cal-slot[data-minutes="${hour * 60}"]`).click();
    const drive = page.getByRole('dialog');
    await expect(drive.locator('.fd-slots-chosen')).toHaveText(new RegExp(`, ${at}:00 to ${at}:45 (CEST|CET)$`));
    // Back by: the drive's own 45 minutes, as the times it is booked from say — 0.35 said the calendar's hour, :00.
    await expect(drive.locator('[data-node="f-stop"]').getByRole('textbox')).toHaveValue(new RegExp(`, ${at}:45$`));
    // Nothing the person changed: Escape closes it at once.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(drive).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('opens a booking on its day, its own time pressed: free to it, though booked', async ({ page }) => {
    await open(page, 'plain', `page=test-drive&skin=outlined&record=1&${NOW}`);
    await settled(page);
    await expect(day(page, 14)).toHaveAttribute('aria-pressed', 'true');
    await expect(chips(page).filter({ hasText: '11:00' })).toHaveAttribute('aria-pressed', 'true');
    await expect(slots(page).locator('.fd-slots-chosen')).toHaveText(/^Wednesday,? 14 October 2026, 11:00 to 11:45 CEST$/);
  });

  test('right to left in Arabic: the arrows follow the screen, the zone in Arabic words', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=test-drive&skin=outlined&record=new&locale=ar&dir=rtl&${NOW}`);
    await chooseCar(page, 'hatch', 'City hatchback, electric');
    await settled(page);
    await expect(slots(page).locator('.fd-calendar-title')).toHaveText('أكتوبر 2026');
    await expect(slots(page).locator('.fd-slots-zone')).toContainText('توقيت وسط أوروبا');
    await day(page, 14).click();
    // Right to left the week runs from the right: the left arrow is the next day.
    await page.keyboard.press('ArrowLeft');
    await expect(day(page, 15)).toBeFocused();
    await expect(chips(page).first()).toHaveText('09:00');
    await screen(page, 'slots-arabic');
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });

  test('on a phone, dark: the month, then the times under it, nothing sideways', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await open(page, 'plain', `${DRIVE}&scheme=dark`);
    await chooseCar(page, 'hatch', 'City hatchback, electric');
    await settled(page);
    await day(page, 15).click();
    await expect(chips(page).first()).toBeVisible();
    const month = await slots(page).locator('.fd-slots-month').boundingBox();
    const times = await slots(page).locator('.fd-slots-times').boundingBox();
    expect(times!.y).toBeGreaterThan(month!.y + month!.height - 1);
    await expectNoSidewaysScroll(page);
    await screen(page, 'slots-phone');
  });
});
