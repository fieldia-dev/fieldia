import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Undo and Redo while filling, as a person presses them: Ctrl+Z (⌘Z) takes back the record's last change across
 * fields, Ctrl+Shift+Z makes it again; inside a box typed in, the browser's own undo goes through what was typed there
 * first — each engine's own — and the record's once it has taken it all back.
 */
test.describe('plain · undo while filling', () => {
  test('takes back a field changed, from the next field, the field taking the focus; and makes it again', async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined');
    const name = node(page, 'f-name').locator('input');
    const was = await name.inputValue();
    await name.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' B');
    await page.keyboard.press('Tab');
    await node(page, 'f-email').locator('input').focus();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(name).toHaveValue(was);
    await expect(name).toBeFocused();
    await expect(page.locator('.fd-undo-heard')).toHaveText('Undone: Project');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(name).toHaveValue(`${was} B`);
    await screen(page, 'undo-redone', { viewport: true });
  });

  test('a Ctrl+Z pressed while the undo part is on its way is the record’s, taken as the part comes', async ({ page }) => {
    // Asked for as the person first enters the form, the part can still be on its way at the first Ctrl+Z (a slow
    // network, a busy phone): the key is the record's all the same, never the browser's own, which takes back the last
    // typing on the page — the B alone, in the box left — and moves there.
    let arrive!: () => void;
    const onItsWay = new Promise<void>((resolve) => (arrive = resolve));
    await page.route(/\/chunks\/undo-part-[^/]+\.js$/, async (route) => {
      await onItsWay;
      await route.continue();
    });
    await open(page, 'plain', 'page=fields&skin=outlined');
    const name = node(page, 'f-name').locator('input');
    const email = node(page, 'f-email').locator('input');
    const was = await name.inputValue();
    await name.click();
    await page.keyboard.press('End');
    await page.keyboard.type(' B');
    await page.keyboard.press('Tab');
    await email.focus();
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForTimeout(300);
    await expect(name).toHaveValue(`${was} B`);
    await expect(email).toBeFocused();
    arrive();
    await expect(name).toHaveValue(was);
    await expect(name).toBeFocused();
    await expect(page.locator('.fd-undo-heard')).toHaveText('Undone: Project');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(name).toHaveValue(`${was} B`);
  });

  test("in a box typed in, the browser's own undo first, then the record's: a tick taken back", async ({ page }) => {
    await open(page, 'plain', 'page=fields&skin=outlined');
    const signed = node(page, 'f-signed').locator('input');
    const ticked = await signed.isChecked();
    await signed.click();
    await expect(signed).toBeChecked({ checked: !ticked });
    const email = node(page, 'f-email').locator('input');
    const was = await email.inputValue();
    await email.click();
    await page.keyboard.press('End');
    await page.keyboard.type('x');
    await expect(email).toHaveValue(`${was}x`);
    // The browser's own: the letter typed goes, the tick stays.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(email).toHaveValue(was);
    await expect(signed).toBeChecked({ checked: !ticked });
    // Nothing left of it there: the record's, the tick taken back.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(signed).toBeChecked({ checked: ticked });
    await expect(email).toHaveValue(was);
  });
});

test.describe('plain · undo through a money box', () => {
  test('its own undo, then the notes taken back and made again: Ctrl+Shift+Z makes the price again, as typed', async ({ page }) => {
    // The how-to replay of 0.35 (a course, step 2): after the price's own undo and the notes taken back and made again,
    // Ctrl+Shift+Z was the browser's, whose history put "11000" after the price grouped as it was left —
    // "9,500.0011000", "takes at most 2 decimal places", and Mark done refused after it.
    const { problems } = await open(page, 'plain', 'page=treatment-course&record=1&skin=outlined');
    const notes = page.getByRole('textbox', { name: 'Notes' });
    const price = page.getByRole('textbox', { name: 'Course price' });
    const was = await notes.inputValue();
    await notes.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('Moved to Thursdays.');
    await price.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('11000');
    // Its own undo, each engine's: the price as it was.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(price).toHaveValue(/^9,?500\.00$/);
    await expect(notes).toHaveValue('Moved to Thursdays.');
    // The record's: the notes back, then made again.
    await page.keyboard.press('ControlOrMeta+z');
    await expect(notes).toHaveValue(was);
    await expect(price).toHaveValue('9,500.00');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(notes).toHaveValue('Moved to Thursdays.');
    // The price made again, as it was typed — the record's Redo, the price's box written whole.
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(price).toHaveValue(/^11,?000\.00$/);
    await expect(notes).toHaveValue('Moved to Thursdays.');
    // Nothing left to make again: nothing is, the browser's own kept out of it.
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await expect(price).toHaveValue(/^11,?000\.00$/);
    await expect(notes).toHaveValue('Moved to Thursdays.');
    await page.keyboard.press('Tab');
    await expect(price).toHaveValue('11,000.00');
    await screen(page, 'undo-money-box-redone', { viewport: true });
    expect(await page.evaluate(() => (window as any).fieldiaDemo.handle.form.getState().values.price)).toBe(11000);
    await page.locator('[data-node="b-done"]').click();
    await expect(page.locator('.fd-say').filter({ hasText: 'Course marked done' })).toBeVisible();
    await expect(page.locator('.fd-statusbar [aria-current="step"]')).toHaveText('Done');
    await expect(page.getByText('Check: Course price')).toHaveCount(0);
    expect(problems).toEqual([]);
  });
});

test.describe('plain · undo after Save', () => {
  test('Ctrl+Z right after Save takes nothing back, and says nothing changed since it was saved', async ({ page }) => {
    // The owner's walk of 0.31: the course's price saved, then Ctrl+Z brought the old price back as a change not saved.
    await open(page, 'plain', 'page=treatment-course&record=1&skin=outlined');
    const price = page.locator('#fd1-f-price');
    await price.click();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('11000');
    await page.keyboard.press('Tab');
    await page.getByRole('button', { name: /^Save/ }).first().click();
    await expect(page.locator('.fd-form').first().getByText('Saved', { exact: true })).toBeVisible();
    await page.locator('.fd-form').first().click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.getByText('Nothing to undo since it was saved.')).toBeVisible();
    await expect(price).toHaveValue('11,000.00');
    await expect(page.getByText('Saved, but not all your changes.')).toHaveCount(0);
    await screen(page, 'undo-after-save', { viewport: true });
    // A change after it is taken back as any is.
    const notes = node(page, 'f-notes').locator('textarea, input').first();
    await notes.click();
    await page.keyboard.type(' Bring the consent form.');
    // Left for the form round it, as after Save: the notes are the page's last box, and Tab from it leaves Firefox's
    // page for the browser's own bar, the box still the page's focus — its own undo, not the record's.
    await page.locator('.fd-form').first().click({ position: { x: 5, y: 5 } });
    await page.keyboard.press('ControlOrMeta+z');
    await expect(price).toHaveValue('11,000.00');
    await expect(page.locator('.fd-undo-heard')).toHaveText(/^Undone: /);
  });
});
