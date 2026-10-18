import { expect, test } from './fixtures';
import { DEMOS, demoHref } from '../demos/catalog.mjs';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Every list a person reads on a phone is cards there, or a table that fits: no demo's list — a list page's, a related
 * list's inside a record — scrolls sideways at 390 with its values off to the right, as the property's viewings and the
 * featured customer list did in the 0.25 walk. A list that stays a table on purpose says why here.
 */
const TABLE_ON_PURPOSE: Record<string, string> = {
  // An exact replica of a work tracker's backlog: its rows are its columns, as the tracker draws them on any width.
  backlog: 'the work tracker’s own backlog, drawn as it draws it',
};

test('no demo’s list scrolls sideways on a phone, unless it says why', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/plain/?page=signup');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  // The pages with a list, or a list inside a record: read from the demos' own pages, so a new one is held to it too.
  const listing: string[] = await page.evaluate(() =>
    Object.entries((window as any).fieldiaDemo.pages as Record<string, { layout: { type: string } }>)
      .filter(([, shown]) => shown.layout.type === 'list' || JSON.stringify(shown.layout).includes('"type":"related"'))
      .map(([name]) => name)
  );
  const demos = DEMOS.filter((demo) => demo.app === 'backlog' || (!demo.app && listing.includes(new URLSearchParams(demo.query ?? '').get('page') ?? 'signup')));
  expect(demos.length).toBeGreaterThanOrEqual(10);
  test.setTimeout(demos.length * 8000);
  const sideways: string[] = [];
  for (const demo of demos) {
    await page.goto(`/${demoHref(demo)}`);
    // Its rows in (a list shown as a map alone on a phone keeps its table hidden: nothing to scroll there).
    await expect(page.locator('.fd-list-row, .fd-list-empty, .fd-cal').first(), demo.id).toBeAttached();
    /** Each list shown, by its node, and how far it scrolls sideways. */
    const wide = () =>
      page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>('.fd-list-scroll')]
          .filter((scroll) => scroll.offsetParent !== null && scroll.querySelector('.fd-list-row'))
          .map((scroll) => [scroll.closest('[data-node]')?.getAttribute('data-node') ?? '', scroll.scrollWidth - scroll.clientWidth] as const)
          .filter(([, over]) => over > 1)
      );
    // Its cards come with their part, a moment after the rows: what still scrolls once they have.
    await expect.poll(async () => (await wide()).length, { timeout: 3000 }).toBe(0).catch(() => undefined);
    const over = await wide();
    if (over.length && !TABLE_ON_PURPOSE[demo.id]) sideways.push(`${demo.id}: ${over.map(([node, by]) => `${node} by ${by}px`).join(', ')}`);
    if (!TABLE_ON_PURPOSE[demo.id]) await expectNoSidewaysScroll(page);
    if (['customers', 'property', 'map-homes', 'map-zones'].includes(demo.id)) await screen(page, `phone-list-${demo.id}`, { viewport: true });
  }
  expect(sideways).toEqual([]);
});
