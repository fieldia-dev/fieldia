import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, screen, unhurried } from './support';

/**
 * Waiting, the one way (docs/plans/loading.md), as a person sees it in "Loading, as you like it": a wholesaler's
 * customers beside a customer, on a source as slow as the address says (`slow`), each moment drawn as the address or
 * the panel says. Drawn the first time, a skeleton shaped like what comes; asked again, what is shown kept, a bar over
 * it; the next rows, "Loading more…" where they come; a search, "Searching…" in its list; a save, the button busy —
 * and two other ways of each. A quick answer shows nothing at all; a failure says why where it happened, with Retry; the
 * app's own drawing and the app's own indicator. Every engine.
 */

const go = async (page: Page, query = '') => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  await page.goto(unhurried(query));
  return problems;
};
const pane = (page: Page, name: string) => page.locator(`section.ld-pane[aria-label="${name}"]`);
const records = (page: Page) => pane(page, 'Customers').locator('.fd-list-records');
const rows = (page: Page) => records(page).locator('.fd-list-row');
const customer = (page: Page) => pane(page, 'Customer').locator('.fd-content').first();
const nameBox = (page: Page) => pane(page, 'Customer').locator('[data-node="f-name"] input');
/**
 * The list's records, as a person sees them come: its first twelve customers in order — and, the list's end in sight
 * on a tall window, the next twelve after them, as rows come as it is scrolled.
 */
const listed = async (page: Page) => {
  await expect(rows(page).first()).toContainText('Delta Foods');
  await expect.poll(() => rows(page).count()).toBeGreaterThanOrEqual(12);
};
const demo = <T>(page: Page, script: string) => page.evaluate(`(() => { const d = window.fieldiaDemo; return ${script}; })()`) as Promise<T>;
/** Nothing waits anywhere on the page: the app's own indicator, which every wait's start and end drive, is off. */
const settled = (page: Page) => expect(page.locator('.ld-indicator')).not.toHaveAttribute('data-on', /.*/);
/**
 * The source's answers held until the test lets them go (`hold=1` in the address, `d.hold()`): a wait is looked at
 * while it is certain to be one, however long the page took to open or the looking takes — never raced against a slow
 * answer. Timing is raced only where it is the subject, and measured from the wait's own start.
 */
const hold = (page: Page) => demo(page, '(d.hold(), 0)');
/** Holding stopped, every answer held let go. */
const letGo = (page: Page) => demo(page, '(d.hold(false), 0)');
/**
 * The page's first answers let go — the list's first rows, the customer — never the list's next rows (asked as its end
 * comes in sight, held), until its first twelve are in.
 */
const firstTwelve = (page: Page) =>
  expect
    .poll(async () => {
      await demo(page, "d.release((ask) => !(ask.member === 'list' && ask.request.offset > 0))");
      return rows(page).count();
    }, { timeout: 15000 })
    .toBe(12);

