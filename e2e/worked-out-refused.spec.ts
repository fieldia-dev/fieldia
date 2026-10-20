import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * The owner's walk of 0.27: an area of −50 gave a price per m² of "−120,000.00"; built on 2030, "The building's age
 * −3" stood beside "Built on can't be after…"; a handover −5 months away gave a date already past; a birth date in
 * 2030 gave "Your age −3", and typing "yesterday" over it changed nothing. A value worked out from an answer the form
 * refuses waits as one worked out from text that does not read does: a dash, said in words, until it is put right —
 * the page's own formula, Fieldia's functions and the app's alike.
 */

const value = (page: Page, id: string) => node(page, id).locator('input').first();
const waiting = (page: Page, id: string) => node(page, id).locator('.fd-value-waits');
/** Typed as a person types, and left with Tab. */
async function typeIn(page: Page, id: string, words: string) {
  await value(page, id).fill(words);
  await value(page, id).press('Tab');
}

for (const [size, viewport] of [
  ['desktop', { width: 1440, height: 900 }],
  ['phone', { width: 390, height: 844 }],
] as const) {
  test.describe(`${size}: a value worked out from an answer the form refuses waits for it`, () => {
    test.beforeEach(async ({ page }) => page.setViewportSize(viewport));

    test('a listing: the price per m² waits for an area of −50, the age for a building built in 2030, the handover for −5 months', async ({ page }) => {
      const { problems } = await open(page, 'plain', 'page=listing&record=new&skin=underline');
      await typeIn(page, 'f-price', '6000000');
      await typeIn(page, 'f-area', '-50');
      await expect(node(page, 'f-area').locator('.fd-error')).toHaveText('Area (m²) must be at least 0');
      await expect(waiting(page, 'f-price-per-meter')).toBeVisible();
      await expect(waiting(page, 'f-price-per-meter')).toHaveAttribute('title', 'Fix Area (m²) to see Price per m²');
      await expect(waiting(page, 'f-price-per-meter').locator('[aria-hidden="true"]')).toHaveText('—');
      // Its number, −120,000.00, never shown.
      await expect(value(page, 'f-price-per-meter')).toBeHidden();
      await typeIn(page, 'f-built-on', '2030-01-01');
      await expect(node(page, 'f-built-on').locator('.fd-error')).toContainText('Built on can');
      await expect(waiting(page, 'f-building-age')).toHaveAttribute('title', 'Fix Built on to see The building’s age (years)');
      await expect(value(page, 'f-building-age')).toBeHidden();
      await typeIn(page, 'f-handover-months', '-5');
      await expect(waiting(page, 'f-handover')).toHaveAttribute('title', 'Fix Handover in (months) to see Handed over by');
      await expect(value(page, 'f-handover')).toBeHidden();
      await node(page, 'f-area').scrollIntoViewIfNeeded();
      await screen(page, `worked-out-refused-listing-${size}`, { viewport: true });
      await node(page, 'f-handover').scrollIntoViewIfNeeded();
      await screen(page, `worked-out-refused-listing-dates-${size}`, { viewport: true });

      // Put right, each is there again, worked out from what is shown.
      await typeIn(page, 'f-area', '50');
      await expect(waiting(page, 'f-price-per-meter')).toBeHidden();
      await expect(value(page, 'f-price-per-meter')).toHaveValue(/120,000\.00|120000/);
      await typeIn(page, 'f-built-on', '2015-06-01');
      await expect(waiting(page, 'f-building-age')).toBeHidden();
      await expect(value(page, 'f-building-age')).toHaveValue(/^1[1-9]$/);
      await typeIn(page, 'f-handover-months', '18');
      await expect(waiting(page, 'f-handover')).toBeHidden();
      await expect(value(page, 'f-handover')).not.toHaveValue('');
      expect(problems).toEqual([]);
    });

    test('after your visit: an age waits for a birth date in 2030, and for "yesterday" typed over it', async ({ page }) => {
      const { problems } = await open(page, 'plain', 'page=visit-feedback&skin=outlined');
      await typeIn(page, 'f-birth-date', '2030-03-01');
      await expect(node(page, 'f-birth-date').locator('.fd-error')).toContainText('Your date of birth can');
      await expect(waiting(page, 'f-age-now')).toBeVisible();
      await expect(waiting(page, 'f-age-now')).toHaveAttribute('title', 'Fix Your date of birth to see Your age');
      await expect(value(page, 'f-age-now')).toBeHidden();
      await typeIn(page, 'f-birth-date', 'yesterday');
      await expect(node(page, 'f-birth-date').locator('.fd-error')).toContainText('yesterday');
      await expect(waiting(page, 'f-age-now')).toHaveAttribute('title', 'Fix Your date of birth to see Your age');
      await expect(value(page, 'f-age-now')).toBeHidden();
      await screen(page, `worked-out-refused-visit-${size}`, { viewport: true });
      await typeIn(page, 'f-birth-date', '1990-03-04');
      await expect(waiting(page, 'f-age-now')).toBeHidden();
      await expect(value(page, 'f-age-now')).toHaveValue(/^3[67]$/);
      expect(problems).toEqual([]);
    });
  });
}
