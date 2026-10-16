import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';

/**
 * The work item's parts loaded the first time a page uses them (parts.ts in
 * @fieldia/widgets): a work item's head with its window, its text editors, its
 * path pickers, a list screen and its filter bar, the Discussion and the History.
 *
 * In the backlog demo, built as an app's bundler builds it (each part a chunk
 * of its own): the backlog asks for its list's and its filter bar's chunks alone; the bug's
 * popup asks for its head's, its text's, its pickers', its own lists', its
 * Discussion's as it first opens and its History's as that tab first does — and opens drawn whole, so nothing in it moves
 * as they arrive: no layout shift, every part where it first stood, and the
 * focus in the popup, then back on its row.
 *
 * In the script demo, from one <script> tag: a page using no part asks for no
 * file but fieldia.js; a work item's bug asks for fieldia.head.js,
 * fieldia.text.js, fieldia.path.js and fieldia.choice.js, from beside
 * fieldia.js, and no other.
 */

/** What only each part's code holds: a class name of its own, in its stylesheet. */
const MARKS: Record<string, string> = {
  head: 'fd-head-strip',
  text: 'fd-md-preview',
  path: 'fd-path-callout',
  choice: 'fd-own-words',
  filters: 'fd-filter-option',
  list: 'fd-favourite-list',
  discussion: 'fd-comment-card',
  history: 'fd-history-graph',
};

/** Each chunk the page asks for, and which parts' code it holds. */
function chunks(page: Page) {
  const asked: { url: string; parts: string[] }[] = [];
  page.on('response', async (response) => {
    const url = new URL(response.url()).pathname;
    if (!/\/chunks\/[^/]+\.js$/.test(url)) return;
    const code = await response.text().catch(() => '');
    asked.push({
      url,
      parts: Object.entries(MARKS)
        .filter(([, mark]) => code.includes(mark))
        .map(([part]) => part),
    });
  });
  return {
    asked,
    parts: () => [...new Set(asked.flatMap((chunk) => chunk.parts))].sort(),
  };
}

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

test.describe('the backlog demo, its parts as chunks', () => {
  test.use({ viewport: { width: 1920, height: 983 } });

  test('the backlog asks for its list and filter bar alone; the popup for its own parts as it opens, drawn whole: nothing moves, the focus kept', async ({ page }) => {
    const problems = watch(page);
    const loaded = chunks(page);
    await page.goto('/backlog/');
    await expect(page.locator('.fd-list-row:visible').first()).toBeVisible();
    await expect(page.locator('.fd-filter-bar')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // The list's chunk and the filter bar's, and no part of the work item's popup.
    expect(loaded.parts()).toEqual(['filters', 'list']);
    // Every layout shift from now on, and where each part of the popup stands the moment it is first in the page.
    await page.evaluate(() => {
      const w = window as unknown as {
        shifts: number[];
        first: Record<string, number[]> | null;
      };
      w.shifts = [];
      w.first = null;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as unknown as {
          value: number;
          hadRecentInput: boolean;
        }[])
          if (!entry.hadRecentInput) w.shifts.push(entry.value);
      }).observe({ type: 'layout-shift', buffered: false });
      // Where each stands as the popup is first painted: the frame after it came into the page.
      let asked = false;
      new MutationObserver(() => {
        if (asked || !document.querySelector('.fd-form-dialog')) return;
        asked = true;
        requestAnimationFrame(() => {
          w.first = {};
          for (const part of [
            '.fd-form-dialog',
            '.fd-head',
            '.fd-head-band',
            '.fd-head-tabs',
            '[data-node="f-area"]',
            '[data-node="f-iteration"]',
            '[data-node="f-repro"]',
            '.fd-slot[data-slot="discussion"]',
          ]) {
            const at = document.querySelector(part)?.getBoundingClientRect();
            w.first[part] = at ? [at.x, at.y, at.width, at.height] : [];
          }
        });
      }).observe(document.body, { childList: true, subtree: true });
    });
    const row = page.locator('.fd-list-row[data-id="4127"]');
    await row.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('BUG 4127')).toBeVisible();
    // Its own parts asked for as it opened: its head, text, pickers, own lists and Discussion — its History once its tab is.
    await page.waitForLoadState('networkidle');
    await expect.poll(() => loaded.parts()).toEqual(['choice', 'discussion', 'filters', 'head', 'list', 'path', 'text']);
    // Drawn whole the moment it was in the page: each part there at once, and where it first stood once all have come.
    await expect(dialog.locator('.fd-comment-card, .fd-discussion').first()).toBeVisible();
    await page.waitForTimeout(300);
    const first = await page.evaluate(() => (window as unknown as { first: Record<string, number[]> }).first);
    for (const [part, at] of Object.entries(first)) expect(at, `${part} was not in the popup as it first opened`).toHaveLength(4);
    const now = await page.evaluate(
      (parts) =>
        Object.fromEntries(
          parts.map((part) => {
            const at = document.querySelector(part)?.getBoundingClientRect();
            return [part, at ? [at.x, at.y, at.width, at.height] : []];
          }),
        ),
      Object.keys(first),
    );
    for (const [part, at] of Object.entries(first)) {
      expect(now[part].map(Math.round), `${part} moved after it was drawn`).toEqual(at.map(Math.round));
    }
    expect(await page.evaluate(() => (window as unknown as { shifts: number[] }).shifts.reduce((sum, value) => sum + value, 0))).toBe(0);
    // The focus moved into the popup and stayed there.
    expect(await page.evaluate(() => !!document.activeElement?.closest('.fd-form-dialog'))).toBe(true);
    // The History tab: its part asked for as it is first shown, the tab drawn once it has come, the focus on the tab.
    const historyTab = dialog.getByRole('tab', { name: /History/ });
    await historyTab.click();
    await expect(dialog.locator('.fd-history')).toBeVisible();
    await expect.poll(() => loaded.parts()).toEqual(['choice', 'discussion', 'filters', 'head', 'history', 'list', 'path', 'text']);
    await expect(historyTab).toBeFocused();
    expect(await page.evaluate(() => (window as unknown as { shifts: number[] }).shifts.reduce((sum, value) => sum + value, 0))).toBe(0);
    // Closed, the focus is back on the bug's row.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(row).toBeFocused();
    // Opened again: no part asked for again.
    const before = loaded.asked.length;
    await row.click();
    await expect(dialog.getByText('BUG 4127')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(loaded.asked.slice(before).filter((chunk) => chunk.parts.length)).toEqual([]);
    expect(problems).toEqual([]);
  });
});

