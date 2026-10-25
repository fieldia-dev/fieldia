import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * A long list keeps only the rows near the view in the page (list-window.ts; the performance audit's H1): past a hundred
 * rows shown, a view's height of rows above the view and below it, the rest kept as data, a gap row as tall as they are
 * in their place. Held here in each engine by what a person and a screen reader meet: the rows counted
 * (`aria-rowcount`) and each its place (`aria-rowindex`); the page's elements as many at 3,000 rows wherever the view
 * is; Down past the last row drawn reaches the next; the focus kept on its row as the view scrolls away and back; every
 * row loaded chosen; what the person reads kept in place as rows of differing heights come and go above it — WebKit has
 * no scroll anchoring of its own, so the list keeps it there; right to left; every row on paper; and Ctrl or ⌘ and F
 * taking the person to the list's own search, the browser's find seeing only the rows in the page. The rows drawn are
 * the rows drawn whole (the oracle, in libs/viewer/src/lib/list-window.spec.ts).
 */

const PEOPLE = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [i + 1, { name: `Customer ${String(i + 1).padStart(4, '0')}`, email: `c${i + 1}@example.com`, city: ['Cairo', 'Giza', 'Luxor'][i % 3], credit: (i * 37) % 100000, visits: i % 50 }]));
const FIELDS = { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, city: { type: 'char', label: 'City' }, credit: { type: 'monetary', label: 'Credit', currency: 'EGP' }, visits: { type: 'integer', label: 'Visits' } };

/** Each person's visits, three of them, for a list whose rows open to them (`detail`). */
const VISITS = (n: number) => Object.fromEntries(Array.from({ length: n * 3 }, (_, i) => [i + 1, { person_id: { id: 1 + (i % n), label: `Customer ${String(1 + (i % n)).padStart(4, '0')}` }, when: '2026-10-1' + (i % 9), note: `Visit ${i + 1}` }]));

/** The one-tag script's page with a list of `n` people mounted in place of its form, `dir` its direction. */
async function mountList(page: Page, n: number, layout: Record<string, unknown> = {}, dir: 'ltr' | 'rtl' = 'ltr') {
  await page.goto('/script/');
  await page.waitForFunction(() => (window as unknown as { fieldiaDemo?: unknown }).fieldiaDemo);
  await page.evaluate(
    async ([fields, people, layout, dir, n, visits]) => {
      const w = window as unknown as { fieldiaDemo: { handle: { destroy(): void } }; Fieldia: { mountViewer(h: Element, o: unknown): unknown; createMemoryDataSource(o: unknown): unknown } };
      w.fieldiaDemo.handle.destroy();
      document.documentElement.dir = dir as string;
      const page = { fieldia: '0.13', id: 'people', title: 'Customers', data: { kind: 'record', model: 'person' }, fields, layout: { type: 'list', id: 'people-list', columns: ['name', 'email', 'city', 'credit', 'visits'], sort: [{ field: 'name' }], pageSize: n, searchFields: ['name', 'email'], ...layout } };
      (window as unknown as { list: unknown }).list = w.Fieldia.mountViewer(document.getElementById('app') as Element, { page, dataSource: w.Fieldia.createMemoryDataSource({ records: { person: people, visit: visits } }) });
    },
    [FIELDS, PEOPLE(n), layout, dir, n, layout['detail'] ? VISITS(n) : {}] as const
  );
  // A long list counts its rows, those in the page fewer; a page of a list holds every row, as it always did.
  if (n > 100) await expect(page.locator('#app .fd-list-table')).toHaveAttribute('aria-rowcount', String(n + 1), { timeout: 30000 });
  else await expect(page.locator('#app tbody tr.fd-list-row')).toHaveCount(n, { timeout: 30000 });
  await frames(page);
}

/** Two frames: the window draws round the view at the frame after a scroll, the browser lays it out at the next. */
const frames = (page: Page) => page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
const rows = (page: Page) => page.locator('#app tbody tr.fd-list-row');
/** The rows in the page: how many, the place of the first and the last, and how many elements the list holds. */
const inPage = (page: Page) =>
  page.evaluate(() => {
    const drawn = [...document.querySelectorAll('#app tbody tr.fd-list-row')];
    return { rows: drawn.length, first: Number(drawn[0]?.getAttribute('aria-rowindex')), last: Number(drawn.at(-1)?.getAttribute('aria-rowindex')), elements: document.querySelectorAll('#app *').length };
  });
