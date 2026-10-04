import { expect, test, type Page } from '@playwright/test';
import { doubleLines, tile, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * What an app adds to the designer, used as a person uses it: the app's own
 * kind of field (an IBAN) from the toolbox, its setting, and Try it checking
 * what is typed; a template to start a blank form from, undone and another
 * picked; and the app's assistant describing a form, at a desktop's and a
 * phone's width, in English and in Arabic right to left.
 */

/** The question picked in the survey editor, open to edit. */
const picked = (page: Page) => page.locator('.fd-q-selected');

test.describe('an app’s own kind of field', () => {
  let problems: string[] = [];
  test.beforeEach(({ page }) => {
    problems = watch(page);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('in the survey: added from the toolbox, set to a country, checked in Try it', async ({ page }) => {
    await page.goto('/designer/');
    const ibanTile = tile(page, 'kind:iban');
    await expect(page.locator('.fd-tool-group[data-group="Your kinds"] .fd-tool-heading-name')).toHaveText('Your kinds');
    await ibanTile.click();
    await expect(picked(page).locator('.fd-q-label')).toBeFocused();
    await page.keyboard.type('Account for refunds');
    await expect(picked(page).getByRole('button', { name: 'Kind of question: IBAN' })).toBeVisible();
    await picked(page).getByLabel('Country').selectOption('DE');
    expect(await page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage().layout.children[0].children[0].options)).toEqual({ country: 'DE' });
    // The card draws the app's own widget.
    await expect(picked(page).locator('.demo-iban')).toBeVisible();
    await screen(page, 'extend-iban-survey-card');
    expect(await doubleLines(page)).toEqual([]);

    await page.getByRole('button', { name: 'Try it' }).click();
    const box = page.locator('.fd-try-frame').getByLabel('Account for refunds');
    await box.click();
    await page.keyboard.type('gb82west12345698765432');
    const check = page.locator('.fd-try-frame .demo-iban-check');
    await expect(check).toHaveText('An IBAN from Germany starts with DE');
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await box.fill('');
    await box.pressSequentially('DE89370400440532013001');
    await expect(box).toHaveValue('DE89 3704 0044 0532 0130 01');
    await expect(check).toHaveText('The check digits do not match: a character is wrong');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('0');
    await expect(check).toHaveText('This IBAN checks out');
    await expect(box).toHaveAttribute('aria-invalid', 'false');
    await screen(page, 'extend-iban-survey-try');
  });

  test('on a screen: its setting on the panel’s Content tab, and Try it at a phone’s width in Arabic', async ({ page }) => {
    await page.goto('/screen/?start=blank');
    await tile(page, 'kind:iban').click();
    await page.keyboard.type('Supplier IBAN');
    const panel = page.locator('.fd-properties');
    const row = panel.locator('[data-setting="IBAN settings"]');
    await expect(row).toBeVisible();
    await row.getByLabel('Country').selectOption('EG');
    await expect(page.locator('.fd-canvas-field.fd-editing').getByLabel('Country')).toHaveValue('EG');
    await screen(page, 'extend-iban-screen-panel');
    expect(await doubleLines(page)).toEqual([]);

    await page.getByRole('button', { name: 'Try it' }).click();
    await page.getByRole('button', { name: 'Phone' }).click();
    await page.getByRole('button', { name: 'العربية' }).click();
    const box = page.locator('.fd-try-frame .demo-iban input');
    await box.click();
    await page.keyboard.type('EG38001900050000000026318000');
    const check = page.locator('.fd-try-frame .demo-iban-check');
    await expect(check).toHaveText('رقم IBAN من مصر من 29 خانة، والمكتوب 28');
    await page.keyboard.type('2');
    await expect(check).toHaveText('رقم IBAN صحيح');
    await expect(box).toHaveValue('EG38 0019 0005 0000 0000 2631 8000 2');
    // The whole of it in view at a phone's width, its country first.
    expect(await box.evaluate((input) => input.scrollWidth <= input.clientWidth)).toBe(true);
    await screen(page, 'extend-iban-screen-try-rtl', { viewport: true });
  });

  test('at a phone’s width: the tile, the card and its setting fit', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/designer/');
    await tile(page, 'kind:iban').click();
    await page.keyboard.type('Account');
    await picked(page).getByLabel('Country').selectOption('SA');
    await expectNoSidewaysScroll(page);
    expect(await doubleLines(page)).toEqual([]);
    await picked(page).scrollIntoViewIfNeeded();
    await screen(page, 'extend-iban-phone', { viewport: true });
  });
});

/** The designer's page right to left, as for an Arabic reader. */
const rightToLeft = (page: Page) =>
  page.evaluate(() => {
    document.documentElement.dir = 'rtl';
    document.documentElement.lang = 'ar';
  });

test.describe('templates for a blank page', () => {
  let problems: string[] = [];
  test.beforeEach(({ page }) => {
    problems = watch(page);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('a blank survey: pick one, Undo from the keyboard, pick another', async ({ page }) => {
    await page.goto('/designer/');
    const offer = page.getByRole('region', { name: 'Start from a template' });
    await expect(offer).toBeVisible();
    await expect(offer.getByRole('button', { name: 'Feedback', exact: true })).toHaveAccessibleDescription('How it went, and what to do better, in two minutes.');
    await screen(page, 'extend-templates-survey-blank', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);

    await offer.getByRole('button', { name: 'Event registration' }).click();
    await expect(offer).toBeHidden();
    const notice = page.getByRole('status').filter({ hasText: 'Started from the template “Event registration”.' });
    await expect(notice).toBeFocused();
    await expect(page.locator('.fd-q')).toHaveCount(7);
    await screen(page, 'extend-templates-survey-picked', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);

    // Undo from the keyboard: the offer is back, the first template focused; Tab on to another.
    await page.keyboard.press('Tab');
    await expect(notice.getByRole('button', { name: 'Undo' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(offer).toBeVisible();
    await expect(offer.getByRole('button', { name: 'Feedback' })).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(offer.getByRole('button', { name: 'Job application' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.fd-q-text', { hasText: 'Your CV' })).toBeVisible();
    await expect(page.locator('.fd-q-text', { hasText: 'Which sessions will you join?' })).toHaveCount(0);
  });

  test('a blank survey at a phone’s width, right to left', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/designer/');
    await rightToLeft(page);
    const offer = page.getByRole('region', { name: 'Start from a template' });
    await offer.scrollIntoViewIfNeeded();
    await expectNoSidewaysScroll(page);
    expect(await doubleLines(page)).toEqual([]);
    await screen(page, 'extend-templates-survey-phone-rtl', { viewport: true });
    await offer.getByRole('button', { name: 'Feedback' }).click();
    const notice = page.getByRole('status').filter({ hasText: 'Started from the template “Feedback”.' });
    await expect(notice).toBeVisible();
    // In view, below the editor's bar rather than under it.
    const [bar, box] = await Promise.all([page.locator('.fd-designer-bar').boundingBox(), notice.boundingBox()]);
    expect(box!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await expectNoSidewaysScroll(page);
    await screen(page, 'extend-templates-survey-phone-rtl-picked', { viewport: true });
  });

  test('a blank screen: Start blank puts the offer away; a template fills the canvas', async ({ page }) => {
    await page.goto('/screen/?start=blank');
    const offer = page.getByRole('region', { name: 'Start from a template' });
    await expect(offer.locator('.fd-start-card')).toHaveCount(2);
    await screen(page, 'extend-templates-screen-blank', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);
    await offer.getByRole('button', { name: 'Start blank' }).click();
    await expect(offer).toBeHidden();
    await expect(page.locator('.fd-tool-find')).toBeFocused();
    await page.reload();
    await page.getByRole('region', { name: 'Start from a template' }).getByRole('button', { name: 'Order request' }).click();
    await expect(page.locator('.fd-canvas-field')).toHaveCount(7);
    await screen(page, 'extend-templates-screen-picked', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);
  });
});

test.describe('the app’s assistant (the demo’s stand-in)', () => {
  let problems: string[] = [];
  test.beforeEach(({ page }) => {
    problems = watch(page);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('describe a survey, see what changed, Undo', async ({ page }) => {
    await page.goto('/designer/?assistant-delay=1500');
    const box = page.locator('.fd-start form.fd-assist');
    await expect(box.locator('.fd-assist-name')).toHaveText('Demo assistant');
    await expect(box.locator('.fd-assist-note')).toContainText('Fieldia ships no AI of its own');
    await box.getByLabel('Describe the form you need').fill('A booking form: contact details, a date and a rating');
    await box.getByRole('button', { name: 'Build it' }).click();
    await expect(box.getByRole('status').filter({ hasText: 'Building your form…' })).toBeVisible();
    await expect(box.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await screen(page, 'extend-assistant-busy', { viewport: true });

    const notice = page.locator('.fd-start-done');
    await expect(notice.locator('.fd-start-done-words')).toHaveText('The assistant built the form:');
    await expect(notice).toBeFocused();
    await expect(notice.locator('li')).toContainText(['Added “Full name”', 'Added “Email”', 'Added “Phone”', 'Added “Which date suits you?”', 'Added “How would you rate it?”']);
    await expect(page.locator('.fd-survey-head-title')).toHaveValue('Booking form');
    await expect(page.locator('.fd-q')).toHaveCount(5);
    await screen(page, 'extend-assistant-built', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);

    await notice.getByRole('button', { name: 'Undo' }).click();
    await expect(page.locator('.fd-q')).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Start from a template' })).toBeVisible();
  });

  test('cancel a slow answer: nothing changes, then or later', async ({ page }) => {
    await page.goto('/designer/?assistant-delay=1500');
    const box = page.locator('.fd-start form.fd-assist');
    await box.getByLabel('Describe the form you need').fill('Contact details');
    await box.getByRole('button', { name: 'Build it' }).click();
    await expect(box.locator('.fd-assist-busy')).toBeVisible();
    await box.getByRole('button', { name: 'Cancel' }).click();
    await expect(box.locator('.fd-assist-said')).toHaveText('Cancelled. Nothing was changed.');
    await expect(box.getByLabel('Describe the form you need')).toBeFocused();
    await expect(box.getByLabel('Describe the form you need')).toHaveValue('Contact details');
    // Long after the answer would have come.
    await page.waitForTimeout(1800);
    await expect(page.locator('.fd-q')).toHaveCount(0);
    await expect(page.locator('.fd-start-done')).toBeHidden();
    await screen(page, 'extend-assistant-cancelled', { viewport: true });
  });

  test('on a screen with parts: Ask the assistant… from Find anything, what changed, Undo', async ({ page }) => {
    await page.goto('/screen/?assistant-delay=300');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('ask the assistant');
    await expect(page.locator('.fd-find-option[aria-selected="true"] .fd-find-label')).toHaveText('Ask the assistant…');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the assistant' });
    await expect(dialog.getByLabel('What should change?')).toBeFocused();
    await page.keyboard.type('Make the customer required');
    await screen(page, 'extend-assistant-dialog', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);
    await page.keyboard.press('Control+Enter');
    await expect(dialog).toBeHidden();
    const notice = page.locator('.fd-start-done');
    await expect(notice.locator('.fd-start-done-words')).toHaveText('The assistant changed the form:');
    await expect(notice.locator('li')).toHaveText(['“Customer” is now required']);
    await screen(page, 'extend-assistant-changed', { viewport: true });
    await notice.getByRole('button', { name: 'Undo' }).click();
    await expect(notice).toBeHidden();
    await expect(page.locator('.fd-canvas-field.fd-required')).toHaveCount(0);
  });

  test('a cancelled ask from Find anything closes with Escape, and the answer is let go', async ({ page }) => {
    await page.goto('/screen/?assistant-delay=1200');
    await page.keyboard.press('Control+k');
    await page.keyboard.type('ask the assistant');
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', { name: 'Ask the assistant' });
    await page.keyboard.type('Make the customer required');
    await dialog.getByRole('button', { name: 'Ask' }).click();
    await expect(dialog.getByText('Changing your form…')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.waitForTimeout(1500);
    await expect(page.locator('.fd-start-done')).toBeHidden();
    expect(await page.evaluate(() => (window as any).fieldiaDesigner.designer.getState().canUndo)).toBe(false);
  });

  test('describe a survey at a phone’s width, right to left', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/designer/?assistant-delay=200');
    await rightToLeft(page);
    const box = page.locator('.fd-start form.fd-assist');
    await box.scrollIntoViewIfNeeded();
    await box.getByLabel('Describe the form you need').fill('A refund request: contact, IBAN and a note');
    await expectNoSidewaysScroll(page);
    expect(await doubleLines(page)).toEqual([]);
    await screen(page, 'extend-assistant-phone-rtl', { viewport: true });
    await box.getByRole('button', { name: 'Build it' }).click();
    const notice = page.locator('.fd-start-done');
    await expect(notice.locator('li')).toContainText(['Added “Bank account (IBAN)”']);
    await expectNoSidewaysScroll(page);
    await screen(page, 'extend-assistant-phone-rtl-built', { viewport: true });
  });
});
