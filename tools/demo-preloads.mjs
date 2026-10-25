/**
 * The early tags of the demos that show any page of the demos' by its name (`?page=`): what a page draws from beyond
 * main.js — its own JSON page, a file of its own (demos/shared/lazy-page.ts), and the parts it draws with — asked for
 * as the HTML is read, beside main.js, rather than once main.js has come, run and looked at the page: a round trip for
 * the page and another for its parts, on a phone's network a second or more. What a server that knows the page writes
 * into it (0.34: `partFiles` / `Fieldia.partTags` for the one-tag script); a static site knows the page only from its
 * address, so a small script in the page reads it, from a table written here when the demos are built.
 *
 * Which parts a page draws with is the viewer's own answer (`partFiles`, 0.34: the parts it waits for, and the loading
 * part where it asks for that with them), asked in Node of every page the demos serve, with the memory source's part
 * every demo of them draws its records from;
 * which file each part is, the build's own (its metafile), by the module each part imports (`lazyPart(name, () =>
 * import('./x-part'))`).
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** Every part by its name: the modules it imports (a name may stand for a core part and a viewer part alike). */
export function partModules(workspace) {
  const found = {};
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith('.ts') && !/\.spec\.tsx?$/.test(entry.name)) {
        const source = readFileSync(path, 'utf8');
        for (const match of source.matchAll(/lazyPart(?:<[^>]*>)?\(\s*'([a-z0-9-]+)',\s*\(\)\s*=>\s*([^\n]{0,160})/g)) {
          const imported = /import\('(\.{1,2}\/[^']+)'\)/.exec(match[2])?.[1];
          if (!imported) continue;
          const module = relative(workspace, resolve(dirname(path), `${imported}.ts`));
          (found[match[1]] ??= []).push(module);
        }
      }
    }
  };
  for (const lib of readdirSync(join(workspace, 'libs'))) if (statSync(join(workspace, 'libs', lib)).isDirectory() && statSync(join(workspace, 'libs', lib, 'src'), { throwIfNoEntry: false })) walk(join(workspace, 'libs', lib, 'src'));
  return found;
}

/** What a browser this script runs in Node stands in for: the address, the reader's scheme and the tab's stores. */
const STAND_INS = `(() => {
const store = () => { const kept = new Map(); return { getItem: (k) => kept.get(k) ?? null, setItem: (k, v) => kept.set(k, String(v)), removeItem: (k) => kept.delete(k), key: (i) => [...kept.keys()][i] ?? null, get length() { return kept.size; }, clear: () => kept.clear() }; };
globalThis.location = new URL('https://fieldia.dev/demos/plain/');
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.localStorage = store();
globalThis.sessionStorage = store();
globalThis.addEventListener = () => {};
globalThis.dispatchEvent = () => true;
})();`;

/**
 * Every page the demos serve by name, with the parts it draws with (by their names) and the JSON file it is kept in
 * (workspace-relative), where it is one: the viewer's `partFiles`, asked in Node of each, with the demos' own widgets.
 */
