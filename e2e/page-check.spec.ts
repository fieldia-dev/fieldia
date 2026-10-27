import type { Page as Browser, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { VARIANTS } from './variants';

/**
 * The checks a viewer runs on a page, before its first draw (0.37; docs/maintainers/release-train.md): what 0.35's
 * viewer refused (`checkPage`), and the whole check — `validatePage`'s verdict, in a script of its own
 * (`fieldia.check.js`) that the one-tag script asks for as it starts, beside the page's own data, and that a page waits
 * for as for its parts. A page either refuses is never drawn: its words where the form would be, onError told, the
 * mount's `PageRefused` — at once where the whole check was in, through `drawn` where the page waited for it. Where it
 * cannot come, the page is drawn on the checks fieldia.js carries, and that is said. In each engine: each fetches and
 * runs the part's script its own way. And in each framework's demo, a refused page leaves the app round it.
 */

type Checked = { told: { stage: string; part: string; warning?: boolean; paths: string[]; message: string }[]; thrown: string | null; rejected: string | null; drawn: boolean; drawnAtMount: boolean; mountedAt: number | null };

const page = (change: (page: Record<string, unknown> & { fields: Record<string, Record<string, unknown>>; layout: { children: Record<string, unknown>[] } }) => void = () => undefined) => {
  const made = {
    fieldia: '0.13',
    id: 'contact',
    title: 'Contact',
    data: { kind: 'responses' },
    fields: { name: { type: 'char', label: 'Your name' }, topic: { type: 'selection', label: 'Topic', options: [{ value: 'sales', label: 'Sales' }, { value: 'support', label: 'Support' }] } },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-topic', field: 'topic' }] },
  };
  change(made as never);
  return made;
};
/** A mistake only the whole check finds (0.35 drew it; 0.36 drew it and said it; 0.37 refuses it). */
const onlyWhole = () => page((p) => (p.fields['name']['required'] = 'yes'));

/** The whole check's script held until `release`, as a slow network holds it. */
async function holdCheck(browser: Browser) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await browser.route('**/script/fieldia.check.js', async (route: Route) => {
    await held;
    await route.continue();
  });
  return release;
}

/** A page of the app's own with the one-tag script and nothing drawn yet (beside the script demo, its fieldia.js and its parts). */
async function open(browser: Browser) {
  await browser.route('**/script/own-page.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>An app</title><script src="fieldia.js"></script></head><body><main id="app"></main></body></html>' }));
  // Not waiting for the page's load: a whole check held on its way holds that too.
  await browser.goto('/script/own-page.html', { waitUntil: 'domcontentloaded' });
  await browser.waitForFunction(() => (window as unknown as { Fieldia?: unknown }).Fieldia);
}

/** `given` mounted in the app's page: what onError heard, what the mount threw, how `drawn` settled. */
async function mount(browser: Browser, given: unknown) {
  await browser.evaluate((shown) => {
    const w = window as unknown as {
      Fieldia: { mountViewer(h: Element, o: unknown): { drawn: Promise<void> }; createMemoryDataSource(o?: unknown): unknown };
      checked: Checked;
    };
    w.checked = { told: [], thrown: null, rejected: null, drawn: false, drawnAtMount: false, mountedAt: performance.now() };
    try {
      const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, {
        page: shown,
        dataSource: w.Fieldia.createMemoryDataSource(),
        onError: (error: { message: string; issues?: { path: string }[] }, where: { stage: string; part: string; warning?: boolean }) => w.checked.told.push({ ...where, paths: (error.issues ?? []).map((issue) => issue.path), message: error.message }),
      });
      // Drawn as it was mounted, in the same task: its whole check was in already.
      w.checked.drawnAtMount = !!document.querySelector('#app .fd-field');
      void handle.drawn.then(
        () => (w.checked.drawn = true),
        (error: Error) => (w.checked.rejected = error.message)
      );
    } catch (error) {
      w.checked.thrown = (error as Error).message;
    }
  }, given);
}
const checked = (browser: Browser) => browser.evaluate(() => (window as unknown as { checked: Checked }).checked);
/** When a script was asked for, by the page's clock; null where it was not. */
const askedAt = (browser: Browser, file: RegExp) => browser.evaluate((source) => (performance.getEntriesByType('resource') as PerformanceResourceTiming[]).find((entry) => new RegExp(source).test(entry.name))?.startTime ?? null, file.source);
const UNSHOWN = 'This form cannot be shown: its page has mistakes. Whoever made it can check it with validatePage.';

