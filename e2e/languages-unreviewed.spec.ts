import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { node, open, screen } from './support';
import { es } from '../libs/viewer/src/lib/locales/es';
import { fa } from '../libs/viewer/src/lib/locales/fa';
import { tr } from '../libs/viewer/src/lib/locales/tr';
import { ur } from '../libs/viewer/src/lib/locales/ur';

/**
 * Turkish, Persian, Urdu and Spanish (0.31): machine-assisted, not yet reviewed by a native speaker. A page in each
 * speaks Fieldia's words in it; Persian and Urdu run right to left and pass axe, as Arabic does, errors shown too; a
 * number typed in Persian digits reads; a day is written on the Gregorian calendar, in Persian too; and the one-tag
 * script takes each language's own add-on.
 */

const VIEWER = { tr, fa, ur, es };
type Values = Record<string, unknown>;
const values = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values as Values);

test.describe.configure({ timeout: 120_000 });

for (const locale of ['fa', 'ur'] as const) {
  test.describe(`a page in ${locale}, right to left`, () => {
    test('speaks its words and passes axe, at rest and with its errors shown', async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=signup&skin=outlined&locale=${locale}&dir=rtl`);
      const form = page.locator('.fd-form').first();
      await expect(form).toHaveAttribute('dir', 'rtl');
      await expect(form).toHaveAttribute('lang', locale);
      const submit = page.locator('.fd-form button[type="submit"]:visible').last();
      await expect(submit).toHaveText(VIEWER[locale].submit);
      expect(await axeFindings(page, `signup in ${locale}`)).toEqual([]);
      await submit.click();
      const error = page.locator('.fd-error:visible').first();
      await expect(error).toBeVisible();
      // In the language's own words, never English's.
      await expect(error).not.toContainText('required');
      await screen(page, `languages-${locale}-errors`, { viewport: true });
      expect(await axeFindings(page, `signup errors in ${locale}`)).toEqual([]);
      expect(problems).toEqual([]);
    });

    test('passes axe on a page of every kind of box', async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=fields&skin=outlined&locale=${locale}&dir=rtl`);
      await expect(page.locator('.fd-form').first()).toHaveAttribute('dir', 'rtl');
      await screen(page, `languages-${locale}-fields`, { viewport: true });
      expect(await axeFindings(page, `fields in ${locale}`)).toEqual([]);
      expect(problems).toEqual([]);
    });

    test('reads a number typed in Persian digits, and a day typed in them as the Gregorian day it is', async ({ page }) => {
      const { problems } = await open(page, 'plain', `page=fields&skin=outlined&locale=${locale}&dir=rtl`);
      const seats = node(page, 'f-seats').locator('input.fd-number-input').first();
      await seats.click();
      await seats.press('Control+A');
      await seats.pressSequentially('۱۲۵');
      await expect(node(page, 'f-seats').locator('.fd-refusal-hint').first()).toBeHidden();
      await page.keyboard.press('Tab');
      await expect.poll(async () => (await values(page))['seats']).toBe(125);
      await expect(seats).toHaveValue('125');
      const area = node(page, 'f-area').locator('input.fd-number-input').first();
      await area.click();
      await area.press('Control+A');
      await area.pressSequentially('۴۲٫۵');
      await page.keyboard.press('Tab');
      await expect.poll(async () => (await values(page))['area']).toBe(42.5);
      await expect(node(page, 'f-area').locator('.fd-error')).toBeHidden();
      const start = node(page, 'f-start').locator('input.fd-input').first();
      await start.click();
      await start.press('Control+A');
      await start.pressSequentially('۱۵/۱۰/۲۰۲۶');
      await page.keyboard.press('Tab');
      await expect.poll(async () => (await values(page))['start_date']).toBe('2026-10-15');
      // At rest in words, on the calendar the value is kept in: 2026, never the Solar Hijri's 1405.
      await expect(start).toHaveValue(/2026/);
      await expect(start).not.toHaveValue(/1405/);
      await screen(page, `languages-${locale}-numbers`, { viewport: true });
      expect(problems).toEqual([]);
    });
  });
}

