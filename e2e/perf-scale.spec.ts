import { expect, test } from './fixtures';
import { asAPhone, countsOf, domCounters, mountGenerated, type Counts } from './perf-counts';

/**
 * Fieldia at scale, held by what the browser counts rather than by a clock (0.35, the audit's M6): the layouts an action
 * runs and the objects they lay out, the style recalculations, the DOM written, the DOM kept and the scripts asked for —
 * none of which a slow or a busy runner changes. A form of 500 fields, a table of 200 lines, a list of 5,000 rows; on a
 * desktop and on a mid-range phone (`perf-phone`: 412 px, 4× slower). Each count against a budget measured on 0.35's
 * build with a little room; the lanes that make one of them smaller (perf-form: a form's updaters; perf-lists: rows
 * windowed, a table of lines' cells) tighten its budget to what they reach. Run alone, one worker, in CI's own perf job.
 */

test.skip(({ browserName }) => browserName !== 'chromium', 'the counts are Chromium’s (its trace, its DOM counters)');
test.use({ trace: 'off' });

const PHONE = () => test.info().project.name === 'perf-phone';

/**
 * The budgets, by scenario and by profile: upper bounds, each what 0.35's build counts (perf-bytes, 25 Oct) with about 5%
 * room. What they say of today: a key in a form of 500 fields writes nothing but lays the whole form out (4,920 objects:
 * no box is contained — a list's cell is since 0.34); a key in a record's header rewrites every line of its table (1,600
 * changes for 200 lines, 8 a line: the audit's H3); a list of 5,000 rows keeps 100,511 nodes and 30,141 listeners, and a
 * row ticked lays out and restyles them all (H1). perf-form and perf-lists bring these down, and their budgets with them.
 */
const BUDGET: Record<string, Record<'desktop' | 'phone', Partial<Counts> & { nodes?: number; listeners?: number }>> = {
  'a key in a field nothing reads, 500 fields': { desktop: { layouts: 2, layoutObjects: 5200, mutations: 4, scripts: 0 }, phone: { layouts: 2, layoutObjects: 5100, mutations: 4, scripts: 0 } },
  'a key in a field a rule reads, 500 fields': { desktop: { layouts: 2, layoutObjects: 5200, mutations: 4, scripts: 0 }, phone: { layouts: 2, layoutObjects: 5100, mutations: 4, scripts: 0 } },
  'a key in the header of a 200-line table': { desktop: { layouts: 2, layoutObjects: 6400, mutations: 1700, scripts: 0 }, phone: { layouts: 2, layoutObjects: 8700, mutations: 1700, scripts: 0 } },
  'a list of 5,000 rows drawn': { desktop: { nodes: 105_000, listeners: 31_700 }, phone: { nodes: 105_000, listeners: 31_700 } },
  'a row of 5,000 ticked': { desktop: { layouts: 2, layoutObjects: 116_000, mutations: 5300, scripts: 0 }, phone: { layouts: 2, layoutObjects: 116_000, mutations: 5300, scripts: 0 } },
};

/** Hold counts to the scenario's budget, saying all of them; and note them for the trend (test-results/perf). */
function hold(scenario: string, counts: Partial<Counts> & { nodes?: number; listeners?: number }) {
  const profile = PHONE() ? 'phone' : 'desktop';
  const budget = BUDGET[scenario][profile];
  test.info().annotations.push({ type: 'counts', description: `${scenario} (${profile}): ${JSON.stringify(counts)}` });
  console.log(`${scenario} (${profile}): ${JSON.stringify(counts)}`);
  for (const [name, most] of Object.entries(budget)) expect.soft(counts[name as keyof typeof counts], `${scenario}: ${name}`).toBeLessThanOrEqual(most as number);
}

test.beforeEach(async ({ page }) => {
  if (PHONE()) await asAPhone(page);
});