/** The place of the first row whose middle is in the view. */
const firstInView = (page: Page) =>
  page.evaluate(() => {
    const row = [...document.querySelectorAll<HTMLElement>('#app tbody tr.fd-list-row')].find((tr) => {
      const box = tr.getBoundingClientRect();
      return box.top + box.height / 2 > 0 && box.top + box.height / 2 < innerHeight;
    });
    return { index: Number(row?.getAttribute('aria-rowindex')), name: row?.querySelector('td[data-col="name"]')?.textContent ?? '' };
  });
async function scrollTo(page: Page, y: number) {
  await page.evaluate((y) => window.scrollTo(0, y), y);
  await frames(page);
  await frames(page);
}

test('keeps only the rows near the view in the page as it scrolls, its rows counted and each in its place', async ({ page }) => {
  await mountList(page, 3000);
  const top = await inPage(page);
  // A view's height of rows round the view, never the 3,000: the first of them the list's first.
  expect(top.rows).toBeGreaterThan(10);
  expect(top.rows).toBeLessThan(200);
  expect(top.first).toBe(2);
  await expect(page.locator('#app thead tr')).toHaveAttribute('aria-rowindex', '1');
  // As tall as every row: scrolled to the middle, the rows there, each said in its place.
  const tall = await page.evaluate(() => document.documentElement.scrollHeight);
  expect(tall).toBeGreaterThan(3000 * 30);
  await scrollTo(page, tall / 2);
  const middle = await inPage(page);
  const seen = await firstInView(page);
  expect(middle.rows).toBeLessThan(200);
  expect(seen.index).toBeGreaterThan(1200);
  expect(seen.index).toBeLessThan(1800);
  expect(seen.name).toBe(`Customer ${String(seen.index - 1).padStart(4, '0')}`);
  expect(middle.first).toBeLessThan(seen.index);
  expect(middle.last).toBeGreaterThan(seen.index);
  // At the end, the last row; and wherever the view is, a few thousand elements in the page at most — 0.34 drew 30,000.
  await scrollTo(page, tall);
  await expect(rows(page).last().locator('td[data-col="name"]')).toHaveText('Customer 3000');
  await expect(rows(page).last()).toHaveAttribute('aria-rowindex', '3001');
  const end = await inPage(page);
  expect(end.rows).toBeLessThan(200);
  for (const at of [top, middle, end]) expect(at.elements).toBeLessThan(3000);
});

test('Down past the last row drawn reaches the next, and the focus stays on its row as the view scrolls away and back', async ({ page }) => {
  await mountList(page, 3000);
  await rows(page).first().focus();
  const drawn = (await inPage(page)).rows;
  // Past every row drawn at first, one key at a time: each row reached in turn, the view following.
  for (let i = 0; i < drawn + 20; i++) await page.keyboard.press('ArrowDown');
  const focused = page.locator('#app tbody tr.fd-list-row:focus');
  await expect(focused).toHaveAttribute('aria-rowindex', String(drawn + 22));
  await expect(focused.locator('td[data-col="name"]')).toHaveText(`Customer ${String(drawn + 21).padStart(4, '0')}`);
  await expect(focused).toBeInViewport();
  const marked = await focused.evaluate((tr) => ((tr as HTMLElement).dataset['mark'] = 'kept'));
  expect(marked).toBe('kept');
  // The view far away: the row with the focus stays in the page, the focus on it.
  await scrollTo(page, 80000);
  await expect(page.locator('#app tbody tr.fd-list-row[data-mark="kept"]')).toBeFocused();
  // Back again: the same row, never one drawn afresh.
  await scrollTo(page, 0);
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('#app tbody tr.fd-list-row:focus')).toHaveAttribute('aria-rowindex', String(drawn + 21));
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('#app tbody tr.fd-list-row[data-mark="kept"]')).toBeFocused();
});

test('chooses every row loaded, those not drawn too, and says how many', async ({ page }) => {
  await mountList(page, 3000);
  await page.locator('#app thead .fd-list-checkbox').check();
  await expect(page.locator('#app .fd-list-count')).toHaveText('3,000 selected');
  await scrollTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
  const last = rows(page).last();
  await expect(last).toHaveAttribute('aria-selected', 'true');
  await expect(last.locator('.fd-list-checkbox')).toBeChecked();
  await last.locator('.fd-list-checkbox').uncheck();
  await expect(page.locator('#app .fd-list-count')).toHaveText('2,999 selected');
  await expect(page.locator('#app thead .fd-list-checkbox')).toHaveJSProperty('indeterminate', true);
});

