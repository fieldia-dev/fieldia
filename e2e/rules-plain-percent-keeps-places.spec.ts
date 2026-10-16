import { expect, test } from './fixtures';

/**
 * A per cent drawn by its plain stand-in (0.23: the business part not come yet, or failed — "a part that cannot come
 * leaves them, and they work") reads what is typed with the main script's reader, but not the part's limits: its
 * places. The part's box refuses "12.345" in a per cent of two places; the plain one takes it, shows "12.35%" once
 * left, and the save sends 0.12345 — a value the box never showed, which the field's own box could never take.
 */
test('a per cent of two places drawn plainly never saves "12.345" as 0.12345 while it shows 12.35%', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  // The business part cannot come: the viewer draws the per cent plainly, as it says it does.
  await page.route('**/fieldia.business.js', (route) => route.abort());
  await page.goto('/script/');
  await expect(page.locator('.fd-form')).toBeVisible();
  await page.evaluate(async () => {
    const fieldia = (window as any).Fieldia;
    const shown = {
      fieldia: '0.1',
      id: 'own',
      title: 'Own',
      data: { kind: 'responses' },
      fields: { share: { type: 'float', label: 'Share' } },
      layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-share', field: 'share', widget: 'percentage' }] },
    };
    const demo = (window as any).fieldiaDemo;
    (window as any).own = fieldia.createMemoryDataSource();
    demo.handle.destroy();
    demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource: (window as any).own });
    await demo.handle.drawn;
  });
  const share = page.locator('[data-node="f-share"] input');
  await share.click();
  await page.keyboard.type('12.345');
  await page.keyboard.press('Tab');
  await page.locator('#app button[type="submit"], #app .fd-submit').first().click();
  // Whatever the box shows, what is sent is what it shows, and never more places than a per cent of two takes.
  const sent = await page.evaluate(() => ((window as any).own.responses as { values: Record<string, unknown> }[]).map((response) => response.values['share']));
  expect(sent).not.toContain(0.12345);
  expect(problems).toEqual([]);
});
