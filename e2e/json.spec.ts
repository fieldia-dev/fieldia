import { expect, test, type Page } from '@playwright/test';
import { cardOf, doubleLines, watch } from './designer-support';
import { expectNoSidewaysScroll, open, screen } from './support';

/**
 * The page as JSON, as a person uses it: open it beside Design and Try it,
 * change the text and apply it, break it and see where, fix a rule on a field
 * that is not there with the check's own fix, take it back with Undo, and be
 * asked before leaving changes not applied. Then Try it's drawer of data and
 * problems, and choices that come from the app's own lists.
 */

const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const box = (page: Page) => page.locator('.fd-json textarea');
const rows = (page: Page) => page.locator('.fd-json-problem');
/** The text with one change made in it, as typed over the box. */
async function edit(page: Page, change: (text: string) => string) {
  const text = await box(page).inputValue();
  await box(page).fill(change(text));
}
/** The line a piece of the text is on, from 1. */
const lineOf = (text: string, words: string) => text.split('\n').findIndex((line) => line.includes(words)) + 1;

test.describe('the JSON view of the screen editor', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    problems = watch(page);
    await page.goto('/screen/');
    await expect(page.locator('.fd-designer')).toBeVisible();
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('changes a label in the text, applies it, and the canvas shows it; Undo takes it back', async ({ page }) => {
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    await expect(box(page)).toBeVisible();
    await expect(page.locator('.fd-screen-body')).toBeHidden();
    await expect(page.locator('.fd-json-state')).toHaveText('Nothing to apply: the text is the page as it is.');
    await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeHidden();
    await screen(page, 'json-screen-open', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);

    await edit(page, (text) => text.replace('"label": "Customer"', '"label": "Client"'));
    await expect(page.locator('.fd-json-state')).toHaveText(/^Changed here, not applied yet/);
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(page.locator('.fd-json-state')).toHaveText('Applied. Undo takes it back.');
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(page.locator('.fd-canvas-field .fd-label', { hasText: 'Client' })).toBeVisible();

    // Undo, back in the JSON: the text follows the page.
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(box(page)).toHaveValue(/"label": "Customer"/);
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(page.locator('.fd-canvas-field .fd-label', { hasText: 'Customer' })).toBeVisible();
  });

  test('marks broken JSON on its line, and a click puts the cursor there', async ({ page }) => {
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    const text = await box(page).inputValue();
    const broken = text.replace('"fieldia": "0.1",', '"fieldia": "0.1"');
    await box(page).fill(broken);
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText('Line 3');
    await expect(rows(page).first()).toContainText('A comma is missing before this');
    await expect(page.locator('.fd-json-mark[data-line="3"]')).toBeVisible();
    await expect(page.locator('.fd-json-state')).toHaveText('1 problem to put right before this can be applied.');
    await expect(page.getByRole('button', { name: 'Apply', exact: true })).toBeHidden();
    await page.getByRole('button', { name: 'Go to line 3, column 3' }).click();
    await expect(box(page)).toBeFocused();
    const caret = await box(page).evaluate((t: HTMLTextAreaElement) => t.selectionStart);
    const lines = broken.split('\n');
    expect(caret).toBe(lines[0].length + 1 + lines[1].length + 1 + 2);
    await screen(page, 'json-broken', { viewport: true });
    // Ctrl/⌘+Enter with a problem: nothing is applied.
    await page.keyboard.press(`${mod}+Enter`);
    await expect(rows(page)).toHaveCount(1);
  });

  test('puts a rule on a field the page lacks on its line, fixes it with the check’s fix, and applies', async ({ page }) => {
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    // "Visit date" shows only when a field the page does not have says so.
    await edit(page, (text) => text.replace('"field": "q_2"', `"field": "q_2",\n            "invisible": "colour != 'red'"`));
    const text = await box(page).inputValue();
    await expect(rows(page)).toHaveCount(1);
    const row = rows(page).first();
    await expect(row).toContainText(`Line ${lineOf(text, '"invisible"')}`);
    await expect(row).toContainText('reads "colour", which is not a field of this page');
    await row.locator('.fd-json-at').click();
    const caretLine = await box(page).evaluate((t: HTMLTextAreaElement) => t.value.slice(0, t.selectionStart).split('\n').length);
    expect(caretLine).toBe(lineOf(text, '"invisible"'));
    await screen(page, 'json-rule-problem', { viewport: true });
    await row.getByRole('button', { name: 'Remove the rule' }).click();
    await expect(rows(page)).toHaveCount(0);
    await expect(box(page)).not.toHaveValue(/colour/);
    await expect(page.locator('.fd-json-state')).toHaveText('Fixed in the text. Apply to keep it.');
  });

  test('asks in the page before leaving changes not applied', async ({ page }) => {
    page.on('dialog', (dialog) => problems.push(`a browser dialog: ${dialog.message()}`));
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    await edit(page, (text) => text.replace('"label": "Customer"', '"label": "Client"'));
    await expect(page.locator('.fd-json-state')).toHaveText(/^Changed here, not applied yet/);
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    const question = page.getByRole('alertdialog');
    await expect(question).toContainText('The changes typed here are not applied yet.');
    await expect(question.getByRole('button', { name: 'Apply' })).toBeFocused();
    await screen(page, 'json-leave-question', { viewport: true });
    await question.getByRole('button', { name: 'Keep editing' }).click();
    await expect(question).toBeHidden();
    await expect(box(page)).toBeFocused();
    await page.getByRole('button', { name: 'Try it' }).click();
    await question.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('.fd-try')).toBeVisible();
    await expect(page.locator('.fd-try .fd-label', { hasText: 'Customer' })).toBeVisible();
  });

  test('indents with Tab, and Escape then Tab leaves the box', async ({ page }) => {
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    await box(page).focus();
    await page.keyboard.press('Tab');
    await expect(box(page)).toBeFocused();
    expect((await box(page).inputValue()).startsWith('  {')).toBe(true);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(box(page)).not.toBeFocused();
    await expect(page.locator('.fd-json-hint')).toContainText('press Esc, then Tab');
  });

  test('fits a phone: the text scrolls inside its own box', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    await expect(box(page)).toBeVisible();
    await expectNoSidewaysScroll(page);
    const [scroll, width] = await box(page).evaluate((t: HTMLTextAreaElement) => [t.scrollWidth, t.clientWidth]);
    expect(scroll).toBeGreaterThan(width);
    await screen(page, 'json-phone', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);
  });
});