test('the whole check is asked for as the script starts, before the page’s own data: a page mounted once its data came is drawn at once', async ({ page: browser }) => {
  // The app's page fetched from its server, as an app does — slower than the whole check, here.
  await browser.route('**/script/contact.page.json', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(page()) });
  });
  await open(browser);
  await browser.evaluate(async () => {
    const shown = await (await fetch('contact.page.json')).json();
    (window as unknown as { shown: unknown }).shown = shown;
  });
  const checkAt = await askedAt(browser, /\/fieldia\.check\.js(\?|$)/);
  const dataAt = await askedAt(browser, /\/contact\.page\.json(\?|$)/);
  expect(checkAt).not.toBeNull();
  expect(checkAt as number).toBeLessThan(dataAt as number);
  await mount(browser, await browser.evaluate(() => (window as unknown as { shown: unknown }).shown));
  // Its check in by the time its data came: drawn as it was mounted, nothing waited for.
  expect((await checked(browser)).drawnAtMount).toBe(true);
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect.poll(async () => (await checked(browser)).drawn).toBe(true);
  expect((await checked(browser)).told).toEqual([]);
});

test('a page only the whole check refuses, mounted once its check came: refused at once — its words, onError (stage "check"), the mount thrown', async ({ page: browser }) => {
  const warnings: string[] = [];
  browser.on('console', (message) => message.type() === 'warning' && warnings.push(message.text()));
  await open(browser);
  await browser.waitForFunction(() => !!(window as unknown as { Fieldia: { pageCheckPart: { loaded?: unknown } } }).Fieldia.pageCheckPart.loaded);
  await mount(browser, onlyWhole());
  await expect(browser.locator('#app .fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
  await browser.locator('#app .fd-unshown summary').click();
  await expect(browser.locator('#app .fd-unshown li code')).toHaveText(['fields.name.required']);
  await expect(browser.locator('#app .fd-field')).toHaveCount(0);
  const { told, thrown } = await checked(browser);
  expect(thrown).toMatch(/^This page cannot be shown:\n {2}fields\.name\.required: /);
  expect(told.map(({ message: _, ...where }) => where)).toEqual([{ stage: 'check', part: 'page', paths: ['fields.name.required'] }]);
  // Refused, never warned of (page.invalid is changed in 0.37).
  expect(warnings.filter((words) => words.includes('page.invalid'))).toEqual([]);
});

test('mounted before its check came: nothing drawn until it came — then a page that passes drawn, one it refuses refused', async ({ page: browser }) => {
  const release = await holdCheck(browser);
  await open(browser);
  await mount(browser, onlyWhole());
  // The mount returned (the page waits, as for its parts): nothing of it drawn, and nothing refused yet.
  await browser.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(await checked(browser)).toMatchObject({ thrown: null, rejected: null, drawn: false, drawnAtMount: false, told: [] });
  await expect(browser.locator('#app .fd-field, #app .fd-unshown')).toHaveCount(0);
  await expect(browser.locator('#app .fd-form')).toHaveAttribute('aria-busy', 'true');
  release();
  // Once it came: refused, before anything of it was drawn — `drawn` rejecting with the mount's words.
  await expect(browser.locator('#app .fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
  await expect.poll(async () => (await checked(browser)).rejected).toMatch(/^This page cannot be shown:\n {2}fields\.name\.required: /);
  await expect(browser.locator('#app .fd-field')).toHaveCount(0);
  expect((await checked(browser)).told.map(({ message: _, ...where }) => where)).toEqual([{ stage: 'check', part: 'page', paths: ['fields.name.required'] }]);
});

test('a page that passes, mounted before its check came: drawn once it came, nothing said', async ({ page: browser }) => {
  const release = await holdCheck(browser);
  await open(browser);
  await mount(browser, page());
  await browser.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  await expect(browser.locator('#app .fd-field')).toHaveCount(0);
  release();
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect.poll(async () => (await checked(browser)).drawn).toBe(true);
  expect((await checked(browser)).told).toEqual([]);
  await expect(browser.locator('#app .fd-parts-unloaded:visible')).toHaveCount(0);
});

test('a page 0.35 refused: refused, its words where the form would be, told as before (stage "draw")', async ({ page: browser }) => {
  await open(browser);
  await mount(browser, page((p) => (p.layout.children[1]['field'] = 'phone')));
  const words = browser.locator('#app .fd-unshown [role="alert"]');
  await expect(words).toHaveText(UNSHOWN);
  await browser.locator('#app .fd-unshown summary').click();
  await expect(browser.locator('#app .fd-unshown li')).toHaveText(['layout.children[1].field no field "phone"']);
  await expect(browser.locator('#app .fd-field')).toHaveCount(0);
  const { told, thrown } = await checked(browser);
  expect(thrown).toMatch(/^This page cannot be shown:/);
  expect(told.map(({ message: _, ...where }) => where)).toEqual([{ stage: 'draw', part: 'page', paths: ['layout.children[1].field'] }]);
});

test('its check could not come: drawn on the checks fieldia.js carries, said once in the console, to onError as a warning and over the page', async ({ page: browser }) => {
  const warnings: string[] = [];
  browser.on('console', (message) => message.type() === 'warning' && warnings.push(message.text()));
  await browser.route('**/script/fieldia.check.js', (route) => route.abort('internetdisconnected'));
  await open(browser);
  // Even a page the whole check would refuse: an availability failure takes no form down (docs/promises.md).
  await mount(browser, onlyWhole());
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect.poll(async () => (await checked(browser)).drawn).toBe(true);
  await expect(browser.locator('#app .fd-parts-unloaded')).toContainText('Part of this page could not load');
  const { told } = await checked(browser);
  expect(told.map(({ paths: _, ...where }) => where)).toEqual([{ stage: 'check', part: 'page', warning: true, message: 'This page could not be fully checked: fieldia.check.js could not be loaded. It is drawn on the checks fieldia.js carries.' }]);
  expect(warnings.filter((words) => words.includes('could not be fully checked'))).toHaveLength(1);
  // A page 0.35 refused is refused still: the checks fieldia.js carries ran.
  await browser.evaluate(() => document.getElementById('app')?.replaceChildren());
  await mount(browser, page((p) => (p.layout.children[1]['field'] = 'phone')));
  await expect(browser.locator('#app .fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
});

/**
 * In each framework's demo — the plain one, React's, Vue's and Angular's: a page refused before its first draw, its
 * words where the form would be, the app round it still there. The demo's page, fetched as a file of its own
 * (demos/shared/lazy-page.ts), is answered here with one mistake only the whole check finds.
 */
for (const variant of VARIANTS) {
  test(`${variant}: a page the whole check refuses says why in its place, the app round it kept`, async ({ page: browser }) => {
    const errors: string[] = [];
    browser.on('pageerror', (error) => errors.push(error.message));
    await browser.route(/\/chunks\/enquiry\.page-[^/]*\.js$/, async (route) => {
      const real = await route.fetch();
      const code = await real.text();
      // The demo's own page with a "required" that is no yes or no: drawn by 0.35, refused before the draw by 0.37.
      await route.fulfill({ response: real, body: code.replace(/required:\s*!0/, 'required:"yes"') });
    });
    await browser.goto(`/${variant}/?page=enquiry`);
    await expect(browser.locator('.fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
    await browser.locator('.fd-unshown summary').click();
    await expect(browser.locator('.fd-unshown li code').first()).toHaveText(/^fields\.[a-z_]+\.required$/);
    await expect(browser.locator('.fd-field')).toHaveCount(0);
    // The demo's own page round it — its header — still there. React, Vue and Angular keep the app: nothing thrown out of
    // it. The plain demo's own code mounts with no try: the mount's `PageRefused` is its to catch, the words drawn all the same.
    await expect(browser.locator('header, nav').first()).toBeVisible();
    if (variant === 'plain') expect(errors).toEqual([expect.stringMatching(/^This page cannot be shown:\n {2}fields\.[a-z_]+\.required: /)]);
    else expect(errors).toEqual([]);
  });
}
