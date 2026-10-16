import { expect, test } from './fixtures';
import { open } from './support';

/**
 * A list's custom filter: a number pasted that is no number ("1e5") is refused, the words under the box (input rules
 * §3, Paste). Then Apply is pressed. Leaving the box takes those words away (the guard's blur), the row of the
 * filter grows shorter under the pointer, and Apply moves: the press ends on the list behind it, and the click never
 * reaches Apply — nothing is applied and nothing is said ("Enter a number" never comes). The same press with the box
 * left empty says it at once. A press on Apply must always be Apply's.
 */

test.describe.configure({ mode: 'default' });

test('Apply pressed once after a refused paste is Apply’s: it says what goes there', async ({ page, context, browserName }) => {
  // Firefox and WebKit grant no clipboard to a test: the paste is sent as the browser sends one, with its text.
  const real = browserName === 'chromium';
  if (real) await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const { problems } = await open(page, 'plain', 'page=map-homes&skin=underline');
  await page.locator('.fd-search-toggle').first().click();
  await page.locator('.fd-search-add').first().click();
  const form = page.locator('.fd-custom-filter:visible');
  await form.locator('select').first().selectOption('bedrooms');
  await form.locator('select').nth(1).selectOption('=');
  const value = form.locator('.fd-custom-filter-value input');
  await value.click();
  if (real) {
    await page.evaluate(() => navigator.clipboard.writeText('1e5'));
    await value.press('Control+V');
  } else {
    await value.evaluate((box) => {
      const paste = new Event('paste', { bubbles: true, cancelable: true });
      Object.defineProperty(paste, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? '1e5' : '') } });
      box.dispatchEvent(paste);
    });
  }
  const hint = form.locator('.fd-refusal-hint');
  await expect(hint).toContainText('1e5');
  const clicked: string[] = [];
  await page.exposeFunction('clickedOn', (what: string) => clicked.push(what));
  await page.evaluate(() => document.addEventListener('click', (event) => (window as any).clickedOn((event.target as Element).className), true));
  await form.locator('.fd-button-primary').click();
  await expect(hint, 'Apply ran, and says what goes there').toHaveText('Enter a number');
  expect(clicked).toEqual(['fd-button fd-button-primary']);
  expect(problems).toEqual([]);
});