test.describe('a choice from the app’s list, in the screen editor', () => {
  test('takes its options from a list by name, changing with another field', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await (await cardOf(page, 'Next step')).click();
    const panel = page.locator('.fd-properties');
    await panel.getByLabel('From the app’s list').check();
    // The demo's app names its lists: the first is taken, and another is picked by its words.
    await expect(panel.getByLabel('List', { exact: true })).toHaveValue('countries');
    await panel.getByLabel('List', { exact: true }).selectOption({ label: 'Cities of the country' });
    await panel.getByRole('group', { name: 'Changes with' }).getByLabel('Customer').check();
    const field = await page.evaluate(() =>
      Object.values((window as unknown as { fieldiaDesigner: { designer: { getPage(): { fields: Record<string, { label: string }> } } } }).fieldiaDesigner.designer.getPage().fields).find((f) => f.label === 'Next step')
    );
    expect(field).toMatchObject({ optionsFrom: { list: 'cities', dependsOn: ['q_1'] } });
    await screen(page, 'json-list-choice', { viewport: true });
    expect(await doubleLines(page, '.fd-properties *')).toEqual([]);
    await panel.getByLabel('Written here').check();
    await expect(panel.getByLabel('Option 1', { exact: true })).toHaveValue('Send a quote');
    expect(problems).toEqual([]);
  });

  test('Try it takes the list’s choices from the app’s own data source', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await (await cardOf(page, 'Next step')).click();
    await page.locator('.fd-properties').getByLabel('From the app’s list').check();
    await page.locator('.fd-mode [data-mode="try"]').click();
    const choice = page.locator('.fd-try-frame').getByLabel('Next step');
    // The demo's lists answer after a moment, as a server's do.
    await expect(choice.locator('option')).toHaveText(['', 'Egypt', 'Jordan', 'Saudi Arabia', 'United Arab Emirates']);
    await choice.selectOption({ label: 'Jordan' });
    await screen(page, 'json-list-try', { viewport: true });
    expect(problems).toEqual([]);
  });
});

