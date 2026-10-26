import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A `:has()` left of a combinator whose subject names nothing — `.fd-field:has(…) > *`, `… :has(…) > :not(.x)` — made
 * Chromium lay the whole form out again at every change inside it: a key in a line of a 200-line invoice took twice the
 * time of one in a line of 3, all of it there (0.35.1's walk). Fieldia's stylesheets say such a state with an
 * attribute its code writes instead (`data-fd-open`, `data-lock-shown`, `data-fd-printing`). A `:has()` in a selector's
 * subject, or over a subject that names a class, a type or an attribute, costs nothing of the kind, and stays; so does
 * one only paper reads (`@media print`). Every style module of every package is read (tools/minified-styles.mjs).
 */

const LIBS = join(__dirname, '../../..');
const STYLE_MODULE = /^(([a-z-]+-)?styles|styles-[a-z-]+)\.ts$/;

/** Every style module's stylesheet text, by its path from libs/. */
function stylesheets(): [string, string][] {
  const out: [string, string][] = [];
  for (const lib of readdirSync(LIBS)) {
    const dir = join(LIBS, lib, 'src/lib');
    let names: string[];
    try {
      names = readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names.filter((one) => STYLE_MODULE.test(one))) {
      const source = readFileSync(join(dir, name), 'utf8');
      for (const found of source.matchAll(/`([^`]*)`/g)) if (found[1].includes('{')) out.push([`${lib}/${name}`, found[1]]);
    }
  }
  return out;
}

/** `text` split at `separator`s outside brackets and parentheses. */
function splitOutside(text: string, at: (char: string) => boolean): string[] {
  const out: string[] = [];
  let depth = 0;
  let now = '';
  for (const char of text) {
    if (char === '(' || char === '[') depth++;
    if (char === ')' || char === ']') depth--;
    if (depth === 0 && at(char)) {
      out.push(now);
      now = '';
    } else now += char;
  }
  out.push(now);
  return out.map((one) => one.trim()).filter(Boolean);
}

/** A complex selector's compounds, left to right. */
const compounds = (selector: string) => splitOutside(selector.replace(/\s*([>+~])\s*/g, ' $1 '), (char) => /\s/.test(char)).filter((one) => !/^[>+~]$/.test(one));

/** Whether a compound names nothing a rule is found by — no class, id, attribute or type — its `:is()` too, by its subjects. */
function universal(compound: string): boolean {
  let rest = compound.replace(/::?[a-z-]+$/, '').replace(/::[a-z-]+(\([^)]*\))?/g, '');
  const within = /:(is|where)\(/.exec(rest);
  if (within) {
    let depth = 0;
    let end = within.index + within[0].length;
    for (; end < rest.length; end++) {
      if (rest[end] === '(') depth++;
      if (rest[end] === ')') {
        if (depth === 0) break;
        depth--;
      }
    }
    const inner = rest.slice(within.index + within[0].length, end);
    const outer = rest.slice(0, within.index) + rest.slice(end + 1);
    const named = !universal(outer || '*');
    return !named && splitOutside(inner, (char) => char === ',').some((one) => universal(compounds(one).pop() ?? '*'));
  }
  // What `:not()` and other functions hold says what the subject is not.
  for (let found = /:[a-z-]+\(/.exec(rest); found; found = /:[a-z-]+\(/.exec(rest)) {
    let depth = 0;
    let end = found.index + found[0].length;
    for (; end < rest.length; end++) {
      if (rest[end] === '(') depth++;
      if (rest[end] === ')') {
        if (depth === 0) break;
        depth--;
      }
    }
    rest = rest.slice(0, found.index) + rest.slice(end + 1);
  }
  return !/[.#[]/.test(rest) && !/^[a-zA-Z]/.test(rest);
}

/** The selectors of a stylesheet's rules, but those inside `@media print`. */
function screenSelectors(css: string): string[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: string[] = [];
  const read = (body: string) => {
    let at = 0;
    while (at < body.length) {
      const open = body.indexOf('{', at);
      if (open === -1) return;
      const head = body.slice(at, open).replace(/^[\s;]+/, '').trim();
      let depth = 1;
      let end = open + 1;
      for (; end < body.length && depth; end++) {
        if (body[end] === '{') depth++;
        if (body[end] === '}') depth--;
      }
      const inner = body.slice(open + 1, end - 1);
      if (head.startsWith('@')) {
        if (!/^@media\s+print\b/.test(head) && !/^@(keyframes|font-face)/.test(head)) read(inner);
      } else out.push(...splitOutside(head, (char) => char === ','));
      at = end;
    }
  };
  read(text);
  return out;
}

describe('a :has() in Fieldia’s stylesheets', () => {
  it('reads the stylesheets: the selectors it holds to are there to hold', () => {
    const all = stylesheets().flatMap(([, css]) => screenSelectors(css));
    expect(all.length).toBeGreaterThan(1000);
    expect(universal('*')).toBe(true);
    expect(universal(':not(.fd-print-table)')).toBe(true);
    expect(universal(':is(.fd-label + *, :first-child:not(.fd-label))')).toBe(true);
    expect(universal('.fd-combo-input[readonly]')).toBe(false);
    expect(universal(':is(.fd-card, .fd-side)')).toBe(false);
    expect(universal('td')).toBe(false);
  });

  it('is never left of a combinator over a subject that names nothing: the state said by an attribute instead', () => {
    const found: string[] = [];
    for (const [where, css] of stylesheets()) {
      for (const selector of screenSelectors(css)) {
        const parts = compounds(selector);
        if (parts.slice(0, -1).some((part) => part.includes(':has(')) && universal(parts[parts.length - 1])) found.push(`${where}: ${selector}`);
      }
    }
    expect(found).toEqual([]);
  });
});
