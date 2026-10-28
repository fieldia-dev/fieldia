import type { Page as Browser, Route } from '@playwright/test';
import { expect, test } from './fixtures';
import { VARIANTS } from './variants';

/**
 * The checks a viewer runs on a page (0.37; docs/maintainers/release-train.md, the coordinator's decision of 28 Oct):
 * before the draw, what 0.35's viewer refused (`checkPage`) — a page it refuses is never drawn, the mount throws; and the
 * whole check, `validatePage`'s verdict in a script of its own (`fieldia.check.js`) that the one-tag script asks for once
 * the page is parsed and no page waits for the parts it is drawn from, run as soon as the page is drawn and never waited
 * for: a valid page draws as 0.36.0 drew it. A page the whole
 * check refuses is taken down once it ran — its words in its place, `onError` told (`stage: "check"`), `refused` settled
 * — and nothing is written through it before then: a send asked meanwhile waits, and goes (a page that passes) or is
 * refused with the page. Where its script cannot come, the page stays drawn, that is said, and its sends go on. In each
 * engine: each fetches and runs the part's script its own way. And in each framework's demo, a page taken down leaves
 * the app round it.
 */

type Checked = { told: { stage: string; part: string; warning?: boolean; paths: string[]; message: string }[]; thrown: string | null; refused: string | null | undefined; drawn: boolean; drawnAtMount: boolean };

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
/** A mistake only the whole check finds (0.35 drew it; 0.36 drew it and said it; 0.37 takes it down). */
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

/** `given` mounted in the app's page on a memory source (`window.source`): what onError heard, what the mount threw, how `drawn` and `refused` settled. */
async function mount(browser: Browser, given: unknown) {
  await browser.evaluate((shown) => {
    const w = window as unknown as {
      Fieldia: { mountViewer(h: Element, o: unknown): { drawn: Promise<void>; refused: Promise<Error | null> }; createMemoryDataSource(o?: unknown): unknown };
      checked: Checked;
      source: { responses: unknown[] };
    };
    w.checked = { told: [], thrown: null, refused: undefined, drawn: false, drawnAtMount: false };
    w.source = w.Fieldia.createMemoryDataSource() as { responses: unknown[] };
    try {
      const handle = w.Fieldia.mountViewer(document.getElementById('app') as Element, {
        page: shown,
        dataSource: w.source,
        onError: (error: { message: string; issues?: { path: string }[] }, where: { stage: string; part: string; warning?: boolean }) => w.checked.told.push({ ...where, paths: (error.issues ?? []).map((issue) => issue.path), message: error.message }),
      });
      // Drawn as it was mounted, in the same task: nothing waited for.
      w.checked.drawnAtMount = !!document.querySelector('#app .fd-field');
      void handle.drawn.then(() => (w.checked.drawn = true));
      void handle.refused.then((error) => (w.checked.refused = error ? error.message : null));
    } catch (error) {
      w.checked.thrown = (error as Error).message;
    }
  }, given);
}
const checked = (browser: Browser) => browser.evaluate(() => (window as unknown as { checked: Checked }).checked);
const sent = (browser: Browser) => browser.evaluate(() => (window as unknown as { source: { responses: unknown[] } }).source.responses.length);
/** When a script was asked for, by the page's clock; null where it was not. */
const UNSHOWN = 'This form cannot be shown: its page has mistakes. Whoever made it can check it with validatePage.';
/** The name typed and Submit pressed. */
async function send(browser: Browser) {
  await browser.getByRole('textbox', { name: 'Your name' }).fill('Hana Fouad');
  await browser.getByRole('button', { name: 'Submit', exact: true }).click();
}

