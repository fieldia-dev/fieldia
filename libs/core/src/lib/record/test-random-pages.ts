import type { Page } from '../format/page';
import type { Values } from './values';

/**
 * For the specs that hold the quick way a form works a change out to working everything out again (`recomputeInFull`):
 * pages made at random from a seed — fields of every plain kind, conditions on fields and on sections, values worked out
 * from others and from a table's lines, values set as a condition starts to hold, required, read-only and hidden by
 * conditions, answer rules, tones, words of an empty box — and values of each kind at random.
 */

export const seeded = (seed: number) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
export type Random = () => number;
export const pick = <T>(r: Random, list: readonly T[]): T => list[Math.floor(r() * list.length)];
export const chance = (r: Random, p: number) => r() < p;

export type Kind = 'char' | 'integer' | 'float' | 'monetary' | 'boolean' | 'selection' | 'date' | 'text';
export interface Made {
  page: Page;
  kinds: Record<string, Kind>;
  /** Fields a person may write: none worked out. */
  writable: string[];
  lines: boolean;
  nodes: string[];
}

export function makePage(seed: number): Made {
  const r = seeded(seed);
  const n = 8 + Math.floor(r() * 18);
  const fields: Record<string, Record<string, unknown>> = {};
  const kinds: Record<string, Kind> = {};
  const of = (kind: Kind) => Object.keys(kinds).filter((name) => kinds[name] === kind);
  const numbers = () => Object.keys(kinds).filter((name) => ['integer', 'float', 'monetary'].includes(kinds[name]));
  const lines = chance(r, 0.6);
  fields['cur'] = { type: 'char', label: 'Currency', default: 'EGP' };
  for (let i = 0; i < n; i++) {
    const kind = pick<Kind>(r, ['char', 'integer', 'float', 'monetary', 'boolean', 'selection', 'date', 'text', 'integer', 'char']);
    const name = `f${i}`;
    const def: Record<string, unknown> = { type: kind, label: `Field ${i}` };
    if (kind === 'selection') def['options'] = [{ value: 'a', label: 'Alpha' }, { value: 'b', label: 'Beta' }, { value: 'c', label: 'Gamma' }];
    if (kind === 'monetary') Object.assign(def, chance(r, 0.5) ? { currency: 'EGP' } : { currencyField: 'cur' }, { digits: [12, 2] });
    if (kind === 'float' && chance(r, 0.5)) def['digits'] = [12, 2];
    if (kind === 'integer' && chance(r, 0.3)) def['min'] = 0;
    if (chance(r, 0.12)) def['required'] = true;
    fields[name] = def;
    kinds[name] = kind;
  }
  if (lines) {
    const someNumber = numbers()[0];
    fields['lines'] = {
      type: 'one2many',
      label: 'Lines',
      relation: 'lab.line',
      fields: {
        product: { type: 'char', label: 'Product', required: true },
        qty: { type: 'integer', label: 'Quantity' },
        price: { type: 'float', label: 'Price', digits: [12, 2] },
        sub: { type: 'float', label: 'Subtotal', digits: [12, 2], compute: 'qty * price' },
        big: { type: 'boolean', label: 'Big', setWhen: [{ when: 'qty > 3', value: 'True' }] },
        ...(someNumber ? { share: { type: 'float', label: 'Share', compute: `parent.${someNumber} * qty` } } : {}),
      },
    };
  }
  /** A condition over the page's fields. */
  const condition = (depth = 0): string => {
    const which = Math.floor(r() * (depth ? 8 : 10));
    const nums = numbers();
    const ticks = of('boolean');
    const choices = of('selection');
    const texts = [...of('char'), ...of('text')];
    switch (which) {
      case 0:
        return nums.length ? `${pick(r, nums)} > ${Math.floor(r() * 10)}` : 'editing';
      case 1:
        return ticks.length ? pick(r, ticks) : 'True';
      case 2:
        return ticks.length ? `not ${pick(r, ticks)}` : 'False';
      case 3:
        return choices.length ? `${pick(r, choices)} == '${pick(r, ['a', 'b', 'c'])}'` : 'editing';
      case 4:
        return texts.length ? `len(${pick(r, texts)}) > 2` : 'id';
      case 5:
        return 'editing';
      case 6:
        return lines ? `count(lines) > ${Math.floor(r() * 3)}` : 'not editing';
      case 7:
        return nums.length > 1 ? `${pick(r, nums)} <= ${pick(r, nums)}` : 'id == False';
      case 8:
        return `${condition(1)} and ${condition(1)}`;
      default:
        return `${condition(1)} or ${condition(1)}`;
    }
  };
  // Values worked out from others, and set as a condition starts to hold.
  for (const name of Object.keys(kinds)) {
    const kind = kinds[name];
    const nums = numbers().filter((one) => one !== name && !fields[one]['compute']);
    if (['integer', 'float', 'monetary'].includes(kind) && nums.length >= 2 && chance(r, 0.25)) {
      const [a, b] = [pick(r, nums), pick(r, nums)];
      const ticks = of('boolean');
      fields[name]['compute'] = pick(r, [`${a} * ${b}`, `${a} + ${b}`, ticks.length ? `if(${pick(r, ticks)}, ${a}, 0)` : `${a} - ${b}`, lines ? `sum(lines, 'sub')` : `${a} * 2`, `round(${a} / 3, 2)`]);
    } else if (kind !== 'date' && chance(r, 0.15)) {
      const value = kind === 'boolean' ? 'True' : kind === 'selection' ? "'c'" : kind === 'char' || kind === 'text' ? "'set'" : nums.length ? `${pick(r, nums)} + 1` : '7';
      fields[name]['setWhen'] = [{ when: condition(), value, ...(chance(r, 0.3) && nums.length ? { on: [pick(r, nums)] } : {}) }];
    }
  }
  const writable = Object.keys(kinds).filter((name) => !fields[name]['compute']);
  // The layout: sections of field nodes, some hidden, read-only or required by a condition, some with rules, tones and words.
  const names = [...Object.keys(kinds), ...(lines ? ['lines'] : [])];
  const sections: Record<string, unknown>[] = [];
  const nodes: string[] = ['root'];
  const count = 2 + Math.floor(r() * 3);
  for (let s = 0; s < count; s++) {
    const section: Record<string, unknown> = { type: 'section', id: `s${s}`, title: `Section ${s}`, columns: pick(r, [1, 2]), children: [] };
    if (chance(r, 0.15)) section['invisible'] = condition();
    if (chance(r, 0.1)) section['readonly'] = condition();
    sections.push(section);
    nodes.push(`s${s}`);
  }
  names.forEach((name, i) => {
    const node: Record<string, unknown> = { type: 'field', id: `n-${name}`, field: name };
    if (name !== 'lines') {
      if (chance(r, 0.2)) node['invisible'] = condition();
      if (chance(r, 0.1)) node['readonly'] = condition();
      if (chance(r, 0.1)) node['required'] = condition();
      const kind = kinds[name];
      if (kind === 'char' && chance(r, 0.15)) node['validate'] = [{ minLength: 3, level: 'warning' }, { endsWith: '.x', when: condition() }];
      if (['integer', 'float'].includes(kind) && chance(r, 0.15)) node['validate'] = [{ min: 2, when: condition() }, { max: 50, level: 'warning' }];
      const others = numbers().filter((one) => one !== name);
      if (['integer', 'float', 'monetary'].includes(kind) && others.length && chance(r, 0.12)) node['validate'] = [{ holds: `${name} <= ${pick(r, others)}`, message: 'Too much', level: pick(r, ['error', 'warning']) }];
      if (kind === 'date' && chance(r, 0.2)) node['validate'] = [{ date: pick(r, ['past', 'future']) }];
      if (kind === 'char' && chance(r, 0.1)) node['placeholderWhen'] = [{ when: condition(), text: 'Say more' }];
      if (chance(r, 0.1)) Object.assign(node, { tones: [{ tone: 'danger', when: condition() }], bold: condition() });
      if (kind === 'selection' && chance(r, 0.5)) node['widget'] = 'radio';
    }
    (sections[i % count]['children'] as unknown[]).push(node);
    nodes.push(`n-${name}`);
  });
  (sections[0]['children'] as unknown[]).push({ type: 'field', id: 'n-cur', field: 'cur' });
  nodes.push('n-cur');
  const page = { fieldia: '0.13', id: `random-${seed}`, title: `Random ${seed}`, data: { kind: 'record', model: 'lab.thing' }, fields, layout: { type: 'sections', id: 'root', children: sections } } as unknown as Page;
  return { page, kinds, writable, lines, nodes };
}

/** A value of a field's kind, at random. */
export function valueOf(r: Random, kind: Kind): Values[string] {
  if (chance(r, 0.1)) return null;
  switch (kind) {
    case 'char':
    case 'text':
      return pick(r, ['', 'ab', 'abc', 'hello.x', 'Nile', 'x']);
    case 'integer':
      return Math.floor(r() * 12) - 1;
    case 'float':
    case 'monetary':
      return Math.round(r() * 6000) / 100;
    case 'boolean':
      return chance(r, 0.5);
    case 'selection':
      return pick(r, ['a', 'b', 'c']);
    case 'date':
      return pick(r, ['2026-01-05', '2026-10-25', '2025-12-31']);
  }
}

