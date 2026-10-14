import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Fieldia's own date box, its calendar and a range of dates come in the date
 * part, loaded the first time a page shows a date (parts.ts in
 * @fieldia/widgets), and typed and pasted as a person does the moment the page
 * is there — in English, Arabic right to left with Arabic digits, and French.
 *
 * From one <script> tag: a page with no date asks for no file but fieldia.js; a
 * page with one asks for fieldia.date.js beside it, and is drawn whole once it
 * came — nothing of it before, so nothing moves and no focus is lost. As an
 * app's bundler builds it (the plain demo, each part a chunk): a page with no
 * date asks for no date chunk; one with a date asks for it once.
 */

const VISIT = {
  fieldia: '0.1',
  id: 'visit',
  title: 'Book a visit',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, day: { type: 'date', label: 'Day' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-day', field: 'day' }] }],
  },
};

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

/** Keys pressed through the browser's own input pipeline (CDP keyDown with text), as an Arabic keyboard sends them. */
async function keyDown(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  for (const char of [...text]) {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char, key: char });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: char });
  }
  await cdp.detach();
}

const dayHeld = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.day as string | null | undefined);

test.describe('Fieldia’s own date box in a part of its own', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });
  // The clipboard is the browser's, one for every page a worker has open: these tests take turns with it.
  test.describe.configure({ mode: 'default' });

  for (const [locale, query, dir, typed, words, pasted] of [
    ['en', '', 'ltr', '15/10/2026', '15 Oct 2026', '16 Oct 2026'],
    ['ar', '?locale=ar', 'rtl', '١٥/١٠/٢٠٢٦', '15 أكتوبر 2026', '16 أكتوبر 2026'],
    ['fr', '?locale=fr', 'ltr', '15/10/2026', '15 oct. 2026', '16 oct. 2026'],
  ] as const) {
    test(`${locale}: fieldia.date.js asked for the first time a page shows a date, the page drawn whole once it came, typed and pasted at once`, async ({ page }) => {
      const problems = watch(page);
      const requested: string[] = [];
      page.on('request', (request) => requested.push(new URL(request.url()).pathname));
      const scripts = () => requested.filter((path) => /\/fieldia\.(date\.)?js$/.test(path)).sort();
      await page.goto(`/script/${query}`);
      await expect(page.locator('.fd-form')).toBeVisible();
      await page.waitForLoadState('networkidle');
      // A page with no date asked for no date part.
      expect(scripts()).toEqual(['/script/fieldia.js']);
      const drawnAtOnce = await page.evaluate(
        ([shown, lang, direction]) => {
          const fieldia = (window as any).Fieldia;
          const demo = (window as any).fieldiaDemo;
          demo.handle.destroy();
          demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: fieldia.createMemoryDataSource(), skin: 'outlined', locale: lang, dir: direction });
          return !!document.querySelector('#app [data-node]');
        },
        [VISIT, locale, dir] as const,
      );
      // Nothing of it before its part came: no plain box to type into and lose, nothing to move.
      expect(drawnAtOnce).toBe(false);
      const box = page.locator('[data-node="f-day"] input.fd-input');
      await expect(box).toBeVisible();
      expect(scripts()).toEqual(['/script/fieldia.date.js', '/script/fieldia.js']);
      await expect(page.locator('[data-node="f-day"] .fd-date-pick .fd-calendar-button')).toBeVisible();
      await expect(page.locator('#app .fd-form')).toHaveAttribute('dir', dir);

      // Typed key by key in the page's order, its digits as the person's keyboard sends them; shown in words once left.
      await box.click();
      if (locale === 'ar') await keyDown(page, typed);
      else await page.keyboard.type(typed);
      await page.keyboard.press('Tab');
      await expect(box).toHaveValue(words);
      expect(await dayHeld(page)).toBe('2026-10-15');

      // A letter is refused at the keystroke, with words under the box (the part's guard); the day stays.
      await box.click();
      await page.keyboard.press('End');
      await page.keyboard.type('x');
      await expect(box).toHaveValue('15/10/2026');
      const hint = page.locator('[data-node="f-day"] .fd-refusal-hint');
      await expect(hint).toBeVisible();
      await expect(hint).toHaveAttribute('role', 'status');
      expect((await box.getAttribute('aria-describedby'))?.split(' ')).toContain(await hint.getAttribute('id'));

      // A date as Fieldia writes it at rest, copied from somewhere else, pastes whole.
      await box.press('Control+A');
      await page.evaluate((text) => navigator.clipboard.writeText(text), pasted);
      await box.press('Control+V');
      await page.keyboard.press('Tab');
      await expect(box).toHaveValue(pasted);
      expect(await dayHeld(page)).toBe('2026-10-16');

      // Its calendar, from its button.
      await page.locator('[data-node="f-day"] .fd-calendar-button').click();
      await expect(page.locator('[data-node="f-day"] .fd-calendar')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-node="f-day"] .fd-calendar')).toBeHidden();
      // Asked for once.
      expect(scripts()).toEqual(['/script/fieldia.date.js', '/script/fieldia.js']);
      expect(problems).toEqual([]);
    });
  }

  test('as an app’s bundler builds it: a page with no date asks for no date chunk; one with a date asks for it, typed in at once', async ({ page }) => {
    const problems = watch(page);
    const dated: string[] = [];
    // The date part's chunk, named by its module (date-part.ts) as the bundler names a chunk loaded on demand.
    page.on('request', (request) => {
      const url = new URL(request.url()).pathname;
      if (/\/chunks\/date-part-[^/]+\.js$/.test(url)) dated.push(url);
    });
    await page.goto('/plain/?page=customer&skin=outlined');
    await expect(page.locator('.fd-form [data-node]').first()).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(dated).toEqual([]);
    await page.goto('/plain/?page=fields&skin=outlined');
    const start = page.locator('[data-node="f-start"] input.fd-input');
    await expect(start).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(dated).toHaveLength(1);
    await start.click();
    await start.press('Control+A');
    await page.keyboard.type('13/10/2026');
    await page.keyboard.press('Tab');
    await expect(start).toHaveValue('13 Oct 2026');
    expect(problems).toEqual([]);
  });
});
