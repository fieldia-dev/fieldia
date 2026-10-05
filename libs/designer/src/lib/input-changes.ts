import type { Field, FieldNode } from '@fieldia/core';

/**
 * What changed in a field's text, number and date settings from one version
 * of a page to the next, in words: "“Bio”: takes at most 200 characters". A
 * field's own settings are said only while it stays the same kind of data —
 * a field made another kind says so on its own. `others` tells whether its
 * widget's settings changed in ways these words do not say.
 */

interface Placed {
  field: Field;
  node: FieldNode;
}

type Words = (value: unknown, now: Placed) => string;

/** A number's range: "from 0 to 300", "at least 0", "at most 300", "any number". */
function range(field: Field): string {
  const { min, max } = field as { min?: unknown; max?: unknown };
  if (min !== undefined && max !== undefined) return `from ${min} to ${max}`;
  return min !== undefined ? `at least ${min}` : max !== undefined ? `at most ${max}` : 'any number';
}

/** The field's own settings, by key: those said together, under the first. */
const FIELD_WORDS: Record<string, Words> = {
  size: (v) => (v === undefined ? 'takes any number of characters' : `takes at most ${v} characters`),
  'min,max': (_v, now) => range(now.field),
  digits: (v) => (v === undefined ? 'the usual decimals' : `${(v as number[])[1]} decimal${(v as number[])[1] === 1 ? '' : 's'}`),
};

/** The widget's settings, by key. */
const OPTION_WORDS: Record<string, Words> = {
  rows: (v) => `starts ${v ?? 3} rows high`,
  autoGrow: (v) => (v === false ? 'keeps its height as people type' : 'grows as people type'),
  prefix: (v) => (v ? `shows “${v}” before the number` : 'no unit before the number'),
  suffix: (v) => (v ? `shows “${v}” after the number` : 'no unit after the number'),
  icon: (v) => `shown as ${({ heart: 'hearts', thumb: 'thumbs up', number: 'numbers' } as Record<string, string>)[v as string] ?? 'stars'}`,
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function inputChanges(name: string, was: Placed, now: Placed): { lines: string[]; others: boolean } {
  const lines: string[] = [];
  const own = (p: Placed, key: string) => (p.field as Record<string, unknown>)[key];
  if (was.field.type === now.field.type) {
    for (const [keys, words] of Object.entries(FIELD_WORDS)) {
      const read = (p: Placed) => keys.split(',').map((key) => own(p, key));
      if (!same(read(was), read(now))) lines.push(`“${name}”: ${words(own(now, keys), now)}`);
    }
  }
  const [before, after] = [was.node.options ?? {}, now.node.options ?? {}];
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !same(before[key], after[key]));
  for (const key of changed) if (OPTION_WORDS[key]) lines.push(`“${name}”: ${OPTION_WORDS[key](after[key], now)}`);
  return { lines, others: changed.some((key) => !OPTION_WORDS[key]) };
}
