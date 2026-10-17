import { type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from './fixtures';
import { screen } from './support';

/**
 * A part's own words, from one <script> tag: fieldia.js carries none of the English words only a part reads
 * (tools/part-words.mjs) — each part brings its own and puts them in the tables as it comes. An Arabic page (its add-on
 * in before the parts, or after them) opening a list's screen, its Import, its Print, possible duplicates and Merge,
 * and booking slots shows none of Fieldia's English and no key's name; an English page mounted at once shows each
 * part's words, never a key's name or "undefined".
 */

const pageOf = (name: string) => JSON.parse(readFileSync(join(__dirname, '..', 'examples', 'pages', `${name}.page.json`), 'utf8'));
const CONTACTS = pageOf('contacts');
const CARD = pageOf('customer-card');
const DRIVE = pageOf('test-drive');
const RECORDS = {
  'crm.contact': {
    1: { name: 'Nile Traders', company: 'Nile Traders', state: 'customer', phone: '+201012345678', email: 'orders@nile.example', lifetime_value: 120000 },
    2: { name: 'Amira Clinics', company: 'Amira', state: 'lead', phone: '+201112345678', email: 'hello@amira.example', lifetime_value: 5000 },
  },
  partner: {
    1: { name: 'Nile Traders', email: 'orders@niletraders.example', phone: '+20223456789' },
    2: { name: 'Nile Trading House', email: 'orders@niletraders.example' },
  },
};

function watch(page: Page) {
  const problems: string[] = [];
  page.on('console', (message) => message.type() === 'error' && problems.push(`console: ${message.text()}`));
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  return problems;
}

/** The script demo's page replaced by `shown`, in `locale`, with the records above (and `more` of the source's). */
const mount = (page: Page, shown: unknown, locale: string, more: { recordId?: number; duplicates?: boolean; slots?: boolean } = {}) =>
  page.evaluate(
    ([shown, locale, records, more]) => {
      const fieldia = (window as any).Fieldia;
      const demo = (window as any).fieldiaDemo;
      demo.handle.destroy();
      const duplicates = more.duplicates ? (request: { values: Record<string, unknown> }) => Promise.resolve({ matches: request.values['email'] ? [{ id: 1, name: 'Nile Traders', why: ['email'] }] : [] }) : undefined;
      const today = new Date().toISOString().slice(0, 10);
      const slots = more.slots ? (request: { from: string }) => Promise.resolve({ days: { [request.from]: { state: 'open', free: [] }, [today]: { state: 'open', free: [{ start: `${today}T10:00:00Z`, end: `${today}T10:30:00Z` }] } } }) : undefined;
      const dataSource = fieldia.createMemoryDataSource({ records, ...(duplicates ? { duplicates } : {}), ...(slots ? { slots } : {}) });
      demo.dataSource = dataSource;
      demo.handle = fieldia.mountViewer(document.getElementById('app'), { page: shown, dataSource, locale, skin: 'outlined', ...(more.recordId ? { recordId: more.recordId } : {}) });
    },
    [shown, locale, RECORDS, more] as const,
  );

/**
 * What a page shows of Fieldia's English, in `locale`: each word of its tables that language says otherwise — in
 * pieces of three letters or more, its {names} aside, none the page's own or its records' — found in its words, its
 * names and tips (the demo's own head aside); every key's name of two words (camelCase) found there; and "undefined".
 */
const leaks = (page: Page, locale: string, own: unknown) =>
  page.evaluate(
    ([locale, own]) => {
      const fieldia = (window as any).Fieldia;
      const ownText = JSON.stringify(own);
      const pieces = new Set<string>();
      const keys = new Set<string>();
      for (const tables of [fieldia.MESSAGES, fieldia.WIDGET_LABELS, fieldia.VIEWER_LABELS]) {
        for (const [key, text] of Object.entries(tables.en as Record<string, string>)) {
          if (/[a-z][A-Z]/.test(key)) keys.add(key);
          if (locale !== 'en' && tables[locale]?.[key] === text) continue;
          for (const piece of text.split(/\{\w+\}/)) if (/[A-Za-z]{3}/.test(piece.trim()) && !ownText.includes(piece.trim())) pieces.add(piece.trim());
        }
      }
      // Fieldia's own: the page and what it puts in the body (its dialogs, a printout), never the demo's head.
      const fieldias = [...document.body.children].filter((one) => one.id !== 'demo-head' && one.tagName !== 'SCRIPT') as HTMLElement[];
      const names = ['aria-label', 'title', 'placeholder', 'alt'];
      const tips = fieldias.flatMap((root) => [root, ...root.querySelectorAll(names.map((name) => `[${name}]`).join(','))]).flatMap((one) => names.map((name) => one.getAttribute(name) ?? ''));
      const shown = [...fieldias.map((root) => root.innerText), ...tips].join('\n');
      const said = (piece: string) => new RegExp(`(^|[^A-Za-z])${piece.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^A-Za-z])`).test(shown);
      return { english: locale === 'en' ? [] : [...pieces].filter(said), keys: [...keys].filter(said), undefined: /\bundefined\b/.test(shown) };
    },
    [locale, own] as const,
  );

const none = { english: [], keys: [], undefined: false };
const parts = (page: Page) => page.evaluate(() => Object.keys((window as any).Fieldia).filter((name) => /Part$/.test(name) && (window as any).Fieldia[name]?.loaded).sort());

/** A list's screen, its Import, its Print, a customer's possible duplicates and their merge, and booking slots — each looked at. */
async function walk(page: Page, locale: string) {
  const own = [CONTACTS, CARD, DRIVE, RECORDS];
  await mount(page, CONTACTS, locale);
  const rows = page.locator('#app .fd-list-table tbody tr.fd-list-row');
  await expect(rows).toHaveCount(2);
  expect(await leaks(page, locale, own)).toEqual(none);
  // Its menu of searches, filters and favourites open.
  await page.locator('#app .fd-search-toggle').click();
  await expect(page.locator('#app .fd-search-panel')).toBeVisible();
  expect(await leaks(page, locale, own)).toEqual(none);
  await page.keyboard.press('Escape');
  // Import: its part comes as it is pressed, its dialog in this language.
  await page.locator('#app .fd-list-import-button').click();
  await expect(page.locator('.fd-import .fd-import-drop')).toBeVisible();
  expect(await leaks(page, locale, own)).toEqual(none);
  await screen(page, `part-words-${locale}-import`, { viewport: true });
  await page.locator('.fd-import .fd-dialog-close').click();
  await expect(page.locator('.fd-import')).toHaveCount(0);
  // Print: the printout of every contact, laid out for paper.
  await page.evaluate(() => (window.print = () => void window.dispatchEvent(new Event('beforeprint'))));
  await page.locator('#app .fd-list-print-button').click();
  const sheet = page.locator('.fd-print-sheet');
  await expect(sheet).toHaveCount(1);
  await page.emulateMedia({ media: 'print' });
  await expect(sheet).toBeVisible();
  expect(await leaks(page, locale, own)).toEqual(none);
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await expect(sheet).toHaveCount(0);
  // A customer like one kept: said under its email, and Merge's screen.
  await mount(page, CARD, locale, { recordId: 2, duplicates: true });
  const note = page.locator('#app .fd-duplicates').first();
  await expect(note).toBeVisible();
  expect(await leaks(page, locale, own)).toEqual(none);
  await note.locator('.fd-duplicate-merge').click();
  await expect(page.locator('.fd-merge-table')).toBeVisible();
  expect(await leaks(page, locale, own)).toEqual(none);
  await screen(page, `part-words-${locale}-merge`, { viewport: true });
  await page.keyboard.press('Escape');
  // A test drive's slots.
  await mount(page, DRIVE, locale, { slots: true });
  await expect(page.locator('#app .fd-slots .fd-slots-days')).toBeVisible();
  expect(await leaks(page, locale, own)).toEqual(none);
  await screen(page, `part-words-${locale}-slots`);
  expect(await parts(page)).toEqual(expect.arrayContaining(['duplicatesPart', 'importPart', 'listPart', 'slotsPart']));
}

test.describe('a part’s own words, from one <script> tag', () => {
  test('an Arabic page, its add-on in first: a list, Import, Print, duplicates and Merge, slots — none of Fieldia’s English, no key’s name', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/script/?locale=ar');
    await expect(page.locator('.fd-form')).toHaveAttribute('dir', 'rtl');
    // The main script carries none of the parts' own words; the add-on all of them.
    expect(await page.evaluate(() => [(window as any).Fieldia.VIEWER_LABELS.en.importTitle, typeof (window as any).Fieldia.VIEWER_LABELS.ar.importTitle])).toEqual([undefined, 'string']);
    await walk(page, 'ar');
    expect(problems).toEqual([]);
  });

  test('an Arabic page whose parts came first, in English, its add-on after them: Arabic still', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    // Every part the walk needs, in, while the page is English.
    await walk(page, 'en');
    expect(await page.evaluate(() => (window as any).Fieldia.VIEWER_LABELS.en.importTitle)).toBe('Import into {title}');
    // Then Arabic's script, and the same walk in Arabic.
    await page.evaluate(
      () =>
        new Promise<void>((done, failed) => {
          const tag = document.createElement('script');
          tag.src = 'fieldia.ar.js';
          tag.onload = () => done();
          tag.onerror = () => failed(new Error('fieldia.ar.js did not load'));
          document.head.append(tag);
        }),
    );
    await walk(page, 'ar');
    expect(problems).toEqual([]);
  });

  test('an English page mounted at once, its parts not yet in: each part’s words as they are drawn, never a key’s name or undefined', async ({ page }) => {
    const problems = watch(page);
    await page.goto('/script/');
    await expect(page.locator('.fd-form')).toBeVisible();
    expect(await page.evaluate(() => 'nextPage' in (window as any).Fieldia.VIEWER_LABELS.en)).toBe(false);
    await walk(page, 'en');
    await expect(page.locator('#app .fd-slots')).toBeVisible();
    expect(problems).toEqual([]);
  });
});
