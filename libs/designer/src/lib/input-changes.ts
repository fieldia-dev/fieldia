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

/** The field's own settings, by key. */
const FIELD_WORDS: Record<string, Words> = {
  size: (v) => (v === undefined ? 'takes any number of characters' : `takes at most ${v} characters`),
};

/** The widget's settings, by key. */
const OPTION_WORDS: Record<string, Words> = {
  rows: (v) => `starts ${v ?? 3} rows high`,
  autoGrow: (v) => (v === false ? 'keeps its height as people type' : 'grows as people type'),
};

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function inputChanges(name: string, was: Placed, now: Placed): { lines: string[]; others: boolean } {
  const lines: string[] = [];
  const own = (p: Placed, key: string) => (p.field as Record<string, unknown>)[key];
  if (was.field.type === now.field.type) {
    for (const [key, words] of Object.entries(FIELD_WORDS)) if (!same(own(was, key), own(now, key))) lines.push(`“${name}”: ${words(own(now, key), now)}`);
  }
  const [before, after] = [was.node.options ?? {}, now.node.options ?? {}];
  const changed = [...new Set([...Object.keys(before), ...Object.keys(after)])].filter((key) => !same(before[key], after[key]));
  for (const key of changed) if (OPTION_WORDS[key]) lines.push(`“${name}”: ${OPTION_WORDS[key](after[key], now)}`);
  return { lines, others: changed.some((key) => !OPTION_WORDS[key]) };
}
