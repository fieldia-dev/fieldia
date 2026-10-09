import { expect, test } from '@playwright/test';
import { axeFindings, settle } from './a11y-support';
import { open } from './support';

/**
 * The eight themes, drawn: each on its own skin, its accent on the primary
 * button, its own shapes where it has them, and nothing axe finds, light and
 * dark. Their colours are checked pair by pair in widgets (themes.spec.ts);
 * here, that what the browser paints is the theme's.
 */

const THEMES: [string, string, string][] = [
  // theme, its skin, its accent as the browser paints it
  ['material', 'outlined', 'rgb(103, 80, 164)'],
  ['fluent', 'outlined', 'rgb(15, 108, 189)'],
  ['apple', 'outlined', 'rgb(0, 102, 204)'],
  ['bootstrap', 'outlined', 'rgb(10, 88, 202)'],
  ['shadcn', 'outlined', 'rgb(24, 24, 27)'],
  ['ant', 'outlined', 'rgb(19, 101, 217)'],
  ['odoo', 'underline', 'rgb(113, 75, 103)'],
  ['google-forms', 'outlined', 'rgb(103, 58, 183)'],
];

for (const [theme, skin, accent] of THEMES) {
  test(`${theme}: on its own skin, in its own accent, with nothing axe finds, light and dark`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const { problems } = await open(page, 'plain', `page=signup&theme=${theme}`);
    const form = page.locator('.fd-form').first();
    await expect(form).toHaveAttribute('data-fd-theme', theme);
    await expect(form).toHaveAttribute('data-fd-skin', skin);
    const submit = page.getByRole('button', { name: 'Submit' });
    expect(await submit.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe(accent);
    expect(await axeFindings(page, `${theme} light`)).toEqual([]);
    await form.evaluate((f) => f.setAttribute('data-scheme', 'dark'));
    await settle(page);
    expect(await axeFindings(page, `${theme} dark`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('each theme’s own shapes: Material’s filled boxes, Google Forms’ question cards, shadcn’s segmented tabs', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await open(page, 'plain', 'page=signup&theme=material');
  const box = page.getByLabel('Full name');
  expect(await box.evaluate((b) => getComputedStyle(b).backgroundColor)).toBe('rgb(236, 230, 240)');
  await open(page, 'plain', 'page=signup&theme=google-forms');
  // Each question its own card; the title a card with a band of the accent on top.
  const field = page.locator('.fd-field', { has: page.getByLabel('Full name') }).first();
  expect(await field.evaluate((f) => getComputedStyle(f).borderTopWidth)).toBe('1px');
  expect(await page.locator('.fd-page-head').evaluate((h) => getComputedStyle(h).borderTopWidth)).toBe('10px');
  await open(page, 'plain', 'page=real-sale-order&record=7101&theme=shadcn');
  const picked = page.getByRole('tab', { name: 'Order Lines', exact: true });
  expect(await picked.evaluate((t) => getComputedStyle(t).backgroundColor)).toBe('rgb(255, 255, 255)');
  expect(await page.locator('.fd-tablist').first().evaluate((l) => getComputedStyle(l).backgroundColor)).toBe('rgb(244, 244, 245)');
});
