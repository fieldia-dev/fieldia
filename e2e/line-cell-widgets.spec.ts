import { expect, test, type Page } from '@playwright/test';

/**
 * A table's column drawn by the app's own widget, named as a field node names
 * one (`cells: { value: { widget } }`) and found in the widgets given to
 * mountViewer: in every line's cell, as a table and as cards, writing to its
 * own line, reached by Tab from the cell before it.
 */

async function mount(page: Page, cards: boolean) {
  await page.setViewportSize({ width: 1100, height: 900 });
  await page.goto('/script/');
  await page.waitForFunction(() => 'Fieldia' in window);
  await page.evaluate((cards) => {
    const W = window as any;
    const host = document.createElement('div');
    document.body.prepend(host);
    // The app's widget: the value as a chip over a box to type it in.
    const chips = ({ form, name, id, document: doc }: any) => {
      const element = doc.createElement('span');
      element.className = 'test-chips';
      const chip = doc.createElement('b');
      const input = doc.createElement('input');
      input.id = id;
      input.className = 'test-chips-input';
      input.addEventListener('input', () => form.setValue(name, input.value));
      element.append(chip, input);
      return {
        element,
        update(state: any) {
          chip.textContent = state.value ? `[${state.value}]` : '';
          if (doc.activeElement !== input) input.value = state.value ?? '';
        },
        focus: () => input.focus(),
      };
    };
    W.handle = W.Fieldia.mountViewer(host, {
      page: {
        fieldia: '0.1', id: 'conditions', title: 'Conditions', data: { kind: 'responses' },
        fields: {
          conditions: { type: 'one2many', label: 'Conditions', relation: 'condition', fields: { left: { type: 'char', label: 'Left' }, value: { type: 'char', label: 'Value' } } },
        },
        layout: {
          type: 'sections', id: 'r',
          children: [{ type: 'section', id: 's', columns: 1, children: [
            { type: 'field', id: 'f', field: 'conditions', cells: { value: { widget: 'chips' } }, ...(cards ? { cards: 'always' } : {}) },
          ] }],
        },
      },
      dataSource: W.Fieldia.createMemoryDataSource(),
      widgets: { 'char.chips': chips },
    });
  }, cards);
}

const lines = (page: Page) => page.evaluate(() => (window as any).handle.form.getState().values.conditions.map((line: any) => line.values));

for (const cards of [false, true]) {
  test(`${cards ? 'cards' : 'a table'}: a column named for the app's widget draws it in every line, and it writes to its own line`, async ({ page }) => {
    await mount(page, cards);
    const add = page.getByRole('button', { name: 'Add a line' });
    await add.click();
    await add.click();
    const valueCells = page.locator('.fd-lines [data-column="value"]:not(th)');
    await expect(valueCells).toHaveCount(2);
    // Every cell of the column is the app's widget; the column beside it keeps the built-in box.
    await expect(page.locator('.fd-lines [data-column="value"]:not(th) .test-chips')).toHaveCount(2);
    await expect(page.locator('.fd-lines [data-column="left"]:not(th) .test-chips')).toHaveCount(0);

    await valueCells.nth(1).locator('.test-chips-input').fill('{{ item.dueDate }}');
    await expect.poll(() => lines(page)).toEqual([
      expect.objectContaining({ value: null }),
      expect.objectContaining({ value: '{{ item.dueDate }}' }),
    ]);
    // The form's value comes back to the widget: its chip.
    await expect(valueCells.nth(1).locator('b')).toHaveText('[{{ item.dueDate }}]');

    // Tab from the first line's Left reaches its Value: the widget sits in the cells' order.
    await page.locator('.fd-lines [data-column="left"]:not(th) input').first().focus();
    await page.keyboard.press('Tab');
    await expect(valueCells.nth(0).locator('.test-chips-input')).toBeFocused();
    await page.keyboard.type('x > 1');
    await expect.poll(async () => (await lines(page))[0].value).toBe('x > 1');
  });
}
