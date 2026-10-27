/**
 * An app's first load from the npm packages, as an adopter's bundler makes it and a browser fetches it, against a
 * budget: a record form, the same form in Arabic, a list, and the screen designer — each an app of a few lines that
 * imports the BUILT packages (dist/libs/*, what npm ships: their `.mjs` files through their `exports`), bundled by
 * esbuild as an app's Vite or esbuild build does (minified, split, ES modules), then opened in Chromium.
 *
 * Two numbers per app, both counts a runner cannot change:
 *   - with the page: the entry and every chunk it imports outright (the metafile's static imports) — what the browser
 *     must have before the app's own first line runs;
 *   - to usable: every script the browser fetched until the app said it was drawn and nothing more was asked for for a
 *     while — the parts and words the page itself asks for on top.
 * Each in files (requests) and KB gzipped (gzip level 9, file by file, as script-bundle.mjs counts).
 *
 *   node tools/npm-first-load.mjs              measure, print, fail on a budget passed
 *   node tools/npm-first-load.mjs --json f     and write the numbers to f
 *   node tools/npm-first-load.mjs --static     the bundles alone, no browser
 *
 * Needs the packages built (`npx nx run-many -t build -p core widgets viewer designer`) and, without --static,
 * Chromium for Playwright (`npx playwright install chromium`).
 */
import { build } from 'esbuild';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'tmp/npm-first-load');
const PACKAGES = ['core', 'widgets', 'viewer', 'designer'];
const args = process.argv.slice(2);
const staticOnly = args.includes('--static');
const jsonAt = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;

/**
 * KB gzipped with the page (`page`) and to usable (`usable`), and the scripts fetched to usable (`files`), for each app:
 * measured, then about 2% room (a few more files, as a bundler's chunks shift) — a budget set from what is measured
 * stops growth, where one raised to fit each release is a ratchet (the audit's L4).
 *
 * 0.34.1, before 0.35's perf-bytes (this gate run on that build): a record form 298.2 KB gzipped with the page (57
 * files), 374.0 to usable (64); in Arabic 298.2 / 374.1; a list 297.5 / 367.6 (61); the screen designer 832.2 (64) /
 * 942.5 (72). 0.35 — every language but the page's, the designer's Arabic and zod each in chunks of their own, and
 * the stylesheets minified as the one-tag script's are (tools/minified-styles.mjs): a record form 233.8 / 305.7 (64); in
 * Arabic 233.8 / 327.9 (67: its three words' chunks); a list 233.0 / 297.6 (61); the designer 577.8 (74) / 785.7 (83:
 * the format's schemas, asked for as it opens, beside its canvas's parts).
 * 0.35's merge, set once from the merged build: perf-lists' window in the list's part and its lines' in theirs, and
 * perf-form's quick way in every form and viewer (and the designer's drafts): a record form 237.5 / 310.3 (57 / 64); in
 * Arabic 237.5 / 332.5 (57 / 67); a list 236.7 / 305.2 (57 / 61); the designer 583.2 / 796.0 (74 / 83).
 * 0.36's checks (p3-promises; the coordinator's 26 Oct): the check before the draw as 0.35's, a refused page's words
 * where its form would be, what will change; the whole check — the format's schema read without zod, its rules, the
 * format each place came in, `stampPage` — a chunk of its own, asked for after the first draw (so "to usable" carries
 * it, never the first paint): a record form 240.0 / 330.2 (63 / 71); in Arabic 240.0 / 352.5 (63 / 74); a list
 * 239.2 / 324.9 (63 / 68); the designer 586.1 / 812.8 (76 / 86; its stamp at publish, from that chunk). Re-exported by
 * @fieldia/core's index, `stampPage` kept the whole check in every page's chunks (the designer's first paint 601.1):
 * it is `@fieldia/core/schema`'s.
 * 0.36 (p3-real-tests) merged with 0.35.2, measured: what every page now carries — a part that never came said, the box
 * under the keys never written over, a wait's words kept said (this lane), 0.35.1's and 0.35.2's own — a record form
 * 242.6 / 316.0 (57 / 64), in Arabic 242.6 / 338.4, a list 241.8 / 311.3 (57 / 61), the designer 588.8 / 803.0: the
 * pages over their room raised to what is measured, never more — a record's 242.7, a list's 241.9.
 * 0.36's merge, set once from the merged build, about 2% room as at 0.35's: the four lanes, 0.35.2's literal words and
 * its join, and the plain save that sends nothing — a record form 245.3 / 336.1 (63 / 71), in Arabic 245.3 / 358.7
 * (63 / 74), a list 244.5 / 332.3 (63 / 68), the designer 592.3 / 821.4 (76 / 86).
 */