test.describe('Try it’s drawer', () => {
  test('shows the answers as they are filled, and the problems, a click going to the question', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    // The customer is required: said in the text, and applied.
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    await edit(page, (text) => text.replace('"label": "Customer"', '"label": "Customer",\n      "required": true'));
    await page.keyboard.press(`${mod}+Enter`);
    await expect(page.locator('.fd-json-state')).toHaveText('Applied. Undo takes it back.');
    await page.getByRole('button', { name: 'Try it' }).click();
    const drawer = page.locator('.fd-try-drawer');
    await expect(drawer.getByRole('button', { name: 'Problems' })).toContainText('1');
    await drawer.getByRole('button', { name: 'Data', exact: true }).click();
    await page.locator('.fd-try-frame').getByLabel('Notes').fill('Bring the plans');
    await expect(drawer.locator('.fd-try-data')).toContainText('"Bring the plans"');
    await screen(page, 'json-try-data', { viewport: true });
    await drawer.getByRole('button', { name: 'Problems' }).click();
    await expect(drawer.locator('.fd-try-problem')).toHaveText(['CustomerCustomer is required']);
    await drawer.locator('.fd-try-problem').click();
    await expect(page.locator('.fd-try-frame').getByLabel('Customer')).toBeFocused();
    await screen(page, 'json-try-problems', { viewport: true });
    // The drawer's own lines: the bar above the page tried is Try it's, as it was.
    expect(await doubleLines(page, '.fd-try-drawer, .fd-try-drawer *')).toEqual([]);
    expect(problems).toEqual([]);
  });
});

test.describe('the JSON view of the survey editor', () => {
  test('opens from Find anything, beside Design and Try it', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/?start=survey');
    await page.keyboard.press(`${mod}+k`);
    await page.keyboard.type('page as JSON');
    await page.keyboard.press('Enter');
    await expect(box(page)).toBeVisible();
    await expect(box(page)).toHaveValue(/"kind": "responses"/);
    await expect(page.getByRole('button', { name: 'JSON', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await screen(page, 'json-survey', { viewport: true });
    expect(await doubleLines(page)).toEqual([]);
    expect(problems).toEqual([]);
  });
});

test.describe('choices from the app’s lists', () => {
  test('load as the form opens, and load again for the country chosen', async ({ page }) => {
    const { problems } = await open(page, 'plain', 'page=lists&skin=outlined');
    const country = page.getByLabel('Country');
    const city = page.locator('[data-field="city"]');
    await expect(page.locator('[data-field="country"]')).toContainText('Loading choices…');
    await screen(page, 'lists-loading', { viewport: true });
    await expect(page.locator('[data-field="country"]')).not.toContainText('Loading choices…');
    await country.selectOption({ label: 'Egypt' });
    await expect(city).toContainText('Loading choices…');
    await expect(city.getByLabel('Alexandria')).toBeVisible();
    await city.getByLabel('Alexandria').check();
    await country.selectOption({ label: 'Jordan' });
    await expect(city).toContainText('Loading choices…');
    await expect(city.getByLabel('Amman')).toBeVisible();
    await expect(city).toContainText('Alexandria: no longer offered');
    await screen(page, 'lists-not-offered', { viewport: true });
    await city.getByLabel('Amman').check();
    await expect(city).not.toContainText('no longer offered');
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
});
