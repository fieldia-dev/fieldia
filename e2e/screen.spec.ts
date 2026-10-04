import { expect, test, type Page } from '@playwright/test';
import { addField, cardOf, drag, dragToward, editing, layout, publish, tile, watch } from './designer-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Lay out an app screen the way a person would: fields dragged about the
 * canvas and in from the toolbox, edited where they stand, the rest in the
 * panel — with a real mouse and keyboard.
 */

const start = [
  ['Customer:1', 'Visit date:1', 'Notes:2'],
  ['Next step:1', 'Due by:1', 'Manager to call?:1'],
];
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
const box = async (page: Page, label: string) => (await (await cardOf(page, label)).boundingBox())!;

test.describe('screen designer', () => {
  let problems: string[] = [];
  test.beforeEach(async ({ page }) => {
    problems = watch(page);
    await page.goto('/screen/');
    await expect(page.locator('.fd-canvas-field')).toHaveCount(6);
  });
  test.afterEach(() => expect(problems).toEqual([]));

  test('drags a field within its section and into another, a gap opening where it lands, one undo step each', async ({ page }) => {
    await screen(page, 'screen-start');
    await expectNoSidewaysScroll(page);
    expect(await layout(page)).toEqual(start);

    // Notes, dragged by its label onto the start of Customer, goes first.
    const notes = await box(page, 'Notes');
    const customer = await box(page, 'Customer');
    await drag(page, { x: notes.x + 40, y: notes.y + 12 }, { x: customer.x + 20, y: customer.y + 20 }, { release: false });
    // A chip with its name follows the pointer; a gap as wide as Notes opens first in the section.
    await expect(page.locator('.fd-drag-chip')).toHaveText('Notes');
    const gap = (await page.locator('.fd-drop-slot').boundingBox())!;
    expect(Math.abs(gap.x - customer.x), 'the gap is not where Customer was').toBeLessThan(12);
    expect(gap.width, 'the gap is not as wide as Notes').toBeGreaterThan(notes.width - 30);
    await screen(page, 'screen-drag-gap', { viewport: true });
    await page.mouse.up();
    await expect.poll(() => layout(page)).toEqual([['Notes:2', 'Customer:1', 'Visit date:1'], start[1]]);
    await expect(page.locator('.fd-drag-ghost, .fd-drop-slot')).toHaveCount(0);
    // The canvas is the viewer's grid: Notes takes the whole row, Customer goes under it.
    await expect.poll(async () => (await box(page, 'Customer')).y - (await box(page, 'Notes')).y).toBeGreaterThan(60);
    await page.locator('.fd-designer-status').click();
    await page.keyboard.press(`${mod}+z`);
    await expect.poll(() => layout(page)).toEqual(start);

    // Customer, down out of its section onto the start of "Due by", wherever Due by is as the gap travels.
    const from = await box(page, 'Customer');
    await dragToward(page, { x: from.x + 40, y: from.y + 12 }, async () => { const d = await box(page, 'Due by'); return { x: d.x + 20, y: d.y + 24 }; }, { release: false });
    await expect(page.locator('.fd-canvas-section.fd-drop-target .fd-canvas-section-title')).toHaveText('Follow-up');
    // The gap sits right before Due by.
    await expect(page.locator('.fd-drop-slot + .fd-canvas-field .fd-label')).toHaveText('Due by');
    await screen(page, 'screen-drag-across', { viewport: true });
    await page.mouse.up();
    await expect.poll(() => layout(page)).toEqual([['Visit date:1', 'Notes:2'], ['Next step:1', 'Customer:1', 'Due by:1', 'Manager to call?:1']]);
    // A dragged field is picked, open where it landed.
    await expect(editing(page).label).toHaveValue('Customer');
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => layout(page)).toEqual(start);
  });

  test('drops a field after the last one in a section', async ({ page }) => {
    const next = await box(page, 'Next step');
    const last = await box(page, 'Manager to call?');
    await drag(page, { x: next.x + 40, y: next.y + 12 }, { x: last.x + 200, y: last.y + last.height + 6 });
    await expect.poll(async () => (await layout(page))[1]).toEqual(['Due by:1', 'Manager to call?:1', 'Next step:1']);
  });

  test('drags a tile in from the toolbox to a place on the canvas, its name ready to be typed', async ({ page }) => {
    const rating = (await tile(page, 'kind:rating').boundingBox())!;
    await dragToward(page, { x: rating.x + rating.width / 2, y: rating.y + 20 }, async () => { const d = await box(page, 'Due by'); return { x: d.x + 20, y: d.y + 24 }; }, { release: false });
    await expect(page.locator('.fd-drag-chip')).toHaveText('Rating');
    await expect(page.locator('.fd-drop-slot + .fd-canvas-field .fd-label')).toHaveText('Due by');
    await page.mouse.up();
    await expect(editing(page).label).toBeFocused();
    await page.keyboard.type('Visit score');
    await expect.poll(async () => (await layout(page))[1]).toEqual(['Next step:1', 'Visit score:1', 'Due by:1', 'Manager to call?:1']);
    await expect(editing(page).card.locator('.fd-rating')).toBeVisible();
    // A drop is one step back.
    await page.getByRole('button', { name: 'Undo' }).click();
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect.poll(() => layout(page)).toEqual(start);
  });

  test('edits a field where it stands: its words, then the bar on it', async ({ page }) => {
    await (await cardOf(page, 'Customer')).locator('.fd-label').click();
    const { card, label, help } = editing(page);
    await expect(label).toBeFocused();
    await page.keyboard.press(`${mod}+a`);
    await page.keyboard.type('Customer name');
    await page.keyboard.press('Enter');
    await expect(help).toBeFocused();
    await page.keyboard.type('Who we visited');
    // The panel follows what is typed on the canvas.
    await expect(page.locator('.fd-properties').getByRole('textbox', { name: 'Label' })).toHaveValue('Customer name');
    await expect(page.locator('.fd-properties').getByRole('textbox', { name: 'Help text' })).toHaveValue('Who we visited');

    await card.getByRole('button', { name: 'Required' }).click();
    await expect(card).toHaveClass(/fd-required/);
    await card.getByRole('button', { name: 'Width' }).click();
    await page.getByRole('menuitemradio', { name: 'Full width' }).click();
    await expect.poll(async () => (await layout(page))[0]).toEqual(['Customer name:2', 'Visit date:1', 'Notes:2']);
    await card.getByRole('button', { name: 'Show as: Short answer' }).click();
    await expect(page.getByRole('menu')).toContainText('Made on this page, so it can be any kind');
    await screen(page, 'screen-show-as', { viewport: true });
    await page.getByRole('menuitemradio', { name: 'Email' }).click();
    await expect(page.locator('.fd-properties').getByRole('combobox', { name: 'Shown as' })).toHaveValue('email');
    await expect(card.getByRole('button', { name: 'Show as: Email' })).toBeVisible();
    await screen(page, 'screen-edit-in-place', { viewport: true });

    // Escape puts it down; the page shows it as people will see it.
    await page.keyboard.press('Escape');
    await expect(page.locator('.fd-editing')).toHaveCount(0);
    await expect((await cardOf(page, 'Customer name')).locator('.fd-help')).toHaveText('Who we visited');
  });

  test('types a choice’s options in place, Enter for the next', async ({ page }) => {
    await (await cardOf(page, 'Next step')).click();
    const options = editing(page).card.locator('.fd-q-option input');
    await expect(options).toHaveCount(3);
    await options.nth(2).click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(options).toHaveCount(4);
    await expect(options.nth(3)).toBeFocused();
    await page.keyboard.type('Ask a colleague');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await expect(options).toHaveCount(4);
    const labels = await page.evaluate(() => {
      const built = window.fieldiaDesigner.designer.getPage();
      const node = built.layout.children[1].children?.[0];
      return built.fields[node?.field ?? '']?.options?.map((o) => o.label);
    });
    expect(labels).toEqual(['Send a quote', 'Book a second visit', 'Close', 'Ask a colleague']);
    await screen(page, 'screen-options-in-place', { viewport: true });
  });

  test('moves the field picked with Alt and an arrow, and takes it away with Delete', async ({ page }) => {
    await (await cardOf(page, 'Customer')).click();
    // Out of its words, the field still picked: a click in its own corner, clear of the label being typed in.
    const picked = (await page.locator('.fd-canvas-field.fd-editing').boundingBox())!;
    await page.mouse.click(picked.x + picked.width - 4, picked.y + picked.height - 4);
    await page.keyboard.press('Alt+ArrowDown');
    await expect.poll(async () => (await layout(page))[0]).toEqual(['Visit date:1', 'Customer:1', 'Notes:2']);
    await page.keyboard.press('Delete');
    await expect.poll(async () => (await layout(page))[0]).toEqual(['Visit date:1', 'Notes:2']);
  });

  test('adds a section and a field in it, previews the screen, and publishes it', async ({ page }) => {
    await tile(page, 'layout:section').click();
    const title = page.locator('.fd-canvas-section-title-input:visible');
    await expect(title).toBeFocused();
    await page.keyboard.type('Photos');
    // A group's columns are Advanced's.
    await page.getByRole('button', { name: 'Advanced', exact: true }).click();
    await page.locator('.fd-properties').getByRole('tab', { name: 'Layout' }).click();
    await page.locator('.fd-properties').getByRole('group', { name: 'Columns on a desktop' }).getByRole('button', { name: '1 column' }).click();
    await addField(page, 'file', 'Photo of the site');
    const photos = page.locator('.fd-canvas-section').nth(2);
    await expect(photos.locator('.fd-canvas-field')).toHaveCount(1);
    await screen(page, 'screen-new-section');

    await page.getByRole('button', { name: 'Try it' }).click();
    const preview = page.locator('.fd-try');
    await expect(preview.locator('.fd-label')).toHaveText(['Customer', 'Visit date', 'Notes', 'Next step', 'Due by', 'Manager to call?', 'Photo of the site']);
    await preview.getByLabel('Customer').fill('Nile Towers');
    await expect(preview.getByLabel('Customer')).toHaveValue('Nile Towers');
    await page.getByRole('button', { name: 'Design', exact: true }).click();
    await expect(page.locator('.fd-canvas-field')).toHaveCount(7);

    await publish(page, 1);
  });

  test('every kind of field fits its place, help text and all', async ({ page }) => {
    await page.goto('/screen/?start=blank');
    // Every kind the toolbox offers, so a kind added later is checked too.
    const kinds = await page.locator('.fd-toolbox [data-tool^="kind:"]').evaluateAll((tiles) => tiles.map((t) => (t as HTMLElement).dataset['tool']!.slice(5)));
    expect(kinds.length).toBeGreaterThanOrEqual(24);
    await page.evaluate((kinds) => {
      const { designer } = window.fieldiaDesigner as any;
      for (const kind of kinds) {
        const id = designer.addQuestion(kind, { parent: 'section-1' });
        designer.updateQuestion(id, { label: `A ${kind} question`, help: 'Some help for this field', required: true });
        if (kind === 'multiple-choice' || kind === 'checkboxes') designer.setOptions(id, ['First option', 'Second option', 'Third option', 'Fourth option']);
      }
      designer.select(null);
    }, kinds);
    await expect(page.locator('.fd-canvas-field')).toHaveCount(kinds.length);
    // Nothing spills out of its field, and no two fields overlap.
    const problemsWith = () =>
      page.evaluate(() => {
        const cards = [...document.querySelectorAll<HTMLElement>('.fd-canvas-field')];
        const clipped = cards.filter((card) => [...card.children].some((part) => part.scrollHeight > part.clientHeight + 1 && getComputedStyle(part).overflowY !== 'visible')).map((c) => c.querySelector('.fd-label')?.textContent);
        const rects = cards.map((c) => c.getBoundingClientRect());
        const overlapping = rects.flatMap((a, i) => rects.slice(i + 1).filter((b) => a.left < b.right - 2 && b.left < a.right - 2 && a.top < b.bottom - 2 && b.top < a.bottom - 2).map(() => cards[i].querySelector('.fd-label')?.textContent));
        return { clipped, overlapping };
      });
    await expect.poll(problemsWith).toEqual({ clipped: [], overlapping: [] });
    await screen(page, 'screen-every-kind');
    await page.setViewportSize({ width: 900, height: 900 });
    await expect.poll(problemsWith).toEqual({ clipped: [], overlapping: [] });
    await expectNoSidewaysScroll(page);
    await screen(page, 'screen-every-kind-narrow');
  });
});

