import type { Page as Browser, Route } from '@playwright/test';
import { expect, test } from './fixtures';

/**
 * Nothing a person may press moves as a part arrives (the 0.37 walk: the classic formatted text's toolbar came 0.6 s
 * after an app's page and pushed Signed and Submit 37 px down, 67 on a phone; a sheet's badge and alert, 102 px; a
 * record's boxes and title 3 and 8 px as it came after its skeleton). A part drawn in place holds its room from the
 * draw (the toolbar's, wrapping as it does), or is waited for where its room cannot be known (a sheet's furniture that
 * takes room), and a skeleton's shapes are as tall as the boxes they stand for. Each case: an app's own page with the
 * one-tag script, the part held, every control's place read at the draw and again once it came — not a pixel moved. On
 * a desktop and a phone, in each engine, each laying out and wrapping its own way.
 */

/** A page of the app's own with the one-tag script, beside the script demo's fieldia.js and its parts. */
async function open(browser: Browser) {
  await browser.route('**/script/own-page.html', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>An app</title><script src="fieldia.js"></script></head><body style="margin:0;background:#f6f7f9"><main id="app" style="max-width:1100px;margin:16px auto"></main></body></html>' })
  );
  await browser.goto('/script/own-page.html', { waitUntil: 'domcontentloaded' });
  await browser.waitForFunction(() => (window as unknown as { Fieldia?: unknown }).Fieldia);
}

/** A part's script held until `release`, as a slow network holds it. */
async function hold(browser: Browser, file: string) {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await browser.route(`**/script/${file}`, async (route: Route) => {
    await held;
    await route.continue();
  });
  return release;
}

/** Every control a person may press or type in, by its id or its words: where it stands on the page. */
const places = (browser: Browser) =>
  browser.evaluate(() => {
    const found: Record<string, [number, number]> = {};
    for (const control of document.querySelectorAll<HTMLElement>('#app :is(button, input, select, textarea, [role="textbox"], [role="combobox"])')) {
      if (control.closest('.fd-richtext-bar') || !control.getClientRects().length) continue;
      const key = control.id || control.getAttribute('aria-label') || control.textContent?.trim() || control.tagName;
      const box = control.getBoundingClientRect();
      found[key] = [Math.round(box.top + scrollY), Math.round(box.left + scrollX)];
    }
    return found;
  });

/** Mounted on a memory source; its record's answer held where `held` is given. */
async function mount(browser: Browser, page: object, recordHeld = false) {
  await browser.evaluate(
    ([shown, holds]) => {
      const w = window as unknown as {
        Fieldia: { mountViewer(h: Element, o: unknown): unknown; createMemoryDataSource(o?: unknown): Record<string, unknown> };
        letRecordGo?: () => void;
      };
      const source = w.Fieldia.createMemoryDataSource({ records: { supplier: { 1: { name: 'Nile Traders', state: 'new', email: 'orders@nile.example', phone: '+20 2 2794 3300' } } } });
      if (holds) {
        const load = source['load'] as (...args: unknown[]) => Promise<unknown>;
        const held = new Promise<void>((resolve) => (w.letRecordGo = resolve));
        source['load'] = (...args: unknown[]) => held.then(() => load(...args));
      }
      w.Fieldia.mountViewer(document.getElementById('app') as Element, { page: shown, dataSource: source, ...(holds ? { recordId: 1 } : {}) });
    },
    [page, recordHeld] as const
  );
}

const note = {
  fieldia: '0.13',
  id: 'note',
  title: 'A note to the buyer',
  data: { kind: 'responses' },
  fields: { subject: { type: 'char', label: 'Subject' }, body: { type: 'html', label: 'Your note' }, sign: { type: 'char', label: 'Signed' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-subject', field: 'subject' }, { type: 'field', id: 'f-body', field: 'body' }, { type: 'field', id: 'f-sign', field: 'sign' }] },
};
const sheet = (furniture: object) => ({
  fieldia: '0.13',
  id: 'supplier',
  title: 'Supplier',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name', default: 'Nile Traders' }, email: { type: 'char', label: 'Email' }, phone: { type: 'char', label: 'Phone' }, notes: { type: 'text', label: 'Notes' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    ...furniture,
    children: [{ type: 'section', id: 'main', columns: 2, children: [{ type: 'field', id: 'f-email', field: 'email' }, { type: 'field', id: 'f-phone', field: 'phone' }, { type: 'field', id: 'f-notes', field: 'notes', colspan: 2 }] }],
  },
});
const supplier = {
  fieldia: '0.13',
  id: 'supplier',
  title: 'Supplier',
  data: { kind: 'record', model: 'supplier' },
  fields: {
    name: { type: 'char', label: 'Name' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }], default: 'new' },
    email: { type: 'char', label: 'Email' },
    phone: { type: 'char', label: 'Phone' },
    notes: { type: 'text', label: 'Notes' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    statusbar: { field: 'state' },
    badges: [{ id: 'b-new', label: 'New supplier', tone: 'info', invisible: "state != 'new'" }],
    children: [{ type: 'section', id: 'main', columns: 2, children: [{ type: 'field', id: 'f-email', field: 'email' }, { type: 'field', id: 'f-phone', field: 'phone' }, { type: 'field', id: 'f-notes', field: 'notes', colspan: 2 }] }],
  },
};

