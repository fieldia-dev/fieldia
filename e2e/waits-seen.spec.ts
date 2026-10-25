import type { Page, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { axeFindings } from './a11y-support';
import { expectNoSidewaysScroll, screen } from './support';

/**
 * Waits seen where a person looks, as the owner's walk of 0.33.0 met them (walk-0.33, findings 4–9, 11, 15, 19 and the
 * warning seen once), in "Loading, as you like it" and the plain demo — every answer held until the test lets it go,
 * never raced against a slow one:
 * - a customer opened while the page is scrolled down: its row busy where it was pressed, the last customer's invoices
 *   gone at once, a skeleton in their place;
 * - drawn the first time: never empty boxes before the skeleton, never "Loading…" words before it;
 * - a timeline whose code comes: a skeleton in its place, never an empty space under its search;
 * - Save busy where it was pressed, and kept on Discard's line when the save fails;
 * - a failure said in a toast names what failed; one said in its place reads as a failure, light and dark;
 * - a spinner over a tall pane in the middle of what is in view; a select shaped as the other boxes;
 * - a search's failure as wide as its box; what was said under a box is its record's, gone with it.
 */

const go = async (page: Page, query = '') => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console: ${message.text()}`);
  });
  await page.goto(`/loading/?${query}`);
  return problems;
};
const pane = (page: Page, name: string) => page.locator(`section.ld-pane[aria-label="${name}"]`);
const records = (page: Page) => pane(page, 'Customers').locator('.fd-list-records');
const rows = (page: Page) => records(page).locator('.fd-list-row');
const customer = (page: Page) => pane(page, 'Customer').locator('.fd-content').first();
const box = (page: Page, node: string) => pane(page, 'Customer').locator(`[data-node="${node}"] > :nth-child(2)`);
const nameBox = (page: Page) => pane(page, 'Customer').locator('[data-node="f-name"] input');
const demo = <T>(page: Page, script: string) => page.evaluate(`(() => { const d = window.fieldiaDemo; return ${script}; })()`) as Promise<T>;
const hold = (page: Page) => demo(page, '(d.hold(), 0)');
const letGo = (page: Page) => demo(page, '(d.hold(false), 0)');
/** The page's first answers let go — never the list's next rows — until its first twelve are in and Nile Traders shown. */
const opened = async (page: Page) => {
  await expect
    .poll(async () => {
      await demo(page, "d.release((ask) => !(ask.member === 'list' && ask.request.offset > 0))");
      return (await rows(page).count()) >= 12 && (await nameBox(page).inputValue()) === 'Nile Traders';
    }, { timeout: 15000 })
    .toBe(true);
};
/** A pseudo-element's look as the browser draws it now. */
const drawn = (locator: ReturnType<Page['locator']>, pseudo: string) =>
  locator.evaluate((element, pseudo) => {
    const style = getComputedStyle(element, pseudo);
    return { content: style.content, display: style.display, visibility: style.visibility, width: style.width };
  }, pseudo);

/**
 * A script of the demo's own build held until the test lets it go — a part, a view's code — as a slow network holds it:
 * the request seen (a hold that held nothing proves nothing), answered once `go()` is called.
 */
async function holdScript(page: Page, file: RegExp) {
  let go!: () => void;
  const gate = new Promise<void>((resolve) => (go = resolve));
  let seen = 0;
  await page.route(file, async (route: Route) => {
    seen++;
    await gate;
    await route.continue();
  });
  return { go: () => go(), seen: () => seen };
}
/** A script of the demo's own build answered `ms` after it is asked, as a slow network answers it: the request seen. */
async function lateScript(page: Page, file: RegExp, ms: number) {
  let seen = 0;
  await page.route(file, async (route: Route) => {
    seen++;
    await new Promise((resolve) => setTimeout(resolve, ms));
    await route.continue();
  });
  return { seen: () => seen };
}

test.describe('a wait seen where a person looks', () => {
  test('a customer opened while scrolled down: what of it is in view waits, no other customer’s invoices under its skeleton', async ({ page }) => {
    const problems = await go(page, 'slow=0&hold=1');
    await opened(page);
    // Its invoices in, under Nile Traders.
    await demo(page, '(d.hold(false), 0)');
    const invoices = pane(page, 'Customer').locator('.fd-related-list');
    await expect(invoices).toContainText('INV-02401');
    await hold(page);
    // Scrolled down as a person does, the record's top (its bar) above the window, its foot and Horus Foods in view.
    await page.evaluate(() => window.scrollTo(0, 520));
    expect((await customer(page).boundingBox())!.y).toBeLessThan(0);
    await expect(invoices).toBeInViewport();
    await rows(page).filter({ hasText: 'Horus Foods' }).first().click();
    // Nothing of Nile Traders under Horus Foods: its invoices gone at once, a skeleton in their place; its boxes shapes,
    // those in view among them.
    await expect(invoices).not.toContainText('INV-02401');
    await expect(invoices.locator('.fd-loader[data-way="skeleton"] .fd-sk').first()).toBeVisible();
    await expect(invoices.locator('.fd-loader[data-way="skeleton"]')).toBeInViewport();
    await expect(pane(page, 'Customer').locator('.fd-related-count')).toBeHidden();
    await expect(customer(page)).toHaveAttribute('data-fd-shaped', '');
    await expect(box(page, 'f-since')).toBeInViewport();
    await screen(page, 'waits-seen-opened-scrolled', { viewport: true });
    expect(await axeFindings(page, 'a customer opened while scrolled down')).toEqual([]);
    await letGo(page);
    await expect(nameBox(page)).toHaveValue('Horus Foods');
    await expect(invoices.locator('.fd-list-row')).toHaveCount(2);
    await expect(invoices.locator('.fd-loader')).toHaveCount(0);
    await expect(pane(page, 'Customer').locator('.fd-related-count')).toHaveText('2');
    expect(problems).toEqual([]);
  });

  test('a customer that could not be opened shows no invoices at all, its own nor another’s', async ({ page }) => {
    await go(page, 'slow=0&hold=1');
    await opened(page);
    await demo(page, '(d.hold(false), 0)');
    const invoices = pane(page, 'Customer').locator('.fd-related-list');
    await expect(invoices).toContainText('INV-02401');
    await hold(page);
    await rows(page).filter({ hasText: 'Horus Foods' }).first().click();
    await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'load'), 0)");
    await expect(customer(page).locator('.fd-loader[data-way="failed"]')).toContainText('Couldn’t open customer 32');
    await letGo(page);
    await expect(invoices.locator('.fd-loader')).toHaveCount(0);
    await expect(invoices.locator('.fd-list-row')).toHaveCount(0);
    await expect(pane(page, 'Customer').locator('.fd-related-count')).toBeHidden();
  });

  test('drawn the first time: the labels at once, never empty boxes before the skeleton', async ({ page }) => {
    // A long delay, every answer held: what shows before the skeleton is certain to be looked at.
    await go(page, 'slow=0&hold=1&delay=4000');
    await expect(customer(page)).toHaveAttribute('aria-busy', 'true');
    await expect(pane(page, 'Customer').locator('[data-node="f-name"] .fd-label')).toBeVisible();
    for (const node of ['f-name', 'f-phone', 'f-city', 'f-status']) await expect(box(page, node)).toHaveCSS('visibility', 'hidden');
    await screen(page, 'waits-seen-first-before-skeleton', { viewport: true });
    await letGo(page);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    for (const node of ['f-name', 'f-phone', 'f-city', 'f-status']) await expect(box(page, node)).toHaveCSS('visibility', 'visible');
  });

  test('drawn the first time as a spinner: the ring in the middle of what of the pane is in view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await go(page, 'slow=0&hold=1&first=spinner');
    const ring = customer(page).locator('.fd-loader[data-way="spinner"] .fd-spin');
    await expect(ring).toBeVisible();
    const [at, place] = [(await ring.boundingBox())!, (await customer(page).boundingBox())!];
    const inView = { from: Math.max(place.y, 0), to: Math.min(place.y + place.height, 900) };
    expect(place.y + place.height).toBeGreaterThan(900);
    expect(Math.abs(at.y + at.height / 2 - (inView.from + inView.to) / 2)).toBeLessThan(24);
    await screen(page, 'waits-seen-first-spinner', { viewport: true });
    await letGo(page);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
  });

  test('drawn the first time on a phone: a select is a shape like the other boxes, nothing of it showing through', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await go(page, 'slow=0&hold=1');
    await expect(customer(page)).toHaveAttribute('data-fd-shaped', '');
    const city = box(page, 'f-city');
    await expect(city).toHaveCSS('appearance', 'none');
    const [cityTint, nameTint] = await Promise.all([city.evaluate((one) => getComputedStyle(one).backgroundColor), box(page, 'f-name').evaluate((one) => getComputedStyle(one).backgroundColor)]);
    expect(cityTint).toBe(nameTint);
    await customer(page).scrollIntoViewIfNeeded();
    await screen(page, 'waits-seen-phone-select-shaped', { viewport: true });
    await expectNoSidewaysScroll(page);
    await letGo(page);
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await expect(city).not.toHaveCSS('appearance', 'none');
  });

  test('Save busy where it was pressed while it saves; failed, Save stays there, Discard beside it, what failed under them', async ({ page }) => {
    for (const size of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(size);
      const problems = await go(page, 'slow=0');
      await expect(nameBox(page)).toHaveValue('Nile Traders');
      await nameBox(page).fill('Nile Traders Co');
      const save = pane(page, 'Customer').getByRole('button', { name: 'Save', exact: true });
      const discard = pane(page, 'Customer').getByRole('button', { name: 'Discard' });
      await expect(save).toBeVisible();
      await hold(page);
      await save.click();
      /** Where a box is on the page, whatever the window's scroll. */
      const onPage = async (locator: typeof save) => {
        const [at, scrolled] = [(await locator.boundingBox())!, await page.evaluate(() => [scrollX, scrollY])];
        return { ...at, x: at.x + scrolled[0], y: at.y + scrolled[1] };
      };
      const pressedAt = await onPage(save);
      // Busy in its place, its ring past the delay — never gone into "Saving…".
      await expect(save).toBeVisible();
      await expect(save).toHaveAttribute('aria-busy', 'true');
      await expect.poll(async () => (await drawn(save, '::after')).visibility).toBe('visible');
      expect((await drawn(save, '::after')).display).not.toBe('none');
      await expect(discard).toBeHidden();
      await expect(pane(page, 'Customer').locator('.fd-status')).toHaveText('Saving…');
      if (size.width === 1440) await screen(page, 'waits-seen-save-busy', { viewport: true });
      // Its answer fails: Save and Discard back, side by side; what failed said beside them.
      await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'save'), d.hold(false), 0)");
      await expect(pane(page, 'Customer').locator('.fd-status')).toHaveText('The server did not answer this once.');
      await expect(discard).toBeVisible();
      await expect(save).not.toHaveAttribute('aria-busy', /.*/);
      // Its ring gone once seen its minimum; Save where it was pressed, Discard beside it, what failed under them.
      await expect(save).not.toHaveAttribute('data-fd-wait', /.*/);
      const [s, d, said] = [await onPage(save), await onPage(discard), await onPage(pane(page, 'Customer').locator('.fd-status-box'))];
      expect(Math.abs(s.y - d.y)).toBeLessThan(2);
      expect(Math.abs(s.y - pressedAt.y)).toBeLessThan(2);
      // Its end where it was: its ring beside its words, while busy, made it the wider.
      expect(Math.abs(s.x + s.width - (pressedAt.x + pressedAt.width))).toBeLessThan(2);
      expect(said.y).toBeGreaterThanOrEqual(s.y + s.height - 1);
      await expectNoSidewaysScroll(page);
      await save.scrollIntoViewIfNeeded();
      await screen(page, `waits-seen-save-failed-${size.width}`, { viewport: true });
      expect(problems).toEqual([]);
    }
  });

  test('a failure said in its place reads as one — the error’s colour and its mark — light, dark, in two themes and forced colours', async ({ page, browserName }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await go(page, `slow=0&scheme=${scheme}`);
      await expect(nameBox(page)).toHaveValue('Nile Traders');
      for (const [i, form] of [[-1, customer(page)], [0, page.locator('.ld-twins .fd-form[data-fd-theme="material"] .fd-content').first()], [1, page.locator('.ld-twins .fd-form[data-fd-theme="fluent"] .fd-content').first()]] as const) {
        await hold(page);
        await demo(page, `(${i < 0 ? 'd.record' : `d.twins[${i}]`}.reload(), 0)`);
        await expect.poll(() => demo<number>(page, 'd.held')).toBeGreaterThan(0);
        await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'load'), d.hold(false), 0)");
        const failed = form.locator('.fd-loader[data-way="failed"]');
        await expect(failed).toContainText('could not be loaded');
        // Said once, in its place: never a toast besides, with no Retry.
        await expect(page.locator('.fd-say').filter({ hasText: 'could not be loaded' })).toHaveCount(0);
        const look = await failed.evaluate((element) => {
          const probe = Object.assign(document.createElement('span'), { textContent: 'x' });
          probe.style.color = 'var(--fd-error)';
          element.parentElement!.append(probe);
          const error = getComputedStyle(probe).color;
          probe.remove();
          const style = getComputedStyle(element);
          return { colour: style.color, error, mark: style.borderInlineStartWidth, markColour: style.borderInlineStartColor, text: getComputedStyle(element.closest('.fd-form')!).color };
        });
        expect(look.colour).toBe(look.error);
        expect(look.colour).not.toBe(look.text);
        expect(look.mark).toBe('3px');
        expect(look.markColour).toBe(look.error);
        await failed.scrollIntoViewIfNeeded();
        if (i < 0) await screen(page, `waits-seen-failed-${scheme}`, { viewport: true });
        await failed.getByRole('button', { name: 'Retry' }).click();
        await expect(failed).toHaveCount(0);
      }
      expect(await axeFindings(page, `a failure in its place, ${scheme}`)).toEqual([]);
    }
    if (browserName !== 'chromium') return;
    // Forced colours: no colour of its own, its mark kept, a line in the system's own.
    await page.emulateMedia({ forcedColors: 'active' });
    await go(page, 'slow=0');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await demo(page, '(d.net.failNext = true, d.record.reload(), 0)');
    const failed = customer(page).locator('.fd-loader[data-way="failed"]');
    await expect(failed).toBeVisible();
    expect(await failed.evaluate((element) => [getComputedStyle(element).borderInlineStartStyle, getComputedStyle(element).borderInlineStartWidth])).toEqual(['solid', '3px']);
    await screen(page, 'waits-seen-failed-forced', { viewport: true });
    await page.emulateMedia({ forcedColors: 'none' });
  });

  test('a failure in a toast says what failed: the list by its name, a box’s search by its label', async ({ page }) => {
    const problems = await go(page, 'slow=0&error=toast');
    await expect(rows(page).first()).toContainText('Delta Foods');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    await hold(page);
    await demo(page, '(d.list.reload(), 0)');
    await expect.poll(() => demo<number>(page, 'd.held')).toBeGreaterThan(0);
    await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'list'), d.hold(false), 0)");
    const toast = page.locator('.fd-say').filter({ hasText: 'did not answer' });
    await expect(toast).toContainText('Could not load the customers. The server did not answer this once.');
    await screen(page, 'waits-seen-toast-list', { viewport: true });
    await toast.getByRole('button', { name: 'Retry' }).click();
    await expect(rows(page).first()).toContainText('Delta Foods');
    // The person search.
    const manager = pane(page, 'Customer').locator('[data-node="f-manager"] input[role="combobox"]');
    await hold(page);
    await manager.fill('Mo');
    await expect.poll(() => demo<number>(page, 'd.held')).toBeGreaterThan(0);
    await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'search'), 0)");
    await expect(page.locator('.fd-say').filter({ hasText: 'search' })).toContainText('Account manager: Couldn’t search. The server did not answer this once.');
    await letGo(page);
    expect(problems).toEqual([]);
  });

  test('a person search that fails says so in its list, as wide as its box', async ({ page }) => {
    // A box narrower than the failure's words, as beside a gallery's menu at 1440 px.
    await page.setViewportSize({ width: 1100, height: 800 });
    await go(page, 'slow=0');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    const manager = pane(page, 'Customer').locator('[data-node="f-manager"] input[role="combobox"]');
    const list = pane(page, 'Customer').locator('[data-node="f-manager"] [role="listbox"]');
    await hold(page);
    await manager.fill('Mo');
    await expect(list.locator('.fd-loader[data-way="inline"]')).toHaveText('Searching…');
    await demo(page, "(d.net.failNext = true, d.release((ask) => ask.member === 'search'), 0)");
    await expect(list.locator('.fd-loader[data-way="failed"]')).toContainText('Couldn’t search.');
    const [shown, under] = [(await list.boundingBox())!, (await manager.boundingBox())!];
    expect(shown.width).toBeLessThanOrEqual(Math.max(under.width, 224) + 1);
    expect(shown.x + shown.width).toBeLessThanOrEqual(under.x + Math.max(under.width, 224) + 1);
    await screen(page, 'waits-seen-search-failed', { viewport: true });
    await letGo(page);
  });

  test('what was said under a box is its record’s: “nothing is called…” goes as another customer is opened', async ({ page }) => {
    const problems = await go(page, 'slow=0');
    await expect(nameBox(page)).toHaveValue('Nile Traders');
    const manager = pane(page, 'Customer').locator('[data-node="f-manager"] input[role="combobox"]');
    const hint = pane(page, 'Customer').locator('[data-node="f-manager"] .fd-refusal-hint');
    await manager.fill('Nobody here');
    await pane(page, 'Customer').locator('.fd-label').first().click();
    // The words typed set apart (⁨…⁩), as every quoted name is.
    await expect(hint).toHaveText('Account manager: nothing is called “\u2068Nobody here\u2069” yet; pick one or create it. Account manager still holds Omar Said');
    await rows(page).filter({ hasText: 'Horus Foods' }).first().click();
    // The words left in the box are the person's: asked first, as any other way out, where the form asks.
    const ask = page.getByRole('alertdialog');
    await expect.poll(async () => (await ask.isVisible()) || (await nameBox(page).inputValue()) === 'Horus Foods').toBe(true);
    if (await ask.isVisible()) await ask.getByRole('button', { name: 'Discard' }).click();
    await expect(nameBox(page)).toHaveValue('Horus Foods');
    await expect(manager).toHaveValue('Sara Fathy');
    await expect(hint).toBeHidden();
    expect(problems).toEqual([]);
  });
});

test.describe('a part’s wait drawn one way, as its code comes', () => {
  test('a map drawn the first time: its skeleton, never “Loading…” in words first', async ({ page }) => {
    const leaflet = await holdScript(page, /leaflet-src[-\w]*\.js$/);
    // The loading part as a slow network brings it: wherever the page asks for it, well after a wait's delay.
    const part = await lateScript(page, /loading-part[-\w]*\.js$/, 900);
    // Every loader the page puts in, from its first moment.
    await page.addInitScript(() => {
      const seen: string[] = ((window as unknown as { seen: string[] }).seen = []);
      new MutationObserver((changes) => {
        for (const change of changes) for (const added of change.addedNodes) if (added instanceof HTMLElement && added.matches('.fd-loader')) seen.push(`${added.dataset['moment']} ${added.dataset['way']}`);
      }).observe(document, { subtree: true, childList: true });
    });
    // Not waiting for the page's load: an engine may hold it for a script still on its way (Firefox).
    await page.goto('/plain/?page=map-homes&skin=outlined', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => leaflet.seen()).toBeGreaterThan(0);
    expect(part.seen()).toBeGreaterThan(0);
    await expect(page.locator('.fd-sk-block')).toBeVisible();
    await screen(page, 'waits-seen-map-skeleton', { viewport: true });
    leaflet.go();
    await expect(page.locator('.leaflet-container').first()).toBeVisible();
    await expect(page.locator('.fd-sk-block')).toHaveCount(0);
    expect(await page.evaluate(() => (window as unknown as { seen: string[] }).seen.filter((one) => one.endsWith(' text')))).toEqual([]);
  });

  test('a timeline whose code comes: a skeleton in its place, never an empty space under its search', async ({ page }) => {
    const timeline = await holdScript(page, /gantt-view[-\w]*\.js$/);
    await page.goto('/plain/?page=fitout-plan&skin=outlined', { waitUntil: 'domcontentloaded' });
    await expect.poll(() => timeline.seen()).toBeGreaterThan(0);
    const place = page.locator('.fd-gantt-holder');
    await expect(place).toHaveAttribute('aria-busy', 'true');
    // Its bars from the top of its place, each as wide as it is drawn: the first the whole width.
    const bars = place.locator('.fd-loader[data-way="skeleton"] .fd-sk');
    await expect(bars).toHaveCount(3);
    for (const bar of await bars.all()) await expect(bar).toBeVisible();
    expect((await bars.first().boundingBox())!.width).toBeGreaterThan((await place.boundingBox())!.width * 0.8);
    await screen(page, 'waits-seen-timeline-skeleton', { viewport: true });
    timeline.go();
    await expect(page.locator('.fd-gantt-task').first()).toBeVisible();
    await expect(place.locator(':scope > .fd-loader')).toHaveCount(0);
    await expect(place).not.toHaveAttribute('aria-busy', /.*/);
  });
});

test.describe('the designer’s “While it waits”', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`shows what is chosen as chosen, Fieldia’s defaults too, and asks its times in seconds (${scheme})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto('/screen/');
      await page.getByRole('button', { name: 'Advanced' }).click();
      await page.getByRole('tab', { name: 'Look' }).click();
      const section = page.locator('.fd-insp-loading-head');
      await section.scrollIntoViewIfNeeded();
      const row = (name: string) => page.locator(`[data-setting="${name}"]`);
      const chosen = (name: string) => row(name).locator('button[aria-pressed="true"]');
      await expect(chosen('Loading looks')).toHaveText(['Shimmer', 'Ring', 'At the top']);
      await expect(chosen('When loading fails')).toHaveText(['In place']);
      await expect(row('Loading times').getByRole('textbox', { name: 'Wait before showing' })).toHaveValue('0.15');
      await expect(row('Loading times').locator('.fd-insp-unit').first()).toHaveText('s');
      await row('Loading looks').getByRole('button', { name: 'Pulse' }).click();
      await expect(chosen('Loading looks')).toHaveText(['Pulse', 'Ring', 'At the top']);
      await row('Loading times').scrollIntoViewIfNeeded();
      await screen(page, `waits-seen-designer-${scheme}`, { viewport: true });
    });
  }
});
