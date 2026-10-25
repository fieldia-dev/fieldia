/**
 * The demos' size check (tools/demo-sizes.mjs): what a page fetches before it draws is read from its HTML and its
 * modules' static imports, gzipped; a page over its budget, a bundle left unminified or without its source map, is said.
 *   node --test tools/demo-sizes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkDemos, htmlScripts, minified, pageScripts, staticImports } from './demo-sizes.mjs';

test('a page names its scripts in its script tags and its module preloads, nothing else', () => {
  const html = `<link rel="stylesheet" href="../demo.css" /><link rel="modulepreload" href="chunks/a.js" nonce="n" />
    <script type="module" src="../shell.mjs"></script><script>inline()</script><script src="main.js" defer></script>
    <link rel="icon" href="logo.svg" />`;
  assert.deepEqual(htmlScripts(html), ['chunks/a.js', '../shell.mjs', 'main.js']);
});

test('a module’s static imports, minified or not; never what it imports only when it needs it', () => {
  assert.deepEqual(staticImports('import{a as b}from"./chunks/chunk-A.js";import"./chunk-B.js";export{c}from"./chunk-C.js";export*from"./d.js";const p=import("./chunks/list-part-X.js");'), ['./chunks/chunk-A.js', './chunk-B.js', './chunk-C.js', './d.js']);
  assert.deepEqual(staticImports("import { DEMOS } from './catalog.mjs';\nimport x, { y } from \"./y.js\";\nimport * as z from './z.js';\nawait import('./later.js');"), ['./catalog.mjs', './y.js', './z.js']);
  // A word in a string or a name ending in "import" is not an import.
  assert.deepEqual(staticImports('const reimport = 1; obj.import("./no.js");'), []);
});

test('an esbuild bundle left unminified is told by the path comment it starts each module with', () => {
  assert.equal(minified('var a=1;function b(){return a}export{b};\n//# sourceMappingURL=main.js.map\n'), true);
  assert.equal(minified('// libs/core/src/lib/record/form.ts\nvar form = 1;\n'), false);
  assert.equal(minified('// ../../fieldia/node_modules/ag-grid-community/dist/package/main.esm.mjs\nvar x;\n'), false);
  assert.equal(minified('// demos/shared/sample-data.ts\n'), false);
  // A comment a person wrote in a page's own script is not a module's path.
  assert.equal(minified('// The page\'s own words in other languages\nvar t;\n'), true);
});

/** A built demo in a folder of its own: its page, and its scripts by name. */
function demoAt(root, name, html, files) {
  mkdirSync(join(root, name, 'chunks'), { recursive: true });
  writeFileSync(join(root, name, 'index.html'), html);
  for (const [file, code] of Object.entries(files)) writeFileSync(join(root, name, file), code);
}

test('a page fetches its scripts and theirs, all the way down, never a part asked for later', () => {
  const root = mkdtempSync(join(tmpdir(), 'demo-sizes-'));
  try {
    writeFileSync(join(root, 'shell.mjs'), 'export const s=1;\n//# sourceMappingURL=shell.mjs.map\n');
    demoAt(root, 'plain', '<script type="module" src="../shell.mjs"></script><script type="module" src="main.js"></script>', {
      'main.js': 'import{a}from"./chunks/a.js";const l=()=>import("./chunks/list-part.js");\n//# sourceMappingURL=main.js.map\n',
      'chunks/a.js': 'import"./b.js";export const a=1;\n//# sourceMappingURL=a.js.map\n',
      'chunks/b.js': 'export const b=2;\n//# sourceMappingURL=b.js.map\n',
      'chunks/list-part.js': 'export const list=3;\n//# sourceMappingURL=list-part.js.map\n',
    });
    const files = pageScripts(root, join(root, 'plain', 'index.html')).map((file) => file.slice(root.length + 1)).sort();
    assert.deepEqual(files, ['plain/chunks/a.js', 'plain/chunks/b.js', 'plain/main.js', 'shell.mjs']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a page over its budget, a bundle unminified or without its map, and a demo with no budget are each said', () => {
  const root = mkdtempSync(join(tmpdir(), 'demo-sizes-'));
  try {
    const big = Array.from({ length: 4000 }, (_, i) => `var v${i}=${(i * 7919) % 104729};`).join('');
    demoAt(root, 'plain', '<script type="module" src="main.js"></script>', { 'main.js': `${big}\n//# sourceMappingURL=main.js.map\n`, 'main.js.map': '{}' });
    demoAt(root, 'loading', '<script type="module" src="main.js"></script>', { 'main.js': '// libs/core/src/index.ts\nvar a = 1;\n' });
    demoAt(root, 'other', '<script type="module" src="main.js"></script>', { 'main.js': 'var a=1;\n//# sourceMappingURL=main.js.map\n', 'main.js.map': '{}' });
    const { rows, wrong } = checkDemos(root, { plain: 1, loading: 100 }, ['plain', 'loading', 'other']);
    assert.equal(rows.length, 3);
    assert.match(wrong.join('\n'), /demos\/plain fetches [\d.]+ KB gzipped before it draws, over its budget of 1 KB/);
    assert.match(wrong.join('\n'), /loading\/main\.js is not minified/);
    assert.match(wrong.join('\n'), /loading\/main\.js has no source map beside it/);
    assert.match(wrong.join('\n'), /demos\/other has no budget/);
    // Within its budget, minified, its map beside it: nothing said.
    assert.deepEqual(checkDemos(root, { plain: 1000 }, ['plain']).wrong, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