const BUDGET = {
  record: { page: 250.3, usable: 342.9, files: 73 },
  'record-ar': { page: 250.3, usable: 365.9, files: 76 },
  list: { page: 249.4, usable: 339.0, files: 70 },
  designer: { page: 604.2, usable: 837.9, files: 90 },
};

/** A record of the customer page's, with the fields it shows. */
const CUSTOMER = { id: 1, name: 'Nile Trading', is_company: true, company_type: 'company', email: 'hello@nile.example', phone: '+20 2 2735 0000', street: '12 Tahrir St', city: 'Cairo' };
/** Every word the app's element is ever given, from before the viewer mounts: what its first paint said, flashes too. */
const WATCH = `
const seen = [];
new MutationObserver((changes) => { for (const change of changes) for (const node of change.addedNodes) if (node.textContent) seen.push(node.textContent); }).observe(document.getElementById('app'), { childList: true, subtree: true });
window.__seen = seen;
`;
const appRecord = (locale) => `${WATCH}
import { mountViewer } from '@fieldia/viewer';
import { createMemoryDataSource } from '@fieldia/core';
import page from ${JSON.stringify(join(WORKSPACE, 'examples/pages/customer.page.json'))};
const dataSource = createMemoryDataSource({ records: { partner: { 1: ${JSON.stringify(CUSTOMER)} } } });
const handle = mountViewer(document.getElementById('app'), { page, dataSource, recordId: 1${locale ? `, locale: ${JSON.stringify(locale)}` : ''} });
handle.drawn.then(() => (window.__drawn = true));
`;
const appList = () => `
import { mountViewer } from '@fieldia/viewer';
import { createMemoryDataSource } from '@fieldia/core';
import page from ${JSON.stringify(join(WORKSPACE, 'examples/pages/customers.page.json'))};
const partner = {};
for (let id = 1; id <= 25; id++) partner[id] = { id, name: 'Customer ' + id, email: 'c' + id + '@example.com', phone: '+20 10 0000 ' + String(1000 + id), state: id % 3 ? 'active' : 'draft' };
const handle = mountViewer(document.getElementById('app'), { page, dataSource: createMemoryDataSource({ records: { partner } }) });
handle.drawn.then(() => (window.__drawn = true));
`;
const appDesigner = () => `
import { createDesigner, mountScreenEditor } from '@fieldia/designer';
import page from ${JSON.stringify(join(WORKSPACE, 'examples/pages/customer.page.json'))};
const designer = createDesigner({ page });
mountScreenEditor(document.getElementById('app'), { designer });
const drawn = () => (document.querySelector('.fd-canvas-field') ? (window.__drawn = true) : requestAnimationFrame(drawn));
drawn();
`;
const APPS = {
  record: { code: appRecord(), ready: '.fd-field input' },
  // Its first paint in Arabic, never English's words first: its words' chunks come before it draws (`wordsReady`).
  'record-ar': { code: appRecord('ar'), ready: '.fd-field input', says: 'حفظ', never: /\bSave\b|Could not reach the server/ },
  list: { code: appList(), ready: '.fd-list tbody tr, .fd-list [role="row"]' },
  designer: { code: appDesigner(), ready: '.fd-canvas-field' },
};

for (const name of PACKAGES) {
  if (!existsSync(join(WORKSPACE, 'dist/libs', name, 'package.json'))) throw new Error(`@fieldia/${name} is not built: npx nx run-many -t build -p ${PACKAGES.join(' ')}`);
}
rmSync(OUT, { recursive: true, force: true });
// The packages as an app installs them: @fieldia/* in a node_modules of its own, their dependencies (zod, tslib) the
// workspace's, as npm would put them beside them.
const modules = join(OUT, 'node_modules');
mkdirSync(join(modules, '@fieldia'), { recursive: true });
for (const name of PACKAGES) symlinkSync(join(WORKSPACE, 'dist/libs', name), join(modules, '@fieldia', name), 'dir');

const kb = (bytes) => (bytes / 1024).toFixed(1);
const gz = (path) => gzipSync(readFileSync(path), { level: 9 }).length;

