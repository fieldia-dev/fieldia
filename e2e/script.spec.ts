import { expect, test } from '@playwright/test';
import { screen } from './support';

/** Fieldia from one <script> tag: no bundler, no modules, the global `Fieldia`. */
test('a page with no build step fills in and sends a form', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  expect(await page.evaluate(() => typeof (window as any).Fieldia)).toBe('object');
  expect(await page.evaluate(() => (window as any).fieldiaDemo.version)).toMatch(/^\d+\.\d+\.\d+/);

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('Your name is required')).toBeVisible();
  await page.getByLabel('Your name').fill('Omar Farouk');
  await page.getByLabel('Phone').fill('+20 100 555 0101');
  await page.getByLabel('Afternoon').check();
  await screen(page, 'script-filled');
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses.length)).toBe(1);
  expect(await page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses[0].values)).toMatchObject({
    name: 'Omar Farouk',
    phone: '+20 100 555 0101',
    when: 'afternoon',
  });
  expect(problems).toEqual([]);
});
