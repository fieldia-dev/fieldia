import { expect, test, type Page } from '@playwright/test';
import { addField, cardOf, publish, tile } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/** A record sheet built in the screen editor: a title, a section, tabs with their own sections; previewed, published, reopened. */
const tabs = (page: Page) => page.locator('.fd-canvas-tabs [role="tab"]');
const panel = (page: Page) => page.locator('.fd-properties');

test.describe('screen designer · record sheet', () => {
  test('builds a sheet with a title and tabs, previews it, publishes it and opens it again', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await page.goto('/screen/?start=sheet');
    await expect(page.locator('.fd-canvas-title')).toHaveText('Name');
    await expect(page.getByRole('combobox', { name: 'Layout' })).toHaveValue('sheet');

    // Two fields in a row: the cursor goes to each new label.
    await addField(page, 'email', 'Email');
    await addField(page, 'phone', 'Phone');
    // A link to another record, pointed at its model.
    await addField(page, 'link', 'Company');
    await panel(page).getByRole('textbox', { name: 'Links to' }).fill('company');

    await tile(page, 'layout:tabs').click();
    await expect(tile(page, 'layout:tabs')).toBeHidden();
    await expect(tabs(page)).toHaveText(['Tab 1']);
    await panel(page).getByRole('textbox', { name: 'Tab label' }).fill('Contacts');
    await addField(page, 'short-answer', 'Contact person');
    await page.getByRole('button', { name: 'Add a tab', exact: true }).click();
    await panel(page).getByRole('textbox', { name: 'Tab label' }).fill('Notes');
    await addField(page, 'paragraph', 'Internal notes');
    // A table of lines, the grid where the app has it, with a column of its own.
    await addField(page, 'lines', 'Order lines');
    await panel(page).getByRole('button', { name: 'Add column' }).click();
    await panel(page).getByRole('textbox', { name: 'Column 3' }).fill('Unit price');
    await panel(page).getByRole('combobox', { name: 'Kind of column 3' }).selectOption('number');
    await expect((await cardOf(page, 'Order lines')).locator('th')).toContainText(['Description', 'Quantity', 'Unit price']);
    await expect(tabs(page)).toHaveText(['Contacts', 'Notes']);
    await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(await cardOf(page, 'Contact person')).toHaveCount(0);

    // The strip sits over its tab's section, inside the tabs, under the first section.
    const strip = (await page.locator('.fd-canvas-tabs-head').boundingBox())!;
    const inside = (await page.locator('.fd-canvas-tabs .fd-tabpanel .fd-canvas-section').boundingBox())!;
    const frame = (await page.locator('.fd-canvas-tabs').boundingBox())!;
    const first = (await page.locator('.fd-canvas-body > .fd-canvas-section').first().boundingBox())!;
    expect(inside.y, 'the section is not under the strip').toBeGreaterThanOrEqual(strip.y + strip.height);
    expect(inside.x, 'the section is outside the tabs').toBeGreaterThanOrEqual(frame.x);
    expect(inside.x + inside.width).toBeLessThanOrEqual(frame.x + frame.width + 1);
    expect(frame.y, 'the tabs are not under the first section').toBeGreaterThan(first.y + first.height);
    await expectNoSidewaysScroll(page);
    await screen(page, 'screen-sheet-built', { viewport: true });

    await tabs(page).first().click();
    await expect(await cardOf(page, 'Contact person')).toBeVisible();
    await expect(await cardOf(page, 'Internal notes')).toHaveCount(0);

    // The preview is the real sheet: its title, and its tabs.
    await page.getByRole('button', { name: 'Try it' }).click();
    const preview = page.locator('.fd-try');
    await expect(preview.locator('[data-node="#title"] input')).toHaveAttribute('placeholder', 'Name');
    await expect(preview.getByRole('tab')).toHaveText(['Contacts', 'Notes']);
    await expect(preview.getByLabel('Contact person')).toBeVisible();
    await expect(preview.locator('[data-type="many2one"] .fd-label')).toHaveText('Company');
    await preview.getByRole('tab', { name: 'Notes' }).click();
    await expect(preview.locator('[data-type="one2many"] th')).toContainText(['Description', 'Quantity', 'Unit price']);
    await screen(page, 'screen-sheet-preview', { viewport: true });
    await page.getByRole('button', { name: 'Design', exact: true }).click();

    await publish(page, 1);
    await page.evaluate(() => (window as any).fieldiaDesigner.reopen());
    await expect(page.locator('.fd-canvas-title')).toHaveText('Name');
    await expect(tabs(page)).toHaveText(['Contacts', 'Notes']);
    await expect(await cardOf(page, 'Email')).toBeVisible();
    await expect(await cardOf(page, 'Contact person')).toBeVisible();
    await expect(await cardOf(page, 'Company')).toBeVisible();
    await tabs(page).nth(1).click();
    await expect((await cardOf(page, 'Order lines')).locator('th')).toContainText(['Description', 'Quantity', 'Unit price']);
    const saved = await page.evaluate(() => {
      const built = (window as any).fieldiaDesigner.designer.getPage();
      return Object.values(built.fields).map((f: any) => `${f.label}:${f.type}${f.relation ? `>${f.relation}` : ''}`);
    });
    expect(saved).toEqual(expect.arrayContaining(['Company:many2one>company', 'Order lines:one2many>line']));
    await screen(page, 'screen-sheet-reopened', { viewport: true });
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');
    expect(problems).toEqual([]);
  });

  test('drags a field onto a tab, which opens, and into its section', async ({ page }) => {
    await page.goto('/screen/?start=sheet');
    await page.evaluate(() => {
      const { designer } = (window as any).fieldiaDesigner;
      const email = designer.addQuestion('email', { parent: 'section-1' });
      designer.updateQuestion(email, { label: 'Email' });
      const tabs = designer.addTabs();
      const block = designer.getPage().layout.children.find((n: any) => n.id === tabs);
      designer.renameContainer(block.children[0].id, 'Contacts');
      const notes = designer.addTab(tabs, 'Notes');
      const inNotes = designer.getPage().layout.children.find((n: any) => n.id === tabs).children[1].children[0].id;
      designer.updateQuestion(designer.addQuestion('paragraph', { parent: inNotes }), { label: 'Internal notes' });
      designer.select(null);
      void notes;
    });
    await expect(tabs(page)).toHaveText(['Contacts', 'Notes']);
    await tabs(page).first().click();
    const email = (await (await cardOf(page, 'Email')).boundingBox())!;
    const notesTab = (await tabs(page).nth(1).boundingBox())!;
    const from = { x: email.x + 60, y: email.y + 14 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    const over = { x: notesTab.x + notesTab.width / 2, y: notesTab.y + notesTab.height / 2 };
    for (let i = 1; i <= 14; i++) await page.mouse.move(from.x + ((over.x - from.x) * i) / 14, from.y + ((over.y - from.y) * i) / 14, { steps: 3 });
    // Resting on the tab opens it.
    await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    const notes = (await (await cardOf(page, 'Internal notes')).boundingBox())!;
    // Into the place to drop last, drawn in the gap under the section.
    await page.mouse.move(notes.x + notes.width - 20, notes.y + notes.height + 10, { steps: 8 });
    await page.mouse.up();
    const where = await page.evaluate(() => {
      const built = (window as any).fieldiaDesigner.designer.getPage();
      const tabsNode = built.layout.children.find((n: any) => n.type === 'tabs');
      return tabsNode.children[1].children[0].children.map((n: any) => built.fields[n.field].label);
    });
    expect(where).toEqual(['Internal notes', 'Email']);
  });
});

