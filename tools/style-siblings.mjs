/**
 * Sibling rules that name nothing on their left. A rule whose `+` or `~` has, on its left, a part an engine cannot key it
 * by — no element, class, id or attribute: only `*`, `:not()`, `:where()` or another pseudo-class — holds, as far as the
 * engine can tell, beside any element. Chromium then restyles, as each element is put in the page anywhere, every element
 * beside it and every element inside them: 0.35's group gap rule (`fieldset.fd-section > :where(:not(legend, [hidden]) ~
 * :not([hidden]))`) restyled the whole of a long list for each row its window drew as it scrolled — 1,487 elements a
 * step, every step, on a phone the most of a wheel's frames. Rules for paper alone (`@media print`) are left out: the
 * engine keys its rules for the screen by those that apply there.
 *
 *   node --test tools/style-siblings.test.mjs   — every stylesheet in the packages held to it
 */
import { transform } from 'esbuild';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { STYLE_MODULE } from './minified-styles.mjs';

/** Each part of `text` at the top level (outside brackets and parentheses), split where `at` says. */
function splitTop(text, at) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (depth === 0 && at(c, i)) {
      parts.push(text.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(text.slice(from));
  return parts;
}

/** The arguments of each functional pseudo-class in a compound, by its name: `:is(a, b)` → ['is', 'a, b']. */
function functional(compound) {
  const found = [];
  const re = /:([a-z-]+)\(/g;
  for (let match; (match = re.exec(compound));) {
    let depth = 1;
    let i = re.lastIndex;
    for (; i < compound.length && depth; i++) {
      if (compound[i] === '(') depth++;
      else if (compound[i] === ')') depth--;
    }
    found.push([match[1], compound.slice(re.lastIndex, i - 1)]);
    re.lastIndex = i;
  }
  return found;
}

/** The compound with its functional pseudo-classes' arguments taken out: what is left at its own level. */
const ownLevel = (compound) => {
  let out = '';
  let depth = 0;
  for (const c of compound) {
    if (c === '(') depth++;
    if (depth === 0) out += c;
    if (c === ')') depth--;
  }
  return out;
};

/** Whether an engine can key a compound by something it names: an element, a class, an id, an attribute — or `:is()` of such. */
function named(compound) {
  const own = ownLevel(compound).replace(/::?[a-z-]+/g, '');
  if (/^[a-zA-Z]/.test(own) || /[.#[]/.test(own)) return true;
  return functional(compound).some(([name, args]) => name === 'is' && splitTop(args, (c) => c === ',').every((arg) => named(arg.trim())));
}

/** Every complex selector of a selector list whose sibling combinator has a compound that names nothing on its left. */
export function namelessIn(list) {
  const found = [];
  for (const selector of splitTop(list, (c) => c === ',')) {
    const text = selector.trim();
    // Its compounds and the combinators between them, at its own level.
    const pieces = [];
    let depth = 0;
    let from = 0;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth === 0 && (c === '+' || c === '~' || c === '>' || c === ' ')) {
        pieces.push([text.slice(from, i).trim(), c]);
        from = i + 1;
      }
    }
    pieces.push([text.slice(from).trim(), null]);
    const compounds = pieces.filter(([compound]) => compound !== '');
    for (const [compound, combinator] of compounds) if ((combinator === '+' || combinator === '~') && !named(compound)) found.push(text);
    // Inside a :where(), :is(), :not() or :has() — or an :nth-child()'s "of" — a selector of its own.
    for (const [compound] of compounds) {
      for (const [name, args] of functional(compound)) {
        const inner = /^(is|where|not|has|matches)$/.test(name) ? args : /^nth-(last-)?child$/.test(name) && / of /.test(args) ? args.slice(args.indexOf(' of ') + 4) : null;
        if (inner !== null) found.push(...namelessIn(inner.replace(/^\s*[+~>]/, '')));
      }
    }
  }
  return [...new Set(found)];
}

/** Every rule's selectors in a stylesheet, those for paper alone left out. */
function selectorsOf(css) {
  const out = [];
  let i = 0;
  const block = (end) => {
    while (i < end) {
      const open = css.indexOf('{', i);
      if (open < 0 || open >= end) return;
      const head = css.slice(i, open).trim();
      let depth = 1;
      let j = open + 1;
      for (; j < css.length && depth; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}') depth--;
      }
      if (head.startsWith('@')) {
        if (!/^@media\s+print\b/.test(head) && /^@(media|supports|container|layer|scope)\b/.test(head)) {
          const save = i;
          i = open + 1;
          block(j - 1);
          i = save;
        }
      } else out.push(head);
      i = j;
    }
  };
  block(css.length);
  return out;
}

/** The selectors of a stylesheet that name nothing on the left of a sibling combinator. */
export async function namelessSiblings(css) {
  const { code } = await transform(css, { loader: 'css', minify: true, logLevel: 'silent' });
  return selectorsOf(code).flatMap(namelessIn);
}

/** Every style module of the packages (their one stylesheet each), by file: what the gate reads. */
export function styleModules(root) {
  const out = [];
  for (const pkg of readdirSync(join(root, 'libs'))) {
    const dir = join(root, 'libs', pkg, 'src', 'lib');
    let files;
    try {
      files = readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files.filter((name) => STYLE_MODULE.test(name) && !name.endsWith('.spec.ts'))) {
      const source = readFileSync(join(dir, file), 'utf8');
      const sheet = /= (?:\/\* css \*\/ )?`([^`]*)`;/.exec(source);
      if (sheet) out.push({ file: `libs/${pkg}/src/lib/${file}`, css: sheet[1] });
    }
  }
  return out;
}
