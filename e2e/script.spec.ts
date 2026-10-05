import { expect, test, type Page } from '@playwright/test';
import { screen } from './support';

/** Fieldia from one <script> tag: no bundler, no modules, the global `Fieldia`. */
test('a page with no build step fills in and sends a form', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  const requested: string[] = [];
  page.on('request', (request) => requested.push(new URL(request.url()).pathname));
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  expect(await page.evaluate(() => typeof (window as any).Fieldia)).toBe('object');
  // English alone: no language's script asked for, and no other language's words in the one that came.
  expect(requested.filter((path) => /fieldia(\.\w+)?\.js$/.test(path))).toEqual(['/script/fieldia.js']);
  expect(await page.evaluate(() => Object.keys((window as any).Fieldia.VIEWER_LABELS))).toEqual(['en']);
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

/** Problems and warnings in the console, and errors on the page. */
function watch(page: Page) {
  const problems: string[] = [];
  const warnings: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => (message.type() === 'error' ? problems : message.type() === 'warning' ? warnings : []).push(message.text()));
  return { problems, warnings };
}

test('in Arabic with its script: Fieldia’s own words in Arabic, right to left', async ({ page }) => {
  const { problems, warnings } = watch(page);
  await page.goto('/script/?locale=ar');
  const form = page.locator('.fd-form');
  await expect(form).toHaveAttribute('dir', 'rtl');
  expect(await page.evaluate(() => Object.keys((window as any).Fieldia.VIEWER_LABELS))).toEqual(['en', 'ar']);
  await page.getByRole('button', { name: 'إرسال' }).click();
  await expect(page.getByText('اسمك مطلوب')).toBeVisible();
  await page.getByLabel('اسمك').fill('عمر فاروق');
  await page.getByLabel('الهاتف').fill('+20 100 555 0101');
  await page.getByLabel('بعد الظهر').check();
  await screen(page, 'script-arabic');
  await page.getByRole('button', { name: 'إرسال' }).click();
  await expect.poll(() => page.evaluate(() => (window as any).fieldiaDemo.dataSource.responses.length)).toBe(1);
  expect(warnings).toEqual([]);
  expect(problems).toEqual([]);
});

test('in German and French with their scripts', async ({ page }) => {
  const { problems, warnings } = watch(page);
  for (const [locale, submit, required] of [
    ['de', 'Absenden', 'Ihr Name ist erforderlich'],
    ['fr', 'Envoyer', 'Votre nom est obligatoire'],
  ]) {
    await page.goto(`/script/?locale=${locale}`);
    await expect(page.locator('.fd-form')).toHaveAttribute('lang', locale);
    await page.getByRole('button', { name: submit }).click();
    await expect(page.getByText(required)).toBeVisible();
  }
  expect(warnings).toEqual([]);
  expect(problems).toEqual([]);
});

test('in Arabic without its script: English words, right to left still, and one warning naming the script to add', async ({ page }) => {
  const { problems, warnings } = watch(page);
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  // The demo in English, shown again in Arabic, twice over: fieldia.ar.js was never loaded.
  await page.evaluate(() => {
    const demo = (window as any).fieldiaDemo;
    const fieldia = (window as any).Fieldia;
    const app = document.getElementById('app') as HTMLElement;
    for (let i = 0; i < 2; i++) {
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(app, { page: demo.page, dataSource: demo.dataSource, skin: 'outlined', locale: 'ar' });
    }
  });
  await expect(page.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
  // The page's own words in Arabic, as it keeps them; Fieldia's in English.
  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByText('اسمك is required')).toBeVisible();
  await screen(page, 'script-arabic-without-its-script');
  expect(warnings).toHaveLength(1);
  expect(warnings[0]).toContain('<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.ar.js"></script>');
  expect(problems).toEqual([]);
});
