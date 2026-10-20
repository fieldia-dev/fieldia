/**
 * The part words (tools/part-words.mjs): the check that refuses a word the main script reads, a word a part reads but
 * does not bring, a word named that no module of its part reads; how a table's English is cut; and PART_WORDS itself
 * against the script bundle's modules — which module is the main script's and which a part's worked out from the
 * imports esbuild finds, as the script bundle is built — every word it names read by its parts alone, and every word
 * only parts read named in it.
 *
 *   node --test tools/part-words.test.mjs
 */
import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishKeys, namesIn, PART_WORDS, partWordsProblems, readerSource, withoutWords, WORD_TABLES } from './part-words.mjs';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);

test('the names a module says: identifiers and strings, in its code and its types, never in its comments', () => {
  const names = namesIn(`
    // nextPage, in a comment
    /** previousPage, in another */
    const said = labels.importTitle + words['importHint'] + \`\${n} \${labels.bulkAsk}\`;
    type Right = 'archive' | 'duplicate';
    const { exportCsv } = labels;
    const re = /exportExcel/;
  `);
  for (const name of ['importTitle', 'importHint', 'bulkAsk', 'archive', 'duplicate', 'exportCsv', 'labels', 'words']) assert.ok(names.has(name), name);
  for (const name of ['nextPage', 'previousPage']) assert.ok(!names.has(name), name);
});

test("a table's English cut: the words named out, every other line as it was; a word it lacks, or a line it cannot read, refused", () => {
  const table = ["import x from 'y';", 'const en: Words = {', "  save: 'Save',", "  next: 'Next',", "  back: 'Back',", '};', 'export const T = { en };'].join('\n');
  assert.deepEqual(englishKeys(table), ['save', 'next', 'back']);
  assert.equal(withoutWords(table, ['next']), table.replace("  next: 'Next',\n", ''));
  assert.equal(withoutWords(table, []), table);
  assert.throws(() => withoutWords(table, ['done']), /no English word "done"/);
  assert.throws(() => englishKeys(table.replace("  next: 'Next',", "  next:\n    'Next',")), /not one word on one line/);
  assert.throws(() => englishKeys('const words = {};'), /no English table/);
});

/** Two modules of the main script, two parts', reading what each test gives them. */
const check = (code, declared, tables = { viewer: ['save', 'nextPage', 'importTitle', 'phoneCall'] }) =>
  partWordsProblems({
    main: ['libs/viewer/src/lib/viewer.ts', 'libs/viewer/src/lib/labels.ts'],
    parts: { list: ['libs/viewer/src/lib/list.ts'], import: ['libs/viewer/src/lib/import-dialog.ts'], phone: ['libs/widgets/src/lib/phone.ts'] },
    read: (file) => code[file] ?? '',
    tables,
    declared,
  });

test('the check: a word only its parts read and every one of them brings, passed; the words parts alone read and no part brings, listed', () => {
  const code = {
    'libs/viewer/src/lib/viewer.ts': 'labels.save;',
    'libs/viewer/src/lib/list.ts': 'labels.nextPage; labels.importTitle;',
    'libs/viewer/src/lib/import-dialog.ts': 'labels.importTitle;',
    'libs/widgets/src/lib/phone.ts': 'labels.phoneCall;',
  };
  const { problems, unnamed } = check(code, { list: { viewer: ['nextPage', 'importTitle'] }, import: { viewer: ['importTitle'] } });
  assert.deepEqual(problems, []);
  assert.deepEqual(unnamed, [{ table: 'viewer', key: 'phoneCall', parts: ['phone'] }]);
});

test('the check refuses a word the main script reads, a part reading one it does not bring, and one no module of its part reads', () => {
  const code = {
    'libs/viewer/src/lib/viewer.ts': 'labels.save; labels.nextPage;',
    'libs/viewer/src/lib/list.ts': 'labels.nextPage; labels.importTitle;',
    'libs/viewer/src/lib/import-dialog.ts': 'labels.importTitle;',
  };
  const { problems } = check(code, { list: { viewer: ['nextPage', 'importTitle'] }, phone: { viewer: ['phoneCall'] } });
  assert.deepEqual(problems, [
    'viewer.nextPage is named under list in PART_WORDS, but the main script reads it (libs/viewer/src/lib/viewer.ts): a word the main script reads stays in it',
    'viewer.importTitle is read by the import part (libs/viewer/src/lib/import-dialog.ts), which does not bring it: name it under import in PART_WORDS too',
    'viewer.phoneCall is named under phone in PART_WORDS, but no module of the phone part reads it',
  ]);
});

