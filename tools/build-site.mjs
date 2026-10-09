/**
 * Build fieldia.dev into dist/site: the docs pages from site/pages, the script
 * bundle the front page's live form runs on, the example pages, the framework
 * demos, and the designer's, to try on the site (all built first by
 * tools/build-demos.mjs).
 */
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/site');
const DEMOS = join(WORKSPACE, 'dist/demos');
const BUNDLE = join(WORKSPACE, 'dist/libs/viewer/bundle/fieldia.js');
const PUBLIC_DEMOS = ['plain', 'react', 'vue', 'angular', 'script', 'designer', 'screen'];

if (!existsSync(BUNDLE)) throw new Error('the site needs the script bundle: run `npx nx build viewer` first');
for (const demo of PUBLIC_DEMOS) {
  if (!existsSync(join(DEMOS, demo, 'index.html'))) throw new Error(`the site needs the ${demo} demo: run \`node tools/build-demos.mjs\` first`);
}

const { layout } = await import(pathToFileURL(join(WORKSPACE, 'site/layout.mjs')).href);
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const pagesDir = join(WORKSPACE, 'site/pages');
const paths = new Set();
for (const file of readdirSync(pagesDir).filter((f) => f.endsWith('.mjs')).sort()) {
  const page = (await import(pathToFileURL(join(pagesDir, file)).href)).default;
  if (paths.has(page.path)) throw new Error(`two pages claim ${page.path}`);
  paths.add(page.path);
  const dir = join(OUT, page.path);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'index.html'), layout(page));
}
writeFileSync(
  join(OUT, '404.html'),
  layout({ path: '/404', title: 'Not found', description: 'This page does not exist.', body: '<section class="band"><h2>This page does not exist</h2><p><a href="/">Back to the start</a> or <a href="/start/">read the docs</a>.</p></section>' })
);

for (const file of ['site.css', 'live.js', 'home.css', 'home.js', 'features.css', 'favicon.svg']) cpSync(join(WORKSPACE, 'site', file), join(OUT, file));
// The feature pages' pictures, taken from the real demos (tools/feature-shots.mjs).
cpSync(join(WORKSPACE, 'site/img'), join(OUT, 'img'), { recursive: true });
cpSync(BUNDLE, join(OUT, 'fieldia.js'));
// Each language's add-on beside it: the live form fetches one when its language is picked.
for (const locale of ['ar', 'de', 'fr']) cpSync(BUNDLE.replace(/\.js$/, `.${locale}.js`), join(OUT, `fieldia.${locale}.js`));
cpSync(join(WORKSPACE, 'examples/pages'), join(OUT, 'examples'), { recursive: true });
// The template library's pages, each beside its gallery: /templates/<id>.page.json.
for (const file of readdirSync(join(WORKSPACE, 'examples/templates')).filter((f) => f.endsWith('.json'))) cpSync(join(WORKSPACE, 'examples/templates', file), join(OUT, 'templates', file));
for (const file of ['demo.css', 'shell.css', 'shell.mjs', 'catalog.mjs', 'templates.mjs', 'logo.svg']) cpSync(join(DEMOS, file), join(OUT, 'demos', file));
cpSync(join(DEMOS, 'thumbs'), join(OUT, 'demos/thumbs'), { recursive: true });
// The catalog imports the real pages' cards from here: without it the shell cannot load.
cpSync(join(DEMOS, 'real'), join(OUT, 'demos/real'), { recursive: true });
for (const demo of PUBLIC_DEMOS) cpSync(join(DEMOS, demo), join(OUT, 'demos', demo), { recursive: true });

console.log(`site: ${[...paths].join(' ')} → dist/site`);
