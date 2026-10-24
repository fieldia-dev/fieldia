/**
 * Every `Intl` formatter in Fieldia's own code is made by `intlFormat` (libs/core/src/lib/intl-format.ts), which makes
 * one per language and options and keeps it: no `new Intl.DateTimeFormat(…)` (or NumberFormat, PluralRules, ListFormat,
 * RelativeTimeFormat, DisplayNames, Collator) anywhere else, no `toLocaleString(…)` / `toLocaleDateString(…)` /
 * `toLocaleTimeString(…)` given a language or options (each makes one for its call; with neither, the engine keeps
 * its own), and no `localeCompare` given a language (each call makes a collator). Made in a cell's or a keystroke's work, they were a quarter of it at 0.32 (the performance audit's M1).
 * `Intl.Locale` is a tag read, not a formatter: free.
 *
 *   node --test tools/intl-source.test.mjs
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const WORKSPACE = resolve(new URL('..', import.meta.url).pathname);
const HOME = 'libs/core/src/lib/intl-format.ts';

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
  { what: 'an Intl formatter made outside intlFormat', pattern: /\bnew\s+Intl\.(DateTimeFormat|NumberFormat|PluralRules|ListFormat|RelativeTimeFormat|DisplayNames|Collator|Segmenter|DurationFormat)\b/ },
  { what: 'a formatter made for one call (toLocaleString)', pattern: /\.toLocale(Date|Time)?String\(\s*[^)\s]/ },
  { what: 'a collator made for one call (localeCompare given a language)', pattern: /\.localeCompare\([^()]*(\([^()]*\)[^()]*)*,/ },
];

test('no Fieldia source makes an Intl formatter but intlFormat', () => {
  const problems = [];
  for (const file of sources()) {
    const name = relative(WORKSPACE, file);
    if (name === HOME) continue;
    const lines = code(readFileSync(file, 'utf8')).split('\n');
    for (const rule of RULES) lines.forEach((line, i) => rule.pattern.test(line) && problems.push(`${name}:${i + 1}: ${rule.what}: ${line.trim().slice(0, 140)}`));
  }
  assert.deepEqual(problems, []);
});

test('the rules find what they are for', () => {
  const found = (text) => RULES.filter((rule) => code(text).split('\n').some((line) => rule.pattern.test(line))).map((rule) => rule.what);
  assert.deepEqual(found("const f = new Intl.DateTimeFormat(lang, { month: 'long' });"), ['an Intl formatter made outside intlFormat']);
  assert.deepEqual(found('const n = new Intl.NumberFormat(locale).format(1);'), ['an Intl formatter made outside intlFormat']);
  assert.deepEqual(found('const one = new Intl.PluralRules(locale).select(n);'), ['an Intl formatter made outside intlFormat']);
  assert.deepEqual(found('names = new Intl.DisplayNames([locale], { type: "region" });'), ['an Intl formatter made outside intlFormat']);
  assert.deepEqual(found("n.toLocaleString('en', { numberingSystem: 'latn' })"), ['a formatter made for one call (toLocaleString)']);
  assert.deepEqual(found("new Date(at).toLocaleDateString(locale)"), ['a formatter made for one call (toLocaleString)']);
  assert.deepEqual(found('a.localeCompare(b, locale)'), ['a collator made for one call (localeCompare given a language)']);
  assert.deepEqual(found('nameOf(a).localeCompare(nameOf(b), designer.locale)'), ['a collator made for one call (localeCompare given a language)']);
  // What is free: intlFormat itself, a tag read, a comparison with no language, a comment, a type.
  assert.deepEqual(found("intlFormat('DateTimeFormat', lang, { month: 'long' }).format(at); new Intl.Locale(tag); a.localeCompare(b); d.toLocaleString(); // new Intl.NumberFormat(x)"), []);
  assert.deepEqual(found('const options: Intl.DateTimeFormatOptions = {}; let f: Intl.NumberFormat;'), []);
});
