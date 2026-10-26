/**
 * Build the demos into dist/demos, straight from source (tsconfig paths), so
 * a demo always shows the code in this checkout. Each framework variant mounts
 * the same example pages; the browser gates in e2e/ drive all of them.
 *
 * Each is built as an app built on Fieldia is, so a page on a phone's network loads as one would: ES modules, minified
 * (each source map a file beside its script), split so a page fetches what it draws — Fieldia's parts stay files of their
 * own, asked for by the pages that use them — and every module a page's script imports named in its HTML
 * (`<link rel="modulepreload">`), so the browser asks for them all at once rather than one level at a time. What each
 * page fetches before it draws is checked against its budget (tools/demo-sizes.mjs).
 */
import { build } from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { dirname, join, relative, resolve } from 'node:path';
import { checkDemos } from './demo-sizes.mjs';
import { pageParts, partFiles, partModules, partScriptTags, preloadScript } from './demo-preloads.mjs';
import { openTag, readReleased } from './script-tags.mjs';
import { minifiedStyles, STYLED_PACKAGES } from './minified-styles.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const OUT = join(WORKSPACE, 'dist/demos');
const variants = process.argv.slice(2).length ? process.argv.slice(2) : ['plain', 'react', 'vue', 'angular', 'designer', 'screen', 'designer-react', 'designer-vue', 'designer-angular', 'script', 'embed', 'map-embed', 'backlog', 'save-safety', 'loading', 'csp', 'ssr'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
// The frame every demo shares, and the list of demos it shows.
// Every file of it at the top of demos/: one added there is never left behind.
for (const entry of readdirSync(join(WORKSPACE, 'demos'), { withFileTypes: true })) if (entry.isFile()) cpSync(join(WORKSPACE, 'demos', entry.name), join(OUT, entry.name));
// The frame's script as one minified file: its catalog, snippets and the real pages' cards each a module of their own
// were a request after a request (shell → catalog → its lanes), 3.7 s on a phone's network before the frame drew, after
// a form that had drawn under it. Its sources stay beside it as they are, for what reads them (the site's pages).
await build({ entryPoints: [join(WORKSPACE, 'demos/shell.mjs')], bundle: true, format: 'esm', minify: true, target: 'es2022', sourcemap: 'linked', outfile: join(OUT, 'shell.mjs'), allowOverwrite: true, logLevel: 'warning' });

/**
 * A page's HTML with the modules its script imports named in its head, each fetched at once as the page is read rather
 * than once the script that imports it has come: `<link rel="modulepreload">`, with the page's nonce where it has one.
 */
function withPreloads(html, files, nonce, about = 'What main.js imports, asked for with it (tools/build-demos.mjs).') {
  if (!files.length) return html;
  const links = files.map((file) => `    <link rel="modulepreload" href="${file}"${nonce ? ` nonce="${nonce}"` : ''} />`).join('\n');
  if (!html.includes('</head>')) throw new Error('a demo page needs a </head> for its module preloads');
  return html.replace('</head>', `    <!-- ${about} -->\n${links}\n  </head>`);
}

/** The files `main.js` imports statically, all the way down, from the build's metafile: what its page preloads. */
function importsOf(metafile, outdir) {
  const outputs = metafile.outputs;
  const main = Object.keys(outputs).find((file) => resolve(WORKSPACE, file) === join(outdir, 'main.js'));
  const seen = new Set();
  const queue = [...(outputs[main]?.imports ?? [])];
  while (queue.length) {
    const next = queue.shift();
    if (next.kind !== 'import-statement' || next.external || seen.has(next.path)) continue;
    seen.add(next.path);
    queue.push(...(outputs[next.path]?.imports ?? []));
  }
  return [...seen].map((file) => relative(outdir, resolve(WORKSPACE, file)));
}
// The catalog's real pages, one file per lane, beside it: the shell reads the catalog in the browser.
cpSync(join(WORKSPACE, 'demos/real'), join(OUT, 'real'), { recursive: true, filter: (from) => !/(gaps|README\.md)$/.test(from) });
cpSync(join(WORKSPACE, 'site/favicon.svg'), join(OUT, 'logo.svg'));
cpSync(join(WORKSPACE, 'demos/thumbs'), join(OUT, 'thumbs'), { recursive: true });
// Files a demo is tried with (an import's workbook and CSV file), offered from its how-to.
cpSync(join(WORKSPACE, 'demos/samples'), join(OUT, 'samples'), { recursive: true });

/**
 * The Angular demos on another install's Angular: `FIELDIA_ANGULAR=tools/angular-newest` builds angular/ and
 * designer-angular/ on the newest major the bindings support (tools/angular-newest.mjs), against the packages as the
 * workspace builds them — what an app on that Angular meets. Every @angular/* comes from there, or the build fails.
 */
const ANGULAR_FROM = process.env['FIELDIA_ANGULAR'] ? resolve(WORKSPACE, process.env['FIELDIA_ANGULAR']) : null;
const angularFrom = (dir) => ({
  name: 'angular-from',
  setup: (builder) =>
    builder.onResolve({ filter: /^@angular\// }, (args) => (args.pluginData?.angularFrom ? undefined : builder.resolve(args.path, { kind: args.kind, resolveDir: dir, pluginData: { angularFrom: true } }))),
});
const SCRIPT_BUNDLE = join(WORKSPACE, 'dist/libs/viewer/bundle/fieldia.js');
/** The demos that show any of the demos' pages by its name (`?page=`), whose pages carry early tags for it. */
const BY_NAME = new Set(['plain', 'react', 'vue', 'angular', 'csp']);
/**
 * A demo of fixed pages, whose HTML names the parts they draw with: its pages' files, and the parts its app's own options
 * bring — the loading demo's `loading` (its ways of waiting) and its twins' themes.
 */
const FIXED = { loading: { pages: ['examples/pages/loading-customers.page.json', 'examples/pages/loading-customer.page.json'], more: ['loading', 'themes'] } };
/**
 * A one-tag demo whose page is known, whose HTML writes its parts' tags before fieldia.js (0.34's `partFiles`): the
 * embed's enquiry, on the partner's page and in its frame — with the parts its `<fieldia-form>` itself draws from, the
 * element's own and the wait it draws while it fetches its page. The script tag demo's page draws from none.
 */
const ONE_TAG = { embed: { pages: ['examples/pages/unit-enquiry.page.json'], more: ['element', 'loading'], html: ['index.html', 'form.html'] } };
/** Every page whose parts are asked for by its file, as `pageParts` takes them. */
const PAGE_FILES = [...Object.values(FIXED), ...Object.values(ONE_TAG)].flatMap((fixed) => fixed.pages);
/** Each page's parts and file, and each part's modules: asked once, of the first demo that needs them. */
let demoPages;

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
    // The parts its page draws from, written before fieldia.js with what fieldia.js's own tags carry.
    demoPages ??= { pages: await pageParts(WORKSPACE, PAGE_FILES), parts: partModules(WORKSPACE) };
    const names = [...ONE_TAG.embed.pages.flatMap((file) => demoPages.pages[file].parts), ...ONE_TAG.embed.more];
    const tags = partScriptTags(join(OUT, 'embed'), names);
    for (const file of ONE_TAG.embed.html) {
      const page = join(OUT, 'embed', file);
      const html = readFileSync(page, 'utf8');
      if (!html.includes('<script src="fieldia.js"></script>')) throw new Error(`demos/embed/${file}: its parts' tags go before its <script src="fieldia.js">`);
      writeFileSync(page, html.replace('<script src="fieldia.js"></script>', `<!-- The parts its page draws from, before fieldia.js, as fieldia.js asks for them (tools/demo-preloads.mjs). -->\n    ${tags.join('\n    ')}\n    <script src="fieldia.js"></script>`));
    }
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
  // Every demo is ES modules, split as an app's bundler splits them: Fieldia's parts — a list's, a date's, a work item's
  // head and text — the code editors' grammars and VS Code's editor are files of their own (chunks/), loaded only by a
  // page that shows them; what main.js imports is preloaded by its page. Monaco's CSS is written beside it, as main.css,
  // which the plain demo links on the page that draws it. Under a strict Content-Security-Policy (csp) its chunks and parts come by
  // import(), under the nonce, and its preloads carry it.
  const outdir = join(OUT, variant);
  const { metafile } = await build({
    entryPoints: [entry],
    jsx: 'automatic',
    bundle: true,
    format: 'esm',
    splitting: true,
    minify: true,
    metafile: true,
    target: 'es2022',
    // Kept as files: a person's devtools fetch them; the page never does.
    sourcemap: 'linked',
    outdir,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    assetNames: 'chunks/[name]-[hash]',
    loader: { '.ttf': 'file' },
    // Its metafile's paths from the workspace, as the early tags read them (tools/demo-preloads.mjs).
    absWorkingDir: WORKSPACE,
    tsconfig: existsSync(ownConfig) ? ownConfig : join(WORKSPACE, 'tsconfig.base.json'),
    logLevel: 'warning',
    // The decode part's readers of codes alone, as the one-tag script carries them (tools/zxing-readers.mjs): the
    // library's index would bring every reader it has, about three times the code, to a phone that presses Scan.
    // And the stylesheets minified as the packages ship them (tools/minified-styles.mjs): the gates test what npm serves.
    plugins: [
      { name: 'zxing-readers', setup: (builder) => builder.onResolve({ filter: /^@zxing\/library$/ }, () => ({ path: join(WORKSPACE, 'tools/zxing-readers.mjs') })) },
      minifiedStyles(STYLED_PACKAGES),
      ...(ANGULAR_FROM && variant.endsWith('angular') ? [angularFrom(ANGULAR_FROM)] : []),
    ],
    define: {
      'process.env.NODE_ENV': '"production"',
      // Vue's bundler build reads these compile-time flags.
      __VUE_OPTIONS_API__: 'true',
      __VUE_PROD_DEVTOOLS__: 'false',
      __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
    },
  });
  if (ANGULAR_FROM && variant.endsWith('angular')) {
    const angular = Object.keys(metafile.inputs).filter((file) => file.includes('node_modules/@angular/'));
    const stray = angular.find((file) => !resolve(WORKSPACE, file).startsWith(join(ANGULAR_FROM, 'node_modules/')));
    if (!angular.length || stray) throw new Error(`demos/${variant}: Angular from ${relative(WORKSPACE, ANGULAR_FROM)} alone, and it bundled ${stray ?? 'none'}`);
    console.log(`demo ${variant}: on Angular ${JSON.parse(readFileSync(join(ANGULAR_FROM, 'node_modules/@angular/core/package.json'), 'utf8')).version}, from ${relative(WORKSPACE, ANGULAR_FROM)}`);
  }
  if (variant === 'plain') {
    // Monaco's workers, for the code page with ?workers=1: the editor's own and JSON's, each a module.
    const monaco = join(WORKSPACE, 'node_modules/monaco-editor/esm/vs');
    await build({
      entryPoints: { 'editor.worker': join(monaco, 'editor/editor.worker.js'), 'json.worker': join(monaco, 'languages/features/json/json.worker.js') },
      bundle: true,
      format: 'esm',
      target: 'es2022',
      outdir: join(OUT, variant, 'workers'),
      minify: true,
      sourcemap: 'linked',
      logLevel: 'warning',
    });
  }
  // The frame's script deferred, in its place before the demo's: an async one may run after the demo has drawn and
  // measured itself, and move it (a map's homes in view counted, then the map pushed down: 25 Oct). Only a page whose
  // Fieldia comes by a classic, blocking tag (script/, embed/) has it async.
  if (/<script\b[^>]*\basync\b[^>]*shell\.mjs/.test(readFileSync(join(WORKSPACE, 'demos', variant, 'index.html'), 'utf8'))) throw new Error(`demos/${variant}/index.html: the frame's script deferred (no async), before the demo's own`);
  const preloads = importsOf(metafile, outdir);
  const nonce = variant === 'csp' ? '__CSP_NONCE__' : undefined;
  let html = withPreloads(readFileSync(join(WORKSPACE, 'demos', variant, 'index.html'), 'utf8'), preloads, nonce);
  // A demo that shows any of the demos' pages by its name: the page's own file and its parts, asked for with main.js.
  if (BY_NAME.has(variant)) {
    demoPages ??= { pages: await pageParts(WORKSPACE, PAGE_FILES), parts: partModules(WORKSPACE) };
    // Before the page's stylesheets: a script after one waits for it to come before it runs.
    const at = html.indexOf('<link');
    if (at < 0 || at > html.indexOf('</head>')) throw new Error(`demos/${variant}/index.html: its early tags go before its first <link>, in its head`);
    // Every one of them draws its records from the memory source, whose part comes with the page's.
    html = `${html.slice(0, at)}${preloadScript({ workspace: WORKSPACE, metafile, outdir, ...demoPages, already: preloads, nonce, more: ['memory'] })}\n    ${html.slice(at)}`;
  }
  if (FIXED[variant]) {
    demoPages ??= { pages: await pageParts(WORKSPACE, PAGE_FILES), parts: partModules(WORKSPACE) };
    const build = { workspace: WORKSPACE, metafile, outdir, parts: demoPages.parts, already: preloads };
    html = withPreloads(html, partFiles(build, FIXED[variant].pages.map((file) => demoPages.pages[file]), FIXED[variant].more), nonce, 'The parts its pages draw with, asked for with main.js (tools/demo-preloads.mjs).');
  }
  writeFileSync(join(outdir, 'index.html'), html);
  if (variant === 'ssr') {
    // What a site's server sends: the page with the form's first paint in it, drawn in Node from @fieldia/viewer/server,
    // as Next or Nuxt would draw it for each request; main.js then mounts over it.
    // Split, as the packages are files of their own: one file would put off a module's start past its first use.
    const server = join(WORKSPACE, 'tmp/demos-ssr/server.mjs');
    await build({ entryPoints: [join(WORKSPACE, 'demos/ssr/server.ts')], bundle: true, splitting: true, platform: 'node', format: 'esm', target: 'node20', outdir: dirname(server), outExtension: { '.js': '.mjs' }, tsconfig: join(WORKSPACE, 'tsconfig.base.json'), logLevel: 'warning' });
    const { render } = await import(pathToFileURL(server).href);
    const html = withPreloads(readFileSync(join(WORKSPACE, 'demos/ssr/index.html'), 'utf8'), preloads);
    writeFileSync(join(OUT, variant, 'index.html'), html.replace('<!--FIRST_PAINT-->', render()));
    rmSync(dirname(server), { recursive: true, force: true });
  }
  // A demo with a stylesheet of its own beside its page (the backlog's chrome), other pages (csp's one-tag page), or a
  // service worker (the viewing report's, plain's offline-sw.js): copied with it.
  for (const file of readdirSync(join(WORKSPACE, 'demos', variant))) if (file.endsWith('.css') || file.endsWith('-sw.js') || (file.endsWith('.html') && file !== 'index.html')) cpSync(join(WORKSPACE, 'demos', variant, file), join(OUT, variant, file));
  console.log(`demo ${variant}: ${join('dist/demos', variant)}`);
}

// What each page fetches before it draws, against its budget; each bundle minified, its source map beside it.
const { rows, wrong } = checkDemos(OUT, undefined, variants);
console.log(`demo sizes (KB gzipped, before a page draws): ${rows.map((row) => `${row.demo} ${row.kb}`).join(', ')}`);
if (wrong.length) throw new Error(`the demos' sizes (tools/demo-sizes.mjs):\n${wrong.join('\n')}`);
