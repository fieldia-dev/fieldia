/**
 * What a demo page fetches before it can draw: every script its HTML names — a `<script src>`, a
 * `<link rel="modulepreload">` — and every module those import statically, gzipped as a host sends them. A part a page
 * asks for with `import()` is not counted: it comes only where the page draws it. tools/build-demos.mjs checks each
 * demo against its budget as it builds them, and that each bundle it made is minified with its source map beside it:
 * fieldia.dev's demos load as an app built on Fieldia would, not as one megabyte of unminified script.
 *
 *   node tools/demo-sizes.mjs [dist/demos]   — each demo's scripts, their size, and the check
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';

/**
 * Each demo page's budget: KB gzipped (level 9) of the scripts it fetches before it can draw — its frame's (shell.mjs,
 * 56 KB) and, where its HTML names them, its parts — about 8% over what the minified, split build measured on 0.34.0
 * (25 Oct 2026, in brackets; 0.34's own growth added about 10 KB to each). Before that build every page fetched its whole
 * app unminified, every part of Fieldia's in it but the plain demo's (0.33.0): the plain demo 1,569 KB, the loading demo
 * 1,219, React 2,743, Vue 2,683, Angular 3,060, the survey designer 2,472, the screen designer 3,079. A demo that grows
 * past its budget says so here, with why. What the designers still fetch is the designer's own (its words in every
 * language, zod), the library's to make smaller, not the site's.
 */
export const DEMO_BUDGET_KB = {
  plain: 660, // (609.4)
  react: 720, // (664.9)
  vue: 675, // (623.6)
  angular: 965, // (894)
  designer: 1100, // (1018.9)
  screen: 1200, // (1111.1)
  'designer-react': 980, // (906.8)
  'designer-vue': 935, // (864.2)
  'designer-angular': 1225, // (1134.4)
  script: 260, // (240.7): fieldia.js and the frame; its page draws from no part (0.36: 245.9, the whole check after the draw)
  embed: 320, // (277.6): fieldia.js, the frame and the seven parts its enquiry draws from, their tags before fieldia.js — and from 0.37 its whole check's (fieldia.check.js, 17.2 KB), which every page waits for before it draws: 307.2
  'map-embed': 265, // (245.1)
  backlog: 440, // (407.6)
  'save-safety': 385, // (357.3)
  loading: 520, // (480.6): its pages' parts named in its HTML, which it draws with
  csp: 710, // (655.2)
  ssr: 325, // (298.6)
};

/** The scripts a page's HTML names, by their address as written: its script tags' and its module preloads'. */
export function htmlScripts(html) {
  const found = [];
  for (const tag of html.match(/<script\b[^>]*>|<link\b[^>]*>/g) ?? []) {
    if (tag.startsWith('<link') && !/\brel=["']?modulepreload\b/.test(tag)) continue;
    const src = /\b(?:src|href)=["']([^"']+)["']/.exec(tag)?.[1];
    if (src) found.push(src);
  }
  return found;
}

/**
 * The modules a script imports statically — `import … from "x"`, `import "x"`, `export … from "x"` — as written, minified
 * or not. `import("x")`, which a page makes only when it needs it, is not one of them.
 */
export function staticImports(code) {
  const found = new Set();
  const patterns = [/(?:^|[^\w$.])import\s*(?:[\w$]+\s*,?\s*)?(?:\*\s*as\s*[\w$]+\s*|\{[^}]*\}\s*)?(?:from\s*)?["']([^"']+)["']/g, /(?:^|[^\w$.])export\s*(?:\*(?:\s*as\s*[\w$]+)?|\{[^}]*\})\s*from\s*["']([^"']+)["']/g];
  for (const pattern of patterns) for (const match of code.matchAll(pattern)) found.add(match[1]);
  return [...found];
}

/**
 * A local address's file under `root`, from the page or module at `from`; null for another site's. In a module, only
 * an address is fetched: a bare name ("@fieldia/viewer") is text in it, a snippet it shows.
 */
