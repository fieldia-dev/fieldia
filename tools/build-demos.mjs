/**
 * Build the demos into dist/demos, straight from source (tsconfig paths), so
 * a demo always shows the code in this checkout. Each framework variant mounts
 * the same example pages; the browser gates in e2e/ drive all of them.
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { openTag, readReleased } from './script-tags.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/demos');
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['plain', 'react', 'vue', 'angular', 'designer', 'screen', 'designer-react', 'designer-vue', 'designer-angular', 'script', 'embed', 'map-embed', 'backlog', 'save-safety', 'loading', 'csp', 'ssr'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
// The frame every demo shares, and the list of demos it shows.
// Every file of it at the top of demos/: one added there is never left behind.
for (const entry of readdirSync(join(WORKSPACE, 'demos'), { withFileTypes: true })) if (entry.isFile()) cpSync(join(WORKSPACE, 'demos', entry.name), join(OUT, entry.name));
// The catalog's real pages, one file per lane, beside it: the shell reads the catalog in the browser.
cpSync(join(WORKSPACE, 'demos/real'), join(OUT, 'real'), { recursive: true, filter: (from) => !/(gaps|README\.md)$/.test(from) });
cpSync(join(WORKSPACE, 'site/favicon.svg'), join(OUT, 'logo.svg'));
cpSync(join(WORKSPACE, 'demos/thumbs'), join(OUT, 'thumbs'), { recursive: true });
// Files a demo is tried with (an import's workbook and CSV file), offered from its how-to.
cpSync(join(WORKSPACE, 'demos/samples'), join(OUT, 'samples'), { recursive: true });

const SCRIPT_BUNDLE = join(WORKSPACE, 'dist/libs/viewer/bundle/fieldia.js');

for (const variant of variants) {
  if (variant === 'script') {
    // No build step on purpose: the page as written, beside the viewer's script bundle.
    if (!existsSync(SCRIPT_BUNDLE)) throw new Error('demos/script needs the script bundle: run `npx nx build viewer` first');
    cpSync(join(WORKSPACE, 'demos/script'), join(OUT, 'script'), { recursive: true });
    cpSync(SCRIPT_BUNDLE, join(OUT, 'script/fieldia.js'));
    // And each language's add-on beside it, for the demo in Arabic, German or French (?locale=ar); and each part, which
    // fieldia.js asks for from beside itself the first time a page uses it (a work item's head, its text, a path picker).
    for (const file of readdirSync(dirname(SCRIPT_BUNDLE)).filter((name) => /^fieldia\.[a-z]+\.js$/.test(name))) cpSync(join(dirname(SCRIPT_BUNDLE), file), join(OUT, 'script', file));
    console.log(`demo script: ${join('dist/demos', 'script')}`);
    continue;
  }
  if (variant === 'embed') {
    // A form on another site, no build step either: a partner's page with <fieldia-form> on it, or the embed script's
    // frame of the app's own form page (form.html) — each beside the script bundle, its parts, fieldia-embed.js and the
    // enquiry's page.
    if (!existsSync(SCRIPT_BUNDLE)) throw new Error('demos/embed needs the script bundle: run `npx nx build viewer` first');
    cpSync(join(WORKSPACE, 'demos/embed'), join(OUT, 'embed'), { recursive: true });
    for (const file of readdirSync(dirname(SCRIPT_BUNDLE)).filter((name) => /^fieldia(\.[a-z]+|-embed)?\.js$/.test(name))) cpSync(join(dirname(SCRIPT_BUNDLE), file), join(OUT, 'embed', file));
    cpSync(join(WORKSPACE, 'examples/pages/unit-enquiry.page.json'), join(OUT, 'embed/unit-enquiry.page.json'));
    // The tags it shows a partner to paste, as fieldia.dev prints them: the release on npm, each with its integrity
    // (tools/script-tags.mjs), written into the page's script strings — never typed in the demo.
    const index = join(OUT, 'embed/index.html');
    const released = readReleased(WORKSPACE);
    const shown = readFileSync(index, 'utf8').replace(/__FIELDIA_TAG:([\w.-]+)__/g, (_, file) => JSON.stringify(openTag(file, released)).slice(1, -1));
    if (!/integrity=/.test(shown) || /__FIELDIA_TAG/.test(shown)) throw new Error('demos/embed shows a script tag not written from the release (tools/script-tags.mjs)');
    writeFileSync(index, shown);
    console.log(`demo embed: ${join('dist/demos', 'embed')}`);
    continue;
  }
  const entry = ['main.ts', 'main.tsx'].map((file) => join(WORKSPACE, 'demos', variant, file)).find(existsSync);
  if (!entry) throw new Error(`demos/${variant} has no main.ts or main.tsx`);
  // A demo may use its own tsconfig — the Angular one consumes the BUILT
  // @fieldia/angular package, so the gates exercise what would be published.
  const ownConfig = join(WORKSPACE, 'demos', variant, 'tsconfig.json');
  if (variant === 'angular' && !existsSync(join(WORKSPACE, 'dist/libs/angular/src/index.js'))) {
    throw new Error('demos/angular needs the built package: run `npx nx build angular` first');
  }
  if (variant === 'designer-angular' && !existsSync(join(WORKSPACE, 'dist/libs/designer/angular/index.mjs'))) {
    throw new Error('demos/designer-angular needs the built designer: run `npx nx build designer` first');
  }
  // The plain demo is ES modules, split as an app's bundler splits them: the code editors' grammars and
  // VS Code's editor are files of their own (chunks/), loaded only by a page that shows them. Monaco's CSS
  // is written beside it, as main.css, which its page links. The backlog too: the work item's parts — its head, its
  // text, its path pickers, the list's filter bar — are chunks the page asks for the first time it draws one.
  // The pages under a strict Content-Security-Policy too (csp): its chunks and parts come by import(), under the nonce.
  const split = variant === 'plain' || variant === 'backlog' || variant === 'csp';
  await build({
    entryPoints: [entry],
    jsx: 'automatic',
    bundle: true,
    format: split ? 'esm' : 'iife',
    target: 'es2022',
    sourcemap: true,
    ...(split ? { splitting: true, outdir: join(OUT, variant), entryNames: '[name]', chunkNames: 'chunks/[name]-[hash]', assetNames: 'chunks/[name]-[hash]', loader: { '.ttf': 'file' } } : { outfile: join(OUT, variant, 'main.js') }),
    tsconfig: existsSync(ownConfig) ? ownConfig : join(WORKSPACE, 'tsconfig.base.json'),
    logLevel: 'warning',
    // The decode part's readers of codes alone, as the one-tag script carries them (tools/zxing-readers.mjs): the
    // library's index would bring every reader it has, about three times the code, to a phone that presses Scan.
    plugins: [{ name: 'zxing-readers', setup: (builder) => builder.onResolve({ filter: /^@zxing\/library$/ }, () => ({ path: join(WORKSPACE, 'tools/zxing-readers.mjs') })) }],
    define: {
      'process.env.NODE_ENV': '"production"',
      // Vue's bundler build reads these compile-time flags.
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  });
  if (variant === 'plain') {
    // Monaco's workers, for the code page with ?workers=1: the editor's own and JSON's, each a module.
    const monaco = join(WORKSPACE, 'node_modules/monaco-editor/esm/vs');
    await build({
      entryPoints: { 'editor.worker': join(monaco, 'editor/editor.worker.js'), 'json.worker': join(monaco, 'languages/features/json/json.worker.js') },
      bundle: true,
      format: 'esm',
      target: 'es2022',
      outdir: join(OUT, variant, 'workers'),
      logLevel: 'warning',
    });
  }
  cpSync(join(WORKSPACE, 'demos', variant, 'index.html'), join(OUT, variant, 'index.html'));
  if (variant === 'ssr') {
    // What a site's server sends: the page with the form's first paint in it, drawn in Node from @fieldia/viewer/server,
    // as Next or Nuxt would draw it for each request; main.js then mounts over it.
    // Split, as the packages are files of their own: one file would put off a module's start past its first use.
    const server = join(WORKSPACE, 'tmp/demos-ssr/server.mjs');
    await build({ entryPoints: [join(WORKSPACE, 'demos/ssr/server.ts')], bundle: true, splitting: true, platform: 'node', format: 'esm', target: 'node20', outdir: dirname(server), outExtension: { '.js': '.mjs' }, tsconfig: join(WORKSPACE, 'tsconfig.base.json'), logLevel: 'warning' });
    const { render } = await import(pathToFileURL(server).href);
    const html = readFileSync(join(WORKSPACE, 'demos/ssr/index.html'), 'utf8');
    writeFileSync(join(OUT, variant, 'index.html'), html.replace('<!--FIRST_PAINT-->', render()));
    rmSync(dirname(server), { recursive: true, force: true });
  }
  // A demo with a stylesheet of its own beside its page (the backlog's chrome), other pages (csp's one-tag page), or a
  // service worker (the viewing report's, plain's offline-sw.js): copied with it.
  for (const file of readdirSync(join(WORKSPACE, 'demos', variant))) if (file.endsWith('.css') || file.endsWith('-sw.js') || (file.endsWith('.html') && file !== 'index.html')) cpSync(join(WORKSPACE, 'demos', variant, file), join(OUT, variant, file));
  console.log(`demo ${variant}: ${join('dist/demos', variant)}`);
}