/** One app bundled; what loads with its page, by the metafile's static imports. */
async function bundle(name, code) {
  const dir = join(OUT, name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'app.js'), code);
  writeFileSync(join(dir, 'index.html'), `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${name}</title></head><body><div id="app"></div><script type="module" src="./out/app.js"></script></body></html>`);
  const result = await build({
    entryPoints: { app: join(dir, 'app.js') },
    absWorkingDir: dir,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    target: 'es2022',
    platform: 'browser',
    outdir: join(dir, 'out'),
    nodePaths: [modules, join(WORKSPACE, 'node_modules')],
    loader: { '.json': 'json' },
    logLevel: 'warning',
    metafile: true,
  });
  const outputs = result.metafile.outputs;
  const withPage = new Set();
  const reach = (path) => {
    if (withPage.has(path)) return;
    withPage.add(path);
    for (const used of outputs[path]?.imports ?? []) if (used.kind === 'import-statement') reach(used.path);
  };
  reach(Object.keys(outputs).find((path) => path.endsWith('/app.js')));
  const files = [...withPage].filter((path) => path.endsWith('.js'));
  const all = Object.keys(outputs).filter((path) => path.endsWith('.js'));
  return {
    dir,
    metafile: result.metafile,
    page: { files: files.length, gzip: files.reduce((sum, path) => sum + gz(join(dir, path.slice(path.indexOf('out/')))), 0) },
    every: { files: all.length, gzip: all.reduce((sum, path) => sum + gz(join(dir, path.slice(path.indexOf('out/')))), 0) },
    inputs: result.metafile.inputs,
  };
}

/** A static server over the apps, on a port the system picks. */
function serve() {
  const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.css': 'text/css' };
  const server = createServer((request, response) => {
    const path = join(OUT, decodeURIComponent(new URL(request.url, 'http://x').pathname));
    if (!path.startsWith(OUT) || !existsSync(path)) return response.writeHead(404).end();
    response.writeHead(200, { 'content-type': types[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(readFileSync(path));
  });
  return new Promise((done) => server.listen(0, '127.0.0.1', () => done(server)));
}

/** Every script the browser fetched until the app was drawn and nothing more came for 600 ms. */
async function usable(browser, port, name) {
  const page = await browser.newPage();
  const fetched = new Set();
  let last = Date.now();
  page.on('request', (request) => {
    last = Date.now();
    const url = new URL(request.url());
    if (url.pathname.endsWith('.js')) fetched.add(url.pathname);
  });
  page.on('pageerror', (error) => console.error(`${name}: ${error.message}`));
  await page.goto(`http://127.0.0.1:${port}/${name}/index.html`);
  await page.waitForFunction(() => globalThis.__drawn === true, null, { timeout: 60_000 });
  await page.waitForSelector(APPS[name].ready, { timeout: 60_000 });
  while (Date.now() - last < 600) await page.waitForTimeout(100);
  const words = await page.evaluate(() => (globalThis.__seen ?? []).join('\n'));
  await page.close();
  const files = [...fetched];
  return { files: files.length, gzip: files.reduce((sum, path) => sum + gz(join(OUT, path)), 0), words, scripts: files.map((path) => path.split('/').pop()) };
}

const results = {};
for (const [name, app] of Object.entries(APPS)) results[name] = await bundle(name, app.code);

if (!staticOnly) {
  const { chromium } = await import('playwright-core');
  const server = await serve();
  const browser = await chromium.launch();
  try {
    for (const name of Object.keys(APPS)) results[name].usable = await usable(browser, server.address().port, name);
  } finally {
    await browser.close();
    server.close();
  }
}

const failures = [];
const report = {};
for (const [name, result] of Object.entries(results)) {
  const budget = BUDGET[name];
  const line = [`${name}: with the page ${kb(result.page.gzip)} KB gz in ${result.page.files} files`];
  if (result.usable) line.push(`to usable ${kb(result.usable.gzip)} KB gz in ${result.usable.files} files`);
  line.push(`every chunk ${kb(result.every.gzip)} KB gz in ${result.every.files}`);
  console.log(line.join(' · '));
  report[name] = { page: result.page, usable: result.usable && { files: result.usable.files, gzip: result.usable.gzip, scripts: result.usable.scripts }, every: result.every };
  if (budget.page && result.page.gzip > budget.page * 1024) failures.push(`${name}: ${kb(result.page.gzip)} KB gzipped with the page, over its ${budget.page} KB budget`);
  if (budget.usable && result.usable && result.usable.gzip > budget.usable * 1024) failures.push(`${name}: ${kb(result.usable.gzip)} KB gzipped to usable, over its ${budget.usable} KB budget`);
  if (budget.files && result.usable && result.usable.files > budget.files) failures.push(`${name}: ${result.usable.files} scripts fetched to usable, over its ${budget.files}`);
  const { says, never } = APPS[name];
  if (result.usable && says && !result.usable.words.includes(says)) failures.push(`${name}: its first paint does not say "${says}"`);
  if (result.usable && never?.test(result.usable.words)) failures.push(`${name}: its page showed "${never.exec(result.usable.words)[0]}" before its own language's words`);
}
if (jsonAt) {
  mkdirSync(dirname(resolve(jsonAt)), { recursive: true });
  writeFileSync(jsonAt, JSON.stringify(report, null, 2));
}
if (failures.length) {
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
