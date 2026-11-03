import type { Page as Browser, Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * What no page draws from comes in a part of its own (0.37, the acts part: fieldia.acts.js): a page's steps run, its
 * dialogs and a page opened, its questions, a save over someone else's. The one-tag script asks for it right after the
 * whole check came — never beside it, nor beside a page's parts — and a page is drawn whole without it. A press, a
 * question or a dialog that comes before it is held: the control that asked busy, then done as the part lands. A page
 * that keeps its sends without signal (`outbox`) and acts asks for it with its parts, while the signal is there: its
 * send's steps run once it lands, kept on the device without signal and sent once it is back — or said why, never a
 * press that waits in silence. In each engine, each fetching and running a part's script its own way.
 */

/** A page of the app's own with the one-tag script, beside the script demo's fieldia.js and its parts. */
async function open(browser: Browser) {
  await browser.route('**/script/own-page.html', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><title>An app</title><script src="fieldia.js"></script></head><body><main id="app"></main></body></html>' }));
  await browser.goto('/script/own-page.html', { waitUntil: 'domcontentloaded' });
  await browser.waitForFunction(() => (window as unknown as { Fieldia?: unknown }).Fieldia);
}

/** A script held until `release`, as a slow network holds it; when it was asked for and when it came, by the test's clock. */
async function hold(browser: Browser, file: string) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  const seen: { asked: number[]; came: number[] } = { asked: [], came: [] };
  await browser.route(`**/script/${file}`, async (route: Route) => {
    seen.asked.push(Date.now());
    await held;
    await route.continue();
    seen.came.push(Date.now());
  });
  return { release, seen };
}

const lead = {
  fieldia: '0.14',
  id: 'lead',
  title: 'Lead',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, note: { type: 'char', label: 'Note' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-note', field: 'note' },
      { type: 'button', id: 'b-fill', label: 'Fill the note', steps: [{ do: 'set', field: 'note', value: "'Filled'" }] },
      { type: 'button', id: 'b-ask', label: 'Fill it, asked', confirm: 'Fill the note now?', steps: [{ do: 'set', field: 'note', value: "'Asked'" }] },
    ],
  },
};

async function mount(browser: Browser) {
  await browser.evaluate((shown) => {
    const w = window as unknown as { Fieldia: { mountViewer(h: Element, o: unknown): unknown; createMemoryDataSource(): unknown } };
    w.Fieldia.mountViewer(document.getElementById('app') as Element, { page: shown, dataSource: w.Fieldia.createMemoryDataSource() });
  }, lead);
}

test('asked for right after the whole check came, never beside it; the page drawn without it', async ({ page: browser }) => {
  const check = await hold(browser, 'fieldia.check.js');
  const acts = await hold(browser, 'fieldia.acts.js');
  await open(browser);
  await mount(browser);
  await expect(browser.getByRole('textbox', { name: 'Your name' })).toBeVisible();
  await expect.poll(() => check.seen.asked.length).toBe(1);
  // While the check is on its way, the acts part is not asked for.
  await browser.waitForTimeout(300);
  expect(acts.seen.asked).toEqual([]);
  check.release();
  await expect.poll(() => acts.seen.asked.length).toBe(1);
  expect(acts.seen.asked[0]).toBeGreaterThanOrEqual(check.seen.came[0]);
  acts.release();
});

test('a press before it came: its button busy, its steps run as it lands', async ({ page: browser }) => {
  const acts = await hold(browser, 'fieldia.acts.js');
  await open(browser);
  await mount(browser);
  const fill = browser.getByRole('button', { name: 'Fill the note' });
  await fill.click();
  await expect(fill).toHaveAttribute('aria-busy', 'true');
  await expect(browser.getByRole('textbox', { name: 'Note' })).toHaveValue('');
  acts.release();
  await expect(browser.getByRole('textbox', { name: 'Note' })).toHaveValue('Filled');
  await expect(fill).not.toHaveAttribute('aria-busy', 'true');
});

test("a press's question before it came: asked as it lands, then its steps", async ({ page: browser }) => {
  const acts = await hold(browser, 'fieldia.acts.js');
  await open(browser);
  await mount(browser);
  const ask = browser.getByRole('button', { name: 'Fill it, asked' });
  await ask.click();
  await expect(ask).toHaveAttribute('aria-busy', 'true');
  await expect(browser.getByRole('alertdialog')).toHaveCount(0);
  acts.release();
  const question = browser.getByRole('alertdialog', { name: 'Fill the note now?' });
  await expect(question).toBeVisible();
  await question.getByRole('button', { name: 'Fill it, asked' }).click();
  await expect(browser.getByRole('textbox', { name: 'Note' })).toHaveValue('Asked');
});

