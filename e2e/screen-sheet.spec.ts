import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, screen } from './support';

/** A record sheet built in the screen editor: a title, a section, tabs with their own sections; previewed, published, reopened. */
const card = (page: Page, label: string) => page.locator('.fd-canvas-field').filter({ has: page.locator('.fd-label', { hasText: new RegExp(`^${label}$`) }) });
const tabs = (page: Page) => page.locator('.fd-canvas-tabs [role="tab"]');

async function addField(page: Page, kind: string, label: string) {
  await page.locator(`.fd-palette-item[data-kind="${kind}"]`).click();
  await expect(page.getByRole('textbox', { name: 'Label' })).toBeFocused();
  await page.keyboard.type(label);
  await expect(card(page, label)).toBeVisible();
}

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
    await page.getByRole('textbox', { name: 'Links to' }).fill('company');

    await page.getByRole('button', { name: 'Add tabs' }).click();
    await expect(page.getByRole('button', { name: 'Add tabs' })).toBeHidden();
    await expect(tabs(page)).toHaveText(['Tab 1']);
    await page.getByRole('textbox', { name: 'Tab label' }).fill('Contacts');
    await addField(page, 'short-answer', 'Contact person');
    await page.getByRole('button', { name: 'Add tab', exact: true }).click();
    await page.getByRole('textbox', { name: 'Tab label' }).fill('Notes');
    await addField(page, 'paragraph', 'Internal notes');
    // A table of lines, the grid where the app has it, with a column of its own.
    await addField(page, 'lines', 'Order lines');
    await page.getByRole('button', { name: 'Add column' }).click();
    await page.getByRole('textbox', { name: 'Column 3' }).fill('Unit price');
    await page.getByRole('combobox', { name: 'Kind of column 3' }).selectOption('number');
    await expect(card(page, 'Order lines').locator('th')).toContainText(['Description', 'Quantity', 'Unit price']);
    await expect(tabs(page)).toHaveText(['Contacts', 'Notes']);
    await expect(tabs(page).nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(card(page, 'Contact person')).toHaveCount(0);

    // The strip sits over its tab's section, inside the tabs' frame, under the first section.
    const strip = (await page.locator('.fd-canvas-tabs-head').boundingBox())!;
    const inside = (await page.locator('.fd-canvas-tab-panel .fd-canvas-section').boundingBox())!;
    const frame = (await page.locator('.fd-canvas-tabs').boundingBox())!;
    const first = (await page.locator('.fd-canvas-sections > .fd-canvas-section').first().boundingBox())!;
    expect(inside.y, 'the section is not under the strip').toBeGreaterThanOrEqual(strip.y + strip.height);
    expect(inside.x, 'the section is outside the tabs').toBeGreaterThan(frame.x);
    expect(inside.x + inside.width).toBeLessThan(frame.x + frame.width);
    expect(frame.y, 'the tabs are not under the first section').toBeGreaterThan(first.y + first.height);
    await expectNoSidewaysScroll(page);
    await screen(page, 'screen-sheet-built', { viewport: true });

    await tabs(page).first().click();
    await expect(card(page, 'Contact person')).toBeVisible();
    await expect(card(page, 'Internal notes')).toHaveCount(0);

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
    await expect(card(page, 'Email')).toBeVisible();
    await expect(card(page, 'Contact person')).toBeVisible();
    await expect(card(page, 'Company')).toBeVisible();
    await tabs(page).nth(1).click();
    await expect(card(page, 'Order lines').locator('th')).toContainText(['Description', 'Quantity', 'Unit price']);
    const saved = await page.evaluate(() => {
      const built = (window as any).fieldiaDesigner.designer.getPage();
      return Object.values(built.fields).map((f: any) => `${f.label}:${f.type}${f.relation ? `>${f.relation}` : ''}`);
    });
    expect(saved).toEqual(expect.arrayContaining(['Company:many2one>company', 'Order lines:one2many>line']));
    await screen(page, 'screen-sheet-reopened', { viewport: true });
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');
    expect(problems).toEqual([]);
  });
});