test('keeps what the person reads in place as rows of differing heights come and go above it', async ({ page }) => {
  await mountList(page, 3000);
  // Every seventh row three times as tall: the rows not drawn yet are guessed at their average, and are not it.
  await page.addStyleTag({ content: '#app .fd-list-row[data-id$="7"] td { height: 96px; }' });
  await scrollTo(page, 50000);
  for (let step = 0; step < 14; step++) {
    // The row whose top is lowest in the view's upper half: where it stands as the view moves up by 150 pixels.
    const before = await page.evaluate(() => {
      const row = [...document.querySelectorAll<HTMLElement>('#app tbody tr.fd-list-row')].find((tr) => tr.getBoundingClientRect().top > innerHeight / 3);
      if (row) row.dataset['anchor'] = String(Date.now());
      return { at: row?.getBoundingClientRect().top ?? 0, id: row?.dataset['id'] };
    });
    await page.evaluate(() => window.scrollBy(0, -150));
    await frames(page);
    await frames(page);
    const after = await page.evaluate((id) => document.querySelector<HTMLElement>(`#app tbody tr.fd-list-row[data-id="${id}"]`)?.getBoundingClientRect().top ?? null, before.id);
    // Within a pixel: rows lay out at fractions of one.
    expect({ step, moved: after === null ? null : Math.abs(after - before.at - 150) <= 1 }).toEqual({ step, moved: true });
  }
});

test('a row opened to its details stays open as the view goes away and comes back, what is read kept in place', async ({ page }) => {
  await mountList(page, 2000, { detail: { model: 'visit', field: 'person_id', title: 'Visits', fields: { when: { type: 'date', label: 'When' }, note: { type: 'char', label: 'Note' } }, columns: ['when', 'note'] } });
  const row = page.locator('#app tbody tr.fd-list-row[data-id="3"]');
  await row.locator('.fd-list-detail-toggle').first().click();
  const opened = page.locator('#app tbody tr.fd-list-detail[data-detail-of="3"]');
  await expect(opened.getByRole('row')).toHaveCount(4);
  // Far away, then back — the focus elsewhere, which would keep its row in the page: the row and what it opened to are
  // drawn again, open, under it.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await scrollTo(page, 50000);
  await expect(opened).toHaveCount(0);
  await scrollTo(page, 0);
  await expect(opened.getByRole('row')).toHaveCount(4);
  await expect(row.locator('.fd-list-detail-toggle').first()).toHaveAttribute('aria-expanded', 'true');
  expect(await opened.evaluate((tr) => (tr.previousElementSibling as HTMLElement).dataset['id'])).toBe('3');
  // Rows opened in the middle, then the view moved up past them: the row read stays where it was.
  await scrollTo(page, 30000);
  const middle = page.locator('#app tbody tr.fd-list-row:not([data-id="3"])');
  for (let i = 0; i < 6; i++) await middle.nth(4 + i * 2).locator('.fd-list-detail-toggle').first().click();
  await frames(page);
  for (let step = 0; step < 8; step++) {
    const before = await page.evaluate(() => {
      const one = [...document.querySelectorAll<HTMLElement>('#app tbody tr.fd-list-row')].find((tr) => tr.getBoundingClientRect().top > innerHeight / 3);
      return { at: one?.getBoundingClientRect().top ?? 0, id: one?.dataset['id'] };
    });
    await page.evaluate(() => window.scrollBy(0, -250));
    await frames(page);
    await frames(page);
    const after = await page.evaluate((id) => document.querySelector<HTMLElement>(`#app tbody tr.fd-list-row[data-id="${id}"]`)?.getBoundingClientRect().top ?? null, before.id);
    expect({ step, moved: after === null ? null : Math.abs(after - before.at - 250) <= 1 }).toEqual({ step, moved: true });
  }
});

test('reads right to left the same: its rows counted, Down past the last row drawn', async ({ page }) => {
  await mountList(page, 2000, {}, 'rtl');
  await scrollTo(page, 40000);
  const middle = await inPage(page);
  expect(middle.rows).toBeLessThan(200);
  expect(middle.first).toBeGreaterThan(500);
  await page.locator('#app tbody tr.fd-list-row').nth(5).focus();
  const at = Number(await page.locator('#app tbody tr.fd-list-row:focus').getAttribute('aria-rowindex'));
  for (let i = 0; i < 150; i++) await page.keyboard.press('ArrowDown');
  await expect(page.locator('#app tbody tr.fd-list-row:focus')).toHaveAttribute('aria-rowindex', String(at + 150));
});

test('prints every row loaded, and is back to the rows near the view after', async ({ page }) => {
  await mountList(page, 600);
  const drawn = (await inPage(page)).rows;
  expect(drawn).toBeLessThan(200);
  // As printing begins, every row is in the page — what a page listening for paper after the list sees.
  const onPaper = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        addEventListener('beforeprint', () => resolve(document.querySelectorAll('#app tbody tr.fd-list-row').length), { once: true });
        dispatchEvent(new Event('beforeprint'));
      })
  );
  expect(onPaper).toBe(600);
  await page.evaluate(() => dispatchEvent(new Event('afterprint')));
  await frames(page);
  expect((await inPage(page)).rows).toBeLessThan(200);
});