test.describe('screen designer · try it', () => {
  test('tries the screen at a phone’s width in Arabic, right to left, and at a desktop’s again', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    await page.getByRole('button', { name: 'Try it' }).click();
    const frame = page.locator('.fd-try-frame');
    await page.getByRole('button', { name: 'Phone' }).click();
    await page.getByRole('button', { name: 'العربية' }).click();
    await expect(frame.locator('form.fd-form')).toHaveAttribute('dir', 'rtl');
    await expect.poll(async () => (await frame.boundingBox())!.width).toBeLessThanOrEqual(390);
    // Laid out for the phone: one field under another.
    const customer = (await frame.locator('[data-type="char"]').first().boundingBox())!;
    const date = (await frame.locator('[data-type="date"]').first().boundingBox())!;
    expect(date.y).toBeGreaterThan(customer.y + customer.height - 1);
    // Right to left: the label sits at the right edge.
    const label = (await frame.locator('.fd-label').first().boundingBox())!;
    expect(customer.x + customer.width - (label.x + label.width)).toBeLessThan(4);
    await expectNoSidewaysScroll(page);
    await screen(page, 'screen-try-phone-arabic', { viewport: true });
    await page.getByRole('button', { name: 'Desktop' }).click();
    await page.getByRole('button', { name: 'English' }).click();
    await expect(frame.locator('form.fd-form')).toHaveAttribute('dir', 'ltr');
    await expect.poll(async () => (await frame.boundingBox())!.width).toBeGreaterThan(700);
    expect(problems).toEqual([]);
  });
});