test('the whole check is asked for once the page is parsed, beside the app’s own data; a page is drawn at once, never waiting for it', async ({ page: browser }) => {
  // The app's page fetched from its server by the app's own script, as an app does — slow; the whole check held too.
  let answer!: () => void;
  const answered = new Promise<void>((resolve) => (answer = resolve));
  await browser.route('**/script/contact.page.json', async (route) => {
    await answered;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(page()) });
  });
  const release = await holdCheck(browser);
  await browser.route('**/script/own-page.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>An app</title><script src="fieldia.js"></script></head><body><main id="app"></main><script>
        window.shown = fetch('contact.page.json').then((answer) => answer.json());
      </script></body></html>`,
    })
  );
  await browser.goto('/script/own-page.html', { waitUntil: 'domcontentloaded' });
  // Asked for while the app's own data is on its way: beside it.
  await expect.poll(() => browser.evaluate(() => (window as unknown as { Fieldia: { pageCheckPart: { coming?: boolean } } }).Fieldia.pageCheckPart.coming)).toBe(true);
  answer();
  await mount(browser, await browser.evaluate(() => (window as unknown as { shown: Promise<unknown> }).shown));
  // Its check still on its way: drawn as it was mounted all the same.
  expect((await checked(browser)).drawnAtMount).toBe(true);
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  release();
  await expect.poll(async () => (await checked(browser)).refused).toBeNull();
  expect((await checked(browser)).told).toEqual([]);
});

test('a page drawn from parts: the whole check asked for only once it is drawn — never sharing the line with its parts', async ({ page: browser }) => {
  let releaseList!: () => void;
  const listHeld = new Promise<void>((resolve) => (releaseList = resolve));
  await browser.route('**/script/fieldia.list.js', async (route) => {
    await listHeld;
    await route.continue();
  });
  const asked: string[] = [];
  browser.on('request', (request) => {
    const file = /\/(fieldia\.(?:check|list)\.js)$/.exec(request.url())?.[1];
    if (file) asked.push(file);
  });
  // Mounted at once, as the script has run: a list, drawn from the list part.
  await browser.route('**/script/own-list.html', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>An app</title><script src="fieldia.js"></script></head><body><main id="app"></main><script>
        window.listed = Fieldia.mountViewer(document.getElementById('app'), { page: ${JSON.stringify({ fieldia: '0.13', id: 'people', data: { kind: 'record', model: 'partner' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'list', id: 'l', columns: ['name'] } })}, dataSource: Fieldia.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } } } }) });
      </script></body></html>`,
    })
  );
  await browser.goto('/script/own-list.html', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => asked).toContain('fieldia.list.js');
  await browser.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  // Its part on its way: the whole check not asked for beside it.
  expect(asked).toEqual(['fieldia.list.js']);
  releaseList();
  await expect(browser.locator('#app .fd-list')).toBeVisible();
  await expect.poll(() => asked).toEqual(['fieldia.list.js', 'fieldia.check.js']);
  expect(await browser.evaluate(() => (window as unknown as { listed: { refused: Promise<unknown> } }).listed.refused)).toBeNull();
});

test('a page only the whole check refuses: drawn at once, then taken down as its check runs — its words, onError (stage "check"), refused', async ({ page: browser }) => {
  const warnings: string[] = [];
  browser.on('console', (message) => message.type() === 'warning' && warnings.push(message.text()));
  await open(browser);
  await browser.waitForFunction(() => !!(window as unknown as { Fieldia: { pageCheckPart: { loaded?: unknown } } }).Fieldia.pageCheckPart.loaded);
  await mount(browser, onlyWhole());
  expect((await checked(browser)).drawnAtMount).toBe(true);
  await expect(browser.locator('#app .fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
  await browser.locator('#app .fd-unshown summary').click();
  await expect(browser.locator('#app .fd-unshown li code')).toHaveText(['fields.name.required']);
  await expect(browser.locator('#app .fd-field')).toHaveCount(0);
  const { told, thrown, refused } = await checked(browser);
  expect(thrown).toBeNull();
  expect(refused).toMatch(/^This page cannot be shown:\n {2}fields\.name\.required: /);
  expect(told.map(({ message: _, ...where }) => where)).toEqual([{ stage: 'check', part: 'page', paths: ['fields.name.required'] }]);
  // Refused, never warned of (page.invalid is changed in 0.37).
  expect(warnings.filter((words) => words.includes('page.invalid'))).toEqual([]);
});

test('its check on its way: a send waits for it — then a page that passes sends it', async ({ page: browser }) => {
  const release = await holdCheck(browser);
  await open(browser);
  await mount(browser, page());
  await send(browser);
  // Held: nothing sent through the page before its check ran.
  await browser.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)));
  expect(await sent(browser)).toBe(0);
  release();
  await expect.poll(() => sent(browser)).toBe(1);
  expect((await checked(browser)).refused).toBeNull();
  await expect(browser.locator('#app .fd-unshown')).toHaveCount(0);
});