test.describe('screen designer · a record’s header', () => {
  test('builds the header by hand — buttons, status steps, a counter, a badge — and it works the same when tried', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await page.goto('/screen/?start=sheet');
    const panel = page.locator('.fd-properties');
    await page.locator('[data-add-part="button"]').click();
    await page.keyboard.type('Activate');
    await panel.getByLabel('Look').selectOption('primary');
    await page.locator('[data-add-part="button"]').click();
    await page.keyboard.type('Block');
    await page.locator('[data-add-part="statusbar"]').click();
    await page.getByRole('menuitemradio', { name: 'Status' }).click();
    await panel.getByLabel('People can click a step').check();
    await page.locator('[data-add-part="stat"]').click();
    await page.keyboard.type('Invoices');
    await panel.getByLabel('Number from').selectOption({ label: 'Invoices' });
    await page.locator('[data-add-part="badge"]').click();
    await page.keyboard.type('Key account');
    await panel.getByLabel('Tone').selectOption('success');
    await page.keyboard.press('Escape');
    const header = page.locator('.fd-canvas-header');
    await expect(header.locator('.fd-button')).toHaveText(['Activate', 'Block']);
    await expect(header.locator('.fd-button').first()).toHaveClass(/fd-button-primary/);
    await expect(page.locator('.fd-canvas .fd-badge')).toHaveText('Key account');
    await expect(page.locator('.fd-canvas .fd-stat-label')).toHaveText('Invoices');
    // Block goes first, from its bar.
    await header.locator('.fd-button', { hasText: 'Block' }).click();
    await page.locator('.fd-canvas-part.fd-editing').getByRole('button', { name: 'Move left' }).click();
    await expect(header.locator('.fd-canvas-part').first().locator('input')).toHaveValue('Block');
    await screen(page, 'screen-header-built', { viewport: true });

    // Tried, the header is the viewer's own, and the steps can be clicked.
    await page.getByRole('button', { name: 'Try it' }).click();
    const tried = page.locator('.fd-try');
    // The page's own buttons, beside the viewer's Save and Discard.
    await expect(tried.locator('.fd-header .fd-button[data-node]')).toHaveText(['Block', 'Activate']);
    await expect(tried.locator('.fd-badge')).toHaveText('Key account');
    await expect(tried.locator('.fd-statusbar')).toContainText('Blocked');
    await screen(page, 'screen-header-tried', { viewport: true });
    await page.getByRole('button', { name: 'Design', exact: true }).click();

    // Published and opened again, the header is all there.
    await publish(page, 1);
    await page.evaluate(() => window.fieldiaDesigner.reopen());
    await expect(page.locator('.fd-canvas-header .fd-button')).toHaveText(['Block', 'Activate']);
    await expect(page.locator('.fd-canvas [data-part="#statusbar"]')).toContainText('Draft');
    expect(problems).toEqual([]);
  });
});

