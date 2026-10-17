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

/**
 * How a box lays its words out, read from a copy of it beside it — its own computed style, its width, its language —
 * a word to a span: the words its lines split, and how many lines it takes.
 */
const laidOut = (box: ReturnType<typeof title>) =>
  box.evaluate((area: HTMLTextAreaElement) => {
    const style = getComputedStyle(area);
    const copy = document.createElement('div');
    for (const name of Array.from(style)) copy.style.setProperty(name, style.getPropertyValue(name));
    Object.assign(copy.style, { position: 'absolute', insetBlockStart: '0', insetInlineStart: '0', visibility: 'hidden', height: 'auto', minHeight: '0', width: `${area.getBoundingClientRect().width}px` });
    for (const part of area.value.split(/(\s+)/)) copy.append(Object.assign(document.createElement('span'), { textContent: part }));
    (area.parentElement as HTMLElement).append(copy);
    const lineHeight = parseFloat(style.lineHeight);
    const split = [...copy.children].filter((span) => span.textContent?.trim() && span.getClientRects().length > 1).map((span) => span.textContent);
    const lines = Math.round((copy.getBoundingClientRect().height - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom) - parseFloat(style.borderTopWidth) - parseFloat(style.borderBottomWidth)) / lineHeight);
    copy.remove();
    return { split, lines, hyphens: style.hyphens || style.getPropertyValue('-webkit-hyphens') };
  });

/** Words people write in a long name or title: none longer than a phone's line, some a browser that hyphenates would break. */
const LONG_NAMES = [
  'Nile Delta Shipping and Logistics, Developments and International Trading Establishment for Pharmaceuticals',
  'Stock count shows 12 after releasing 3 of 15 items to order SO-2088, then Delivery confirmation pending from Alexandria',
  'Printing a pick list cuts its last line when the warehouse orders reprinting from the regional distribution manager',
];
/** One word longer than any line: a German compound, then a web address. */
const LONG_WORDS = ['Donaudampfschifffahrtsgesellschaftskapitänswitwenrentenversicherungsanstaltsverwaltung', 'https://portal.example.com/projects/warehouse/inventory/stock-counts/2026/october/SO-2088'];

test.describe('a title’s words wrap whole, in every engine', () => {
  for (const [width, height] of [[390, 844], [1440, 900]] as const) {
    for (const [what, query, id] of [
      ['a contact’s name', 'page=real-contact&record=7001&skin=underline', '#title'],
      ['a work item’s title', 'page=wi-head&open=dialog', '#title'],
    ] as const) {
      test(`${what} at ${width}px: a word that fits a line is never broken or hyphenated; one longer than the line breaks, nothing cut`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        const popup = query.includes('open=dialog');
        const problems: string[] = [];
        page.on('pageerror', (error) => problems.push(error.message));
        await page.goto(`/plain/?${query}`);
        const box = (popup ? page.getByRole('dialog') : page).locator(`[data-node="${id}"] textarea`);
        await expect(box).toBeVisible();
        for (const name of LONG_NAMES) {
          await box.fill(name);
          await expect.poll(async () => (await laidOut(box)).lines).toBeGreaterThan(width === 390 ? 2 : 0);
          expect((await laidOut(box)).split, `words of “${name}” split across lines`).toEqual([]);
        }
        // Broken only at a soft hyphen the words carry, never at one the browser picks.
        expect((await laidOut(box)).hyphens).toBe('manual');
        await box.evaluate((area) => area.scrollIntoView({ block: 'center' }));
        await screen(page, `title-words-whole-${popup ? 'head' : 'sheet'}-${width}`, { viewport: true });
        for (const [i, word] of LONG_WORDS.entries()) {
          await box.fill(`Ask ${word} again`);
          await expect.poll(() => box.evaluate((area) => area.scrollHeight <= area.clientHeight + 1 && area.scrollWidth <= area.clientWidth + 1)).toBe(true);
          const long = await laidOut(box);
          // Only the word too long for any line is broken: the short words around it stay whole.
          expect(long.split.every((split) => split === word), `${long.split.join(', ')} split`).toBe(true);
          await box.evaluate((area) => area.scrollIntoView({ block: 'center' }));
          await screen(page, `title-long-word-${i + 1}-${popup ? 'head' : 'sheet'}-${width}`, { viewport: true });
        }
        expect(problems).toEqual([]);
      });
    }
  }
});
