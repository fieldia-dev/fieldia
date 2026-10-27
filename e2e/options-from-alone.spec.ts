import { expect, test } from './fixtures';

/**
 * A choice whose options come from the app's list (`optionsFrom`) and that writes no `options` of its own (0.35.3,
 * NexiBI's page): the one-tag script draws it, and the list fills it, as 0.13 drew it — in each engine.
 */
test('a choice from the app’s list that writes no options draws, and its options come from the list', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/script/');
  await page.waitForFunction(() => 'Fieldia' in window);
  await page.evaluate(async () => {
    const W = window as any;
    const host = document.createElement('div');
    host.id = 'picks';
    document.body.prepend(host);
    const handle = W.Fieldia.mountViewer(host, {
      // NexiBI's page as it was sent (amlak-64): `pick` writes no options.
      page: {
        fieldia: '0.1',
        id: 'pick',
        data: { kind: 'record', model: 'test.pick' },
        fields: {
          kind: { type: 'selection', label: 'Kind', options: [{ value: 'fruit', label: 'Fruit' }] },
          pick: { type: 'selection', label: 'Pick', optionsFrom: { list: 'picks', dependsOn: ['kind'] } },
          many: { type: 'selection', label: 'Many', multiple: true, optionsFrom: { list: 'picks' } },
        },
        layout: {
          type: 'sections',
          id: 'all',
          children: [
            {
              type: 'section',
              id: 'main',
              children: [
                { type: 'field', id: 'f-kind', field: 'kind' },
                { type: 'field', id: 'f-pick', field: 'pick' },
                { type: 'field', id: 'f-many', field: 'many', widget: 'checkboxes' },
              ],
            },
          ],
        },
      },
      values: { kind: 'fruit' },
      dataSource: {
        options: async () => [
          { value: 'a', label: 'Apple' },
          { value: 'b', label: 'Banana' },
        ],
      },
    });
    W.picksHandle = handle;
    await handle.drawn;
  });
  const form = page.locator('#picks');
  await expect(form.locator('[data-node="f-pick"] select option', { hasText: 'Apple' })).toHaveCount(1);
  await form.locator('[data-node="f-pick"] select').selectOption({ label: 'Banana' });
  await expect.poll(() => page.evaluate(() => (window as any).picksHandle.form.getState().values.pick)).toBe('b');
  await expect(form.locator('[data-node="f-many"]').getByLabel('Apple')).toBeVisible();
  await form.locator('[data-node="f-many"]').getByLabel('Apple').check();
  await expect.poll(() => page.evaluate(() => (window as any).picksHandle.form.getState().values.many)).toEqual(['a']);
  expect(errors).toEqual([]);
});
