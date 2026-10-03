import { expect, test, type Page } from '@playwright/test';
import { addField, cardOf, tile } from './designer-support';
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
    await page.getByRole('button', { name: 'Preview' }).click();
    const preview = page.locator('.fd-screen-preview');
    await expect(preview.locator('[data-node="#title"] input')).toHaveAttribute('placeholder', 'Name');
    await expect(preview.getByRole('tab')).toHaveText(['Contacts', 'Notes']);
    await expect(preview.getByLabel('Contact person')).toBeVisible();
    await expect(preview.locator('[data-type="many2one"] .fd-label')).toHaveText('Company');
    await preview.getByRole('tab', { name: 'Notes' }).click();
    await expect(preview.locator('[data-type="one2many"] th')).toContainText(['Description', 'Quantity', 'Unit price']);
    await screen(page, 'screen-sheet-preview', { viewport: true });
    await page.getByRole('button', { name: 'Preview' }).click();

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');
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
