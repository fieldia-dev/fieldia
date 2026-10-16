import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). MINOR. The readers fold what a Japanese or Chinese keyboard
 * types in full width — its digits and its + , . % (core input-rules.ts `fullwidth`) — so "６．５" is six and a half
 * hours. Its colon is not folded: "６：３０", hours and minutes as such an IME writes them, is refused as it is composed
 * ("Time on site: numbers only"), and left in the box it says "write hours and minutes, like 6:30" — which it is.
 */

const valueOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.time_on_site as number);
const unreadOf = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().unread.time_on_site?.message ?? null);

/** An IME's composition, committed: edits a page cannot stop before they land. */
async function compose(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
  await cdp.send('Input.insertText', { text });
  await cdp.detach();
}

test.describe('hours typed in full width', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('"６：３０" composed by an IME is six and a half hours, as "６．５" is', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const box = node(page, 'f-time-on-site').locator('input.fd-number-input').first();
    await page.evaluate(() => (window as any).fieldiaDemo.handle.form.setValue('time_on_site', 1));
    await box.click();
    await box.press('Control+A');
    await compose(page, '６：３０');
    await page.keyboard.press('Tab');
    expect({ value: await valueOf(page), unread: await unreadOf(page) }).toEqual({ value: 6.5, unread: null });
  });
});
