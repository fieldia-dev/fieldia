import { expect, test, type Page } from '@playwright/test';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Lay out an app screen the way a person would: drag cards on the canvas,
 * pull their edges, pick fields from the palette, change them in the
 * properties panel — with a real mouse on a real Grafloria board.
 */

const card = (page: Page, label: string) => page.locator('.fd-canvas-field').filter({ has: page.locator('.fd-label', { hasText: new RegExp(`^${label}$`) }) });

/** Each section's fields as "Label:width", read from the page being built. */
const layout = (page: Page) =>
  page.evaluate(() => {
    const built = (window as any).fieldiaDesigner.designer.getPage();
    return built.layout.children.map((s: any) => s.children.map((n: any) => `${built.fields[n.field].label}:${n.colspan ?? 1}`));
  });

/** Press, move in steps at hand speed, release. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 10;
  for (let i = 1; i <= steps; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps, { steps: 3 });
  await page.mouse.up();
}

test.describe('screen designer', () => {
  test.beforeEach(async ({ page }) => {
    const problems: string[] = [];
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
    await page.goto('/screen/');
    await expect(page.locator('.fd-canvas-field')).toHaveCount(6);
    (page as unknown as { problems: string[] }).problems = problems;
  });
  test.afterEach(async ({ page }) => {
    expect((page as unknown as { problems: string[] }).problems).toEqual([]);
  });

  test('drags a card to reorder, pulls an edge to widen, one undo step each', async ({ page }) => {
    await screen(page, 'screen-start');
    await expectNoSidewaysScroll(page);
    expect(await layout(page)).toEqual([
      ['Customer:1', 'Visit date:1', 'Notes:2'],
      ['Next step:1', 'Due by:1', 'Manager to call?:1'],
    ]);

    // Notes, dragged by its label onto Customer, goes first.
    const notes = (await card(page, 'Notes').boundingBox())!;
    const customer = (await card(page, 'Customer').boundingBox())!;
    await drag(page, { x: notes.x + 80, y: notes.y + 14 }, { x: notes.x + 80, y: customer.y + 10 });
    await expect.poll(() => layout(page)).toEqual([
      ['Notes:2', 'Customer:1', 'Visit date:1'],
      ['Next step:1', 'Due by:1', 'Manager to call?:1'],
    ]);
    // The canvas is laid out again where the viewer will put each field.
    // A card is briefly gone while its board is rebuilt, so read both boxes in one go.
    const gap = async () => {
      const [top, below] = [await card(page, 'Notes').boundingBox(), await card(page, 'Customer').boundingBox()];
      return top && below ? below.y - top.y : 0;
    };
    await expect.poll(gap).toBeGreaterThan(150);
    await screen(page, 'screen-dragged');

    // Undo from the keyboard, with focus on nothing in particular.
    await page.locator('.fd-designer-status').click();
    const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(() => layout(page)).toEqual([
      ['Customer:1', 'Visit date:1', 'Notes:2'],
      ['Next step:1', 'Due by:1', 'Manager to call?:1'],
    ]);

    // Customer, pulled by its corner across the section, takes both columns.
    // The card itself is inert; the board's widget around it takes the press.
    await page.getByRole('group', { name: /^Customer, column 1/ }).click();
    const box = (await card(page, 'Customer').boundingBox())!;
    const section = (await page.locator('.fd-canvas-section').first().boundingBox())!;
    await drag(page, { x: box.x + box.width - 3, y: box.y + box.height - 3 }, { x: section.x + section.width - 20, y: box.y + box.height - 3 });
    await expect.poll(() => layout(page)).toEqual([
      ['Customer:2', 'Visit date:1', 'Notes:2'],
      ['Next step:1', 'Due by:1', 'Manager to call?:1'],
    ]);
    await expect(page.getByLabel('Width')).toHaveValue('2');
    await screen(page, 'screen-widened');
  });

  test('drops a card on the spare row to put it last', async ({ page }) => {
    const followUp = page.locator('.fd-canvas-section').nth(1);
    const next = (await card(page, 'Next step').boundingBox())!;
    const board = (await followUp.locator('.fd-canvas-board').boundingBox())!;
    await drag(page, { x: next.x + 60, y: next.y + 14 }, { x: next.x + 60, y: board.y + board.height - 50 });
    await expect.poll(async () => (await layout(page))[1]).toEqual(['Due by:1', 'Manager to call?:1', 'Next step:1']);
  });

  test('adds a field from the palette and changes it in the properties panel', async ({ page }) => {
    await page.locator('.fd-canvas-section').nth(1).getByRole('button', { name: 'Follow-up' }).click();
    await expect(page.getByLabel('Section title')).toHaveValue('Follow-up');
    await page.getByRole('complementary', { name: 'Add a field' }).getByRole('button', { name: 'Rating' }).click();
    await expect(page.getByLabel('Label')).toBeFocused();
    await page.keyboard.type('Visit score');
    await expect(card(page, 'Visit score')).toBeVisible();
    await expect(card(page, 'Visit score').locator('.fd-rating')).toBeVisible();

    await page.getByLabel('Required').check();
    await expect(card(page, 'Visit score')).toHaveClass(/fd-required/);
    await page.getByLabel('Help text').fill('From 1 to 5');
    await expect(card(page, 'Visit score').locator('.fd-help')).toHaveText('From 1 to 5');
    await page.getByLabel('Width').selectOption({ label: '2 columns (full width)' });
    expect((await layout(page))[1]).toEqual(['Next step:1', 'Due by:1', 'Manager to call?:1', 'Visit score:2']);
    await screen(page, 'screen-properties');

    // Into the other section, then out of the page.
    await page.getByLabel('Section').selectOption({ label: 'Visit' });
    expect((await layout(page))[0]).toEqual(['Customer:1', 'Visit date:1', 'Notes:2', 'Visit score:2']);
    await expect(page.locator('.fd-canvas-section').first().locator('.fd-canvas-field')).toHaveCount(4);
    await page.getByRole('button', { name: 'Delete field' }).click();
    await expect(card(page, 'Visit score')).toHaveCount(0);
    await expect(page.locator('.fd-properties-hint')).toBeVisible();
  });

  test('adds a section, previews the screen, and publishes it', async ({ page }) => {
    await page.getByRole('button', { name: 'Add section' }).click();
    await page.getByLabel('Section title').fill('Photos');
    await page.getByLabel('Columns').selectOption('1');
    const photos = page.locator('.fd-canvas-section').nth(2);
    await expect(photos.locator('.fd-canvas-section-title')).toHaveText('Photos');
    await expect(photos.locator('.fd-canvas-empty')).toBeVisible();
    await page.getByRole('complementary', { name: 'Add a field' }).getByRole('button', { name: 'File upload' }).click();
    await page.keyboard.type('Photo of the site');
    await expect(photos.locator('.fd-canvas-field')).toHaveCount(1);
    await screen(page, 'screen-new-section');

    await page.getByRole('button', { name: 'Preview' }).click();
    const preview = page.locator('.fd-screen-preview');
    await expect(preview.locator('.fd-label')).toHaveText(['Customer', 'Visit date', 'Notes', 'Next step', 'Due by', 'Manager to call?', 'Photo of the site']);
    await preview.getByLabel('Customer').fill('Nile Towers');
    await expect(preview.getByLabel('Customer')).toHaveValue('Nile Towers');
    await screen(page, 'screen-preview');
    await page.getByRole('button', { name: 'Preview' }).click();
    await expect(page.locator('.fd-canvas-field')).toHaveCount(7);

    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.fd-designer-status')).toHaveText('Published · version 1');
  });

  test('drags a field into another section, where the line shows, as one undo step', async ({ page }) => {
    const customer = (await card(page, 'Customer').boundingBox())!;
    const dueBy = (await card(page, 'Due by').boundingBox())!;
    // Down out of its section, onto the start of "Due by" in the next one.
    const from = { x: customer.x + 60, y: customer.y + 14 };
    const to = { x: dueBy.x + 30, y: dueBy.y + 30 };
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= 16; i++) await page.mouse.move(from.x + ((to.x - from.x) * i) / 16, from.y + ((to.y - from.y) * i) / 16, { steps: 3 });
    // The card follows the pointer, the section it is over says so, and a line says where it lands.
    await expect(page.locator('.fd-drag-ghost')).toBeVisible();
    await expect(page.locator('.fd-canvas-section.fd-drop-target .fd-canvas-section-title')).toHaveText('Follow-up');
    const line = (await page.locator('.fd-drop-marker').boundingBox())!;
    expect(Math.abs(line.x + line.width - dueBy.x), 'the line is not at the start of "Due by"').toBeLessThan(8);
    await screen(page, 'screen-drag-across', { viewport: true });
    await page.mouse.up();
    await expect.poll(() => layout(page)).toEqual([
      ['Visit date:1', 'Notes:2'],
      ['Next step:1', 'Customer:1', 'Due by:1', 'Manager to call?:1'],
    ]);
    await expect(page.locator('.fd-drag-ghost, .fd-drop-marker')).toHaveCount(0);
    await expect(card(page, 'Customer')).toBeVisible();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => layout(page)).toEqual([
      ['Customer:1', 'Visit date:1', 'Notes:2'],
      ['Next step:1', 'Due by:1', 'Manager to call?:1'],
    ]);
  });

  test('every kind of field fits its card, help text and all', async ({ page }) => {
    await page.goto('/screen/?start=blank');
    // Every kind the palette offers, so a kind added later is checked too.
    const kinds = await page.locator('.fd-palette-item').evaluateAll((items) => items.map((item) => (item as HTMLElement).dataset['kind'] as string));
    expect(kinds.length).toBeGreaterThanOrEqual(24);
    await page.evaluate((kinds) => {
      const { designer } = (window as any).fieldiaDesigner;
      for (const kind of kinds) {
        const id = designer.addQuestion(kind, { parent: 'section-1' });
        designer.updateQuestion(id, { label: `A ${kind} question`, help: 'Some help for this field', required: true });
        if (kind === 'multiple-choice' || kind === 'checkboxes') designer.setOptions(id, ['First option', 'Second option', 'Third option', 'Fourth option']);
      }
      designer.select(null);
    }, kinds);
    await expect(page.locator('.fd-canvas-field')).toHaveCount(kinds.length);
    const clipped = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.fd-canvas-field')]
          // Clipped by its card, or squeezed inside it: a widget that scrolls, as a statusbar does, shrinks rather than overflow.
          .filter((card) => card.scrollHeight > card.clientHeight + 1 || [...card.children].some((part) => part.scrollHeight > part.clientHeight + 1))
          .map((card) => card.querySelector('.fd-label')?.textContent)
      );
    await expect.poll(clipped).toEqual([]);
    await screen(page, 'screen-every-kind');

    // Narrower, the same content wraps onto more lines: the cards still hold it.
    await page.setViewportSize({ width: 900, height: 900 });
    await expect.poll(clipped).toEqual([]);
    await expectNoSidewaysScroll(page);
    await screen(page, 'screen-every-kind-narrow');
  });
});
