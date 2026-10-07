import type { Field, FieldNode } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * What changed in a structure's own settings from one version of a page to
 * the next, in words, for the Publish dialog: the records a link offers, a
 * table's totals and the columns people may hide. The widgets' settings —
 * a signature's pen, an address's parts — are "how it shows".
 */

interface Placed {
  field: Field;
  node: FieldNode;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function structureChanges(name: string, was: Placed, now: Placed, words: DesignerWords = en): string[] {
  const w = words.changes;
  const lines: string[] = [];
  const filterOf = (p: Placed) => (p.field.type === 'many2one' || p.field.type === 'many2many' ? p.field.filter : undefined);
  const filter = filterOf(now);
  if (!same(filterOf(was), filter)) {
    const one = filter?.length === 1 && 'op' in filter[0] && filter[0].op === '=' && filter[0].valueFrom === undefined ? filter[0] : null;
    lines.push(!filter ? w.offersEvery(name) : one ? w.offersWhere(name, one.field, JSON.stringify(one.value)) : w.offersChanged(name));
  }
  if (now.field.type === 'one2many') {
    const fields = now.field.fields;
    const labels = (names: string[]) => words.parts.commaList(names.map((n) => fields[n]?.label ?? n));
    if (!same(was.node.totals, now.node.totals)) lines.push(now.node.totals?.length ? w.addsUp(name, labels(now.node.totals)) : w.addsUpNothing(name));
    if (!same(was.node.optionalColumns, now.node.optionalColumns)) lines.push(w.optionalColumns(name));
    // tables lane: the table's own rules, buttons and shape, said once.
    const own = (p: Placed) => [p.node.cells, p.node.rowTones, p.node.rowBold, p.node.rowButtons, p.node.selectedButtons, p.node.controlButtons, p.node.lineOpens, p.node.cards, p.node.fit, p.node.options?.['copy']];
    if (!same(own(was), own(now))) lines.push(words.tables.tableChanged(name));
  }
  if (!same([was.node.tones, was.node.bold], [now.node.tones, now.node.bold])) lines.push(words.tables.toneChanged(name));
  return lines;
}
