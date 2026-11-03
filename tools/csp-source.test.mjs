/**
 * A strict Content-Security-Policy in Fieldia's own code — every package's source, the one-tag script's tools: no code
 * made from text (`eval`, `new Function`, a timer given text), which `script-src` without 'unsafe-eval' refuses; no
 * style attribute written (`setAttribute('style', …)`, `style="…"` in markup Fieldia writes, an element factory's
 * `style:`), which `style-src` without 'unsafe-inline' refuses — a style is set through an element's style object,
 * which a policy lets be; and every `<style>` element made by `fieldiaStyle`, which gives it the page's nonce.
 * The browser gate (e2e/csp.spec.ts) serves pages under such a policy in every engine; this finds the line.
 *
 * And every address an element or the browser is given — a link's, a picture's, a player's, a frame's, a page sent
 * elsewhere — goes through `safeUrl` (@fieldia/core), which keeps only the schemes the place allows: no
 * `javascript:` where a strict policy is not served.
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
  // A style attribute copied by its name (`name === 'style'` among the attributes copied): written with setAttribute.
  // The look of the form a sheet wears goes through its style object (`box.style.cssText = root.style.cssText`).
  { what: 'a style attribute copied by its name', pattern: /\b(name|attribute\.name)\s*===\s*['"`]style['"`]/ },
  // Every attribute of one element written on another: its style attribute among them, unless the copy leaves it out
  // (a cell made a header's keeps its looks through its style object) or copies only named ones (`data-…`, `LOOK`).
  { what: 'a style attribute among the attributes copied', pattern: /\.attributes\b.*\bsetAttribute\(/, unless: /!==\s*['"`]style['"`]|startsWith\(['"`]data-|\bLOOK\(/ },
  // HTML read as HTML (`innerHTML`) that may hold a value's looks: its style attributes held first (`heldHtml`), as a
  // policy refuses a style attribute read as HTML (style-attributes.ts) — else words, or a drawing of Fieldia's own.
  {
    what: 'HTML read with its style attributes (heldHtml first)',
    pattern: /\.(inner|outer)HTML\s*=(?!=)(?!\s*(?:heldHtml\(|['"`]|[A-Z][A-Z_]*\b))|insertAdjacentHTML\(\s*[^,]+,(?!\s*(?:heldHtml\(|['"`]))/,
    // A drawing of Fieldia's own, its shapes written in the code.
    allow: [
      { file: 'libs/widgets/src/lib/html-classic.ts', has: 'button.innerHTML = icon;' },
      { file: 'libs/widgets/src/lib/icons.ts', has: 'svg.innerHTML = inside;' },
      { file: 'libs/widgets/src/lib/text-tools.ts', has: "svg.innerHTML = tool === 'emoji' ? drawing" },
      { file: 'libs/chatter/src/lib/channels.ts', has: 'svg.innerHTML = two ?' },
    ],
  },
];

test('no Fieldia source makes code from text, writes a style attribute, or makes a <style> without the nonce', () => {
  const problems = [];
  for (const file of sources()) {
    const name = relative(WORKSPACE, file);
    const lines = code(readFileSync(file, 'utf8')).split('\n');
    for (const rule of RULES) {
      if (rule.except?.includes(name)) continue;
      lines.forEach((line, i) => {
        if (rule.allow?.some((one) => one.file === name && line.includes(one.has)) || rule.unless?.test(line)) return;
        if (rule.pattern.test(line)) problems.push(`${name}:${i + 1}: ${rule.what}: ${line.trim().slice(0, 140)}`);
      });
    }
  }
  assert.deepEqual(problems, []);
});

test('the rules find what they are for', () => {
  const found = (text) => RULES.filter((rule) => code(text).split('\n').some((line) => rule.pattern.test(line) && !rule.unless?.test(line))).map((rule) => rule.what);
  assert.deepEqual(found("const f = new Function('a', 'return a');"), ['code made from text']);
  assert.deepEqual(found("setTimeout('go()', 10);"), ['code made from text']);
  assert.deepEqual(found("box.setAttribute('style', 'width: 1px');"), ['a style attribute written']);
  assert.deepEqual(found("el('div', { class: 'x', style: `--a: ${b}` });"), ['a style attribute in an element factory']);
  assert.deepEqual(found("const s = document.createElement('style');"), ['a <style> element made without the nonce (fieldiaStyle)']);
  assert.deepEqual(found('box.innerHTML = `<span style="color: red">x</span>`;'), ['a style attribute in markup']);
  assert.deepEqual(found("for (const { name, value } of [...root.attributes]) if (name === 'style') box.setAttribute(name, value);"), ['a style attribute copied by its name', 'a style attribute among the attributes copied']);
  assert.deepEqual(found("for (const attribute of [...cell.attributes]) if (attribute.name !== 'scope') next.setAttribute(attribute.name, attribute.value);"), ['a style attribute among the attributes copied']);
  assert.deepEqual(found("for (const a of [...cell.attributes]) if (a.name !== 'style') next.setAttribute(a.name, a.value);"), []);
  assert.deepEqual(found('box.innerHTML = html;'), ['HTML read with its style attributes (heldHtml first)']);
  assert.deepEqual(found("area.insertAdjacentHTML('beforeend', html);"), ['HTML read with its style attributes (heldHtml first)']);
  assert.deepEqual(found('box.innerHTML = heldHtml(html); if (area.innerHTML !== last) showHtml(area, last); svg.innerHTML = CHEVRON;'), []);
  // What a policy lets be: a style object, a class, a comment, a word.
  assert.deepEqual(found("box.style.width = '1px'; box.style.setProperty('--a', b); // never setAttribute('style', …)"), []);
  assert.deepEqual(found("const words = 'a style: plain';"), []);
  assert.deepEqual(found("new Intl.NumberFormat('en', { style: 'currency', currency });"), []);
});

/** A value that is no address from outside: words written in the code (no `${…}` in them), or a link within the page. */
const LITERAL = /^\s*(?:'[^']*'|"[^"]*"|`[^`$]*`|`#)/;
const ADDRESS = '(?:href|src|poster|srcdoc)';
/** What sends the browser elsewhere, or puts an address on an element, unless `safeUrl` gave the address on its line. */
const URL_RULES = [
  {
    what: 'a page sent elsewhere',
    find: (line) => /\blocation\??\.(assign|replace)\(|(?<!(?:const|let|var)\s+)\blocation(\??\.href)?\s*=(?!=)|\b(window|defaultView|win|globalThis|self|top|parent|opener)\??\.open\(/.test(line),
  },
  { what: 'an address written to an element', find: (line) => [...line.matchAll(new RegExp(`(?<!location\\??)\\.${ADDRESS}\\s*=(?!=)(.*)`, 'g'))].some((m) => !LITERAL.test(m[1])) },
  {
    what: 'an address attribute written',
    find: (line) => [...line.matchAll(new RegExp(`\\b(?:setAttribute(?:NS)?\\(\\s*(?:null\\s*,\\s*)?|setAttr\\(\\s*[^,()]+,\\s*)['"\`](?:${ADDRESS.slice(3, -1)}|xlink:href)['"\`]\\s*,(.*)`, 'g'))].some((m) => !LITERAL.test(m[1])),
  },
  // An element factory's attributes (`el('a', { href })`, `make(kind, { src })`) and Object.assign's, which write them.
  {
    what: 'an address in an element factory',
    find: (line) =>
      /(?:\b[\w$]+|\))\(\s*[^(),{}]+,\s*\{|\bObject\.assign\(/.test(line) &&
      [...line.matchAll(new RegExp(`[{,]\\s*${ADDRESS}\\s*(?::(.*)|(?=\\s*[,}]))`, 'g'))].some((m) => m[1] === undefined || !LITERAL.test(m[1])),
  },
];
/** Lines a rule reads as a sink that are not one, each with why. */
const NOT_SINKS = [
  // The page's JSON the designers write, not an element.
  { file: 'libs/designer/src/lib/layout-settings.ts', has: 'node.src = patch.src.trim()' },
  { file: 'libs/designer/src/lib/list-properties.ts', has: '(map.card ??= {}).href = cardLink.value' },
  // A part's script, by its name at build time, beside the main script's own address (`partTag`, the one place its
  // address is made; a strict policy's gate: csp.spec).
  { file: 'tools/script-parts.ts', has: 'script.src = src' },
  { file: 'libs/designer/src/lib/panel-block.ts', has: 'designer.updateBlock(id, { src: src.value })' },
  { file: 'libs/designer/src/lib/panel-block.ts', has: 'designer.updateBlock(id, { href: href.value })' },
  // The embed script's frame, at the host page's own data-src, its protocol checked on the line before: it carries no core.
  { file: 'libs/viewer/src/lib/embed-frame.ts', has: 'frame.src = at.href' },
];
const urlProblems = (name, text) => {
  const problems = [];
  code(text)
    .split('\n')
    .forEach((line, i) => {
      if (line.includes('safeUrl(') || NOT_SINKS.some((one) => one.file === name && line.includes(one.has))) return;
      for (const rule of URL_RULES) if (rule.find(line)) problems.push(`${name}:${i + 1}: ${rule.what} not through safeUrl: ${line.trim().slice(0, 140)}`);
    });
  return problems;
};

test('every address an element or the browser is given goes through safeUrl', () => {
  const problems = sources().flatMap((file) => urlProblems(relative(WORKSPACE, file), readFileSync(file, 'utf8')));
  assert.deepEqual(problems, []);
});

test('the address rules find what they are for', () => {
  const found = (text) => urlProblems('x.ts', text).map((problem) => problem.replace(/^x\.ts:\d+: | not through.*$/g, ''));
  assert.deepEqual(found('win.location.assign(url);'), ['a page sent elsewhere']);
  assert.deepEqual(found("doc.defaultView?.open(url, '_blank');"), ['a page sent elsewhere']);
  assert.deepEqual(found('location.href = next;'), ['a page sent elsewhere']);
  assert.deepEqual(found('link.href = value;'), ['an address written to an element']);
  assert.deepEqual(found('frame.src = `${url}#page=2`;'), ['an address written to an element']);
  assert.deepEqual(found("img.setAttribute('src', picture);"), ['an address attribute written']);
  assert.deepEqual(found("setAttr(open, 'href', made?.url ?? null);"), ['an address attribute written']);
  assert.deepEqual(found("el('a', { class: 'x', href: attachment.url });"), ['an address in an element factory']);
  assert.deepEqual(found("make('img', { ...attrs, src });"), ['an address in an element factory']);
  assert.deepEqual(found("Object.assign(credit, { href: mark.href, target: '_blank' });"), ['an address in an element factory']);
  // Through safeUrl, words in the code, or no sink at all.
  assert.deepEqual(found('link.href = safeUrl(value, LINK_URL) ?? "";'), []);
  assert.deepEqual(found("el('a', { href: safeUrl(attachment.url, MEDIA_URL), download: name });"), []);
  assert.deepEqual(found("make(film ? 'video' : 'audio', { src: url, controls: '' });"), ['an address in an element factory']);
  assert.deepEqual(found("const link = maker(doc)('a', { href: url, download: name });"), ['an address in an element factory']);
  assert.deepEqual(found("link.href = '#top'; el('a', { href: `#comment-${id}` }); img.setAttribute('src', 'data:image/gif;base64,R0lGOD');"), []);
  assert.deepEqual(found("if (a.href === b.href) view.open(choices); const at = location.href; const location = answer.header('location');"), []);
});
