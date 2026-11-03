/**
 * Every demo page passes `validatePage` (0.37): a viewer refuses, before it is drawn, a page its whole check refuses, so
 * a demo page with a mistake would show fieldia.dev's visitors "This form cannot be shown". Each page the demos serve by
 * name (demos/shared/sample-data.ts), with the app's own functions the demos give, as it is written and as the address
 * dresses it (`pageFromQuery`: a printout's words, a scheme, a width) — and that the check bites: a page with a mistake
 * only the whole check finds, and one stamped older than a setting it uses, are refused.
 *
 *   node --test tools/demo-pages.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { build } from 'esbuild';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);

/** What each demo page's check says, by its name and how it was dressed: run in Node, the demos' modules bundled. */
async function checked() {
  const dir = join(WORKSPACE, 'tmp/demo-pages');
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const out = join(dir, 'check.mjs');
  await build({
    stdin: {
      contents: `
        import { validatePage } from './libs/core/src/lib/format/validate';
        import { pages, pageFromQuery } from './demos/shared/sample-data';
        import { pageOf } from './demos/shared/lazy-page';
        import { demoFunctions } from './demos/shared/functions';
        const said = {};
        const say = (name, page) => {
          const checked = validatePage(page, { functions: demoFunctions });
          said[name] = checked.ok ? 'ok' : checked.issues.slice(0, 3).map((issue) => issue.path + ': ' + issue.message).join(' | ');
        };
        for (const [name, source] of Object.entries(pages)) {
          say(name, await pageOf(source));
          say(name + ' dressed', await pageFromQuery(new URLSearchParams({ page: name, scheme: 'dark', maxWidth: 'wide', print: JSON.stringify({ footer: 'Page {page}' }) })));
        }
        // The check bites: a mistake only the whole check finds, and a page stamped older than a setting it uses.
        const signup = await pageOf(pages['signup']);
        const [first] = Object.keys(signup.fields);
        say('bite: required as words', { ...signup, fields: { ...signup.fields, [first]: { ...signup.fields[first], required: 'yes' } } });
        say('bite: stamped older', { ...signup, fieldia: '0.1', print: { footer: 'Page {page}' } });
        process.stdout.write(JSON.stringify(said));`,
      resolveDir: WORKSPACE,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    outfile: out,
    tsconfig: join(WORKSPACE, 'tsconfig.base.json'),
    banner: { js: "globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });" },
    define: { 'process.env.NODE_ENV': '"production"' },
    loader: { '.svg': 'text', '.css': 'text', '.png': 'file', '.ttf': 'file' },
    plugins: [{ name: 'zxing-readers', setup: (builder) => builder.onResolve({ filter: /^@zxing\/library$/ }, () => ({ path: join(WORKSPACE, 'tools/zxing-readers.mjs') })) }],
    logLevel: 'error',
  });
  try {
    return JSON.parse(execFileSync(process.execPath, [out], { cwd: dir, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('every demo page passes validatePage, as written and as its address dresses it: none is refused before it is drawn', async () => {
  const said = await checked();
  const pages = Object.keys(said).filter((name) => !name.startsWith('bite:'));
  assert.ok(pages.length > 200, `the demos' pages read: ${pages.length}`);
  assert.deepEqual(Object.entries(said).filter(([name, words]) => !name.startsWith('bite:') && words !== 'ok').map(([name, words]) => `${name}: ${words}`), []);
  // The check this holds them to bites.
  assert.match(said['bite: required as words'], /\.required: /);
  assert.match(said['bite: stamped older'], /^print: this came in format 0\.4, but the page says it is in format 0\.1/);
});
