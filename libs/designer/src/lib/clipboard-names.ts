import type { Field, FilterItem, Modifier } from '@fieldia/core';
import type { Part } from './layout-tree';

/**
 * The names of fields that rules and worked-out values read, for parts
 * pasted under new names: found, renamed, and — where one reads a field
 * the page it lands on has not got — left off, so the page stays whole.
 * An expression's strings, lists, words (and, or, not, in, True…) and the
 * functions it calls are never names.
 */

const WORDS = new Set(['and', 'or', 'not', 'in', 'True', 'False', 'None', 'true', 'false', 'null']);
/** A string or a list, kept as it is; or a name, the dotted path after it, and a bracket after it when it is a function. */
const PIECES = /('[^']*'|"[^"]*"|\[[^\]]*\])|(?<![\w.])([A-Za-z_]\w*)((?:\.\w+)*)(\s*\()?/g;

/** The fields an expression reads, by the first name of each path. */
export function namesIn(expression: string): Set<string> {
  const names = new Set<string>();
  for (const [, kept, name, , call] of expression.matchAll(PIECES)) if (!kept && !call && !WORDS.has(name)) names.add(name);
  return names;
}

/** The expression with the fields it reads renamed. */
export function renameIn(expression: string, names: ReadonlyMap<string, string>): string {
  return expression.replace(PIECES, (whole, kept: string | undefined, name: string, path: string, call: string | undefined) =>
    kept || call || WORDS.has(name) ? whole : `${names.get(name) ?? name}${path}`
  );
}

/**
 * Rename what the pasted parts and fields read, in place, and leave off each
 * rule that reads a field `known` says the page has not got. Returns how many
 * were left off.
 */
export function remapReferences(parts: Part[], fields: Record<string, Field>, names: ReadonlyMap<string, string>, known: (name: string) => boolean): number {
  let dropped = 0;
  /** An expression renamed, or undefined — and one more left off — when it reads a field not there. */
  const expression = (value: string): string | undefined => {
    const renamed = renameIn(value, names);
    if ([...namesIn(renamed)].every(known)) return renamed;
    dropped++;
    return undefined;
  };
  const name = (value: string): string | undefined => {
    const renamed = names.get(value) ?? value;
    if (known(renamed)) return renamed;
    dropped++;
    return undefined;
  };
  const modifiers = (owner: Record<string, unknown>, keys: string[]) => {
    for (const key of keys) {
      const value = owner[key] as Modifier | undefined;
      if (typeof value !== 'string') continue;
      const renamed = expression(value);
      if (renamed === undefined) delete owner[key];
      else owner[key] = renamed;
    }
  };

  const walk = (part: Part) => {
    const node = part as unknown as Record<string, unknown>;
    modifiers(node, ['invisible', 'readonly', 'required', 'bold']);
    // A value's tones, each read on the record: one whose condition reads a field that is gone goes.
    if (Array.isArray(node['tones'])) {
      const tones = (node['tones'] as Record<string, unknown>[]).filter((tone) => {
        if (typeof tone['when'] !== 'string') return true;
        const renamed = expression(tone['when'] as string);
        if (renamed !== undefined) tone['when'] = renamed;
        return renamed !== undefined;
      });
      if (tones.length) node['tones'] = tones;
      else delete node['tones'];
    }
    if (Array.isArray(node['validate'])) {
      const rules = (node['validate'] as Record<string, unknown>[]).filter((rule) => {
        if (typeof rule['when'] !== 'string') return true;
        const renamed = expression(rule['when'] as string);
        if (renamed !== undefined) rule['when'] = renamed;
        return renamed !== undefined;
      });
      if (rules.length) node['validate'] = rules;
      else delete node['validate'];
    }
    // An option of a field's widget whose name ends in “Field” names a field.
    const options = node['options'] as Record<string, unknown> | undefined;
    for (const [key, value] of Object.entries(options ?? {})) {
      if (!key.endsWith('Field') || typeof value !== 'string') continue;
      const renamed = name(value);
      if (renamed === undefined) delete (options as Record<string, unknown>)[key];
      else (options as Record<string, unknown>)[key] = renamed;
    }
    for (const child of (node['children'] as Part[] | undefined) ?? []) walk(child);
  };
  parts.forEach(walk);

  for (const def of Object.values(fields)) {
    const field = def as Record<string, unknown>;
    modifiers(field, ['compute']);
    if (def.setWhen) {
      const kept = def.setWhen.filter((item) => {
        const when = item.when === undefined ? null : expression(item.when);
        const value = when === undefined ? undefined : expression(item.value);
        // The fields a rule is on, renamed with the rest; one that is gone takes the rule with it.
        const on = item.on?.map(name);
        if (when === undefined || value === undefined || on?.includes(undefined)) return false;
        Object.assign(item, { ...(when === null ? {} : { when }), value, ...(on ? { on } : {}) });
        return true;
      });
      if (kept.length) def.setWhen = kept;
      else delete def.setWhen;
    }
    if (def.type === 'monetary' && def.currencyField !== undefined) {
      const renamed = name(def.currencyField);
      if (renamed === undefined) delete def.currencyField;
      else def.currencyField = renamed;
    }
    if ((def.type === 'many2one' || def.type === 'many2many') && def.filter) {
      const conditions = (items: FilterItem[]): FilterItem[] =>
        items.flatMap((item): FilterItem[] => {
          // A group left with no condition goes too.
          if ('any' in item) return ((any) => (any.length ? [{ any }] : []))(conditions(item.any));
          if ('all' in item) return ((all) => (all.length ? [{ all }] : []))(conditions(item.all));
          if (item.valueFrom === undefined) return [item];
          const renamed = name(item.valueFrom);
          return renamed === undefined ? [] : [{ ...item, valueFrom: renamed }];
        });
      const kept = conditions(def.filter);
      if (kept.length) def.filter = kept;
      else delete def.filter;
    }
    if (def.type === 'selection' && def.optionsFrom?.dependsOn) {
      const kept = def.optionsFrom.dependsOn.map(name).filter((n): n is string => n !== undefined);
      if (kept.length) def.optionsFrom.dependsOn = kept;
      else delete def.optionsFrom.dependsOn;
    }
  }
  return dropped;
}
