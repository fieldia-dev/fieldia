import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A double-click on Save saves, and only saves. Save hides the moment it
 * saves and the record's next button slides into its place: the second click
 * of the double-click lands on a button the person never saw there, and it is
 * not taken for it — a leave not approved, an appointment not confirmed, a
 * customer not asked about blocking. A click of its own on that button is
 * taken as any is; a key never waits. And a question a button asks opens on
 * Cancel, so Enter never answers it Yes.
 */

const current = (page: Page) => page.locator('.fd-header .fd-statusbar [aria-current="step"]');
const button = (page: Page, id: string) => page.locator(`button[data-node="${id}"]`);
const stored = (page: Page, model: string, id: number) => page.evaluate(([m, i]) => (window as any).fieldiaDemo.dataSource.records[m][i], [model, id] as const);
const settled = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.settled());
const save = (page: Page) => page.locator('.fd-header').getByRole('button', { name: 'Save', exact: true });

/** Where a button's middle is, on the page. */
async function middle(page: Page, locator: ReturnType<Page['locator']>) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe('a double-click on Save', () => {
  test.skip(({ browserName }) => browserName !== 'chromium' && browserName !== 'webkit', 'Chromium and WebKit');

  test('time off: saves the description and approves nothing', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { problems } = await open(page, 'plain', 'page=real-time-off&record=4171&skin=underline');
    await expect(current(page)).toHaveText('To Approve');
    const description = node(page, 'f-name').locator('textarea');
    await description.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' x');
    const at = await middle(page, save(page));
    await page.mouse.move(at.x, at.y);
    await page.mouse.dblclick(at.x, at.y);
    await settled(page);
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    // The button that slid under the pointer, Approve, was not pressed.
    await expect(current(page)).toHaveText('To Approve');
    await expect(page.locator('.fd-say', { hasText: 'First approval given' })).toHaveCount(0);
    expect((await stored(page, 'hr.leave', 4171)).state).toBe('confirm');
    expect((await stored(page, 'hr.leave', 4171)).name).toMatch(/ x$/);
    // Nor did it take the focus: Enter now presses nothing the person did not choose.
    await expect(button(page, 'action_approve')).not.toBeFocused();
    await screen(page, 'steady-time-off-double-click-save');

    // Moved onto it, Approve is a button like any other.
    await page.mouse.move(at.x + 40, at.y + 30);
    await button(page, 'action_approve').click();
    await expect(current(page)).toHaveText('Second Approval');
    expect(problems).toEqual([]);
  });

  test('a clinic appointment: saved, still Booked', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    const { problems } = await open(page, 'plain', 'page=real-clinic-appointment&record=4001&skin=underline');
    await expect(current(page)).toHaveText('Booked');
    const deposit = node(page, 'f-deposit').locator('input');
    await deposit.click();
    await deposit.fill('250');
    const at = await middle(page, save(page));
    await page.mouse.move(at.x, at.y);
    await page.mouse.dblclick(at.x, at.y);
    await settled(page);
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    await expect(current(page)).toHaveText('Booked');
    expect((await stored(page, 'clinic.appointment', 4001)).state).toBe('booked');
    expect((await stored(page, 'clinic.appointment', 4001)).deposit_amount).toBe(250);
    // Clicked once more a moment later, a click of its own, where it stands: Confirm is taken — a click is never lost.
    await page.waitForTimeout(600);
    await page.mouse.click(at.x, at.y);
    await expect(current(page)).toHaveText('Confirmed');
    expect(problems).toEqual([]);
  });

  test('a customer: saved, and "Block this customer?" never asked', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=customer&skin=underline');
    const website = node(page, 'f-website').locator('input');
    await website.click();
    await website.fill('niletraders.example');
    const at = await middle(page, save(page));
    await page.mouse.move(at.x, at.y);
    await page.mouse.dblclick(at.x, at.y);
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(current(page)).toHaveText('Active');
    // A triple click is no different.
    await website.fill('nile.example');
    await page.mouse.move(at.x, at.y);
    await page.mouse.click(at.x, at.y, { clickCount: 3, delay: 20 });
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('a button reached by the keys is pressed at once, though the pointer rests where it slid', async ({ page }) => {
    const { demo } = await open(page, 'plain', 'page=customer&skin=underline');
    const website = node(page, 'f-website').locator('input');
    await website.click();
    await website.fill('niletraders.example');
    const at = await middle(page, save(page));
    await page.mouse.click(at.x, at.y);
    await settled(page);
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    // Block now stands where Save was, under the pointer; Tab to it and Enter asks at once.
    await page.getByRole('button', { name: 'Block', exact: true }).focus();
    await page.keyboard.press('Enter');
    const ask = page.getByRole('alertdialog');
    await expect(ask).toContainText('Block this customer?');
    await expect(ask.getByRole('button', { name: 'Cancel' })).toBeFocused();
    // Enter answers Cancel: nothing blocked.
    await page.keyboard.press('Enter');
    await expect(ask).toHaveCount(0);
    await expect(current(page)).toHaveText('Active');
    expect(await demo<string[]>('actions')).toEqual([]);
  });
});

test.describe('a double tap on Save, on a phone', () => {
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox in Playwright has no isMobile');

  test('saves, and the button that slid under the finger is not pressed', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const { problems } = await open(page, 'plain', 'page=real-time-off&record=4171&skin=underline');
    await expect(current(page)).toHaveText('To Approve');
    const description = node(page, 'f-name').locator('textarea');
    await description.tap();
    await page.keyboard.press('End');
    await page.keyboard.type(' x');
    // Save leads the header, scrolled out of sight as the description was typed in.
    await save(page).scrollIntoViewIfNeeded();
    const at = await middle(page, save(page));
    await page.touchscreen.tap(at.x, at.y);
    await page.waitForTimeout(80);
    await page.touchscreen.tap(at.x, at.y);
    await settled(page);
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    await expect(current(page)).toHaveText('To Approve');
    expect((await stored(page, 'hr.leave', 4171)).state).toBe('confirm');
    await screen(page, 'steady-time-off-double-tap-save');
    expect(problems).toEqual([]);
    await context.close();
  });
});
