import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, node, open, screen } from './support';

/**
 * A ticket's codes, as the person holding it and the door's scanner meet them: its link as a QR code, its number and
 * its badge's as barcodes, drawn on the page black on white whatever the scheme, named for a screen reader; the QR code
 * following its link as it is changed, and saying words too long for it; on paper as on the screen.
 */

const link = (page: import('@playwright/test').Page) => node(page, 'f-link');

test.describe('a value shown as a QR code or a barcode', () => {
  test('a ticket’s link as a QR code and its number as a barcode, named, at their sizes', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=event-ticket&record=1&skin=outlined');
    const qr = link(page).getByRole('img', { name: 'QR code: https://tickets.example/t/TKT-2026-0042' });
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((svg) => [Math.round(svg.getBoundingClientRect().width), Math.round(svg.getBoundingClientRect().height)])).toEqual([200, 200]);
    const bar = node(page, 'f-reference').getByRole('img', { name: 'Barcode: TKT-2026-0042' });
    await expect(bar).toBeVisible();
    expect(Math.round((await bar.boundingBox())?.height ?? 0)).toBe(64);
    // A barcode's words under it; a read-only one has no box over it.
    await expect(node(page, 'f-reference').locator('.fd-code-words')).toHaveText('TKT-2026-0042');
    await expect(node(page, 'f-reference').locator('input')).toBeHidden();
    await expect(node(page, 'f-badge').getByRole('img', { name: 'Barcode: 20261105' })).toBeVisible();
    await screen(page, 'codes-ticket');
    expect(await axeFindings(page, 'a ticket’s codes')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('the QR code follows its link as it is changed, and says words too long for it', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=event-ticket&record=1&skin=outlined');
    const box = link(page).getByRole('textbox', { name: 'Ticket on your phone' });
    await box.fill('https://tickets.example/t/TKT-2026-0043');
    await box.press('Tab');
    await expect(link(page).getByRole('img')).toHaveAccessibleName('QR code: https://tickets.example/t/TKT-2026-0043');
    await box.fill('x'.repeat(2000));
    await box.press('Tab');
    await expect(link(page).getByRole('status')).toHaveText('Too long for a QR code: shorten it, or show a link to it instead.');
    await expect(link(page).getByRole('img')).toHaveCount(0);
    expect(problems).toEqual([]);
  });

  test('black on white in the dark and on a phone, and on paper', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const { problems } = await open(page, 'plain', 'page=event-ticket&record=1&skin=outlined&scheme=dark');
    const figure = link(page).locator('.fd-code-figure');
    await expect(figure).toBeVisible();
    expect(await figure.evaluate((element) => [getComputedStyle(element).backgroundColor, getComputedStyle(element.querySelector('path') as Element).fill])).toEqual(['rgb(255, 255, 255)', 'rgb(0, 0, 0)']);
    await expectNoSidewaysScroll(page);
    await screen(page, 'codes-ticket-phone-dark');
    await page.emulateMedia({ media: 'print' });
    await expect(link(page).getByRole('img')).toBeVisible();
    await expect(node(page, 'f-reference').getByRole('img')).toBeVisible();
    expect(problems).toEqual([]);
  });
});