test.describe('screen designer · outline and data', () => {
  test('the page as a tree to pick from, the model’s fields, and a made-up record filling the sheet', async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    await page.goto('/screen/?start=sheet');
    for (const spec of ['model:email', 'model:phone', 'model:credit_limit', 'model:country_id']) await tile(page, spec).click();
    await page.keyboard.press('Escape');

    // Data: the model's fields, and a made-up customer on the canvas.
    await page.getByRole('tab', { name: 'Data' }).click();
    await expect(page.locator('.fd-data-count')).toHaveText('12 fields · 5 on this page');
    await page.getByRole('button', { name: 'Record 1' }).click();
    const email = (await cardOf(page, 'Email')).locator('input');
    await expect(email).toHaveValue('hello@acme.example');
    await screen(page, 'screen-data-sample', { viewport: true });

    // Outline: the sheet as a tree; a pick opens the field.
    await page.getByRole('tab', { name: 'Outline' }).click();
    await expect(page.locator('.fd-outline [data-pick] .fd-outline-label')).toHaveText(['Untitled section', 'Email', 'Phone', 'Credit limit', 'Country']);
    await page.locator('.fd-outline [data-pick]').filter({ hasText: 'Credit limit' }).click();
    await expect(await cardOf(page, 'Credit limit')).toHaveClass(/fd-editing/);
    await screen(page, 'screen-outline', { viewport: true });
    expect(problems).toEqual([]);
  });
});
