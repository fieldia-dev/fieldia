import { expect, test } from './fixtures';
import { harness, zzState } from './race-support';

/**
 * A step that writes a table the person edited after the last save — a line added by the page's own button — takes
 * their edit out of what a way out asks about: the trail then leaves the order unasked, the edit lost. (The core's
 * person-work.spec.ts has this and a change step tidying the field typed.)
 */
test('a line edited after the save, then “Add delivery”: the trail asks before the edit goes, and Enter keeps it', async ({ page }) => {
  const problems = await harness(page, {
    options: `{ page: (() => {
      const p = JSON.parse(JSON.stringify(zz.base));
      p.layout.children[0].children.push({ type: 'button', id: 'b-delivery', label: 'Add delivery', steps: [{ do: 'addLine', field: 'lines', values: { label: "'Delivery'", qty: '1' } }] });
      return p;
    })() }`,
  });
  const phone = page.locator('#app .fd-field[data-field="phone"] input');
  await phone.fill('+1 555 0101');
  await phone.press('ControlOrMeta+Enter');
  await expect(page.locator('#app .fd-status')).toHaveText('Saved');
  const qty = page.locator('#app .fd-field[data-field="lines"] tbody tr').first().locator('input').last();
  await qty.click();
  await qty.fill('7');
  await qty.press('Tab');
  expect((await zzState(page)).unsent).toEqual(['lines']);
  await page.locator('#app').getByRole('button', { name: 'Add delivery' }).click();
  await expect(page.locator('#app .fd-field[data-field="lines"] tbody tr')).toHaveCount(2);
  const crumb = page.locator('#app').getByRole('button', { name: 'Orders' });
  await crumb.click();
  const ask = page.getByRole('alertdialog');
  await expect(ask).toContainText('Discard your changes?');
  await page.keyboard.press('Enter');
  await expect(crumb).toBeFocused();
  expect(await page.evaluate(() => (window as any).zz.went)).toEqual([]);
  expect((await zzState(page)).values.lines[0].values.qty).toBe(7);
  expect(problems).toEqual([]);
});
