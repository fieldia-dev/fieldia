/**
 * Build the `<script>` bundle: core, widgets and viewer in one file that sets
 * the global `Fieldia`, for pages with no build step —
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
 *   <script>Fieldia.mountViewer(element, { page, dataSource })</script>
 *
 * Its own words are English. Arabic, German and French ship as add-on
 * scripts beside it — `fieldia.ar.js`, `fieldia.de.js`, `fieldia.fr.js` — each
 * carrying that language's words alone, which a page loads after the main one:
 *
 *   <script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.ar.js"></script>
 *
 * They ship inside @fieldia/viewer (the `bundle/` folder), so their version is
 * always the viewer's. Then it checks the files: the main one must run on its
 * own and define the global with the viewer in it, and each add-on must give
 * it that language's words.
 */
import { build, transform } from 'esbuild';
import { copyFileSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runInNewContext } from 'node:vm';
import { gzipSync } from 'node:zlib';
import { englishKeys, PART_WORDS, partWordsProblems, readerSource, withoutWords, WORD_TABLES } from './part-words.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const BUNDLE = join(WORKSPACE, 'dist/libs/viewer/bundle');
const OUT = join(BUNDLE, 'fieldia.js');
/** The languages besides English, each an add-on script of its own. */
const LANGUAGES = { ar: 'Arabic', de: 'German', fr: 'French' };
const { version } = JSON.parse(readFileSync(join(WORKSPACE, 'libs/viewer/package.json'), 'utf8'));

/**
 * The stylesheets ship as text inside the code, which the code's minifier
 * leaves alone: minify that text as CSS, with esbuild's own CSS minifier.
 */
const minifiedStyles = {
  name: 'minified-styles',
  setup(builder) {
    builder.onLoad({ filter: /libs\/(widgets|viewer)\/src\/lib\/(([a-z-]+-)?styles|styles-[a-z-]+)\.ts$/ }, async ({ path }) => {
      const source = readFileSync(path, 'utf8');
      const literal = /(= (?:\/\* css \*\/ )?`)([^`]*)(`;)/;
      const found = literal.exec(source);
      if (!found) throw new Error(`no stylesheet found in ${path}`);
      const { code: css } = await transform(found[2], { loader: 'css', minify: true, charset: 'utf8', logLevel: 'error' });
      // Text that could end the literal, or be read as part of it, would break the code.
      if (/[`\\]|\$\{/.test(css)) throw new Error(`the minified stylesheet of ${path} cannot sit in a template literal`);
      return { contents: source.replace(literal, (_, open, _css, close) => open + css.trim() + close), loader: 'ts' };
    });
  },
};

/**
 * English alone in the main script: each package's module of the other
 * languages (`locales/all.ts`) is built as an empty one, so their words stay
 * out; the add-ons bring them.
 */
const englishOnly = {
  name: 'english-only',
  setup(builder) {
    builder.onLoad({ filter: /libs\/(core|widgets|viewer)\/src\/lib\/(record\/)?locales\/all\.ts$/ }, () => ({ contents: 'export const LANGUAGES = {};', loader: 'ts' }));
  },
};

/**
 * The English words only a part reads out of the main script (tools/part-words.mjs): each table's English is built
 * without them, and each part's script carries its own (`partScript`), put in the tables as it comes. The packages'
 * tables keep every word.
 */
const TABLE_FILES = Object.fromEntries(Object.entries(WORD_TABLES).map(([table, file]) => [join(WORKSPACE, file), table]));
/** Each table's keys, as its English has them. */
const TABLE_KEYS = Object.fromEntries(Object.entries(WORD_TABLES).map(([table, file]) => [table, englishKeys(readFileSync(join(WORKSPACE, file), 'utf8'), file)]));
/** The words the main script leaves out, by table: every part's. */
const CUT = Object.fromEntries(Object.keys(WORD_TABLES).map((table) => [table, [...new Set(Object.values(PART_WORDS).flatMap((words) => words[table] ?? []))]]));
const partWordsOut = {
  name: 'part-words-out',
  setup(builder) {
    builder.onLoad({ filter: /libs\/(core|widgets|viewer)\/src\/lib\/(record\/messages|labels)\.ts$/ }, ({ path }) => {
      const table = TABLE_FILES[path];
      if (!table) return undefined;
      return { contents: withoutWords(readFileSync(path, 'utf8'), CUT[table], WORD_TABLES[table]), loader: 'ts' };
    });
  },
};

/** What the main script and the add-ons are built with alike: ASCII, minified, for browsers since 2020. */
const common = {
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  sourcemap: true,
  legalComments: 'none',
  charset: 'ascii',
  define: { __FIELDIA_VERSION__: JSON.stringify(version) },
  tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
  absWorkingDir: WORKSPACE,
  logLevel: 'warning',
};

// ---- the parts: code a page loads the first time it uses it, each a script of its own beside fieldia.js ----------------
//
// In the packages a part is a module asked for with import('./x-part') (libs/widgets/src/lib/parts.ts), which an app's
// bundler makes a file of its own. Here the main script asks for fieldia.<name>.js instead (tools/script-parts.ts), and
// each part is built against the main script: what it shares with it — the icons, the words, the helpers — it takes
// from the main script's own modules, passed to it in a table both are built with (`SHARED`), never a copy of its own.

/** What a part takes '@fieldia/core' as: the runtime the main script carries, never the format's schemas. */
const CORE_RUNTIME = join(WORKSPACE, 'libs/core/src/runtime.ts');

/**
 * The main script: each `import('./x-part')` asks for fieldia.x.js instead — the call itself becomes loadPart('x')
 * (tools/script-parts.ts), an import of the main script's own, so no module is made to wait on a lazy start — and
 * `fieldia:shared` is the table of what the parts take from the main script's modules: for each module, an object of
 * the names the parts use of it, in a fixed order (`table`: [file, names][]). Names alone, so the main script carries
 * nothing more than it would — no module's every export kept for one name. (Every export the packages share is a const,
 * a function or a class: a name's value never changes once the main script has started.) Any other import() would be
 * bundled in whole, where it saves nothing: refused.
 */
const asksForParts = (table, parts) => ({
  name: 'asks-for-parts',
  setup(builder) {
    builder.onLoad({ filter: /libs\/(core|widgets|viewer)\/src\/lib\/([a-z-]+\/)?[a-z-]+\.ts$/ }, ({ path }) => {
      const source = readFileSync(path, 'utf8');
      /** Whether code, its comments aside, calls import(). */
      const callsImport = (code) => /\bimport\s*\(/.test(code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1'));
      if (!callsImport(source)) return undefined;
      const asking = source.replace(/\bimport\('\.\/([a-z]+)-part'\)/g, (_, part) => {
        const file = join(dirname(path), `${part}-part.ts`);
        // A part's modules, one a package at most: a feature's form code in @fieldia/core and what draws it in the
        // viewer come as one script (the limits part), each package asking for its own module of it.
        const files = parts.get(part) ?? new Set();
        const same = [...files].find((other) => other !== file && packageOf(other) === packageOf(file));
        if (same) throw new Error(`two parts are named ${part}: ${same} and ${file}`);
        parts.set(part, files.add(file));
        return `__fieldiaPart(${JSON.stringify(part)})`;
      });
      if (callsImport(asking)) throw new Error(`${path} loads a module with import(): the script bundle loads only parts (a ./x-part module) on demand`);
      return { contents: `import { loadPart as __fieldiaPart } from ${JSON.stringify(join(WORKSPACE, 'tools/script-parts.ts'))};\n${asking}`, loader: 'ts' };
    });
    builder.onResolve({ filter: /^fieldia:shared$/ }, () => ({ path: 'shared', namespace: 'fieldia-shared-table' }));
    builder.onLoad({ filter: /.*/, namespace: 'fieldia-shared-table' }, () => ({
      contents: [
        ...table.map(([file, names], i) => `import { ${names.map((name) => `${name} as m${i}_${name}`).join(', ')} } from ${JSON.stringify(file)};`),
        // Made the first time a part is taken, once every module of the main script has run: a module that asks for a
        // part may be one the table's modules import (the form's, in @fieldia/core), whose consts are not set yet as it
        // is first read.
        `let made;`,
        `export const SHARED = () => made || (made = [${table.map(([, names], i) => `{ ${names.map((name) => `${name}: m${i}_${name}`).join(', ')} }`).join(', ')}]);`,
      ].join('\n'),
      resolveDir: WORKSPACE,
      loader: 'js',
    }));
  },
});

/**
 * The checks of a page the one-tag script carries in the part that draws what they check, not in its main script: a
 * list page's own settings and a related list's in the list part, a list's cells changed in place in the editable
 * part, a record's head in the head part, a page's limits and Continue later in the limits part, a record's approvals
 * in the approvals part, booking slots' settings in the slots part, a signature's in the files part, a page's
 * endings in the answers part, a table of lines' in the lines part, a sheet's statusbar in the business part, options
 * by condition and carried in the options part, and a map's in a part of their own
 * (fieldia.mapchecks.js), which the viewer asks for as the check owes it. The packages' `checkPage` runs them at once. Here the main script is built
 * with each module below standing in — its checks owed (`owe`, the reference check's `later`) until its part has come,
 * and the viewer running the check again then, before the page is drawn — and each part's script puts its module's
 * checks in `LATER_CHECKS` (libs/core/src/lib/format/later-checks.ts) as it comes.
 */
const CHECKS_IN_PARTS = {
  list: { file: 'libs/core/src/lib/format/list-checks.ts', names: ['checkList', 'checkRelated'] },
  editable: { file: 'libs/core/src/lib/format/editable-checks.ts', names: ['checkEditable'] },
  head: { file: 'libs/core/src/lib/format/sheet-head-checks.ts', names: ['checkSheetHead', 'checkMenuOpener'] },
  limits: { file: 'libs/core/src/lib/format/limits-checks.ts', names: ['checkLimits'] },
  approvals: { file: 'libs/core/src/lib/format/approval-checks.ts', names: ['checkApproval'] },
  slots: { file: 'libs/core/src/lib/format/slots-checks.ts', names: ['checkSlots'] },
  files: { file: 'libs/core/src/lib/format/signature-checks.ts', names: ['checkSignature'] },
  answers: { file: 'libs/core/src/lib/format/endings-checks.ts', names: ['checkEndings'] },
  mapchecks: { file: 'libs/core/src/lib/format/map-checks.ts', names: ['checkMap', 'checkPlace', 'checkAddressSearch'] },
  lines: { file: 'libs/core/src/lib/format/table-checks.ts', names: ['checkTable', 'checkLineKinds'] },
  business: { file: 'libs/core/src/lib/format/statusbar-checks.ts', names: ['checkStatusbar'] },
  options: { file: 'libs/core/src/lib/format/option-checks.ts', names: ['checkOptionRules'] },
  languages: { file: 'libs/core/src/lib/format/languages-checks.ts', names: ['checkLanguages'] },
  assist: { file: 'libs/core/src/lib/format/assist-checks.ts', names: ['checkSuggest', 'checkRewrite'] },
  scan: { file: 'libs/core/src/lib/format/scan-checks.ts', names: ['checkScan'] },
};
const LATER_CHECKS_FILE = join(WORKSPACE, 'libs/core/src/lib/format/later-checks.ts');
const checksLater = {
  name: 'checks-later',
  setup(builder) {
    for (const [part, { file, names }] of Object.entries(CHECKS_IN_PARTS)) {
      builder.onLoad({ filter: new RegExp(`${file.replace(/[./]/g, (c) => `\\${c}`)}$`) }, () => ({
        contents: [
          `import { LATER_CHECKS } from ${JSON.stringify(LATER_CHECKS_FILE)};`,
          // The tools a check is handed come last: they are told it is owed.
          ...names.map((name) => `export const ${name} = (...args) => { const real = LATER_CHECKS[${JSON.stringify(part)}]?.${name}; return real ? real(...args) : args[args.length - 1].owe(${JSON.stringify(part)}); };`),
        ].join('\n'),
        resolveDir: WORKSPACE,
        loader: 'js',
      }));
    }
  },
};

/** The package a module of the workspace is in: core, widgets or viewer. */
const packageOf = (file) => /libs\/([a-z]+)\//.exec(file)?.[1];

/**
 * A part: a module of the main script is taken from the table — `__fieldia`, its factory's argument — or, while the
 * table is worked out (`table` null), left an import of its own, so the part's code says which names it uses of it.
 */
const takesShared = (inMain, table) => ({
  name: 'takes-shared',
  setup(builder) {
    builder.onResolve({ filter: /.*/ }, async (args) => {
      if (args.pluginData?.inner || args.kind === 'entry-point') return undefined;
      const found = await builder.resolve(args.path === '@fieldia/core' ? CORE_RUNTIME : args.path, { kind: args.kind, importer: args.importer, resolveDir: args.resolveDir, pluginData: { inner: true } });
      if (found.errors.length) return { errors: found.errors };
      if (args.kind === 'dynamic-import') return { errors: [{ text: `${args.path} is loaded with import() from ${args.importer}, inside a part` }] };
      if (!inMain.has(found.path)) return { path: found.path, sideEffects: found.sideEffects };
      if (!table) return { path: found.path, external: true };
      const i = table.findIndex(([file]) => file === found.path);
      if (i < 0) return { errors: [{ text: `${found.path} is the main script's, but not in the parts' table` }] };
      return { path: String(i), namespace: 'fieldia-shared' };
    });
    builder.onLoad({ filter: /.*/, namespace: 'fieldia-shared' }, ({ path: i }) => ({ contents: `module.exports = __fieldia[${i}];`, loader: 'js' }));
  },
});

/** The names a part's code imports from each of the main script's modules, read from its build with them left out. */
const namesUsed = (code) => {
  const used = new Map();
  const add = (file, names) => used.set(file, new Set([...(used.get(file) ?? []), ...names]));
  const list = (inside) => inside.split(',').map((one) => one.trim().split(/\s+as\s+/)[0]).filter(Boolean);
  for (const [, names, file] of code.matchAll(/\b(?:import|export)\s*\{([^}]*)\}\s*from\s*"([^"]+)"/g)) add(file, list(names));
  for (const [, file] of code.matchAll(/\b(?:import\s*\*\s*as\s*\w+|export\s*\*)\s*from\s*"([^"]+)"/g)) throw new Error(`a part takes every name of ${file}: name the ones it uses`);
  for (const [, file] of code.matchAll(/\bimport\s+\w+\s*(?:,\s*\{[^}]*\})?\s*from\s*"([^"]+)"/g)) add(file, ['default']);
  return used;
};

const mainScript = async (table) => {
  const parts = new Map();
  const { metafile } = await build({
    ...common,
    entryPoints: [join(WORKSPACE, 'tools/script-entry.ts')],
    plugins: [minifiedStyles, englishOnly, partWordsOut, checksLater, asksForParts(table, parts)],
    globalName: 'Fieldia',
    banner: { js: `/*! Fieldia ${version} · MIT · https://fieldia.dev */` },
    outfile: OUT,
    metafile: true,
  });
  // The modules the main script carries: those its file was made of, never one it read and left out whole (the
  // packages' memory source, which only its part's members use: the one-tag script's own source stands in for it).
  const [, written] = Object.entries(metafile.outputs).find(([file]) => file.endsWith('/fieldia.js'));
  const inMain = new Set(Object.keys(written.inputs).filter((input) => input.startsWith('libs/') || input.startsWith('tools/')).map((input) => join(WORKSPACE, input)));
  // A part's checks stand in for themselves here: the part carries them.
  for (const { file } of Object.values(CHECKS_IN_PARTS)) inMain.delete(join(WORKSPACE, file));
  for (const [part, files] of parts) PART_SOURCES[part] = [...files].sort();
  return { inMain, parts: [...parts.keys()].sort(), metafile };
};
/**
 * What a part carries of another project's work, named in its banner: the phone part's table of countries is made from
 * libphonenumber's metadata (Apache-2.0), its notice in libs/widgets/THIRD_PARTY_NOTICES.md, beside the bundle too.
 */
const NOTICES = {
  phone: " · its phone numbers' table derived from libphonenumber's metadata, (C) 2009 The Libphonenumber Authors, Apache-2.0: see THIRD_PARTY_NOTICES.md",
  decode: ' · carries ZXing\'s readers of codes, @zxing/library 0.23.0, (C) ZXing authors, Apache-2.0: see THIRD_PARTY_NOTICES.md',
};
/**
 * The decode part's `@zxing/library`: the readers it uses alone, from the library's own modules (tools/zxing-readers.mjs)
 * — its index brings every reader the library has, which no bundler can leave out (459 KB where these are 155).
 */
const ZXING_READERS = join(WORKSPACE, 'tools/zxing-readers.mjs');
const zxingReaders = {
  name: 'zxing-readers',
  setup(builder) {
    builder.onResolve({ filter: /^@zxing\/library$/ }, () => ({ path: ZXING_READERS }));
  },
};
/** Every English word of the three tables, as the packages have them. */
const ENGLISH = await (async () => {
  const { outputFiles } = await build({
    ...common,
    sourcemap: false,
    write: false,
    globalName: 'words',
    plugins: [englishOnly],
    stdin: {
      contents: [
        `export { MESSAGES as messages } from './libs/core/src/lib/record/messages';`,
        `export { WIDGET_LABELS as widgets } from './libs/widgets/src/lib/labels';`,
        `export { VIEWER_LABELS as viewer } from './libs/viewer/src/lib/labels';`,
      ].join('\n'),
      resolveDir: WORKSPACE,
      loader: 'ts',
    },
  });
  const sandbox = {};
  runInNewContext(outputFiles[0].text, sandbox);
  return Object.fromEntries(Object.keys(WORD_TABLES).map((table) => [table, sandbox.words[table].en]));
})();
/** A part's own English words (PART_WORDS), as its script hands them to the main script: by table, none left empty. */
const partEnglish = (part) =>
  Object.fromEntries(Object.entries(PART_WORDS[part] ?? {}).filter(([, keys]) => keys.length).map(([table, keys]) => [table, Object.fromEntries(keys.map((key) => [key, ENGLISH[table][key]]))]));