test('takes Ctrl or ⌘ and F to the list’s own search, saying why; the same keys there are the browser’s own find', async ({ page }) => {
  await mountList(page, 1000);
  await rows(page).nth(3).focus();
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+f`);
  const box = page.locator('#app .fd-list-bar input').first();
  await expect(box).toBeFocused();
  await expect(page.locator('#app .fd-list-find')).toHaveText('Find in page sees only the rows on screen: search here to find any record.');
  // In the search box, the browser's own: the list lets the keys be.
  await page.evaluate(() => document.addEventListener('keydown', (event) => setTimeout(() => ((window as unknown as { prevented?: boolean }).prevented = event.defaultPrevented)), { once: true }));
  await page.keyboard.press(`${mod}+f`);
  await expect.poll(() => page.evaluate(() => (window as unknown as { prevented?: boolean }).prevented)).toBe(false);
  // A short list keeps every row in the page: its keys are the browser's own.
  await mountList(page, 40);
  await expect(page.locator('#app .fd-list-table')).not.toHaveAttribute('aria-rowcount', /.*/);
});

test.describe('cells changed in place, past the rows drawn', () => {
  // The clipboard is the browser's, one for every page a worker has open: these take turns with it.
  test.describe.configure({ mode: 'default' });

  /** Rows copied as a spreadsheet puts them on the clipboard: from a box of their own, chosen whole and copied with the keys. */
  async function copy(page: Page, text: string) {
    await page.evaluate((words) => {
      const sheet = document.createElement('textarea');
      sheet.id = 'e2e-copied';
      sheet.value = words;
      // In sight where the view is: the page is not scrolled to it, at the foot of a list of a thousand.
      sheet.style.cssText = 'position: fixed; top: 0; left: 0;';
      document.body.append(sheet);
      sheet.focus({ preventScroll: true });
      sheet.select();
    }, text);
    await page.keyboard.press('ControlOrMeta+C');
    await page.evaluate(() => document.getElementById('e2e-copied')?.remove());
  }
  const atPlace = (page: Page, index: number) => page.locator(`#app tbody tr.fd-list-row[aria-rowindex="${index}"]`);

  test('Tab past the last row drawn opens the next row’s cell; a block pasted reaches the rows not drawn; a row added at the end', async ({ page }) => {
    await mountList(page, 1000, { editable: true });
    const last = Number(await rows(page).last().getAttribute('aria-rowindex'));
    // The last row drawn, its last cell: Tab goes on to the row after it, drawn as it is reached.
    await atPlace(page, last).locator('td[data-col="visits"]').click();
    await expect(page.locator('td[data-editing]')).toHaveCount(1);
    await page.keyboard.press('Tab');
    await expect(page.locator('#app tbody tr.fd-list-row:has(td[data-editing])')).toHaveAttribute('aria-rowindex', String(last + 1));
    await expect(page.locator('td[data-editing] input')).toBeFocused();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    // Four rows' Visits pasted on the last row drawn: the three after it, not in the page yet, take theirs.
    await copy(page, '7\n8\n9\n10\n');
    await frames(page);
    const now = Number(await rows(page).last().getAttribute('aria-rowindex'));
    await atPlace(page, now).locator('td[data-col="visits"]').click();
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+V');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Paste 4 rows' }).click();
    await expect(page.locator('.fd-list-paste-words')).toHaveText('Pasted into 4 cells.');
    for (const [i, visits] of ['7', '8', '9', '10'].entries()) {
      await atPlace(page, now + i).scrollIntoViewIfNeeded();
      await expect(atPlace(page, now + i).locator('td[data-col="visits"]')).toHaveText(visits);
    }
    // At the end of the thousand, a row added: its first cell open there, in view.
    await scrollTo(page, await page.evaluate(() => document.documentElement.scrollHeight));
    await page.locator('#app .fd-list-add').click();
    const added = page.locator('#app tbody tr.fd-list-row[data-new]');
    await expect(added).toHaveAttribute('aria-rowindex', '1002');
    await expect(added.locator('td[data-editing] input')).toBeFocused();
    await expect(added).toBeInViewport();
    await page.keyboard.type('Customer 1001');
    await page.keyboard.press('Enter');
    await page.locator('#app .fd-list-bar input').first().focus();
    await expect(page.locator('#app .fd-list-table')).toHaveAttribute('aria-rowcount', '1002');
    await expect(page.locator('#app tbody tr.fd-list-row[data-new]')).toHaveCount(0);
  });
});
