import { type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open } from './support';

/**
 * Found by the 0.23 input-rules check (number boxes). MINOR. An edit the guard cannot stop before it lands — an IME's
 * letters, an autocorrection, a phone keyboard's key — is put back by writing the box's value (input-rules.ts
 * `putBack`: `box.value = taken.value`). Writing the value empties the browser's undo history, so Ctrl+Z no longer takes
 * back what was typed before: "12" typed, then an IME's "ab" put back and taken away, and Ctrl+Z leaves "12" — when no IME
 * came in between, Ctrl+Z takes the "2" back. The guard's own insertions keep the history ("the browser's own undo keeps
 * it where it can", `insert`); its put back does not.
 */

const seatsValue = (page: Page) => page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.seats as number);

/** An IME's composition, committed: edits a page cannot stop before they land. */
async function compose(page: Page, text: string) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Input.imeSetComposition', { text, selectionStart: text.length, selectionEnd: text.length });
  await cdp.send('Input.insertText', { text });
  await cdp.detach();
}

test.describe('Ctrl+Z after the guard put an edit back', () => {
  let problems: string[] = [];
  test.afterEach(() => expect(problems).toEqual([]));

  test('the last key typed is taken back by Ctrl+Z, an IME’s letters refused in between or not', async ({ page }) => {
    ({ problems } = await open(page, 'plain', 'page=fields&skin=outlined'));
    const seats = node(page, 'f-seats').locator('input.fd-number-input').first();
    // With nothing put back: Ctrl+Z takes the "2" back, as a browser's box does.
    await seats.click();
    await seats.press('Control+A');
    await seats.pressSequentially('12');
    await seats.press('Control+Z');
    await expect(seats).toHaveValue('1');
    expect(await seatsValue(page)).toBe(1);
    // An IME's letters in between, refused and taken back with Backspace: Ctrl+Z still takes the "2" back.
    await seats.press('Control+A');
    await seats.pressSequentially('12');
    await compose(page, 'ab');
    await expect(seats).toHaveValue('12');
    await seats.press('Backspace');
    await seats.press('Backspace');
    await expect(seats).toHaveValue('12');
    await seats.press('Control+Z');
    await expect(seats).toHaveValue('1');
  });
});
