/**
 * Build fieldia.dev into dist/site: the docs pages from site/pages, the script
 * bundle the front page's live form runs on, the example pages, the framework
 * demos, and the designer's, to try on the site (all built first by
 * tools/build-demos.mjs).
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/site');
const DEMOS = join(WORKSPACE, 'dist/demos');
const BUNDLE = join(WORKSPACE, 'dist/libs/viewer/bundle/fieldia.js');
const PUBLIC_DEMOS = ['plain', 'react', 'vue', 'angular', 'script', 'embed', 'designer', 'screen', 'map-embed', 'backlog', 'save-safety', 'loading'];
/**
 * The pages under a strict Content-Security-Policy (demos/csp), as a static site can serve them: with no server to make
 * a nonce for every response and send the policy as a header, each page carries the policy as a meta tag, its nonce
 * written here once — the same for every visitor, as each page says.
 */
const STATIC_NONCE = 'ZmllbGRpYS5kZXYgc3RhdGlj';

if (!existsSync(BUNDLE)) throw new Error('the site needs the script bundle: run `npx nx build viewer` first');
for (const demo of [...PUBLIC_DEMOS, 'csp']) {
  if (!existsSync(join(DEMOS, demo, 'index.html'))) throw new Error(`the site needs the ${demo} demo: run \`node tools/build-demos.mjs\` first`);
}

const { layout } = await import(pathToFileURL(join(WORKSPACE, 'site/layout.mjs')).href);
const { strictPolicy } = await import(pathToFileURL(join(WORKSPACE, 'tools/csp-policy.mjs')).href);
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

for (const file of ['site.css', 'live.js', 'home.css', 'home.js', 'story.js', 'story.css', 'features.css', 'gallery.js', 'favicon.svg']) cpSync(join(WORKSPACE, 'site', file), join(OUT, file));
// The front page's map (site/hero-map.mjs), for its stage's map tab: @fieldia/map from source, drawing with the page's
// own fieldia.js — Fieldia's packages read from `window.Fieldia`, never a second copy — and Leaflet in a chunk of its
// own, loaded with the first map shown. home.js imports /hero/map.js the first time it needs it.
const pageFieldia = {
  name: 'page-fieldia',
  setup(builder) {
    builder.onResolve({ filter: /^@fieldia\/(core|widgets|viewer)$/ }, ({ path }) => ({ path, namespace: 'page-fieldia' }));
    builder.onLoad({ filter: /.*/, namespace: 'page-fieldia' }, () => ({ contents: 'module.exports = window.Fieldia;', loader: 'js' }));
  },
};
await build({
  entryPoints: { map: join(WORKSPACE, 'site/hero-map.mjs') },
  bundle: true,
  splitting: true,
  format: 'esm',
  minify: true,
  target: 'es2022',
  outdir: join(OUT, 'hero'),
  chunkNames: '[name]-[hash]',
  tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
  plugins: [pageFieldia],
  logLevel: 'warning',
});
// The feature pages' pictures, taken from the real demos (tools/feature-shots.mjs).
cpSync(join(WORKSPACE, 'site/img'), join(OUT, 'img'), { recursive: true });
cpSync(BUNDLE, join(OUT, 'fieldia.js'));
// Each language's add-on beside it: the live form fetches one when its language is picked. And each part (a list screen,
// a work item's head, its text, a path picker, a filter bar), which fieldia.js asks for from beside itself the first time
// a page uses it.
for (const file of readdirSync(dirname(BUNDLE)).filter((name) => /^fieldia\.[a-z]+\.js$/.test(name))) cpSync(join(dirname(BUNDLE), file), join(OUT, file));
cpSync(join(WORKSPACE, 'examples/pages'), join(OUT, 'examples'), { recursive: true });
// The template library's pages, each beside its gallery: /templates/<id>.page.json.
for (const file of readdirSync(join(WORKSPACE, 'examples/templates')).filter((f) => f.endsWith('.json'))) cpSync(join(WORKSPACE, 'examples/templates', file), join(OUT, 'templates', file));
// The demos' shell, every file of it as tools/build-demos.mjs made it: one added there is never missing here.
for (const file of readdirSync(DEMOS, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name)) cpSync(join(DEMOS, file), join(OUT, 'demos', file));
cpSync(join(DEMOS, 'thumbs'), join(OUT, 'demos/thumbs'), { recursive: true });
// The files a demo is tried with (an import's workbook and CSV file), which its how-to offers.
cpSync(join(DEMOS, 'samples'), join(OUT, 'demos/samples'), { recursive: true });
// The catalog imports the real pages' cards from here: without it the shell cannot load.
cpSync(join(DEMOS, 'real'), join(OUT, 'demos/real'), { recursive: true });
for (const demo of PUBLIC_DEMOS) cpSync(join(DEMOS, demo), join(OUT, 'demos', demo), { recursive: true });
cpSync(join(DEMOS, 'csp'), join(OUT, 'demos/csp'), { recursive: true });
for (const file of readdirSync(join(OUT, 'demos/csp')).filter((name) => name.endsWith('.html'))) {
  const path = join(OUT, 'demos/csp', file);
  const charset = '<meta charset="utf-8" />';
  const html = readFileSync(path, 'utf8');
  if (!html.includes(charset)) throw new Error(`demos/csp/${file} needs ${charset} first in its head, for the policy to follow it`);
  const policy = `<meta http-equiv="Content-Security-Policy" content="${strictPolicy(STATIC_NONCE, { meta: true })}" />`;
  writeFileSync(path, html.replaceAll('__CSP_NONCE__', STATIC_NONCE).replace(charset, `${charset}\n    ${policy}`));
}

console.log(`site: ${[...paths].join(' ')} → dist/site`);
