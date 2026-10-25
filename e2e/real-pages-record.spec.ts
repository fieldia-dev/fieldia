import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';

/**
 * Every real-* record page, opened without `&record=`, shows a record: its model's first sample record, one rule for
 * every demo (demos/shared/sample-data.ts: recordFromQuery). 0.33 says a load that fails, and a missing record
 * defaulted to 1, which no real-* model has: these pages said "Couldn't load. No … record with id 1".
 */

const EXAMPLES = join(__dirname, '..', 'examples', 'pages');
const REAL = readdirSync(EXAMPLES)
  .filter((file) => /^real-.*\.page\.json$/.test(file))
  .map((file) => JSON.parse(readFileSync(join(EXAMPLES, file), 'utf8')) as { id: string; data: { kind: string; model: string }; layout: { type: string } })
  .filter((page) => page.data.kind === 'record' && page.layout.type !== 'list');

test('there are real-* record pages to open', () => {
  expect(REAL.length).toBeGreaterThan(20);
});

for (const shown of REAL) {
  test(`${shown.id}, opened without a record in its address, shows one`, async ({ page }) => {
    await page.goto(`/plain/?page=${shown.id}`);
    await expect(page.locator('#app .fd-form').first()).toBeVisible();
    // Loaded — its model's first sample record, or a new one where the demo opens it so (a wizard's) — in core's own
    // words for it, never a failure in its place.
    await expect
      .poll(() =>
        page.evaluate((model) => {
          const demo = (window as any).fieldiaDemo;
          const state = demo.handle.form.getState();
          const first = Object.keys(demo.dataSource.records[model] ?? {})[0] ?? null;
          return { loaded: state.loaded, failed: state.loadProblem?.message ?? null, opened: state.recordId == null ? null : String(state.recordId), first };
        }, shown.data.model)
      )
      .toEqual(expect.objectContaining({ loaded: true, failed: null }));
    const { opened, first } = await page.evaluate((model) => {
      const demo = (window as any).fieldiaDemo;
      const id = demo.handle.form.getState().recordId;
      return { opened: id == null ? null : String(id), first: Object.keys(demo.dataSource.records[model] ?? {})[0] ?? null };
    }, shown.data.model);
    // A page this demo opens as a new record whatever its address says (an amendment, a renewal: the steps of a
    // contract's own record) shows its form; every other, its model's first sample record.
    if (opened !== null) expect(opened).toBe(first);
    await expect(page.locator('#app .fd-loader[data-way="failed"]')).toHaveCount(0);
    await expect(page.locator('#app')).not.toContainText('Couldn’t load');
    await expect(page.locator('#app')).not.toContainText('could not be loaded');
  });
}