test('the check refuses a word no table has, a word named twice, a part or a table the bundle does not have', () => {
  const { problems } = check({ 'libs/viewer/src/lib/list.ts': 'labels.nextPage;' }, { list: { viewer: ['nextPage', 'nextPage', 'gone'], other: ['x'] }, maps: {} });
  assert.deepEqual(problems.sort(), [
    'PART_WORDS names a part "maps" that the script bundle does not have',
    'PART_WORDS.list names a table "other": the tables are viewer',
    'PART_WORDS.list.viewer names "gone", which is no word of viewer',
    'PART_WORDS.list.viewer names "nextPage" twice',
  ]);
});

/**
 * The script bundle's modules: the main script's — those its entry's code is made of, as the bundle's build keeps them
 * (a module only a part's code uses is left out of it whole: the packages' memory source) — and each part's, from its
 * modules by their static imports, less the main script's. A part may have a module in each package (the limits part:
 * the form's in @fieldia/core, what draws it in the viewer), as the bundle's build joins them in one script.
 */
async function scriptModules() {
  const { metafile } = await build({
    entryPoints: [join(WORKSPACE, 'tools/script-entry.ts')],
    bundle: true,
    format: 'esm',
    splitting: true,
    write: false,
    outdir: join(WORKSPACE, 'dist/part-words-test'),
    metafile: true,
    tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
    absWorkingDir: WORKSPACE,
    define: { __FIELDIA_VERSION__: '"0.0.0"' },
    logLevel: 'error',
    plugins: [
      {
        name: 'as-the-script-bundle',
        setup(builder) {
          // English alone, and the parts' table of shared names (which only the script bundle's build makes) empty.
          builder.onLoad({ filter: /libs\/(core|widgets|viewer)\/src\/lib\/(record\/)?locales\/all\.ts$/ }, () => ({ contents: 'export const LANGUAGES = {};', loader: 'ts' }));
          builder.onResolve({ filter: /^fieldia:shared$/ }, () => ({ path: 'shared', namespace: 'fieldia-shared' }));
          builder.onLoad({ filter: /.*/, namespace: 'fieldia-shared' }, () => ({ contents: 'export const SHARED = [];', loader: 'js' }));
        },
      },
    ],
  });
  // An output and every chunk it imports, but those already counted: what a script is made of, as the build keeps it.
  const outputs = metafile.outputs;
  const madeOf = (first, counted = new Set()) => {
    const made = new Set();
    for (const chunks = [first]; chunks.length; ) {
      const out = chunks.pop();
      if (!out || made.has(out) || counted.has(out)) continue;
      made.add(out);
      for (const one of outputs[out].imports) if (one.kind === 'import-statement') chunks.push(one.path);
    }
    return made;
  };
  const mainChunks = madeOf(Object.keys(outputs).find((out) => outputs[out].entryPoint === 'tools/script-entry.ts'));
  const main = new Set([...mainChunks].flatMap((out) => Object.keys(outputs[out].inputs)));
  const parts = {};
  for (const [out, { entryPoint }] of Object.entries(outputs)) {
    const part = entryPoint && /^libs\/(?:core|widgets|viewer)\/src\/lib\/(?:[a-z]+\/)?([a-z]+)-part\.ts$/.exec(entryPoint)?.[1];
    if (!part) continue;
    const files = [...madeOf(out, mainChunks)].flatMap((chunk) => Object.keys(outputs[chunk].inputs)).filter((one) => !main.has(one));
    parts[part] = [...new Set([...(parts[part] ?? []), ...files])];
  }
  return { main: [...main], parts };
}

test('PART_WORDS against the script bundle: every word it names read by its parts alone, every word only parts read named', async () => {
  const { main, parts } = await scriptModules();
  assert.ok(main.includes('libs/viewer/src/lib/viewer.ts') && parts.list?.includes('libs/viewer/src/lib/list.ts') && Object.keys(parts).length >= 20, 'the modules are found');
  const tables = Object.fromEntries(Object.entries(WORD_TABLES).map(([table, file]) => [table, englishKeys(readFileSync(join(WORKSPACE, file), 'utf8'), file)]));
  const { problems, unnamed } = partWordsProblems({ main, parts, read: (file) => readerSource(WORKSPACE, file), tables });
  assert.deepEqual(problems, []);
  assert.deepEqual(unnamed, [], 'words only parts read, which the main script carries still: name each under every part that reads it in PART_WORDS');
  assert.ok(Object.values(PART_WORDS).every((words) => Object.values(words).every((keys) => keys.length)));
});