test.describe('Loading, as you like it', () => {
  test('drawn the first time: a skeleton in the list’s own columns and the customer’s own boxes, then the records', async ({ page }) => {
    const problems = await go(page, 'slow=0&hold=1');
    // Busy at once, for a screen reader; drawn past the delay.
    await expect(records(page)).toHaveAttribute('aria-busy', 'true');
    await expect(records(page)).toHaveAttribute('data-fd-way', 'skeleton');
    await expect(records(page).locator('.fd-sk-row')).toHaveCount(8);
    // Each row a bar in each of the list's columns, under its own header.
    await expect(records(page).locator('.fd-sk-row').first().locator('td')).toHaveCount(await records(page).locator('thead th').count());
    await expect(customer(page)).toHaveAttribute('data-fd-shaped', '');
    await expect(customer(page)).toHaveAttribute('data-fd-way', 'skeleton');
    // The customer's labels are there; its boxes are shapes, nothing typed in them shown.
    await expect(pane(page, 'Customer').locator('[data-node="f-name"] .fd-label')).toHaveText(/Customer/);
    // Said once, politely.
    await expect(pane(page, 'Customers').locator('.fd-loading-said')).toHaveText('Loading…');
    await screen(page, 'loading-first-skeleton');
    expect(await axeFindings(page, 'drawn the first time, a skeleton')).toEqual([]);
    await letGo(page);
    await listed(page);
    await expect(records(page).locator('.fd-sk-row')).toHaveCount(0);
    await expect(records(page)).not.toHaveAttribute('aria-busy', /.*/);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await expect(customer(page)).not.toHaveAttribute('data-fd-wait', /.*/);
    await expect(pane(page, 'Customers').locator('.fd-loading-said')).toHaveText('');
    expect(problems).toEqual([]);
  });

  test('drawn the first time, as a spinner, a progress bar, words, or the app’s own drawing', async ({ page }) => {
    await go(page, 'slow=0&hold=1&first=spinner');
    await expect(records(page).locator('.fd-loader[data-way="spinner"] .fd-spin')).toBeVisible();
    await expect(customer(page).locator('.fd-loader[data-way="spinner"] .fd-spin')).toBeVisible();
    // The words a screen reader's alone, the ring in sight; what is not there yet out of sight.
    await expect(records(page).locator('.fd-list-scroll')).toHaveCSS('visibility', 'hidden');
    await screen(page, 'loading-first-spinner');
    expect(await axeFindings(page, 'drawn the first time, a spinner')).toEqual([]);
    await letGo(page);
    await listed(page);

    await go(page, 'slow=0&hold=1&first=progress');
    await expect(records(page).locator('.fd-loader[data-way="progress"][data-look="top"] .fd-bar')).toBeVisible();
    await letGo(page);
    await listed(page);

    await go(page, 'slow=0&hold=1&first=text');
    await expect(records(page).locator('.fd-loader[data-way="text"]')).toHaveText('Loading…');
    await expect(customer(page).locator('.fd-loader[data-way="text"]')).toHaveText('Loading…');
    await letGo(page);
    await listed(page);

    await go(page, 'slow=0&hold=1&first=custom');
    await expect(records(page).locator('.ld-custom')).toContainText('Asking the warehouse…');
    await expect(customer(page).locator('.ld-custom')).toContainText('Asking the warehouse…');
    await screen(page, 'loading-first-custom');
    await letGo(page);
    await listed(page);
    await expect(records(page).locator('.ld-custom')).toHaveCount(0);
  });

  test('a quick answer flashes no loader at all, anywhere on the page — timed from each wait’s own start', async ({ page }) => {
    // Every loader the page ever puts in, counted from its first moment.
    await page.addInitScript(() => {
      (window as unknown as { seen: string[] }).seen = [];
      new MutationObserver((changes) => {
        for (const change of changes) {
          for (const added of change.addedNodes) if (added instanceof HTMLElement && added.matches('.fd-loader, .fd-sk-row, .fd-sk-page')) (window as unknown as { seen: string[] }).seen.push(added.className);
          if (change.type === 'attributes' && (change.target as HTMLElement).hasAttribute('data-fd-wait')) (window as unknown as { seen: string[] }).seen.push(`wait ${(change.target as HTMLElement).getAttribute('data-fd-wait')}`);
        }
      }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-fd-wait'] });
    });
    await go(page, 'slow=0&delay=600');
    await listed(page);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await settled(page);
    // From here every part is in. Each answer comes a twentieth of a second after its wait starts and a loader would
    // come three fifths of one after: both on the page's own clock, from the wait's start, so the answer is first however
    // slow the machine — never raced against the page opening or this test's looking.
    await page.evaluate(() => {
      const w = window as unknown as { seen: string[]; fieldiaDemo: { net: { slow: number } } };
      w.seen = [];
      w.fieldiaDemo.net.slow = 50;
    });
    const from = await demo<number>(page, 'd.heard.length');
    await pane(page, 'Customers').getByRole('combobox').first().fill('Delta');
    await pane(page, 'Customers').getByRole('combobox').first().press('Enter');
    await expect(rows(page)).toHaveCount(5);
    await demo(page, 'd.record.reload()');
    await settled(page);
    // Past the delay of the last of them: still nothing drawn.
    await page.waitForTimeout(700);
    const ended = await demo<string[]>(page, `d.heard.slice(${from}).filter((one) => !one.start).map((one) => one.event.moment + ' ' + one.event.part)`);
    expect(ended).toEqual(expect.arrayContaining(['refresh customers', 'refresh loading-customer']));
    expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen)).toEqual([]);
  });

  test('asked again, what is shown stays where it is, a thin bar over it, until the new records come', async ({ page }) => {
    await go(page, 'slow=0');
    await listed(page);
    const first = rows(page).first();
    const before = await first.boundingBox();
    const search = pane(page, 'Customers').getByRole('combobox').first();
    const shown = await rows(page).count();
    await hold(page);
    await search.fill('Delta');
    await search.press('Enter');
    const bar = records(page).locator('.fd-loader[data-way="keep"] .fd-bar');
    await expect(bar).toBeVisible();
    // Nothing moved: the same first row, in the same place, the same rows, while the bar runs.
    await expect(first).toContainText('Delta Foods');
    expect(await first.boundingBox()).toEqual(before);
    await expect(rows(page)).toHaveCount(shown);
    await screen(page, 'loading-refresh-keep');
    expect(await axeFindings(page, 'asked again, kept')).toEqual([]);
    await letGo(page);
    await expect(rows(page)).toHaveCount(5);
    await expect(bar).toHaveCount(0);
  });

  test('asked again, dimmed, as a skeleton or with a spinner, as the panel says', async ({ page }) => {
    await go(page, 'slow=0');
    await listed(page);
    const ask = async () => {
      const search = pane(page, 'Customers').getByRole('combobox').first();
      await search.fill('Lotus');
      await search.press('Enter');
    };
    // Each way set from the panel, as a person sets it: the forms mounted again, waiting that way.
    for (const [way, seen] of [
      ['dim', records(page).locator('.fd-list-scroll')],
      ['skeleton', records(page).locator('.fd-sk-row').first()],
      ['spinner', records(page).locator('.fd-loader[data-way="spinner"] .fd-spin')],
    ] as const) {
      await page.locator('select[data-setting="refresh"]').selectOption(way);
      await listed(page);
      await hold(page);
      await ask();
      await expect(records(page)).toHaveAttribute('data-fd-way', way);
      await expect(seen).toBeVisible();
      if (way === 'dim') await expect(seen).toHaveCSS('opacity', '0.55');
      await letGo(page);
      await expect(rows(page)).toHaveCount(5);
    }
  });

  test('asked again with a popup open, the popup stays over everything and works; one opened while it waits works too', async ({ page }) => {
    const problems = await go(page, 'slow=0&refresh=skeleton');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    const since = pane(page, 'Customer').locator('[data-node="f-since"]');
    const calendar = since.getByRole('dialog');
    /** The popup is the thing drawn at its own middle: nothing of a wait over it. */
    const onTop = (popup: typeof calendar) =>
      popup.evaluate((element) => {
        const { left, top, width, height } = element.getBoundingClientRect();
        return element.contains(element.ownerDocument.elementFromPoint(left + width / 2, top + height / 2));
      });
    // A date's calendar open, then the customer asked again as a skeleton: what is shown kept, a bar over it — never the
    // shapes over the calendar or its box.
    await since.locator('.fd-calendar-button').click();
    await expect(calendar).toBeVisible();
    await hold(page);
    await demo(page, '(d.record.reload(), 0)');
    await expect(customer(page)).toHaveAttribute('data-fd-wait', 'refresh');
    await expect(customer(page)).toHaveAttribute('data-fd-way', 'keep');
    await expect(customer(page)).not.toHaveAttribute('data-fd-shaped', /.*/);
    await expect(calendar).toBeVisible();
    expect(await onTop(calendar)).toBe(true);
    await screen(page, 'loading-refresh-popup-kept');
    // It works while the customer is on its way: a day pressed is the box's.
    await calendar.locator('tbody button:not(.fd-outside)').filter({ hasText: /^10$/ }).click();
    await expect(calendar).toBeHidden();
    await expect(since.locator('input')).toHaveValue(/^10 /);
    await letGo(page);
    await expect(customer(page)).not.toHaveAttribute('data-fd-wait', /.*/);
    await settled(page);

    // Asked again with a ring over what is shown: a calendar opened while it waits is over the ring, and works.
    await page.locator('select[data-setting="refresh"]').selectOption('spinner');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await hold(page);
    await demo(page, '(d.record.reload(), 0)');
    await expect(customer(page).locator('.fd-loader[data-way="spinner"] .fd-spin')).toBeVisible();
    await since.locator('.fd-calendar-button').click();
    await expect(calendar).toBeVisible();
    expect(await onTop(calendar)).toBe(true);
    await calendar.locator('tbody button:not(.fd-outside)').filter({ hasText: /^12$/ }).click();
    await expect(since.locator('input')).toHaveValue(/^12 /);
    await letGo(page);
    await settled(page);

    // The list asked again, its records under a ring and dimmed: its search's panel opened meanwhile, over the rows,
    // is the thing drawn there, and a filter pressed in it is taken.
    await listed(page);
    await hold(page);
    await demo(page, '(d.list.reload(), 0)');
    await expect(records(page)).toHaveAttribute('data-fd-way', 'spinner');
    await pane(page, 'Customers').locator('.fd-search-toggle').click();
    const panel = pane(page, 'Customers').locator('.fd-search-panel');
    await expect(panel).toBeVisible();
    expect(await onTop(panel)).toBe(true);
    await panel.locator('.fd-search-option[data-filter="active"]').click();
    await expect(panel.locator('.fd-search-option[data-filter="active"]')).toHaveAttribute('aria-pressed', 'true');
    await letGo(page);
    await expect(rows(page).first()).toBeVisible();
    await settled(page);
    expect(await axeFindings(page, 'a popup open as it is asked again')).toEqual([]);
    expect(problems).toEqual([]);
  });

  test('the next rows: “Loading more…” where they will come, then twelve more', async ({ page }) => {
    // Every answer held: the first let go, the next rows held as they are asked — as the end comes in sight.
    await go(page, 'slow=0&hold=1');
    await firstTwelve(page);
    await expect(rows(page).first()).toContainText('Delta Foods');
    const end = records(page).locator('.fd-list-more-rows');
    await end.scrollIntoViewIfNeeded();
    await expect(end.locator('.fd-loader[data-way="row"]')).toHaveText('Loading more…');
    await expect(end).toHaveAttribute('aria-busy', 'true');
    await expect(end.locator('.fd-button')).toBeHidden();
    // The rows shown never move: what comes is put after them.
    await expect(rows(page)).toHaveCount(12);
    await screen(page, 'loading-more-row');
    expect(await axeFindings(page, 'the next rows, Loading more…')).toEqual([]);
    await letGo(page);
    await expect.poll(() => rows(page).count()).toBeGreaterThanOrEqual(24);
    await expect(rows(page).nth(12)).toContainText('Isis Pharma');
  });

  test('the next rows as a skeleton, or a spinner', async ({ page }) => {
    for (const way of ['skeleton', 'spinner'] as const) {
      await go(page, `slow=0&hold=1&more=${way}`);
      await firstTwelve(page);
      await expect(rows(page).first()).toContainText('Delta Foods');
      const end = records(page).locator('.fd-list-more-rows');
      await end.scrollIntoViewIfNeeded();
      await expect(end.locator(`.fd-loader[data-way="${way}"] ${way === 'spinner' ? '.fd-spin' : '.fd-sk'}`).first()).toBeVisible();
      await letGo(page);
      await expect.poll(() => rows(page).count()).toBeGreaterThanOrEqual(24);
    }
  });

  test('a search: “Searching…” in the list under the box, then the people found; or a ring at the box’s end', async ({ page }) => {
    await go(page, 'slow=0');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    const manager = pane(page, 'Customer').locator('[data-node="f-manager"] input[role="combobox"]');
    await hold(page);
    await manager.fill('Mo');
    const list = pane(page, 'Customer').locator('[data-node="f-manager"] [role="listbox"]');
    await expect(list.locator('.fd-loader[data-way="inline"]')).toHaveText('Searching…');
    await expect(list).toHaveAttribute('aria-busy', 'true');
    await screen(page, 'loading-search-inline');
    expect(await axeFindings(page, 'a search, Searching…')).toEqual([]);
    await letGo(page);
    await expect(list.getByRole('option', { name: 'Mona Adel' })).toBeVisible();
    await expect(list.locator('.fd-loader')).toHaveCount(0);

    await go(page, 'slow=0&search=spinner');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await hold(page);
    await manager.fill('Om');
    await expect(pane(page, 'Customer').locator('[data-node="f-manager"] .fd-combo > .fd-loader[data-way="spinner"] .fd-spin')).toBeVisible();
    await letGo(page);
    await expect(list.getByRole('option', { name: 'Omar Said' })).toBeVisible();

    // The app's own drawing, in the list where the suggestions come.
    await go(page, 'slow=0&search=custom');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await hold(page);
    await manager.fill('Sa');
    await expect(list.locator('.ld-custom')).toContainText('Asking the warehouse…');
    await letGo(page);
    await expect(list.getByRole('option', { name: 'Sara Fathy' })).toBeVisible();
    await expect(list.locator('.ld-custom')).toHaveCount(0);
  });

  test('a button’s steps: the button busy, its ring past the delay; or a bar along the top, or the form covered', async ({ page }) => {
    await go(page, 'slow=0');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    // Its steps set the status and save, the source's answer held.
    const mark = pane(page, 'Customer').getByRole('button', { name: 'Mark as active' });
    await hold(page);
    await mark.click();
    await expect(mark).toHaveAttribute('aria-busy', 'true');
    await expect(mark).toHaveAttribute('data-fd-wait', 'action');
    expect(await mark.evaluate((one) => getComputedStyle(one, '::after').display)).not.toBe('none');
    await screen(page, 'loading-action-button');
    await letGo(page);
    // A record's Save steps aside while it saves, as ever: its status says so.
    await expect(pane(page, 'Customer').locator('.fd-status')).toHaveText('Saved');
    await expect(mark).not.toHaveAttribute('aria-busy', /.*/);
    await expect(mark).not.toHaveAttribute('data-fd-wait', /.*/);

    for (const way of ['bar', 'overlay'] as const) {
      await go(page, `slow=0&action=${way}`);
      await expect(nameBox(page)).toHaveValue('Nile Traders');
      const button = pane(page, 'Customer').getByRole('button', { name: 'Mark as active' });
      await hold(page);
      await button.click();
      // Busy, never pressed twice — its own ring away: the form says it.
      await expect(button).toHaveAttribute('aria-busy', 'true');
      expect(await button.evaluate((one) => getComputedStyle(one, '::after').display)).toBe('none');
      await expect(customer(page).locator(`.fd-loader[data-way="${way}"]`)).toBeVisible();
      if (way === 'overlay') {
        await expect(customer(page)).toHaveAttribute('inert', '');
        await screen(page, 'loading-action-overlay');
        expect(await axeFindings(page, 'a button’s steps, the form covered')).toEqual([]);
      }
      await letGo(page);
      await expect(pane(page, 'Customer').locator('.fd-status')).toHaveText('Saved');
      await expect(customer(page)).not.toHaveAttribute('inert', /.*/);
    }
  });

  test('a failure says why where it happened, with Retry that asks again; never an empty place', async ({ page }) => {
    const problems = await go(page, 'slow=600');
    await listed(page);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await settled(page);
    // The list asked again, its answer failing this once.
    await demo(page, '(d.net.failNext = true, d.list.reload(), 0)');
    const failed = records(page).locator('.fd-list-failed');
    await expect(failed).toHaveText('Could not load the customers. The server did not answer this once. Retry');
    await expect(failed).toHaveAttribute('role', 'alert');
    await expect(rows(page)).toHaveCount(0);
    await screen(page, 'loading-failed-list');
    expect(await axeFindings(page, 'the list failed')).toEqual([]);
    await failed.getByRole('button', { name: 'Retry' }).click();
    await listed(page);
    await settled(page);
    // The customer asked again, failing: said at the top of its place, with Retry — in the record's own words for it
    // (core's `loadProblem`, naming it), the one place a record's load failure is said.
    await demo(page, '(d.net.failNext = true, d.record.reload(), 0)');
    const box = customer(page).locator('.fd-loader[data-way="failed"]');
    await expect(box).toHaveText('This customer could not be loaded: The server did not answer this once. Retry');
    await expect(customer(page).getByRole('alert').filter({ hasText: 'could not be loaded' })).toHaveCount(1);
    await box.getByRole('button', { name: 'Retry' }).click();
    await expect(box).toHaveCount(0);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    // The app heard each failed wait as failed.
    const failedHeard = await demo<{ moment: string; part: string }[]>(page, 'd.heard.filter((one) => !one.start && one.event.failed).map((one) => ({ moment: one.event.moment, part: one.event.part }))');
    expect(failedHeard).toEqual([
      { moment: 'refresh', part: 'customers' },
      { moment: 'refresh', part: 'loading-customer' },
    ]);
    expect(problems).toEqual([]);
  });

  test('a failure in a toast, what is shown kept; or drawn by the app', async ({ page }) => {
    await go(page, 'slow=600&error=toast');
    await listed(page);
    await settled(page);
    const shown = await rows(page).count();
    await demo(page, '(d.net.failNext = true, d.list.reload(), 0)');
    const toast = pane(page, 'Customers').locator('.fd-say');
    // Away from its place, it names what failed: one of the page's four forms (the owner's walk of 0.33.0).
    await expect(toast).toContainText('Could not load the customers. The server did not answer this once.');
    // Nothing taken away: the rows shown stay.
    await expect(rows(page)).toHaveCount(shown);
    await toast.getByRole('button', { name: 'Retry' }).click();
    await expect(toast).toHaveCount(0);
    await listed(page);

    await go(page, 'slow=600&error=custom');
    await listed(page);
    await settled(page);
    await demo(page, '(d.net.failNext = true, d.list.reload(), 0)');
    await expect(records(page).locator('.ld-custom[data-failed]')).toContainText('The warehouse did not answer.');
    await records(page).getByRole('button', { name: 'Ask the warehouse again' }).click();
    await listed(page);
    await expect(records(page).locator('.ld-custom')).toHaveCount(0);
  });

  test('a timeout ends a slow wait as failed, the request told to stop; a record that answers after is drawn', async ({ page }) => {
    // Every answer held: each wait ends by its timeout, never by an answer racing it.
    await go(page, 'slow=0&hold=1&timeout=600');
    await expect(records(page).locator('.fd-list-failed')).toHaveText('Could not load the customers. It took too long. Retry');
    await expect(customer(page).locator('.fd-loader[data-way="failed"]')).toHaveText('Couldn’t load. It took too long. Retry');
    // Ended no sooner than its timeout, from the wait's own start — to the page clock's tick: a browser rounds `Date.now()`
    // (Firefox's reduced precision measured 599 for a 600 ms timer).
    const failed = await demo<number[]>(page, "d.heard.filter((one) => !one.start && one.event.failed && one.event.part === 'customers').map((one) => one.event.duration)");
    expect(failed.length).toBeGreaterThan(0);
    for (const duration of failed) expect(duration).toBeGreaterThanOrEqual(595);
    // The customer's answer comes after all: drawn, what was said of it taken away.
    await letGo(page);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await expect(customer(page).locator('.fd-loader[data-way="failed"]')).toHaveCount(0);
    // The list's request was aborted as it timed out: its answer, let go, is never drawn.
    await expect(rows(page)).toHaveCount(0);
    await hold(page);
    await records(page).getByRole('button', { name: 'Retry' }).click();
    await expect(records(page).locator('.fd-list-failed')).toHaveText('Could not load the customers. It took too long. Retry');
    await letGo(page);
  });

  test('tells the app each wait’s start and end, for its own indicator', async ({ page }) => {
    await go(page, 'slow=0&hold=1');
    // The app's own bar along the page's top, on while anything waits.
    await expect(page.locator('.ld-indicator')).toHaveAttribute('data-on', '');
    const letGoAt = await demo<number>(page, '(d.hold(false), Date.now())');
    await listed(page);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await expect(page.locator('.ld-indicator')).not.toHaveAttribute('data-on', /.*/);
    const heard = await demo<{ start: boolean; at: number; event: { moment: string; part: string; duration: number; failed: boolean } }[]>(page, 'd.heard');
    const parts = (start: boolean) => heard.filter((one) => one.start === start).map((one) => `${one.event.moment} ${one.event.part}`).sort();
    expect(parts(true)).toEqual(parts(false));
    expect(parts(true)).toEqual(expect.arrayContaining(['first customers', 'first loading-customer']));
    const list = heard.find((one) => !one.start && one.event.part === 'customers');
    expect(list?.event.failed).toBe(false);
    // As long, from the wait's own start, as its answer was held at least (to the page clock's tick).
    const started = heard.find((one) => one.start && one.event.part === 'customers') as { at: number } | undefined;
    expect(list?.event.duration).toBeGreaterThanOrEqual(letGoAt - (started?.at ?? letGoAt) - 5);
    expect(list?.event.duration).toBeGreaterThan(0);
  });

  test('every way stands still for a reader who asks for no motion, and none shows on paper', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await go(page, 'slow=0&hold=1');
    const bar = records(page).locator('.fd-sk').first();
    await expect(bar).toBeVisible();
    expect(await bar.evaluate((one) => getComputedStyle(one).animationName)).toBe('none');
    await go(page, 'slow=0&hold=1&first=spinner');
    const ring = records(page).locator('.fd-spin');
    await expect(ring).toBeVisible();
    expect(await ring.evaluate((one) => getComputedStyle(one).animationName)).toBe('none');
    // On paper: no loader, what is there as it is.
    await page.emulateMedia({ media: 'print' });
    await expect(records(page).locator('.fd-loader')).toBeHidden();
    await expect(records(page).locator('.fd-list-scroll')).toHaveCSS('visibility', 'visible');
    await page.emulateMedia({ media: 'screen' });
  });

  test('in the dark, right to left, on a phone and under two themes', async ({ page, browserName }) => {
    await go(page, 'slow=0&hold=1&scheme=dark');
    await expect(records(page).locator('.fd-sk-row').first()).toBeVisible();
    // The shapes in the dark scheme's own tint, apart from the dark card.
    const tint = await records(page).locator('.fd-sk').first().evaluate((one) => getComputedStyle(one).backgroundColor);
    expect(tint).not.toBe('rgba(0, 0, 0, 0)');
    await screen(page, 'loading-first-dark');
    expect(await axeFindings(page, 'drawn the first time, dark')).toEqual([]);
    await letGo(page);
    await listed(page);

    await go(page, 'slow=0&hold=1&dir=rtl');
    await expect(records(page).locator('.fd-sk-row').first()).toBeVisible();
    await expect(pane(page, 'Customers').locator('.fd-form')).toHaveAttribute('dir', 'rtl');
    await screen(page, 'loading-first-rtl');
    await letGo(page);
    await listed(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, 'slow=0&hold=1');
    // A phone's list is cards: their skeleton is cards too.
    await expect(records(page).locator('.fd-sk-row').first()).toBeVisible();
    await expect(pane(page, 'Customers').locator('.fd-list')).toHaveAttribute('data-as', 'cards');
    await expectNoSidewaysScroll(page);
    await screen(page, 'loading-first-phone');
    await letGo(page);
    await expect(records(page).locator('.fd-list-row').first()).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await go(page, 'slow=0&hold=1');
    const twins = page.locator('.ld-twins');
    await expect(twins.locator('.fd-form[data-fd-theme="material"] [data-fd-shaped]')).toBeVisible();
    await expect(twins.locator('.fd-form[data-fd-theme="fluent"] [data-fd-shaped]')).toBeVisible();
    // Each theme's own tint: Material's lilac grey, Fluent's grey.
    const box = (theme: string) => twins.locator(`.fd-form[data-fd-theme="${theme}"] [data-node="f-name"] > :nth-child(2)`);
    expect(await box('material').evaluate((one) => getComputedStyle(one).backgroundColor)).toBe('rgb(231, 224, 236)');
    expect(await box('fluent').evaluate((one) => getComputedStyle(one).backgroundColor)).toBe('rgb(230, 230, 230)');
    await twins.scrollIntoViewIfNeeded();
    await screen(page, 'loading-two-themes');
    if (browserName === 'chromium') {
      await page.emulateMedia({ forcedColors: 'active' });
      expect(await box('fluent').evaluate((one) => getComputedStyle(one).forcedColorAdjust)).toBe('none');
      await page.emulateMedia({ forcedColors: 'none' });
    }
  });

  test('the panel’s choices show their whole words, on a wide screen and a phone', async ({ page }) => {
    for (const [size, name] of [[{ width: 1440, height: 900 }, 'desktop'], [{ width: 390, height: 844 }, 'phone']] as const) {
      await page.setViewportSize(size);
      await go(page, 'slow=0');
      await listed(page);
      // Each choice's every option measured in its box's own font: none wider than the room the box gives its words.
      const cut = await page.evaluate(() => {
        const ruler = document.createElement('span');
        Object.assign(ruler.style, { position: 'absolute', visibility: 'hidden', whiteSpace: 'nowrap' });
        document.body.append(ruler);
        const found: string[] = [];
        for (const select of document.querySelectorAll<HTMLSelectElement>('.ld-picks select')) {
          const style = getComputedStyle(select);
          ruler.style.font = style.font;
          // Its words' room: inside its padding, past its arrow.
          const room = select.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 16;
          for (const option of select.options) {
            ruler.textContent = option.text;
            if (ruler.offsetWidth > room) found.push(`${option.text}: ${ruler.offsetWidth} px in ${Math.round(room)}`);
          }
        }
        ruler.remove();
        return found;
      });
      expect(cut, name).toEqual([]);
      await expectNoSidewaysScroll(page);
      await screen(page, `loading-panel-${name}`, { viewport: true });
    }
  });

  test('what the app heard, said as a person sees it: the waits going on while a skeleton shows, then that every one ended', async ({ page }) => {
    await go(page, 'slow=0&hold=1');
    const heard = page.locator('.ld-heard');
    // The pages drawn, their records held: the list's skeleton shows, and so the line says its wait goes on — never
    // that something "ended" as if the page were done (the list's page was drawn; its rows are still to come).
    await expect(records(page).locator('.fd-sk').first()).toBeVisible();
    await expect(heard).toContainText('waits going on');
    await expect(heard).toContainText('first of customers');
    await expect(heard).toContainText('first of loading-customer (3)');
    await expect(heard).not.toContainText('ended');
    await screen(page, 'loading-heard-waiting', { viewport: true });
    await letGo(page);
    await listed(page);
    await settled(page);
    await expect(heard).toContainText('every wait ended — the last,');
  });
});