test.describe('the script demo, its parts as scripts beside fieldia.js', () => {
  const bug = JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'pages', 'work-item-bug.page.json'), 'utf8'));

  test('a work item’s bug asks for its head, text, path picker and own lists from beside fieldia.js, drawn whole once they came', async ({ page }) => {
    const problems = watch(page);
    const requested: string[] = [];
    page.on('request', (request) => requested.push(new URL(request.url()).pathname));
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    await page.waitForLoadState('networkidle');
    // The page of plain parts asked for none.
    expect(requested.filter((path) => /fieldia(\.\w+)?\.js$/.test(path))).toEqual(['/script/fieldia.js']);
    const drawnAtOnce = await page.evaluate((shown) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      demo.handle = fieldia.mountViewer(document.getElementById('app'), {
        page: shown,
        dataSource: fieldia.createMemoryDataSource(),
      });
      return !!document.querySelector('#app [data-node]');
    }, bug);
    // Nothing of it before its parts came: no half page to move.
    expect(drawnAtOnce).toBe(false);
    await page.evaluate(() => (window as any).fieldiaDemo.handle.drawn);
    await expect(page.locator('#app .fd-head')).toBeVisible();
    await expect(page.locator('#app .fd-path').first()).toBeVisible();
    // The text part's: the links boxes in sight, the Markdown texts drawn (empty on a new bug, they take no room at rest).
    await expect(page.locator('#app .fd-links-box').first()).toBeVisible();
    expect(await page.locator('#app .fd-md-field').count()).toBeGreaterThan(0);
    expect(requested.filter((path) => /fieldia(\.\w+)?\.js$/.test(path)).sort()).toEqual([
      '/script/fieldia.choice.js',
      '/script/fieldia.head.js',
      '/script/fieldia.js',
      '/script/fieldia.path.js',
      '/script/fieldia.text.js',
    ]);
    // Its stylesheets among Fieldia's, before the page's own looks.
    expect(await page.evaluate(() => [...document.head.querySelectorAll('style[id^="fieldia"]')].map((style) => style.id))).toEqual([
      'fieldia-styles',
      'fieldia-path-styles',
      'fieldia-choice-styles',
      'fieldia-head-styles',
      'fieldia-group-styles',
      'fieldia-editor-styles',
      'fieldia-styles-looks',
    ]);
    expect(problems).toEqual([]);
  });
});
