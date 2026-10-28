import type { Page as Browser, Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * What no page draws from comes in a part of its own (0.37, the acts part: fieldia.acts.js): a page's steps run, its
 * dialogs and a page opened, its questions, a save over someone else's. The one-tag script asks for it right after the
 * whole check came — never beside it, nor beside a page's parts — and a page is drawn whole without it. A press, a
 * question or a dialog that comes before it is held: the control that asked busy, then done as the part lands. In each
 * engine, each fetching and running a part's script its own way.
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