/** A site visit kept without signal (`outbox`) whose send runs a step of its own before it goes (`on.beforeSave`). */
const visit = {
  fieldia: '0.14',
  id: 'visit',
  title: 'Site visit',
  data: { kind: 'responses' },
  outbox: true,
  fields: { unit: { type: 'char', label: 'Unit' }, note: { type: 'char', label: 'Note' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-unit', field: 'unit' }, { type: 'field', id: 'f-note', field: 'note' }] },
  on: { beforeSave: [{ do: 'set', field: 'note', value: "'Checked on site'" }] },
};

/** The page's sends go by the network, as an app's do: each a request the test answers, or fails as a dead network fails it. */
async function signal(browser: Browser) {
  let gone = false;
  await browser.route('**/script/visit-send*', (route) => (gone ? route.abort('internetdisconnected') : route.fulfill({ contentType: 'text/plain', body: 'ok' })));
  return { gone: () => void (gone = true), back: () => void (gone = false) };
}
async function mountVisit(browser: Browser) {
  await browser.evaluate((shown) => {
    const w = window as unknown as { Fieldia: { mountViewer(h: Element, o: unknown): unknown }; sent: unknown[] };
    w.sent = [];
    const dataSource = {
      async submit(request: { values: unknown }) {
        const answer = await fetch(`/script/visit-send?${Math.random()}`);
        if (!answer.ok) throw new Error(`The server answered ${answer.status}`);
        w.sent.push(request.values);
        return { id: w.sent.length };
      },
    };
    // A broker signed in: what she sends without signal is kept as hers, past a closed tab.
    w.Fieldia.mountViewer(document.getElementById('app') as Element, { page: shown, dataSource, user: { id: 'mona', name: 'Mona Adel' } });
  }, visit);
}
const sent = (browser: Browser) => browser.evaluate(() => (window as unknown as { sent: unknown[] }).sent);

test('a page that keeps its sends without signal and acts asks for it with its parts, not after the check; drawn without it', async ({ page: browser }) => {
  const check = await hold(browser, 'fieldia.check.js');
  const acts = await hold(browser, 'fieldia.acts.js');
  await signal(browser);
  await open(browser);
  await mountVisit(browser);
  // Drawn while it is on its way: nothing on the page is drawn from it.
  await expect(browser.getByRole('textbox', { name: 'Unit' })).toBeVisible();
  // Asked for while the whole check is still on its way: never once it came, never by a first press with no signal.
  await expect.poll(() => acts.seen.asked.length).toBe(1);
  expect(check.seen.came).toEqual([]);
  check.release();
  acts.release();
});

test('its send pressed without signal, the part held: saving and busy, never silent; kept once it lands, sent once back', async ({ page: browser }) => {
  const acts = await hold(browser, 'fieldia.acts.js');
  const network = await signal(browser);
  await open(browser);
  await mountVisit(browser);
  await browser.getByRole('textbox', { name: 'Unit' }).fill('B-12');
  network.gone();
  const submit = browser.getByRole('button', { name: 'Submit' });
  await submit.click();
  // Its step's engine on its way: said where the person pressed, the button busy — not a press that did nothing.
  await expect(submit).toHaveAttribute('aria-busy', 'true');
  await expect(browser.locator('.fd-status')).toHaveText('Saving…');
  acts.release();
  // Its step run, then no signal: kept on the device, as a send without its steps is.
  await expect(browser.locator('.fd-done-title')).toBeVisible();
  await expect(browser.locator('.fd-done-title')).toHaveText('Kept on this device');
  network.back();
  // Sent by the outbox's own next try, its step's value with it.
  await expect(browser.locator('.fd-outbox-said')).toHaveText('Everything that waited was sent.');
  expect(await sent(browser)).toEqual([{ unit: 'B-12', note: 'Checked on site' }]);
});

test('its send where the part cannot come: said why, nothing kept unasked; sent at the next press once it can', async ({ page: browser }) => {
  let refused = true;
  await browser.route('**/script/fieldia.acts.js*', (route) => (refused ? route.abort('internetdisconnected') : route.continue()));
  const network = await signal(browser);
  await open(browser);
  await mountVisit(browser);
  await browser.getByRole('textbox', { name: 'Unit' }).fill('B-12');
  network.gone();
  const submit = browser.getByRole('button', { name: 'Submit' });
  await submit.click();
  await expect(browser.locator('.fd-status')).toHaveText('Not sent');
  await expect(browser.getByText('This action could not load, so nothing was done. Try again.')).toBeVisible();
  await expect(submit).not.toHaveAttribute('aria-busy', 'true');
  expect(await sent(browser)).toEqual([]);
  refused = false;
  network.back();
  await submit.click();
  await expect(browser.locator('.fd-done-title')).toBeVisible();
  await expect(browser.locator('.fd-done-title')).toHaveText('Thank you. Your answers were sent.');
  expect(await sent(browser)).toEqual([{ unit: 'B-12', note: 'Checked on site' }]);
});
