/**
 * No stylesheet of the packages has a sibling rule naming nothing on its left (tools/style-siblings.mjs): Chromium
 * restyles, for each element put in a page, every element beside it and inside them while one such rule is in force.
 *   node --test tools/style-siblings.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { namelessIn, namelessSiblings, styleModules } from './style-siblings.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);

test('every stylesheet of the packages names what its sibling rules follow', async () => {
  const modules = styleModules(ROOT);
  // The packages' stylesheets, all of them read: a gate that read none would pass.
  assert.ok(modules.length > 60, `${modules.length} style modules`);
  assert.ok(modules.some((one) => one.file === 'libs/widgets/src/lib/layout-styles.ts'));
  const found = [];
  for (const { file, css } of modules) for (const selector of await namelessSiblings(css)) found.push(`${file}: ${selector}`);
  assert.deepEqual(found, []);
});

test('it finds the rules that name nothing on their left — 0.35’s group gap rule among them', async () => {
  // 0.35's, which restyled a long list whole for each row its window drew.
  assert.deepEqual(await namelessSiblings('fieldset.fd-section > :where(:not(legend, [hidden]) ~ :not([hidden])) { margin-block-start: 14px; }'), [':not(legend,[hidden])~:not([hidden])']);
  assert.deepEqual(namelessIn('*+*'), ['*+*']);
  assert.deepEqual(namelessIn('.fd-words-table tr>*+*'), ['.fd-words-table tr>*+*']);
  assert.deepEqual(namelessIn(':where(.a,.b)~.c'), [':where(.a,.b)~.c']);
  assert.deepEqual(namelessIn(':not([hidden])+.c'), [':not([hidden])+.c']);
  assert.deepEqual(namelessIn('.x :hover~.y'), ['.x :hover~.y']);
});

test('it lets be what names its left: an element, a class, an id, an attribute, an :is() of them — and rules for paper', async () => {
  for (const selector of ['fieldset.fd-section>:is(.fd-section-description,.fd-grid):not([hidden])~:not([hidden])', 'tr[hidden]+tr>*', '.fd-list-import-button:not([hidden])~.fd-pager', '#a+b', '[data-x]~*', 'li+li', ':is(th,td)+:is(th,td)', '.a:has(+.b)', '.a:has(~.b)', '.fd-section-title~*', ':nth-child(2n+1)', ':nth-child(2n+1 of .x)', '[data-groups~=bg] .x']) {
    assert.deepEqual(namelessIn(selector), [], selector);
  }
  assert.deepEqual(await namelessSiblings('@media print { .fd-form .fd-lines > * + * { margin-block-start: 6px; } } @media (min-width: 600px) { .a > * ~ * { color: red; } }'), ['.a>*~*']);
});
