import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, screen } from './support';
import { VARIANTS } from './variants';

/**
 * The lines grid (@fieldia/grid) on the sales order, driven by a real
 * keyboard and mouse in every framework: the React grid's scenarios, kept.
 */

const grid = (page: Page) => page.locator('[data-node="f-lines"]');
const cell = (page: Page, row: number, col: string) => grid(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);
/**
 * Add to the end of a cell's text the way a person does: once the cell has the
 * focus and its text is selected, ArrowRight (End only scrolls on a Mac), then type.
 */
async function addAtEnd(page: Page, input: Locator, text: string) {
  await expect(input).toBeFocused();
  await expect.poll(() => input.evaluate((el: HTMLInputElement) => el.selectionEnd === el.value.length && el.selectionStart === 0)).toBe(true);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.type(text);
}

/** Whether a cell's text fits inside it, padding included: cut-off text is clipped, not overflowing. */
const textFits = (el: Element) => {
  const probe = document.createElement('span');
  probe.textContent = el.textContent;
  // Each font property on its own: the computed font shorthand can come back empty.
  const cs = getComputedStyle(el);
  probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight};font-style:${cs.fontStyle};letter-spacing:${cs.letterSpacing}`;
  document.body.append(probe);
  const needed = probe.getBoundingClientRect().width + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  probe.remove();
  return needed <= el.clientWidth + 0.5;
};

/** Wait until an element stops moving, so a drag takes hold where it is, not where it was. */
async function holdsStill(target: Locator) {
  let last = '';
  await expect
    .poll(async () => {
      const now = JSON.stringify(await target.boundingBox());
      const still = now === last;
      last = now;
      return still;
    })
    .toBe(true);
}
/** The lines' rows: every row but the totals row pinned under them. */
const lineRows = (page: Page) => grid(page).locator('.ag-row:not(.fd-grid-totals)');
const editor = (page: Page) => grid(page).locator('.ag-cell-inline-editing input, .ag-popup-editor input').first();
/** Where the grid is editing, as [row, column], or null: an editor in its cell, or a popup editor over the focused cell. */
const editing = (page: Page) =>
  page.evaluate(() => {
    const root = document.querySelector('[data-node="f-lines"]');
    const c = root?.querySelector('.ag-cell-inline-editing') ?? (root?.querySelector('.ag-popup-editor') ? root.querySelector('.ag-cell-focus') : null);
    return c ? [Number(c.closest('.ag-row')?.getAttribute('row-index')), c.getAttribute('col-id')] : null;
  });
const lines = (page: Page) =>
  page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values['line_ids'] as { values: Record<string, unknown> }[]).map((l) => l.values));

/** The sample order's rows: a section, two items, a section and a note, and one more item. */
const WORKSTATIONS = 0, CHAIR = 1, DESK = 2, LIGHTING = 3, NOTE = 4, LAMP = 5, NEW = 6;

for (const variant of VARIANTS) {
  test.describe(`${variant} · lines grid`, () => {
    test.beforeEach(async ({ page }) => {
      await open(page, variant, 'page=order&skin=underline');
      await expect(cell(page, LAMP, 'subtotal')).toHaveText('EGP 4,560.00');
    });

    test('a number cell selects its value, typing replaces it, and the subtotal follows while still editing', async ({ page }) => {
      await cell(page, LAMP, 'qty').click();
      await expect(editor(page)).toBeFocused();
      await page.keyboard.type('20');
      await expect(editor(page)).toHaveValue('20');
      await expect(cell(page, LAMP, 'subtotal')).toHaveText('EGP 7,600.00');
      await expect.poll(() => editing(page)).toEqual([LAMP, 'qty']);
      await screen(page, `${variant}-grid-editing`);
    });

    test('typed text sits where the shown value was, for words and for numbers', async ({ page }) => {
      /** Where the text of a cell (or of the input inside it) starts and ends on screen. */
      const textEdges = (row: number, col: string) =>
        cell(page, row, col).evaluate((el) => {
          const input = el.querySelector('input');
          if (input) {
            const r = input.getBoundingClientRect();
            const measure = document.createElement('span');
            measure.textContent = input.value;
            const cs = getComputedStyle(input);
            measure.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight}`;
            document.body.append(measure);
            const width = measure.getBoundingClientRect().width;
            measure.remove();
            return getComputedStyle(input).textAlign === 'end' || getComputedStyle(input).textAlign === 'right' ? [r.right - width, r.right] : [r.left, r.left + width];
          }
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return [r.left, r.right];
        });
      for (const col of ['name', 'qty']) {
        const [shownStart, shownEnd] = await textEdges(DESK, col);
        await cell(page, DESK, col).click();
        await expect.poll(() => editing(page)).toEqual([DESK, col]);
        const [typedStart, typedEnd] = await textEdges(DESK, col);
        // The cell's own frame marks it as edited; the skin's underline would be a second line inside it.
        expect(await editor(page).evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
        if (col === 'name') expect(Math.abs(typedStart - shownStart), `${col}: text moved sideways`).toBeLessThanOrEqual(1.5);
        else expect(Math.abs(typedEnd - shownEnd), `${col}: number moved sideways`).toBeLessThanOrEqual(1.5);
        await page.keyboard.press('Escape');
        await expect.poll(() => editing(page)).toBeNull();
      }
    });

    test('Enter moves down a row; Tab moves across, skipping cells that cannot be edited; Shift+Tab goes back', async ({ page }) => {
      await cell(page, CHAIR, 'qty').click();
      await page.keyboard.press('Enter');
      await expect.poll(() => editing(page)).toBeNull();
      await expect(cell(page, DESK, 'qty')).toHaveClass(/ag-cell-focus/);
      await page.keyboard.press('Enter');
      await expect.poll(() => editing(page)).toEqual([DESK, 'qty']);
      await page.keyboard.press('Tab');
      await expect.poll(() => editing(page)).toEqual([DESK, 'price']);
      await page.keyboard.press('Tab');
      await expect.poll(() => editing(page)).toEqual([DESK, 'discount']);
      await page.keyboard.press('Tab'); // past VAT, Subtotal and the delete button, into the next section's heading
      await expect.poll(() => editing(page)).toEqual([LIGHTING, 'product_id']);
      await expect(editor(page)).toHaveValue('Lighting');
      await page.keyboard.press('Shift+Tab');
      await expect.poll(() => editing(page)).toEqual([DESK, 'discount']);
    });

    test('Tab on the last cell adds a line and carries on typing into it', async ({ page }) => {
      await cell(page, LAMP, 'discount').click();
      await page.keyboard.press('Tab');
      await expect(lineRows(page)).toHaveCount(7);
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
      expect((await lines(page)).length).toBe(7);
      // The product search opens its list on arrival: the first Escape closes it,
      // the second takes the line that was only just added away again.
      await expect(grid(page).getByRole('listbox')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(grid(page).getByRole('listbox')).toBeHidden();
      await expect(lineRows(page)).toHaveCount(7);
      await page.keyboard.press('Escape');
      await expect(lineRows(page)).toHaveCount(6);
      expect((await lines(page)).length).toBe(6);
    });

    test('Enter on the last row adds a line', async ({ page }) => {
      await cell(page, LAMP, 'name').click();
      await page.keyboard.press('Enter');
      await expect(lineRows(page)).toHaveCount(7);
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
    });

    test('Escape puts the cell back as it was', async ({ page }) => {
      await cell(page, DESK, 'name').click();
      await page.keyboard.type('Walnut top');
      await expect(editor(page)).toHaveValue('Walnut top');
      await page.keyboard.press('Escape');
      await expect.poll(() => editing(page)).toBeNull();
      await expect(cell(page, DESK, 'name')).toHaveText('Oak top, black frame');
      expect((await lines(page))[DESK]['name']).toBe('Oak top, black frame');
    });

    test('a product is searched inside its cell and picked with the keyboard; its price comes with it', async ({ page }) => {
      await grid(page).getByRole('button', { name: '+ Add a line' }).click();
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
      await expect(editor(page)).toBeFocused();
      // The search box covers its cell exactly, so the value underneath never shows through.
      const box = (await grid(page).locator('.ag-popup-editor .fd-grid-editor').boundingBox())!;
      const under = (await cell(page, NEW, 'product_id').boundingBox())!;
      for (const side of ['x', 'y', 'width', 'height'] as const) expect(Math.abs(box[side] - under[side]), `search box ${side}`).toBeLessThanOrEqual(1);
      expect(await editor(page).evaluate((el) => getComputedStyle(el).boxShadow)).toBe('none');
      await page.keyboard.type('monitor');
      await expect(grid(page).getByRole('option', { name: 'Monitor arm, dual' })).toBeVisible();
      await screen(page, `${variant}-grid-search`);
      // The first Escape only closes the list (and clears the search); the cell is still being edited.
      await page.keyboard.press('Escape');
      await expect(grid(page).getByRole('listbox')).toBeHidden();
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
      await expect(editor(page)).toHaveValue('');
      await page.keyboard.type('monitor');
      await expect(grid(page).getByRole('option', { name: 'Monitor arm, dual' })).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(editor(page)).toHaveValue('Monitor arm, dual');
      await expect(cell(page, NEW, 'price')).toHaveText('EGP 749.00');
      await expect(cell(page, NEW, 'subtotal')).toHaveText('EGP 749.00');
      // Enter picked the product and nothing else: the cell is still the one being edited.
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
      await page.keyboard.press('Tab');
      await expect.poll(() => editing(page)).toEqual([NEW, 'name']);
      await expect(cell(page, NEW, 'product_id')).toHaveText('Monitor arm, dual');
    });

    test('the last line’s product list opens in full below the table, and its bottom choice can be clicked', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 1000 }); // the whole list fits the window
      await cell(page, LAMP, 'product_id').click();
      const last = grid(page).getByRole('option', { name: 'Cable tray, 120 cm' });
      await expect(last).toBeVisible();
      // Nothing clips it: the choice itself is what sits under its middle and just above its bottom edge.
      const onTop = await last.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.top + r.height / 2, r.bottom - 2].every((y) => {
          const at = document.elementFromPoint(r.left + r.width / 2, y);
          return !!at && (at === el || el.contains(at));
        });
      });
      expect(onTop, 'the list is cut off by the table or the card').toBe(true);
      await screen(page, `${variant}-grid-last-line-list`);
      await last.click();
      await expect(editor(page)).toHaveValue('Cable tray, 120 cm');
      await page.keyboard.press('Tab');
      await expect(cell(page, LAMP, 'product_id')).toHaveText('Cable tray, 120 cm');
    });

    test('yes or no is ticked by a click, or by Space on the focused cell', async ({ page }) => {
      await cell(page, LAMP, 'taxed').locator('input').click();
      expect((await lines(page))[LAMP]['taxed']).toBe(true);
      await cell(page, LAMP, 'taxed').click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('Space');
      expect((await lines(page))[LAMP]['taxed']).toBe(false);
    });

    test('the delete button removes a line, and Discard brings it back', async ({ page }) => {
      await cell(page, CHAIR, '__delete').getByRole('button', { name: 'Delete line' }).click();
      await expect(lineRows(page)).toHaveCount(5);
      await page.getByRole('button', { name: 'Discard' }).click();
      await expect(lineRows(page)).toHaveCount(6);
      await expect(cell(page, CHAIR, 'product_id')).toHaveText('Office chair, ergonomic');
    });

    test('the delete button is reached with the arrow keys and pressed with Enter', async ({ page }) => {
      await cell(page, CHAIR, 'taxed').click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await expect(cell(page, CHAIR, '__open')).toHaveClass(/ag-cell-focus/);
      await page.keyboard.press('ArrowRight');
      await expect(cell(page, CHAIR, '__delete')).toHaveClass(/ag-cell-focus/);
      await page.keyboard.press('Enter');
      await expect(lineRows(page)).toHaveCount(5);
      expect((await lines(page)).map((l) => l['product_id'] ?? l['name'])).not.toContainEqual(expect.objectContaining({ label: 'Office chair, ergonomic' }));
      expect(await lines(page)).toHaveLength(5);
    });
    test('a section heads the lines below it and a note shows every line of its text, each across the row', async ({ page }) => {
      await expect(cell(page, WORKSTATIONS, 'product_id')).toHaveText('Workstations');
      await expect(cell(page, LIGHTING, 'product_id')).toHaveText('Lighting');
      await expect(cell(page, NOTE, 'product_id')).toHaveText('Warm white only, to match the reception.\nOur electrician fits them on delivery day.');
      // One wide cell between the drag handle and the line's tools; none of an item's columns.
      expect(await grid(page).locator(`.ag-row[row-index="${NOTE}"] .ag-cell`).evaluateAll((cells) => cells.map((c) => c.getAttribute('col-id')))).toEqual([
        '__handle',
        'product_id',
        '__open',
        '__delete',
      ]);
      await expect(grid(page).locator(`.ag-row[row-index="${WORKSTATIONS}"]`)).toHaveClass(/fd-grid-section/);
      // The note's two lines both show: its row is taller than an item's, and nothing inside is cut off.
      const note = (await grid(page).locator(`.ag-row[row-index="${NOTE}"]`).boundingBox())!;
      const item = (await grid(page).locator(`.ag-row[row-index="${LAMP}"]`).boundingBox())!;
      expect(note.height).toBeGreaterThanOrEqual(item.height + 18);
      expect(await cell(page, NOTE, 'product_id').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
      expect(note.y + note.height).toBeLessThanOrEqual(item.y + 1);
      await expect(grid(page).getByRole('columnheader', { name: 'Line type' })).toHaveCount(0);
      await screen(page, `${variant}-grid-sections`);
    });

    test('a note grows as it is typed, taking the rows below with it, and Ctrl+Enter finishes it', async ({ page }) => {
      const row = (index: number) => grid(page).locator(`.ag-row[row-index="${index}"]`);
      const before = (await row(NOTE).boundingBox())!.height;
      const shown = await cell(page, NOTE, 'product_id').evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        return { top: r.top, left: r.left, cell: el.getBoundingClientRect().width };
      });
      await cell(page, NOTE, 'product_id').click();
      await expect.poll(() => editing(page)).toEqual([NOTE, 'product_id']);
      const area = grid(page).locator('.ag-cell-inline-editing textarea');
      await expect(area).toBeFocused();
      // The note is typed where it was read: same first line, the whole width of the row.
      const typed = await area.evaluate((el) => {
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return { top: r.top + parseFloat(cs.paddingTop), left: r.left + parseFloat(cs.paddingLeft), width: r.width };
      });
      expect(Math.abs(typed.top - shown.top), 'first line moved down').toBeLessThanOrEqual(1.5);
      expect(Math.abs(typed.left - shown.left), 'text moved sideways').toBeLessThanOrEqual(1.5);
      expect(typed.width, 'the note box is narrower than its row').toBeGreaterThan(shown.cell - 40);
      await page.keyboard.press('Enter'); // a new line of the note, not the next row
      await page.keyboard.type('Spare bulbs in the second box.');
      await expect.poll(() => editing(page)).toEqual([NOTE, 'product_id']);
      await expect.poll(async () => (await row(NOTE).boundingBox())!.height).toBeGreaterThanOrEqual(before + 18);
      // The lamp's row moved down with it: nothing overlaps.
      const grown = (await row(NOTE).boundingBox())!;
      const lamp = (await row(LAMP).boundingBox())!;
      expect(grown.y + grown.height).toBeLessThanOrEqual(lamp.y + 1);
      await screen(page, `${variant}-grid-note-growing`);
      await page.keyboard.press(process.platform === 'darwin' ? 'Meta+Enter' : 'Control+Enter');
      await expect.poll(() => editing(page)).toBeNull();
      expect((await lines(page))[NOTE]['name']).toBe('Warm white only, to match the reception.\nOur electrician fits them on delivery day.\nSpare bulbs in the second box.');
      await expect(cell(page, NOTE, 'product_id')).toContainText('Spare bulbs in the second box.');
      expect(await cell(page, NOTE, 'product_id').evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    });

    test('Escape on a note puts back its text and its height', async ({ page }) => {
      const row = grid(page).locator(`.ag-row[row-index="${NOTE}"]`);
      const before = (await row.boundingBox())!.height;
      await cell(page, NOTE, 'product_id').click();
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.type('Gone.');
      await expect.poll(async () => (await row.boundingBox())!.height).toBeGreaterThan(before + 30);
      await page.keyboard.press('Escape');
      await expect.poll(() => editing(page)).toBeNull();
      await expect.poll(async () => Math.round((await row.boundingBox())!.height)).toBe(Math.round(before));
      expect((await lines(page))[NOTE]['name']).toBe('Warm white only, to match the reception.\nOur electrician fits them on delivery day.');
    });

    test('a section is added from its button and its heading typed in place', async ({ page }) => {
      await grid(page).getByRole('button', { name: '+ Add a section' }).click();
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
      await page.keyboard.type('Installation');
      await expect(editor(page)).toHaveValue('Installation');
      await page.keyboard.press('Tab'); // the heading is a section's only cell: Tab starts the next line
      await expect.poll(() => editing(page)).toEqual([NEW + 1, 'product_id']);
      const added = await lines(page);
      expect(added[NEW]).toEqual(expect.objectContaining({ display_type: 'section', name: 'Installation' }));
      await expect(grid(page).locator(`.ag-row[row-index="${NEW}"]`)).toHaveClass(/fd-grid-section/);
      await screen(page, `${variant}-grid-section-added`);
    });
    test('a line is dragged by its handle to a new place, and the lines are numbered again', async ({ page }) => {
      const handle = cell(page, LAMP, '__handle').locator('.ag-drag-handle');
      await expect(handle).toBeVisible();
      const from = (await handle.boundingBox())!;
      const desk = (await grid(page).locator(`.ag-row[row-index="${DESK}"]`).boundingBox())!;
      // A hand's drag: press, move in steps, pause over the desk's row, let go.
      await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
      await page.mouse.down();
      for (let step = 1; step <= 8; step++) await page.mouse.move(from.x + from.width / 2, from.y + ((desk.y + 8 - from.y) * step) / 8);
      await screen(page, `${variant}-grid-dragging`);
      await page.mouse.up();
      await expect
        .poll(async () => (await lines(page)).map((l) => (l['product_id'] as { label?: string } | null)?.label ?? l['name']))
        .toEqual(['Workstations', 'Office chair, ergonomic', 'Desk lamp, LED', 'Standing desk 160 × 80', 'Lighting', 'Warm white only, to match the reception.\nOur electrician fits them on delivery day.']);
      expect((await lines(page)).map((l) => l['sequence'])).toEqual([10, 20, 30, 40, 50, 60]);
      await expect(cell(page, DESK, 'product_id')).toHaveText('Desk lamp, LED');
    });

    test('Alt+Up moves the focused line up, and it stays focused', async ({ page }) => {
      await cell(page, LAMP, 'taxed').click({ position: { x: 4, y: 4 } });
      await page.keyboard.press('Alt+ArrowUp');
      await expect(cell(page, NOTE, 'product_id')).toHaveText('Desk lamp, LED');
      await expect(cell(page, NOTE, 'taxed')).toHaveClass(/ag-cell-focus/);
      expect((await lines(page)).map((l) => l['sequence'])).toEqual([10, 20, 30, 40, 50, 60]);
      expect((await lines(page))[NOTE]['product_id']).toEqual({ id: 2, label: 'Desk lamp, LED' });
    });
    test('the order total shows its currency’s symbol after the amount, inside its box', async ({ page }) => {
      const total = page.locator('[data-node="f-total"]');
      const amount = (await total.locator('input').boundingBox())!;
      const currency = (await total.locator('.fd-currency').boundingBox())!;
      await expect(total.locator('.fd-currency')).toHaveText('E£');
      expect(currency.x).toBeGreaterThan(amount.x + amount.width / 2);
      expect(currency.x + currency.width).toBeLessThanOrEqual(amount.x + amount.width + 1);
      // The amount ends right beside its currency, not across the row from it.
      const textEnd = await total.locator('input').evaluate((el: HTMLInputElement) => {
        const probe = document.createElement('span');
        const cs = getComputedStyle(el);
        probe.textContent = el.value;
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:pre;font-family:${cs.fontFamily};font-size:${cs.fontSize};font-weight:${cs.fontWeight}`;
        document.body.append(probe);
        const width = probe.getBoundingClientRect().width;
        probe.remove();
        const box = el.getBoundingClientRect();
        return cs.textAlign === 'end' || cs.textAlign === 'right' ? box.right - parseFloat(cs.paddingRight) : box.left + parseFloat(cs.paddingLeft) + width;
      });
      expect(currency.x - textEnd).toBeLessThanOrEqual(24);
      // Never over it.
      expect(currency.x - textEnd).toBeGreaterThanOrEqual(0);
    });

    test('a totals row adds up quantity and subtotal, leaving sections and notes out, and follows a change as it is typed', async ({ page }) => {
      const totals = grid(page).locator('.ag-grid-pinned-bottom-rows .ag-row');
      await expect(totals.locator('.ag-cell[col-id="product_id"]')).toHaveText('Total');
      await expect(totals.locator('.ag-cell[col-id="qty"]')).toHaveText('30.00');
      await expect(totals.locator('.ag-cell[col-id="subtotal"]')).toHaveText('EGP 64,656.00');
      await cell(page, LAMP, 'qty').click();
      await page.keyboard.type('20');
      await expect(totals.locator('.ag-cell[col-id="qty"]')).toHaveText('38.00');
      await expect(totals.locator('.ag-cell[col-id="subtotal"]')).toHaveText('EGP 67,696.00');
      await expect.poll(() => editing(page)).toEqual([LAMP, 'qty']);
      // The totals row is not a line: nothing to edit, drag or delete there.
      await expect(totals.locator('.ag-drag-handle, button')).toHaveCount(0);
      await screen(page, `${variant}-grid-totals`);
    });
    test('a save with a line missing its product is refused, the cell marked and opened, and goes through once it is filled', async ({ page }) => {
      await grid(page).getByRole('button', { name: '+ Add a line' }).click();
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
      await page.getByRole('heading', { name: 'S00118' }).or(page.locator('.fd-title')).first().click(); // leave the line empty
      await expect.poll(() => editing(page)).toBeNull();
      await page.getByRole('button', { name: 'Save' }).click();
      const problems = grid(page).locator('.fd-grid-problems');
      await expect(problems).toBeVisible();
      await expect(problems).toHaveText('Line 7: Product is required');
      await expect(cell(page, NEW, 'product_id')).toHaveClass(/fd-grid-invalid/);
      await expect(cell(page, LAMP, 'product_id')).not.toHaveClass(/fd-grid-invalid/);
      // The focus went straight to the cell to fix, its search open.
      await expect.poll(() => editing(page)).toEqual([NEW, 'product_id']);
      await expect(editor(page)).toBeFocused();
      // The open editor carries the problem too: told to a screen reader, and framed in red.
      await expect(editor(page)).toHaveAttribute('aria-invalid', 'true');
      const frame = grid(page).locator('.ag-popup-editor .fd-grid-editor');
      const red = await page.evaluate(() => getComputedStyle(document.querySelector('.fd-form')!).getPropertyValue('--fd-error').trim());
      expect(await frame.evaluate((el) => getComputedStyle(el).borderTopColor)).toBe(await page.evaluate((c) => {
        const probe = document.createElement('i');
        probe.style.color = c;
        document.body.append(probe);
        const rgb = getComputedStyle(probe).color;
        probe.remove();
        return rgb;
      }, red));
      await screen(page, `${variant}-grid-refused`);
      await page.keyboard.type('cable');
      await expect(grid(page).getByRole('option', { name: 'Cable tray, 120 cm' })).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(problems).toBeHidden();
      await expect(editor(page)).toHaveAttribute('aria-invalid', 'false');
      await expect(cell(page, NEW, 'product_id')).not.toHaveClass(/fd-grid-invalid/);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.locator('.fd-status')).toHaveText('Saved');
    });
    test('a person resizes, moves and chooses columns, and finds them so after a reload', async ({ page }) => {
      const header = (col: string) => grid(page).locator(`.ag-header-cell[col-id="${col}"]`);
      // The order a person sees: AG Grid moves header cells on screen, not in the page's markup.
      const order = () =>
        grid(page)
          .locator('.ag-header-cell')
          .evaluateAll((cells) => cells.map((c) => [c.getAttribute('col-id'), c.getBoundingClientRect().x] as const).sort((p, q) => p[1] - q[1]).map((p) => p[0]));
      await expect(header('lead_days')).toHaveCount(0);

      // Choose: hide the discount, show the lead time.
      const button = grid(page).getByRole('button', { name: 'Choose columns' });
      await button.click();
      const chooser = grid(page).getByRole('group', { name: 'Choose columns' });
      await expect(chooser).toBeVisible();
      await expect(chooser.getByLabel('Disc. %')).toBeChecked();
      await expect(chooser.getByLabel('Lead time (days)')).not.toBeChecked();
      await screen(page, `${variant}-grid-chooser`);
      await chooser.getByLabel('Disc. %').uncheck();
      await chooser.getByLabel('Lead time (days)').check();
      await expect(header('discount')).toHaveCount(0);
      await expect(header('lead_days')).toBeVisible();
      await page.mouse.click(10, 10); // a click elsewhere closes it
      await expect(chooser).toBeHidden();

      // Resize: drag the edge of Description 80 px wider, at a hand's pace, once the columns have stopped moving.
      await holdsStill(header('name'));
      const edge = (await header('name').locator('.ag-header-cell-resize').boundingBox())!;
      const before = (await header('name').boundingBox())!.width;
      await page.mouse.move(edge.x + edge.width / 2, edge.y + edge.height / 2);
      await page.mouse.down();
      for (let step = 1; step <= 8; step++) await page.mouse.move(edge.x + edge.width / 2 + step * 10, edge.y + edge.height / 2);
      await page.mouse.up();
      await expect.poll(async () => Math.round((await header('name').boundingBox())!.width - before)).toBeGreaterThanOrEqual(70);
      const widened = (await header('name').boundingBox())!.width;

      // Move: drag Unit price before Quantity.
      await holdsStill(header('price'));
      const price = (await header('price').boundingBox())!;
      const qty = (await header('qty').boundingBox())!;
      await page.mouse.move(price.x + price.width / 2, price.y + price.height / 2);
      await page.mouse.down();
      for (let step = 1; step <= 10; step++) await page.mouse.move(price.x + price.width / 2 + ((qty.x + 10 - (price.x + price.width / 2)) * step) / 10, price.y + price.height / 2);
      await page.mouse.up();
      await expect.poll(async () => (await order()).indexOf('price')).toBeLessThan((await order()).indexOf('qty'));
      const arranged = await order();

      await page.reload();
      await expect(cell(page, LAMP, 'subtotal')).toHaveText('EGP 4,560.00');
      expect(await order()).toEqual(arranged);
      await expect(header('discount')).toHaveCount(0);
      await expect(cell(page, LAMP, 'lead_days')).toHaveText('7');
      expect(Math.abs((await header('name').boundingBox())!.width - widened)).toBeLessThanOrEqual(2);
      // The money total, in bold, still fits its narrower column.
      const total = grid(page).locator('.ag-grid-pinned-bottom-rows .ag-cell[col-id="subtotal"]');
      await expect(total).toHaveText('EGP 64,656.00');
      expect(await total.evaluate(textFits), 'the subtotal total is cut off').toBe(true);
      await screen(page, `${variant}-grid-arranged`);
    });

    test('the column chooser opens from the keyboard and gives the focus back', async ({ page }) => {
      await cell(page, CHAIR, 'taxed').click({ position: { x: 4, y: 4 } });
      for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowUp', 'ArrowUp']) await page.keyboard.press(key);
      await expect(grid(page).locator('.ag-header-cell[col-id="__delete"]')).toBeFocused();
      await page.keyboard.press('Enter');
      const chooser = grid(page).getByRole('group', { name: 'Choose columns' });
      await expect(chooser.getByLabel('Disc. %')).toBeFocused();
      await page.keyboard.press('Space');
      await expect(grid(page).locator('.ag-header-cell[col-id="discount"]')).toHaveCount(0);
      await page.keyboard.press('Escape');
      await expect(chooser).toBeHidden();
      await expect(grid(page).locator('.ag-header-cell[col-id="__delete"]')).toBeFocused();
    });
    test('an emptied table takes its first line again from the button', async ({ page }) => {
      for (let left = 6; left > 0; left--) {
        await cell(page, 0, '__delete').getByRole('button', { name: 'Delete line' }).click();
        await expect(lineRows(page)).toHaveCount(left - 1);
      }
      await expect(grid(page).locator('.ag-grid-pinned-bottom-rows .ag-cell[col-id="subtotal"]')).toHaveText('EGP 0.00');
      // No tall blank where the lines were: at most one row's height between the header and the totals.
      const head = (await grid(page).locator('.ag-header').boundingBox())!;
      const totals = (await grid(page).locator('.ag-grid-pinned-bottom-rows').boundingBox())!;
      expect(totals.y - (head.y + head.height)).toBeLessThanOrEqual(42);
      await screen(page, `${variant}-grid-empty`);
      await grid(page).getByRole('button', { name: '+ Add a line' }).click();
      await expect.poll(() => editing(page)).toEqual([0, 'product_id']);
      await page.keyboard.type('chair');
      await expect(grid(page).getByRole('option', { name: 'Office chair, ergonomic' })).toBeVisible();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(cell(page, 0, 'price')).toHaveText('EGP 1,890.00');
    });
    test('a long table stops growing, scrolls inside, draws only the rows in view, and keeps its totals in sight', async ({ page }) => {
      await page.evaluate(() => {
        const form = (window as any).fieldiaDemo.handle.form;
        for (let i = 1; i <= 200; i++) form.addLine('line_ids', { product_id: { id: 5, label: 'Cable tray, 120 cm' }, name: `Run ${i}`, qty: 1, price: 215 });
      });
      await expect(grid(page).locator('.ag-grid-pinned-bottom-rows .ag-cell[col-id="qty"]')).toHaveText('230.00');
      const frame = (await grid(page).locator('.ag-root-wrapper').boundingBox())!;
      expect(frame.height).toBeLessThanOrEqual(38 + 15 * 40 + 40 + 4);
      expect(await lineRows(page).count()).toBeLessThan(60);
      // Scrolled to the end inside the table, the last line shows above the totals.
      await grid(page).locator('.ag-grid-pinned-bottom-rows').scrollIntoViewIfNeeded(); // the page, not the table
      await grid(page).locator('.ag-body-viewport, .ag-grid-viewport').first().evaluate((el) => (el.scrollTop = el.scrollHeight));
      await expect(cell(page, 205, 'name')).toHaveText('Run 200');
      await expect(cell(page, 205, 'name')).toBeInViewport();
      await expect(grid(page).locator('.ag-grid-pinned-bottom-rows')).toBeInViewport();
      await screen(page, `${variant}-grid-long`);

      // Tab past the last cell still starts a new line, in view.
      await cell(page, 205, 'discount').click();
      await page.keyboard.press('Tab');
      await expect.poll(() => editing(page)).toEqual([206, 'product_id']);
      await expect(cell(page, 206, 'product_id')).toBeInViewport();
    });

    test('a table cut back to a few lines grows to fit them again', async ({ page }) => {
      await page.evaluate(() => {
        const form = (window as any).fieldiaDemo.handle.form;
        for (let i = 1; i <= 30; i++) form.addLine('line_ids', { name: `Run ${i}` });
      });
      await expect.poll(async () => (await grid(page).locator('.ag-root-wrapper').boundingBox())!.height).toBeLessThanOrEqual(38 + 15 * 40 + 40 + 4);
      await page.getByRole('button', { name: 'Discard' }).click();
      await expect(lineRows(page)).toHaveCount(6);
      // Back to fitting its rows: no inner scrolling, no blank below the last line.
      const body = grid(page).locator('.ag-body-viewport, .ag-grid-viewport').first();
      await expect.poll(() => body.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      const last = (await grid(page).locator(`.ag-row[row-index="${LAMP}"]`).boundingBox())!;
      const totals = (await grid(page).locator('.ag-grid-pinned-bottom-rows').boundingBox())!;
      expect(totals.y - (last.y + last.height)).toBeLessThanOrEqual(2);
      // And no blank under the table: the add buttons sit right below it.
      const frame = (await grid(page).locator('.ag-root-wrapper').boundingBox())!;
      const add = (await grid(page).getByRole('button', { name: '+ Add a line' }).boundingBox())!;
      expect(add.y - (frame.y + frame.height)).toBeLessThanOrEqual(12);
    });
    test('in French the grid writes its numbers and dates as a French reader does', async ({ page }) => {
      await open(page, variant, 'page=order&skin=underline&locale=fr');
      await expect(cell(page, CHAIR, 'price')).toHaveText('EGP 1\u202f890,00');
      await expect(grid(page).locator('.ag-grid-pinned-bottom-rows .ag-cell[col-id="subtotal"]')).toHaveText('EGP 64\u202f656,00');
      await cell(page, LAMP, 'qty').click();
      await page.keyboard.type('20,5');
      await expect(cell(page, LAMP, 'subtotal')).toHaveText('EGP 7\u202f790,00');
      await screen(page, `${variant}-grid-french`);
    });
  });

  test.describe(`${variant} · a grid that opens whole lines`, () => {
    const deliveries = (page: Page) => page.locator('[data-node="f-deliveries"]');
    const at = (page: Page, row: number, col: string) => deliveries(page).locator(`.ag-row[row-index="${row}"] .ag-cell[col-id="${col}"]`);
    const stored = (page: Page) =>
      page.evaluate(() => ((window as any).fieldiaDemo.handle.form.getState().values['delivery_ids'] as { values: Record<string, unknown> }[]).map((l) => l.values));

    test.beforeEach(async ({ page }) => {
      await open(page, variant, 'page=order&skin=underline');
      await page.getByRole('tab', { name: 'Other information' }).click();
      await expect(at(page, 0, 'place')).toHaveText('Nile Towers, 12th floor');
    });

    test('a click opens every cell of the line; Tab walks them; the carrier list floats free; Enter keeps the line', async ({ page }) => {
      await at(page, 0, 'place').click();
      await expect(deliveries(page).locator('.ag-cell-inline-editing')).toHaveCount(4);
      await expect(deliveries(page).locator('.ag-popup-editor')).toHaveCount(0);
      const place = at(page, 0, 'place').locator('input');
      await addAtEnd(page, place, ', gate B');
      await page.keyboard.press('Tab');
      const carrier = at(page, 0, 'carrier_id').locator('input');
      await expect(carrier).toBeFocused();
      // Reached from the keyboard, the carrier's text is selected, so typing replaces it.
      expect(await carrier.evaluate((el: HTMLInputElement) => [el.selectionStart, el.selectionEnd, el.value.length])).toEqual([0, 11, 11]);
      await page.keyboard.type('bos');
      const bosta = deliveries(page).getByRole('option', { name: 'Bosta' });
      // The answer to "bos" itself, not the whole list that opened as the cell was reached.
      await expect(deliveries(page).getByRole('option').first()).toHaveText('Bosta');
      await expect(deliveries(page).getByRole('option', { name: 'Aramex' })).toHaveCount(0);
      // By name, not by element: a search answering late draws the list anew.
      const onTop = await bosta.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.top + r.height / 2, r.bottom - 2].every((y) => {
          const hit = document.elementFromPoint(r.left + r.width / 2, y);
          return hit?.closest('[role=option]')?.textContent === 'Bosta';
        });
      });
      expect(onTop, 'the carrier list is cut off').toBe(true);
      await screen(page, `${variant}-grid-row-mode`);
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter'); // picks Bosta: the line stays open
      await expect(carrier).toHaveValue('Bosta');
      await expect(deliveries(page).locator('.ag-cell-inline-editing')).toHaveCount(4);
      await page.keyboard.press('Enter'); // keeps the line
      await expect(deliveries(page).locator('.ag-cell-inline-editing')).toHaveCount(0);
      expect((await stored(page))[0]).toEqual(expect.objectContaining({ place: 'Nile Towers, 12th floor, gate B', carrier_id: { id: 2, label: 'Bosta' } }));
      await expect(at(page, 0, 'carrier_id')).toHaveText('Bosta');
    });

    test('Escape puts the whole line back, whichever cell it was pressed in', async ({ page }) => {
      await at(page, 1, 'boxes').click();
      await page.keyboard.type('30');
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Shift+Tab');
      await addAtEnd(page, at(page, 1, 'place').locator('input'), ', loading bay');
      expect((await stored(page))[1]).toEqual(expect.objectContaining({ boxes: 30, place: 'Nile Towers, 12th floor, loading bay' }));
      await page.keyboard.press('Escape');
      await expect(deliveries(page).locator('.ag-cell-inline-editing')).toHaveCount(0);
      expect((await stored(page))[1]).toEqual(expect.objectContaining({ boxes: 3, place: 'Nile Towers, 12th floor' }));
      await expect(at(page, 1, 'boxes')).toHaveText('3');
    });
  });
}