/**
 * Every move of a control a person may press, from the frame it is first seen in: tracked in the page from its start,
 * each frame (by its id or its words), as a person would see it move.
 */
const TRACK_MOVES = () => {
  const w = window as unknown as { moves: string[] };
  w.moves = [];
  const seen = new Map<Element, [number, number]>();
  const look = () => {
    for (const control of document.querySelectorAll<HTMLElement>('.fd-form :is(button, input, select, textarea, [role="textbox"], [role="combobox"])')) {
      if (!control.getClientRects().length || control.closest('.fd-richtext-bar')) continue;
      const box = control.getBoundingClientRect();
      const at: [number, number] = [Math.round(box.top + scrollY), Math.round(box.left + scrollX)];
      const was = seen.get(control);
      if (!was) seen.set(control, at);
      else if (was[0] !== at[0] || was[1] !== at[1]) {
        w.moves.push(`${control.id || control.getAttribute('aria-label') || control.textContent?.trim()}: ${was} → ${at}`);
        seen.set(control, at);
      }
    }
    requestAnimationFrame(look);
  };
  requestAnimationFrame(look);
};

test.describe('a record’s attachment beside it', () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test('the bill’s PDF takes its place as the bill is drawn, the files part waited for with the page: nothing moves', async ({ page: browser }) => {
    await browser.addInitScript(TRACK_MOVES);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await browser.route(/\/chunks\/files-part-[^/?]*\.js(\?.*)?$/, async (route: Route) => {
      await held;
      await route.continue();
    });
    await browser.goto('/plain/?page=vendor-bill&record=3&skin=underline', { waitUntil: 'domcontentloaded' });
    await browser.waitForTimeout(600);
    release();
    await expect(browser.locator('.fd-attachment-preview')).toBeVisible();
    await expect(browser.locator('[data-node="partner_id"], [data-node="f-partner"]').first()).toBeVisible();
    await browser.waitForTimeout(500);
    expect(await browser.evaluate(() => (window as unknown as { moves: string[] }).moves)).toEqual([]);
  });
});

for (const [device, viewport] of [['desktop', { width: 1280, height: 900 }], ['phone', { width: 390, height: 844 }]] as const) {
  test.describe(`${device}: nothing moves as a part arrives`, () => {
    test.use({ viewport });

    test('the classic formatted text’s toolbar comes into the room held for it: Signed and Submit stay', async ({ page: browser }) => {
      const release = await hold(browser, 'fieldia.html.js');
      await open(browser);
      await mount(browser, note);
      await expect(browser.getByRole('button', { name: 'Submit' })).toBeVisible();
      const before = await places(browser);
      expect(Object.keys(before)).toEqual(expect.arrayContaining(['Submit']));
      release();
      await expect(browser.locator('[data-node="f-body"] .fd-richtext-bar').getByRole('button', { name: 'Bold' })).toBeVisible();
      expect(await places(browser)).toEqual(before);
    });

    test('a sheet whose furniture takes room waits for it: drawn whole, nothing moves after', async ({ page: browser }) => {
      const release = await hold(browser, 'fieldia.sheet.js');
      await open(browser);
      await mount(browser, sheet({ badges: [{ id: 'b-new', label: 'New supplier', tone: 'info' }], alerts: [{ id: 'a-papers', tone: 'warning', message: 'Check the supplier’s papers before the first order.' }] }));
      // Drawn as the part lands, never before it: its badge and alert with it.
      await browser.waitForTimeout(400);
      const drawnEarly = await browser.locator('#app [data-node="f-email"]').count();
      release();
      await expect(browser.locator('#app .fd-alert')).toBeVisible();
      const before = await places(browser);
      await browser.waitForTimeout(300);
      expect(await places(browser)).toEqual(before);
      expect(drawnEarly, 'the sheet waited for its furniture, which takes room').toBe(0);
    });

    test('a sheet whose only furniture is its ribbon: drawn at once, the ribbon over its corner, nothing moves', async ({ page: browser }) => {
      const release = await hold(browser, 'fieldia.sheet.js');
      await open(browser);
      await mount(browser, sheet({ ribbon: { id: 'r-new', label: 'New', tone: 'info' } }));
      await expect(browser.locator('#app [data-node="f-email"] input')).toBeVisible();
      const before = await places(browser);
      release();
      await expect(browser.locator('#app .fd-ribbon')).toBeVisible();
      expect(await places(browser)).toEqual(before);
    });

    test('a record drawn from its skeleton: its boxes and title stand where they will, as its record comes', async ({ page: browser }) => {
      await open(browser);
      await mount(browser, supplier, true);
      // The skeleton's shapes in the boxes' places, the record held.
      await expect(browser.locator('#app [data-fd-shaped]')).toBeVisible();
      const before = await places(browser);
      await browser.evaluate(() => (window as unknown as { letRecordGo: () => void }).letRecordGo());
      await expect(browser.locator('#app [data-fd-shaped]')).toHaveCount(0);
      await expect(browser.locator('#app [data-node="f-email"] input')).toHaveValue('orders@nile.example');
      expect(await places(browser)).toEqual(before);
    });
  });
}
