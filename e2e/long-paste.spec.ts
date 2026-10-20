import { type Locator, type Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { node, open, screen } from './support';

/**
 * A long paste is one problem, said once, plainly. An email thread pasted
 * into "Anything we should arrange …" (at most 500 characters) is kept whole;
 * its count stays a count ("2401 / 500", in the error colour), and the field
 * says once, under its box, what is wrong and what to do — the same words
 * Save would use, and nothing beside the count says it again.
 */

async function paste(page: Page, box: Locator, text: string) {
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await box.press('Control+V');
}

test.describe('a paste past a field’s most', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'the clipboard is Chromium’s here');
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  });

  test('event registration: one message for one problem, the count a count', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=template-event-registration&theme=material');
    const access = node(page, 'f-access');
    const box = access.locator('textarea');
    await box.click();
    const thread = 'This is a very long note pasted from an email thread. '.repeat(45).slice(0, 2401);
    await paste(page, box, thread);
    await expect(box).toHaveValue(thread);
    await expect(access.locator('.fd-count')).toHaveText('2401 / 500');
    await expect(access.locator('.fd-count')).toHaveClass(/fd-count-past/);
    const said = '“Anything we should arrange for you to take part?” is 1901 characters too long: shorten it to 500';
    await expect(access.locator(':scope > .fd-error')).toHaveText(said);
    // Said once: no other words in the field name how far over it is.
    await expect(access.getByText(/1901/)).toHaveCount(1);
    // Submit says the same, once, with the rest of what the form needs.
    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(access.locator(':scope > .fd-error')).toHaveText(said);
    await expect(access.getByText(/1901/)).toHaveCount(1);
    await access.scrollIntoViewIfNeeded();
    await screen(page, 'long-paste-one-message', { viewport: true });
    // Shortened, the words follow it; within its most, they go.
    await box.click();
    await box.press('Control+End');
    for (let i = 0; i < 2; i++) await box.press('Backspace');
    await expect(access.locator(':scope > .fd-error')).toHaveText(said.replace('1901', '1899'));
    await page.evaluate(() => {
      const handle = (window as any).fieldiaDemo.handle;
      handle.form.setValue('access', 'A ramp at the entrance, please.');
    });
    await expect(access.locator(':scope > .fd-error')).toBeHidden();
    await expect(access.locator('.fd-count')).toHaveText('31 / 500');
    expect(problems).toEqual([]);
  });
});
