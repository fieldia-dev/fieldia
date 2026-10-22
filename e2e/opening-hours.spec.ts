import { expect, test } from './fixtures';
import { node, open, screen } from './support';
import { axeFindings } from './a11y-support';

/** A week's opening hours, as a clinic's manager sets them: a day opened and closed, copied to every day, a break, a wrong shift said. */
const hoursOf = (page: import('@playwright/test').Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.hours as Record<string, [string, string][]>);

test.describe('plain · opening hours', () => {
  test('a day opened takes the hours before it; copied to every day; a break added', async ({ page }) => {
    await open(page, 'plain', 'page=clinic-branch&record=1&skin=outlined');
    const hours = node(page, 'f-hours');
    await expect(hours.locator('.fd-hours-words')).toHaveText('Sat–Wed 10:00–14:00, 15:00–20:00 · Thu 10:00–16:00 · Fri closed');
    // A shift on one line: its two boxes side by side, each a time's width, not the row's.
    const opens = await hours.getByRole('textbox', { name: 'Saturday: opens' }).first().boundingBox();
    const closes = await hours.getByRole('textbox', { name: 'Saturday: closes' }).first().boundingBox();
    expect(Math.abs((opens?.y ?? 0) - (closes?.y ?? 99))).toBeLessThan(2);
    expect(opens?.width ?? 999).toBeLessThan(200);
    await hours.getByRole('checkbox', { name: 'Open on Friday' }).check();
    await expect.poll(async () => (await hoursOf(page))['5']).toEqual([['10:00', '16:00']]);
    await hours.getByRole('group', { name: 'Thursday' }).getByRole('button', { name: 'Add a break' }).click();
    await expect.poll(async () => (await hoursOf(page))['4']).toEqual([['10:00', '12:30'], ['13:30', '16:00']]);
    await hours.getByRole('group', { name: 'Monday' }).getByRole('button', { name: 'Copy to all days' }).click();
    await expect(hours.locator('.fd-hours-words')).toHaveText('Sat–Fri 10:00–14:00, 15:00–20:00');
    await screen(page, 'opening-hours');
    expect(await axeFindings(page, "a week's hours, a break added", '[data-node="f-hours"]')).toEqual([]);
  });

  test("on a phone, a day's shifts under its name, each on one line", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await open(page, 'plain', 'page=clinic-branch&record=1&skin=outlined');
    const saturday = node(page, 'f-hours').getByRole('group', { name: 'Saturday' });
    const opens = await saturday.getByRole('textbox', { name: 'Saturday: opens' }).first().boundingBox();
    const closes = await saturday.getByRole('textbox', { name: 'Saturday: closes' }).first().boundingBox();
    expect(Math.abs((opens?.y ?? 0) - (closes?.y ?? 99))).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await screen(page, 'opening-hours-phone');
  });

  test('a shift that ends before it starts is said under its day, and the branch is not saved', async ({ page }) => {
    await open(page, 'plain', 'page=clinic-branch&record=1&skin=outlined');
    const thursday = node(page, 'f-hours').getByRole('group', { name: 'Thursday' });
    const opens = thursday.getByRole('textbox', { name: 'Thursday: opens' }).first();
    await opens.fill('17:00');
    await opens.press('Tab');
    await expect(thursday.locator('.fd-hours-error')).toHaveText('Thursday: 17:00–16:00 ends before it starts');
    await page.keyboard.press('ControlOrMeta+Enter');
    await expect(page.locator('.fd-announce')).toHaveText('Not saved. Check: Opening hours');
    // The branch as it was stored.
    expect(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['clinic.branch']['1'].hours['4'])).toEqual([['10:00', '16:00']]);
  });
});
