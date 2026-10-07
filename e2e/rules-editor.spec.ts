import { expect, test, type Page } from '@playwright/test';
import { addField, cardOf, doubleLines, inAdvanced, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Rules in the designers, used as a person uses them: a total worked out
 * from a price and a quantity, typed with the fields suggested, its result
 * shown as it is typed and then working in Try it; answer rules that only
 * warn and that stop sending, tried in the survey; the rules overview
 * filtered and a rule clicked to reach its field; a mark on the canvas
 * pointed at; a rule broken by taking its field away, the check that says
 * so, and its fix; the overview right to left, and all of it on a phone.
 */

const panel = (page: Page) => page.locator('.fd-properties');
const rulesTab = (page: Page) => panel(page).getByRole('tab', { name: 'Rules', exact: true });

/**
 * A screenshot to look at, with no line drawn twice. Try it's own bar draws
 * its groups in a box in a box — not the rules' doing — so while trying, only
 * the page tried is looked at for that.
 */
async function check(page: Page, name: string, options: { viewport?: boolean; trying?: boolean } = {}) {
  await page.waitForTimeout(150);
  await screen(page, `rules-editor-${name}`, { viewport: options.viewport ?? true });
  expect(await doubleLines(page, options.trying ? '.fd-try-frame *' : undefined), name).toEqual([]);
}

/** Price, Quantity and Total on the screen, added from the toolbox; Total is left picked. */
async function addOrder(page: Page) {
  await addField(page, 'number', 'Price');
  await addField(page, 'number', 'Quantity');
  await addField(page, 'number', 'Total');
}

/** Total worked out from Price × Quantity, typed with the fields suggested. */
async function workOutTotal(page: Page) {
  await rulesTab(page).click();
  const box = panel(page).getByRole('combobox', { name: 'Worked out from' });
  await box.click();
  await page.keyboard.type('pr');
  const suggested = panel(page).getByRole('listbox', { name: 'Fields' });
  await expect(suggested.getByRole('option')).toHaveText([/^Price/]);
  await page.keyboard.press('Enter');
  await page.keyboard.type(' * @qu');
  await expect(suggested.getByRole('option')).toHaveText([/^Quantity/]);
  await page.keyboard.press('Enter');
  await expect(box).toHaveValue(/^q_\d+ \* q_\d+$/);
  return box;
}

test.describe('rules in the designers', () => {
  // Answer rules and values worked out are Advanced's: Simple keeps a field to when it shows and whether it is required.
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await inAdvanced(page);
  });

  test('Total worked out from Price × Quantity, typed with suggestions, its result live, then tried', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await addOrder(page);
    await rulesTab(page).click();
    await panel(page).getByRole('combobox', { name: 'Worked out from' }).click();
    await page.keyboard.type('pr');
    await check(page, 'suggestions');
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.press('Backspace');
    await workOutTotal(page);
    await expect(panel(page).locator('[data-setting="Worked out from"] .fd-formula-reads')).toHaveText('Reads: Price × Quantity');
    await expect(panel(page).locator('[data-setting="Worked out from"] .fd-formula-outcome')).toHaveText('With Price 120 and Quantity 80: 9600');
    await expect(panel(page).locator('[data-setting="Worked out from"] .fd-properties-hint')).toContainText('cannot type in it');
    await check(page, 'worked-out');

    // A formula that does not read: what is wrong, under the box, its place marked.
    const box = panel(page).getByRole('combobox', { name: 'Worked out from' });
    await box.press('End');
    await page.keyboard.type(' *');
    await expect(panel(page).locator('[data-setting="Worked out from"] .fd-formula-problem-words')).toHaveText(/^Something is missing after “\*” at \d+$/);
    await expect(panel(page).locator('[data-setting="Worked out from"] .fd-formula-problem mark')).toHaveText('*');
    await check(page, 'formula-problem');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(panel(page).locator('[data-setting="Worked out from"] .fd-formula-problem')).toBeHidden();

    // Tried: the total follows the price and the quantity, and cannot be typed in.
    await page.getByRole('button', { name: 'Try it', exact: true }).click();
    const tried = page.locator('.fd-try');
    await tried.getByLabel('Price').fill('12.5');
    await tried.getByLabel('Quantity').fill('4');
    await expect(tried.getByLabel('Total')).toHaveValue(/^50(\.00)?$/);
    await expect(tried.getByLabel('Total')).not.toBeEditable();
    await check(page, 'tried', { trying: true });
    expect(problems).toEqual([]);
  });

  test('an answer rule that only warns and one that stops sending, tried', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/designer/');
    await page.getByRole('button', { name: 'Add question' }).first().click();
    await page.keyboard.type('Your name');
    const card = () => page.locator('.fd-q-selected');
    const more = async () => card().getByRole('button', { name: 'More options' }).click();
    // Your name: at least 2 letters, or it does not send.
    await more();
    await page.getByRole('menuitemcheckbox', { name: 'Answer rules' }).click();
    await expect(card().getByRole('button', { name: 'Add a rule' })).toBeFocused();
    await page.keyboard.press('Enter');
    await page.getByRole('menuitem', { name: 'A length' }).click();
    await expect(card().getByRole('spinbutton', { name: 'Shortest' })).toBeFocused();
    await expect(card().locator('.fd-answer-rule-say')).toHaveText(['At least 2 letters']);
    await expect(card().getByRole('button', { name: 'Stops sending' })).toHaveAttribute('aria-pressed', 'true');
    await check(page, 'survey-length');

    // Email: ends with @acme.com, and only says so.
    await page.locator('.fd-toolbox [data-tool="kind:email"]').click();
    await page.keyboard.type('Email');
    await more();
    await page.getByRole('menuitemcheckbox', { name: 'Answer rules' }).click();
    await card().getByRole('button', { name: 'Add a rule' }).click();
    await page.getByRole('menuitem', { name: 'An ending' }).click();
    const ending = card().getByRole('textbox', { name: 'Ends with' });
    await expect(ending).toBeFocused();
    await ending.fill('@acme.com');
    await card().getByRole('button', { name: 'Only warns' }).click();
    await card().getByRole('textbox', { name: 'Message when it does not fit' }).fill('Use your work address if you can.');
    await expect(card().locator('.fd-answer-rule-say')).toHaveText(['Ends with @acme.com — only warns']);
    await check(page, 'survey-warns');

    // Tried: the warning shows and does not stop it; the short name does.
    await page.getByRole('button', { name: 'Try it', exact: true }).click();
    const tried = page.locator('.fd-try');
    await tried.getByLabel('Your name').fill('A');
    await tried.getByLabel('Email').fill('sara@gmail.com');
    await tried.getByLabel('Email').press('Tab');
    await expect(tried.locator('.fd-warning').filter({ hasText: 'Use your work address if you can.' })).toBeVisible();
    await tried.getByRole('button', { name: /^(Submit|Send)$/ }).click();
    await expect(tried.locator('.fd-error').filter({ hasText: /2/ })).toBeVisible();
    await check(page, 'survey-tried', { trying: true });
    await tried.getByLabel('Your name').fill('Amira');
    await tried.getByRole('button', { name: /^(Submit|Send)$/ }).click();
    await expect(tried.locator('.fd-done')).toBeVisible();
    expect(problems).toEqual([]);
  });

  test('the overview, filtered, a rule clicked to reach its field; a mark pointed at', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await addOrder(page);
    await workOutTotal(page);
    await (await cardOf(page, 'Customer')).click();
    await rulesTab(page).click();
    await panel(page).getByRole('button', { name: 'Add a rule' }).click();
    await page.getByRole('menuitem', { name: 'A length' }).click();
    await page.keyboard.press('Escape');

    // A mark on the canvas: pointed at, it says its rule.
    await page.locator('.fd-designer-bar').getByRole('textbox', { name: 'Screen title' }).click();
    await page.keyboard.press('Escape');
    const mark = page.locator('.fd-canvas .fd-rule-mark[data-mark="worked-out"]');
    await mark.hover();
    await expect(page.getByRole('tooltip')).toHaveText('Worked out from Price × Quantity');
    await check(page, 'mark-hover');

    // The overview: every rule, by what it does; filtered by words.
    await page.locator('.fd-designer-bar [data-mode="rules"]').click();
    const view = page.getByRole('region', { name: 'Rules' });
    await expect(view.locator('.fd-rules-group-title')).toHaveText(['Worked out from', 'Answer rules']);
    await check(page, 'overview');
    await view.getByRole('searchbox', { name: 'Filter the rules' }).fill('quantity');
    await expect(view.locator('.fd-rules-item')).toHaveCount(1);
    await check(page, 'overview-filtered');
    await view.locator('.fd-rules-item').click();
    await expect(view).toBeHidden();
    await expect(rulesTab(page)).toHaveAttribute('aria-selected', 'true');
    await expect(panel(page).locator('.fd-insp-name')).toHaveText('Total');
    await expect(panel(page).getByRole('combobox', { name: 'Worked out from' })).toBeFocused();

    // From Find anything too.
    await page.keyboard.press('Escape');
    await page.locator('.fd-designer-bar').getByRole('button', { name: 'Find anything' }).click();
    await page.keyboard.type('rule customer');
    await page.keyboard.press('Enter');
    await expect(panel(page).locator('.fd-insp-name')).toHaveText('Customer');
    await expect(panel(page).locator('.fd-answer-rule-say')).toBeFocused();
    expect(problems).toEqual([]);
  });

  test('a rule broken by taking its field away: the check, and its fix', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await addOrder(page);
    await workOutTotal(page);
    // Total put down, Price picked: not typed in, so Delete takes the field away.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Escape');
    await (await cardOf(page, 'Price')).click();
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await page.keyboard.press('Delete');
    await expect(await cardOf(page, 'Price')).toHaveCount(0);
    const checks = page.locator('.fd-designer-bar [data-checks]');
    await checks.click();
    const list = page.getByRole('dialog', { name: 'Checks before publishing' });
    const broken = list.locator('.fd-check').filter({ hasText: '“Total”: “Worked out from Price × Quantity” reads Price, which is no longer on the page.' });
    await expect(broken).toBeVisible();
    await check(page, 'check');
    await broken.getByRole('button', { name: 'Remove the rule' }).click();
    await checks.click();
    await expect(list.locator('.fd-check').filter({ hasText: 'Price' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    // Undo brings the field and the rule back.
    await page.keyboard.press('ControlOrMeta+z');
    await page.keyboard.press('ControlOrMeta+z');
    await expect(await cardOf(page, 'Price')).toHaveCount(1);
    expect(problems).toEqual([]);
  });

  test('the overview right to left, in Arabic', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await addOrder(page);
    await workOutTotal(page);
    await page.evaluate(() => {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      const d = window.fieldiaDesigner.designer as unknown as { updateQuestion(id: string, patch: { label: string }): boolean; getState(): { selected: string | null } };
      d.updateQuestion(d.getState().selected as string, { label: 'المجموع' });
    });
    await page.locator('.fd-designer-bar [data-mode="rules"]').click();
    const view = page.getByRole('region', { name: 'Rules' });
    const item = view.locator('.fd-rules-item').first();
    await expect(item.locator('.fd-rules-item-name')).toHaveText('المجموع');
    expect(await view.evaluate((v) => getComputedStyle(v).direction)).toBe('rtl');
    // The part's name stands at the start, on the right; its sentence after it, to its left.
    const [name, said] = await Promise.all([item.locator('.fd-rules-item-name').boundingBox(), item.locator('.fd-rules-item-say').boundingBox()]);
    expect((name?.x ?? 0) > (said?.x ?? 0)).toBe(true);
    const filter = await view.getByRole('searchbox', { name: 'Filter the rules' }).boundingBox();
    const title = await view.locator('.fd-rules-title').boundingBox();
    expect((title?.x ?? 0) > (filter?.x ?? 0)).toBe(true);
    await check(page, 'overview-rtl');
    expect(problems).toEqual([]);
  });

  test('at a phone’s width', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/screen/');
    await (await cardOf(page, 'Customer')).click();
    await rulesTab(page).scrollIntoViewIfNeeded();
    await rulesTab(page).click();
    await panel(page).getByRole('button', { name: 'Add a rule' }).click();
    await page.getByRole('menuitem', { name: 'An ending' }).click();
    await panel(page).getByRole('textbox', { name: 'Ends with' }).fill('Ltd');
    await panel(page).getByRole('button', { name: 'Only warns' }).click();
    await panel(page).locator('[data-setting="Answer rules"]').scrollIntoViewIfNeeded();
    await check(page, 'phone-rules-tab');
    await expectNoSidewaysScroll(page);
    await page.locator('.fd-designer-bar [data-mode="rules"]').click();
    await expect(page.getByRole('region', { name: 'Rules' }).locator('.fd-rules-item')).toHaveText(['CustomerEnds with Ltd — only warns']);
    await check(page, 'phone-overview');
    await expectNoSidewaysScroll(page);
    expect(problems).toEqual([]);
  });
});
