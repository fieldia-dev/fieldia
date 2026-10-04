import { expect, test, type Page } from '@playwright/test';
import { screen } from './support';

/**
 * A group in twelfths, as the form draws it: each row divided its own way —
 * seven and five, three fours, one whole — every part on the group's twelve
 * tracks. A tablet keeps the proportions when the group says so; a phone
 * stacks them, one under another. The designer writes such groups (rows split
 * as Grafloria's split board splits them); here the form alone is looked at.
 */

const field = (id: string, colspan: number) => ({ type: 'field', id, field: id, colspan });

async function mount(page: Page, columns: unknown, skin: 'outlined' | 'underline' = 'outlined') {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => message.type() === 'error' && problems.push(message.text()));
  await page.goto('/script/');
  await expect(page.locator('.fd-form').first()).toBeVisible();
  const fields = Object.fromEntries(['a', 'b', 'c', 'd', 'e', 'f'].map((name) => [name, { type: 'char', label: `Field ${name}` }]));
  const built = {
    fieldia: '0.1',
    id: 'twelfths',
    data: { kind: 'responses' },
    fields,
    layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 'visit', title: 'Visit', columns, rows: 'full', children: [field('a', 7), field('b', 5), field('c', 4), field('d', 4), field('e', 4), field('f', 12)] }] },
  };
  await page.evaluate(
    ([p, s]) => {
      const fieldia = (window as unknown as { Fieldia: { mountViewer: (e: Element, o: object) => unknown; createMemoryDataSource: () => unknown } }).Fieldia;
      const app = document.getElementById('app') as HTMLElement;
      app.replaceChildren();
      fieldia.mountViewer(app, { page: p, dataSource: fieldia.createMemoryDataSource(), skin: s });
    },
    [built, skin] as const
  );
  await expect(page.locator('.fd-form')).toHaveCount(1);
  return problems;
}

/** Each part's box, and the grid's twelve tracks' edges: every part starts and ends on one. */
function measure(page: Page) {
  return page.evaluate(() => {
    const grid = document.querySelector('.fd-section[data-node="visit"] > .fd-grid') as HTMLElement;
    const style = getComputedStyle(grid);
    const tracks = style.gridTemplateColumns.split(' ').map(parseFloat);
    const gap = parseFloat(style.columnGap) || 0;
    const g = grid.getBoundingClientRect();
    const starts: number[] = [];
    const ends: number[] = [];
    let x = g.left;
    for (const width of tracks) {
      starts.push(x);
      ends.push(x + width);
      x += width + gap;
    }
    const parts = Object.fromEntries(
      [...grid.children].map((part) => {
        const r = part.getBoundingClientRect();
        return [(part as HTMLElement).dataset['node'] as string, { left: r.left, right: r.right, top: Math.round(r.top), width: r.width }];
      })
    );
    const near = (value: number, list: number[]) => list.some((edge) => Math.abs(edge - value) <= 1.5);
    const off = Object.entries(parts)
      .filter(([, r]) => !near(r.left, starts) || !near(r.right, ends))
      .map(([id]) => id);
    return { tracks: tracks.length, gap, grid: g.width, parts, off };
  });
}

for (const skin of ['outlined', 'underline'] as const) {
  test(`${skin}: rows divided in twelfths keep their proportions on a desktop and a tablet, and stack on a phone`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    const problems = await mount(page, { wide: 12, medium: 12, narrow: 1 }, skin);
    let m = await measure(page);
    expect(m.tracks).toBe(12);
    expect(m.off).toEqual([]);
    const { a, b, c, d, e, f } = m.parts;
    // Seven and five on one row; three fours on the next; one whole under them.
    expect([a.top === b.top, c.top === d.top && d.top === e.top, f.top > c.top && c.top > a.top]).toEqual([true, true, true]);
    const track = (m.grid - 11 * m.gap) / 12;
    expect(a.width).toBeCloseTo(7 * track + 6 * m.gap, 0);
    expect(b.width).toBeCloseTo(5 * track + 4 * m.gap, 0);
    expect(Math.abs(c.width - d.width) + Math.abs(d.width - e.width)).toBeLessThanOrEqual(1);
    expect(f.width).toBeCloseTo(m.grid, 0);
    await screen(page, `form-twelfths-${skin}-desktop`);

    // A tablet: the group keeps its twelve tracks, so each row its proportions.
    await page.setViewportSize({ width: 700, height: 900 });
    await expect.poll(async () => (await measure(page)).parts['b'].top).toBe((await measure(page)).parts['a'].top);
    m = await measure(page);
    expect(m.tracks).toBe(12);
    expect(m.off).toEqual([]);
    expect(m.parts['a'].width / m.parts['b'].width).toBeGreaterThan(1.3);
    await screen(page, `form-twelfths-${skin}-tablet`);

    // A phone: one under another, each the whole width.
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(async () => (await measure(page)).tracks).toBe(1);
    m = await measure(page);
    const tops = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => m.parts[id].top);
    expect(tops).toEqual([...tops].sort((x, y) => x - y));
    expect(new Set(tops).size).toBe(6);
    for (const id of ['a', 'b', 'c', 'f']) expect(m.parts[id].width).toBeCloseTo(m.grid, 0);
    await screen(page, `form-twelfths-${skin}-phone`);
    expect(problems).toEqual([]);
  });
}

test('a group in twelfths that says nothing for a tablet keeps them in the outlined skin, and stacks on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await mount(page, 12);
  let m = await measure(page);
  expect([m.tracks, m.off, m.parts['a'].top === m.parts['b'].top]).toEqual([12, [], true]);
  await page.setViewportSize({ width: 390, height: 900 });
  await expect.poll(async () => (await measure(page)).tracks).toBe(1);
  m = await measure(page);
  expect(m.parts['b'].top).toBeGreaterThan(m.parts['a'].top);
});
