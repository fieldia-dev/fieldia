import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A form on another site, as a partner's page has it: `<fieldia-form>` with one script tag — its page fetched, its
 * form drawn in it, what happens told as events — and fieldia-embed.js's frame of the app's own form page, growing and
 * shrinking with the form, the link's campaign reaching its hidden fields, and what happens told to the page round it.
 */

let problems: string[] = [];
test.beforeEach(({ page }) => {
  problems = [];
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
});
test.afterEach(() => expect(problems).toEqual([]));

const told = (page: import('@playwright/test').Page) => page.locator('#told li');

/** The mobile typed and confirmed with the demo's code, which is always 246810. */
async function confirm(form: import('@playwright/test').Locator | import('@playwright/test').FrameLocator, number: string) {
  const phone = form.locator('[data-node="f-phone"]');
  await phone.locator('input').first().fill(number);
  await phone.locator('input').first().press('Tab');
  await phone.getByRole('button', { name: 'Send a code by WhatsApp' }).click();
  await phone.getByRole('textbox', { name: /Code sent to/ }).fill('246810');
  await expect(phone.locator('.fd-verify-done')).toBeVisible();
}

test('<fieldia-form> draws its page on a partner’s page and tells what happens', async ({ page }) => {
  await page.goto('/embed/?utm_source=newsletter&unit=B-12');
  const element = page.locator('fieldia-form');
  await expect(element.locator('.fd-form')).toBeVisible();
  await expect(told(page).first()).toHaveText('fieldia-ready {"page":"unit-enquiry"}');
  // Its page's link fills the unit from the partner's address.
  await expect(element.locator('[data-node="f-unit"] input')).toHaveValue('B-12');
  await element.locator('[data-node="f-name"] input').fill('Hana Fouad');
  await confirm(element, '010 1234 5678');
  await element.getByRole('radio', { name: 'Book a viewing' }).check();
  await element.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(element.locator('.fd-done-title')).toHaveText('Thank you, Hana Fouad');
  await expect(told(page).last()).toHaveText('fieldia-send {"id":"R-1201"}');
  const sent = await page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses[0].values);
  expect(sent).toMatchObject({ unit: 'B-12', utm_source: 'newsletter' });
  await screen(page, 'embed-element');
});

test('<fieldia-form> speaks its locale attribute’s language, right to left', async ({ page }) => {
  await page.goto('/embed/?locale=ar');
  await expect(page.locator('fieldia-form .fd-form')).toHaveAttribute('dir', 'rtl');
});

test('the embed script’s frame grows and shrinks with the form, and the link’s campaign reaches its hidden fields', async ({ page }) => {
  await page.goto('/embed/?as=frame&utm_source=newsletter&agent=mona&unit=B-12&token=secret');
  const frame = page.locator('iframe[data-fieldia-frame]');
  await expect(frame).toHaveAttribute('title', 'Ask about this unit');
  const src = new URL((await frame.getAttribute('src')) as string);
  expect(Object.fromEntries(src.searchParams)).toMatchObject({ utm_source: 'newsletter', agent: 'mona', unit: 'B-12' });
  expect(src.searchParams.has('token')).toBe(false);
  const inside = page.frameLocator('iframe[data-fieldia-frame]');
  await expect(inside.locator('.fd-form')).toBeVisible();
  await expect(told(page).first()).toHaveText('fieldia-ready {"page":"unit-enquiry"}');
  // The frame as tall as its form: no scrollbar inside it, its height its document's.
  const fits = async () => {
    const [height, content] = await Promise.all([frame.evaluate((one) => one.getBoundingClientRect().height), inside.locator('html').evaluate((html) => html.getBoundingClientRect().height)]);
    return Math.abs(height - content) <= 2;
  };
  await expect.poll(fits).toBe(true);
  const tall = await frame.evaluate((one) => one.getBoundingClientRect().height);
  expect(tall).toBeGreaterThan(600);
  await expect(inside.locator('[data-node="f-unit"] input')).toHaveValue('B-12');
  await inside.locator('[data-node="f-name"] input').fill('Omar Said');
  await confirm(inside, '012 2222 3333');
  await inside.getByRole('radio', { name: 'Book a viewing' }).check();
  await screen(page, 'embed-frame');
  await inside.getByRole('button', { name: 'Submit', exact: true }).click();
  await expect(inside.locator('.fd-done-title')).toHaveText('Thank you, Omar Said');
  await expect(told(page).last()).toHaveText('fieldia-send {"id":"R-1201"}');
  // Sent, the thanks is shorter than the form: the frame shrinks with it.
  await expect.poll(fits).toBe(true);
  expect(await frame.evaluate((one) => one.getBoundingClientRect().height)).toBeLessThan(tall);
  const sent = await page.frames().find((one) => one.url().includes('form.html'))?.evaluate(() => (window as any).fieldiaDemo.dataSource.responses[0].values);
  expect(sent).toMatchObject({ utm_source: 'newsletter', agent_code: 'mona', unit: 'B-12' });
});
