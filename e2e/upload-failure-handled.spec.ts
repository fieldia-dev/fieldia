import { installZonePromises } from '../testing/zone-promises';
import { expect, test } from './fixtures';

/**
 * An upload that fails — refused at once, thrown at once, or refused later — leaves no promise rejection unhandled
 * (0.35.3, NexiBI's report): the page's promises kept as Angular's zone keeps them (testing/zone-promises.ts: a refusal
 * with no handler by the next microtask is said, as `NgZone.onError` hears it), and the engine's own
 * `unhandledrejection` listened to as well. The field says "Not uploaded" with its Retry. In each engine.
 */
const CASES = {
  'refused at once': 'at-once',
  'thrown at once': 'thrown',
  'refused later': 'later',
} as const;

for (const [name, how] of Object.entries(CASES)) {
  test(`an upload ${name}: Not uploaded, with Retry, and nothing unhandled`, async ({ page }) => {
    // Before any script of the page: its promises are the zone's from the start, as an Angular app's are.
    await page.addInitScript(installZonePromises);
    await page.addInitScript(() => {
      const W = window as any;
      W.__native = [];
      window.addEventListener('unhandledrejection', (event) => W.__native.push(String((event.reason as Error)?.message ?? event.reason)));
    });
    await page.goto('/script/');
    await page.waitForFunction(() => 'Fieldia' in window);
    await page.evaluate(async (how) => {
      const W = window as any;
      const host = document.createElement('div');
      host.id = 'up';
      document.body.prepend(host);
      const upload = () => {
        if (how === 'thrown') throw new Error('thrown refusal');
        if (how === 'at-once') return Promise.reject(new Error('plain refusal'));
        return new Promise((_, reject) => setTimeout(() => reject(new Error('late refusal')), 50));
      };
      // NexiBI's page as it was sent (amlak-64).
      const handle = W.Fieldia.mountViewer(host, {
        page: {
          fieldia: '0.1',
          id: 'up',
          title: 'Up',
          data: { kind: 'responses' },
          fields: { drawing: { type: 'binary', label: 'Drawing' } },
          layout: { type: 'sections', id: 'all', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-drawing', field: 'drawing' }] }] },
        },
        dataSource: { submit: async () => ({}), upload },
      });
      await handle.drawn;
    }, how);
    const field = page.locator('#up [data-node="f-drawing"]');
    await field.locator('input[type=file]').setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('abc') });
    await expect(field).toContainText('Not uploaded');
    await expect(field.getByRole('button', { name: /Retry/ })).toBeVisible();
    // A turn past the refusal's own, for anything left unhandled to be said.
    await page.evaluate(() => new Promise((done) => setTimeout(done, 100)));
    expect(await page.evaluate(() => ((window as any).__zoneSaid as unknown[]).map((reason) => String((reason as Error)?.message ?? reason)))).toEqual([]);
    expect(await page.evaluate(() => (window as any).__native)).toEqual([]);
  });
}
