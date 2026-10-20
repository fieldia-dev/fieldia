import type { Field, LineField, SelectionOption } from './field';
import { optionsField } from './choice-options';
import type { FieldTools } from './part-checks';
import type { Scope } from './references';

/**
 * A choice's options by condition and carried from an earlier question: each condition on one reads the record — a
 * line's, its line and `parent.` (`options[].invisible`) — and the earlier question it carries them from
 * (`optionsFrom.field`) is another choice of the page, never one carrying its own from this one, and never for a line,
 * whose choices are its own or one of the app's lists. In the one-tag script they come with the options part, which a
 * page with any asks for, run once it came (later-checks.ts); the packages' checks run them at once.
 */
export interface OptionTools extends FieldTools {
  checkModifiers(owner: object, path: string, keys: readonly string[], scope: Scope): void;
}

/** Names quoted and joined as a person lists them: "a", "b" and "c". */
const listed = (names: string[]) => {
  const quoted = names.map((name) => `"${name}"`);
  return quoted.length < 2 ? quoted.join('') : `${quoted.slice(0, -1).join(', ')} and ${quoted[quoted.length - 1]}`;
};

export function checkOptionRules(name: string, def: Extract<Field | LineField, { type: 'selection' }>, path: string, fields: Record<string, Field | LineField>, scope: Scope, tools: OptionTools): void {
  (def.options as SelectionOption[]).forEach((option, i) => tools.checkModifiers(option, `${path}.options[${i}]`, ['invisible'], scope));
  const carried = optionsField(def.optionsFrom);
  if (!carried) return;
  const at = `${path}.optionsFrom.field`;
  if (scope.lines !== undefined) return tools.report(at, `"${name}": a line's choice carries no options from a question — its own, or one of the app's lists`);
  if (carried.field === name) return tools.report(at, `"${name}" cannot carry its options from itself`);
  const from = tools.need(carried.field, at, fields);
  if (!from) return;
  if (from.type !== 'selection') return tools.report(at, `"${carried.field}" is a ${from.type}; options are carried from a choice`);
  // Through the choices each carries from, never back to this one: a circle elsewhere is said at its own fields.
  const seen = [name];
  for (let next: Field | LineField | undefined = from, field = carried.field; next?.type === 'selection'; next = fields[field]) {
    if (field === name) return tools.report(at, `${listed(seen)} carry their options from each other`);
    if (seen.includes(field)) return;
    seen.push(field);
    const further = optionsField(next.optionsFrom);
    if (!further) return;
    field = further.field;
  }
}
