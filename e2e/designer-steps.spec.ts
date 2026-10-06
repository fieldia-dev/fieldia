import { expect, test, type Locator, type Page } from '@playwright/test';
import { addField, doubleLines, inAdvanced, tile, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * “When…” in the screen designer, used as a person uses it: a body button
 * that opens Customer in a panel, puts its answer into Customer, then says
 * Customer added — built by mouse and by keyboard; When Product changes, run
 * check_stock; before it's saved, check then ask; each seen in the Rules view
 * and the JSON, undone, right to left in Arabic, and at a phone's width.
 */

const panel = (page: Page) => page.locator('.fd-properties');
const clicked = (page: Page) => panel(page).locator('[data-setting="When clicked"]');
const sayings = (scope: Locator) => scope.locator('.fd-do-say:visible');
const menu = (page: Page) => page.getByRole('menu');
const built = (page: Page) => page.evaluate(() => (window as unknown as { fieldiaDesigner: { designer: { getPage(): Record<string, unknown> } } }).fieldiaDesigner.designer.getPage());
/** The body button's own part of the page, by its words. */
const buttonOf = (page: Page, label: string) =>
  page.evaluate((words) => {
    const walk = (nodes: unknown[]): unknown => {
      for (const node of nodes as { type: string; label?: string; children?: unknown[] }[]) {
        if (node.type === 'button' && node.label === words) return node;
        const inner = node.children ? walk(node.children) : null;
        if (inner) return inner;
      }
      return null;
    };
    const page = (window as unknown as { fieldiaDesigner: { designer: { getPage(): { layout: { children: unknown[] } } } } }).fieldiaDesigner.designer.getPage();
    return walk(page.layout.children) as Record<string, unknown> | null;
  }, label);

/** A field's name, by its label. */
const nameOf = (page: Page, label: string) =>
  page.evaluate((words) => {
    const fields = (window as unknown as { fieldiaDesigner: { designer: { getPage(): { fields: Record<string, { label: string }> } } } }).fieldiaDesigner.designer.getPage().fields;
    return Object.entries(fields).find(([, def]) => def.label === words)?.[0] as string;
  }, label);

/** A screenshot to look at, with no line drawn twice. */
async function look(page: Page, name: string, options: { viewport?: boolean } = {}) {
  await page.waitForTimeout(150);
  await screen(page, `designer-steps-${name}`, { viewport: options.viewport ?? true });
  expect(await doubleLines(page), name).toEqual([]);
  await expectNoSidewaysScroll(page);
}

/** A Button block from the toolbox, its words typed where it stands; left picked. */
async function addButton(page: Page, words: string) {
  await tile(page, 'block:button').click();
  const block = page.locator('.fd-canvas-block.fd-button').last();
  await expect(block).toHaveAttribute('contenteditable', 'plaintext-only');
  await block.click();
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(words);
  await expect(panel(page).getByRole('textbox', { name: 'Button words' })).toHaveValue(words);
}

test.describe('When… in the screen designer', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await inAdvanced(page);
  });

  test('a body button: New customer opens Customer in a panel, puts its answer into Customer, then says Customer added — by mouse', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await expect(page.locator('.fd-designer-bar')).toBeVisible();
    await page.locator('.fd-canvas-field').first().click();
    await addButton(page, 'New customer');

    // Its app action is its one step: kept, as a button always does something.
    await expect(clicked(page).locator('.fd-prop-name')).toHaveText('When clicked');
    await expect(sayings(clicked(page))).toHaveText(['Run the app’s action button']);
    await expect(clicked(page).locator('.fd-do-keeps')).toBeVisible();
    await look(page, 'button-picked');

    // Add a step: the kinds that fit, grouped plainly.
    await clicked(page).getByRole('button', { name: 'Add a step' }).click();
    await expect(menu(page).locator('.fd-menu-heading')).toHaveText(['Open and close', 'Values', 'Check and save', 'Talk to the person', 'The app']);
    await look(page, 'add-a-step');
    await menu(page).getByRole('menuitem', { name: 'Open a page' }).click();

    // The app's saved pages, by their titles: Customer, in a panel.
    const pageBox = clicked(page).getByRole('combobox', { name: 'Page' });
    await expect(pageBox.locator('option')).toHaveText(['Pick…', 'Address', 'Visit follow-up', 'Customer', 'Another page, by its id…']);
    await pageBox.selectOption({ label: 'Customer' });
    await clicked(page).getByRole('button', { name: 'Panel, beside this form' }).click();
    await clicked(page).getByRole('button', { name: 'Add an answer' }).click();
    const answers = clicked(page).getByRole('group', { name: 'Its answers go to' });
    await answers.getByRole('combobox', { name: 'This form’s field' }).selectOption({ label: 'Customer' });
    await answers.getByRole('combobox', { name: 'Customer gets' }).selectOption({ label: 'Name' });
    await expect(sayings(clicked(page)).nth(1)).toHaveText('Open Customer in a panel, then put its answer in Customer');
    await look(page, 'open-step');

    // Once it is saved: say so, under it.
    await clicked(page).getByRole('button', { name: 'Add a step once it’s saved' }).click();
    await menu(page).getByRole('menuitem', { name: 'Say something' }).click();
    await expect(clicked(page).getByRole('textbox', { name: 'Words' })).toBeFocused();
    await page.keyboard.type('Customer added');
    await clicked(page).getByRole('combobox', { name: 'Tone' }).selectOption({ label: 'Good news' });

    // The app's action is not wanted: taken away.
    await clicked(page).getByRole('button', { name: 'Remove step 1' }).click();
    await expect(clicked(page).locator('.fd-do-status')).toHaveText('Removed “Run the app’s action button”. Undo');
    await expect(sayings(clicked(page))).toHaveText(['Open Customer in a panel, then put its answer in Customer', 'Say as good news: Customer added']);
    await expect(clicked(page).locator('.fd-do-then .fd-do-say')).toHaveText(['Say as good news: Customer added']);
    expect(await buttonOf(page, 'New customer')).toEqual({
      type: 'button',
      id: expect.any(String),
      label: 'New customer',
      style: 'secondary',
      steps: [{ do: 'open', page: 'customer-card', as: 'panel', into: { [await nameOf(page, 'Customer')]: 'name' }, then: [{ do: 'say', message: 'Customer added', tone: 'success' }] }],
    });
    // On the canvas, the button wears a mark: it does something.
    await expect(page.locator('.fd-canvas-block.fd-button', { hasText: 'New customer' })).toHaveAttribute('data-steps', /./);
    await look(page, 'new-customer-built');

    // A check first: added at the end, then dragged by its grip above the page it opens, at a hand's speed.
    await clicked(page).getByRole('button', { name: 'Add a step', exact: true }).click();
    await menu(page).getByRole('menuitem', { name: 'Check the form' }).click();
    await expect(sayings(clicked(page))).toHaveText(['Open Customer in a panel, then put its answer in Customer', 'Say as good news: Customer added', 'Check the form']);
    const top = clicked(page).locator('.fd-do > .fd-do-holder > .fd-do-list > .fd-do-step');
    const grip = top.nth(1).locator('> .fd-do-head > .fd-do-grip');
    const target = await top.first().boundingBox();
    const from = await grip.boundingBox();
    if (!target || !from) throw new Error('nothing to drag');
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await page.mouse.down();
    const to = { x: from.x + from.width / 2, y: target.y + 4 };
    const steps = Math.max(3, Math.ceil(Math.abs(to.y - from.y) / 50));
    for (let i = 1; i <= steps; i++) await page.mouse.move(to.x, from.y + from.height / 2 + ((to.y - from.y - from.height / 2) * i) / steps);
    await expect(clicked(page).locator('.fd-do-lifted')).toHaveCount(1);
    await screen(page, 'designer-steps-dragging', { viewport: true });
    await page.mouse.up();
    await expect(sayings(clicked(page))).toHaveText(['Check the form', 'Open Customer in a panel, then put its answer in Customer', 'Say as good news: Customer added']);
    expect(((await buttonOf(page, 'New customer'))?.['steps'] as { do: string }[]).map((step) => step.do)).toEqual(['check', 'open']);
    expect(problems).toEqual([]);
  });

  test('the same, by keyboard: the menu by its arrows, a step closed with Escape, moved with Alt+↓, removed, and Undo', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await page.locator('.fd-canvas-field').first().click();
    await addButton(page, 'New customer');
    const add = clicked(page).getByRole('button', { name: 'Add a step', exact: true });
    await panel(page).getByRole('textbox', { name: 'Button words' }).focus();
    for (let i = 0; i < 4 && !(await add.evaluate((b) => b === document.activeElement)); i++) await page.keyboard.press('Tab');
    await expect(add).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(menu(page).getByRole('menuitem', { name: 'Open a page' })).toBeFocused();
    await page.keyboard.press('Enter');
    const pageBox = clicked(page).getByRole('combobox', { name: 'Page' });
    await expect(pageBox).toBeFocused();
    await pageBox.selectOption({ label: 'Customer' });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(clicked(page).getByRole('button', { name: 'Panel, beside this form' })).toBeFocused();
    await page.keyboard.press('Enter');
    const addAnswer = clicked(page).getByRole('button', { name: 'Add an answer' });
    await addAnswer.focus();
    await page.keyboard.press('Enter');
    const answers = clicked(page).getByRole('group', { name: 'Its answers go to' });
    await expect(answers.getByRole('combobox', { name: 'This form’s field' })).toBeFocused();
    await answers.getByRole('combobox', { name: 'This form’s field' }).selectOption({ label: 'Customer' });
    await page.keyboard.press('Tab');
    await answers.getByRole('combobox', { name: 'Customer gets' }).selectOption({ label: 'Name' });
    // Once it is saved: the menu again, down to Say something.
    await clicked(page).getByRole('button', { name: 'Add a step once it’s saved' }).focus();
    await page.keyboard.press('Enter');
    for (let i = 0; i < 7; i++) await page.keyboard.press('ArrowDown');
    await expect(menu(page).getByRole('menuitem', { name: 'Say something' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(clicked(page).getByRole('textbox', { name: 'Words' })).toBeFocused();
    await page.keyboard.type('Customer added');
    // Escape closes the step, back on its sentence.
    await page.keyboard.press('Escape');
    await expect(clicked(page).locator('.fd-do-then .fd-do-say')).toBeFocused();
    await expect(clicked(page).locator('.fd-do-then .fd-do-say')).toHaveAttribute('aria-expanded', 'false');
    // The app's action after the page it opens, by Alt+↓ on its sentence.
    const first = sayings(clicked(page)).first();
    await first.focus();
    await page.keyboard.press('Alt+ArrowDown');
    await expect(sayings(clicked(page))).toHaveText(['Open Customer in a panel, then put its answer in Customer', 'Say: Customer added', 'Run the app’s action button']);
    await expect(sayings(clicked(page)).nth(2)).toBeFocused();
    await look(page, 'keyboard-moved');
    // Taken away from the keyboard; Undo is at hand, and brings it back.
    await page.keyboard.press('Tab');
    await expect(clicked(page).getByRole('button', { name: 'Remove step 2' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(clicked(page).getByRole('button', { name: 'Undo' })).toBeFocused();
    expect((await buttonOf(page, 'New customer'))?.['steps']).toHaveLength(1);
    await page.keyboard.press('Enter');
    expect((await buttonOf(page, 'New customer'))?.['steps']).toHaveLength(2);
    expect(problems).toEqual([]);
  });

  test('When Product changes, run check_stock; before it’s saved, check then ask — seen in the Rules view and the JSON, and undone', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await page.locator('.fd-canvas-field').first().click();
    await addField(page, 'short-answer', 'Product');
    // The field's Rules tab: When it changes.
    await panel(page).getByRole('tab', { name: 'Rules', exact: true }).click();
    const changes = panel(page).locator('[data-setting="When it changes"]');
    await changes.getByRole('button', { name: 'Add a step' }).click();
    await menu(page).getByRole('menuitem', { name: 'Run one of the app’s actions' }).click();
    await expect(changes.getByRole('textbox', { name: 'The app’s action' })).toBeFocused();
    await page.keyboard.type('check_stock');
    await expect(sayings(changes)).toHaveText(['Run the app’s action check_stock']);
    await look(page, 'when-product-changes');
    // On the canvas: Product does something when it changes.
    const product = page.locator('.fd-canvas-field', { hasText: 'Product' });
    await page.locator('.fd-canvas-field').first().click();
    await expect(product.locator('.fd-rule-mark[data-mark="steps"]')).toContainText('1 step');

    // Nothing picked: the page's Rules tab, its moments.
    await page.keyboard.press('Escape');
    await page.locator('.fd-canvas-title, .fd-canvas').first().click({ position: { x: 4, y: 4 } });
    await expect(panel(page).locator('.fd-panel-title')).toHaveText('Screen');
    await panel(page).getByRole('tab', { name: 'Rules', exact: true }).click();
    const before = panel(page).getByRole('group', { name: 'Before it’s saved or sent' });
    await before.getByRole('button', { name: 'Add a step' }).click();
    await menu(page).getByRole('menuitem', { name: 'Check the form' }).click();
    await before.getByRole('button', { name: 'Add a step' }).click();
    await menu(page).getByRole('menuitem', { name: 'Ask Yes or No' }).click();
    await page.keyboard.type('Send the order?');
    await expect(sayings(before)).toHaveText(['Check the form', 'Ask: Send the order?']);
    await look(page, 'before-saved');
    const productName = await nameOf(page, 'Product');
    expect((await built(page))['on']).toEqual({ change: { [productName]: [{ do: 'call', action: 'check_stock' }] }, beforeSave: [{ do: 'check' }, { do: 'ask', message: 'Send the order?' }] });

    // The Rules view lists them as sentences, and one clicked reaches its part.
    await page.locator('.fd-mode [data-mode="rules"]').click();
    const view = page.locator('.fd-rules-view');
    await expect(view.locator('.fd-rules-group-title')).toHaveText(['When it changes', 'At the form’s moments']);
    await expect(view.locator('.fd-rules-steps .fd-rules-item-say')).toHaveText(['Run the app’s action check_stock', 'Check the form\nAsk: Send the order?']);
    await look(page, 'rules-view');
    await view.locator('.fd-rules-steps', { hasText: 'check_stock' }).click();
    await expect(view).toBeHidden();
    await expect(panel(page).locator('[data-setting="When it changes"] .fd-do-say').first()).toBeFocused();

    // The JSON says it as the page keeps it.
    await page.locator('.fd-mode [data-mode="json"]').click();
    const json = page.locator('.fd-json textarea');
    await expect(json).toHaveValue(/"beforeSave": \[\n\s+\{\n\s+"do": "check"\n\s+\},\n\s+\{\n\s+"do": "ask",\n\s+"message": "Send the order\?"/);
    await expect(json).toHaveValue(/"action": "check_stock"/);
    // Its end in view, where the page's moments are.
    await json.evaluate((box) => (box.scrollTop = box.scrollHeight));
    await look(page, 'json');
    await page.locator('.fd-mode [data-mode="design"]').click();

    // Undo: the question goes, then the check.
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(((await built(page))['on'] as Record<string, unknown>)['beforeSave']).toEqual([{ do: 'check' }]);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(((await built(page))['on'] as Record<string, unknown>)['beforeSave']).toBeUndefined();
    expect(problems).toEqual([]);
  });

  test('right to left, in Arabic: the steps editor in Arabic, its sentences running right to left', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?locale=ar&dir=rtl');
    await expect(page.locator('.fd-designer')).toHaveAttribute('dir', 'rtl');
    await page.locator('.fd-canvas-field').first().click();
    await tile(page, 'block:button').click();
    const button = panel(page).locator('[data-setting="When clicked"]');
    await expect(button.locator('.fd-prop-name')).toHaveText('عند النقر');
    await button.getByRole('button', { name: 'إضافة خطوة', exact: true }).click();
    await expect(menu(page).locator('.fd-menu-heading')).toHaveText(['الفتح والإغلاق', 'القيم', 'التحقق والحفظ', 'مخاطبة الشخص', 'التطبيق']);
    await look(page, 'arabic-add-a-step');
    await menu(page).getByRole('menuitem', { name: 'فتح صفحة' }).click();
    await button.getByRole('combobox', { name: 'الصفحة' }).selectOption({ label: 'العميل' });
    await button.getByRole('button', { name: 'لوحة، بجانب هذا النموذج' }).click();
    await button.getByRole('button', { name: 'إضافة إجابة' }).click();
    const answers = button.getByRole('group', { name: 'تذهب إجاباتها إلى' });
    await answers.getByRole('combobox', { name: 'حقل هذا النموذج' }).selectOption({ label: 'العميل' });
    await answers.getByRole('combobox', { name: '«\u2068العميل\u2069» يأخذ' }).selectOption({ label: 'الاسم' });
    await button.getByRole('button', { name: 'إضافة خطوة بعد حفظه' }).click();
    await menu(page).getByRole('menuitem', { name: 'قول شيء' }).click();
    await page.keyboard.type('أُضيف العميل');
    await expect(sayings(button)).toHaveText(['شغّل إجراء التطبيق \u2066button\u2069', 'افتح «\u2068العميل\u2069» في لوحة جانبية، ثم ضع إجابتها في «\u2068العميل\u2069»', 'قل: أُضيف العميل']);
    // The sentences run right to left: each one's start at the right.
    const say = sayings(button).nth(1);
    expect(await say.evaluate((e) => getComputedStyle(e).direction)).toBe('rtl');
    const [box, arrow] = await Promise.all([say.boundingBox(), say.evaluate((e) => { const r = e.querySelector('.fd-do-words')?.getBoundingClientRect(); return r ? r.right : 0; })]);
    expect(arrow).toBeLessThanOrEqual((box?.x ?? 0) + (box?.width ?? 0));
    await look(page, 'arabic-built');
    expect(problems).toEqual([]);
  });

  test('at a phone’s width: the panel’s steps fit, nothing scrolls sideways', async ({ page }) => {
    const problems = watch(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/screen/');
    await page.locator('.fd-canvas-field').first().click();
    await tile(page, 'block:button').click();
    const button = clicked(page);
    await button.getByRole('button', { name: 'Add a step', exact: true }).click();
    await menu(page).getByRole('menuitem', { name: 'Open a page' }).click();
    await button.getByRole('combobox', { name: 'Page' }).selectOption({ label: 'Customer' });
    await button.getByRole('button', { name: 'Add a value' }).click();
    await button.getByRole('button', { name: 'Add an answer' }).click();
    await button.scrollIntoViewIfNeeded();
    await expectNoSidewaysScroll(page);
    // Each control of the open step inside the panel.
    const outside = await button.evaluate((row) => {
      const edge = row.getBoundingClientRect();
      return [...row.querySelectorAll<HTMLElement>('input, select, button')].filter((c) => c.offsetParent && (c.getBoundingClientRect().right > edge.right + 1 || c.getBoundingClientRect().left < edge.left - 1)).map((c) => c.getAttribute('aria-label') ?? c.textContent);
    });
    expect(outside).toEqual([]);
    await page.waitForTimeout(150);
    await screen(page, 'designer-steps-phone', { viewport: true });
    expect(problems).toEqual([]);
  });
});

