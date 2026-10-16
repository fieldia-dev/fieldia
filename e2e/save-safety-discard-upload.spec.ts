import { expect, test } from './fixtures';
import { harness, zzHeld, zzHold } from './race-support';

/**
 * Discard is the person's own answer, and "stops the files" (docs/plans/wave1-contract.md, section 10): a file
 * still on its way is stopped and the dialog closes. Instead it waits for the file to arrive ("1 file still
 * uploading. Waiting for it to finish.") — over a phone's network, as long as the upload takes; for one that never
 * ends, for ever.
 */
test('Discard in a dialog with a file still on its way stops the file and closes at once', async ({ page }) => {
  const problems = await harness(page);
  await page.evaluate(() => {
    const zz = (window as any).zz;
    const F = (window as any).Fieldia;
    const p = JSON.parse(JSON.stringify(zz.base));
    p.fields.doc = { type: 'binary', label: 'Deed' };
    delete p.layout.statusbar;
    p.layout.children[0].children.push({ type: 'field', id: 'f-doc', field: 'doc' });
    F.openFormDialog({ page: p, dataSource: zz.ds, recordId: 1, title: 'Order' }).then((r: unknown) => zz.closed.push(r));
  });
  await zzHold(page, 'upload');
  const dialog = page.locator('.fd-form-dialog');
  await dialog.locator('input[type="file"]').first().setInputFiles({ name: 'deed.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await zzHeld(page, 'upload');
  await dialog.getByRole('button', { name: 'Discard' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 2000 });
  expect(await page.evaluate(() => (window as any).zz.closed)).toMatchObject([{ saved: false }]);
  expect(problems).toEqual([]);
});
