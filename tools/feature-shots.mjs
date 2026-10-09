/**
 * Take the feature pages' pictures from the real demos, each opened as the
 * site embeds it (`embed=1`: the demo alone, no frame), and kept in site/img.
 *
 *   node tools/build-demos.mjs && node tools/build-site.mjs && node tools/feature-shots.mjs [forms lists …]
 *
 * Take them again after a demo changes how it looks.
 */
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const PORT = 4398;
const OUT = join(WORKSPACE, 'site/img');

/** Each picture: its file, the demo, the screen's width, and what to do before taking it. */
const SHOTS = [
  { file: 'records/sheet-head.png', query: 'page=customer&skin=underline', width: 1280, height: 560 },
  { file: 'records/grid.png', query: 'page=order&skin=underline', width: 1280, node: '[data-node="f-lines"]', before: async (page) => {
      const qty = page.locator('[data-node="f-lines"] .ag-row[row-index="1"] .ag-cell[col-id="qty"]').first();
      await qty.click();
    } },
  { file: 'records/tabs.png', query: 'page=real-legal-case&record=42&skin=underline', width: 1280, height: 760 },
  { file: 'records/chatter.png', query: 'page=customer&skin=underline', width: 1600, node: '.fd-sheet-layout > .fd-side' },
  // The PDF viewer paints its page a moment after the frame loads.
  { file: 'records/pdf.png', query: 'page=vendor-bill&skin=underline', width: 1440, height: 820, settle: 3000, scale: 1 },

  // ---- forms and surveys ----
  { file: 'forms/fields.png', query: 'page=fields&skin=outlined', width: 1280, height: 860, top: '.fd-page-head' },
  { file: 'forms/steps.png', query: 'page=survey&skin=outlined', width: 1000, height: 700, before: async (page) => {
      await page.locator('[data-node="q-name"] input').fill('Lina Haddad');
      await page.getByRole('button', { name: 'Next' }).click();
      await page.locator('[data-node="q-uses"]').getByLabel('Yes').check();
      await page.getByRole('button', { name: 'Next' }).click();
      await page.waitForTimeout(400);
    } },
  { file: 'forms/checks.png', query: 'page=signup&skin=outlined', width: 1000, height: 1000, before: async (page) => {
      await page.locator('[data-node="f-email"] input').fill('lina@');
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(300);
    } },
  { file: 'forms/google.png', query: 'page=template-customer-feedback&theme=google-forms', width: 1000, height: 720 },

  // ---- rules and actions ----
  { file: 'rules/shows.png', query: 'page=signup&skin=outlined', width: 1000, height: 520, before: async (page) => {
      await page.locator('[data-node="f-role"] select').selectOption({ label: 'Something else' });
      await page.locator('[data-node="f-other-role"] input').focus();
    } },
  { file: 'rules/totals.png', query: 'page=rules&skin=outlined', width: 1000, height: 720, before: async (page) => {
      const lines = page.locator('[data-node="f-lines"] tbody tr[data-line]');
      await page.locator('[data-node="f-lines"]').getByRole('button', { name: /Add a line/ }).click();
      const chair = lines.nth(1);
      await chair.getByLabel('Item', { exact: true }).pressSequentially('Desk chair');
      await chair.getByLabel('Quantity', { exact: true }).pressSequentially('1');
      await chair.getByLabel('Unit price', { exact: true }).pressSequentially('1890');
      await page.locator('[data-node="f-email"] input').pressSequentially('sara@gmail.com');
      await page.locator('[data-node="f-email"] input').press('Tab');
      await page.waitForTimeout(300);
    } },
  { file: 'rules/panel.png', query: 'page=quick-order&skin=outlined', width: 1280, height: 720, before: async (page) => {
      await page.locator('[data-node="f-caller"] input').fill('Nadia Farouk');
      await page.getByRole('button', { name: 'New customer' }).click();
      await page.getByRole('dialog', { name: 'New customer' }).waitFor();
      await page.waitForTimeout(700);
    } },
  { file: 'rules/ask.png', query: 'page=quick-order&skin=outlined', width: 1000, height: 640, before: async (page) => {
      await page.locator('[data-node="f-customer"] input').pressSequentially('Nile');
      await page.getByRole('option', { name: 'Nile Traders' }).click();
      await page.locator('[data-node="f-product"] input').pressSequentially('chair');
      await page.getByRole('option', { name: 'Office chair, ergonomic' }).click();
      await page.waitForTimeout(700);
      await page.getByRole('button', { name: 'Submit' }).click();
      await page.getByRole('alertdialog').waitFor();
      await page.waitForTimeout(300);
    } },

  // ---- lists and search ----
  { file: 'lists/suggest.png', query: 'page=customers&skin=underline', width: 1280, height: 560, before: async (page) => {
      await page.getByRole('combobox', { name: 'Search' }).pressSequentially('egy');
      await page.getByRole('listbox', { name: 'Search' }).waitFor();
      await page.waitForTimeout(300);
    } },
  { file: 'lists/group.png', query: 'page=customers&skin=underline', width: 1280, height: 720, before: async (page) => {
      await page.getByRole('button', { name: 'Search options' }).click();
      await page.locator('.fd-search-panel [data-group-kind="groupBy"]').getByRole('button', { name: 'Country' }).click();
      await page.keyboard.press('Escape');
      await page.locator('.fd-group-toggle').first().click();
      await page.waitForTimeout(500);
    } },
  { file: 'lists/chosen.png', query: 'page=customers&skin=underline', width: 1280, height: 600, before: async (page) => {
      await page.getByRole('checkbox', { name: 'Select Delta Foods' }).check();
      await page.getByRole('checkbox', { name: 'Select Giza Plaza' }).check();
      await page.waitForTimeout(300);
    } },
  { file: 'lists/arabic.png', query: 'page=customers&skin=underline&locale=ar&dir=rtl', width: 1280, height: 600 },

  // ---- looks and languages ----
  // The gallery's first two rows: four themes.
  { file: 'looks/themes.png', site: '/look/', node: '.theme-grid', width: 1280, height: 900, maxHeight: 940 },
  { file: 'looks/dark.png', query: 'page=customer&skin=underline&scheme=dark', width: 1280, height: 640 },
  { file: 'looks/arabic.png', query: 'page=customer&skin=underline&locale=ar&dir=rtl', width: 1280, height: 640 },
  // The app's catalog has the first group's words: that group, in French.
  { file: 'looks/french.png', query: 'page=signup&skin=outlined&translate=fr', width: 1000, node: '.fd-sections > .fd-section' },

  // ---- your backend ----
  { file: 'backend/onchange.png', query: 'page=real-sale-order&record=7101&skin=underline', width: 1280, height: 560, before: async (page) => {
      const customer = page.locator('[data-node="#f-partner"], [data-field="partner_id"]').first().locator('input').first();
      await customer.click();
      await customer.fill('');
      await customer.pressSequentially('Delta Care');
      await page.getByRole('option', { name: /Delta Care Clinics/ }).first().click();
      await page.waitForTimeout(1200);
    } },
  { file: 'backend/refused.png', query: 'page=customer&skin=underline', width: 1280, height: 600, before: async (page) => {
      await page.evaluate(() => {
        const source = window.fieldiaDemo.dataSource;
        source.save = async () => {
          throw Object.assign(new Error('Check the email'), { problem: { kind: 'fields', message: 'Check the email', fields: { email: 'This email is already a customer’s' } } });
        };
      });
      await page.locator('[data-node="f-phone"] input').fill('+20 2 1111 2222');
      await page.getByRole('button', { name: 'Save', exact: true }).click();
      await page.waitForTimeout(500);
    } },
];

