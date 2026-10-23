import { type Locator } from '@playwright/test';
import { expect, test } from './fixtures';
import { open, screen } from './support';

/**
 * Every value a person typed reads in its own direction, wherever Fieldia shows it: an English note on an Arabic or
 * Persian order ends with its full stop, never starts with it — in the table's cells, on a phone's cards, in a box typed
 * in, and on paper — lined up with the page. One rule: `unicode-bidi: plaintext` (or `<bdi>`, `dir="auto"`) on what holds
 * a typed value, its side the page's.
 */

/** Where a text's first letter and its last character stand, left to right, in the element that shows them. */
async function ends(locator: Locator, text: string): Promise<{ first: number; last: number }> {
  return locator.evaluate((element, wanted) => {
    const walker = element.ownerDocument.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let at = walker.nextNode(); at; at = walker.nextNode()) {
      const index = at.textContent?.indexOf(wanted) ?? -1;
      if (index < 0) continue;
      const box = (from: number) => {
        const range = element.ownerDocument.createRange();
        range.setStart(at as Text, from);
        range.setEnd(at as Text, from + 1);
        return range.getBoundingClientRect().left;
      };
      return { first: box(index), last: box(index + wanted.length - 1) };
    }
    throw new Error(`"${wanted}" is not shown`);
  }, text);
}

const NOTE = 'Warm white only, to match the reception.';

for (const locale of ['ar', 'fa'] as const) {
  test.describe(`an order in ${locale}, right to left`, () => {
    test('an English note in the table reads left to right, its full stop at its end', async ({ page }) => {
      await open(page, 'plain', `page=order&skin=outlined&locale=${locale}&dir=rtl`);
      const note = page.locator('.ag-cell', { hasText: 'Warm white only' }).first();
      await expect(note).toBeVisible();
      const { first, last } = await ends(note, NOTE);
      expect(last).toBeGreaterThan(first);
      await note.scrollIntoViewIfNeeded();
      await screen(page, `typed-direction-${locale}-table`, { viewport: true });
    });

    test('on a phone’s cards too', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await open(page, 'plain', `page=order&skin=outlined&locale=${locale}&dir=rtl`);
      const note = page.locator('.fd-line-card', { hasText: 'Warm white only' }).first();
      await note.scrollIntoViewIfNeeded();
      const { first, last } = await ends(note, NOTE);
      expect(last).toBeGreaterThan(first);
      await screen(page, `typed-direction-${locale}-cards`, { viewport: true });
    });
  });
}

test('a box typed in on an Arabic page keeps an English sentence’s order, lined up with the page', async ({ page }) => {
  await open(page, 'plain', 'page=customer&skin=outlined&locale=ar&dir=rtl');
  const box = page.locator('.fd-field[data-type="char"] input.fd-input:visible, .fd-field[data-type="text"] textarea:visible').first();
  await box.fill('Call before noon.');
  expect(await box.evaluate((element) => [getComputedStyle(element).unicodeBidi, getComputedStyle(element).textAlign])).toEqual(['plaintext', 'right']);
});

