import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { screen } from './support';
import { inAdvanced, watch } from './designer-support';

/**
 * The designer's per-option rules and functions, as a person meets them on a screen: an option's row offers Show
 * when…, its condition on another question's answer drawn under the row — a table's Choice column's option on the
 * line's columns or the record's fields; a choice's options carried from another question; and a formula's functions listed by what they work on, the app's own after them, a value of a kind a
 * function does not take said in words. The demos give the designer their own function, districtPrice.
 */

const panel = (page: Page) => page.locator('.fd-properties');

/** Questions made through the designer's own calls, as the canvas would make them: their ids, by label. */
async function questions(page: Page, made: { kind: string; label: string; options?: string[] }[]): Promise<Record<string, string>> {
  return page.evaluate((list) => {
    const designer = (window as any).fieldiaDesigner.designer;
    const ids: Record<string, string> = {};
    for (const { kind, label, options } of list) {
      const id = designer.addQuestion(kind);
      designer.updateQuestion(id, { label });
      if (options) designer.setOptions(id, options);
      ids[label] = id;
    }
    return ids;
  }, made);
}
const built = (page: Page) => page.evaluate(() => (window as any).fieldiaDesigner.designer.getPage());
const card = (page: Page, id: string) => page.locator(`.fd-canvas-field[data-node="${id}"]`);