test('its check on its way: a send waits for it — then a page it refuses is taken down, nothing sent', async ({ page: browser }) => {
  const release = await holdCheck(browser);
  await open(browser);
  await mount(browser, onlyWhole());
  await send(browser);
  await browser.evaluate(() => new Promise((resolve) => setTimeout(resolve, 400)));
  expect(await sent(browser)).toBe(0);
  release();
  await expect(browser.locator('#app .fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
  await expect(browser.locator('#app .fd-field')).toHaveCount(0);
  await browser.evaluate(() => new Promise((resolve) => setTimeout(resolve, 300)));
  expect(await sent(browser)).toBe(0);
  expect((await checked(browser)).told.map(({ message: _, ...where }) => where)).toEqual([{ stage: 'check', part: 'page', paths: ['fields.name.required'] }]);
});

test('a page 0.35 refused: refused at the mount, its words where the form would be, told as before (stage "draw")', async ({ page: browser }) => {
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

test('its check could not come: drawn on the checks fieldia.js carries, said once in the console, to onError as a warning and over the page — its sends go on', async ({ page: browser }) => {
  const warnings: string[] = [];
  browser.on('console', (message) => message.type() === 'warning' && warnings.push(message.text()));
  await browser.route('**/script/fieldia.check.js', (route) => route.abort('internetdisconnected'));
  await open(browser);
  // Even a page the whole check would refuse: an availability failure takes no form down (docs/promises.md).
  await mount(browser, onlyWhole());
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect(browser.locator('#app .fd-parts-unloaded')).toContainText('Part of this page could not load');
  await expect.poll(async () => (await checked(browser)).refused).toBeNull();
  const { told } = await checked(browser);
  expect(told.map(({ paths: _, ...where }) => where)).toEqual([{ stage: 'check', part: 'page', warning: true, message: 'This page could not be fully checked: fieldia.check.js could not be loaded. It is drawn on the checks fieldia.js carries.' }]);
  expect(warnings.filter((words) => words.includes('could not be fully checked'))).toHaveLength(1);
  // Never held for ever: what is sent goes.
  await send(browser);
  await expect.poll(() => sent(browser)).toBe(1);
  // A page 0.35 refused is refused still: the checks fieldia.js carries ran.
  await browser.evaluate(() => document.getElementById('app')?.replaceChildren());
  await mount(browser, page((p) => (p.layout.children[1]['field'] = 'phone')));
  await expect(browser.locator('#app .fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
});

/**
 * In each framework's demo — the plain one, React's, Vue's and Angular's: a page the whole check refuses taken down,
 * its words where the form was, the app round it still there, nothing thrown out of it. The demo's page, fetched as a
 * file of its own (demos/shared/lazy-page.ts), is answered here with one mistake only the whole check finds.
 */
for (const variant of VARIANTS) {
  test(`${variant}: a page the whole check refuses is taken down, says why in its place, the app round it kept`, async ({ page: browser }) => {
    const errors: string[] = [];
    browser.on('pageerror', (error) => errors.push(error.message));
    await browser.route(/\/chunks\/enquiry\.page-[^/]*\.js$/, async (route) => {
      const real = await route.fetch();
      const code = await real.text();
      // The demo's own page with a "required" that is no yes or no: drawn by 0.35, taken down by 0.37.
      await route.fulfill({ response: real, body: code.replace(/required:\s*!0/, 'required:"yes"') });
    });
    await browser.goto(`/${variant}/?page=enquiry`);
    await expect(browser.locator('.fd-unshown [role="alert"]')).toHaveText(UNSHOWN);
    await browser.locator('.fd-unshown summary').click();
    await expect(browser.locator('.fd-unshown li code').first()).toHaveText(/^fields\.[a-z_]+\.required$/);
    await expect(browser.locator('.fd-field')).toHaveCount(0);
    // The demo's own page round it — its header — still there, and nothing thrown out of the app.
    await expect(browser.locator('header, nav').first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}
