import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * Functions in a page's formulas, as a person meets them on a listing: its price per m² rounded to the piastre
 * (`roundMoney`), its handover months after it is listed (`addMonths`), its building's age in whole years
 * (`years`), a reference in capitals (`upper`, `join`) — and the district's average per m² asked of the app's own
 * server (the demos' `districtPrice`, which answers after a moment): an ellipsis while it is asked, said in words,
 * then its value and the listing against it; a save waiting for the answer. Each framework hands the app's function
 * on (`functions`).
 */

const WIDE = { width: 1280, height: 900 };
const value = (page: Page, id: string) => node(page, id).locator('input').first();
const stored = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.dataSource.records['listing'] ?? {});

for (const variant of VARIANTS) {
  test.describe(`${variant}: a listing's values worked out`, () => {
    let problems: string[] = [];
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=listing&record=new&skin=underline'));
    });
    test.afterEach(() => expect(problems).toEqual([]));

    test('a price per m² rounded to the piastre, a handover months away, the building’s age, a reference', async ({ page }) => {
      await node(page, 'f-unit-type').locator('label.fd-choice', { hasText: 'Villa' }).click();
      await value(page, 'f-bedrooms').fill('4');
      await value(page, 'f-area').fill('245');
      await value(page, 'f-price').fill('12000000');
      await value(page, 'f-price').press('Tab');
      // 12,000,000 / 245 is 48,979.5918…: rounded to the piastre, as the pound keeps it.
      await expect(value(page, 'f-price-per-meter')).toHaveValue(/48,979\.59|48979\.59/);
      await value(page, 'f-handover-months').fill('18');
      await value(page, 'f-handover-months').press('Tab');
      await expect(value(page, 'f-handover')).not.toHaveValue('');
      await expect(value(page, 'f-reference')).toHaveValue('VILLA-4');
      // Built in 2015: its age in whole years, to today on the page's clock.
      await value(page, 'f-built-on').fill('2015-06-01');
      await value(page, 'f-built-on').press('Tab');
      await expect(value(page, 'f-building-age')).toHaveValue(/^1[1-9]$/);
    });

    test('the district’s average is asked of the app: an ellipsis, said, then its value; a save waits for it', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Listing' }).fill('Garden villa');
      await node(page, 'f-unit-type').locator('label.fd-choice', { hasText: 'Villa' }).click();
      await value(page, 'f-area').fill('200');
      await value(page, 'f-price').fill('11000000');
      await value(page, 'f-price').press('Tab');
      await node(page, 'f-district').locator('select').selectOption({ label: 'New Cairo' });
      const average = node(page, 'f-district-price');
      // While it is asked: an ellipsis in its place, said in words, and the comparison waiting with it.
      await expect(average).toHaveAttribute('data-asking', '');
      await expect(average.locator('.fd-value-waits')).toHaveAttribute('title', 'Working out The district’s average per m²…');
      await expect(node(page, 'f-against-district')).toHaveAttribute('data-asking', '');
      await screen(page, `${variant}-listing-asking`);
      // Saved meanwhile: the save waits for the answer, and keeps it.
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await expect(average).not.toHaveAttribute('data-asking', '');
      await expect(value(page, 'f-district-price')).toHaveValue(/52,000|52000/);
      // 55,000 a metre against the district's 52,000: 6% over.
      await expect(value(page, 'f-against-district')).toHaveValue('6');
      await expect.poll(async () => Object.values(await stored(page)).map((record: any) => [record.name, record.district_price, record.against_district])).toContainEqual(['Garden villa', 52000, 6]);
      await screen(page, `${variant}-listing-answered`);
    });
  });
}
