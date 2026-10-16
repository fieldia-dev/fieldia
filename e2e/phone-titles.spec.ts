import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * On a phone a record's title wraps rather than being cut: "Patient Monitor
 * …" reads whole on two lines, never "Patien…"; a contact's name reads from
 * its start, never only its end ("Developments"); an employee's name and job
 * title the same. It is one line all the same: Enter saves, and a line break
 * pasted into it is a space.
 */

const title = (page: Page, id = '#title') => node(page, id).locator('textarea');
const value = (page: Page, name: string) => page.evaluate((n) => (window as any).fieldiaDemo.handle.form.getState().values[n], name);

/** Whether all of a box's words show: nothing scrolled out of sight, sideways or down, and it reads from its start. */
const whole = (page: Page, id = '#title') =>
  title(page, id).evaluate((box: HTMLTextAreaElement) => ({
    cut: box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1,
    fromStart: box.scrollLeft === 0 && box.scrollTop === 0,
    lines: Math.round(box.clientHeight / parseFloat(getComputedStyle(box).lineHeight)),
  }));

test.describe('a record’s title on a phone', () => {
  test.skip(({ browserName }) => browserName === 'firefox', 'Firefox in Playwright has no isMobile');

  for (const [what, query, fields] of [
    ['a product', 'page=real-product&record=7301&skin=underline', [['#title', 'name']]],
    ['a contact', 'page=real-contact&record=7001&skin=underline', [['#title', 'name']]],
    ['an employee', 'page=real-employee&record=4122&skin=underline', [['#title', 'name'], ['#subtitle', 'job_title']]],
  ] as const) {
    test(`${what}: wraps, read from its start, never cut`, async ({ browser }) => {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
      const page = await context.newPage();
      const { problems } = await open(page, 'plain', query);
      for (const [id, field] of fields) {
        const box = title(page, id);
        await expect(box).toHaveValue(String(await value(page, field)));
        await expect.poll(() => whole(page, id).then((w) => w.cut)).toBe(false);
        expect((await whole(page, id)).fromStart).toBe(true);
        await expect(box).toHaveAttribute('aria-multiline', 'false');
      }
      await node(page, '#title').scrollIntoViewIfNeeded();
      await screen(page, `phone-title-${what.replace(/\W+/g, '-')}`, { viewport: true });
      expect(problems).toEqual([]);
      await context.close();
    });
  }

  test('a long name runs onto a second line, and a third, as it is typed', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    await open(page, 'plain', 'page=real-contact&record=7001&skin=underline');
    const box = title(page);
    await box.tap();
    await page.keyboard.press('End');
    await page.keyboard.type(' for Real Estate and Developments');
    await expect.poll(() => whole(page).then((w) => w.lines)).toBeGreaterThanOrEqual(2);
    expect((await whole(page)).cut).toBe(false);
    await context.close();
  });
});

test.describe('a record’s title is one line', () => {
  test('Enter saves it, as in any one-line box; a pasted line break is a space', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=customer&skin=underline');
    const box = title(page);
    await box.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Ltd');
    await page.keyboard.press('Enter');
    await expect(page.locator('.fd-status')).toHaveText('Saved');
    await expect(box).toHaveValue('Nile Traders Ltd');
    await box.fill('');
    await box.evaluate((area: HTMLTextAreaElement) => {
      area.value = 'Nile\nTraders';
      area.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    });
    await expect(box).toHaveValue('Nile Traders');
    expect(await value(page, 'name')).toBe('Nile Traders');
    expect(problems).toEqual([]);
  });
});