for (const locale of ['tr', 'es'] as const) {
  test(`a page in ${locale} speaks its words, left to right, and passes axe`, async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=signup&skin=outlined&locale=${locale}`);
    const form = page.locator('.fd-form').first();
    await expect(form).toHaveAttribute('lang', locale);
    expect(await form.getAttribute('dir')).not.toBe('rtl');
    const submit = page.locator('.fd-form button[type="submit"]:visible').last();
    await expect(submit).toHaveText(VIEWER[locale].submit);
    await submit.click();
    await expect(page.locator('.fd-error:visible').first()).not.toContainText('required');
    expect(await axeFindings(page, `signup errors in ${locale}`)).toEqual([]);
    expect(problems).toEqual([]);
  });
}

test('a Turkish page writes a typed day with dots, as a German one does', async ({ page }) => {
  const { problems } = await open(page, 'plain', 'page=fields&skin=outlined&locale=tr');
  const start = node(page, 'f-start').locator('input.fd-input').first();
  await start.click();
  await start.press('Control+A');
  await start.pressSequentially('15.10.2026');
  await page.keyboard.press('Tab');
  await expect.poll(async () => (await values(page))['start_date']).toBe('2026-10-15');
  await start.click();
  await expect(start).toHaveValue('15.10.2026');
  expect(problems).toEqual([]);
});

test.describe('the one-tag script', () => {
  for (const locale of ['tr', 'fa', 'ur', 'es'] as const) {
    test(`takes ${locale}'s own add-on, fieldia.${locale}.js`, async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') problems.push(`${message.type()}: ${message.text()}`);
      });
      page.on('pageerror', (error) => problems.push(error.message));
      const addOn = page.waitForResponse((response) => response.url().endsWith(`/fieldia.${locale}.js`));
      await page.goto(`/script/?locale=${locale}`);
      expect((await addOn).status()).toBe(200);
      const form = page.locator('.fd-form');
      await expect(form).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toHaveText(VIEWER[locale].submit);
      if (locale === 'fa' || locale === 'ur') await expect(form).toHaveAttribute('dir', 'rtl');
      expect(problems).toEqual([]);
    });
  }
});

test.describe('the backlog demo, its language menu listing the four', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  for (const [locale, dir] of [['fa', 'rtl'], ['ur', 'rtl'], ['tr', 'ltr'], ['es', 'ltr']] as const) {
    test(`in ${locale}: its chrome, its list and Fieldia's words in it, ${dir}, and axe finds nothing`, async ({ page }) => {
      const problems: string[] = [];
      page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
      page.on('pageerror', (error) => problems.push(error.message));
      await page.goto(`/backlog/?locale=${locale}`);
      await expect(page.locator('.fd-list-row:visible').first()).toBeVisible();
      await expect(page.locator('#app')).toHaveAttribute('dir', dir);
      await expect(page.locator('#app')).toHaveAttribute('lang', locale);
      await screen(page, `languages-backlog-${locale}`, { viewport: true });
      expect(await axeFindings(page, `backlog in ${locale}`)).toEqual([]);
      expect(problems).toEqual([]);
    });
  }
});

test.describe('a calendar and a timeline, their words fetched in a chunk of their own', () => {
  test.use({ viewport: { width: 1280, height: 1100 } });
  for (const [query, view, body] of [
    ['page=clinic-calendar&skin=outlined&now=2026-10-14T09:40', '.fd-cal', '.fd-cal-body'],
    ['page=fitout-plan&skin=outlined&now=2026-10-14T09:40', '.fd-gantt', '.fd-gantt-body'],
  ] as const) {
    for (const [locale, today] of [['fa', 'امروز'], ['tr', 'Bugün'], ['es', 'Hoy']] as const) {
      test(`${view} in ${locale}: its own words, today’s button among them`, async ({ page }) => {
        const { problems } = await open(page, 'plain', `${query}&locale=${locale}${locale === 'fa' ? '&dir=rtl' : ''}`);
        await expect(page.locator(view)).toBeVisible();
        await expect(page.locator(body)).not.toHaveAttribute('aria-busy', 'true');
        await expect(page.locator(view).getByRole('button', { name: today, exact: true })).toBeVisible();
        if (locale === 'fa') {
          await screen(page, `languages-${view.slice(4)}-fa`, { viewport: true });
          expect(await axeFindings(page, `${view} in fa`)).toEqual([]);
        }
        expect(problems).toEqual([]);
      });
    }
  }
});