test.describe('screen designer · fields the backend already has', () => {
  test('lists the model’s fields first, adds one as the model has it, and offers only the editors that suit it', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/?start=sheet');
    const model = page.locator('.fd-tool-group-model');
    // Name is the sheet's title already: the others are offered.
    await expect(model.locator('.fd-tool-name')).toHaveText(['Email', 'Phone', 'Website', 'VAT number', 'Country', 'Tags', 'Credit limit', 'Payment terms', 'Visits a year', 'Status', 'Invoices']);
    await screen(page, 'screen-model-toolbox', { viewport: true });
    await tile(page, 'model:credit_limit').click();
    await expect(model.locator('[data-tool="model:credit_limit"]')).toHaveCount(0);
    const { card, label } = editing(page);
    await card.getByRole('button', { name: 'Show as: Amount' }).click();
    await expect(page.getByRole('menuitemradio')).toHaveText(['Amount']);
    await expect(page.getByRole('menu')).toContainText('Credit limit is stored as an amount in the model, so this is the one way to show it.');
    await screen(page, 'screen-model-show-as', { viewport: true });
    await page.keyboard.press('Escape');
    // Its label typed on the canvas is the page's; the model keeps its own.
    await label.click();
    await page.keyboard.press(`${mod}+a`);
    await page.keyboard.type('Limit');
    const kept = await page.evaluate(() => {
      const built = window.fieldiaDesigner.designer.getPage();
      return built.fields['credit_limit'];
    });
    expect(kept).toEqual({ type: 'monetary', label: 'Credit limit', currency: 'EGP' });
    await tile(page, 'model:visits').click();
    await editing(page).card.getByRole('button', { name: /^Show as:/ }).click();
    // Every editor for a whole number, a slider among them, and nothing that would store something else.
    await expect(page.getByRole('menuitemradio')).toHaveText(['Rating', 'Linear scale', 'Number', 'Slider', 'Progress']);
    await page.getByRole('menuitemradio', { name: 'Progress' }).click();
    await expect(editing(page).card.locator('.fd-progress, progress, [role="progressbar"]').first()).toBeVisible();
    expect(problems).toEqual([]);
  });
});

