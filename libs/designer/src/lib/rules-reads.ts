import type { Page } from '@fieldia/core';
import { shownFields } from './page-tree';
import { fieldsReadBy } from './rules-formula';

/**
 * Which fields the page's rules read: its conditions (when a part shows, is
 * required or read-only), its values worked out and set, when its answer
 * rules hold, and its rules across fields. A field a rule still reads keeps
 * its definition when it is taken off the page, so the rule can be seen and
 * put right — a check names it — and goes once nothing reads it.
 */

const CONDITIONS = ['invisible', 'required', 'readonly', 'when', 'holds'];

/** The fields every rule on the page reads. */
export function fieldsRulesRead(page: Page): Set<string> {
  const read = new Set<string>();
  const add = (source: unknown) => {
    for (const name of fieldsReadBy(typeof source === 'string' ? source : undefined)) read.add(name);
  };
  for (const def of Object.values(page.fields)) {
    add(def.compute);
    for (const item of def.setWhen ?? []) {
      add(item.when);
      add(item.value);
    }
  }
  // Every condition anywhere in the layout: on parts, a sheet's header, answer rules.
  const walk = (value: unknown): void => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    for (const [key, inner] of Object.entries(value)) {
      if (CONDITIONS.includes(key) && typeof inner === 'string') add(inner);
      else walk(inner);
    }
  };
  walk(page.layout);
  return read;
}

/** Whether another field's definition names this one, as an amount names its currency's field. */
const namedElsewhere = (page: Page, name: string) => Object.entries(page.fields).some(([other, def]) => other !== name && JSON.stringify(def).includes(`"${name}"`));

/**
 * After an edit: a field it took away that a rule still reads keeps its
 * definition; one no longer shown that only a rule kept, and that no rule
 * reads now, goes.
 */
export function keepWhatRulesRead(before: Page, draft: Page): void {
  const shown = shownFields(draft);
  let read = fieldsRulesRead(draft);
  // A field kept may be worked out from others in its turn: keep what it reads too.
  for (let grew = true; grew; ) {
    grew = false;
    for (const name of read) {
      if (draft.fields[name] || !before.fields[name]) continue;
      draft.fields[name] = before.fields[name];
      grew = true;
    }
    if (grew) read = fieldsRulesRead(draft);
  }
  // Kept only for a rule before, read by none now: it goes.
  const [wasRead, wasShown] = [fieldsRulesRead(before), shownFields(before)];
  for (const name of Object.keys(draft.fields)) {
    if (shown.has(name) || read.has(name) || !wasRead.has(name) || wasShown.has(name) || namedElsewhere(draft, name)) continue;
    delete draft.fields[name];
  }
}