export async function pageParts(workspace, files = []) {
  const dir = join(workspace, 'tmp/demo-preloads');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'pages.mjs');
  await build({
    stdin: {
      contents: `
        import { partFiles } from '@fieldia/viewer/server';
        import { pages } from './demos/shared/sample-data';
        import { pageOf } from './demos/shared/lazy-page';
        import { codeWidgets, gridWidgets } from './demos/shared/lazy-widgets';
        import { fileOf } from 'demo-preloads:files';
        ${files.map((file, i) => `import file${i} from './${file}';`).join('\n')}
        const found = {};
        // fieldia.list.js → list: a part's name, as its module's lazyPart names it.
        const partsOf = (page) => [...new Set(partFiles(page, { ...gridWidgets, ...codeWidgets }).map((file) => file.slice('fieldia.'.length, -'.js'.length)))].sort();
        for (const [name, source] of Object.entries(pages)) {
          const page = await pageOf(source);
          found[name] = { parts: partsOf(page), file: fileOf(page) };
        }
        ${files.map((file, i) => `found[${JSON.stringify(file)}] = { parts: partsOf(file${i}), file: null };`).join('\n')}
        process.stdout.write(JSON.stringify(found));`,
      resolveDir: workspace,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: out,
    tsconfig: join(workspace, 'tsconfig.base.json'),
    banner: { js: STAND_INS },
    define: { 'process.env.NODE_ENV': '"production"' },
    logLevel: 'warning',
    plugins: [
      {
        name: 'demo-preloads',
        setup(builder) {
          // Each JSON page marked with its file, so a page asked for by its name is known by the file it is fetched from.
          builder.onResolve({ filter: /^demo-preloads:files$/ }, () => ({ path: 'files', namespace: 'demo-preloads' }));
          builder.onLoad({ filter: /.*/, namespace: 'demo-preloads' }, () => ({ contents: 'const files = new WeakMap(); export const mark = (page, file) => (files.set(page, file), page); export const fileOf = (page) => files.get(page) ?? null;', loader: 'js' }));
          builder.onLoad({ filter: /\.page\.json$/ }, (args) => ({
            contents: `import { mark } from 'demo-preloads:files'; export default mark(${readFileSync(args.path, 'utf8')}, ${JSON.stringify(relative(workspace, args.path))});`,
            loader: 'js',
            resolveDir: dirname(args.path),
          }));
          builder.onResolve({ filter: /^@zxing\/library$/ }, () => ({ path: join(workspace, 'tools/zxing-readers.mjs') }));
        },
      },
    ],
  });
  const found = JSON.parse(execFileSync(process.execPath, [out], { cwd: dir, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  rmSync(dir, { recursive: true, force: true });
  return found;
}

/** An output's static imports, all the way down, itself first: the files a module needs before it runs. */
function closureOf(outputs, file) {
  const seen = new Set();
  const queue = [file];
  while (queue.length) {
    const next = queue.shift();
    if (seen.has(next) || !outputs[next]) continue;
    seen.add(next);
    for (const one of outputs[next].imports) if (one.kind === 'import-statement' && !one.external) queue.push(one.path);
  }
  return [...seen];
}

/**
 * The files a page draws from beyond what it preloads anyway (`already`, main.js's static imports): its JSON page's file
 * (`file`) and its parts' (`names`), each with what it imports, as the build wrote them (workspace-relative).
 */
function filesFor({ workspace, metafile, outdir, parts, already }, file, names) {
  const outputs = metafile.outputs;
  const byEntry = new Map(Object.entries(outputs).filter(([, info]) => info.entryPoint).map(([output, info]) => [info.entryPoint, output]));
  const skip = new Set(already.map((one) => relative(workspace, join(outdir, one))));
  const roots = [file && byEntry.get(file), ...names.flatMap((part) => (parts[part] ?? []).map((module) => byEntry.get(module)))].filter(Boolean);
  return [...new Set(roots.flatMap((root) => closureOf(outputs, root)))].filter((one) => !skip.has(one));
}

/**
 * A demo of fixed pages (the loading demo's list and record): the parts they draw with, and those the app's own options
 * bring (`more`: its `loading`, its themes), named in its HTML as module preloads, by their address from the page.
 */
export function partFiles(build, pages, more = []) {
  const names = [...new Set([...pages.flatMap((page) => page.parts), ...more])];
  return filesFor(build, null, names).map((file) => relative(build.outdir, resolve(build.workspace, file)));
}

/**
 * The script a demo's page carries: by the page its address names, the files beyond main.js's own that it draws from,
 * each asked for at once as a module preload (with the page's nonce where it has one). `already`: what the page
 * preloads anyway (main.js's static imports).
 */
export function preloadScript({ workspace, metafile, outdir, pages, parts, already, nonce, more = [] }) {
  const files = [];
  const index = new Map();
  const numbered = (file) => {
    if (!index.has(file)) {
      index.set(file, files.length);
      files.push(relative(outdir, resolve(workspace, file)));
    }
    return index.get(file);
  };
  const table = {};
  for (const [name, { parts: names, file }] of Object.entries(pages)) {
    const needed = filesFor({ workspace, metafile, outdir, parts, already }, file, [...names, ...more]);
    if (needed.length) table[name] = needed.map(numbered);
  }
  // A page named by no address is the sign-up, as the demos show it (demos/shared/sample-data.ts).
  return `<script${nonce ? ` nonce="${nonce}"` : ''}>
      // What the page the address names draws from beyond main.js — its own page's file, its parts — asked for now,
      // beside main.js, not once it has run (tools/demo-preloads.mjs).
      (function () {
        var files = ${JSON.stringify(files)};
        var pages = ${JSON.stringify(table)};
        var nonce = document.currentScript && document.currentScript.nonce;
        (pages[new URLSearchParams(location.search).get('page') || 'signup'] || []).forEach(function (at) {
          var link = document.createElement('link');
          link.rel = 'modulepreload';
          link.href = files[at];
          if (nonce) link.nonce = nonce;
          document.head.appendChild(link);
        });
      })();
    </script>`;
}

/**
 * A one-tag page's parts written before fieldia.js, as 0.34 says a server that knows its page writes them (`partFiles`,
 * `Fieldia.partTags`): each `<script async>` with what fieldia.js's own tag for it carries — its address beside
 * fieldia.js, `crossorigin="anonymous"` and its file's sha256, the hash fieldia.js checks it by (`partTag`) — so it comes
 * beside fieldia.js and fieldia.js, finding it on its way, never asks for it again. `dir` holds the built parts.
 */
export function partScriptTags(dir, names) {
  return [...new Set(names)]
    .map((name) => `fieldia.${name}.js`)
    .filter((file) => existsSync(join(dir, file)))
    .map((file) => `<script async src="${file}" integrity="sha256-${createHash('sha256').update(readFileSync(join(dir, file))).digest('base64')}" crossorigin="anonymous"></script>`);
}
