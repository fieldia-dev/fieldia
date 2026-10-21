/**
 * A strict Content-Security-Policy in Fieldia's own code — every package's source, the one-tag script's tools: no code
 * made from text (`eval`, `new Function`, a timer given text), which `script-src` without 'unsafe-eval' refuses; no
 * style attribute written (`setAttribute('style', …)`, `style="…"` in markup Fieldia writes, an element factory's
 * `style:`), which `style-src` without 'unsafe-inline' refuses — a style is set through an element's style object,
 * which a policy lets be; and every `<style>` element made by `fieldiaStyle`, which gives it the page's nonce.
 * The browser gate (e2e/csp.spec.ts) serves pages under such a policy in every engine; this finds the line.
 *
 *   node --test tools/csp-source.test.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);

/** Every source file of the packages and the script bundle's tools, but tests. */
function sources() {
  const found = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.(ts|tsx|mjs)$/.test(entry.name) && !/\.spec\.tsx?$|\.test\.mjs$|(^|\/)test-[a-z-]+\.ts$/.test(entry.name)) found.push(path);
    }
  };
  for (const lib of readdirSync(join(WORKSPACE, 'libs'))) walk(join(WORKSPACE, 'libs', lib, 'src'));
  for (const file of ['script-entry.ts', 'script-parts.ts', 'script-language.ts']) found.push(join(WORKSPACE, 'tools', file));
  return found;
}

/** The code of a file, its comments blanked (a comment may name what the code must not do). */
const code = (text) => text.replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ' ')).replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');

const RULES = [
  { what: 'code made from text', pattern: /\bnew Function\b|(?<![.\w])eval\(|(?<![.\w])Function\(|\bset(Timeout|Interval)\(\s*['"`]/ },
  { what: 'a style attribute written', pattern: /\bsetAttribute\(\s*['"`]style['"`]/ },
  // An element factory's attributes (`el('div', { …, style: … })`), which it writes with setAttribute.
  { what: 'a style attribute in an element factory', pattern: /\b(?!\w*Format\()[a-zA-Z]+\(\s*['"`][a-z][a-z0-9-]*['"`]\s*,\s*\{[^}]*?\bstyle:\s*[`'"]/ },
  { what: 'a <style> element made without the nonce (fieldiaStyle)', pattern: /createElement\(\s*['"`]style['"`]\s*\)/, except: ['libs/widgets/src/lib/style-nonce.ts'] },
  // Markup Fieldia writes itself. A formatted text's value keeps its looks as style attributes (markdown.ts writes
  // them as a value): shown with showHtml, never read by the browser as style attributes (style-attributes.ts).
  { what: 'a style attribute in markup', pattern: /<[a-z][^<>`]*\sstyle=["'\\]/i, except: ['libs/widgets/src/lib/markdown.ts'] },
];

test('no Fieldia source makes code from text, writes a style attribute, or makes a <style> without the nonce', () => {
  const problems = [];
  for (const file of sources()) {
    const name = relative(WORKSPACE, file);
    const lines = code(readFileSync(file, 'utf8')).split('\n');
    for (const rule of RULES) {
      if (rule.except?.includes(name)) continue;
      lines.forEach((line, i) => {
        if (rule.pattern.test(line)) problems.push(`${name}:${i + 1}: ${rule.what}: ${line.trim().slice(0, 140)}`);
      });
    }
  }
  assert.deepEqual(problems, []);
});

test('the rules find what they are for', () => {
  const found = (text) => RULES.filter((rule) => code(text).split('\n').some((line) => rule.pattern.test(line))).map((rule) => rule.what);
  assert.deepEqual(found("const f = new Function('a', 'return a');"), ['code made from text']);
  assert.deepEqual(found("setTimeout('go()', 10);"), ['code made from text']);
  assert.deepEqual(found("box.setAttribute('style', 'width: 1px');"), ['a style attribute written']);
  assert.deepEqual(found("el('div', { class: 'x', style: `--a: ${b}` });"), ['a style attribute in an element factory']);
  assert.deepEqual(found("const s = document.createElement('style');"), ['a <style> element made without the nonce (fieldiaStyle)']);
  assert.deepEqual(found('box.innerHTML = `<span style="color: red">x</span>`;'), ['a style attribute in markup']);
  // What a policy lets be: a style object, a class, a comment, a word.
  assert.deepEqual(found("box.style.width = '1px'; box.style.setProperty('--a', b); // never setAttribute('style', …)"), []);
  assert.deepEqual(found("const words = 'a style: plain';"), []);
  assert.deepEqual(found("new Intl.NumberFormat('en', { style: 'currency', currency });"), []);
});
