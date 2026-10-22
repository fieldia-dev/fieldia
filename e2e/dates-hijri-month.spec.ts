import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A Saudi lease (the lease demo): its days shown and typed in the Hijri calendar, by Umm al-Qura's reckoning as each
 * engine's Intl keeps it, beside the Gregorian day they keep; its first rent's month a month alone; the building's year
 * a year alone — typed, picked and refused as a person meets them, in English and in Arabic right to left.
 */

const NOW = '2026-10-21T09:00:00';
const held = (page: import('@playwright/test').Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name] as string | null, field);

test.describe('dates of a month, a year, and the Hijri calendar', () => {
  test('a Hijri day typed beside its Gregorian, each following the other', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=lease&skin=underline&now=${NOW}`);
    const starts = node(page, 'f-starts');
    const day = starts.locator('input.fd-date').first();
    const hijri = starts.locator('input[data-kind="hijri"]');
    // The record's 13 October 2026, and its Hijri day beside it.
    await expect(day).toHaveValue('13 Oct 2026');
    await expect(hijri).toHaveValue('2 Jumada I 1448 AH');
    await expect(hijri).toHaveAttribute('aria-label', 'Starts on (Hijri)');

    // Typed in the Hijri box: the Gregorian day follows once its year is whole.
    await hijri.click();
    await expect(hijri).toHaveValue('02/05/1448');
    await page.keyboard.press('Control+A');
    await page.keyboard.type('01/06/1448');
    await page.keyboard.press('Tab');
    const first = await held(page, 'starts_on');
    expect(first).toMatch(/^2026-11-1\d$/);
    await expect(hijri).toHaveValue(/^1 Jumada II 1448 AH$/);
    await expect(day).not.toHaveValue('13 Oct 2026');

    // A day its Hijri month has not: said, the field holding its day, the Gregorian box showing it.
    const days = await page.evaluate(() => {
      const format = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { day: 'numeric', month: 'numeric', year: 'numeric', timeZone: 'UTC' });
      // The first month of 1448 AH that Umm al-Qura gives 29 days.
      const longest = new Map<number, number>();
      for (let at = Date.UTC(2026, 4, 1); at < Date.UTC(2027, 6, 1); at += 86_400_000) {
        const part = (type: string) => Number(format.formatToParts(at).find((p) => p.type === type)?.value);
        if (part('year') === 1448) longest.set(part('month'), Math.max(longest.get(part('month')) ?? 0, part('day')));
      }
      return [...longest].find(([, most]) => most === 29)?.[0] ?? 0;
    });
    expect(days).toBeGreaterThan(0);
    await hijri.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type(`30/${String(days).padStart(2, '0')}/1448`);
    await page.keyboard.press('Tab');
    await expect(starts.locator('.fd-error, [role="alert"]').first()).toContainText('has 29 days');
    await expect(hijri).toHaveAttribute('aria-invalid', 'true');
    expect(await held(page, 'starts_on')).toBe(first);
    await screen(page, 'dates-hijri-refused');
    // The Gregorian box puts it right: the Hijri box's words go.
    await day.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('15/11/2026');
    await page.keyboard.press('Tab');
    await expect(hijri).toHaveAttribute('aria-invalid', 'false');
    expect(await held(page, 'starts_on')).toBe('2026-11-15');

    // The calendar: each day with its Hijri day under it, the month with the Hijri months it spans.
    await node(page, 'f-ends').locator('.fd-calendar-button').click();
    const calendar = node(page, 'f-ends').locator('.fd-calendar');
    await expect(calendar).toBeVisible();
    await expect(calendar.locator('.fd-calendar-title')).toContainText(/October 2027 · .*1449 AH/);
    await expect(calendar.locator('button[aria-selected="true"] .fd-calendar-hijri')).toHaveText(/^\d{1,2}$/);
    await screen(page, 'dates-hijri-calendar');
    await page.keyboard.press('Escape');
    expect(problems).toEqual([]);
  });

  test('a month alone typed, picked from its year, and refused when gone by', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=lease&skin=underline&now=${NOW}`);
    const month = node(page, 'f-first-rent').locator('input.fd-date');
    await expect(month).toHaveAttribute('placeholder', 'mm/yyyy');
    await month.click();
    await page.keyboard.type('Nov 2026');
    await page.keyboard.press('Tab');
    await expect(month).toHaveValue('Nov 2026');
    expect(await held(page, 'first_rent')).toBe('2026-11-01');
    // The month of "today" is within the earliest, though its first day is gone by; the one before is not.
    await month.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('10/2026');
    await page.keyboard.press('Tab');
    expect(await held(page, 'first_rent')).toBe('2026-10-01');
    await expect(node(page, 'f-first-rent').locator('.fd-error').filter({ hasText: /\S/ })).toHaveCount(0);
    // A whole day typed: its month, the day left out said.
    await month.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('15/12/2026');
    await expect(node(page, 'f-first-rent').locator('.fd-refusal-hint')).toHaveText('First rent’s month takes a month only: the day 15 was left out');
    await page.keyboard.press('Tab');
    expect(await held(page, 'first_rent')).toBe('2026-12-01');
    await expect(month).toHaveValue('Dec 2026');
    // Its button opens the year's months; one gone by is faint, and refused with why.
    await node(page, 'f-first-rent').locator('.fd-calendar-button').click();
    const months = node(page, 'f-first-rent').locator('.fd-calendar-periods button');
    await expect(months).toHaveCount(12);
    await expect(months.nth(8)).toHaveClass(/fd-off/);
    await screen(page, 'dates-month-picker');
    await months.nth(8).click();
    await expect(node(page, 'f-first-rent').locator('.fd-calendar-note')).toHaveText('First rent’s month can’t be before Oct 2026');
    // The arrows move by a month, Enter picks.
    await months.nth(11).focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    expect(await held(page, 'first_rent')).toBe('2026-11-01');
    await expect(month).toHaveValue('Nov 2026');
    expect(problems).toEqual([]);
  });

  test('a year alone, and the whole lease in Arabic, right to left', async ({ page }) => {
    const { problems } = await open(page, 'plain', `page=lease&skin=underline&now=${NOW}&locale=ar`);
    const built = node(page, 'f-built').locator('input.fd-date');
    await expect(built).toHaveValue('2014');
    await built.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('1998');
    await page.keyboard.press('Tab');
    expect(await held(page, 'built')).toBe('1998-01-01');
    await expect(built).toHaveValue('1998');
    // The Hijri day in Arabic words, the month at rest in Arabic.
    await expect(node(page, 'f-starts').locator('input[data-kind="hijri"]')).toHaveValue('2 جمادى الأولى 1448 هـ');
    const month = node(page, 'f-first-rent').locator('input.fd-date');
    await month.click();
    await page.keyboard.type('11/2026');
    await page.keyboard.press('Tab');
    await expect(month).toHaveValue('نوفمبر 2026');
    await expect(page.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
    await screen(page, 'dates-lease-arabic');
    expect(problems).toEqual([]);
  });
});
