import type { FieldNode } from '@fieldia/core';

/**
 * Options shuffled when a question's `options.shuffle` is true, as a survey
 * shuffles them so the first is not chosen for being first. Each form draws
 * a seed of its own once, so a question keeps its order however often the
 * form draws it, and the next form has another; each question, by its name,
 * has its own order within the form. "Other" is not among the options, so
 * it stays after them.
 */

const seeds = new WeakMap<object, number>();

/** The form's seed, drawn the first time it is asked for. */
function seedOf(form: object): number {
  let seed = seeds.get(form);
  if (seed === undefined) {
    seed = Math.floor(Math.random() * 0x100000000) >>> 0;
    seeds.set(form, seed);
  }
  return seed;
}

/** A seed for one question: the form's, stirred with the question's name. */
function stir(seed: number, name: string): number {
  let h = seed ^ 0x9e3779b9;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}

/** Numbers from 0 to 1 that follow from the seed: Mulberry32. */
function numbers(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

/**
 * The options in the order this form shows them: as written, or shuffled when
 * the question asks — those kept in place (`fixed`) where they were written,
 * and one that goes alone ("None of these") last, as "Other" is.
 */
export function shownOptions<T>(options: readonly T[], form: object, name: string, node: Pick<FieldNode, 'options'>): T[] {
  if (node.options?.['shuffle'] !== true) return [...options];
  const is = (option: T, flag: string) => (option as Record<string, unknown>)[flag] === true;
  const shown = options.filter((o) => !is(o, 'fixed') && !is(o, 'exclusive'));
  const next = numbers(stir(seedOf(form), name));
  // Fisher–Yates.
  for (let i = shown.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [shown[i], shown[j]] = [shown[j], shown[i]];
  }
  shown.push(...options.filter((o) => !is(o, 'fixed') && is(o, 'exclusive')));
  return options.map((o) => (is(o, 'fixed') ? o : (shown.shift() as T)));
}
