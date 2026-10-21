/**
 * Build the demos into dist/demos, straight from source (tsconfig paths), so
 * a demo always shows the code in this checkout. Each framework variant mounts
 * the same example pages; the browser gates in e2e/ drive all of them.
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/demos');
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['plain', 'react', 'vue', 'angular', 'designer', 'screen', 'designer-react', 'designer-vue', 'designer-angular', 'script', 'map-embed', 'backlog', 'save-safety'];

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
  const split = variant === 'plain' || variant === 'backlog';
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
  // A demo with a stylesheet of its own beside its page (the backlog's chrome): copied with it.
  for (const file of readdirSync(join(WORKSPACE, 'demos', variant))) if (file.endsWith('.css')) cpSync(join(WORKSPACE, 'demos', variant, file), join(OUT, variant, file));
  console.log(`demo ${variant}: ${join('dist/demos', variant)}`);
}