test.describe('screen designer · putting a field down', () => {
  test('a click on empty room puts the field picked down; a drag leaves the dropped one picked', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/screen/');
    const picked = page.locator('.fd-canvas-field.fd-editing');
    // On the canvas, in the empty cell beside "Manager to call?".
    await (await cardOf(page, 'Customer')).click();
    await expect(picked).toHaveCount(1);
    const manager = await box(page, 'Manager to call?');
    await page.mouse.click(manager.x + manager.width + 60, manager.y + manager.height / 2);
    await expect(picked).toHaveCount(0);
    await screen(page, 'screen-put-down', { viewport: true });
    // Outside the editor, on the page around it.
    await (await cardOf(page, 'Customer')).click();
    await expect(picked).toHaveCount(1);
    await page.mouse.click(8, 600);
    await expect(picked).toHaveCount(0);
    // In the panel, it stays picked.
    await (await cardOf(page, 'Customer')).click();
    await page.locator('.fd-properties').getByRole('textbox', { name: 'Label' }).click();
    await expect(picked).toHaveCount(1);
    // Dragged and dropped, it is picked where it landed.
    await page.keyboard.press('Escape');
    const notes = await box(page, 'Notes');
    await dragToward(page, { x: notes.x + 40, y: notes.y + 12 }, async () => { const c = await box(page, 'Customer'); return { x: c.x + 20, y: c.y + 20 }; });
    await expect(picked.locator('[data-inline="label"]')).toHaveValue('Notes');
    expect(problems).toEqual([]);
  });
});
