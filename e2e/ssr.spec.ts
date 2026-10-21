import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A form drawn by the server first (demos/ssr: the page sent with `firstPaint` from @fieldia/viewer/server in it, as
 * Next or Nuxt send it), then made live in the browser: the first paint is there, with its values and Fieldia's look,
 * before any script has run; a person types in it; the live form takes its place in one step — never a blank — with
 * what was typed, the focus and the caret where they were.
 */
test('a first paint from the server is there before any script, and the live form takes its place keeping what was typed', async ({ page }) => {
  // The page's script held back, as a slow phone holds it: the first paint is all there is meanwhile.
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route('**/ssr/main.js', async (route) => {
    await held;
    await route.continue();
  });
  // Whether a form is in sight in #app at every change to it: a blank between the first paint and the live form would show here.
  await page.addInitScript(() => {
    const seen: boolean[] = [];
    Object.assign(window, { formInSight: seen });
    // As the page is read, before its (deferred) script runs.
    document.addEventListener('readystatechange', () => {
      if (document.readyState !== 'interactive') return;
      const app = document.getElementById('app') as HTMLElement;
      const look = () => seen.push([...app.querySelectorAll<HTMLElement>('.fd-form')].some((form) => getComputedStyle(form).display !== 'none' && form.getBoundingClientRect().height > 0));
      look();
      new MutationObserver(look).observe(app, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden', 'class'] });
    });
  });
  // A module script holds back DOMContentLoaded: the page is there once it is read.
  await page.goto('/ssr/', { waitUntil: 'commit' });
  const first = page.locator('[data-fd-first-paint]');
  await expect(first).toBeVisible();
  await expect(first.locator('.fd-page-title')).toHaveText('Property enquiry');
  await expect(first.locator('[data-field="name"] input')).toHaveValue('Nile Traders');
  await expect(first.locator('[data-field="kind"] select')).toHaveValue('villa');
  await expect(first.locator('[data-field="garden"] input')).toBeChecked();
  // An office has no bedrooms, a villa has: the page's own rules, run on the server.
  await expect(first.locator('[data-field="bedrooms"] input')).toHaveValue('4');
  await expect(first.locator('[data-field="notes"] textarea')).toHaveValue('Near a school, please.');
  // Fieldia's look, from the server's own <style>: no script has run.
  expect(await first.locator('.fd-form').evaluate((form) => getComputedStyle(form).getPropertyValue('--fd-accent').trim())).not.toBe('');

  // A person types in the first paint before the page's script has come.
  const email = first.locator('[data-field="email"] input');
  await email.click();
  await email.pressSequentially('sales@niletraders.example');
  await first.locator('[data-field="garden"] input').uncheck();
  await email.click();
  await email.press('End');

  release();
  await expect(first).toHaveCount(0);
  const live = page.locator('#app > .fd-form');
  await expect(live).toBeVisible();
  // What was typed is in the live box, and the form has it; the unticked box too; the focus is where it was.
  await expect(live.locator('[data-field="email"] input')).toHaveValue('sales@niletraders.example');
  await expect(live.locator('[data-field="email"] input')).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { fieldiaDemo: { handle: { form: { getState(): { values: Record<string, unknown> } } } } }).fieldiaDemo.handle.form.getState().values))
    .toMatchObject({ email: 'sales@niletraders.example', garden: false, name: 'Nile Traders' });
  await expect(live.locator('[data-field="name"] input')).toHaveValue('Nile Traders');
  // Never a blank: at every change, a form was in sight.
  expect(await page.evaluate(() => (window as unknown as { formInSight: boolean[] }).formInSight.filter((one) => !one).length)).toBe(0);
  await screen(page, 'ssr-live');
});

test('the first paint alone, with no script at all: the form with its values, in Fieldia’s look', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/ssr/');
  const first = page.locator('[data-fd-first-paint]');
  await expect(first.locator('[data-field="name"] input')).toHaveValue('Nile Traders');
  await expect(first.locator('[data-field="budget"] input')).not.toHaveValue('');
  await expect(first.locator('.fd-section-title').first()).toHaveText('Who is asking');
  // Laid out by Fieldia's sheet from the server: two columns, as the live form draws them.
  const [name, email] = await Promise.all(['name', 'email'].map((field) => first.locator(`[data-field="${field}"]`).boundingBox()));
  expect(Math.abs((name?.y ?? 0) - (email?.y ?? 1))).toBeLessThan(2);
  // No script to settle a page with: the shot as it stands.
  const engine = test.info().project.name;
  await page.screenshot({ path: `test-results/screens/${engine === 'chromium' ? '' : `${engine}/`}ssr-first-paint.png`, fullPage: true });
  await context.close();
});