/** Words by table as a script's object, in ASCII as esbuild writes the rest (a character past it as its escape), each key bare. */
const wordsLiteral = (tables) => {
  const ascii = (text) => JSON.stringify(text).replace(/[\u007f-\uffff]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const object = (entries) => `{${entries.map(([key, value]) => `${/^[A-Za-z_]\w*$/.test(key) ? key : ascii(key)}:${value}`).join(',')}}`;
  return object(Object.entries(tables).map(([table, words]) => [table, object(Object.entries(words).map(([key, text]) => [key, ascii(text)]))]));
};
/** A part's script's own module: each of its modules' exports (a part may have one in each package). */
const partEntry = (part) =>
  [
    ...PART_SOURCES[part].map((file) => `export * from ${JSON.stringify(file)};`),
    // The checks it carries, put where the main script's reference check finds them as it comes.
    ...(CHECKS_IN_PARTS[part] ? [`import * as checks from ${JSON.stringify(join(WORKSPACE, CHECKS_IN_PARTS[part].file))};`, `import { LATER_CHECKS } from ${JSON.stringify(LATER_CHECKS_FILE)};`, `LATER_CHECKS[${JSON.stringify(part)}] = checks;`] : []),
  ].join('\n');
const partScript = (part, inMain, table) =>
  build({
    ...common,
    stdin: { contents: partEntry(part), resolveDir: WORKSPACE, sourcefile: `fieldia.${part}.ts`, loader: 'ts' },
    plugins: [minifiedStyles, englishOnly, zxingReaders, takesShared(inMain, table)],
    globalName: 'part',
    // It hands itself to the main script (tools/script-parts.ts), or waits for it in the queue.
    banner: { js: `/*! Fieldia ${version} · ${part} · MIT · https://fieldia.dev${NOTICES[part] ?? ''} */\n(globalThis.FieldiaParts = globalThis.FieldiaParts || []).push([${JSON.stringify(part)}, ${JSON.stringify(version)}, function (__fieldia) {` },
    // Its own English words after its code, which the main script puts in the tables before it makes the code.
    footer: { js: Object.keys(partEnglish(part)).length ? `return part; }, ${wordsLiteral(partEnglish(part))}]);` : 'return part; }]);' },
    outfile: join(BUNDLE, `fieldia.${part}.js`),
    metafile: true,
  });
/** What a part uses of the main script's modules: its code built as a module, theirs left out, unminified. */
const partNeeds = async (part, inMain) => {
  const { outputFiles } = await build({
    ...common,
    format: 'esm',
    minify: false,
    sourcemap: false,
    write: false,
    stdin: { contents: partEntry(part), resolveDir: WORKSPACE, sourcefile: `fieldia.${part}.ts`, loader: 'ts' },
    plugins: [minifiedStyles, englishOnly, zxingReaders, takesShared(inMain, null)],
    outfile: join(BUNDLE, `fieldia.${part}.mjs`),
  });
  return namesUsed(outputFiles[0].text);
};

/** Each part's modules, by its name, as the main script asks for it: one, or one in each package that asks for it. */
const PART_SOURCES = {};

// The table settles in a round or two: the main script built with it may carry a module a part would otherwise have copied.
let table = [];
let main;
for (let round = 0; ; round++) {
  main = await mainScript(table);
  const wanted = new Map(table.map(([file, names]) => [file, new Set(names)]));
  for (const part of main.parts) for (const [file, names] of await partNeeds(part, main.inMain)) wanted.set(file, new Set([...(wanted.get(file) ?? []), ...names]));
  const next = [...wanted].map(([file, names]) => [file, [...names].sort()]).sort(([a], [b]) => (a < b ? -1 : 1));
  if (JSON.stringify(next) === JSON.stringify(table)) break;
  if (round === 4) throw new Error('the parts\' table of shared names does not settle');
  table = next;
}
const PARTS = main.parts;
// The notice a part's banner names, beside it: the bundle's folder is what a CDN serves and @fieldia/viewer ships.
copyFileSync(join(WORKSPACE, 'libs/widgets/THIRD_PARTY_NOTICES.md'), join(BUNDLE, 'THIRD_PARTY_NOTICES.md'));
const partFiles = {};
const partInputs = {};
for (const part of PARTS) {
  const { metafile } = await partScript(part, main.inMain, table);
  partFiles[part] = join(BUNDLE, `fieldia.${part}.js`);
  partInputs[part] = Object.keys(metafile.inputs).filter((input) => input.startsWith('libs/'));
  // A part made from another project's work says so where it is read: its first line names the notice.
  if (NOTICES[part] && !readFileSync(partFiles[part], 'utf8').split('\n')[0].includes('THIRD_PARTY_NOTICES.md')) throw new Error(`fieldia.${part}.js does not name the third-party notice its table needs`);
}
// A part's own code is in it alone: never in the main script, never in another part (it would be a second copy, its state twice).
for (const part of PARTS) {
  const inBoth = partInputs[part].filter((input) => main.inMain.has(join(WORKSPACE, input)));
  if (inBoth.length) throw new Error(`fieldia.${part}.js carries ${inBoth.join(', ')}, which the main script has too`);
  for (const other of PARTS.filter((one) => one > part)) {
    const twice = partInputs[part].filter((input) => partInputs[other].includes(input));
    if (twice.length) throw new Error(`fieldia.${part}.js and fieldia.${other}.js both carry ${twice.join(', ')}: a part's code belongs to one part`);
  }
}
// The words the main script leaves out (tools/part-words.mjs) are read by none of its modules, and each one by the
// modules of the parts that bring it alone: read here from the modules this build put in each script.
{
  const { problems } = partWordsProblems({
    main: [...main.inMain].map((file) => file.replace(`${WORKSPACE}/`, '')),
    parts: Object.fromEntries(PARTS.map((part) => [part, partInputs[part]])),
    read: (file) => readerSource(WORKSPACE, file),
    tables: TABLE_KEYS,
  });
  if (problems.length) throw new Error(`the parts' own words (tools/part-words.mjs):\n  ${problems.join('\n  ')}`);
}

// Each language's add-on: its words from the three packages, handed to the main script's addLanguage.
for (const [locale, name] of Object.entries(LANGUAGES)) {
  await build({
    ...common,
    stdin: {
      contents: [
        `import { ${locale} as messages } from './libs/core/src/lib/record/locales/${locale}';`,
        `import { ${locale} as widgets } from './libs/widgets/src/lib/locales/${locale}';`,
        `import { ${locale} as viewer } from './libs/viewer/src/lib/locales/${locale}';`,
        `import { addOn } from './tools/script-language';`,
        `addOn('${locale}', { messages, widgets, viewer });`,
      ].join('\n'),
      resolveDir: WORKSPACE,
      sourcefile: `fieldia.${locale}.ts`,
      loader: 'ts',
    },
    banner: { js: `/*! Fieldia ${version} · ${name} · MIT · https://fieldia.dev */` },
    outfile: join(BUNDLE, `fieldia.${locale}.js`),
  });
}

// It must stand on its own: run it with nothing but a window and look for the viewer.
const sandbox = { window: {}, self: {}, globalThis: {} };
runInNewContext(readFileSync(OUT, 'utf8'), sandbox);
const Fieldia = sandbox.Fieldia;
for (const name of ['mountViewer', 'createMemoryDataSource', 'createForm', 'checkPage', 'translatePage', 'addLanguage']) {
  if (typeof Fieldia?.[name] !== 'function') throw new Error(`the script bundle does not define Fieldia.${name}`);
}
// Light enough for a page with no build step: no validation library, English alone, and under budget.
const code = readFileSync(OUT, 'utf8');
if (/ZodError|\$ZodType/.test(code)) throw new Error('the script bundle carries zod: something imports the format schemas');
for (const table of ['MESSAGES', 'WIDGET_LABELS', 'VIEWER_LABELS']) {
  const held = Object.keys(Fieldia[table] ?? {}).join(', ');
  if (held !== 'en') throw new Error(`the script bundle's ${table} holds ${held}: English alone belongs in it, the other languages in their add-ons`);
}
/** The tables as `addLanguage` names them, by the name Fieldia gives each. */
const GLOBAL_OF = { messages: 'MESSAGES', widgets: 'WIDGET_LABELS', viewer: 'VIEWER_LABELS' };
// Its English every word of the packages' but the parts' own, which they bring (tools/part-words.mjs).
for (const [table, keys] of Object.entries(TABLE_KEYS)) {
  const held = Object.keys(Fieldia[GLOBAL_OF[table]].en);
  const kept = keys.filter((key) => !CUT[table].includes(key));
  if (held.join() !== kept.join()) throw new Error(`the script bundle's ${GLOBAL_OF[table]}.en holds ${held.length} words, not the packages' ${keys.length} but the parts' own ${CUT[table].length}: ${[...held.filter((key) => !kept.includes(key)), ...kept.filter((key) => !held.includes(key))].slice(0, 5).join(', ')}`);
}
// esbuild writes ASCII, so an Arabic letter is an escape: \u0621 to \u064A (Arabic-Indic digits, read in numbers, sit above).
if (/\\u06[2-4][0-9a-f]/i.test(code)) throw new Error('the script bundle carries Arabic letters: some words in Arabic got past the add-on');
// 190 until 0.9; lists, their search bar and their groups take it to 192 with the stylesheets minified;
// the format's additions to 200. The seven question kinds (signature, slider, tags, pictures, ranking,
// address, repeating group) and shuffled options add 26; values worked out from others, values set by a
// condition and answer rules add 13; groups side by side, arrangements, group styles, labels and the
// page's look add 7. The page's translations, choices from the app's lists, the tick box and dialogs in
// the page's look add 2.5 more, to 252. The choices' details (a yes or no as two buttons, a limit on
// boxes ticked, "None of these", columns, a dropdown that searches, pictures' words and sizes, a ranking's
// top few, a matrix's cards on a phone) add 7, to 267. Several files with a count, their list and
// thumbnails, the viewer and their words in four languages add 12, to 279.
// The inputs' details (web, phone, email and time checks, a date's limits and weekends, a count of
// characters, units and currency symbols, ratings' icons, NPS colours, keywords' most, in four languages)
// add 8.3, to 281.7.
// The structures' details (a signature's ink, undo and upload; an address's line 2, region, country list and
// parts that must be filled; a table's least and most lines, moves and asking before a line goes; cards moved
// and copied; links searched in full and opened; a heading button; a picture's width, place, link and caption,
// in four languages) add 10, to 291.7.
// English alone in the one-tag script; the other languages as add-ons save 29.8, to 262.2.
// Each kind of part's own look (text boxes, choices, groups, buttons and tables: a ground, an edge,
// corners, a size of words and an accent, each kept readable in either scheme) adds 4.8, to 267.
// A saved form placed in another — the part checked, its answers nested under its name and checked by
// its own page, drawn in place from the app's pages, said in words when it cannot be — adds 6, to 273.
// A page's steps and moments checked as it is shown — the fields each step names, its expressions, the
// tabs and wizard steps it goes to — add 2.3, to 275.3.
// The steps run — each kind, a page opened and its answers taken back, the app's answers, the moments one
// at a time, a person's change told from a step's, and the events an app hears — add 8.2, to 283.5.
// A page in a side panel — the dialog's own code at the screen's edge, a width, Done for values, a question
// before Escape or × drops changes, panels stacked one stepped back, and its slide in — adds 1.6, to 285.1.
// The viewer as the host of a page's steps — a page opened in a dialog, a panel or in the form's place with
// Back, words said as toasts, a button busy while its steps run, a tab shown for a step, and the app's own
// host and onOpen over it — adds 4.2, to 289.3.
// A panel from any side — the start or end of the line, or the left, right, top or bottom whatever the page
// reads, a height for the top and bottom, each sliding in and stepping back from its own edge — adds 1, to 290.2.
// Files as cards — a picture over each one's name, cut in the middle across two lines — and a switch that
// lets a person flip them between a list and the pictures, kept as a preference, add 2.9, to 293.1.
// The real pages' defects mended — a statusbar searched again as its filter's values change, placeholders on
// links, tags and formatted text, Clear selection left out on request, a dialog's words said by its opener,
// a tab strip that fades and scrolls, rows of twelfths that fit a column, and tabs built when first shown and
// updated only while shown — add 6.8, to 300.1.
// What real Flectra pages need of steps and conditions — roles on any part, the record's id, the person and a
// line's parent read in conditions, Python's tuples and and/or values, counts and sums where a condition holds
// and days between dates, defaults handed to new lines, links and records, reload, a web address and a list of
// related records opened, a wizard's own footer buttons — and a table's own rules (cells by line, columns by
// record, tones, row buttons, drawn in the plain table) and help behind a (?) add 17.1, to 317.2.
// The rest of what real Flectra tables need — a field's value in a tone and a value as a pill, buttons for the
// lines chosen and beside Add a line, a line copied, a line opening its own record's page, a many2many as a
// table, lines as cards on a phone and columns fit to content, a part hidden on a phone, a line's money in its
// record's currency, setWhen on a field's change, no value twice in a column, contains and =? in filters —
// add 17.2, to 334.4.
// How a dense sheet reads, as Flectra draws one — read-only values as words and a choice as a badge, several
// ribbons by condition, alerts holding a field's value with buttons inside and alerts in a tab, stat buttons
// that format money, hours and dates with a unit and a second value, a statusbar's condition, time per step,
// folded stages and a click that saves, keys on buttons with Alt, parts for editing or reading only, links'
// pictures, address lines and tag colours, and parts on one line — add 21.1 more, to 355.5.
// The business widgets real ERP screens lean on — priority stars and a state's dot (on the title's line too),
// hours as HH:MM, a per cent, a live timer, a range of dates on its own calendar, tag colours, a value to copy,
// a PDF or a page shown inline, an analytic distribution, tax totals, payments, properties from a linked record
// added to in place, a column drawn by its own widget — and their stylesheet add 40.1 more, to 395.6.
// What sits around a record — the bar over it with the breadcrumbs, a gear menu that is a real menu and the
// pager the app fills, the record's own steps (archive, duplicate, delete, a post in its conversation) and
// another record shown in place, the attachment beside the sheet in the browser's own PDF viewer, and the
// side panel kept beside it (5.3 of it the stylesheet) — add 20.3 more, to 415.9.
// Phase 26's last ten — a line opened in a form of its own (its parts checked against the line, the record
// as parent, its own lines held in it), a placeholder by condition, a field focused as the record opens, a
// table's order, a line kept from deletion, the app's context in conditions and filters, a stat button's
// help, a distribution's words in a cell, a column for some roles, a calendar's pick announced — add 6, to 422.4.
// What using the real pages showed: a line that follows the pointer as it is dragged, lists that float over the page
// where no table or cell clips them, tables' columns sized by their values and cells quiet until worked in — add 4.4, to 426.8.
// The form fields' defects mended (a (?) that only shows its help, kept on screen; values cut with an ellipsis and shown
// whole on hover; links and dates filling their one-line rows; a number edited without grouping) — add 2.4, to 429.2;
// the grid's editors as wide as their values, headers wrapping, an empty grid saying so, and a floating list that
// follows its control however the page moves it — 0.6 more, to 429.8;
// the live real pages swept again (a link's editor wide enough to read, words kept with their value, a line's
// buttons held in sight, words in a number box said at once, a link reopened by a click, numbers' columns as wide
// as their values) — 2 more, to 431.8; the merged demo records' money spaced from its symbol, properties laid out
// as the sheet's fields — 0.7 more, to 432.5; eight themes in known systems' styles (Material, Fluent, Apple, Bootstrap,
// shadcn, Ant, Odoo, Google Forms), light and dark, with their own shapes — 11.9 more, to 444.4; Fieldia's tokens in a
// cascade layer, so a host's own colours win whole, and labels beside set at their value's top — 0.6 more, to 445.0;
// a host's tokens worn by the form and its dialogs (tokens, setTokens) — 0.4 more, to 445.4.
// A list's records on a map (the List, Map and both switch, the map's place beside the table, its records lit and
// chosen with the rows, the page's checks of a map) — 4.8 more, to 452.2; a map on a form (drawn by the app's maps, its
// layers checked: places, lines, routes, the reader's own place) — 3.3 more, to 455.5; a list's buttons on its map's
// cards — 0.6 more, to 456.1; a map's areas by colour, reachable areas, fences and tools checked on a page, and a
// list put nearest a place first — 1.1 more, to 457.2; Enter moving on from a one-line code editor, as from a
// text box — 0.1 more, to 457.3; an address with suggestions checked as a page is shown (a char field, the
// kinds of the fields it fills with a place and an address's parts) — 1.1 more, to 458.4. The quiet look, a third skin (each value plain words until pointed at or entered,
// as Azure DevOps draws a work item: its stylesheet of rest, hover and editing for every kind of field that wears it,
// a state's dot with its words and a tick, a date opened at a click, the empty field's words, Escape putting a value
// back, the lock of a field locked by a rule with why, a choice's chevron and a date's calendar right to left) — 12.2
// more, to 469.5 alone: two thirds of it the stylesheet, whose rules each name the quiet field to win over the themes' own shapes.
// The money look alone: an amount's money look (its currency by code, after it, short, the home one
// unsaid, "/month" on a rent) in every list, field and card, a map card's lines, units and link checked on a
// page and translated with it — 2.7 more, to 460.0.
// Together in 0.19, the address's checks, the quiet look and the money look: 473.3.
// A record's head, as a work tracker draws a bug in a popup over its backlog (0.20's wi-header): the kind's strip
// and badge, the title line with Copy title, the row of people and counts, buttons split, toggled and by their icon
// alone with the record's ⋮, the band of fields with their access keys and a lock at the value, "Updated by", the
// tabs in the head with their counts; the dialog's inset size, clear backdrop, maximise and grip, the head as its own
// head and foot; values the server keeps (stored); the page's checks of it all; and the work item's shared icons —
// 38.3 more, to 511.6: 15 of it the stylesheet, 3 the icons, 4.4 the checks.
// The work item's pickers (docs/plans/work-item-replica.md, lane wi-picker) — a path picker for a record of a tree
// with its suggestions, the person's latest picks, the tree folded to the value, each row's words at its end and the
// tree's keys; Fieldia's own list with a tick for a choice and a state's list; a state's exact colours and its dot in
// a lead slot; tags added from a button; a person's outline while no one is picked; their checks on a page; their
// stylesheet (7 of it) and the icons the replica's lanes share (3) — add 25.3, to 498.6.
// A work item's body, as a work tracker draws one: groups with their own column widths and gap, their heading's tools
// at its end (⤢ alone over the body, ^ and ⌄, a field's own Edit and Done), help in a light box with links in its words;
// the formatted text's own editor — its toolbar only while worked in, inside the box at its foot, twenty named tools in
// a roving bar with "…" for those with no room, colours, sizes and emoji in real menus, people and records linked as
// they are typed, Remove link saying why — Markdown both ways written by hand (no library: a CommonMark subset, raw
// HTML escaped) with its card, hint and Preview, asking before formatting is lost; a links box with Add link and its
// menu; the sanitizer's spans, pictures and links in place; and their stylesheet (16 of it) — 62.5 more, to 536.
// A work item's icons, drawn as Fieldia's own (icons-work.ts: its kind, its window's and toolbars' tools, history,
// branch and pull request), which every part of the work item's popup names — 3.0 more, to 476.3.
// A list drawn as a work tracker's backlog: its cells (a state's dot in its colour, a kind's icon before the title, a
// width in characters with "…" past it, the side its words keep to) and their page checks, no box to choose a row, the
// filter bar (a keyword, each field's values to tick from its choices or its records, the gear that chooses the
// fields, × that clears them, with their keys), rows nested under their parent with Expand all and Collapse all,
// the list asking again when a row's dialog closes, Fluent's list look, empty quiet fields that say nothing, and the
// work item's icons (3 of it, shared with the record head, the pickers, the text and the history), a dialog's focus past
// a hidden box and a quiet field's Escape after its record came — 21.5 more, to 494.8.
// Joined for 0.20, the work item's popup over its backlog: the five lanes above in one bundle, their icons once — 612.7.
// The popup and its backlog set side by side with the tracker's screens: a list's columns in pixels kept as given (the
// card scrolling sideways), headers a ranked list does not sort by, a filter's own name, the row of the record open lit,
// Fluent's list as measured (36px rows, its headers' and cells' insets, the toggles' room) and its slim scroll bar; the
// popup's own slim scroll bars and grip band, a state's list leaving its words bare, a path picker open without a ring,
// Markdown's own tool drawings, a ladybird, a padlock, two rings for a link, a filter of three lines, and the CSS that
// says why for each — 9.3 more, to 622.0.
// The second side-by-side: a list's header rules each column can drop or set in (and their page checks), a record
// opened by the app with no row lit, the links help's icon on a tile of its colour, an open path picker ringed with a
// halo and its own slim bar, Undo, Remove link and an empty comment's Save drawn idle with their reasons in their
// tooltips, the grip's triangle, the head's tab pills and icons, the filter bar's measured room, and the CSS that says
// why for each — 4.0 more, to 626.0.
// The work item's parts loaded on first use (libs/widgets/src/lib/parts.ts, each a script beside this one): a record's
// head with its band, its split and toggled buttons, a group's heading with its tools and the inset dialog's ⤢ and grip
// (fieldia.head.js); the formatted text's editors, Markdown both ways, their menus and the links box (fieldia.text.js);
// a path picker (fieldia.path.js); a choice in Fieldia's own list (fieldia.choice.js); a list's filter bar
// (fieldia.filters.js) — their code and their stylesheets out of this script, which keeps what every page draws at mount
// (the page's checks of a head, buttons, groups and list cells, which checkPage gives at once; a list's backlog cells,
// nested rows and Fluent's list look; a state's dot and the rows of Fieldia's lists it opens; the access key and a lock at
// a value; help boxes and a group's tracks; the work item's icons, which any page may name; the dialog's choice of its
// head) and the parts' loader with the table of names they share with it (1.9) — 104.4 less, to 521.6.
// The third side-by-side: the head's eye, back arrow, copy, paperclip, padlock and speech bubble redrawn in one-pixel
// lines as the tracker's, a person's outline as small as its, the State list's rows 30.3px apart, and the backlog's
// title lead and the room after its grid as measured — 0.2 more, to 521.8.
// 0.21's data source contract (docs/plans/wave1-contract.md): a loaded record with its version and permissions, a
// save's conflict, and the memory source keeping them — versions, a change from elsewhere, permissions kept to as a
// backend keeps them, every id a search matches, totals by field and group, a file stored with its progress — 3.4
// more, to 525.2.
// 0.21's safety kit: errors kept to their part (a widget, a slot, a map or any part that throws draws a box that names
// it, tells the console and onError, and the rest of the form goes on — libs/widgets/src/lib/contain.ts and the viewer's
// guards, the box's words and look), and the page format's versions (upgradePage, and checks that say a page is newer
// than this Fieldia) — 5.2 more, to 530.4.
// What Firefox and WebKit showed (a centred line written as a style in Firefox, an old align attribute kept as one, a
// group's parts in a flex column, as Safari lays a narrowed group's title out again only there) — 0.2 more, to 530.6.
// Then a group laid out as blocks instead, its gaps as margins (layout-styles.ts): Safari floats nothing in a flex
// column, so every card's title was drawn on the card's border — 0.2 more, to 530.8.
// Files stored as they are picked (0.21, lane w1-files): the form's uploads — three at a time, each photo made smaller
// first, put in its place in the order picked, a save that waits for them and stops under the field for one that
// failed, a file's bytes stored by the save and never kept in a draft — uploadTo for a plain endpoint or a signed
// address, the memory source as a slow store, a field's files on their way (a bar, × and Retry, said to a screen
// reader) and their stylesheet, photos made smaller with their EXIF turn, a signature's picture through the store, and
// the viewer saying why Save waits — 20.8 more, to 551.6 (with the safety kit's above).
// A photo picked in a table's cell stored as its line's, the cell showing its line's on their way (form.uploading),
// 0.2 more, to 551.8.
// Save safety on that contract (lane w1-save): the form keeping a record's version and what the person may do —
// fields locked or hidden, a save refused before the source is asked, Archive, Duplicate and Delete and the buttons
// that would do them hidden — a conflict's who, when and fields, Reload with the person's changes set aside to put
// back, Keep mine; the viewer's banner, the list of changes set aside, the line over a record only to read, a locked
// field’s reason, the gear menu’s note, their words and their stylesheet (2.3 of it) — 10.9 more, to 562.7 (over the
// safety kit's and the files').
// Keep mine reading the record first when a conflict did not carry it (so a source that saves whole records never
// wipes the other person's work), Put back kept at the end of its change's row on a phone, and what a field set aside
// holds now kept in its own direction (a phone number among Arabic words) — 0.4 more, to 563.1.
// 0.21's calendar (lane w1-calendar): a list's `calendar` (its start, end, words, colour, person, views, first day,
// hours and slot) with its page checks, and a list's switcher open to other views — each by its name and its own
// words, made the first time it is shown, asking the app for a new record (or the model's page in a dialog) — the
// calendar itself being @fieldia/calendar's, never in this script — 2.8 more, to 565.9 (over
// the three lanes above).
// The four lanes joined (the safety kit, files, save safety, the calendar), 0.05 more than the sum of their own: Save
// shown for a file on its way only where the person may edit, a reset letting go of both the uploads and the conflict,
// and the minifier's names a little longer with all four in one scope — 0.1 more, to 566.0.
// Wave 1's save safety mended (lane w1-fix-save): one save at a time, the next carrying the version the first got back;
// what changed while a save was on its way kept as a change, a new line keeping the id it was given; Keep mine saving
// nothing over a version it could not read, and the banner saying so; a saved form placed in a record storing its
// files for the record, its uploads shown, waited for and stopping the save; Retry taking the save's problem with it;
// drafts keeping files as before where there is no store; changes set aside asked about by every way out; a picture
// the browser cannot draw shown as its file's icon — 3.4 more (565.95 measured before, 569.33 after), to 569.4.
// A field that fails on the person's change keeps nothing it never showed (lane w1-fix-safety): the form each widget
// is handed notes what it writes in its field, the field goes back to the value it last showed and its box says so
// with that value, the focus it held goes to the box (named by its words, in the order the field had), a framework's
// component says what it drew, and a slot's or a part's box takes the focus too — 2.4 more, to 568.4.
// The two mended lanes joined (w1-fix-save, w1-fix-safety): 565.95 measured before either, 571.69 with both — their
// sum, nothing more for the join — to 571.7.
// Every way out asking before it leaves work behind (lane w1-fix-save2): Save & Close, a page's own button that saved
// or a `close` after a save, the pager, Duplicate, an action's answer naming another record, a page opened in a
// record's place, Done and answers sent each asking "Discard your changes?" when a change made while it saved, files
// on their way or changes set aside would go — one question, shared by the dialog and a page in place; the list's ×
// asking too; the focus after each button of the banner and the list on a field; the status saying "Saved, but not
// all your changes" (and "Sent, …" once answers went); Save & Close taking back the focus it let go of while it
// saved; and a field's box naming its value as the field shows it — 2.8 more (571.69 measured before, 574.49 after),
// to 574.5.
// A run that saved asks before it leaves what changed meanwhile: an action's answer naming another record after a
// `save` step, and a page in a record's place whose own button saves, then closes it, asked once — 0.2 more (574.49
// measured before, 574.68 after), to 574.7.
// One check in the form before its values go (lane w1-choke): `form.leave()` and `workAtRisk`, each change told by its
// origin and those of the person's a save went through without kept as `unsent`, the host's close taken once with the
// check before it, a reset step, a reload and an address in this tab through it too; the dialog's, the panel's and a
// page in place's own questions gone for it, each reporting a save that went through as saved however it closes; the
// pager looking up its next id before it saves; the breadcrumbs asking; the safety kit's focus passed on to a box that
// takes it — 0.7 more (574.68 measured before, 575.39 after), to 575.4.
// Ways out serialised, answers kept to their record (lane w1-serial): every way out waiting for the save on its way and
// the files on theirs (`leaving`, said where Saving… would be, and at a dialog's foot), a way out taken meanwhile
// joining it; each record shown a generation of its own, a save's or a call's answer laid only on the record it was
// started for and a run stopping on one replaced; the person's work at risk told against the record as the last save
// left it, a file the store holds that no save sent among it; `leaveNow`; Discard waiting too; the app's breadcrumbs
// inside a page in place through the record under it, its question shown over that page; Done saving a file on its
// way first — 2.9 more (575.39 measured before, 578.23 after), to 578.3.
// The input rules (0.21), what every box needs at mount: one set of readers in @fieldia/core — a number in any script
// with the page's marks or ٫ ، ٬, its places and digits, a pasted amount with its own currency or an accounting minus,
// hours, a date and a time in the page's order, words folded for finding (10.1); the box's guard on keystrokes, pastes,
// drops and an IME's edits, with its hint (5.2); text left that does not read, kept by the form and said as the box is
// left, and Save refusing it (1.4); the number boxes, shares, tax amounts and a bar's box on them (3.5); and the rules'
// English words (3.2) — 24.3 more, to 546.1. The hint floating under a table's cell or a grid's editor (above it where the
// table cuts it off), numbers read left to right in a right-to-left box, and the guard's names on window.Fieldia, 1.5
// more, to 547.6.
// The input rules for text (0.21): a text box's guard — a key at the most refused, a paste over it kept and counted
// by code point, a phone number's characters, an email's spaces, a line break pasted into one line — and what a box
// keeps once left (2.5); web addresses read as a browser does, localhost, IP addresses and ports, javascript: and its
// kind refused, a postcode by its country, a pattern about the whole answer with its digits folded, checkPage naming
// one that does not read (2.4); a property checked by its kind on its own row (1.6); tags ended at ، and line breaks,
// told when there already or past the most (1.2); JSON kept as typed with its reason in words (1.1); a colour's code
// box, its swatch empty when it has none, and a way to clear it (2.5) — 11.6 more, to 559.2.
// The dates', times' and choices' input rules — Fieldia's own date, date-and-time and time box in the page's order with
// its calendar on every date (date-box.ts, 6.8), a range's end checked as a field of its own with its note and limits on
// its calendar (0.8), a time's steps and stars' range checked, a file's kind by its name (1.4), and words typed into
// links, choices, tags, own answers and ranks taken or said, Arabic letters folded (2.8) — 11.5 more beside the text's
// (sharing their readers), to 570.7 (measured 570.62).
// The input rules in tables and lists: a table's totals that add only numbers and wait, in words, for the line that
// does not read, a cell's message linked to its box and said as it is left, words where a number goes shown as they
// are; a custom filter's value read and refused as every box's is, a day in the page's order, and words beside it when
// Apply waits; a list's search reading the page's numbers and a phone by its digits, the memory source finding them;
// and a formula's Arabic digits — 2.6 more, to 573.3 (measured 573.25). (A grid's block paste is the grid's own: never in this script.)
// Numbers never made of what was typed by dropping a key (0.20.1): the keys typed after a refused one held with it,
// Backspace taking them back, and leaving with them saying why (1.0); a decimal mark judged only once it can no longer
// group ("1.234,56" typed on an English page), trailing zeros no places, a 0 never leading a group, and a number read
// whole as its box is left or pasted (0.9); the boxes on it — a field's, an hours' or per cent's, shares, tax amounts in
// their currency's places, the custom filter's (0.7); the hint kept as a box is left with keys held, so nothing under
// the pointer moves (0.1) — 2.7 more, to 576.0 (measured 575.96). A formula list's numbers read as the formula's own
// (Arabic and Persian digits, ٫; never hex or an exponent) — 0.1 more, to 576.1 (measured 576.05).
// The input rules' last gaps (0.20.1): a date read as Fieldia writes it at rest, its month in words in any of its four
// languages from Intl's own names (none carried in the code), and an instant with its zone, and a year of two digits
// said with both centuries it could be (core 1.4; the date box's guard letting a month's name be typed, 0.4); the
// calendar closed as its box is left and saying why its text was not read, for a date and a range (0.6); a colour's
// code never changing the colour held (0.3); an email's link and zero-width characters cleaned, and its ":" refused
// (0.4); their English words (0.3) — 3.4 more; with the numbers' gaps above, measured together, to 579.8 (measured
// 579.75).
// Fieldia's own date box loaded on first use (0.20.1): the box with its guard and what it keeps once left, a date's
// calendar and a range of dates on its own calendar out of this script, into fieldia.date.js (date-box, calendar,
// date-range: 19.8 of code). This script keeps what every box that reads a date shares (date-text.ts) — the reader in
// the page's order, a date's words at rest and while typed, its placeholder and example, the ISO week (3.0) — and a
// plain box on that reader for a date drawn before its part came, or if it cannot come (1.0); the parts a table's lines
// and a properties field draw from, found before a page is drawn, and a saved form placed in a page waiting for its own
// as the page does (0.4); the date part's names in the parts' table and its wiring (0.3) — 15.0 less, to 564.8
// (measured 564.71).
// The keys that save, with the input rules (0.20.1): Enter in a one-line box never judged as typing, and a paste that
// says what it left out (0.2); every save, check and step forward reading what is still typed first — the form's
// readers, the viewer's change to the box typed in, a number's, hours', per cent's, share's and colour's reading
// split from their leaving (0.6); a phone number's, an email's, a line's and a colour code's keys held after a refused
// one (0.3); a time's or hours' one-digit minute named with both times it could be, never quietly :03, and the time a
// day leaves out named (0.8); a count of one said in the singular by the language's own rules (0.3); their English
// words (0.4) — 2.6 more, to 567.4 (measured 567.32).
// Every way a value is committed reading every kind of box (0.20.1): a save, a check and a step waiting for a name
// still looked up, a link's, tags', a choice's and a path's own reader of what is typed, a line's cells read no more
// once it goes, autosave waiting while a box is typed in, the hold kept through a paste, a drop, an IME and an
// autocorrection, a plain date box saying the time it leaves out, a count of one's own words for a language added,
// a designer's setting read before it publishes — 5.6 more, to 573.0 (measured 572.94).
// A late answer's words said though its record is gone, and a closed form's run stopping quietly — 0.1 more
// (578.23 measured before, 578.38 after), to 578.4.
// The input rules (0.21) and Wave 1 joined for 0.22: each line's growth above was measured on 0.20 alone; together,
// with the box-left call renamed boxLeft and unread text counted as unsaved work, 629.73 measured — to 629.8.
// The list screen loaded on first use (0.23 size pass): its table, rows under their parent and their groups, the
// records chosen and their buttons, the pager and the switcher to another view, the search bar with its menu, a filter
// of a person's own and the favourites, and its stylesheet out of this script, into fieldia.list.js (list, list-groups,
// search-bar, custom-filter, favourites, list-styles: 41.4 of code). This script keeps a list drawn before its part
// came, if it cannot come ("Loading…", then Retry: 0.8), the list's look put in a page by the designer's canvas
// through the part, and the names the list part takes from this script in the parts' table, and its wiring (0.4) —
// 629.78 measured before, 589.44 after, to 589.5.
// The looks loaded on first use (0.23 size pass): the eight themes — their tokens, light and dark, and their own
// shapes (themes.ts) — out of this script, into fieldia.themes.js, and the quiet look's sheet (styles-quiet.ts) into
// fieldia.quiet.js. This script keeps the page's look's tokens (look-styles.ts, cut from the layout's sheet, which the
// themes' sheet carries again after its own), a state's words and a field's lock (styles-lock.ts), a theme worn as its
// part comes with none meanwhile and the quiet look's sheet asked for as a quiet field is drawn (look-parts.ts), and the
// two parts a page's look names (viewer-parts.ts) — 629.78 measured before, 612.05 after: 17.7 less, to 612.1.
// A table of lines and a many2many's table of records loaded on first use (0.23): the table with its cells, grips, moves,
// sections, totals and ticks (lines-table, 12.6 of code), the records' table (links-table, 2.8) and their own rules — the
// grips and drags, columns sized to their kind, a line's tone and bold, sections and notes, cards on a phone (6.2 of
// CSS, minified) — out of this script, into fieldia.lines.js. This script keeps what a line is edited through, which a
// grid and cards draw with too (lines.ts: the form a cell sees, its unread text and its uploads as its line's, a
// column's total, a line's dialog: 2.4), the rules a grid's lines and a distribution's table share with a table's (the
// table, its heads and cells, ×, a line's buttons, the totals, the add buttons, the bar for lines chosen), the lines as
// plain words for a table drawn before its part came (lines-plain, 1.0), and the registry reading the widgets that
// import it back as a field is drawn — 20.1 less (629.78 measured before, 609.68 after), to 609.7.
// Flectra's business widgets loaded on first use (0.23): a record's statusbar, priority stars, the boxes hours and a per
// cent are typed in, an analytic distribution's lines, tax totals and payments, with their stylesheet, out of this
// script into fieldia.business.js (statusbar, priority, duration-box, distribution-lines, tax-totals, payments and their
// sheet: 24.1 of code). This script keeps how hours, a per cent and a distribution are written and read (a cell's, a
// total's, a pasted cell's), a state's dot (a work item's State, its list drawn as the pickers draw theirs), and each
// kind drawn plainly until its part comes (2.5) — 19.9 less, to 609.9 (629.78 measured before, 609.84 after).
// File and picture fields loaded on first use (0.23): a file field's list, thumbnails and cards with their switch and
// dialog, files on their way with their bar, × and Retry, photos made smaller, a signature's pad, a PDF under its file
// box and their stylesheet out of this script, into fieldia.files.js (files, files-going, shrink, signature, pdf,
// styles-files: 30.9 of code). This script keeps what the form does with files whatever draws them (core's uploads and
// a save that waits for them), a file shown as its dialog shows it, for a sheet's attachment preview (file-shown.ts),
// the names of the files a value holds for a field drawn before its part came, the fields a sheet's title names (its
// avatar, a picture) among the parts a page draws from, a save's status put back in its corner or across the top once
// a page that waited for its parts is drawn, and the part's names in the parts' table — 629.78 measured before, 602.14
// after: 27.6 less, to 602.2.
// The survey kinds loaded on first use (0.23): a ranking, a matrix, a slider, pictures to choose from, a colour,
// properties, an address and a progress bar, with the rules only they use, out of this script into fieldia.survey.js
// (ranking, matrix, slider, choice-images, colour, properties, address, progress and their two sheets: 35.0 of code).
// This script keeps the countries an address lists, which the designer and the map list too (countries.ts), and each
// kind's value shown plainly before its part came — a ranking's order, a matrix's answers by row, a colour's code, an
// address's lines, properties a line each, a slider in the number box (survey-plain.ts) — and the part's name in the
// parts' table: 30.2 less (629.78 measured before, 599.59 after), to 599.7.
// The six joined (0.23 size pass: the list screen, the looks, a table of lines, the business widgets, files, the survey
// kinds), each measured above against 0.22.0 alone; together, 629.78 measured before, 474.25 after — 155.5 less, to 474.3.
// Every late answer laid only on the record it was asked for (after 0.23.0): the form's one test (`recordShown`) and
// the guards that ask it — an onchange, a record step, a button's question, a change's steps run again, a check or a
// save waiting for a name, a step's own move, Keep mine — the person's claim told by a table's line, Discard putting
// their changes back as saved, a conflict waiting counted at risk (core, 2.0 of code); the parts' test (`whileShown`)
// and a link's, a line dialog's and a name's answers (widgets, 0.4); the pager told of a record deleted elsewhere, a
// locked record's pager, a dialog of values asking on Escape and `warnOnLeave` (viewer, 0.6): 474.29 measured before,
// 477.23 after — 2.9 more, to 477.3.
// Wave 2's autofill and bot check (0.24): what the browser fills each box in with and a phone's keyboard, the page's
// over the kind's own (kind-parts.ts, the boxes), a value the browser fills in read as typed (the guard's write in a box
// the person is not in, a number's, a date's and a long list's box read as left, the viewer's read of a box filled from
// a pick in another), and a public page's bot check (its hidden box, the time the answers took, the captcha's token on
// the send, their checks and words). The purposes the standard lists stay out, with the format's check
// (validatePage): the quick check keeps only that a box names what it holds and an address whose it is
// (autofill-group.ts). The bot check is in this script, not a part: 1.2 of it, 0.5 gzipped, on the very pages — a
// public sign-up — that are drawn the moment they are opened. 474.25 measured before, 477.88 after, to 477.9.
// The input rules held for names, tables and ways out (inputs-fix-names): a run of steps reading what is typed before
// it hands values on, and stopping on text that does not read (run.ts `typedFirst`, form.ts); text unread counted as
// work at risk and kept through Reload; a search asked for an exact name (core); a link's, its tags', a reference's
// and a choice's words of none kept unread on leaving, several of one name said, an exact name taken whatever row is
// reached, the IME's Enter left to it, tags waiting for room read by a save, a line's dialog and × reading what is
// typed, a box's words read when it is taken away without a blur, a box's words waiting for a press to end (widgets,
// press.ts): 480.83 measured before, 484.98 after — 4.2 more, to 485.0.
// The input rules checked again on 0.23 (inputs-fix-boxes): a part's box taking what was typed in its stand-in
// (partWidget's hand-over, 1.1), the plain hours and per cent reading as their part's box does (0.7), a date and time
// read in a time zone that says a time the clocks skip or pass twice, an instant's impossible day, a full-width keyboard's
// marks, the whole part's digits and a currency as people write it (core's readers, 2.8), JSON numbers kept as written
// (0.6), money read again when its currency changes, a date's and the email's words (widgets, 2.5) and their English
// words (0.6), a table cell placed for its hint as its box is entered: 480.83 measured before, 489.58 after — 8.8
// more, to 489.6.
// Lists that add up and filter by time (Wave 2, lane F): the words of a period, a date's span, a total and its kinds
// (labels.ts, 25 of them, in English), what both a list and the memory data source count days by — the day an instant
// falls on and a day's first moment in a time zone, the span a date falls in (core's periods.ts, 1.9) — the memory
// source's groups by a span and amounts totalled in one currency, a period kept in a facet and counted again, and the
// viewer's clock handed to a list: 474.29 measured before, 477.70 after — 3.4 more, to 477.8. Where a span ends, a
// period's days and their conditions, the totals row, a heading's sums and the menu's spans are the list part's.
// Lists people take away and change in bulk (0.24): the words of "Select all 1,284 that match", Export and Edit in the
// viewer's labels (29 of them), the page check of a list's bulkEdit and the fields it may offer (bulk-edit.ts), the
// memory source's writeMany, the viewer handing a list its toasts, its questions and its dialog of values, and the
// names the list part takes from this script — the list, the workbook and the zip themselves in the list part (listed
// with the part budgets below): 474.29 measured before, 477.31 after — 3.0 more, to 477.4.
// A phone read the world over (0.24): its words (a number's country, Call and WhatsApp, five reasons a number does not
// read), whether a page or a field reads its phones so (phone-settings.ts), the phone part asked for by such a field, a
// list's phone column and a line's dialog, a card's cells drawn with their column's widget, and a text box's hint taken
// away with it — the box, its country table and its sheet in fieldia.phone.js — 474.29 measured before, 475.79 after:
// 1.5 more, to 475.9.
// A page's time zone (0.24): its clock read with Intl (zones.ts in core: a zone's time, its day, the instants a time on
// it is, the change that skips one, 2.0), its zone written into its date and time fields (0.4), today on its clock,
// its name checked, and every reader and writer of a date and time on it — a box, a cell, a pasted cell, a filter, a
// list's words: a time the clocks repeat or skip said, a zone's name read back (date-text, 2.5), their English words —
// what every page that names a zone draws with, 6.2 of it. Booking slots (0.24): the data source's slots, the form's
// findSlots, the widget's checks, its part's name and its English words, 2.1 (the memory source's schedules are
// scheduleSlots, outside this script). A cell's date and time written as the box writes it, the instant it is rather than
// the clock it was written with, 0.3 less. 474.29 measured before, 482.29 after — 8.0 more, to 482.3.
// The business owner's walk of 0.23 mended, in what every page carries: a press kept to the button that was under the
// pointer (steady-press.ts), a box's message shown once the press that left it has ended (press.ts, the one mechanism
// the boxes' hints use too), a record's button that saves first and puts back what its steps wrote when its save is
// refused (core's runner), a record's title that wraps on a phone, lines named by their number among the items and a
// worked-out number that waits for its line, one message for a paste past a field's most, the currency sign where the
// language puts it — 474.25 measured before, 479.71 after: 5.5 more, to 479.8.
// 0.24's lanes joined, measured in the merged build: 474.29 at 0.23.0, 512.82 now — 38.5 more (the lanes' growths
// above add to 40.8: merged, two lanes' ways of one thing are one — one set of time zone functions, one press rule),
// to 512.9.
// A related list inside a record (Wave 3, w3-related): the format's part and its page check — its columns, order,
// search and cells held to its own records' fields (the list's own checks, shared now), its link to a many2one of
// theirs to this model, on a record's page — the form's `relatedFilter`, the viewer's box handing the list part its
// dialogs and its host's `open`, the list part asked for by a page with one, a list in a dialog closed with Close
// alone (nothing to save) and a dialog's own button hidden when it is (Save & Close showed for a record only to read
// too), and its six English words. Its heading, count, New, View all and asks are the list part's: 512.84 measured
// before, 515.32 after — 2.5 more, to 515.4.
// Record lists people read anywhere and shape themselves (0.25): the page check of a list's card, gallery, optional
// columns and its rows' tones, bold and buttons (references.ts) and their schemas, a card's words kept from
// translation, a row's buttons among the form's, the viewer's words for the gallery, the Columns menu and a row's
// buttons, the two parts' names and what asks for them, a record read as the form reads one, the person among it
// (form.recordReads, for a row's conditions), and the names the parts take from this script (a cell's words, a
// condition read, a card's lines, a phone's links by the phone part) — the cells in the list part, the cards and the
// gallery in the cards part, the Columns menu in the columns part, each with its sheet: 512.82 measured before, 515.16
// after — 2.4 more, to 515.2.
// A list's Import (0.25): its 67 words in English and a paste's two (the most of it), the page check of a list's
// import and the fields it may fill (import-fields.ts), the data source's createMany and importRecords, a new record's
// save from its values (newRecordSave), the memory source's createMany, the import part's name, and the lines and
// phone parts asked for by another part (loadLinesPart, loadPhonePart) — the dialog, the file's reading, the check and
// the writing in fieldia.import.js, the cells' readers in fieldia.lines.js (listed with the part budgets below):
// 512.84 measured before, 517.96 after — 5.1 more, to 518.0.
// On paper (0.25, Wave 3's print lane): the page's rules for paper, in every page's sheet (4.3 of it: a part loaded
// as printing begins comes too late — Chromium lays the page out for paper as its beforeprint is told, a sheet put in
// then is taken, one a task later is not, and Playwright's WebKit tells no beforeprint at all), what is done as
// printing begins and undone after (each tab not drawn yet drawn, each box's words beside it, the printout's head:
// print.ts), the page's `print` setting, a list's `print`, the built-in Print and the `print` step checked and run, an
// action's file handed to the host, and their English words — 512.84 measured before, 521.06 after: 8.2 more, to 521.1.
// A list's printout and an action's file shown are the list's and the files part's (listed with the part budgets below).
// With a dialog's form in front only it prints (the page behind, and the dialog's frame, left off the paper), a column
// of parts and the card laid out as blocks on paper (Firefox moved a grid's part it could not break to the next sheet
// whole), and a footer's words measured as paper writes them: 521.06 measured before, 522.19 after — 1.2 more, to 522.2.
// Possible duplicates and Merge (0.25, Wave 3): the data source's duplicates and merge on the form (findDuplicates,
// readRecord, merge and whether it can), the memory source's merge — the values picked written, the others taken
// away, every link to them moved — and its duplicates through its option (alikeRecords, the likeness of names, is
// outside this script, as scheduleSlots is), the page check of a page's duplicates, their 20 English words, and the
// viewer asking for the part where the page and its source both ask — the notes, the merge's screen and their sheet
// in fieldia.duplicates.js — 512.84 measured before, 517.05 after: 4.2 more, to 517.1.
// Wave 3's five lanes joined for 0.25 (related lists, cards and columns, Import, paper, possible duplicates), with a
// related list's cards on a phone, a list printed in the columns shown and a related list's "5 of 23" on paper,
// measured in the merged build: 512.84 at 0.24.0, 536.48 now — 23.6 more (the lanes' growths above add to 23.5), to
// 536.5.
// The 0.25 size pass: what only some pages draw cut out again into the parts that need it — a link to other records (a
// many2one's and a reference's box, a many2many's tags and checkboxes, a char field's tags: relations.ts, 18.1) in a
// part of its own, fieldia.relations.js, each drawn plainly meanwhile (relations-plain.ts, 2.2 of it here); a long
// choice's search box and several answers as tags in the choice part (choice-tags, 4.7); a one2many's cards with their
// rules in the lines part (cards, line-moves, 4.6); a value to copy and a live timer with their rules in the business
// part (copy, timer, 2.8) — 512.84 measured at 0.24.0, 485.55 after: 27.3 less, to 485.6.
// The size pass joined with Wave 3 for 0.25, measured in the merged build: 512.84 at 0.24.0, 509.23 now — 3.6 less
// (Wave 3's 23.64 more and the size pass's 27.29 less, their sum to a twentieth), to 509.3.
// A related list's rows' tones, bold and buttons, as a list's (their schema, their page check on its own records'
// fields, its row buttons among the form's, a record read with another model's fields): 509.23 measured before,
// 509.67 after — 0.4 more, to 509.7.
// The owner's walk of 0.24 mended, its site lane (walkfix-site): a button pressed takes away the toasts earlier presses
// left — 509.67 measured before, 509.73 after, to 509.8.
// The business owner's walk of 0.24 mended (0.25), in what every page carries: a value worked out from a table's lines
// waits while a line holds text that does not read (core's waitsFor, the viewer's dash said in words), a booking's
// times kept steady under a double-click, a list that drops open only for a person, a record's labels above their
// values on a phone and its title kept whole, the words for a phone's letters, a list's several currencies and a CSV
// file's currency column — 512.84 measured before, 515.53 after: 2.7 more, to 515.6.
// The owner's walk of 0.24 mended, its engine lane joined (walkfix-engine; its own lines above, measured on 0.24.0):
// values worked out from lines waiting for one that does not read, lists that drop open only when a person asks,
// several currencies said, phone records' labels above their values — 509.73 measured before, 512.44 after: 2.7 more,
// to 512.5.
// The English words only a part reads, out of this script into the parts that read them (tools/part-words.mjs: 345 of
// the 665 words in its tables, 153 of the widgets' and 192 of the viewer's — a list's, Import's, Export's, Print's,
// Edit's, a file's, a table of lines', possible duplicates', a booking's slots', a phone's, the survey kinds', the
// text's…), each part putting its own in the tables as it comes, and the viewer's words read as they are drawn
// (viewerWords) — 509.23 measured before, 497.88 after: 11.4 less, to 497.9.
// The words lane joined with every other lane (size-words; its line above measured on the size pass's tip): 512.44
// measured before, 500.97 after — 11.5 less, to 501.0.
// A tab's count of a related list in it (open-small): which list a tab counts, checked and found (relatedInTab), its
// pill asked for the count through the list part, and the pill's look out of the head part into this sheet, where a
// count on any page's tab is drawn (it was unstyled without a head) — 500.98 measured before, 502.13 after: 1.2 more,
// to 502.2.
// A related list's rows and New the app's own way (open-small, `"open": "app"`): the app's way handed to the list,
// with the page it gives for the model — 502.13 measured before, 502.28 after: 0.2 more, to 502.3.
// A page names its records (0.26, open-names): the page's `records` read and checked, a sentence said in its words
// (recordSentence) — the form's questions before Archive and Delete, why it may not, why a run stopped, what letting
// changes go asks; a record's crumb, its pager, the gear's This record, someone else's save, a record only to be read,
// a list that could not load — their 19 English sentences beside the plain ones, a language's or an app's own sentence
// said where it gives none with a noun, and a related list asking the app's page for its model what its records are
// called: 500.97 measured before, 504.04 after — 3.1 more, to 504.1.
// Every label inside a sentence small where the page asks (`lowerLabels`), by one rule (labelAt): the form's
// messages filled through it (fillMessage: "Choose at least 2 for interests", "End date can’t be before start date"),
// the viewer's own — a refused save's Check, a help's and a lock's names, a value that waits, a field not shown — and
// the search's suggestion; the quiet look's hint by the same rule — 504.04 measured before, 505.18 after: 1.1 more,
// to 505.2.
// A line's own dialog says its labels as its record's page asks, unless its own page says otherwise, the page's
// `lowerLabels` a setting of its own beside `records`: 505.18 measured before, 505.33 after — 0.2 more, to 505.4.
// A record's footer under every sheet and each heading kept with what follows it on paper (0.26, open-print): the print
// rules' grids as blocks with their parts side by side in lines, the content a table whose footer group the footer is,
// a box under each heading as tall as its start, a short group one box, measured as printing begins (print.ts) —
// rules for paper that a part loaded at beforeprint brings too late — 500.98 measured before, 507.84 after: 6.9 more,
// to 507.9.
// The four open-items lanes joined (0.26: open-small, open-columns, open-names, open-print — each line above measured on
// 0.25.0), with a list's shaped columns, a grid's moved ones and a work item's title on paper across them (all in the
// parts' sheets): 500.98 measured on 0.25.0, 513.49 after — the lanes' 1.30, 4.35 and 6.86 added up — to 513.5.
// A related list's View all says what its list is kept to as chips a person may take away (`OpenRequest.search` opened
// as the list's `listSearch`), and the memory source numbers a new line after every line of the records it was given
// (0.26, the owner walk's site lane): 513.49 measured before, 513.94 after — 0.45 more, to 514.0.
// The owner's walk of 0.25 mended in the engine (0.26, walkfix26-engine): every dialog's Escape asks about every change,
// a line not added yet searched by what it starts with (a pasted row's names read first), a grid drawn for paper told so,
// and on paper a record's own name or its noun and stage over it, its printout's lines one each — a line of an empty
// value left out — no required star, what its page leaves off left off, every grid's groups lines a sheet breaks between,
// grids side by side by the sheet's width (a media query: Firefox drew a box a container query changed nothing of) —
// rules for paper the main sheet must hold: 513.49 measured before, 515.07 after — 1.6 more, to 515.1.
// The owner's walk's two lanes joined (site and engine, each line above measured on the four lanes' tip): 513.49
// measured before, 515.51 after — their 0.45 and 1.58 added up — to 515.6.
// Print on intent (0.26, size-026): the whole look on paper — its rules for paper (9.70 of the main script, 2.6 of it
// gzipped: 4.89 at 0.25.0, grown by the open-print and walk-fix lanes), what is done as printing begins (print.ts,
// 5.84) — moved into a part of its own, fieldia.print.js, loaded as a person shows they mean to print: Ctrl+P, which
// Fieldia holds back while it comes, every Print waiting for it, the gear opened, a pointer resting on a Print, a page
// meant for paper drawn. A part loaded at beforeprint comes too late, so the browser's own menu before it came prints
// a plain look the main sheet keeps (buttons, bars, the side, hints left out, light colours), and asks for the part —
// with the printout's parts kept off the screen, 1.17 of the main sheet. The main script keeps the printout's head and
// footer, made as a form is drawn (the screen's every element as it was), and Ctrl+P's and intent's watch (print.ts,
// 2.17): 515.51 measured before, 503.40 after — 12.1 less, to 503.5.
// "It's someone new" kept on the app's server (0.27, loose-0262): the form's keepsNotDuplicates, notDuplicates and
// markNotDuplicate, the memory source's pair of them over the pairs it keeps (`notDuplicatePairs`) — every page's, as
// the form and the memory source are: 503.41 measured before, 504.52 after — 1.1 more, to 504.6.
// A signature that signs answers (0.27, w4-signature): what every page with a form needs of it stays here — the answers
// a signature of the page that signs them kept locked, read from its value (core's signed.ts, `evidenceOf`, `signedBy`,
// `signsAnswers`), the form's `now`, `user` and `shownFields`, a signed answer's lock saying how to change it (one
// word), the evidence part's holder and its place in `partsFor`, and the names the parts take from the main script's
// modules for it (the day's words, a label in a sentence, the late answers' test); the canonical form, the fingerprint
// and the signature's evidence are the evidence part's, fieldia.evidence.js: 503.41 measured before, 505.87 after —
// 2.5 more, to 505.9. Whether a part asked for again once it failed can come (`Part.asksAgain`: the one-tag script's
// tags can, an app's modules cannot — the browser keeps them failed), so nothing offers a Try again that cannot work:
// 505.87 to 506.09, to 506.1.
// Filters that sales teams and buyers expect (0.27, w4-filters): a field's range one value of one chip, read by
// facetsToFilter as `>=` and `<=` (a date and time's days as the list counts them), the page's `filterRanges`,
// `filterCounts` and `filterSheet` in its schema and its checks, and the memory source counting a record of links under
// each of them: 503.41 measured before, 505.15 after — 1.74 more, to 505.2.
// Tables inside formatted text (0.27, w4-rich-tables): every formatted text keeps a table — its cells, a cell's span
// over its neighbours, a header's scope, the way its columns run, a cell's alignment, and words a style makes bold,
// italic, underlined or struck as elements (a bold its style undoes, Google Docs' wrapper, its words) — wherever it is
// stored, loaded or shown, so the sanitizer every page draws formatted text through grows (sanitize.ts, 2.1 of 5.1);
// the classic editor's look for a table and its paste of anything with HTML in it, made plain by the text part's cleaner
// as it is pasted (extras.ts); a table's rows whole on paper, its box a block, before the print part came: 503.41
// measured before, 505.57 after — 2.2 more, to 505.6.
// Endings and the answers in a page's own words (0.27, w4-endings): the page check of every `{field}` in a label, a
// help, a choice, a step, a wizard's and a button's words and of a page's `endings` (1.13), the form's answer to a send
// kept and its ending chosen, its words and a field's label in its messages filled in (form.words, ending, 1.17), the
// viewer drawing those words, asking for the answers part where a page has any and handing it the done screen (1.15),
// a choice's words kept to its options (0.13) and the stylesheet's ending (0.13); writing a value as a sentence says it
// (a day in the page's order, yes or no), choices whose words follow the answers, a link's address and an ending's
// drawing are in fieldia.answers.js — 503.40 measured before, 507.19 after: 3.8 more, to 507.2.
// The words said while an answer is empty (w4-endings, `{branch|this branch}`): read after a bar wherever a page's
// words show values, a text's and a post's too, drawn in the words' own weight — 507.19 measured before, 507.40 after:
// 0.2 more, to 507.5.
// A table line's choices from the app's lists (0.27, w4-line-choices): the form asks each line's by its own values,
// shares one ask among lines alike, follows the columns they change with on each line and clears a choice its new
// choices do not offer, naming it, checks a line's value against its own line's choices, and a line's own form clears
// the same way (form.ts, line-choices.ts); the page's checks refuse a column the line has not (references.ts); the
// cell's form gives its line's choices, a line's column read at rest by its label (lines.ts), the cell says a choice
// cleared (choices-from.ts) — the form's work every page with a table runs, which no part can bring: 503.41 measured
// before, 507.72 after — 4.3 more, to 507.8.
// More functions, the app's own, and options that follow the answers (0.27, w4-rules): the formula language's sixteen
// new functions and their days counted by months (functions.ts 2.6, dates.ts 1.0) — read as the form is made, before
// any part could come; the app's own functions and the answers of those that ask, which a value waits for and a save
// waits on (app-functions.ts 1.4, the form's 1.6); options shown by a condition and carried from another question, taken
// out of an answer at the form's every write and said (the form's 2.5, choices-from.ts 0.4, choice-options.ts 0.5);
// their checks as a page is shown (references.ts 1.2); a value asked shown as an ellipsis, said (viewer.ts 0.4); an
// app function's numbers tidied as Fieldia's own arithmetic tidies them: 503.41 measured before, 516.94 after — 13.5
// more, to 517.0.
// Opening, closing and limiting a page, and save and resume (0.27, w4-limits): the form's limits — open and close
// dates read on the page's clock, the data source's counts asked as it opens, again before its answers go and after,
// its questions held while they are asked, each choice's places and a full one refused when picked or held, the
// answers refused once it closed (taking.ts, 2.7; form.ts) — drafts on the app's server, one at a time under one key,
// with the wizard's step and text that does not read, a draft opened by its key and never laid over typing, Continue
// later (form.ts, drafts.ts), the memory source's counts and drafts, the page checks of both, their six English
// sentences, an option's places drawn beside its words in the radios, checkboxes and the browser's list (seats.ts),
// and the viewer placing the limits part's screen, banner and button — the screen and Continue later's words in
// fieldia.limits.js — and a draft's text that did not read said again as it opens, the questions shown after 10 seconds
// of a source that never answers: 503.41 measured before, 515.71 after — 12.3 more, to 515.8.
// All merged for 0.27.0 (provisional until the size step): the lanes' 503.41 + 1.11 + 2.68 + 1.74 + 2.16 + 4.00 + 4.31 +
// 13.53 + 12.30 is 545.24; the merged build with the cross-lane jobs (one optionsFrom, a line's options by condition
// and one rule for what is taken out, endings reading the functions, places in every way a choice is drawn) measured
// 547.63, to 547.7.
// The 0.27 size pass, each move measured after the one before: a memory source's members in a part of their own
// (fieldia.memory.js, 16.07), the one-tag script handing its source over at once with what it keeps — its records,
// responses, calls, drafts and versions, someone else's change — and each member answering once its part came: 547.63
// measured before, 534.54 after; the bodies of the formula language's sixteen functions beyond the plain ones in
// @fieldia/core's functions part (fieldia.functions.js, 4.32), with the days they count — their names and what each
// takes kept, so a page reads and checks as ever, a value worked out from one waiting for it as for an app's function
// that asks — 532.31 after; a form's limits beside the viewer's in the limits part (fieldia.limits.js) — when the page
// takes answers and each choice's places worked out, its counts asked as it opens, again before its answers go and
// after, a full choice refused, and why it takes none now in words — a page with limits or places waiting for it, 529.28
// after; options shown by a condition and carried from an earlier question in @fieldia/core's options part
// (fieldia.options.js, 3.93) — what a choice offers, a chosen one a change no longer offers taken out — a page with any
// waiting for it, 527.69 after; the page checks of what a part draws carried by that part, run once it came before the
// page is drawn — a list page's own settings in the list part, a record's head in the head part, a page's limits and
// Continue later in the limits part (the packages' checkPage and validatePage whole as ever) — 517.55 after; a related
// list's in the list part, booking slots' settings in the slots part, a signature's in the files part and a page's
// endings in the answers part, 515.34 after; a map's checks — a form's map and a list's on one — in a part of their own
// (fieldia.mapchecks.js, 5.76), asked for by the viewer as the check owes them, 511.39 after; a table of lines' own
// settings in the lines part, 509.75 after; the app's own functions' calls in the functions part, which a viewer given
// some waits for — their names and what each takes known at once — 509.19 after; a sheet's statusbar's checks in the
// business part, a table's line kinds' in the lines part and an address with suggestions' with a map's, 506.85 after;
// the functions part waited for only by a page whose formulas call the app's own (the demos give theirs to every page),
// 506.96 after; what a list shows of its records (its columns, cards) and options by condition and carried checked by
// the parts that draw them, 504.85 after; Copy title's and Export's words in the parts that read them alone, 504.82
// after, to 504.9.
// The owner's walk of 0.27 mended (0.27.1), what a form needs of it in the form itself, where every page's checks and
// values are worked out — measured in the main script's modules: a value worked out from an answer the form refuses
// waiting for it, as for text that does not read (0.23 in the form); a note of options taken out said only while true,
// each note's options kept to judge it (0.70); a label that is a question quoted wherever a sentence names it, its
// required message asking for it (0.53, the widgets' words with it); a day a message names written as the page's date
// boxes write it, in its order and language (0.40; a time after it in the limits part): 504.82 measured before, 506.74
// after, to 506.8; merged with the site's fixes (0.28.0), `quotedLabel` named on the runtime again, 506.76.
// A record's approvals (0.29, w5-approvals), what every page with `approval` needs before its part comes, the rest in
// fieldia.approvals.js: the form asking for them after a load and a save, its fields locked while one waits (the node's
// state, fieldReadonly), refreshApprovals, decide and approvalLock, the part asked for (0.63); the viewer placing its
// band under a sheet's alerts and a lock saying why (0.34); the parts' declarations, partsFor and the page's checks owed
// until the part comes (0.31); the memory source's two members named (0.02): 506.76 measured before, 507.99 after, to
// 508.0.
// A list's cells changed in place (Wave 5, w5-editable-list): its code, its sheet and its page checks in the editable
// part (fieldia.editable.js); in the main script only what every page's drawing asks before it draws — partsFor knowing
// a list changes its cells, so it asks for the editable part and each such column's box's own part (a link's, a day's)
// and the page is drawn whole (viewer-parts 0.37), by the one rule of which columns a cell changes, which the part's
// check reads too (list-editable 0.26); a list page's viewer handing its list a row's form and a field's box, made as
// the page's own (viewer 0.18); the reference check owing the part its checks (0.14); the names the parts take from the
// main script and the global's (0.23) — 506.77 measured before, 507.91 after, to 508.0.
// A text kept in several languages (0.29, w5-two-languages), what every page asks of it alone — the switch, the checks
// in each language, the reader's text and a list's mark are the languages part's (fieldia.languages.js, 10.78): whether
// a field keeps its text in several, and so whether a page asks for the part, before it is drawn (`languagesOf`,
// `hasLanguages`, the part's loader; partsFor's three asks — a page's, a related list's, a many2many's records' — 0.28);
// a form asking for its part and a save waiting for it (0.12); a value typed in none of its languages empty, and one
// checked by the part, never "must be text" (0.14); createWidget, widgetPart, displayValue and readsAsText sending a
// text in several languages to the part, its first text read until it comes (0.39); the part's page check's stand-in
// owing it, its sheet's rank and the names it shares with the main script (0.35): 506.76 measured before, 508.03
// after, to 508.1.
// AI help (0.29, lane w5-ai), all of it in fieldia.assist.js but what a page needs to ask for it and place what it draws:
// the part's handle and whether a page asks for it — a Fill from text, a text field's tools, a list's words read as
// filters (viewer-parts, 0.15) — the kit made as the page is drawn, its bar over the questions (a sheet's over its card,
// Fill from text among its buttons), its hook as a field is drawn and the app's own `propose` (viewer, 0.51); the two
// checks the part carries, owed until it came, as every part's checks are (assist-checks' stand-ins and their calls,
// 0.30); a memory source's AI members only where its `assist` answers them (0.07): 506.76 measured before, 507.80
// after, to 507.9.
// A photo set (0.29, w5-photos), all of it in fieldia.photos.js but what every page with a form needs to know of one:
// the photos part's holder and the files part's for it (widget-parts.ts, 0.11), `image.photos` among the widgets (0.05),
// its place among the parts' sheets (0.01), its name on the global and in the parts' shared table (0.03); a photo set on
// a field that is not an image field of several photos refused by the page's check (0.17), which runs before anything
// is drawn and before any part is asked for, as a signature's and booking slots' are; and a file stored for bytes the
// field holds, its link in their place with the words beside them as they stand then — a caption typed meanwhile —
// in the form's uploads (0.07), which every page with a file field has: 506.77 measured before, 507.20 after, to 507.3.
// A code scanned with the camera (0.29, w5-scan): every page carries only what knows a field is scanned into and asks
// for the scan part — the parts' two holders, the decode part's for the scan part (0.12), a field's widget drawn by the
// scan part once it came, as a part's widget is (`scans`, 0.04 in widgets.ts), the reference check owing the scan
// part's checks of a page that scans (0.21 with its stand-in), the viewer asking for the scan part (0.02), a link's
// search by the field holding its records' codes (`SearchOptions.field`, 0.06), their names on the global (0.07) —
// 506.77 measured before, 507.32 after, to 507.4. The Scan button, the camera's sheet, the codes read and written, a
// table counted and the page's checks of them are the scan part's (fieldia.scan.js), the reader of codes for a browser
// with none the decode part's (fieldia.decode.js), asked for only as Scan is pressed there.
// Merged (0.29.0), Wave 5's lanes together — the hooks above, every page's — 512.44 measured; then the size step: the
// uploads' work (a file made ready and sent, its stored link put in its field, in place of bytes a save stores) out of
// the main script into the files part, which a page with a file field loads before it is drawn and a form asks for as
// it first sends a file (core's files-part.ts, the form keeping its queue and its ids): 510.59, to 510.6.
// A work item's menus and tags (lane atloria-wi): every page with a gear menu carries only the hooks that let a menu
// hold dividers and menus of its own — an item drawn by one function the head part's menus share, a divider's line,
// the item that opens a menu left to the head part (record-bar.ts, 0.38), the head part asked for by a page whose
// menus have either (viewer-parts.ts, 0.10), handed to the bar (0.03), the item's check sending a divider and such an
// item to the head part's checks (head-checks.ts and its stand-in, 0.17); the flyout, its keys and pointer, the app's
// items asked as a menu opens, the dividers left only between items that show, and those checks are the head part's
// (menu-flyout.ts, sheet-head-checks.ts). Tags inline in a head's row are its stylesheet's, a rich text read first the
// text part's: 510.59 measured before, 511.21 after, to 511.3.
// The owner's walk of 0.29 mended (walkfix29-engine), 107 bytes, each for every page or for what parts take from it rather
// than a copy: a muted pill's shade made over the surface, so a hovered row keeps its words' contrast (styles.ts, 12);
// asking first in place taking its own answers and owning its Escape — a dialog holding changes asks "Discard your
// changes?" with it, as a record's dialog does, and a question's Escape closes no dialog round it (kind-parts.ts, 34);
// askFirst handed to the parts, and what else they now take from the main script — isEmpty, drawIcon, formatNumber,
// inPlural, scanPart (the shared table and the entry, 61). 511.22 measured before, 511.33 after, to 511.4.
const BUDGET_KB = 511.4;
if (statSync(OUT).size > BUDGET_KB * 1024) throw new Error(`the script bundle is ${Math.round(statSync(OUT).size / 1024)} KB, over its ${BUDGET_KB} KB budget`);
// What a visitor downloads: the bundle gzipped, as servers send it. 76 at 0.9; the choices' details add
// 2.3 and several files with their viewer 3.9, to 82.3; the inputs' details (web, phone, email and time
// checked, a date's limits, a count of characters, units and symbols, rating looks and NPS) 2.8, to 85.1;
// signatures' pens and undo, addresses' parts and countries, lines' and cards' moves and pictures' captions
// 3.4, to 88.5. English alone, the other languages as add-ons (fieldia.ar.js, …) save 8, to 80.6.
// Each kind of part's own look adds 1.2, to 81.8; a saved form placed in another, its answers nested
// and checked inside it, 2.3, to 84.1; a page's steps checked, 0.6, to 84.7; the steps run, the moments
// and the events an app hears, 3, to 87.7; a page in a side panel, 0.5, to 88.2; the viewer as the host
// of the steps (pages opened, toasts, busy buttons, tabs shown), 1.7, to 89.5; a panel from any side, 0.3, to 89.8;
// files as cards and the switch between them and a list, 1, to 90.8; the real pages' defects mended, 1.9, to 92.7;
// what real Flectra pages need of steps, conditions, defaults and tables' own rules, and help behind a (?), 5.1, to 97.8;
// the rest of what real Flectra tables need (tones on a field, chosen lines, line pages, cards on a phone,
// hideOn, a line's money in its record's currency, setWhen on a change, distinct, contains and =?), 4.3, to 102.1.
// how a dense sheet reads (values as words, ribbons, alerts, stat buttons, statusbar, keys, links, lines), 6 more, to 108.1.
// the business widgets (stars, a state's dot, HH:MM, per cents, a timer, a range of dates, colours, copy, a PDF and
// a page inline, a distribution, tax totals, payments, linked properties, a column's own widget), 11.9 more, to 120.
// what sits around a record (breadcrumbs, gear menu, pager, the record's own steps and posts, the attachment beside it), 5.9 more, to 125.9.
// Phase 26's last ten (a line's own form, placeholders by condition, focus on open, order, a line kept, context,
// a stat button's help, a distribution's words, a column's roles, a calendar's pick), 2.2 more, to 128.2.
// what using the real pages showed (a dragged line following the pointer, floating lists, columns by their values), 1.5 more, to 129.7.
// the form fields' defects mended (help kept on screen, cut values shown whole, one-line rows, numbers edited plain), 0.7 more, to 130.4.
// the live real pages swept again (wide link editors, words with their values, buttons in sight, numbers checked), 0.7 more, to 131.1.
// eight themes, light and dark, with their own shapes, 3.3 more, to 134.3.
// a host's colours: tokens in a cascade layer, the tokens option, labels at their value's top, 0.4 more, to 134.7.
// a list's records on a map (the view switch, the map beside the table, its page checks), 1.4 more, to 137.5;
// a map on a form, its layers checked, 0.8 more, to 138.3.
// a map's areas, reachable areas, fences and tools checked, a list nearest a place first, 0.8 more, to 139.1.
// the quiet look, a third skin: its stylesheet, the empty field’s words, Escape, the lock and why, 2.4 more, to 141.5.
// an amount's money look, and a map card's lines, units and link checked and translated, 0.7 more, to 139.8.
// together in 0.19 (an address's checks, the quiet look, the money look), to 142.7.
// a record's head and its popup (the strip, badge, title line, row, split and toggled buttons, band, head tabs,
// inset dialog with maximise and grip, stored values, their checks, the work item's icons), 10 more, to 152.7.
// the work item's pickers (a path picker and its tree, own lists with a tick, a state's colours, tags from a button,
// their stylesheet and the replica's shared icons), 7 more, to 149.7.
// a work item's body (groups' widths and heading tools, help boxes, the formatted text's editor with its Markdown, menus
// and links in place, a links box, and their stylesheet), 19.4 more, to 162.1.
// a work item's icons (icons-work.ts), 1.0 more, to 143.7.
// a list drawn as a backlog (cells, the filter bar, rows under their parent, Fluent's list look) and the work item's icons, 6.6 more, to 149.3.
// Joined for 0.20 (the five work item lanes in one bundle, their shared icons once), to 182.5.
// set side by side with the tracker's screens (a list's pixel columns, unsorted headers, a filter's own name, the open
// row lit, Fluent's list as measured, slim scroll bars, the state's and path's open looks, Markdown's tool drawings,
// the redrawn icons), 1.8 more, to 184.3.
// the second side-by-side (header rules, an unlit open, a help icon's tile, the picker's halo and bar, idle buttons
// with their reasons, the grip's triangle, the tabs' pills, the filter bar's room), 0.7 more, to 185.0.
// the work item's parts loaded on first use, each a script of its own (a record's head and its window, the formatted
// text's editors with their Markdown and menus, a path picker, Fieldia's own list for a choice, a filter bar): 27.1 less,
// to 157.9 — 15.2 over 0.19's 142.7, for what a page draws at mount (listed with the raw budget above).
// the third side-by-side (the head's icons in one-pixel lines, a smaller outline, the State list's pitch, the backlog's
// lead and the room after its grid), 0.1 more, to 158.0.
// 0.21's data source contract (a loaded record's version and permissions, a save's conflict, and the memory source
// keeping them, with every matching id, totals and a stored file's progress), 1.4 more, to 159.4.
// 0.21's safety kit (errors kept to their part, with the box that names it; the page format's versions and upgradePage,
// listed with the raw budget above), 1.9 more, to 161.3; what Firefox and WebKit showed (listed there too), 0.1, to 161.4.
// files stored as they are picked (the form's uploads and a save that waits for them, uploadTo, files on their way
// with a bar, × and Retry and their stylesheet, photos made smaller, the viewer saying why Save waits), 7.5 more, to 168.9.
// Save safety on that contract (a conflict's banner with Reload and Keep mine, the changes set aside, a record only to
// read and what the person may do kept to, with their words and stylesheet), 3.5 more, to 172.4.
// Keep mine reading the record first when a conflict did not carry it, Put back at the end of its row, and the value
// it holds now in its own direction, 0.1 more, to 172.5.
// 0.21's calendar (a list's `calendar` and its checks, the switcher open to other views and a new record asked of the
// app; the calendar itself is @fieldia/calendar's), 1.0 more, to 173.5.
// The four lanes joined (listed with the raw budget above), 0.04 more than their sum, 0.1 more, to 173.6.
// Wave 1's save safety mended (listed with the raw budget above): 173.54 measured before, 174.84 after, to 174.9.
// A field that fails on the person's change goes back to what it showed, says so, and hands its focus to its box
// (listed with the raw budget above), 0.8 more, to 174.4.
// The two mended lanes joined (listed with the raw budget above): 173.54 measured before either, 175.63 with both,
// to 175.7.
// Every way out asking before it leaves work behind (listed with the raw budget above): 175.63 measured before,
// 176.54 after, to 176.6.
// A run that saved asks before it leaves what changed meanwhile (listed with the raw budget above): 176.54 measured
// before, 176.62 after, to 176.7.
// One check in the form before its values go (listed with the raw budget above): 176.62 measured before, 176.84 after,
// to 176.9.
// Ways out serialised, answers kept to their record (listed with the raw budget above): 176.84 measured before, 177.83
// after, to 177.9.
// the input rules (one set of readers, the box's guard and hint, unread text kept and said on leaving, the number boxes on
// them, and their English words; listed with the raw budget above), 9.1 more, to 167.1; the cells' floating hint and
// right-to-left numbers, 0.4 more, to 167.5; the input rules for text (a text box's guard and what it keeps once
// left, web addresses, postcodes and patterns, properties checked by row, tags, JSON's reasons, a colour's code box;
// listed with the raw budget above), 4.1 more, to 171.6; the dates', times' and choices' input rules (Fieldia's own date
// box with its calendar on every date, a range's end as a field of its own, a time's steps, words typed into links and
// choices taken or said; listed with the raw budget above), 4.2 more, to 175.8 (measured 175.74); the input rules in
// tables and lists (totals that wait for the line that does not read, a cell's message said as it is left, the custom
// filter's number and day, the search's numbers and phones, a formula's Arabic digits; listed with the raw budget
// above), 1.1 more, to 176.9 (measured 176.87); numbers never made of what was typed by dropping a key (keys held after
// a refused one, a decimal mark judged once it can no longer group, trailing zeros, a number read whole as its box is
// left, a tax amount's places; listed with the raw budget above), 1.0 more, to 177.9 (measured 177.86); the input
// rules' last gaps (dates as written at rest, a year of two digits said, the calendar never over why, a colour's code,
// an email's link; listed with the raw budget above), 1.3 more; with the numbers', measured together, to 179.3
// (measured 179.22). Fieldia's own date box, its calendar and a range of dates loaded on first use, in fieldia.date.js
// (7.0 gzipped), the reader they share with tables, pastes and filters kept, and a plain box on it for a date drawn
// before its part came (listed with the raw budget above): 4.9 less, to 174.4 (measured 174.35) — 16.5 over 0.20.0's
// 157.9 for the input rules every page draws at mount. The keys that save with the input rules (Enter never judged,
// a save reading what is still typed first, keys held in every text box, a one-digit minute named, a count of one in
// the singular; listed with the raw budget above), 0.8 more, to 175.2 (measured 175.11). Every way a value is
// committed reading every kind of box (listed with the raw budget above), 1.7 more, to 176.9 (measured 176.83).
// The input rules (0.21) and Wave 1 joined for 0.22 (listed with the raw budget above): 197.21 measured, to 197.3 —
// 39.3 over 0.20.0's 157.9, a size pass still owed.
// The list screen loaded on first use, in fieldia.list.js (12.8 gzipped; listed with the raw budget above): 197.23
// measured before, 185.99 after, to 186.1.
// The themes and the quiet look loaded on first use, in fieldia.themes.js (3.8 gzipped) and fieldia.quiet.js (2.2),
// two parts rather than one: a themed page loads 3.8, not the 5.3 of both together, a quiet one 2.2; a page with both,
// a work item's, 0.7 more and one more file (listed with the raw budget above): 197.23 measured before, 193.42 after —
// 3.8 less, to 193.5.
// A table of lines and a many2many's table of records loaded on first use, in fieldia.lines.js (7.9 gzipped), what a
// line is edited through kept for the grid and the cards, and the lines as plain words before their part came (listed
// with the raw budget above): 197.23 measured before, 191.76 after — 5.5 less, to 191.8.
// Flectra's business widgets loaded on first use, in fieldia.business.js (9.6 gzipped), their words in a cell and a
// state's dot kept, each kind drawn plainly until it comes (listed with the raw budget above): 197.23 measured before,
// 191.42 after, to 191.5.
// 39.3 over 0.20.0's 157.9, a size pass still owed. File and picture fields, files on their way, photos made smaller and
// a signature's pad loaded on first use, in fieldia.files.js (11.3 gzipped), the attachment preview's file and a field's
// files' names drawn before its part came kept (listed with the raw budget above): 197.23 measured before, 188.45
// after — 8.8 less, to 188.5.
// The survey kinds loaded on first use, in fieldia.survey.js (12.1 gzipped), each value shown plainly before it came
// (listed with the raw budget above): 197.23 measured before, 188.88 after — 8.4 less, to 188.9.
// The six joined (listed with the raw budget above): 197.23 measured before, 153.61 after — 43.6 less, to 153.7, under
// 0.20.0's 157.9 again; what a page uses beyond it comes in its parts.
// Every late answer laid only on the record it was asked for (listed with the raw budget above): 153.62 measured
// before, 154.68 after — 1.1 more, to 154.7, under 0.20.0's 157.9 still.
// Wave 2's autofill and bot check (listed with the raw budget above): 153.62 measured before, 154.78 after — 1.2 more,
// what every box and every public page draws at mount — to 154.8.
// The input rules held for names, tables and ways out (listed with the raw budget above): 155.86 measured before,
// 157.24 after — 1.4 more, to 157.3.
// The input rules checked again on 0.23 (listed with the raw budget above): 155.86 measured before, 159.02 after —
// 3.2 more, to 159.1.
// Lists that add up and filter by time (Wave 2, lane F; listed with the raw budget above): 153.62 measured before,
// 154.91 after — 1.3 more, to 155.0.
// Lists people take away and change in bulk (listed with the raw budget above): 153.62 measured before, 154.57 after —
// 1.0 more, to 154.6.
// A phone read the world over (0.24), its words and what asks for its part (listed with the raw budget above): 153.62
// measured before, 154.16 after — 0.5 more, to 154.2.
// A page's time zone, its clock read in every box, cell, filter and list of a date and time, a time the clocks skip or
// repeat said (about 2.1), and booking slots' data source member, form call, checks and words (about 0.7), both 0.24
// (listed with the raw budget above): 153.62 measured before, 156.38 after — 2.8 more, to 156.4.
// The business owner's walk of 0.23 mended (listed with the raw budget above): 153.61 measured before, 155.40 after —
// 1.8 more, to 155.5.
// 0.24's lanes joined (listed with the raw budget above): 153.62 at 0.23.0, 167.10 now — 13.5 more, to 167.2.
// A related list inside a record (listed with the raw budget above): 167.12 measured before, 167.80 after — 0.7
// more, to 167.9.
// Record lists people read anywhere and shape themselves (0.25; listed with the raw budget above): 167.10 measured
// before, 167.73 after — 0.6 more, to 167.8.
// A list's Import (0.25), its words the most of it (listed with the raw budget above): 167.12 measured before, 168.93
// after — 1.8 more, to 169.0.
// On paper (0.25, Wave 3's print lane; listed with the raw budget above), the rules for paper 0.9 of it: 167.12
// measured before, 169.29 after — 2.2 more, to 169.3. The form in front and blocks on paper: 169.57 after, to 169.6.
// Possible duplicates and Merge (0.25; listed with the raw budget above): 167.12 measured before, 168.50 after — 1.4
// more, to the next 0.1 over, 168.6 (their 20 words about 0.6 of it).
// Wave 3's five lanes joined for 0.25 (listed with the raw budget above): 167.12 at 0.24.0, 174.12 now — 7.0 more, to
// 174.2.
// The 0.25 size pass (listed with the raw budget above), each move measured after the one before: a one2many's cards in
// the lines part, 167.12 to 165.31 (1.8 less); a link to other records in the relations part, to 159.65 (5.7 less); a
// long choice's search and choices as tags in the choice part, to 158.23 (1.4 less); a value to copy and a timer in the
// business part, to 157.63 (0.6 less); a many2many's tags typed in before their part came, and a properties field
// asking for the choice part only where a long choice may be, 0.2 back, to 157.87 — 9.3 less, to 157.9. (0.24's time
// zone code stays: its clock and its reader are what `Fieldia.wallTime`, `readDate` and `readDateText` give, and
// every box, cell and value at rest writes a date and time with them.)
// The size pass joined with Wave 3 for 0.25 (listed with the raw budget above): 167.12 at 0.24.0, 164.53 now — 2.6
// less (Wave 3's 7.00 more, the size pass's 9.25 less: 0.34 under their sum, gzip finding more alike in one file), to
// 164.6. A related list's rows' own rules: 164.61 after, to 164.7.
// The business owner's walk of 0.24 mended (listed with the raw budget above): 167.12 measured before, 167.95 after —
// 0.8 more, to 168.0.
// The walk's engine lane joined (listed with the raw budget above): 164.63 measured before, 165.44 after — 0.8 more,
// to 165.5.
// The English words only a part reads, in the parts that read them (listed with the raw budget above): 164.53 measured
// before, 160.30 after — 4.2 less, to 160.4 (160.302, just over 160.3). A page that draws no part's words
// downloads 4.2 less; a list of customers (with its phones), 2.7 less; one that opens every part, 0.9 more, a word two
// parts read being in both.
// The words lane joined with every other lane (listed with the raw budget above): 165.44 measured before, 161.14 after
// — 4.3 less, to 161.2.
// A tab's count of a related list in it, and the pill's look on any page (listed with the raw budget above): 161.14
// measured before, 161.65 after — 0.5 more, to 161.7.
// A related list's rows and New the app's own way (listed with the raw budget above): 161.65 measured before, 161.72
// after — 0.1 more, to 161.8.
// A page names its records (0.26; listed with the raw budget above): 161.14 measured before, 162.15 after — 1.0 more,
// to 162.2.
// Every label inside a sentence small where the page asks (listed with the raw budget above): 162.15 measured before,
// 162.68 after — 0.5 more, to 162.7.
// A line's own dialog as its record's page asks (listed with the raw budget above): 162.68 measured before, 162.72
// after, to 162.8.
// A record's footer under every sheet and its headings kept with what follows them on paper (listed with the raw budget
// above): 161.14 measured before, 163.05 after — 1.9 more, to 163.1.
// The four open-items lanes joined (listed with the raw budget above): 161.14 measured on 0.25.0, 165.20 after — the
// lanes' 0.58, 1.58 and 1.91 added up — to 165.3.
// View all's chips and the memory source's line numbers (0.26, the owner walk's site lane; listed with the raw budget
// above): 165.20 measured before, 165.35 after — 0.15 more, to 165.4.
// The owner's walk of 0.25 mended in the engine (listed with the raw budget above): 165.20 measured before, 165.75 after
// — 0.6 more, to 165.8.
// The owner's walk's two lanes joined (listed with the raw budget above): 165.20 measured before, 165.90 after — their
// 0.15 and 0.55 added up — to 166.0.
// Print on intent (listed with the raw budget above): 165.90 measured before, 162.94 after — 3.0 less, to 163.0. A
// page that prints takes 5.22 more in fieldia.print.js.
// "It's someone new" kept on the app's server (listed with the raw budget above): 162.94 measured before, 163.28 after
// — 0.3 more, to 163.3.
// A signature that signs answers (0.27, w4-signature; listed with the raw budget above): 162.94 measured before, 163.68
// after — 0.75 more, to 163.7. A page whose signature signs answers takes 4.20 more in fieldia.evidence.js. Whether a
// part asked for again can come: 163.68 to 163.80, to 163.9.
// Filters that sales teams and buyers expect (listed with the raw budget above): 162.94 measured before, 163.45 after —
// 0.51 more, to 163.5.
// Tables inside formatted text (listed with the raw budget above): 162.94 measured before, 163.77 after — 0.8 more, to
// 163.8. The table tool, its picker, Tab and Escape in a table, Markdown's tables and a paste made plain are the text
// part's.
// Endings and the answers in a page's own words (0.27, w4-endings; listed with the raw budget above): 162.94 measured
// before, 164.34 after — 1.4 more, to 164.4. A page that says the answers takes 2.07 more in fieldia.answers.js.
// The words said while an answer is empty (listed with the raw budget above): 164.34 measured before, 164.46 after —
// 0.1 more, to 164.5.
// A table line's choices from the app's lists (listed with the raw budget above): 162.94 measured before, 164.41 after
// — 1.5 more, to 164.5.
// More functions, the app's own, and options that follow the answers (listed with the raw budget above): 162.94
// measured before, 167.70 after — 4.76 more, to 167.8.
// Opening, closing and limiting a page, and save and resume (listed with the raw budget above): 162.94 measured
// before, 167.38 after — 4.4 more, to 167.4. A page with limits or Continue later takes 2.41 more in fieldia.limits.js.
// All merged for 0.27.0 (provisional until the size step): the lanes' 162.94 + 0.34 + 0.86 + 0.51 + 0.83 + 1.52 + 1.47
// + 4.76 + 4.44 is 177.67; the merged build with the cross-lane jobs measured 178.21, to 178.3.
// The 0.27 size pass (listed with the raw budget above), each move measured after the one before: a memory source's
// members in fieldia.memory.js (5.71 gzipped), loaded the first time a page's memory source is asked — never by a page
// whose app gives its own source, as an app's real one does — 178.21 measured before, 174.04 after; the sixteen
// functions' bodies in fieldia.functions.js (1.88), loaded before a page whose formulas call one is drawn, 173.40
// after; a form's limits in fieldia.limits.js, with the viewer's (2.00 more there), loaded before a page with limits or
// places is drawn, 172.39 after; options by condition and carried in fieldia.options.js (1.80), loaded before a page
// with any is drawn, 171.75 after; a list page's, a record head's and a page's limits' checks in their parts (2.59 more
// in the list part, 0.69 in the head part's, 0.52 in the limits part's), 169.07 after; a related list's, booking slots',
// a signature's and endings' checks in their parts, 168.42 after; a map's checks in fieldia.mapchecks.js (2.24), asked
// for by a page with a map as its check owes them, 167.32 after; a table of lines' checks in the lines part (0.72 more
// there), 166.98 after; the app's own functions' calls in fieldia.functions.js (0.38 more there), 166.69 after, to
// 166.7; a statusbar's, a table's line kinds' and an address's checks in their parts, 166.05 after (166.06 once the
// functions part waits only for a page calling the app's own); a list's columns' and cards' checks in the list part and
// options by condition's in the options part, 165.40 after; Copy title's and Export's words in the head and list parts,
// 165.38 after, to 165.4.
// The owner's walk of 0.27 mended (listed with the raw budget above): a value worked out from a refused answer waiting,
// a note of options taken out said only while true, a question's label quoted and asked for, a day written as the
// page's date boxes write it — 165.38 measured before, 166.14 after, to 166.2; merged (0.28.0), 166.15.
// A record's approvals (0.29, w5-approvals; listed with the raw budget above) — every page's hook: asked after a load
// and a save, fields locked while one waits, the form's three methods, the band placed and a lock's words, the parts
// declared and their checks owed — 166.15 measured before, 166.77 after, to 166.8. A page with approval takes 6.83 more
// in fieldia.approvals.js.
// A list's cells changed in place (listed with the raw budget above): 166.15 measured before, 166.57 after, to 166.6.
// A text kept in several languages (listed with the raw budget above): 166.15 measured before, 166.57 after, to 166.6.
// A page with one takes 4.54 more in fieldia.languages.js.
// AI help (0.29, lane w5-ai; listed with the raw budget above): the part's handle, the kit's making and placing, the
// field's hook, `propose`, the checks owed to the part, a memory source's AI members — 166.15 measured before, 166.47
// after, to 166.5.
// A photo set (0.29, w5-photos; listed with the raw budget above): 166.15 measured before, 166.28 after, to 166.3. A
// page with one takes its photos part, fieldia.photos.js, besides the files part.
// A code scanned with the camera (0.29, w5-scan; listed with the raw budget above): what knows a field is scanned into
// and asks for the scan part, 166.15 measured before, 166.38 after, to 166.4.
// Merged (0.29.0): the lanes together 168.16 measured; the uploads' work in the files part, 167.41, to 167.5.
// A work item's menus (lane atloria-wi; listed with the raw budget above): a menu's hooks for its dividers and the
// menus inside it, the head part asked for and its checks owed — 167.41 measured before, 167.75 after, to 167.8.
const GZIP_BUDGET_KB = 167.8;
const gzipped = gzipSync(code, { level: 9 }).length;
if (gzipped > GZIP_BUDGET_KB * 1024) throw new Error(`the script bundle is ${Math.round(gzipped / 1024)} KB gzipped, over its ${GZIP_BUDGET_KB} KB budget`);
if (Fieldia.VERSION !== version) throw new Error(`the script bundle says version ${Fieldia.VERSION}, the viewer is ${version}`);
console.log(`script bundle: ${OUT.replace(WORKSPACE + '/', '')} (${Math.round(statSync(OUT).size / 1024)} KB, ${Math.round(gzipped / 1024)} KB gzipped)`);

/**
 * Each add-on: small, the language's words alone (never a second copy of
 * Fieldia), and with the main script — after it, before it (an `async` script
 * may run first) or twice — Fieldia then has every word of that language, as
 * the packages have it.
 */
// A saved form's four messages take Arabic's to 18.1; the switch over the files, four words, Arabic's
// to 18.7 and German's and French's to 8.1. The (?) that shows a field's help, named in each, a little more: to 18.8 and 8.2.
// A table's lines chosen (a line's tick, every line's, how many), and a value on two lines of a column, to 19.1 and 8.3.
// A statusbar's More and the time spent in a step, two words in each, add a little more to each.
// The business widgets' words — twelve colours' names, copy, a distribution's, tax totals', payments', a property
// added in place — add about 2 to Arabic's and 0.8 to German's and French's.
// What sits around a record — the gear menu's and its built-ins' words, the trail, the pager, the attachment,
// and what Archive and Delete ask — eighteen words in each, a little more again.
// A list's switch between its table and its map, four words in each: Arabic's to 23.
// The quiet look's three — what an empty field and an empty question say, and its lock's name — Arabic's to 23.1,
// German's to 9.9 and 4.2, French's to 10.0.
// What an amount is for — /day, /night, /week, /month, /year — five words in each: Arabic's to 23.1, German's
// to 9.9 (4.2 gzipped) and French's to 10.0.
// Both together in 0.19: Arabic's to 23.3 and 4.9, German's 10.0 and 4.2, French's 10.1 and 4.1.
// A record's head and its popup — Maximise, Restore, Resize, Copy title, Title copied, More actions, a split
// button's options, Updated by, Nothing has changed, a tab's count — ten words in each: Arabic's to 23.9 and 5.0,
// German's to 10.3 and 4.3, French's to 10.3 and 4.2.
// The work item's pickers' four — Suggestions, a branch's Expand and Collapse, Add {label} — Arabic's to 23.5,
// German's to 10.1 and 4.3, French's to 10.2 and 4.2.
// A work item's text — its tools' names, the Markdown editor's hint and switch, what switching would lose, a group's
// Maximise, Collapse and Expand, Add link's Existing item and New item, 32 words in each — Arabic's to 25.8 and 5.4,
// German's to 11.1 and 4.7, French's to 11.2 and 4.6.
// A list's filter bar and its nested rows — Filter by keyword, Clear filters, Filter by {label}, Filter settings,
// Expand all, Collapse all — six words in each: Arabic's to 23.7, German's to 10.2 and 4.3, French's to 10.3 and 4.2.
// Joined for 0.20, the five work item lanes' words together: Arabic's 27.2 and 5.6, German's 11.7 and 4.9, French's 11.8 and 4.8.
// 0.21's safety kit — the box where a part could not be shown: "This field could not be shown", "This part could not
// be shown", with its name and without — three in each: Arabic's to 27.5 and 5.7, German's to 11.9, French's to 12.0.
// Files stored as they are picked (0.21) — where a file on its way is (waiting, made smaller, its share sent, not
// uploaded, not taken), its bar's, Cancel's and Retry's names, files uploaded, a save or a send waiting for them, and
// why a save stopped for one — 20 words in each: 2.3 and 0.3 more in Arabic, 1.0 and 0.2 in German, 1.1 and 0.2 in
// French, over the safety kit's: Arabic's to 29.8 and 6.0, German's to 12.9 and 5.1, French's to 13.1 and 5.0.
// Save safety (lane w1-save) — who changed the record and when, what each changed, what Reload and Keep mine do and
// their buttons, the changes set aside and Put back, a record only to read, a field locked for this person, what the
// gear leaves out, and the four refusals core says when the source gives no reason — 21 words in each: 3.0 and 0.4
// more in Arabic, 1.2 and 0.3 in German, 1.2 and 0.4 in French, over the two above: Arabic's to 32.8 and 6.4, German's
// to 14.1 and 5.4, French's to 14.3 and 5.4.
// The three lanes' words joined: each lane rounded its own figures, and gzip does not add up a word at a time —
// measured 32.82 and 6.32 in Arabic, 14.05 and 5.47 in German, 14.31 and 5.40 in French: Arabic's to 32.9, German's
// gzipped to 5.5, French's to 14.4 and 5.5.
// Wave 1's save safety mended (lane w1-fix-save): one sentence, Keep mine saying it could not read their version and
// saved nothing — measured 32.82 and 6.32 before, 33.32 and 6.39 after in Arabic (its letters escaped), 14.05 and 5.47,
// 14.21 and 5.53 in German, 14.31 and 5.40, 14.48 and 5.45 in French: Arabic's to 33.4, German's to 14.3 and 5.6,
// French's to 14.5.
// A field's change not kept, and what it went back to or that it is empty again (lane w1-fix-safety): two sentences
// in each, measured 33.22 and 6.37 in Arabic, 14.22 and 5.52 in German, 14.52 and 5.46 in French: Arabic's to 33.3,
// German's to 14.3 and 5.6, French's to 14.6.
// The two mended lanes' words joined (w1-fix-save, w1-fix-safety): three sentences in each, measured 33.72 and 6.44
// in Arabic, 14.38 and 5.57 in German, 14.68 and 5.51 in French: Arabic's to 33.8 and 6.5, German's to 14.4 and 5.6,
// French's to 14.7 and 5.6.
// Every way out asking before it leaves work behind (lane w1-fix-save2): "Discard your changes?" said by core for a
// step that leaves the record, and the status's "Saved" and "Sent" when not all of it was — three sentences in each,
// measured 34.22 and 6.50 in Arabic, 14.55 and 5.62 in German, 14.86 and 5.55 in French: Arabic's to 34.3, German's
// to 14.6 and 5.7, French's to 14.9.
// Ways out serialised (lane w1-serial): what a way out waits for — the save, one file, {n} files — Done's "Not all your
// changes are saved", and core's word for a run whose record was replaced — five sentences in each, measured 35.15 and
// 6.60 in Arabic, 14.94 and 5.71 in German, 15.28 and 5.65 in French: Arabic's to 35.2 and 6.6, German's to 15.0 and
// 5.8, French's to 15.3 and 5.7.
// The input rules' words (0.21) — every hint a box gives as it refuses a keystroke or a paste, text that does not read,
// the decimals' plural forms, a postcode's, a web address's, a range's and a time step's checks, a date box's shapes,
// a table's totals and pastes, a list's filters, 61 in each — Arabic's to 35.3 and 7.0 (Arabic letters are six ASCII
// bytes each), German's to 15.1 and 6.0, French's to 15.5 and 6.0.
// Their last gaps (0.20.1) — a year of two digits and both centuries it could be, several choices of one name, a ":"
// before an email's @, three in each — Arabic's to 35.9 and 7.1, German's to 15.4 and 6.1, French's to 15.7 and 6.1.
// The keys that save (0.20.1) — a time's one-digit minute and both times it could be, the time a day leaves out, and a
// pasted count, a count of lines and the characters over said for one — five in each: Arabic's to 36.6, German's to
// 15.7 and 6.2, French's to 16.1 and 6.2.
// Every box by every commit (0.20.1) — "still looking for" a name, a cell a paste left named with why, one character
// over said as one, three in each — Arabic's to 37.0 and 7.2, German's to 15.9, French's to 16.3 (as measured 36.96
// and 7.15, 15.86, 16.27).
// The input rules' words and Wave 1's joined for 0.22, as measured: Arabic's 45.0 and 8.2, German's 19.2 and 7.1,
// French's 19.8 and 7.1 — each to 0.1 over.
// A public page's hidden box (0.24, Wave 2's bot check): "Leave this box empty", one in each, read by no person but one
// whose page has lost its look — measured 45.11 and 8.25 in Arabic, 19.22 in German, 19.84 in French: Arabic's to 45.2.
// The input rules checked again on 0.23: six sentences in each — a domain's mark, a date in another order, a time the
// clocks skip and one they pass twice, decimal hours, a JSON number not kept as written — and the whole part's digits:
// measured 46.93 and 8.51 in Arabic, 19.99 and 7.31 in German, 20.62 and 7.31 in French (before: 45.11 and 8.25,
// 19.22 and 7.09, 19.84 and 7.10), each to 0.1 over.
// Lists that add up and filter by time (Wave 2, lane F): a period, a date's span, a total and its kinds, 25 words in
// each — Arabic's 44.99 and 8.23 measured before, 46.47 and 8.50 after, to 46.5 and 8.6; German's 19.18 and 7.08 to
// 19.83 and 7.33, to 19.9 and 7.4; French's 19.81 and 7.09 to 20.49 and 7.34, to 20.5 and 7.4.
// Lists people take away and change in bulk (0.24): "Select all 1,284 that match", Export's menu, its progress and how
// it ended, and Edit's dialog, question, progress and report, 29 in each, as measured: Arabic's 47.74 and 8.63, German's
// 20.36 and 7.39, French's 21.08 and 7.43 — Arabic's to 47.8 and 8.7, German's to 20.4 and 7.4, French's to 21.1 and 7.5.
// A phone read the world over (0.24) — a number's country, Call and WhatsApp, and five reasons a number does not read,
// eleven in each — as measured 46.14 and 8.44 in Arabic, 19.75 and 7.25 in German, 20.42 and 7.27 in French: Arabic's
// to 46.2 and 8.5, German's to 19.8 and 7.3, French's to 20.5 and 7.3.
// A date and time on its zone's clock and booking slots (0.24) — a time the clocks skip or repeat, a zone's name another
// day's, and the slots' 19 (finding, failed, Try again, a day's state, its times, a time checked or taken, the zone) —
// 22 in each: Arabic's to 47.6 and 8.7, German's to 20.2 and 7.5, French's to 20.9 and 7.5 (as measured 47.51 and
// 8.62, 20.16 and 7.41, 20.86 and 7.43).
// 0.24's lanes joined, measured in the merged build: Arabic's 54.23 and 9.70 (44.99 and 8.23 at 0.23.0), German's
// 23.15 and 8.30 (19.18 and 7.08), French's 23.97 and 8.34 (19.81 and 7.09) — each to the next 0.1 over, German's
// gzipped to 8.4, its 8.30 a fifth of a byte under 8.3.
// A related list inside a record (Wave 3): View all and New, each with its title and without, what it says before a
// record's first save and with none yet, six in each — Arabic's 54.23 and 9.70 measured before, 54.66 and 9.78 after,
// to 54.7; German's 23.15 and 8.30 to 23.36 and 8.37, to 23.4; French's 23.97 and 8.34 to 24.21 and 8.41, to 24.3
// and 8.5.
// Record lists people read anywhere and shape themselves (0.25) — Gallery, Columns, a column's Move up, Move down,
// Reset and Resize, and a row's Actions, seven in each — as measured 54.69 and 9.77 in Arabic (54.23 and 9.70 before),
// 23.35 and 8.36 in German (23.15 and 8.30), 24.17 and 8.40 in French (23.97 and 8.34): Arabic's raw to 54.7, German's
// to 23.4, French's to 24.2 and 8.5 (its 8.40 at the line); the rest as they were.
// A list's Import (0.25) — its button and dialog, a file read or why not, its encoding and separator, its columns
// matched, the rows checked, refused and written, Stop, Undo, and why a cell does not read — 67 in each, and a table
// of lines' lines added by a paste, two: Arabic's 54.23 and 9.70 measured before, 62.59 and 10.92 after, to 62.6 and
// 11.0; German's 23.15 and 8.30 to 26.81 and 9.30, to 26.9 and 9.4; French's 23.97 and 8.34 to 27.80 and 9.36, to
// 27.9 and 9.4.
// On paper (0.25): a list's Print, how far it has got and how it ended, a printout's filters, groups and count, the day
// it was printed, and the gear's This record — ten in each, as measured: Arabic's 55.07 and 9.82, German's 23.53 and
// 8.39, French's 24.42 and 8.46 (54.23 and 9.70, 23.15 and 8.30, 23.97 and 8.34 before) — each to the next 0.1 over.
// Possible duplicates and Merge (0.25) — a record like this one by its fields or its name, Open it, It's someone new,
// Merge…, and the merge's screen, its columns, rows, what will happen and how it ended — 20 in each: Arabic's 54.23 and
// 9.70 measured before, 56.56 and 10.09 after, to 56.6 and 10.1; German's 23.15 and 8.30 to 24.25 and 8.65, to 24.3
// and 8.7; French's 23.97 and 8.34 to 25.06 and 8.68, to 25.1 and 8.7.
// Wave 3's five lanes joined for 0.25, measured in the merged build — their words added up, and "{n} of {total}" for a
// related list on paper: Arabic's 66.70 and 11.56, German's 28.75 and 9.87, French's 29.80 and 9.94 (54.23 and 9.70,
// 23.15 and 8.30, 23.97 and 8.34 at 0.24.0) — each to the next 0.1 over.
// The business owner's walk of 0.24 mended (0.25) — a value that waits for a field or a line, a list's several
// currencies said in sight, a CSV file's currency column, a phone's letters: 4 in each, as measured Arabic's 54.74 and
// 9.78 (54.23 and 9.70 before), German's 23.44 and 8.37 (23.15 and 8.30), French's 24.26 and 8.40 (23.97 and 8.34):
// Arabic's to 54.8, German's to 23.5, French's to 24.3 and, its 8.40 half a byte over, 8.5.
// The walk's engine lane joined, its words for values that wait, several currencies and a phone's letters: Arabic's
// 67.21 and 11.65, German's 29.04 and 9.95, French's 30.08 and 10.00, each to the next 0.1 over.
// A page names its records (0.26): each sentence a language can say round any page's words for its records — German's
// 42 (its plurals and its "ein Kunde" agree with no gender), French's 31 (none that agrees with the noun's) — the rest
// left out, so the language's own plain sentence is said: German's 29.04 and 9.95 measured before, 31.46 and 10.29
// after, to 31.5 and 10.3; French's 30.08 and 10.00 to 31.76 and 10.28, to 31.8 and 10.3; Arabic's one (the pager's
// name), 67.23 and 11.66, under its own.
// The owner's walk of 0.25 mended in the engine: a pasted row's name read as no record said (four words, the lines
// part's), a CSV file's characters misread and its header alone said, the key over a list's rows named — each language's
// words: Arabic's 67.23 and 11.66 measured before, 68.25 and 11.82 after, to 68.3 and 11.9; German's 31.46 and 10.29 to
// 31.91 and 10.42, to 32.0 and 10.5; French's 31.76 and 10.28 to 32.24 and 10.42, to 32.3 and 10.5.
// A grouped list's heading said with its count in words (0.26.1, a11y-0261), "Cairo, 12 records" and with a page's
// words for its records, two words in Arabic, four in German and French: Arabic's 68.25 and 11.82 measured before,
// 68.38 and 11.83 after, its raw to 68.4; German's 31.91 and 10.42 to 32.03 and 10.44, to 32.1; French's 32.24 and
// 10.41 to 32.37 and 10.43, to 32.4.
// A signature that signs answers (0.27, w4-signature): who signed and when, whether the answers are as signed, Change
// answers and its question, the signature taken away, the answers to put right first, and a signed answer's lock — nine
// sentences in each, and five more for its part that could not come (not signed for want of it, a signature kept whose
// evidence it cannot show — each with Try again, or with a reload where asking again cannot bring it — and Try again):
// Arabic's 68.38 and 11.83 measured before, 71.34 and 12.21 after, to 71.4 and 12.3; German's 32.03 and 10.44 to 33.33
// and 10.75, to 33.4 and 10.8; French's 32.37 and 10.43 to 33.63 and 10.77, to 33.7 and 10.8.
// Filters that sales teams and buyers expect (0.27, w4-filters): a range's words — From, To, Any, between, 2+, up to,
// from and until a day, why one is refused — "is between", and a phone's sheet's Filters, Clear all and Show, 17 words
// in each: Arabic's 68.38 and 11.83 measured before, 69.29 and 12.02 after, to 69.3 and 12.1; German's 32.03 and 10.44
// to 32.51 and 10.59, to 32.6 and 10.6; French's 32.37 and 10.43 to 32.90 and 10.60, to 33.0 and 10.7.
// Tables inside formatted text (0.27, w4-rich-tables): the table tool's 22 words in each — its name, its picker's
// sizes, what may be done where the caret is, the keys a table takes and what is said once done: Arabic's 68.38 and
// 11.83 measured before, 70.14 and 12.12 after, to 70.2 and 12.2; German's 32.03 and 10.44 to 32.82 and 10.67, to 32.9
// and 10.7; French's 32.37 and 10.43 to 33.21 and 10.68, to 33.3 and 10.7.
// A table line's choice cleared as its connection changed, said under its cell (0.27, w4-line-choices), one word in
// each: Arabic's 68.38 and 11.83 measured before, 68.50 and 11.84 after, its raw to 68.6; German's 32.03 and 10.44 to
// 32.09 and 10.45, under its own; French's 32.37 and 10.43 to 32.43 and 10.45, its raw to 32.5.
// French's 32.37 + 1.26 + 0.53 + 0.84 + 0.06 and 10.43 + 0.34 + 0.17 + 0.25 + 0.02, to 35.1 and 11.3.
// A value an app's function is asked for, its answer not come, and choices a change takes out of an answer (0.27,
// w4-rules): five words of the form's messages and two of the viewer's, in each language: Arabic's 68.38 and 11.83
// measured before, 69.14 and 11.96 after, to 69.2 and 12.0; German's 32.03 and 10.44 to 32.44 and 10.55, to 32.5 and
// 10.6; French's 32.37 and 10.43 to 32.81 and 10.55, to 32.9 and 10.6.
// Opening, closing and limiting a page, and save and resume (0.27, w4-limits) — why a form takes no answers now, a
// choice full, its places left, the answers that can no longer be sent, Continue later, what it kept and its link, a
// draft not found: 21 in each — Arabic's 68.38 and 11.83 measured before, 71.21 and 12.24 after, to 71.3 and 12.3;
// German's 32.03 and 10.44 to 33.15 and 10.78, to 33.2 and 10.8; French's 32.37 and 10.43 to 33.53 and 10.79, to 33.6
// and 10.8.
// All merged for 0.27.0 (provisional): Arabic's 68.38 + 2.96 + 0.91 + 1.76 + 0.12 + 0.76 + 2.83 and 11.83 + 0.38 + 0.19
// + 0.29 + 0.01 + 0.13 + 0.41, to 77.8 and 13.3; German's 32.03 + 1.30 + 0.48 + 0.79 + 0.06 + 0.41 + 1.12 and 10.44 + 0.31
// + 0.15 + 0.23 + 0.01 + 0.11 + 0.34, to 36.2 and 11.6; French's 32.37 + 1.26 + 0.53 + 0.84 + 0.06 + 0.44 + 1.16 and
// 10.43 + 0.34 + 0.17 + 0.25 + 0.02 + 0.12 + 0.36, to 36.7 and 11.7.
// The owner's walk of 0.27 mended: a question's required message, and a refused signature's "ready to sign" and Sign
// now — Arabic's 77.58 and 13.24 measured before, 77.88 and 13.29 after, to 77.9 and 13.3; German's 36.14 and 11.60 to
// 36.27 and 11.64, to 36.3 and 11.7; French's 36.60 and 11.64 to 36.75 and 11.70, to 36.8 and 11.7.
// A record's approvals (0.29, w5-approvals): where it stands, its levels, Approve and Reject, Reject's question, what
// stays open, its history, a field's lock and a rejection with no reason — 37 words in each — Arabic's 77.88 and 13.29
// measured before, 81.25 and 13.82 after, to 81.3 and 13.9; German's 36.27 and 11.64 to 38.01 and 12.11, to 38.1 and
// 12.2; French's 36.75 and 11.70 to 38.53 and 12.16, to 38.6 and 12.2.
// A list's cells changed in place (Wave 5, w5-editable-list): what a cell that takes a change is, Add a line, Remove,
// why a row was not saved, a row saved, Open, Change and a cell named in a paste's note — 8 words in each (Add {aRecord}
// in English alone): Arabic's 77.88 and 13.29 measured before, 78.52 and 13.42 after, to 78.6 and 13.5; German's 36.27
// and 11.64 to 36.60 and 11.75, to 36.7 and 11.8; French's 36.75 and 11.70 to 37.09 and 11.80, to 37.1 and 11.9.
// A text kept in several languages (0.29, w5-two-languages): required in some of its languages, said as a sentence or a
// question; its switch named for its field, a language not typed yet, one a required answer still needs; a list's
// "in English" — Arabic's 77.88 and 13.29 measured before, 78.44 and 13.36 after, to 78.5 and 13.4; German's 36.27 and
// 11.64 to 36.55 and 11.71, to 36.6 and 11.8; French's 36.75 and 11.70 to 37.02 and 11.76, to 37.1 and 11.8.
// AI help (0.29, w5-ai): Fill from text, its dialog and its review, a proposal on its field and its Undo, a text
// field's Draft and Polish, a list's words read as filters — 44 words in each: Arabic's 77.88 and 13.29 measured before,
// 82.78 and 14.01 after, to 82.8 and 14.1; German's 36.27 and 11.64 to 38.40 and 12.25, to 38.4 and 12.3; French's
// 36.75 and 11.70 to 38.85 and 12.29, to 38.9 and 12.3.
// A photo set (0.29, w5-photos): how a photo is moved — by a mouse and keys, or by a finger — and said moved, the
// cover, a photo's tools and caption by its name, the photos counted and uploaded, a photo changed and its original
// back, and the crop and turn dialog's words — 32 in each: Arabic's 77.88 and 13.29 measured before, 81.73 and 13.87
// after, to 81.8 and 13.9; German's 36.27 and 11.64 to 37.96 and 12.13, to 38.0 and 12.2; French's 36.75 and 11.70 to
// 38.46 and 12.18, to 38.5 and 12.2.
// A code scanned with the camera (0.29, w5-scan): the Scan button's, the camera sheet's and why it did not open's 21
// words — Arabic's 77.88 and 13.29 measured before, 81.55 and 13.79 after, to 81.6 and 13.8; German's 36.27 and 11.64
// to 37.69 and 12.08, to 37.7 and 12.1; French's 36.75 and 11.70 to 38.18 and 12.14, to 38.2 and 12.2.
// Merged (0.29.0), every lane's words together and AI help's "Proposed in {language}": Arabic's 94.97 and 15.85, to
// 95.0 and 15.9; German's 43.89 and 13.85, to 43.9 and 13.9; French's 44.42 and 13.84, to 44.5 and 13.9.
// The owner's walk of 0.29 mended (walkfix29-engine): a cell's hint says typing replaces its value and F2 changes within
// it — Arabic's 94.97 and 15.85 measured before, 95.14 and 15.87 after, to 95.2 and 15.9; German's 43.89 and 13.85 to
// 43.93 and 13.87, to 44.0 and 13.9; French's 44.42 and 13.84 to 44.47 and 13.86, inside its 44.5 and 13.9. A row no
// one may change here, said so — Arabic's 95.28 and 15.89, to 95.3; German's 43.99 and 13.88, inside 44.0 and 13.9;
// French's 44.53 and 13.88, to 44.6. A long paste asked first, its Undo, rows refused for one reason said once (9
// words) — Arabic's 96.17 and 16.01, to 96.2 and 16.1; German's 44.42 and 13.98, to 44.5 and 14.0; French's 44.95 and
// 13.99, to 45.0 and 14.0. Approvals routed as recommended — "No approval needed", a level named once in brackets —
// Arabic's 96.22 and 16.03, to 96.3; German's 44.44 and 13.98, inside 44.5 and 14.0; French's 44.99 and 14.00, to 45.1
// and 14.1. A counted table's sheet with a box to type a code in — Arabic's 96.33 and 16.05, to 96.4; German's 44.50
// and 14.00, to 44.6 and 14.1; French's 45.05 and 14.02, inside 45.1 and 14.1. Propose values pressed with nothing
// to read from, said — Arabic's 96.68 and 16.08, to 96.7 and 16.1; German's 44.71 and 14.03, to 44.8; French's 45.19
// and 14.04, to 45.2. Photos named by their caption or place, and every dialog holding changes asking before it lets
// them go (the crop, Reject's question, Fill from text, the import): Arabic's 97.58 and 16.17, to 97.6 and 16.2;
// German's 45.09 and 14.10, to 45.1 and 14.1 — measured 45.09 inside; French's 45.54 and 14.11, to 45.6 and 14.2.
const ADD_ON_BUDGET_KB = { ar: [97.6, 16.2], de: [45.1, 14.1], fr: [45.6, 14.2] };
const sourceWords = async (locale) => {
  const { outputFiles } = await build({
    ...common,
    sourcemap: false,
    write: false,
    globalName: 'words',
    stdin: {
      contents: [
        `export { ${locale} as messages } from './libs/core/src/lib/record/locales/${locale}';`,
        `export { ${locale} as widgets } from './libs/widgets/src/lib/locales/${locale}';`,
        `export { ${locale} as viewer } from './libs/viewer/src/lib/locales/${locale}';`,
      ].join('\n'),
      resolveDir: WORKSPACE,
      loader: 'ts',
    },
  });
  const sandbox = {};
  runInNewContext(outputFiles[0].text, sandbox);
  return sandbox.words;
};
/** Words compared whatever their order. */
const sorted = (tables) => JSON.stringify(Object.fromEntries(Object.entries(tables).sort().map(([part, words]) => [part, Object.fromEntries(Object.entries(words ?? {}).sort())])));
const runTogether = (files, sandbox = {}) => {
  const warnings = [];
  Object.assign(sandbox, { console: { warn: (message) => warnings.push(message) } });
  for (const file of files) runInNewContext(readFileSync(file, 'utf8'), sandbox);
  return { Fieldia: sandbox.Fieldia, warnings };
};
const sizes = [];
for (const locale of Object.keys(LANGUAGES)) {
  const file = join(BUNDLE, `fieldia.${locale}.js`);
  const addOn = readFileSync(file, 'utf8');
  const name = `the ${LANGUAGES[locale]} add-on`;
  if (/mountViewer|createForm/.test(addOn)) throw new Error(`${name} carries a copy of Fieldia: it must carry the language's words alone`);
  const [raw, gzip] = ADD_ON_BUDGET_KB[locale];
  const addOnGzipped = gzipSync(addOn, { level: 9 }).length;
  if (addOn.length > raw * 1024) throw new Error(`${name} is ${(addOn.length / 1024).toFixed(1)} KB, over its ${raw} KB budget`);
  if (addOnGzipped > gzip * 1024) throw new Error(`${name} is ${(addOnGzipped / 1024).toFixed(1)} KB gzipped, over its ${gzip} KB budget`);
  const expected = sorted(await sourceWords(locale));
  for (const order of [[OUT, file], [file, OUT], [OUT, file, file]]) {
    const { Fieldia: withIt, warnings } = runTogether(order);
    const got = sorted({ messages: withIt.MESSAGES[locale], widgets: withIt.WIDGET_LABELS[locale], viewer: withIt.VIEWER_LABELS[locale] });
    const loaded = order.map((f) => f.replace(BUNDLE + '/', '')).join(', then ');
    if (got !== expected) throw new Error(`${loaded}: Fieldia does not have every ${LANGUAGES[locale]} word`);
    if (warnings.length) throw new Error(`${loaded}: ${warnings.join(' ')}`);
    if (withIt.FieldiaLanguages !== undefined) throw new Error(`${loaded}: the add-on's words were left waiting`);
  }
  // A main script of another version: the add-on says so, and still gives its words.
  const other = runTogether([file], { Fieldia: { VERSION: '0.0.0', addLanguage: () => undefined } });
  if (other.warnings.length !== 1 || !other.warnings[0].includes(`fieldia.${locale}.js is version ${version}`)) throw new Error(`${name} does not warn of a main script of another version`);
  sizes.push(`${locale} ${(addOn.length / 1024).toFixed(1)} KB, ${(addOnGzipped / 1024).toFixed(1)} KB gzipped`);
}
console.log(`language add-ons: ${sizes.join('; ')}`);

/**
 * Each part: its own code alone (never a second copy of Fieldia), what it shares taken from the main script, and with
 * it — after it, before it (a part's tag written into the page may run first) or twice — Fieldia then draws from it. A
 * part of another version is refused with a warning, and what would have been drawn from it is drawn plainly.
 */
// Each part's budget, raw and gzipped, in KB, as measured when they were cut out of the main script: the head with its
// window (record-head, rich-button, section-tools, dialog-window and their sheets: 33.8, 9.9); the text (html-field,
// formatted-text, markdown, text-tools, text-menu, links and their sheet: 54.1, 18.0); the path picker and its sheet
// (13.0, 5.1); Fieldia's own list for a choice and its sheet (5.4, 2.4); the filter bar and its sheet (11.1, 4.2). Each
// carries esbuild's small helpers of its own (0.6). The third side-by-side: the head's band rows on whole pixels, its
// comments' link led by its bubble and its paperclip's box (head 34.0); the rich toolbar's lists, colour, emoji lit
// from above, code, clear formatting and links drawn as the tracker's, and Markdown's own smaller </> (text 54.8, 18.2);
// the path picker's chevron and divider as measured (path 13.1, 5.2). A path found as typed whatever its separator and
// script, Tab taking the match typing reached, and words naming nothing said under the box (path 13.6, 5.4). The filter
// bar's keyword read in the page's language — its marks, Arabic digits — as every box reads a number (filters 11.2).
// Words typed in a path picker and left — by a click, Tab or Enter, before or after their list came — taking the
// record they name exactly, by its path or its own name, or saying that nothing or several are called so (path 14.4, 5.7).
// Fieldia's own date box (0.20.1) — its guard and what it keeps once left — with a date's calendar and a range of dates
// on its own calendar, cut out of the main script (date-box, calendar, date-range: 18.9, 7.1, as measured, 18.89 and 7.02).
// The date box's input rules given to every other box a date is typed into — a designer's day, time and value set
// when (dateRules) — their label and order read as they stand (date 19.1, as measured 19.03). The keys typed after a
// refused one waiting with it, read whole as the box is left, so "1x5/10/2026" is never 15 October (date 7.2 gzipped,
// as measured 19.09 and 7.1). A date's box read as a save reads it first (a change), and a date and time pasted into
// it saying the time it left out (date 19.3, as measured 19.29 and 7.17). Words typed in a path picker read by every
// save, check and step — the record they name taken, waited for while it is found, kept unread with why when none or
// several are called so — and autosave waiting while they are typed (path 15.4, 6.0, as measured 15.34 and 6.00).
// The list screen (0.23 size pass) — its table, groups, chosen records' buttons, pager and switcher, the search bar
// with its menu, a person's own filter and the favourites, and its sheet — cut out of the main script (list,
// list-groups, search-bar, custom-filter, favourites, list-styles: 42.7, 12.8, as measured 42.62 and 12.75).
// The eight themes, cut out of the main script (0.23): their tokens, light and dark, the page's look's tokens again
// after them, and their own shapes, as one sheet (themes 12.3, 3.9, as measured 12.23 and 3.83). The quiet look's sheet,
// cut out with them, its state's words and lock left in the main script (quiet 8.5, 2.2, as measured 8.46 and 2.19).
// A table of lines and a many2many's table of records with their own rules (0.23), cut out of the main script
// (lines-table, links-table, styles-lines: 23.0, 8.0, as measured 22.92 and 7.92).
// Flectra's business widgets (0.23) — a record's statusbar, priority stars, the boxes hours and a per cent are typed in,
// an analytic distribution's lines, tax totals and payments, with their sheet — cut out of the main script (business
// 26.0, 9.6, as measured 25.91 and 9.55).
// File and picture fields with their list, thumbnails, cards and dialog, files on their way, photos made smaller, a
// signature's pad and a PDF under its file box, with their sheet, cut out of the main script (files, files-going,
// shrink, signature, pdf, styles-files: 30.9, 11.3, as measured 30.82 and 11.28).
// The survey kinds (0.23) — a ranking, a matrix, a slider, pictures to choose from, a colour, properties, an address
// and a progress bar — with their two sheets, one of the rules cut from Fieldia's first sheet and one of those cut
// from the head of the page's own looks, cut out of the main script (survey 35.0, 12.2, as measured 34.99 and 12.10).
// Late answers laid only on the record they were asked for (after 0.23.0), each part carrying its own copy of the
// parts' test (shown.ts): a path picker's name found once the record was replaced (path 15.5, 6.1, as measured 15.34
// and 6.00 before, 15.49 and 6.06 after); a link's record opened or picked, and a picture read into formatted text
// (text 55.0, 18.3: 54.72 and 18.15 before, 54.92 and 18.23 after); a statusbar's save (business 26.1, 9.6: 25.92 and
// 9.55 before, 26.01 and 9.59 after). The files part (a file or a signature read: 30.75 and 11.20 before, 30.89 and
// 11.26 after) and the lines part (a table's records picked or opened: 22.86 and 7.91 before, 22.99 and 7.96 after)
// stay within theirs.
// What the browser fills a box in with (0.24, Wave 2): a date's box takes the page's purpose and keyboard, and one
// filled from a pick in another box is read as left (date 19.5, 7.3, as measured 19.45 and 7.23); an address's parts
// each take whose address it is (survey 35.1, as measured 35.06 and 12.13); hours and a per cent the page's purpose and
// keyboard, and read as left when filled from elsewhere (business as it was, measured 25.99 and 9.58).
// Save safety round 6 and autofill joined (inputs-fix-base): the business part measured 26.08 and 9.62 there, over
// its 9.6 gzipped before any fix of the input rules — to 9.7.
// The input rules held for names, tables and ways out (inputs-fix-names): a path's words of none or several kept unread
// as it is left or taken away, an exact name taken whatever row is reached, Ctrl+Enter reading the words, a name past
// the search's limit asked for exactly (path 16.0, 6.3: 15.49 and 6.06 before, 15.91 and 6.24 after); a line's × asking over text
// typed in it (lines 23.2, 8.1: 22.99 and 7.96 before, 23.11 and 8.01 after); a filter's day and time written the
// page's way (list 43.0, 12.9: 42.62 and 12.75 before, 42.99 and 12.85 after).
// The input rules checked again on 0.23 (inputs-fix-boxes), each part's box taking what was typed in its stand-in
// (`takeTyped`) and reading, never rewriting: hours and a per cent passed through, hours kept to the field's places and
// decimal hours said (business 26.7, 9.9, as measured 26.60 and 9.82; 26.08 and 9.62 before — save safety round 6 and
// autofill joined had left it at 9.62, over its 9.6); a date's box typed back to what it showed, its paste saying the
// reader's why (date 19.7, 7.4: 19.63 and 7.31, from 19.45 and 7.23); a path picker's (path 15.6: 15.53, from 15.49);
// a slider's, which marks text its number box left unread (survey 35.4, 12.3: 35.35 and 12.23, from 35.06 and 12.13);
// a links box reading the words typed before it came (text 55.6, 18.6: 55.57 and 18.50, from 54.92 and 18.23).
// Lists that add up and filter by time (Wave 2, lane F), in the list part: the totals row under a list, the ticked
// rows' and a Group By heading's sums, each amount in the one currency its source names (list-totals.ts); a date
// grouped by its year, quarter, month, week or day, its headings in words and each opened to its span (list-groups.ts);
// where a span ends, a period's days and the plain conditions for them (list-days.ts); the menu's spans and a person's
// own period (search-bar.ts, custom-filter.ts) and their rules — 42.62 and 12.75 measured before, 50.80 and 15.80
// after, to 50.9 and 15.9.
// Lists people take away and change in bulk (0.24), in the list part: every record that matches chosen and its ids
// paged through where a source gives none (list-every), Export's menu and an export as CSV or as an Excel workbook
// written with no library (list-export; xlsx and zip: 6.5 raw, 2.8 gzipped of the whole), and Edit's dialog, question,
// writes and report (list-bulk) — list 42.62 and 12.75 measured before, 63.58 and 20.54 after (list 63.6, 20.6).
// A list's phone column written as people read it (0.24): list 42.9, 12.9, as measured 42.82 and 12.81.
// A phone read the world over (0.24) — its box, its country picked or typed, the number checked by it and kept as
// E.164, its call and WhatsApp links, its sheet, and every country's numbers in a table made from libphonenumber's
// metadata (phone-table.ts, 23.1 of it, 9.6 gzipped: libphonenumber-js's own smallest build is 147.4 and 34.1) — new,
// in fieldia.phone.js (phone 34.7, 15.2, as measured 34.63 and 15.11).
// A date and time on its zone's clock (0.24): the box's zone beside it and its letters let through, its calendar's and a
// range's days, today and hours on that clock, and a day whose time the clocks skip said (date 21.6, 8.2, as measured
// 21.53 and 8.12: 2.2 and 1.0 more). Booking slots (0.24), a part of their own — the month shaded by how it is booked,
// the day's times as chips, the arrows across both, a time taken meanwhile said, and their sheet (slots 14.7, 5.6, as
// measured 14.64 and 5.58) — loaded with the date part, whose box they are without the data source's slots. In the
// date part they would have added 14.6 and 5.6 to every page with a date; on their own, a booking page loads both.
// The business owner's walk of 0.23 mended: a cell's, a range's end's and a property's message shown once the press
// that left it has ended (date 19.4, 7.3, as measured 19.38 and 7.21; survey 35.2, as measured 35.15); and a table of
// lines naming a line by its number among the items, its worked-out numbers waiting, said in words, for a cell of it
// that does not read (lines 23.7, 8.2, as measured 23.63 and 8.18).
// 0.24's lanes joined, measured in the merged build (0.23.0's in brackets): text 55.60 and 18.52 (54.72, 18.15), path
// 15.95 and 6.26 (15.34, 6.00), date 21.96 and 8.30 (19.29, 7.17), list 72.41 and 23.71 (42.62, 12.75), lines 23.88
// and 8.28 (22.86, 7.91), business 26.60 and 9.82 (25.92, 9.55), files 30.89 and 11.26 (30.75, 11.20), survey 35.50
// and 12.29 (35.00, 12.10), and the new phone 34.77 and 15.21 and slots 14.63 and 5.57 — each to the next 0.1 over
// (business's raw to 26.7, 4 bytes under 26.6 being no room; date's gzipped to 8.4, its 8.30 at the line); head,
// choice, filters, themes and the quiet look as at 0.23.0, unchanged.
// A related list inside a record (Wave 3), in the list part and drawn with its table: its heading, count, View all and
// New, what it says before a first save, each ask kept to the record shown (list-related.ts: 3.6, 1.6 gzipped on its
// own), its look (1.2), and the list's search as a box alone, its search and pager once a page is full, its count told
// and an answer for a record no longer shown dropped (list.ts, search-bar.ts) — list 72.41 and 23.71 measured before,
// 77.37 and 25.26 after (list 77.4, 25.3). A part of its own would have spared a plain list page about 1.2 gzipped and
// cost a record page with one a second request: a related list draws with the list part's table, so it loads that.
// Record lists people read anywhere and shape themselves (0.25): a status as a pill, links as chips, a picture or a
// person's initials, a number as a bar, a phone's call and WhatsApp links, a row's own tone, bold and buttons, the
// gallery on the switcher and the cards' keys, a header's cells moved only as their order changes (list 83.3, 27.4, as
// measured 83.29 and 27.39: 10.9 and 3.7 more); a list's rows as cards on a phone and in its gallery, their totals in
// sight, a row in bold bolder on its card, and their sheet, a part of their own (cards 11.6, 3.7, as measured 11.52
// and 3.66); the columns a person
// shows, hides, orders and sizes, kept for them, the header and first column in view, and their sheet, another
// (columns 10.7, 4.0, as measured 10.69 and 3.94). In the list part the two would have added 22.1 and 7.6 to every
// list; on their own, only a list that asks loads them.
// A list's Import (0.25), a part of its own, loaded the first time Import is pressed: a file dropped or chosen and read
// — a workbook's zip opened with the browser's DecompressionStream and its XML read with no library, a CSV file's
// encoding and separator guessed (import-file, unzip) — its columns matched (import-match), its rows read and checked
// (import-check), written with Stop and Undo (import-write), its dialog (import-dialog) and its sheet (import-styles):
// import 33.2 and 13.3, as measured 33.15 and 13.29. In the list part it would have added the same to every list's
// page, 24.45 gzipped to some 37; on its own, a list draws its button alone (list 72.41 and 23.71 measured before,
// 75.36 and 24.45 after: the button and its place in the bar, the report's file to fix and Undo — list 75.4 and 24.5). The workbook and CSV
// writers for the file to fix are the list part's own, handed over, never copied. A block pasted on a table of lines
// (lines-table) and the cells' readers moved there from @fieldia/grid (cell-paste), which the grid and Import load the
// lines part for: lines 23.88 and 8.28 measured before, 30.83 and 10.64 after, to 30.9 and 10.7.
// On paper (0.25, Wave 3's print lane), measured (before in brackets): a list's Print — every record that matches asked
// a page at a time, under its groups with their sums, the totals, the search in words, its printout's sheet and its
// list's rules for paper — list 78.49 and 25.51 (72.41, 23.71); an action's file shown over the record, or saved, by
// the dialog a file field's file opens in (viewFiles, showAppFile) — files 32.37 and 11.92 (30.89, 11.26); and each
// part's own rules for paper in its own sheet: business 26.94 and 9.89 (26.60, 9.82), head 34.24 and 9.93 (34.00,
// 9.89), lines 23.97 and 8.31 (23.88, 8.28), phone 34.83 and 15.24 (34.77, 15.21), survey 35.61 and 12.33 (35.50,
// 12.29), text 55.87 and 18.59 (55.60, 18.52) — each to the next 0.1 over where it passed its own. A list's printout's
// footer at the foot of every sheet, its room measured and kept there: list 79.13 and 25.72 (78.49, 25.51).
// Possible duplicates and Merge (0.25), a part of their own — the note of records like the one typed under the field
// they matched on, asked a moment after typing rests and left unheard when typing goes on, Open it, It's someone new
// remembered by record, Merge…'s screen of the two side by side, and their sheet — new, in fieldia.duplicates.js
// (duplicates 13.9, 5.9, as measured 13.89 and 5.87), loaded only where a page names duplicates and its source answers
// them, never waited for. In the main script they would have added 13.9 and 5.9 to every page.
// Wave 3's five lanes joined for 0.25, measured in the merged build (0.24.0's in brackets): list 98.16 and 31.66
// (72.41, 23.71: a related list's 4.96 and 1.55, the richer rows' 10.88 and 3.68, Import's button and report 2.95 and
// 0.74, Print 6.72 and 2.01, and a related list's cards and "5 of 23" — to 98.2 and 31.7); lines 30.92 and 10.68
// (23.88, 8.28: the paste's readers, and its rules for paper — to 31.0 and 10.7); head, text, business, files, survey
// and phone as the print lane set them; the new cards 11.53 and 3.67, import 33.15 and 13.29 and duplicates 13.90 and
// 5.87, each under its lane's; columns 10.82 and 4.00 — a column's grip saying its width from the first, as a
// separator that takes the focus must (axe on the contacts) — to 10.9 and 4.1.
// The 0.25 size pass, each part measured at 0.24.0 and after: a link to other records — a many2one's and a reference's
// box, a many2many's tags and checkboxes, a char field's tags, with the typed names' rules they share — new, in
// fieldia.relations.js (relations 19.6, 7.4, as measured 19.58 and 7.34); a long choice's search box and several answers
// as tags beside Fieldia's own list (choice 10.6, 4.4: 5.31 and 2.40 before, 10.59 and 4.31 after); a one2many's cards
// with their own sheet, and the lines' moves they share (lines 29.9, 10.2: 23.88 and 8.28 before, 29.82 and 10.13
// after); a value to copy and a live timer with their rules (business 29.6, 10.9: 26.60 and 9.82 before, 29.56 and
// 10.83 after).
// The size pass joined with Wave 3 for 0.25, measured in the merged build: lines 36.89 and 12.52 (a one2many's cards,
// a block pasted, and their rules for paper — to 36.9 and 12.6); business 29.91 and 10.90 (a value to copy and a timer
// with the statusbar's rules for paper — to 30.0 and 10.9); choice 10.59 and 4.31 and the new relations 19.58 and 7.34
// as the size pass set them; the rest as Wave 3's above. A related list's rows' tones, bold and buttons handed to its
// list: list 98.29 and 31.71, to 98.3 and 31.8.
// 0.25: the phone's "Country", none picked yet, a quarter of the text's colour in its grey, to read on Apple's dark fill
// (4.4:1 there), and its box keeping the page's autofill purpose ("mobile tel"): 34.83 and 15.25 (34.77, 15.21), its
// raw to 34.9, 29 bytes over 34.8.
// The business owner's walk of 0.24 mended (0.25): the list's — a CSV file's numbers, days and currency column, its
// several currencies said in the cell and on a heading, its headings' sums in full — 72.41 and 23.71 measured before,
// 73.63 and 24.11 after, to 73.7 and 24.2; the phone's table telling how each country's mobiles start, so a fixed line
// is offered no WhatsApp, and its letters said — 34.77 and 15.21 before, 37.04 and 16.19 after, to 37.1 and 16.2.
// The walk's engine lane joined, measured in the merged build: list 99.72 and 32.16 (several currencies said in a
// total and a heading, a CSV file's numbers and days, a workbook's times on the list's clock — to 99.8 and 32.2); phone
// 37.17 and 16.26 (its letters said, a mobile told by its prefix — to 37.2 and 16.3); slots 14.66 and 5.59 (a press kept
// to the time under it, the zone's all-year name — to 14.7 and 5.6); cards 11.41 and 3.65, choice 10.55 and 4.30,
// relations 19.57 and 7.34 (a list dropping open for a person alone), under theirs.
// The English words only a part reads, carried by that part and put in the tables as it comes (tools/part-words.mjs) —
// measured before and after, each to the next 0.1 over where it grew: list 98.16 and 31.66 to 101.79 and 32.98 (its
// search, filters, favourites, pager, Export, Edit, Print, Import's report and a related list's, 115 words); import
// 33.15 and 13.29 to 35.99 and 14.29 (its dialog's, 55, and a phone's reasons it reads, 6); files 32.37 and 11.92 to
// 33.46 and 12.32 (38); duplicates 13.90 and 5.87 to 14.79 and 6.24 (18); lines 36.89 and 12.52 to 37.78 and 12.85
// (25); survey 35.61 and 12.33 to 36.26 and 12.62 (20); slots 14.63 and 5.57 to 15.27 and 5.84 (19); text 55.87 and
// 18.59 to 56.45 and 18.84 (17); business 29.91 and 10.90 to 30.32 and 11.09 (13); phone 34.83 and 15.24 to 35.36 and
// 15.42 (11); relations 19.58 and 7.34 to 19.94 and 7.52 (8); head 34.24 and 9.93 to 34.46 and 10.02 (7); date 21.96
// and 8.30 to 22.13 and 8.38, filters 11.11 and 4.17 to 11.25 and 4.21, columns 10.82 and 4.00 to 10.96 and 4.05,
// path 15.95 and 6.26 to 16.06 and 6.31, choice 10.59 and 4.31 to 10.68 and 4.35 (five, four, four, three and two). A
// word two parts read is in both: either may come first. Cards, themes and quiet read none of their own.
// The words lane joined with every other lane, each part's own English with it, measured in the merged build: list
// 103.42 and 33.50 (the walk's several currencies and a CSV file's currency column among its words — to 103.5 and
// 33.6); import 35.99 and 14.29; lines 37.78 and 12.85; phone 37.77 and 16.47 (a phone's letters said); files 33.46
// and 12.32; survey 36.31 and 12.62; business 30.32 and 11.09; text 56.45 and 18.84; slots 15.29 and 5.85; relations
// 19.94 and 7.52; duplicates 14.79 and 6.24; head 34.46 and 10.02; date 22.13 and 8.38; filters 11.25 and 4.21;
// columns 10.96 and 4.05; path 16.06 and 6.31; choice 10.64 and 4.34 — each to the next 0.1 over; cards, themes and
// quiet as they were.
// A work item's head's title wraps where it is too long for its line, never cut (open-small): the head 34.46 and 10.02
// to 34.66 and 10.07 — its title drawn as a line that wraps and its first line's room kept for what stands beside it —
// to 34.7. (A tab's count's pill then moved to the main script's sheet, the head 34.36 and 10.01.)
// A tab's count of a related list in it, asked of the source as the record is shown and drawn in the tab's pill
// (open-small): list 103.42 and 33.50 to 104.25 and 33.78, to 104.3 and 33.8. Its rows and New the app's own way
// first (`"open": "app"`): 104.41 and 33.85, to 104.5 and 33.9.
// A column moved by dragging its header (0.26, open-columns): its ghost, the columns sliding aside, the line where it
// goes, Escape, a finger's long press, the table scrolled at its edges, its place said (the widgets' movedTo, carried
// by the part) and its sheet — columns 10.96 and 4.05 to 17.42 and 6.42; with the Columns menu's button given the
// focus back without scrolling the table to it, and the edge's scroll by the time a frame took, 17.53 and 6.48; with
// the Columns menu's cell held at the header's end, the card's marks for both held ends moved in from the list part,
// 18.28 and 6.64 — to 18.3 and 6.7. The list part, which hands each header and the card to it, 103.42 and 33.50 to
// 103.38 and 33.47, under its own.
// A page names its records (0.26, open-names): each part's sentences in the page's words for them, their English with
// it — list 103.42 and 33.50 measured before, 106.67 and 34.19 after (its pager, nothing found, Select all, Export,
// Edit, Print's count, Import's report and Undo, a related list's New, View all, None and "5 of 23 invoices" in its
// model page's words: 35), to 106.7 and 34.2; import 35.99 and 14.29 to 36.29 and 14.37 (Import 10 contacts, could not
// import them, made none of it: 4), to 36.3 and 14.4; duplicates 14.79 and 6.24 to 15.85 and 6.54 (a customer with
// this phone, It's a new customer, the merge's title, words and column: 7, and a label written small where the page
// says so), to 15.9 and 6.6.
// Every label inside a sentence small where the page asks (open-names, as one class): each part's sentences that put a
// label after a word asking the one rule in the main script (labelAt) — relations 19.93 and 7.52 to 20.09 and 7.59 (a
// link's ×, a tags' Add), phone 37.77 and 16.47 to 37.85 and 16.51 (its country's name), lines 37.78 and 12.85 to
// 37.86 and 12.89 (a line's cell that waits), filters 11.25 and 4.21 to 11.31 and 4.24, columns 10.96 and 4.05 to 11.06
// and 4.11, import 36.29 and 14.37 to 36.37 and 14.39 (its form's messages so) — each to the next 0.1 over; duplicates
// 15.85 and 6.54 to 15.69 and 6.46, its own lowering gone for the one rule, to 15.7 and 6.5. A list's Edit dialog
// asking its labels as the list's page does, and a related list naming none for a page that only asks them small:
// list 106.68 and 34.19 to 106.73 and 34.21, to 106.8 and 34.3.
// A table of lines a block round it on paper, which every engine breaks between its rows (0.26, open-print): lines
// 37.78 and 12.85 measured before, 37.85 and 12.87 after, its raw to 37.9.
// The four open-items lanes joined (0.26; each lane's lines above measured on 0.25.0), with across them a list on paper
// (no Columns cell, nothing held in view, no drag's ghost or line), a work item's head on paper (no Copy title) and a
// moved column said by the one rule (labelAt): head 34.46 and 10.02 measured on 0.25.0, 34.39 and 10.02 after; list
// 103.42 and 33.50 to 107.73 and 34.56; columns 10.96 and 4.05 to 18.86 and 6.78; lines 37.78 and 12.85 to 37.93 and
// 12.91; import 35.99 and 14.29 to 36.36 and 14.39; duplicates 14.79 and 6.24 to 15.67 and 6.45; relations 19.93 and
// 7.52 to 20.07 and 7.58; phone 37.77 and 16.47 to 37.84 and 16.50; filters 11.25 and 4.21 to 11.30 and 4.24 — each to
// the next 0.1 over; the rest as they were.
// A related list's View all saying what its list is kept to, as chips a person may take away (0.26, the owner walk's
// site lane: the record by its name, the list's own filter by its title; the list opened with them): list 107.73 and
// 34.56 measured before, 108.02 and 34.66 after, to 108.1 and 34.7.
// The owner's walk of 0.25 mended in the engine: lines 37.93 and 12.91 measured before, 40.51 and 13.97 after — a block
// pasted row by row, the plain table's and the grid's one way, its names read through the source's search, a row whose
// name reads as no record refused whole and said, a number, a day or a phone whole on paper; list 107.73 and 34.56 to
// 109.27 and 34.98 — the key over the rows, a printout's lines one each, its whole cells, an untitled related list's head
// off paper; import 36.36 and 14.39 to 37.59 and 14.77 — characters misread said, a header alone said, the rows to fix
// as the file had them under the fields' labels; cards 11.41 and 3.65 to 11.85 and 3.77 — an amount never broken
// inside, its line's room given; columns 18.86 and 6.78 to 19.01 and 6.86 — the name column held first — each to the
// next 0.1 over; the rest as they were (duplicates' 15.67 and 6.45 to 15.63 and 6.44).
// The owner's walk's two lanes joined: list 107.73 and 34.56 measured before, 109.56 and 35.09 after — their 0.29 and
// 1.54 added up — to 109.6 and 35.1; the other parts as the engine lane's line says.
// Print on intent (0.26, size-026): print new, 15.99 and 5.22 — the whole look's rules for paper (print-styles.ts, 9.35)
// and what is done as printing begins and Ctrl+P's print of the page (print-look.ts, 5.82) — to 16.0 and 5.3; list
// 109.56 and 35.09 measured before, 109.78 and 35.19 after — its Print waiting for the print part, a list meant for
// paper fetching it, and the words only it and the print part read now (printing, printedOn) — to 109.8 and 35.2.
// A grouped list's rows claiming no tree a table cannot hold (0.26.1, a11y-0261): each heading's button named with its
// count in words and its sums ("Cairo, 12 invoices, EGP 4.3M", their English with it), the arrows crossing a heading,
// Right and Left opening and closing it — list 109.78 and 35.19 measured before, 110.61 and 35.49 after, to 110.7
// and 35.5.
// "It's someone new" kept on the app's server where the source has notDuplicates and markNotDuplicate (0.27,
// loose-0262): asked as a saved record is shown, its matches waiting for it, each one let be kept there — the browser
// keeping one the source refuses — duplicates 15.63 and 6.45 measured before, 16.10 and 6.64 after, to 16.2 and 6.7.
// A table of lines' date column as wide as its longest day as its box writes it, or its pattern, beside the box's
// calendar button (0.27, loose-0262: the tender's "14 Mar 20…"): lines 40.51 and 13.97 measured before, 40.77 and 14.02
// after, to 40.8 and 14.1.
// A signature that signs answers (0.27, w4-signature): its evidence a part of its own, asked for only by a page whose
// signature signs answers (`partsFor`) — never by uploads or a plain signature — evidence new, 9.17 and 4.20: the
// canonical form and its SHA-256 an app works out again (signature-evidence.ts: the browser's SubtleCrypto first,
// worked out here where a page is served without https), who, when, which answers and their fingerprint kept with it
// once what is typed in them is read, the answers to put right said, "Signed by … , …" and whether the answers are as
// signed under it, Change answers asked in place (signature-signing.ts), its words and its sheet — to 9.2 and 4.3. The
// files part keeps the pad drawing and the picture kept whether or not it has come, and what waits for it: a signing,
// and a save for the signing; and, where it cannot come (offline, its script blocked), never a picture kept unsigned
// in silence — "Not signed yet: the signing could not load." with Try again, which asks for it again, where asking
// again can bring it (the one-tag script), else "… Reload the page to sign." and no button, and every save refusing the
// picture with those words — files 33.46 and 12.32 measured before, 36.15 and 13.26 after, to 36.2 and 13.3.
// Filters that sales teams and buyers expect (0.27, w4-filters): filters 11.30 and 4.24 measured before, 22.61 and 7.78
// after — a count beside each value, a range's dropdown with its presses (filter-range-control.ts), the phone's sheet
// with Show (filter-sheet.ts) and their sheet — to 22.7 and 7.8; list 110.61 and 35.49 to 117.51 and 37.85 — a range's
// boxes, words and chip and a count's mark, which it hands the filter bar (filter-range.ts, filter-count.ts: a part's
// code is in one part), a custom filter's "is between", the search bar's counts of its filters and favourites, a count
// asked of the source — to 117.6 and 37.9.
// Tables inside formatted text (0.27, w4-rich-tables): text 56.45 and 18.84 measured before, 73.00 and 24.62 after —
// the table tool, its picker of a size on a grid of 8 by 8 and its menu of what to do where the caret is (rich-table.ts,
// 4.0), rows and columns added and taken away round cells spanning several, a header row, Tab from cell to cell (a row
// past the last) and Escape out (formatted-text.ts), whatever is pasted from Word, Excel, Google Docs and Sheets or a
// page made plain — Word's lists lists again, fonts and colours left behind — and put in as given, what a Fieldia editor
// copies marked as its own so its colours, highlights and sizes come back with it (pasted-html.ts, 4.6), GitHub's tables
// in Markdown both ways, their look on the screen and on paper and their 22 English words — to 73.1 and 24.7; print 15.99 and 5.22 to 16.81 and 5.38 — a formatted text's
// table measured whole where it fits a sheet (print-look.ts), its field broken between its rows, the classic box a
// block — to 16.9 and 5.4.
// Endings and the answers in a page's own words (0.27, w4-endings): answers new, 4.13 and 2.07 — a value written as a
// sentence says it (sentence-value.ts), choices whose words follow the answers (worded-choices.ts), an ending drawn
// with its links (ending.ts) — to 4.2 and 2.1; head 34.39 and 10.02 measured before, 34.53 and 10.06 after — a split
// or toggled button's words with the answers they name — to 34.6 and 10.1.
// A table line's choices from the app's lists (0.27, w4-line-choices): a block pasted reads such a cell among its own
// line's choices, the row's links and other cells read first, and says why where they could not be asked, and a block
// pasted on a dropdown cell, where no engine sends a paste, is caught by a box of the table's own and spreads as on a
// text cell — lines 40.51 and 13.97 measured before, 42.26 and 14.57 after, to 42.3 and 14.6; a list's Import reads a
// choice that follows another field by each row's own values, once for each — import 37.59 and 14.77 to 38.02 and
// 14.99, to 38.1 and 15.0.
// A choice carried from an earlier question, read by every option it may hold (0.27, w4-rules): its list's cells,
// groups and filters by their labels — list 110.61 and 35.49 measured before, 110.71 and 35.52 after, to 110.8 and
// 35.6; Import reading such a choice's every option, and only a list's from the app — import 37.59 and 14.77 to 37.65
// and 14.80, to 37.7 and 14.9.
// Opening, closing and limiting a page, and save and resume (0.27, w4-limits), a part of its own — a closed form's
// words in place of its questions, the banner of answers it closed on, Continue later's button, what it kept, the link
// with Copy, a draft's key that names none, and their sheet — new, in fieldia.limits.js (limits 5.4, 2.5, as measured
// 5.37 and 2.41), loaded with the page's parts where it has limits or Continue later. In the main script it would have
// added them to every page. The survey kinds' picture cards draw an option's places too, and name a card whose words
// are out of sight with them: survey 36.31 and 12.62 measured before, 36.61 and 12.75 after, to 36.7 and 12.8.
// Both lanes' lines, merged for 0.27.0 (provisional): 40.51 + 0.26 + 1.75 and 13.97 + 0.05 + 0.60, to 42.6 and 14.7;
// list's 110.61 + 6.90 + 0.10 and 35.49 + 2.36 + 0.03, to 117.7 and 37.9; import's 37.59 + 0.43 + 0.06 and 14.77 + 0.22 +
// 0.03, to 38.1 and 15.1.
// An option's places beside its words in the choice part's own list, its list that searches and its tags, a full one
// refused there as in a radio (0.27, the release's cross-lane job): choice 11.15 and 4.56 measured with them, to 11.2
// and 4.6.
// Measured on the merged build, two parts past their lanes' numbers by what the lanes share: filters 22.69 and 7.81, to
// 22.7 and 7.9; import 38.11 and 15.03, to 38.2 and 15.1.
// The 0.27 size pass: memory new, 16.07 and 5.71 — a memory source's every member a backend has, on what the one-tag
// script's source keeps at once (memory-kept.ts, in the main script) — to 16.1 and 5.8; functions new, 4.32 and 1.88 —
// age, years, months, addDays, addMonths, addYears, contains, startsWith, endsWith, upper, lower, join, average,
// roundMoney, empty and firstOf, their bodies alone, and the days they count (dates.ts) — to 4.4 and 1.9; limits 5.37 and
// 2.41 measured before, 10.23 and 4.41 after — a form's limits, @fieldia/core's (form-limits.ts), in the same script as
// the viewer's: when the page takes answers and each choice's places, the counts asked, a full choice refused, and its
// six sentences — to 10.3 and 4.5; options new, 3.93 and 1.80 — each option's condition read once, a page's choice's
// and a table line's, the options carried from an earlier question, and what a change takes out — to 4.0 and 1.9. The
// page checks of what a part draws, carried by it: list 117.51 and 37.90 measured before, 125.94 and 40.49 after (a list
// page's filters, buttons, calendar, map, filter bar, rows' cards and rules, Edit and Import), to 126.0 and 40.5; head
// 34.53 and 10.10 to 36.48 and 10.79 (a record's head), to 36.5 and 10.8; limits 10.23 and 4.41 to 11.50 and 4.93 (a
// page's limits and Continue later), to 11.6 and 5.0; then a related list's checks — list 125.94 and 40.49 to 127.54 and
// 40.96, to 127.6 and 41.0 — booking slots' — slots 15.27 and 5.83 to 15.92 and 6.12, to 16.0 and 6.2 — a signature's —
// files 36.15 and 13.26 to 36.95 and 13.59, to 37.0 and 13.6 — and a page's endings — answers 4.13 and 2.07 to 4.65 and
// 2.32, to 4.7 and 2.4; mapchecks new, 5.76 and 2.24 — a map's layers, places, routes, reachable areas and fences, and
// the fields a pin and a card show, a form's map's and a list's — to 5.8 and 2.3; a table of lines' checks — its columns,
// totals, order, cells' and rows' rules, the columns a person may hide — lines 42.26 and 14.57 to 44.65 and 15.29, to
// 44.7 and 15.3; the app's own functions' calls — what one gives tidied, one that asks its server waiting for its answer
// — functions 4.32 and 1.88 to 5.25 and 2.26, to 5.3 and 2.3; a statusbar's checks — business 30.30 and 11.10 to 31.38
// and 11.53, to 31.4 and 11.6 — a table's line kinds' — lines 44.65 and 15.29 to 45.34 and 15.51, to 45.4 and 15.6 — and
// an address with suggestions' — mapchecks 5.76 and 2.24 to 6.89 and 2.56, to 6.9 and 2.6; what a list shows of its
// records, its columns' and cards' checks — list 127.54 and 40.96 to 128.95 and 41.42, to 129.0 and 41.5 — and options
// by condition and carried checked — options 3.93 and 1.80 to 4.97 and 2.25, to 5.0 and 2.3; Copy title's word in the
// head part (36.50 and 10.80, to 36.6 and 10.9), Export's in the list part (128.97 and 41.43, under its own).
// The owner's walk of 0.27 mended (0.27.1), each part's own: a list under a filter bar saying how many records it finds
// — list 128.97 and 41.43 to 129.50 and 41.60, in the filter bar's own row, to 129.5 and 41.7 — a card's line giving each field its label beside its
// value — cards 11.85 and 3.77 to 12.31 and 3.83, to 12.4 and 3.9 — a refused signature's note following the answers,
// with Sign now — evidence 9.17 and 4.20 to 9.79 and 4.38, to 9.8 and 4.4; files 36.95 and 13.59 to 36.99 and 13.62,
// to 37.0 and 13.7 — an unanswered slider's ring and "Not answered" — survey 36.61 and 12.75 to 37.88 and 13.00, to
// 37.9 and 13.1 — the day and time a form opens written as the date boxes write it — limits 11.50 and 4.93 to 11.63 and
// 5.01, to 11.7 and 5.1 — and the options a note of them taken out names, kept to judge it — options 4.97 and 2.25 to
// 5.02 and 2.28, to 5.1 and 2.3. Merged with the site's fixes (0.28.0), under their own: a page of one response from
// each person offering no other from its ending — answers 4.65 and 2.32 to 4.67 and 2.34 — and booking slots asked
// again once a response is sent — slots 15.92 and 6.12 to 15.98 and 6.15.
// A record's approvals (0.29, w5-approvals), a part of their own — the form's (asked of the source, a decision taken on
// the record as saved, its fields locked while it waits, a moment of its history in words, the page's checks of
// `approval`) and the viewer's (the band over the record, its levels, Approve and Reject, Reject's question, what stays
// open, its history folded, the focus on where it stands once a decision took its button, and their sheet) in one
// script — new, in fieldia.approvals.js (19.93 and 6.83, to 20.0 and 6.9), loaded with the page's parts where it has
// `approval`. In the main script it would have added them to every page.
// The memory source's approvals and decide, an approval engine in small (in turn or together, any or all, a rejection
// ending a round, a round each time a record is sent again) — memory 16.07 and 5.71 measured before, 18.68 and 6.68 after,
// to 18.7 and 6.7.
// A list's cells changed in place (Wave 5, w5-editable-list), in a part of its own — editable 28.70 and 10.57, to 28.8
// and 10.6: a cell opened in its field's own box, Tab, Escape and Enter, each row a form saved as it is left, one refused
// or met by someone else's save said under it, a row added, a paste across the rows and writeMany, a card's sheet, its
// sheet and its checks — and in the list part only the list's hooks for it (its rows wired, a press and Enter handed
// over, the saves waited for before it asks again, a row saved counted): list 129.50 and 41.60 to 130.54 and 41.96, to
// 130.6 and 42.0. In the list part it would have added 28.7 and 10.6 to every list's.
// A text kept in several languages (0.29, w5-two-languages): languages new, 10.78 and 4.54 — its switch over each of
// its boxes, the reader's language first, each language's box its field's own and written its own way; the form's
// checks of it in each language and its text in the reader's (@fieldia/core's, in the same script); a list's cell and
// card of it in the reader’s language, else another’s, marked; its page’s checks, and its sheet — to 10.8 and 4.6; a
// list's cell and a card drawing such a text through it — list 129.50 and 41.60 to 129.66 and 41.69, to 129.7 and 41.7;
// cards 12.31 and 3.83 to 12.40 and 3.85, to 12.5 and 3.9 — and a memory source's search, order and links' names
// reading each of its languages, a Group By of one by its text — memory 16.07 and 5.71 to 16.92 and 6.00, to 17.0 and 6.1.
// AI help (0.29, w5-ai) in a part of its own, fieldia.assist.js (34.42 and 11.71, to 34.5 and 11.8; values kept in their direction right to left): Fill from text
// and its dialog, or from a field's own words, the review of what was proposed, a proposal under its field with Accept, Reject and Undo, a text
// field's Draft and Polish, a proposed value read as its field holds one, a list's words read as filters, its sheet
// and its checks — waited for by a page with a Fill from text or a text field's tools, asked for as a list's ✦ is
// pressed and by the app's own `propose`. The list part draws the ✦ beside its box and takes a search in its bar's
// place (search-bar's `take`): list 129.48 and 41.62 measured before, 130.65 and 41.96 after, to 130.7 and 42.0; the
// filter bar takes one as well — filters 22.70 and 7.84 to 22.91 and 7.88, to 23.0 and 7.9; a memory source's AI
// members where its `assist` answers them — memory 16.10 and 5.72 to 16.46 and 5.81, to 16.5 and 5.9.
// A photo set (0.29, w5-photos): a part of its own, asked for only by a page with a picture field drawn as
// `"widget": "photos"`, and coming with the files part — photos new, 31.42 and 11.59: its tiles in the order a person
// puts them, dragged by a pointer or a finger resting on one, moved by keys and said, the cover marked and made,
// captions, a cropped photo's bar on its tile (photos.ts: 14.2 raw and 5.8 gzipped alone); the crop and turn dialog
// and its geometry (photo-editor.ts: 7.0 and 3.0); its sheet (7.0 and 2.0); and its words — to 31.5 and 11.6. The
// files part gives it what a picture field does already, never a second copy: its taking of photos picked or dropped
// (`takeFiles`, the file field's own now), a picture read for drawing (`readPicture`, shrinking's own), a picture's
// preview, and a photo's caption as its dialog's title — files 36.99 and 13.62 measured before, 37.36 and 13.77 after,
// to 37.4 and 13.8.
// A code scanned with the camera (0.29, w5-scan): scan new, 18.63 and 7.87 — a field's widget with its Scan button and
// why the camera did not open beside it, the camera's sheet reading its frames (the back camera, stopped as it closes,
// an item still in sight read once, a beep and a buzz), the reader it reads with (an app's own, the browser's
// BarcodeDetector, else the decode part), a code written into words, a link's record found by its code, a GS1 code's
// parts and the fields they fill, a table's lines counted, a grid cell's sheet outliving its editor, the page's checks
// of it, its words and its sheet — to 18.7 and 7.9; decode new, 153.78 and 38.94 — ZXing's readers of QR codes,
// DataMatrix, the UPC and EAN family, Code 128 and Code 39 (@zxing/library 0.23.0, its readers alone:
// tools/zxing-readers.mjs), loaded only as Scan is pressed in a browser that reads no codes itself — to 153.8 and 39.0.
// A number's total under its column read from the end, as the column's numbers are (lines 45.36 and 15.52 measured
// before, 45.51 and 15.54 after, to 45.6 and 15.6).
// A list's map whose data source gathers its records (Wave 5, w5-map-clusters): the memory source's `clusters`, there
// where its option says how it answers (`gridClusters`, outside the one-tag script), each record standing alone as a
// list's row is, by the row its `list` now shares — memory 16.08 and 5.72 measured before, 16.23 and 5.77 after, to
// 16.3 and 5.8.
// Merged (0.29.0), each part as measured: the list with the editable list's hooks, a text's languages and AI help's ✦
// (131.88 and 42.41); the memory source with approvals, languages, AI help and clusters (20.07 and 7.11); the files part
// with the uploads' work out of the main script (40.22 and 14.87, from 37.36 and 13.77); AI help with one language of a
// text kept in several (36.27 and 12.36); the editable part never opening such a text's cell (28.94 and 10.66).
// A work item's menus, tags and texts (lane atloria-wi): the menus inside a menu in the head part, which draws the
// head's buttons and ⋮ already — an item's menu beside it, on the side with room and on the screen, opened by a
// pointer, a press or the arrow toward it, its keys, the app's items asked as a menu opens and pressed by their steps,
// the dividers left only between items that show, under its item on a screen with room on neither side (menu-flyout.ts,
// 5.1 and 2.4); the checks of a divider and such an item (0.7 and 0.3); its sheet with tags inline in a head's row (1.1
// and 0.2) — head 36.50 and 10.80 measured before, 43.37 and 13.22 after, to 43.4 and 13.3. A rich text read first,
// Edit and Done with it, Escape and a press outside (html-field.ts) — text 73.00 and 24.62 to 73.45 and 24.78, to 73.5
// and 24.8.
// The owner's walk of 0.29 mended (walkfix29-engine): a cell opened by a press chooses its whole value, F2 puts the
// caret after it, its hint says so — editable 28.94 and 10.66 measured before, 29.16 and 10.76 after, to 29.2 and 10.8;
// a row added opens at the first cell a new record needs, its card named "New stage" — 29.62 and 10.90, to 29.7 and 11.0;
// a row no one may change here shows a lock at its start, and a press on it says why (its sheet's 8 rules, its words,
// its note) — 31.51 and 11.40, to 31.6 and 11.5; a paste of more than one row asked first, Undo for a few seconds after
// it (and Ctrl+Z), rows it left refused for one reason said once with a button for them all — 35.16 and 12.63, to 35.2
// and 12.7. Approvals routed as recommended: the memory source leaves the person who sent a record out of its round's
// approvers and moves a record its rules ask no level of on at once — memory 20.07 and 7.11 measured before, 21.09 and
// 7.44 after, to 21.1 and 7.5; the band says "No approval needed" over its history — approvals 19.93 and 6.83 to 20.18
// and 6.90, to 20.2 and 7.0. Scanning as the owner's walk asked: a code of a kind the field takes nothing from said in
// the sheet, a scanner gun's code typed in the box read as the camera reads one, a counted table's sheet with a box to
// type a code in — scan 18.63 and 7.87 measured before, 21.38 and 8.84 after, to 21.4 and 8.9; a scanned link's box
// asking for its record by code first — relations 20.08 and 7.59 to 20.32 and 7.68, to 20.4 and 7.7. (The main script
// grew 45 bytes, inside its budget: 33 in the shared table, for what these parts now take from it rather than a copy —
// isEmpty, drawIcon, formatNumber, inPlural, scanPart — and 12 in styles.ts, a muted pill's shade made over the surface
// so a hovered row keeps its words' contrast; 511.22 and 167.75 measured before, 511.26 and 167.77 after.) A record's
// status strip on a phone: the step it is in scrolled into view, at rest on a step, a fade and a sign at each edge with
// more past it, its frame, and the focus where none of its steps takes it — business 31.38 and 11.53 measured before,
// 34.30 and 12.45 after (the strip's code 1.7 KB, its sheet 1.2 KB), to 34.4 and 12.5. Propose values pressed with
// nothing pasted or added says what to do — assist 36.27 and 12.36 measured before, 36.70 and 12.45 after, to 36.8
// and 12.5. Photos named by their caption, else their place ("photo 2 of 5"), never their file; the crop dialog, Reject's
// question, Fill from text and the import asking "Discard your changes?" before Escape or × lets work go — photos 31.42
// and 11.59 measured before, 32.34 and 11.95 after, to 32.4 and 12.0; approvals 20.38 and 7.00, to 20.4 and 7.1;
// assist 36.95 and 12.56, to 37.0 and 12.6; import 38.11 and 15.03 measured before, 38.50 and 15.17 after, to 38.6
// and 15.2.
const PART_BUDGET_KB = { head: [43.4, 13.3], text: [73.5, 24.8], path: [16.1, 6.4], choice: [11.2, 4.6], filters: [23.0, 7.9], date: [22.2, 8.4], list: [131.9, 42.5], cards: [12.5, 3.9], columns: [19.1, 6.9], import: [38.6, 15.2], editable: [35.2, 12.7], themes: [12.3, 3.9], quiet: [8.5, 2.2], lines: [45.6, 15.6], business: [34.4, 12.5], files: [40.3, 14.9], evidence: [9.8, 4.4], photos: [32.4, 12.0], survey: [37.9, 13.1], phone: [37.9, 16.6], slots: [16.0, 6.2], relations: [20.4, 7.7], duplicates: [16.2, 6.7], answers: [4.7, 2.4], limits: [11.7, 5.1], approvals: [20.4, 7.1], print: [16.9, 5.4], memory: [21.1, 7.5], functions: [5.3, 2.3], options: [5.1, 2.3], mapchecks: [6.9, 2.6], languages: [10.8, 4.6], assist: [37.0, 12.6], scan: [21.4, 8.9], decode: [153.8, 39.0] };
// What each part gives, by the names the packages draw from.
const PART_GIVES = {
  head: ['recordHead', 'richButton', 'submenus', 'sectionHeading', 'wireMaximise', 'wireGrip', 'installHeadStyles', 'installGroupStyles'],
  text: ['modernHtml', 'linksWidget', 'formattedText', 'decorateLinks', 'markdownToHtml', 'htmlToMarkdown', 'markdownLoses', 'textMenu', 'cleanPasted', 'pasteHtml', 'putHtml'],
  path: ['pathPickerWidget'],
  choice: ['ownListWidget', 'searchWidget', 'choiceTagsWidget'],
  filters: ['filterBar', 'installFilterStyles'],
  date: ['dateBox', 'dateBoxWidget', 'dateRules', 'withCalendar', 'weekdayHead', 'dateRangeWidget'],
  list: ['listView', 'relatedList', 'relatedListPage', 'relatedCount', 'installListStyles'],
  cards: ['cardSpec', 'cardReads', 'drawCard', 'installCardStyles'],
  columns: ['columnChoices', 'columnsKey', 'installColumnStyles'],
  import: ['openImport', 'installImportStyles'],
  editable: ['editableRows', 'opens', 'rowReads', 'installEditableStyles'],
  themes: ['installThemeStyles'],
  quiet: ['installQuietStyles'],
  lines: ['linesWidget', 'linksTableWidget', 'cardsWidget', 'blockOf', 'readPastedCell', 'whyNotPasted'],
  business: ['statusbarWidget', 'priorityWidget', 'durationWidget', 'percentageWidget', 'distributionWidget', 'taxTotalsWidget', 'paymentsWidget', 'copyWidget', 'timerWidget'],
  files: ['binaryWidget', 'imageWidget', 'signatureWidget', 'pdfWidget', 'readFile', 'viewFiles', 'showAppFile', 'goingItem', 'goingList', 'goingWords', 'shrinkPhoto', 'shrinkFor', 'shrinkable', 'installFilesStyles', 'pumpUploads', 'fileFromBytes'],
  evidence: ['signingFor', 'signAnswers', 'answersMatch', 'signatureText', 'signedAnswers', 'canonicalJson', 'sha256Hex', 'installEvidenceStyles'],
  photos: ['photosWidget', 'editPhoto', 'drawEdited', 'fitted', 'moved', 'sized', 'turnedCrop', 'turnedSize', 'installPhotosStyles'],
  survey: ['rankingWidget', 'matrixWidget', 'sliderWidget', 'imageChoiceWidget', 'colourWidget', 'propertiesWidget', 'addressWidget', 'progressbarWidget'],
  phone: ['phoneWidget', 'readPhone', 'writePhone', 'shownPhone', 'phoneLinks', 'canBeMobile', 'phoneParts', 'phoneCountries', 'phoneCountry', 'flagOf'],
  slots: ['slotsWidget'],
  relations: ['many2oneWidget', 'tagsWidget', 'charTagsWidget', 'linkCheckboxesWidget', 'referenceWidget'],
  duplicates: ['watchDuplicates', 'openMergeScreen', 'installDuplicateStyles'],
  answers: ['sentenceValue', 'orderedDay', 'wordedWidget', 'drawEnding', 'linkedValueWords'],
  print: ['printLook', 'printPage', 'printAlone', 'installPrintStyles'],
  limits: ['drawLimits', 'installLimitsStyles', 'formLimits'],
  approvals: ['drawApprovals', 'installApprovalStyles', 'formApprovals', 'approvalWhen'],
  assist: ['watchAssist', 'searchWords', 'installAssistStyles'],
  memory: ['createMemoryDataSource', 'memorySource'],
  functions: ['functionBody', 'appCall'],
  options: ['optionRules'],
  mapchecks: ['checkMap', 'checkPlace'],
  languages: ['languagesWidget', 'languageWords', 'languageText', 'installLanguagesStyles', 'checkTranslated', 'languagesAtFault', 'languageName', 'textIn'],
  scan: ['scanning', 'openScanSheet', 'useCodeReader', 'codeReaderFor', 'readGs1', 'installScanStyles'],
  decode: ['codeReader'],
};
// The Fieldia object each part is reached through, as the packages ask for it.
const PART_OF = { head: 'headPart', text: 'textPart', path: 'pathPart', choice: 'choicePart', filters: 'filtersPart', date: 'datePart', list: 'listPart', cards: 'cardsPart', columns: 'columnsPart', import: 'importPart', editable: 'editablePart', themes: 'themesPart', quiet: 'quietPart', lines: 'linesPart', business: 'businessPart', files: 'filesPart', evidence: 'evidencePart', photos: 'photosPart', survey: 'surveyPart', phone: 'phonePart', slots: 'slotsPart', relations: 'relationsPart', duplicates: 'duplicatesPart', answers: 'answersPart', limits: 'limitsPart', approvals: 'approvalsPart', print: 'printPart', memory: 'memoryPart', functions: 'functionsPart', options: 'optionRulesPart', mapchecks: 'mapChecksPart', languages: 'languagesPart', assist: 'assistPart', scan: 'scanPart', decode: 'decodePart' };
if (PARTS.join() !== Object.keys(PART_GIVES).sort().join()) throw new Error(`the main script asks for the parts ${PARTS.join(', ')}; this check knows ${Object.keys(PART_GIVES).sort().join(', ')}`);
// The parts a part comes with, in as it is: booking slots bring the date part, whose box they are without the data
// source's slots; a photo set the files part, whose taking, files on their way, dialog and sheet it draws with.
const PART_BESIDE = { slots: ['date'], photos: ['files'] };
/** Every Arabic word of the three tables, as the packages have them. */
const ARABIC = await sourceWords('ar');
/** A part's own words (PART_WORDS) Fieldia's tables in `locale` do not hold as `words` have them, by table and key. */
const wordsNotIn = (fieldia, locale, part, words) =>
  Object.entries(partEnglish(part)).flatMap(([table, own]) => Object.keys(own).filter((key) => fieldia[GLOBAL_OF[table]][locale]?.[key] !== words[table][key]).map((key) => `${table}.${key}`));
const partSizes = [];
for (const part of PARTS) {
  const file = partFiles[part];
  const partCode = readFileSync(file, 'utf8');
  const name = `fieldia.${part}.js`;
  if (/mountViewer|createForm/.test(partCode)) throw new Error(`${name} carries a copy of Fieldia: it must carry its own code alone`);
  if (/ZodError|\$ZodType/.test(partCode)) throw new Error(`${name} carries zod`);
  if (/\\u06[2-4][0-9a-f]/i.test(partCode)) throw new Error(`${name} carries Arabic letters: a part's words are the packages' tables', in the language add-ons`);
  const [raw, gzip] = PART_BUDGET_KB[part];
  const partBytes = statSync(file).size;
  const partGzipped = gzipSync(partCode, { level: 9 }).length;
  if (partBytes > raw * 1024) throw new Error(`${name} is ${(partBytes / 1024).toFixed(2)} KB, over its ${raw} KB budget`);
  if (partGzipped > gzip * 1024) throw new Error(`${name} is ${(partGzipped / 1024).toFixed(1)} KB gzipped, over its ${gzip} KB budget`);
  const beside = (PART_BESIDE[part] ?? []).map((other) => partFiles[other]);
  for (const order of [[OUT, ...beside, file], [file, ...beside, OUT], [OUT, file, ...beside, file]]) {
    const { Fieldia: withIt, warnings } = runTogether(order);
    const loaded = order.map((f) => f.replace(BUNDLE + '/', '')).join(', then ');
    const gives = await runInNewContext(`Fieldia.${PART_OF[part]}.load()`, withIt ? { Fieldia: withIt } : {});
    const missing = PART_GIVES[part].filter((one) => typeof gives?.[one] !== 'function');
    if (missing.length) throw new Error(`${loaded}: ${name} does not give ${missing.join(', ')}`);
    if (withIt[PART_OF[part]].loaded !== gives) throw new Error(`${loaded}: Fieldia.${PART_OF[part]} does not hold what ${name} gave`);
    if (warnings.length) throw new Error(`${loaded}: ${warnings.join(' ')}`);
    const wrong = wordsNotIn(withIt, 'en', part, ENGLISH);
    if (wrong.length) throw new Error(`${loaded}: Fieldia's English lacks ${name}'s own words once it came: ${wrong.join(', ')}`);
  }
  // Its words in Arabic once both are in, whichever came first — the add-on's, never the part's English — and an app's
  // own word, set before the part came, kept.
  if (Object.keys(partEnglish(part)).length) {
    const arabic = join(BUNDLE, 'fieldia.ar.js');
    for (const order of [[OUT, arabic, ...beside, file], [OUT, ...beside, file, arabic], [file, ...beside, arabic, OUT]]) {
      const { Fieldia: withIt, warnings } = runTogether(order);
      await runInNewContext(`Fieldia.${PART_OF[part]}.load()`, { Fieldia: withIt });
      const loaded = order.map((f) => f.replace(BUNDLE + '/', '')).join(', then ');
      const wrong = wordsNotIn(withIt, 'ar', part, ARABIC);
      if (wrong.length || warnings.length) throw new Error(`${loaded}: Fieldia's Arabic does not have ${name}'s own words in Arabic: ${[...wrong, ...warnings].join(', ')}`);
    }
    const page = {};
    const { Fieldia: alone } = runTogether([OUT, ...beside], page);
    const [table, words] = Object.entries(partEnglish(part))[0];
    const [key] = Object.keys(words);
    alone[GLOBAL_OF[table]].en[key] = 'The app’s own';
    runTogether([file], page);
    await runInNewContext(`Fieldia.${PART_OF[part]}.load()`, page);
    if (alone[GLOBAL_OF[table]].en[key] !== 'The app’s own') throw new Error(`${name} put its own English over an app's word for ${table}.${key}, set before it came`);
  }
  // A part of another version: refused with a warning, and the part asked for fails, so the page draws plainly.
  const older = partCode.replace(`, ${JSON.stringify(version)}, function`, ', "0.0.0", function');
  if (older === partCode) throw new Error(`${name} does not say its version where the main script reads it`);
  const warned = [];
  const host = { console: { warn: (message) => warned.push(message) } };
  runInNewContext(readFileSync(OUT, 'utf8'), host);
  runInNewContext(older, host);
  const refused = await host.Fieldia[PART_OF[part]].load().then(() => false, () => true);
  if (!refused || warned.length !== 1 || !warned[0].includes(`${name} is version 0.0.0`)) throw new Error(`${name} of another version is not refused with a warning`);
  partSizes.push(`${part} ${(partBytes / 1024).toFixed(1)} KB, ${(partGzipped / 1024).toFixed(1)} KB gzipped`);
}
// Every name the parts take from the main script is set as the main script starts: the table is made then, and a const
// of a module the main script has not run by that time (one in an import cycle with the table, as the parts' holders
// are) would be undefined in it — a part takes a function of it instead.
{
  const host = { console: { warn: () => undefined } };
  runInNewContext(readFileSync(OUT, 'utf8'), host);
  let shared;
  host.FieldiaParts.push(['shared-names', version, (given) => (shared = given)]);
  const unset = table.flatMap(([file, names], i) => names.filter((name) => shared?.[i]?.[name] === undefined).map((name) => `${name} (${file.replace(`${WORKSPACE}/`, '')})`));
  if (unset.length) throw new Error(`the parts take names the main script has not set as it starts: ${unset.join(', ')}`);
}
// Asked for with no address to load it from (no document here), a part not on the page fails — and is asked again next time.
{
  const host = { console: { warn: () => undefined } };
  runInNewContext(readFileSync(OUT, 'utf8'), host);
  const failed = await host.Fieldia.headPart.load().then(() => false, () => true);
  runInNewContext(readFileSync(partFiles.head, 'utf8'), host);
  const later = await host.Fieldia.headPart.load().then((gives) => typeof gives.recordHead === 'function', () => false);
  if (!failed || !later) throw new Error('a part that could not come is not asked for again');
}
// The checks a part carries (`CHECKS_IN_PARTS`): owed by the main script's check until the part came — a list page
// grouped by a field it does not have passes as it is mounted, its check saying the list part's are owed — then run,
// the same mistake found as the packages' check finds it at once.
{
  const listPage = JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages/customers.page.json'), 'utf8'));
  const wrong = { ...listPage, layout: { ...listPage.layout, groupBy: ['nowhere'] } };
  const { Fieldia: alone } = runTogether([OUT]);
  const before = alone.checkPage(wrong);
  if (!before.ok || before.later?.join() !== 'list') throw new Error(`a list page's own checks are not owed to the list part before it came: ${JSON.stringify(before.later ?? before.issues)}`);
  if (alone.checkPage(listPage).later?.join() !== 'list') throw new Error("a list page's own checks are not owed to the list part");
  const { Fieldia: withList } = runTogether([OUT, partFiles.list]);
  await withList.listPart.load();
  const after = withList.checkPage(wrong);
  if (after.ok || after.later || !after.issues.some((issue) => issue.path === 'layout.groupBy[0]' && issue.message === 'no field "nowhere"')) throw new Error(`a list page's own checks are not run once the list part came: ${JSON.stringify(after)}`);
  if (alone.checkPage({ ...wrong, layout: { type: 'sections', id: 's', children: [] } }).later) throw new Error('a page with no list owes the list part its checks');
  // A list whose cells change in place owes the editable part its checks — beside the list part's — then a column it
  // names that no cell can change is said, as the packages' check says it.
  const prices = JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages/service-prices.page.json'), 'utf8'));
  const unchangeable = { ...prices, layout: { ...prices.layout, editable: { fields: ['per_hour'] } } };
  if (alone.checkPage(unchangeable).later?.join() !== 'editable,list') throw new Error(`a list's cells changed in place do not owe the editable part their checks: ${JSON.stringify(alone.checkPage(unchangeable).later)}`);
  const { Fieldia: withEditable } = runTogether([OUT, partFiles.list, partFiles.editable]);
  await Promise.all([withEditable.listPart.load(), withEditable.editablePart.load()]);
  const refusedCells = withEditable.checkPage(unchangeable);
  if (refusedCells.ok || refusedCells.later || !refusedCells.issues.some((issue) => issue.path === 'layout.editable.fields[0]' && issue.message.includes('worked out from other fields'))) throw new Error(`a list's cells changed in place are not checked once the editable part came: ${JSON.stringify(refusedCells)}`);
  // A map's checks owed to a part of their own: a form's map at once, and a list's on a map once the list part ran them.
  const mapOrder = JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages/map-order.page.json'), 'utf8'));
  if (!alone.checkPage(mapOrder).later?.includes('mapchecks')) throw new Error(`a form's map's checks are not owed to their part: ${JSON.stringify(alone.checkPage(mapOrder).later)}`);
  const homes = JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages/map-homes.page.json'), 'utf8'));
  if (withList.checkPage(homes).later?.join() !== 'mapchecks') throw new Error("a list on a map does not owe its map's checks once the list part ran its own");
  // In a page: such a list mounted before its part came draws nothing, and what is drawn rejects with the mount's words.
  const { JSDOM } = await import('jsdom');
  const dom = new JSDOM('<!doctype html><html><head><script src="fieldia.js"></script></head><body><div id="app"></div></body></html>', { url: pathToFileURL(join(BUNDLE, 'page.html')).href, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true });
  await new Promise((done) => dom.window.addEventListener('load', done));
  const host = dom.window.document.getElementById('app');
  const view = dom.window.Fieldia.mountViewer(host, { page: wrong, dataSource: { list: async () => ({ records: [], total: 0 }) } });
  const said = await view.drawn.then(() => null, (error) => error.message);
  if (!said?.startsWith('This page cannot be shown') || !said.includes('layout.groupBy[0]: no field "nowhere"') || host.childElementCount) throw new Error(`in a page, a list page whose own checks came with its part is drawn, or not refused: ${said}`);
  // A list of homes on a map whose pins' photo is words: the list part's checks, in already, owe the map's, asked for
  // then — the mistake said as the packages' check says it, nothing drawn.
  const worded = { ...homes, layout: { ...homes.layout, map: { ...homes.layout.map, pin: { ...homes.layout.map.pin, image: 'name' } } } };
  const mapped = dom.window.Fieldia.mountViewer(host, { page: worded, dataSource: { list: async () => ({ records: [], total: 0 }) } });
  const saidOfMap = await mapped.drawn.then(() => null, (error) => error.message);
  if (!saidOfMap?.includes('layout.map.pin.image: "name" is a char; a pin\'s photo is an image or binary field') || host.childElementCount || !dom.window.Fieldia.mapChecksPart.loaded) throw new Error(`in a page, a list on a map whose map's checks came in their part is drawn, or not refused: ${saidOfMap}`);
  dom.window.close();
}
console.log(`parts: ${partSizes.join('; ')}`);
console.log("a part's checks: a list page's own owed to the list part until it came, a list's cells changed in place to the editable part, a map's to theirs, then run as the packages' check runs them — in a page, one that finds a mistake draws nothing, and its drawn rejects with the mount's words");

/**
 * In a page, as a browser runs it: the main script, from an address of its own, asks for nothing while a page uses no
 * part, and for each part the first time a page uses one, from beside itself — a phone read the world over, a list's
 * screen (its phones, its totals, its Export and Edit), its Import, its cards and the columns a person shapes, a
 * gallery, a record's related list, a theme, a table of lines, a customer's statusbar and photo, a work item's head,
 * text and path picker for its bug, the filter bar for its backlog, a date's box (on a public page with its bot check),
 * the survey kinds, a booking's slots, a customer's possible duplicates (never waited for), the print part for a page
 * meant for paper (fetched once it is drawn, never run, never waited for), a signature's evidence for a consent whose
 * signature signs its answers (never for a plain signature or uploads) — and the page is drawn whole once they have
 * come. Pages
 * open in an order where each part's first use is clear, the parts in after each step said in full.
 */
{
  const { JSDOM, VirtualConsole } = await import('jsdom');
  const problems = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => problems.push(error.message));
  virtualConsole.on('error', (message) => problems.push(String(message)));
  const dom = new JSDOM('<!doctype html><html><head><script src="fieldia.js"></script></head><body><div id="app"></div></body></html>', {
    url: pathToFileURL(join(BUNDLE, 'page.html')).href,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
  });
  await new Promise((done) => dom.window.addEventListener('load', done));
  const { Fieldia: inPage, document: doc } = dom.window;
  // The memory part is a data source's, never a page's: said apart below.
  const loaded = () => PARTS.filter((part) => part !== 'memory' && inPage[PART_OF[part]].loaded).join(', ');
  /** The parts in after a step, every one so far — as one run of this check found them, each part's first use clear. */
  const hasIn = (step, want) => {
    const now = loaded();
    if (now !== want) throw new Error(`in a page, after ${step} the parts in are ${now || 'none'}, not ${want || 'none'}`);
  };
  const host = doc.getElementById('app');
  const read = (name) => JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages', name), 'utf8'));
  const tick = (ms = 10) => new Promise((done) => dom.window.setTimeout(done, ms));
  /** Wait for what a page draws once its source has answered (a list's rows, its totals). */
  const until = async (ready) => {
    for (let turn = 0; turn < 100 && !ready(); turn++) await tick();
    return ready();
  };
  // Each page taken away whole: nothing of it left in the app's element for the next.
  const gone = (name) => {
    if (host.childElementCount) throw new Error(`in a page, ${name} left ${host.childElementCount} element(s) behind once destroyed: ${[...host.children].map((e) => e.className).join(', ')}`);
  };
  /** A page that waits for a part: nothing of it drawn before the part came, the page busy meanwhile. */
  const waits = (view, what) => {
    if (host.querySelector('.fd-field, .fd-list') || view.element.getAttribute('aria-busy') !== 'true') throw new Error(`in a page, ${what} drew before its part came`);
  };
  // A page whose app gives its own data source never asks for the memory part. A memory source is handed over at once —
  // its records, its calls, someone else's change — and its members answer once their part came, asked for the first
  // time one is called.
  {
    const own = inPage.mountViewer(host, { page: read('delivery.page.json'), dataSource: { submit: async () => ({}) } });
    await own.drawn;
    own.destroy();
    if (inPage.memoryPart.loaded) throw new Error('in a page, an app with its own data source brought the memory part');
    const memory = inPage.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } } }, versions: true });
    if (inPage.memoryPart.loaded || memory.records.partner[1].name !== 'Nile Traders' || memory.changeElsewhere('partner', 1, { name: 'Nile Traders Co.' }, { by: 'Mona' }).by !== 'Mona') throw new Error("in a page, a memory source's own state is not there at once");
    const read1 = await memory.load({ model: 'partner', id: 1, fields: {} });
    if (!inPage.memoryPart.loaded || read1.values?.name !== 'Nile Traders Co.' || memory.calls.length !== 1) throw new Error(`in a page, a memory source does not answer once its part came: ${JSON.stringify(read1)}`);
    if (inPage.createMemoryDataSource().load === memory.load) throw new Error('in a page, a memory source made once its part came is not made whole');
  }
  // A page of plain parts — a delivery's words and a tick, no link to another record: drawn at once, nothing asked for.
  const plain = inPage.mountViewer(host, { page: read('delivery.page.json'), dataSource: inPage.createMemoryDataSource() });
  if (!host.querySelector('.fd-field')) throw new Error('in a page, a page using no part is not drawn at once');
  await plain.drawn;
  hasIn('a page of plain parts', '');
  // On paper, its printout's head: in every form, hidden, its rules for paper in this script's sheet.
  if (!host.querySelector('.fd-form .fd-print-head[aria-hidden="true"]')) throw new Error("in a page, a form carries no printout's head");
  plain.destroy();
  gone('plain');
  // A form whose phones are read the world over (its page's phone): the phone part, the page drawn once it came,
  // its phone's country before the number, its sheet in — and its customer's country, a link to another record: the
  // relations part.
  const contact = inPage.mountViewer(host, { page: { ...read('new-customer.page.json'), phone: { country: 'EG' } }, dataSource: inPage.createMemoryDataSource() });
  waits(contact, 'a page with a phone read the world over');
  await contact.drawn;
  hasIn('a phone read the world over', 'phone, relations');
  if (!host.querySelector('.fd-phone .fd-phone-country select') || !doc.getElementById('fieldia-phone-styles')) throw new Error('in a page, a phone is not drawn from its part');
  if (!host.querySelector('.fd-combo > .fd-combo-input[role="combobox"]') || host.querySelector('[data-fd-plain="link"]')) throw new Error("in a page, a link to another record is not drawn from its part");
  contact.destroy();
  gone('contact');
  // A list with its search bar: the list part, the page drawn once it came; its phone column's numbers written by the
  // phone part, in already. Export, Edit, Import and Print are asked for by the page: none is in its bar. Its cards on a
  // phone (the demo's customers have some) left out: a list that asks for none never brings the cards part.
  const listed = read('customers.page.json');
  const customers = inPage.mountViewer(host, { page: { ...listed, layout: { ...listed.layout, card: undefined } }, dataSource: inPage.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', phone: '+201012345678' } } } }) });
  waits(customers, 'a list');
  await customers.drawn;
  hasIn("a list's screen", 'list, phone, relations');
  if (!host.querySelector('.fd-list-table') || !host.querySelector('.fd-search-input') || !doc.getElementById('fd-list-styles')) throw new Error('in a page, a list is not drawn from its part');
  if (!(await until(() => host.querySelector('.fd-list-row')))?.textContent.includes('+20 10 1234 5678')) throw new Error(`in a page, a list's phone is not written as people read it: ${host.querySelector('.fd-list-row')?.textContent ?? 'no row'}`);
  if (!host.querySelector('.fd-list-export')?.hidden || host.querySelector('.fd-list-edit') || !host.querySelector('.fd-list-import-button')?.hidden || !host.querySelector('.fd-list-print-button')?.hidden) throw new Error('in a page, a list that asks for none shows Export, Edit, Import or Print');
  customers.destroy();
  gone('customers');
  // Invoices that add up: the list part already in, the totals row under the list from the source's totals.
  const year = new Date().getFullYear();
  const egp = { id: 1, label: 'EGP' };
  const invoiced = { 1: { name: 'INV/1', invoice_date: `${year}-01-15`, due_date: `${year}-02-15`, state: 'paid', currency_id: egp, amount: 100 }, 2: { name: 'INV/2', invoice_date: `${year}-01-20`, due_date: `${year}-02-20`, state: 'sent', currency_id: egp, amount: 250 } };
  const invoices = inPage.mountViewer(host, { page: read('invoices.page.json'), dataSource: inPage.createMemoryDataSource({ records: { invoice: invoiced, currency: { 1: { name: 'EGP' } } } }) });
  await invoices.drawn;
  // Its rows cards on a phone (the cards part), its totals in sight under them; Print in its bar, as it asks — and so,
  // a page meant for paper, the print part fetched once the page is drawn and the browser idle (print.ts), never run:
  // the first part a page asks for that it draws nothing from. Every page before it asked for none of it.
  hasIn('invoices that add up, before the browser is idle', 'cards, list, phone, relations');
  for (let turn = 0; turn < 300 && !inPage.printPart.loaded; turn++) await tick();
  hasIn('invoices that add up', 'cards, list, phone, print, relations');
  if (host.querySelector('form.fd-form')?.hasAttribute('data-fd-print')) throw new Error('in a page, the print part fetched for a page meant for paper laid it out for paper');
  if (host.querySelector('.fd-list-print-button')?.hidden !== false) throw new Error('in a page, a list that asks for Print does not offer it');
  if (!(await until(() => host.querySelector('.fd-list-total:not([hidden])')?.textContent.includes('350')))) throw new Error(`in a page, a list's totals row is not drawn: ${host.querySelector('.fd-list-total')?.textContent ?? 'no totals row'}`);
  invoices.destroy();
  gone('invoices');
  // Contacts taken away and changed in bulk: Export and Edit in the list's bar, as the page asks; their columns shaped
  // by the person (the columns part, its Columns menu at the header's end) and their cards on a phone (the cards part,
  // in already: a card in each row the table hides), each sheet right after the list's own.
  const contacts = inPage.mountViewer(host, { page: read('contacts.page.json'), dataSource: inPage.createMemoryDataSource({ records: { 'crm.contact': { 1: { name: 'Nile Traders', state: 'customer', phone: '+201012345678' } } } }) });
  waits(contacts, 'a list with cards and columns a person shapes');
  await contacts.drawn;
  hasIn('contacts to export, edit in bulk and shape', 'cards, columns, list, phone, print, relations');
  if (host.querySelector('.fd-list-export')?.hidden !== false || !host.querySelector('.fd-list-edit')) throw new Error("in a page, a list that asks for Export and Edit does not offer them");
  const contactRow = await until(() => host.querySelector('.fd-list-row'));
  if (!host.querySelector('thead .fd-list-columns-button') || !contactRow?.querySelector('.fd-list-card .fd-list-card-title') || !contactRow.querySelector('td[data-col="state"] .fd-value-badge')) throw new Error("in a page, a list's Columns menu, cards or pills are not drawn from their parts");
  const listSheets = [...doc.head.querySelectorAll('style[id^="fd-list"]')].map((style) => style.id).join(', ');
  if (listSheets !== 'fd-list-styles, fd-list-columns-styles, fd-list-cards-styles' && listSheets !== 'fd-list-styles, fd-list-cards-styles, fd-list-columns-styles') throw new Error(`in a page, the list's sheets are not in their order: ${listSheets}`);
  // Its Import, in the bar without its part; pressed, the import part comes, its dialog and its sheet with it.
  const importing = host.querySelector('.fd-list-import-button');
  if (!importing || importing.hidden) throw new Error('in a page, a list that asks for Import does not offer it');
  hasIn('contacts with Import in their bar', 'cards, columns, list, phone, print, relations');
  importing.click();
  if (!(await until(() => doc.querySelector('.fd-import .fd-import-drop')))) throw new Error("in a page, Import's dialog is not drawn from its part");
  hasIn('Import pressed', 'cards, columns, import, list, phone, print, relations');
  if (!doc.getElementById('fieldia-import-styles')) throw new Error("in a page, Import's sheet is not put in");
  doc.querySelector('.fd-import .fd-dialog-close').click();
  if (doc.querySelector('.fd-import')) throw new Error("in a page, Import's dialog is not taken away as it closes");
  contacts.destroy();
  gone('contacts');
  // Homes as a gallery: the cards part already in, the list opening on its cards.
  const homes = inPage.mountViewer(host, { page: read('homes-gallery.page.json'), dataSource: inPage.createMemoryDataSource({ records: { home: { 1: { name: 'Nile view flat', offer: 'sale', price: 4500000, currency: 'EGP' } } } }) });
  await homes.drawn;
  hasIn('homes as a gallery', 'cards, columns, import, list, phone, print, relations');
  if (host.querySelector('.fd-list')?.getAttribute('data-as') !== 'gallery' || !(await until(() => host.querySelector('.fd-list-card')))) throw new Error('in a page, a gallery does not open on its cards');
  homes.destroy();
  gone('homes');
  // A customer with its invoices listed inside it: the list part's table, already in, for the records that point at it;
  // the cards part's card in each row, which a phone shows in place of the columns.
  const account = inPage.mountViewer(host, {
    page: read('customer-account.page.json'),
    recordId: 1,
    dataSource: inPage.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders' } }, invoice: { ...invoiced, 3: { ...invoiced[1], name: 'INV/3', partner_id: { id: 1, label: 'Nile Traders' } } } } }),
  });
  await account.drawn;
  hasIn('a customer with its invoices', 'cards, columns, import, list, phone, print, relations');
  if (!(await until(() => host.querySelector('[data-node="invoices"] .fd-list-row')))?.textContent.includes('INV/3') || host.querySelectorAll('[data-node="invoices"] .fd-list-row').length !== 1) throw new Error(`in a page, a related list does not list the records that point at its record: ${host.querySelector('[data-node="invoices"]')?.textContent ?? 'no related list'}`);
  if (!host.querySelector('[data-node="invoices"] .fd-list-row .fd-list-card .fd-list-card-title')) throw new Error("in a page, a related list's rows carry no card for a phone");
  account.destroy();
  gone('account');
  // A theme the app gives: the page drawn at once with no theme, which it wears once its part came — then another at once.
  const themed = inPage.mountViewer(host, { page: read('new-customer.page.json'), dataSource: inPage.createMemoryDataSource(), theme: 'material' });
  if (!host.querySelector('.fd-field') || themed.element.hasAttribute('data-fd-theme')) throw new Error('in a page, a theme the app gives held the page back, or was worn before its part came');
  await themed.drawn;
  hasIn('a theme the app gives', 'cards, columns, import, list, phone, print, relations, themes');
  if (themed.element.getAttribute('data-fd-theme') !== 'material' || !doc.getElementById('fieldia-theme-styles')) throw new Error('in a page, a theme the app gives is not worn from its part');
  themed.setTheme('odoo');
  if (themed.element.getAttribute('data-fd-theme') !== 'odoo') throw new Error('in a page, a theme switched to is not worn at once once its part is in');
  themed.destroy();
  gone('themed');
  // An order with a table of its items: the lines part, its sheet before the page's own looks, the page drawn once it
  // came — nothing of it before.
  const order = inPage.mountViewer(host, { page: read('rules.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(order, 'a page with a table of lines');
  await order.drawn;
  hasIn('an order with a table of lines', 'cards, columns, import, lines, list, phone, print, relations, themes');
  if (!host.querySelector('.fd-lines .fd-lines-table') || host.querySelector('.fd-lines-plain')) throw new Error('in a page, a table of lines is not drawn from its part');
  order.destroy();
  gone('order');
  // A customer's sheet: its statusbar's part, the business widgets', its photo's, the files part, and its table of
  // contacts', the lines part — the page drawn once they came, nothing of it before.
  const customer = inPage.mountViewer(host, { page: read('customer.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(customer, 'a sheet with a statusbar and a photo');
  await customer.drawn;
  hasIn("a customer's sheet", 'business, cards, columns, files, import, lines, list, phone, print, relations, themes');
  if (!host.querySelector('.fd-header .fd-statusbar [aria-current="step"]')) throw new Error('in a page, a statusbar is not drawn from its part');
  if (!host.querySelector('.fd-file.fd-file-image .fd-file-pick')) throw new Error('in a page, a customer\'s photo is not drawn from its part');
  customer.destroy();
  gone('customer');
  // A work item's bug: its parts asked for — its quiet skin's among them — the page drawn once they came, nothing of it before.
  const bug = inPage.mountViewer(host, { page: read('work-item-bug.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(bug, "a work item's bug");
  await bug.drawn;
  hasIn("a work item's bug", 'business, cards, choice, columns, files, head, import, lines, list, path, phone, print, quiet, relations, text, themes');
  if (!host.querySelector('.fd-head') || !host.querySelector('.fd-path') || !host.querySelector('.fd-text') || !host.querySelector('.fd-own-box') || !host.querySelector('.fd-field[data-quiet]') || bug.element.getAttribute('data-fd-theme') !== 'fluent' || bug.element.hasAttribute('aria-busy')) throw new Error('in a page, a work item\'s bug is not drawn from its parts');
  for (const id of ['fieldia-head-styles', 'fieldia-editor-styles', 'fieldia-path-styles', 'fieldia-choice-styles', 'fieldia-theme-styles', 'fieldia-quiet-styles']) if (doc.getElementById(id)?.nextElementSibling === null) throw new Error(`in a page, ${id} is not before the page's own looks`);
  bug.destroy();
  gone('bug');
  // Its backlog: the filter bar's part too.
  const backlog = inPage.mountViewer(host, { page: read('backlog.page.json'), dataSource: inPage.createMemoryDataSource() });
  await backlog.drawn;
  hasIn('a backlog', 'business, cards, choice, columns, files, filters, head, import, lines, list, path, phone, print, quiet, relations, text, themes');
  if (!host.querySelector('.fd-filter-bar')) throw new Error("in a page, a backlog's filter bar is not drawn from its part");
  backlog.destroy();
  gone('backlog');
  // A public sign-up with a date: its box and calendar's part, the page drawn once it came — nothing of it before — and
  // its bot check, which is this script's: the box no person sees, before the answers.
  const signup = inPage.mountViewer(host, { page: read('signup.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(signup, 'a page with a date');
  await signup.drawn;
  hasIn('a sign-up with a date and a bot check', 'business, cards, choice, columns, date, files, filters, head, import, lines, list, path, phone, print, quiet, relations, text, themes');
  if (!host.querySelector('.fd-date-pick .fd-calendar-button')) throw new Error('in a page, a date is not drawn from its part');
  if (!host.querySelector('.fd-trap[inert] input[name="website"]')) throw new Error("in a page, a public page's bot check has no hidden box");
  signup.destroy();
  gone('signup');
  // A survey with a matrix: the survey kinds' part, the page drawn once it came — nothing of it before.
  const survey = inPage.mountViewer(host, { page: read('survey.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(survey, 'a survey');
  await survey.drawn;
  hasIn('a survey with a matrix', 'business, cards, choice, columns, date, files, filters, head, import, lines, list, path, phone, print, quiet, relations, survey, text, themes');
  if (!host.querySelector('.fd-matrix-table')) throw new Error('in a page, a matrix is not drawn from its part');
  survey.destroy();
  gone('survey');
  // A test drive booked from the times free: the slots part, with the date part beside it, the page drawn once both
  // came — nothing of it before — and the month asked of the data source's slots.
  const asked = [];
  const slots = (request) => (asked.push(request), Promise.resolve({ days: { [request.from]: { state: 'open', free: [] } } }));
  const drive = inPage.mountViewer(host, { page: read('test-drive.page.json'), dataSource: inPage.createMemoryDataSource({ slots }) });
  waits(drive, 'a test drive');
  await drive.drawn;
  await tick(0);
  hasIn("a test drive's slots", 'business, cards, choice, columns, date, files, filters, head, import, lines, list, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!host.querySelector('.fd-slots .fd-slots-days') || !asked.length) throw new Error('in a page, booking slots are not drawn from their part');
  drive.destroy();
  gone('drive');
  // A customer's card that asks for possible duplicates (its page's duplicates, and a source that answers): drawn at once
  // — the part is never waited for — the part asked for as the card opens, and a record like the one shown said under
  // the field it matched on, its sheet in its place. The phone part, in already, reads its phone.
  const like = (request) => Promise.resolve({ matches: request.values.email ? [{ id: 1, name: 'Nile Traders', why: ['email'] }] : [] });
  const card = inPage.mountViewer(host, { page: read('customer-card.page.json'), dataSource: inPage.createMemoryDataSource({ duplicates: like }), values: { email: 'orders@niletraders.example' } });
  if (!host.querySelector('.fd-field[data-path="email"]')) throw new Error('in a page, possible duplicates kept the card from being drawn');
  if (!(await until(() => host.querySelector('.fd-field[data-path="email"] .fd-duplicates')))) throw new Error('in a page, a possible duplicate is not said under its field');
  hasIn("a customer's card and its possible duplicates", 'business, cards, choice, columns, date, duplicates, files, filters, head, import, lines, list, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!doc.getElementById('fieldia-duplicates-styles')) throw new Error("in a page, possible duplicates' sheet was never put in");
  card.destroy();
  gone('card');
  // jsdom draws nothing on a canvas: a signature's pad has no pen here.
  dom.window.HTMLCanvasElement.prototype.getContext = () => null;
  // A survey's plain signature — a picture, as before — and a page's uploads: the files part, in already; the
  // evidence's part never asked for.
  const kinds = inPage.mountViewer(host, { page: read('kinds.page.json'), dataSource: inPage.createMemoryDataSource() });
  await kinds.drawn;
  await tick(0);
  hasIn("a survey's plain signature", 'business, cards, choice, columns, date, duplicates, files, filters, head, import, lines, list, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!host.querySelector('.fd-signature .fd-signature-pad') || host.querySelector('.fd-signature-evidence')) throw new Error("in a page, a plain signature is not the files part's alone");
  kinds.destroy();
  gone('kinds');
  // A consent whose signature signs its answers: the evidence part asked for, the page drawn once it came — nothing of
  // it before — and under the signature kept, who signed and when, and that the answers are as signed.
  const consentPage = read('clinic-consent.page.json');
  const answers = { patient: 'Mona Adel', birth_date: '1991-04-12', treatment: 'botox', areas: ['forehead', 'crows_feet'], pregnant: false, allergies: 'None', risks_read: true, photos: true };
  const evidence = { format: 'fieldia-signature/1', by: 'Mona Adel', at: '2026-10-14T07:42:00.000Z', fields: Object.keys(answers), sha256: '3667c9d2ee8f42a370ffc70a2a72bb17c7d0e47f913fe6af6c8c35e101d7697e' };
  const signedRecord = { ...answers, signature: { name: 'signature.png', type: 'image/png', size: 4, data: 'QUJDRA==', signed: evidence } };
  const consent = inPage.mountViewer(host, { page: consentPage, recordId: 1, dataSource: inPage.createMemoryDataSource({ records: { 'clinic.consent': { 1: signedRecord } } }) });
  waits(consent, 'a consent whose signature signs its answers');
  await consent.drawn;
  hasIn('a consent signed, its evidence', 'business, cards, choice, columns, date, duplicates, evidence, files, filters, head, import, lines, list, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!(await until(() => host.querySelector('.fd-signature-state:not([hidden])')?.textContent === '✓The answers are as they were signed.')) || !host.querySelector('.fd-signature-who')?.textContent.startsWith('Signed by Mona Adel, 14 Oct 2026')) throw new Error(`in a page, a consent's evidence is not said under its signature: ${host.querySelector('.fd-signature-evidence')?.textContent ?? 'none'}`);
  if (!host.querySelector('[data-node="f-treatment"] select')?.disabled) throw new Error("in a page, a consent's signed answer is not locked");
  // Its parts come by script tags of their own, asked for anew once one failed: what offers to try again may.
  if (inPage.evidencePart.asksAgain !== true || inPage.filesPart.asksAgain !== true) throw new Error("in a page, the one-tag script's parts do not say they may be asked for again");
  consent.destroy();
  gone('consent');
  // An event's sign-up that closed (its page's limits): the limits part, the page drawn once it came — its questions
  // never shown first — the closed form's words in their place, its sheet in its place; the survey kinds' part, in
  // already, draws nothing of it. Its endings name the place kept: the answers part comes with it.
  const closed = inPage.mountViewer(host, { page: { ...read('event-signup.page.json'), limits: { closes: '2020-01-31' } }, dataSource: inPage.createMemoryDataSource() });
  waits(closed, 'a sign-up that closed');
  await closed.drawn;
  hasIn("an event's sign-up, closed", 'answers, business, cards, choice, columns, date, duplicates, evidence, files, filters, head, import, limits, lines, list, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!host.querySelector('.fd-closed:not([hidden]) .fd-closed-title')?.textContent?.startsWith('This form closed on')) throw new Error("in a page, a closed form's words are not said in place of its questions");
  if ([...host.querySelectorAll('.fd-field')].some((field) => !field.closest('[hidden]')) || !host.querySelector('.fd-page-title')?.closest('.fd-content:not([hidden])')) throw new Error("in a page, a closed form's questions are shown, or its title is not");
  if (!doc.getElementById('fieldia-limits-styles')) throw new Error("in a page, the limits part's sheet was never put in");
  closed.destroy();
  gone('closed');
  // A visit's feedback whose formula counts an age, and whose follow-up offers the treatments ticked before: the form's
  // functions and options parts (@fieldia/core's), the page drawn once they came — nothing of it before — the age worked
  // out at once, never waiting in sight.
  const visit = inPage.mountViewer(host, { page: read('visit-feedback.page.json'), dataSource: inPage.createMemoryDataSource(), values: { birth_date: '1990-10-20' }, now: () => new dom.window.Date('2026-10-20T12:00:00Z') });
  waits(visit, 'a page whose formula counts an age');
  await visit.drawn;
  hasIn("a visit's feedback counting an age", 'answers, business, cards, choice, columns, date, duplicates, evidence, files, filters, functions, head, import, limits, lines, list, options, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (visit.form.getState().values.age_now !== 36 || Object.keys(visit.form.getState().asked).length) throw new Error(`in a page, an age is not worked out once the functions part came: ${visit.form.getState().values.age_now}`);
  visit.destroy();
  gone('visit');
  // A purchase order waiting for approval (its page's `approval`): the approvals part — the form's and the viewer's in
  // one script — the page drawn once it came, nothing of it before; where it stands said over the record, under its
  // alerts, every field locked while it waits but the one the page leaves open, its sheet in its place.
  const approving = inPage.mountViewer(host, {
    page: read('purchase-approval.page.json'),
    recordId: 1,
    user: { id: 21, name: 'Mona Adel' },
    dataSource: inPage.createMemoryDataSource({
      records: { 'purchase.order': { 1: { name: 'PO-2026-0042', requested_by: 'Omar Said', state: 'to_approve', line_ids: [], notes: '' } } },
      approvals: { 'purchase.order': () => ({ levels: [{ id: 'finance', name: 'Finance', approvers: [{ id: 21, name: 'Mona Adel' }] }], asked: true }) },
    }),
  });
  waits(approving, 'a purchase order waiting for approval');
  await approving.drawn;
  hasIn('a purchase order waiting for approval', 'answers, approvals, business, cards, choice, columns, date, duplicates, evidence, files, filters, functions, head, import, limits, lines, list, options, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!(await until(() => host.querySelector('.fd-approval:not([hidden]) .fd-approval-title')?.textContent === 'Waiting for Finance: Mona Adel'))) throw new Error(`in a page, a purchase order waiting for approval does not say so: ${host.querySelector('.fd-approval')?.textContent ?? 'none'}`);
  if (!host.querySelector('[data-node="f-requested"] input')?.readOnly || host.querySelector('[data-node="f-notes"] textarea')?.readOnly) throw new Error('in a page, a purchase order waiting for approval does not lock its fields but the one it leaves open');
  if (!doc.getElementById('fieldia-approvals-styles')) throw new Error("in a page, the approvals part's sheet was never put in");
  approving.destroy();
  gone('approving');
  // A clinic's price list whose cells change in place: the editable part beside the list part, the page drawn once both
  // came — nothing of it before — its cells marked to change, Add a line under it, its sheet after the list's own.
  const prices = inPage.mountViewer(host, { page: read('service-prices.page.json'), dataSource: inPage.createMemoryDataSource({ records: { 'clinic.service': { 1: { name: 'Hydrafacial', category: 'skin', minutes: 60, price: 2800, active: true } } } }) });
  waits(prices, 'a list whose cells change in place');
  await prices.drawn;
  hasIn("a price list changed in place", 'answers, approvals, business, cards, choice, columns, date, duplicates, editable, evidence, files, filters, functions, head, import, limits, lines, list, options, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!(await until(() => host.querySelector('.fd-list-row td[data-edit][data-col="price"]'))) || !host.querySelector('.fd-list-add')) throw new Error("in a page, a list's cells changed in place are not drawn from their part");
  if (doc.getElementById('fd-list-styles')?.nextElementSibling?.id !== 'fd-list-editable-styles' && doc.getElementById('fd-list-columns-styles')?.nextElementSibling?.id !== 'fd-list-editable-styles' && doc.getElementById('fd-list-cards-styles')?.nextElementSibling?.id !== 'fd-list-editable-styles') throw new Error(`in a page, the editable part's sheet is not after the list's own: ${[...doc.head.querySelectorAll('style[id]')].map((style) => style.id).join(', ')}`);
  prices.destroy();
  gone('prices');
  // A listing typed in Arabic and English: the languages part — the switch over each of its texts, the form's checks of
  // it in each language — the page drawn once it came, nothing of it before; the reader's language first, each language's
  // box written its own way, Arabic right to left.
  const bilingual = inPage.mountViewer(host, { page: read('listing-languages.page.json'), dataSource: inPage.createMemoryDataSource() });
  waits(bilingual, 'a listing in Arabic and English');
  await bilingual.drawn;
  hasIn('a listing in Arabic and English', 'answers, approvals, business, cards, choice, columns, date, duplicates, editable, evidence, files, filters, functions, head, import, languages, limits, lines, list, options, path, phone, print, quiet, relations, slots, survey, text, themes');
  const switched = [...host.querySelectorAll('[data-node="f-title"] [role="tab"]')].map((tab) => tab.getAttribute('lang')).join();
  if (switched !== 'en,ar' || host.querySelector('[data-node="f-title"] [role="tabpanel"][lang="ar"]')?.getAttribute('dir') !== 'rtl') throw new Error(`in a page, a text in Arabic and English is not a switch between them, the reader's first: ${switched}`);
  bilingual.destroy();
  gone('bilingual');
  // A customer filled from an e-mail (its page's `suggest`, its notes' `rewrite`): the assist part, the page drawn once
  // it came — nothing of it before — its Fill from an e-mail and its notes' Polish drawn with it; a value the app
  // proposes laid under its field, nothing written; the part's sheet in its place.
  const assist = { suggest: () => ({ values: { city: 'Amman' } }), rewrite: () => ({ text: 'Done.' }) };
  const filled = inPage.mountViewer(host, { page: read('customer-from-email.page.json'), dataSource: inPage.createMemoryDataSource({ assist }), values: { comment: 'met them' } });
  waits(filled, 'a customer filled from an e-mail');
  await filled.drawn;
  hasIn('a customer filled from an e-mail', 'answers, approvals, assist, business, cards, choice, columns, date, duplicates, editable, evidence, files, filters, functions, head, import, languages, limits, lines, list, options, path, phone, print, quiet, relations, slots, survey, text, themes');
  if (!host.querySelector('.fd-assist-fill:not([hidden])') || !host.querySelector('.fd-field[data-path="comment"] .fd-assist-tool:not([hidden])')) throw new Error("in a page, AI help's Fill from an e-mail or a text field's Polish is not drawn with the page");
  if ((await filled.propose({ city: 'Amman' })) !== 1 || !host.querySelector('.fd-field[data-path="city"] .fd-proposal') || filled.form.getState().values.city) throw new Error('in a page, a value proposed is not laid under its field, or is written before it is accepted');
  if (!doc.getElementById('fieldia-assist-styles')) throw new Error("in a page, AI help's sheet was never put in");
  filled.destroy();
  gone('filled');
  // A listing whose photos are a set: the photos part asked for — the files part, whose taking and dialog it draws with,
  // in already — the page drawn once it came, nothing of it before; its photos as tiles in their order, the first
  // marked the cover; a plain picture field before it never asked for it.
  const shot = (name) => ({ name, type: 'image/png', size: 4, data: 'QUJDRA==' });
  const listing = inPage.mountViewer(host, { page: read('listing-photo-set.page.json'), recordId: 1, dataSource: inPage.createMemoryDataSource({ records: { 'agent.listing': { 1: { name: 'Garden flat', photos: [shot('Kitchen.png'), shot('Hall.png')] } } } }) });
  waits(listing, 'a listing whose photos are a set');
  await listing.drawn;
  hasIn("a listing's photo set", 'answers, approvals, assist, business, cards, choice, columns, date, duplicates, editable, evidence, files, filters, functions, head, import, languages, limits, lines, list, options, path, phone, photos, print, quiet, relations, slots, survey, text, themes');
  // Each tile kept by its photo's file, named by its place (never its file's name).
  const covers = [...host.querySelectorAll('.fd-photo')].map((tile) => `${tile.getAttribute('data-key')?.split('\u0000')[0]}: ${tile.querySelector('.fd-photo-open')?.getAttribute('aria-label')}${tile.querySelector('.fd-photo-cover')?.hidden ? '' : ' (cover)'}`);
  if (covers.join('; ') !== 'Kitchen.png: The cover, photo 1 of 2 (cover); Hall.png: Photo 2 of 2') throw new Error(`in a page, a listing's photo set is not drawn in its order, its cover first: ${covers.join('; ')}`);
  listing.destroy();
  gone('listing');
  // A clinic's treatment whose patient is scanned by the card's code and whose lines' lots by their boxes' (`options.scan`):
  // the scan part, the page drawn once it came — nothing of it before — the Scan button beside the patient's box, its
  // sheet in its place. A camera's picture read by the app's own reader (`useCodeReader`): the patient found by the
  // card's code, the camera's sheet gone once it was — and the decode part, a reader for browsers with none, never asked.
  Object.defineProperty(dom.window.navigator, 'mediaDevices', { value: { getUserMedia: async () => ({ getTracks: () => [{ stop: () => undefined }] }) }, configurable: true });
  Object.defineProperty(dom.window.HTMLMediaElement.prototype, 'readyState', { get: () => 4, configurable: true });
  dom.window.HTMLMediaElement.prototype.play = async () => undefined;
  const clinic = { 'clinic.treatment': { 1: { treated_on: '2026-10-20', line_ids: [] } }, 'clinic.patient': { 1: { name: 'Mona Adel', card: 'P-1042' }, 2: { name: 'Hana Fouad', card: 'P-1043' } } };
  const treatment = inPage.mountViewer(host, { page: read('clinic-treatment.page.json'), recordId: 1, dataSource: inPage.createMemoryDataSource({ records: clinic }) });
  waits(treatment, "a treatment's fields scanned into");
  await treatment.drawn;
  hasIn("a clinic's treatment scanned into", 'answers, approvals, assist, business, cards, choice, columns, date, duplicates, editable, evidence, files, filters, functions, head, import, languages, limits, lines, list, options, path, phone, photos, print, quiet, relations, scan, slots, survey, text, themes');
  const scanButton = host.querySelector('[data-node="f-patient"] .fd-scan > .fd-scan-button');
  if (scanButton?.textContent !== 'Scan' || scanButton.getAttribute('aria-label') !== 'Scan a code into Patient') throw new Error(`in a page, a field scanned into has no Scan button beside its box: ${scanButton?.outerHTML ?? 'none'}`);
  (await inPage.scanPart.load()).useCodeReader({ detect: async () => [{ rawValue: 'P-1043', format: 'qr_code' }] });
  scanButton.click();
  if (!(await until(() => treatment.form.getState().values.patient_id?.label === 'Hana Fouad' && !doc.querySelector('.fd-scan-sheet')))) throw new Error(`in a page, a patient's card scanned does not name her: ${JSON.stringify(treatment.form.getState().values.patient_id)}, ${doc.querySelector('.fd-scan-said')?.textContent ?? 'no sheet'}`);
  if (inPage.decodePart.loaded) throw new Error('in a page, the decode part was asked for where the app reads codes itself');
  (await inPage.scanPart.load()).useCodeReader(null);
  treatment.destroy();
  gone('treatment');
  // Every part's sheet between Fieldia's two halves, in the order of its rank: where its rules stood in Fieldia's own
  // (PART_RANK) — a table of lines', the business widgets', the survey kinds', the files', a signature's evidence right
  // after them (0.27), then a phone's and booking slots' (new at 0.24), a list's Import's and possible duplicates' (0.25)
  // and a page's limits' (0.27), a record's approvals', AI help's, a photo set's and a text's languages' (0.29), before
  // the themes so a theme still reshapes them, the themes' and the quiet look's before the pickers', the head's and the
  // text's, the survey kinds' own looks, a repeating group's cards', and a code scanned's (0.29) last; a list's own
  // sheet, its cards' and its columns' after them all, unranked.
  const styles = [...doc.head.querySelectorAll('style[id]')];
  const ids = styles.map((style) => style.id);
  const ranked = styles.filter((style) => style.hasAttribute('data-fd-rank'));
  const ranks = ranked.map((style) => Number(style.getAttribute('data-fd-rank')));
  const inside = ranked.every((style) => ids.indexOf(style.id) > ids.indexOf('fieldia-styles') && ids.indexOf(style.id) < ids.indexOf('fieldia-styles-looks'));
  if (!inside || ranks.some((rank, i) => i > 0 && rank < ranks[i - 1])) throw new Error(`in a page, the parts' sheets are out of their places: ${ids.join(', ')}`);
  // The print part's first of them all (rank 0), right after Fieldia's own: its rules stood at that sheet's end.
  if (ids[ids.indexOf('fieldia-styles') + 1] !== 'fieldia-print-styles') throw new Error(`in a page, the print part's sheet is not right after Fieldia's own: ${ids.join(', ')}`);
  for (const id of ['fieldia-lines-styles', 'fieldia-business-styles', 'fieldia-survey-styles', 'fieldia-files-styles', 'fieldia-evidence-styles', 'fieldia-phone-styles', 'fieldia-slots-styles', 'fieldia-import-styles', 'fieldia-duplicates-styles', 'fieldia-limits-styles', 'fieldia-approvals-styles', 'fieldia-assist-styles', 'fieldia-photos-styles', 'fieldia-languages-styles', 'fieldia-theme-styles', 'fieldia-quiet-styles', 'fieldia-survey-looks', 'fieldia-scan-styles']) if (!ids.includes(id)) throw new Error(`in a page, ${id} was never put in`);
  // Each part's own words in Fieldia's English once it came, the main script having carried none of them.
  for (const part of PARTS) {
    const wrong = wordsNotIn(inPage, 'en', part, ENGLISH);
    if (wrong.length) throw new Error(`in a page, Fieldia's English lacks fieldia.${part}.js's own words once it came: ${wrong.join(', ')}`);
  }
  if (problems.length) throw new Error(`in a page: ${problems.join('; ')}`);
  dom.window.close();
  console.log("in a page: a memory source's members as it is first asked, never for an app's own source; nothing asked for by a page of plain parts, its printout's head in it; a phone read the world over, and a link to another record; a list's screen, its phones, its totals, its Export, Edit and Print only where asked, the print part fetched for invoices meant for paper and run for none, its Import's part when Import is pressed, its cards and the columns a person shapes where asked, a gallery; a customer's invoices listed inside it, a card in each row for a phone; a theme the app gives, worn as it came; an order's table of lines; a customer's statusbar and photo; a bug's head, text, path picker, own lists, attachments and quiet look; a backlog's filter bar; a sign-up's date box and bot check; a survey's matrix; a test drive's slots; a customer's possible duplicates; a consent's signature evidence, never a plain signature's; an event's sign-up closed; a visit's age and its follow-up's treatments, by the form's functions and options parts; a purchase order waiting for approval; a price list's cells changed in place; a listing in Arabic and English; a customer filled from an e-mail, AI help drawn with it and a proposal laid; a listing's photo set, with the files part; a treatment's patient scanned by her card, never with the decode part where the app reads codes — each as first used, each sheet in its place; each part's own words in once it came");
}

/**
 * On paper, in a page that never printed: the print part asked for only as a person prints. The browser's own print
 * (its menu) before it came prints the main sheet's plain look — nothing laid out for paper — and asks for the part,
 * so the next print is whole; Ctrl+P before it came is held back while it comes, then the browser asked to print, the
 * form laid out for paper meanwhile and put back once printed; once it is in, so at once, in the press. Its sheet
 * right after Fieldia's own (PART_RANK.print, 0).
 */
for (const first of ['menu', 'keys']) {
  const { JSDOM, VirtualConsole } = await import('jsdom');
  const problems = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => problems.push(error.message));
  virtualConsole.on('error', (message) => problems.push(String(message)));
  const dom = new JSDOM('<!doctype html><html><head><script src="fieldia.js"></script></head><body><div id="app"></div></body></html>', {
    url: pathToFileURL(join(BUNDLE, 'page.html')).href,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
  });
  await new Promise((done) => dom.window.addEventListener('load', done));
  const { Fieldia: inPage, document: doc } = dom.window;
  const tick = (ms = 10) => new Promise((done) => dom.window.setTimeout(done, ms));
  const until = async (ready) => {
    for (let turn = 0; turn < 300 && !ready(); turn++) await tick();
    return ready();
  };
  const asked = () => [...doc.querySelectorAll('script[src]')].map((tag) => tag.getAttribute('src')).filter((src) => /fieldia\.print\.js$/.test(src));
  const view = inPage.mountViewer(doc.getElementById('app'), { page: JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages/delivery.page.json'), 'utf8')), dataSource: inPage.createMemoryDataSource() });
  await view.drawn;
  const form = doc.querySelector('form.fd-form');
  await tick(50);
  if (inPage.printPart.loaded || asked().length || doc.getElementById('fieldia-print-styles')) throw new Error('on paper, a page no one printed asked for the print part');
  if (!/@media print\{[^}]*--fd-text: ?#1d2024 ?!important/.test(doc.getElementById('fieldia-styles').textContent)) throw new Error("on paper, Fieldia's own sheet has no plain look for a print before the print part came");
  const prints = [];
  // As a browser's dialog: told before and after, inside print().
  dom.window.print = () => {
    dom.window.dispatchEvent(new dom.window.Event('beforeprint'));
    prints.push({ laidOut: form.hasAttribute('data-fd-print'), sheet: !!doc.getElementById('fieldia-print-styles') });
    dom.window.dispatchEvent(new dom.window.Event('afterprint'));
  };
  const ctrlP = () => {
    const press = new dom.window.KeyboardEvent('keydown', { key: 'p', code: 'KeyP', ctrlKey: true, bubbles: true, cancelable: true });
    doc.body.dispatchEvent(press);
    return press.defaultPrevented;
  };
  if (first === 'menu') {
    // The browser's menu: told it prints, the page as it is — and the part asked for.
    dom.window.dispatchEvent(new dom.window.Event('beforeprint'));
    if (form.hasAttribute('data-fd-print')) throw new Error("on paper, the browser's print before the print part came laid the page out as the part does");
    if (!(await until(() => inPage.printPart.loaded))) throw new Error("on paper, the browser's print before the print part came did not ask for it");
    dom.window.dispatchEvent(new dom.window.Event('afterprint'));
    if (form.hasAttribute('data-fd-print')) throw new Error('on paper, the print part laid out a form as it came, unasked');
    // The next print whole.
    dom.window.print();
    if (prints.length !== 1 || !prints[0].laidOut || !prints[0].sheet || form.hasAttribute('data-fd-print')) throw new Error(`on paper, the browser's print once the part came is not whole, or not put back: ${JSON.stringify(prints)}`);
  } else {
    // Ctrl+P: held back, the part asked for; once it came, the browser asked to print the page laid out whole.
    if (!ctrlP()) throw new Error('on paper, Ctrl+P before the print part came was not held back');
    if (!(await until(() => prints.length))) throw new Error('on paper, Ctrl+P before the print part came never printed');
    if (prints.length !== 1 || !prints[0].laidOut || !prints[0].sheet || form.hasAttribute('data-fd-print')) throw new Error(`on paper, Ctrl+P did not print the whole look, or did not put the page back: ${JSON.stringify(prints)}`);
    // Once it is in, at once, in the press.
    if (!ctrlP() || prints.length !== 2 || !prints[1].laidOut || form.hasAttribute('data-fd-print')) throw new Error(`on paper, Ctrl+P once the print part was in did not print the whole look at once: ${JSON.stringify(prints)}`);
  }
  const ids = [...doc.head.querySelectorAll('style[id]')].map((style) => style.id);
  if (ids[ids.indexOf('fieldia-styles') + 1] !== 'fieldia-print-styles' || doc.getElementById('fieldia-print-styles').getAttribute('data-fd-rank') !== '0') throw new Error(`on paper, the print part's sheet is not right after Fieldia's own: ${ids.join(', ')}`);
  view.destroy();
  if (problems.length) throw new Error(`on paper: ${problems.join('; ')}`);
  dom.window.close();
}
console.log("on paper: a page no one printed asks for no print part; the browser's menu prints its plain look and asks for it, the next print whole; Ctrl+P waits for it and prints the whole look, at once once it came; its sheet right after Fieldia's own");

/**
 * In an Arabic page, its add-on after the main script and the parts after both: a list of customers drawn in Arabic,
 * its part's own words Arabic in the tables and none of their English in what is drawn — its words, its names and its
 * tips.
 */
{
  const { JSDOM, VirtualConsole } = await import('jsdom');
  const problems = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => problems.push(error.message));
  virtualConsole.on('error', (message) => problems.push(String(message)));
  const dom = new JSDOM('<!doctype html><html lang="ar"><head><script src="fieldia.js"></script><script src="fieldia.ar.js"></script></head><body><div id="app"></div></body></html>', {
    url: pathToFileURL(join(BUNDLE, 'page.html')).href,
    runScripts: 'dangerously',
    resources: 'usable',
    pretendToBeVisual: true,
    virtualConsole,
  });
  await new Promise((done) => dom.window.addEventListener('load', done));
  const { Fieldia: inPage, document: doc } = dom.window;
  const host = doc.getElementById('app');
  const page = JSON.parse(readFileSync(join(WORKSPACE, 'examples/pages/customers.page.json'), 'utf8'));
  const view = inPage.mountViewer(host, { page, locale: 'ar', dataSource: inPage.createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', phone: '+201012345678' } } } }) });
  await view.drawn;
  for (let turn = 0; turn < 100 && !host.querySelector('.fd-list-row'); turn++) await new Promise((done) => dom.window.setTimeout(done, 10));
  if (!host.querySelector('.fd-list-row')) throw new Error('in an Arabic page, a list is not drawn');
  const wrong = wordsNotIn(inPage, 'ar', 'list', ARABIC);
  if (wrong.length) throw new Error(`in an Arabic page, the list part's own words are not Arabic once it came: ${wrong.join(', ')}`);
  const drawn = [host.textContent, ...[...host.querySelectorAll('[aria-label], [title], [placeholder]')].flatMap((one) => ['aria-label', 'title', 'placeholder'].map((name) => one.getAttribute(name) ?? ''))].join('\n');
  const english = Object.entries(partEnglish('list')).flatMap(([table, words]) => Object.entries(words).filter(([key, text]) => text !== ARABIC[table][key]).flatMap(([, text]) => text.split(/\{\w+\}/).map((piece) => piece.trim()).filter((piece) => /[A-Za-z]{3}/.test(piece))));
  // A piece as words of its own, and none the page itself says (its own words are its, in English here).
  const said = (text, piece) => new RegExp(`(^|[^A-Za-z])${piece.replace(/[.*+?^$()|[\]\\]/g, '\\$&')}($|[^A-Za-z])`).test(text);
  const shown = [...new Set(english.filter((piece) => said(drawn, piece) && !said(JSON.stringify(page), piece)))];
  if (shown.length) throw new Error(`in an Arabic page, a list shows its part's English: ${shown.join(' | ')}`);
  if (problems.length) throw new Error(`in an Arabic page: ${problems.join('; ')}`);
  view.destroy();
  dom.window.close();
  console.log("in an Arabic page: a list's part's own words in Arabic, none of their English drawn");
}