function fileOf(root, from, address, inPage = false) {
  if (/^[a-z]+:|^\/\//i.test(address) || (!inPage && !/^\.{0,2}\//.test(address))) return null;
  const path = address.split(/[?#]/)[0];
  const file = path.startsWith('/') ? join(root, path) : normalize(join(dirname(from), path));
  return file.startsWith(root) ? file : null;
}

/** Every script a page fetches before it can draw: those its HTML names, and theirs, statically, all the way down. */
export function pageScripts(root, page) {
  const html = readFileSync(page, 'utf8');
  const seen = new Set();
  const queue = htmlScripts(html).map((address) => fileOf(root, page, address, true)).filter(Boolean);
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file) || !existsSync(file) || !statSync(file).isFile()) continue;
    seen.add(file);
    for (const address of staticImports(readFileSync(file, 'utf8'))) {
      const next = fileOf(root, file, address);
      if (next) queue.push(next);
    }
  }
  return [...seen];
}

/** Bytes gzipped at level 9, as the budgets count them. */
export const gzipped = (file) => gzipSync(readFileSync(file), { level: 9 }).length;

/** An esbuild bundle left unminified: it marks where each module starts with a comment of its path. */
export function minified(code) {
  return !/^\/\/ (?:\.\.\/)*[\w@.-]+\/[\w@./-]+\.(?:[cm]?[jt]sx?|json)$/m.test(code);
}

/** Every `.js` file under `dir`, but a service worker's or a web worker's (which no page fetches before it draws). */
function bundles(dir) {
  const found = [];
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = join(at, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'workers') walk(path);
      } else if (entry.name.endsWith('.js') && !entry.name.endsWith('-sw.js')) found.push(path);
    }
  };
  walk(dir);
  return found;
}

/**
 * Each built demo: what its page fetches before it draws, against its budget; and each bundle the build made minified,
 * its source map a file beside it. The one-tag demos' files are the script bundle's own, checked by
 * tools/script-bundle.mjs; their pages are counted all the same. Gives what it found, and what is wrong.
 */
export function checkDemos(root, budgets = DEMO_BUDGET_KB, built = Object.keys(budgets)) {
  root = resolve(root);
  const rows = [];
  const wrong = [];
  for (const demo of built) {
    const page = join(root, demo, 'index.html');
    if (!existsSync(page)) continue;
    const files = pageScripts(root, page);
    const bytes = files.reduce((sum, file) => sum + gzipped(file), 0);
    const kb = Math.round(bytes / 102.4) / 10;
    rows.push({ demo, files: files.map((file) => relative(root, file)), kb });
    if (!(demo in budgets)) wrong.push(`demos/${demo} has no budget in tools/demo-sizes.mjs (it fetches ${kb} KB gzipped before it draws)`);
    else if (kb > budgets[demo]) wrong.push(`demos/${demo} fetches ${kb} KB gzipped before it draws, over its budget of ${budgets[demo]} KB (tools/demo-sizes.mjs): ${files.length} files`);
    if (demo === 'script' || demo === 'embed') continue;
    for (const file of bundles(join(root, demo))) {
      const code = readFileSync(file, 'utf8');
      if (!minified(code)) wrong.push(`${relative(root, file)} is not minified`);
      const map = /\/\/# sourceMappingURL=([^\s]+)\s*$/.exec(code)?.[1];
      if (!map || !existsSync(join(dirname(file), map))) wrong.push(`${relative(root, file)} has no source map beside it`);
    }
  }
  return { rows, wrong };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const root = resolve(process.argv[2] ?? 'dist/demos');
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`${root}: build the demos first (node tools/build-demos.mjs)`);
  const { rows, wrong } = checkDemos(root, DEMO_BUDGET_KB, readdirSync(root).filter((name) => existsSync(join(root, name, 'index.html'))));
  for (const row of rows) console.log(`${row.demo.padEnd(18)} ${String(row.kb).padStart(8)} KB gz  ${String(row.files.length).padStart(3)} files  budget ${DEMO_BUDGET_KB[row.demo] ?? '—'}`);
  if (wrong.length) {
    console.error(wrong.join('\n'));
    process.exit(1);
  }
}