const server = spawn('node', [join(WORKSPACE, 'tools/serve.mjs'), join(WORKSPACE, 'dist/demos'), String(PORT)], { stdio: 'ignore' });
// The site, for a picture of one of its own pages (build it first: node tools/build-site.mjs).
const site = spawn('node', [join(WORKSPACE, 'tools/serve.mjs'), join(WORKSPACE, 'dist/site'), String(PORT + 1)], { stdio: 'ignore' });
// The ones named, when some are: `node tools/feature-shots.mjs lists` takes only lists/*.
const only = process.argv.slice(2);
try {
  await new Promise((done) => setTimeout(done, 600));
  // The newer headless mode: it draws a PDF in its frame, as a person's browser does.
  const browser = await chromium.launch({ channel: 'chromium' });
  for (const shot of SHOTS.filter((s) => !only.length || only.some((o) => s.file.startsWith(o)))) {
    mkdirSync(join(OUT, shot.file, '..'), { recursive: true });
    // Sharp at 1.5; the PDF viewer zooms its page by the screen's density, so those shots are at 1.
    const page = await browser.newPage({ viewport: { width: shot.width, height: shot.height ?? 900 }, deviceScaleFactor: shot.scale ?? 1.5 });
    await page.goto(shot.site ? `http://127.0.0.1:${PORT + 1}${shot.site}` : `http://127.0.0.1:${PORT}/plain/?${shot.query}&embed=1`);
    await page.locator('.fd-form').first().waitFor();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(shot.settle ?? 500);
    // No spell-check underline under a name or an address: the browser's, not Fieldia's.
    await page.evaluate(() => document.documentElement.setAttribute('spellcheck', 'false'));
    if (shot.before) await shot.before(page);
    // The picture starts at this part, the page scrolled to it.
    if (shot.top) await page.evaluate((sel) => window.scrollTo(0, document.querySelector(sel).getBoundingClientRect().top + window.scrollY - 16), shot.top);
    const path = join(OUT, shot.file);
    if (shot.node && shot.maxHeight) {
      const box = await page.locator(shot.node).first().evaluate((el) => {
        el.scrollIntoView();
        const r = el.getBoundingClientRect();
        return { x: r.left, y: r.top + window.scrollY, width: r.width };
      });
      await page.screenshot({ path, animations: 'disabled', fullPage: true, clip: { ...box, height: shot.maxHeight } });
    } else if (shot.node) await page.locator(shot.node).first().screenshot({ path, animations: 'disabled' });
    else await page.screenshot({ path, animations: 'disabled' });
    console.log(`shot ${shot.file}`);
    await page.close();
  }
  await browser.close();
} finally {
  server.kill();
  site.kill();
}
