import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * Boxes typed to a shape on the lease demo: the tenant's national ID, IBAN and car plate typed to their masks — the
 * mask's own characters written in, a key that does not fit refused with why, what is not whole yet kept with how many
 * are still to type — and the code sent to the tenant's phone in a box for each digit, typed, pasted whole, and
 * filled by the browser as an SMS's code is, in every engine.
 */

/** A paste, as the browser sends one: the box's own rules lay it out or refuse it. */
const paste = (box: import('@playwright/test').Locator, text: string) =>
  box.evaluate((el, pasted) => {
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { getData: () => pasted, types: ['text/plain'] } });
    el.dispatchEvent(event);
  }, text);
const held = (page: import('@playwright/test').Page, field: string) => page.evaluate((name) => (window as any).fieldiaDemo.handle.form.getState().values[name] as string | null, field);

test.describe('masks and a one-time code', () => {
  test('a national ID, an IBAN and a plate typed to their masks', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lease&skin=underline&now=2026-10-21T09:00:00');
    const id = node(page, 'f-national-id').locator('input');
    await expect(id).toHaveValue('1 023 456 789');
    await expect(id).toHaveAttribute('placeholder', '_ ___ ___ ___');
    await id.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('2104');
    await expect(id).toHaveValue('2 104 ');
    // A letter where a digit goes: refused, and said under the box.
    await page.keyboard.type('x');
    await expect(id).toHaveValue('2 104 ');
    await expect(node(page, 'f-national-id').locator('.fd-refusal-hint')).toHaveText(/Tenant’s national ID: a digit goes here, not “.?x.?”/);
    await page.keyboard.press('Backspace');
    await page.keyboard.type('55');
    await page.keyboard.press('Tab');
    // Not whole yet: kept as typed, with how many are still to type; the field holds what it held.
    await expect(node(page, 'f-national-id').locator('.fd-error')).toHaveText('Tenant’s national ID is not whole yet: 4 more to type');
    expect(await held(page, 'national_id')).toBe('1023456789');
    await id.click();
    await page.keyboard.press('End');
    await page.keyboard.type('6789');
    await page.keyboard.press('Tab');
    expect(await held(page, 'national_id')).toBe('2104556789');
    await expect(id).toHaveValue('2 104 556 789');

    // An IBAN pasted in small letters, with its groups: written in capitals, kept without its spaces.
    const iban = node(page, 'f-iban').locator('input');
    await iban.click();
    await page.keyboard.press('Control+A');
    await paste(iban, 'sa44 2000 0001 2345 6789 1234');
    await expect(iban).toHaveValue('SA44 2000 0001 2345 6789 1234');
    expect(await held(page, 'iban')).toBe('SA4420000001234567891234');

    // A plate typed as it comes: its space written in, its letters in capitals, kept as shown.
    const plate = node(page, 'f-plate').locator('input');
    await plate.click();
    await page.keyboard.type('4821rka');
    await expect(plate).toHaveValue('4821 RKA');
    expect(await held(page, 'plate')).toBe('4821 RKA');
    await screen(page, 'masks-lease');
    expect(problems).toEqual([]);
  });

  test('a one-time code typed, pasted whole, and left unfinished', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lease&skin=underline&now=2026-10-21T09:00:00');
    const code = node(page, 'f-code');
    const box = code.locator('input');
    await expect(code.locator('.fd-code-cell')).toHaveCount(6);
    await expect(box).toHaveAttribute('autocomplete', 'one-time-code');
    await expect(box).toHaveAttribute('inputmode', 'numeric');
    // A press on the first box: the text box over the boxes takes it, the caret at that box.
    await code.scrollIntoViewIfNeeded();
    const first = (await code.locator('.fd-code-cell').nth(0).boundingBox())!;
    await page.mouse.click(first.x + first.width / 2, first.y + first.height / 2);
    await page.keyboard.type('48');
    await expect(code.locator('.fd-code-cell').nth(1)).toHaveText('8');
    await expect(code.locator('.fd-code-cell').nth(2)).toHaveClass(/fd-code-caret/);
    await page.keyboard.type('a');
    await expect(code.locator('.fd-refusal-hint')).toHaveText(/the code is digits only/);
    // Backspace takes back the key held; left at two digits — the last box of the page, left by a press elsewhere — it
    // says how many are still to type.
    await page.keyboard.press('Backspace');
    await node(page, 'f-tenant').locator('input').click();
    await expect(code.locator('.fd-error')).toHaveText('Code sent to the tenant’s phone is not whole yet: 4 more to type');
    await screen(page, 'code-unfinished');
    // Pasted whole, with its space: across the boxes at once, taken.
    await box.click();
    await page.keyboard.press('Control+A');
    await paste(box, '482 913');
    await expect(code.locator('.fd-code-cell')).toHaveText(['4', '8', '2', '9', '1', '3']);
    expect(await held(page, 'confirm_code')).toBe('482913');
    await screen(page, 'code-whole');
    expect(problems).toEqual([]);
  });

  test('a code filled by the browser, as an SMS’s is, and digits typed in Arabic', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lease&skin=underline&locale=ar&now=2026-10-21T09:00:00');
    const box = node(page, 'f-code').locator('input');
    // Autofill writes the whole code at once, with no key: read as a paste of all the box holds.
    await box.focus();
    await page.evaluate(() => {
      const input = document.querySelector('[data-node="f-code"] input') as HTMLInputElement;
      input.value = '١٢٣٤٥٦';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect(node(page, 'f-code').locator('.fd-code-cell')).toHaveText(['1', '2', '3', '4', '5', '6']);
    expect(await held(page, 'confirm_code')).toBe('123456');
    // An ID reads left to right on a right-to-left page, its groups in the order they are written.
    const id = node(page, 'f-national-id').locator('input');
    await expect(id).toHaveAttribute('dir', 'ltr');
    await expect(id).toHaveCSS('text-align', 'right');
    // The boxes run left to right whatever the page's direction, as a code is read.
    const [first, last] = await node(page, 'f-code').locator('.fd-code-cell').evaluateAll((cells) => [cells[0].getBoundingClientRect().left, cells[5].getBoundingClientRect().left]);
    expect(first).toBeLessThan(last);
    await screen(page, 'code-arabic');
    expect(problems).toEqual([]);
  });
});