test('500 fields: a key writes and lays out what it changed, never the form', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await page.goto('/plain/?page=big&skin=outlined');
  await expect(page.locator('.fd-field[data-field]')).toHaveCount(500, { timeout: 60_000 });
  const quiet = page.locator('[data-node="f-s13-reference"] input');
  await quiet.click();
  await page.keyboard.type('ab');
  hold('a key in a field nothing reads, 500 fields', await countsOf(page, browser, () => page.keyboard.type('x'), '.fd-form'));
  const read = page.locator('[data-node="f-s01-name"] input');
  await read.click();
  await page.keyboard.type('Nile');
  await expect(page.locator('[data-node="f-s01-reference"]')).toBeVisible();
  hold('a key in a field a rule reads, 500 fields', await countsOf(page, browser, () => page.keyboard.type('x'), '.fd-form'));
});

/** A record with a header field and a table of `n` lines, three columns and a worked-out amount on each. */
function linesPage(n: number) {
  const values = { ref: 'PO-1', lines: Array.from({ length: n }, (_, i) => ({ key: `l${i + 1}`, id: i + 1, values: { item: `Item ${i + 1}`, qty: (i % 7) + 1, price: 10 + (i % 13) } })) };
  return {
    page: {
      fieldia: '0.13',
      id: 'order',
      title: 'Order',
      data: { kind: 'record', model: 'order' },
      fields: {
        ref: { type: 'char', label: 'Reference' },
        lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { item: { type: 'char', label: 'Item' }, qty: { type: 'integer', label: 'Qty' }, price: { type: 'float', label: 'Price' }, amount: { type: 'float', label: 'Amount', compute: 'qty * price' } } },
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 's', children: [{ type: 'field', id: 'f-ref', field: 'ref' }, { type: 'field', id: 'f-lines', field: 'lines' }] }] },
    },
    records: { order: { 1: values } },
    recordId: 1,
  };
}

test('200 lines: a key in the header writes no line', async ({ page, browser }) => {
  test.setTimeout(180_000);
  await mountGenerated(page, linesPage(200));
  await expect(page.locator('#app .fd-lines-table tbody tr')).toHaveCount(200, { timeout: 60_000 });
  const ref = page.locator('#app [data-node="f-ref"] input');
  await ref.click();
  await page.keyboard.press('End');
  await page.keyboard.type('a');
  hold('a key in the header of a 200-line table', await countsOf(page, browser, () => page.keyboard.type('b'), '#app .fd-form'));
});

/** A list of `n` rows, five columns, all on one page. */
function listPage(n: number) {
  const people = Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { name: `Customer ${String(i + 1).padStart(4, '0')}`, email: `c${i + 1}@example.com`, city: ['Cairo', 'Giza', 'Luxor'][i % 3], credit: (i * 37) % 100000, visits: i % 50 }]));
  return {
    page: {
      fieldia: '0.13',
      id: 'people',
      title: 'Customers',
      data: { kind: 'record', model: 'person' },
      fields: { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, city: { type: 'char', label: 'City' }, credit: { type: 'monetary', label: 'Credit', currency: 'EGP' }, visits: { type: 'integer', label: 'Visits' } },
      layout: { type: 'list', id: 'people-list', columns: ['name', 'email', 'city', 'credit', 'visits'], pageSize: n },
    },
    records: { person: people },
  };
}

test('5,000 rows: the DOM a list keeps, and a row ticked', async ({ page, browser }) => {
  test.skip(PHONE(), 'drawn whole, 5,000 rows take minutes at 4× (the audit: 12.7 s a reload on a phone): the desktop counts are the same DOM');
  test.setTimeout(300_000);
  await mountGenerated(page, listPage(5000));
  await expect(page.locator('#app .fd-list-row')).toHaveCount(5000, { timeout: 120_000 });
  hold('a list of 5,000 rows drawn', await domCounters(page));
  const tick = page.locator('#app .fd-list-row').nth(2).locator('input[type="checkbox"]');
  hold('a row of 5,000 ticked', await countsOf(page, browser, () => tick.check(), '#app'));
});
