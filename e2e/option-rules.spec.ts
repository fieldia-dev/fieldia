import type { Locator, Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { expectNoSidewaysScroll, node, open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * Options that follow the answers, as a person meets them: a listing's features follow its unit type — a garden and
 * a pool only for a villa, a roof terrace only for an apartment — a feature ticked that a new type no longer offers
 * taken out and said under the field; and a clinic's feedback whose later questions offer what was ticked in the
 * first (`optionsFrom: { field }`), those not ticked too, a choice no longer ticked taken out and said.
 */

const WIDE = { width: 1280, height: 900 };
/** The words of the options a choice offers now, as a person reads them beside their boxes. */
const offered = (choice: Locator) => choice.locator('label.fd-choice');
const tick = (choice: Locator, words: string) => choice.locator('label.fd-choice', { hasText: words }).click();
const ticked = async (choice: Locator) => {
  const all = await choice.locator('label.fd-choice').all();
  const out: string[] = [];
  for (const label of all) if (await label.locator('input').isChecked()) out.push(((await label.textContent()) ?? '').trim());
  return out;
};
/** What a field says under it: its warning, read out as it changes. */
const said = (page: Page, id: string) => node(page, id).locator(':scope > .fd-warning');

for (const variant of VARIANTS) {
  test.describe(`${variant}: a listing's features by its type`, () => {
    let problems: string[] = [];
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=listing&record=new&skin=underline'));
    });
    test.afterEach(() => expect(problems).toEqual([]));

    test('a villa offers a garden and a pool; an apartment takes the garden out and says so', async ({ page }) => {
      const type = node(page, 'f-unit-type');
      const features = node(page, 'f-features');
      await expect(offered(features)).toHaveText(['Balcony', 'Lift', '24-hour security']);
      await tick(type, 'Villa');
      await expect(offered(features)).toHaveText(['Garden', 'Private pool', 'Garage', '24-hour security']);
      await tick(features, 'Garden');
      await tick(features, '24-hour security');
      await screen(page, `${variant}-listing-villa`);
      await tick(type, 'Apartment');
      await expect(offered(features)).toHaveText(['Balcony', 'Roof terrace', 'Lift', '24-hour security']);
      expect(await ticked(features)).toEqual(['24-hour security']);
      await expect(said(page, 'f-features')).toHaveText('Garden is no longer offered, so it was taken out');
      await expect(said(page, 'f-features')).toHaveAttribute('role', 'status');
      await screen(page, `${variant}-listing-apartment`);
      // Ticked again, the field says no more about it.
      await tick(features, 'Roof terrace');
      await expect(said(page, 'f-features')).toBeHidden();
      await expectNoSidewaysScroll(page);
    });
  });

  test.describe(`${variant}: after your visit`, () => {
    let problems: string[] = [];
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(WIDE);
      ({ problems } = await open(page, variant, 'page=visit-feedback&skin=outlined'));
    });
    test.afterEach(() => expect(problems).toEqual([]));

    test('the questions after the first offer what was ticked in it, and what was not', async ({ page }) => {
      const treatments = node(page, 'f-treatments');
      const again = node(page, 'f-again');
      const next = node(page, 'f-try-next');
      await expect(again).toBeHidden();
      await tick(treatments, 'Botox');
      await tick(treatments, 'Chemical peel');
      await expect(offered(again)).toHaveText(['Botox', 'Chemical peel', 'None of them']);
      await expect(offered(next)).toHaveText(['Filler', 'Laser hair removal', 'HydraFacial']);
      await tick(again, 'Chemical peel');
      await screen(page, `${variant}-visit-feedback-carried`);
      // Unticked above, it is taken out below, and said.
      await tick(treatments, 'Chemical peel');
      await expect(offered(again)).toHaveText(['Botox', 'None of them']);
      expect(await ticked(again)).toEqual([]);
      await expect(said(page, 'f-again')).toHaveText('Chemical peel is no longer offered, so it was taken out');
      await expect(offered(next)).toHaveText(['Filler', 'Chemical peel', 'Laser hair removal', 'HydraFacial']);
      await screen(page, `${variant}-visit-feedback-taken-out`);
    });

    test('an age worked out from a birth date keeps an option for adults to them', async ({ page }) => {
      const hear = node(page, 'f-hear-about');
      await expect(offered(hear)).toHaveText(['The clinic’s news']);
      const birth = node(page, 'f-birth-date').locator('input').first();
      await birth.fill('2012-03-04');
      await birth.press('Tab');
      await expect(node(page, 'f-age-now').locator('input')).toHaveValue(/^1[34]$/);
      await expect(offered(hear)).toHaveText(['The clinic’s news']);
      await birth.fill('1990-03-04');
      await birth.press('Tab');
      await expect(offered(hear)).toHaveText(['Laser packages for adults', 'The clinic’s news']);
      await tick(node(page, 'f-treatments'), 'Filler');
      await expect(offered(hear)).toHaveText(['Offers on what you had', 'Laser packages for adults', 'The clinic’s news']);
      await screen(page, `${variant}-visit-feedback-age`);
    });
  });
}