test.describe('the designer: options that follow the answers, and functions', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    problems = watch(page);
    await page.goto('/screen/');
    await expect(page.locator('.fd-designer')).toBeVisible();
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('an option’s row: Show when… tests another question’s answer, drawn under the row', async ({ page }) => {
    const ids = await questions(page, [
      { kind: 'multiple-choice', label: 'Unit type', options: ['Villa', 'Apartment'] },
      { kind: 'checkboxes', label: 'Features', options: ['Garden', 'Balcony'] },
    ]);
    await card(page, ids['Features']).click();
    const rows = page.locator('.fd-q-options:visible > li');
    await expect(rows.first().locator('input').first()).toHaveValue('Garden');
    await rows.first().getByRole('button', { name: 'Show when…' }).click();
    const rule = rows.first().locator('.fd-q-option-when-box');
    await expect(rule).toBeVisible();
    // The screen's first question with answers is tested first: Unit type is picked in its place, its first answer with it.
    const question = rule.locator('.fd-when-rule select').first();
    await question.selectOption({ label: 'Unit type' });
    await expect(question.locator('option:checked')).toHaveText('Unit type');
    await expect(rule.locator('.fd-when-rule select').nth(1).locator('option:checked')).toHaveText('is Villa');
    // Balcony shows always: no rule drawn in its row, its own Show when… there to begin one.
    await expect(rows.nth(1).locator('.fd-q-option-when-box')).toBeHidden();
    await expect(rows.nth(1).getByRole('button', { name: 'Show when…' })).toBeVisible();
    await screen(page, 'designer-option-show-when', { viewport: true });
    const page_ = await built(page);
    const features = page_.fields[Object.keys(page_.fields).find((name) => page_.fields[name].label === 'Features') as string];
    expect(features.options[0].invisible).toMatch(/ != 'villa'$/);
  });

  test('a table’s Choice column: Show when… in an option’s row, on the line’s columns or the record’s fields', async ({ page }) => {
    // A table's columns are an Advanced setting.
    await inAdvanced(page);
    await page.reload();
    const ids = await questions(page, [{ kind: 'multiple-choice', label: 'Plan', options: ['Free', 'Pro'] }]);
    const lines = await page.evaluate(() => {
      const designer = (window as any).fieldiaDesigner.designer;
      const id = designer.addQuestion('lines');
      designer.setLineColumns(id, [{ name: 'connection', label: 'Connection', kind: 'choice' }, { name: 'tool', label: 'Tool', kind: 'choice' }]);
      designer.setColumnChoices(id, 'connection', { labels: ['Gmail', 'Slack'] });
      designer.setColumnChoices(id, 'tool', { labels: ['Send an email', 'Read the inbox'] });
      return id as string;
    });
    await card(page, lines).click();
    const rows = panel(page).locator('.fd-columns > li').nth(1).locator('.fd-column-written .fd-kind-item-row');
    await expect(rows.first().locator('input')).toHaveValue('Send an email');
    await rows.first().getByRole('button', { name: 'Show when…' }).click();
    const rule = rows.first().locator('.fd-q-option-when-box');
    await expect(rule).toBeVisible();
    const what = rule.locator('.fd-when-rule select').first();
    // The line's other column first, then the screen's own questions with answers, each said to be the record's.
    await expect(what.locator('option').nth(1)).toHaveText('Connection');
    await expect(what.locator('option').last()).toHaveText('Plan (the record)');
    await what.selectOption({ label: 'Plan (the record)' });
    await rule.locator('.fd-when-rule select').nth(1).selectOption({ label: 'is Pro' });
    await expect(rows.nth(1).locator('.fd-q-option-when-box')).toBeHidden();
    await screen(page, 'designer-column-option-show-when', { viewport: true });
    const page_ = await built(page);
    const plan = Object.keys(page_.fields).find((name) => page_.fields[name].label === 'Plan') as string;
    const tool = Object.values(page_.fields as Record<string, { type: string; fields?: Record<string, { options: { invisible?: string }[] }> }>).find((f) => f.type === 'one2many')?.fields?.['tool'];
    expect(tool?.options[0].invisible).toBe(`parent.${plan} != 'pro'`);
    expect(ids['Plan']).toBeTruthy();
  });

  test('a choice’s options picked in another question, which answers, its own after them', async ({ page }) => {
    const ids = await questions(page, [
      { kind: 'checkboxes', label: 'Treatments', options: ['Botox', 'Filler'] },
      { kind: 'multiple-choice', label: 'Again', options: ['None of them'] },
    ]);
    await card(page, ids['Again']).click();
    await panel(page).getByRole('radio', { name: 'Picked in another question' }).check();
    const carried = panel(page).locator('.fd-q-carried');
    // The screen's first other choice is offered first: Treatments is picked in its place.
    await carried.getByRole('combobox', { name: 'Question' }).selectOption({ label: 'Treatments' });
    await expect(carried.getByRole('combobox', { name: 'Question' }).locator('option:checked')).toHaveText('Treatments');
    await carried.getByRole('combobox', { name: 'Offer' }).selectOption({ label: 'The answers not picked there' });
    await screen(page, 'designer-options-carried', { viewport: true });
    const page_ = await built(page);
    const again = page_.fields[Object.keys(page_.fields).find((name) => page_.fields[name].label === 'Again') as string];
    expect(again.optionsFrom).toEqual({ field: expect.any(String), picked: false });
  });

  test('Worked out from lists every function by what it works on, the app’s own last, and says a value of the wrong kind, keeping it', async ({ page }) => {
    // Worked out from is an Advanced setting.
    await inAdvanced(page);
    await page.reload();
    const ids = await questions(page, [
      { kind: 'number', label: 'Price' },
      { kind: 'number', label: 'Price per m²' },
    ]);
    await card(page, ids['Price per m²']).click();
    await panel(page).getByRole('tab', { name: 'Rules', exact: true }).click();
    const worked = panel(page).locator('[data-setting="Worked out from"]');
    const groups = worked.locator('.fd-formula-group');
    await expect(groups.locator('.fd-formula-group-name')).toHaveText(['Numbers', 'Dates', 'Words', 'Choosing', 'The app’s']);
    await expect(groups.last().locator('button')).toHaveText(['districtPrice']);
    await expect(groups.last().locator('button')).toHaveAttribute('title', 'The district’s average price per m², from recent sales: districtPrice(district)');
    const page_ = await built(page);
    const price = Object.keys(page_.fields).find((name) => page_.fields[name].label === 'Price') as string;
    const box = worked.getByRole('combobox', { name: 'Worked out from' });
    await box.click();
    await worked.getByRole('button', { name: 'age()', exact: true }).click();
    await page.keyboard.type(price);
    await expect(box).toHaveValue(`age(${price})`);
    // A value of a kind the function does not take stops nothing: said in the result's place, in the warning's colours,
    // and the formula kept as the box is left.
    await expect(worked.locator('.fd-formula-result')).toHaveText(/“age” takes a date: Price is a number/);
    await expect(worked.locator('.fd-formula-result')).toHaveAttribute('data-warn', '');
    await expect(worked.locator('.fd-formula-problem')).toBeHidden();
    await screen(page, 'designer-functions', { viewport: true });
    await page.keyboard.press('Tab');
    await expect.poll(async () => {
      const after = await built(page);
      return Object.values(after.fields as Record<string, { label: string; compute?: string }>).find((f) => f.label === 'Price per m²')?.compute;
    }).toBe(`age(${price})`);
  });
});
