import type { Field, LineField } from './field';

/**
 * What a field says it may hold, held to itself (the audit's R-M5: what `validatePage` passed and a form then could not
 * take): its least no more than its most, its first value one it could hold — of its kind, inside its bounds, one of
 * its choices — and each choice's value once. A page with any of these can never be filled in as written: a form that
 * refuses every value, opens refusing its own default, or shows two choices that send the same. Both checks run these
 * (references.ts), so the viewer refuses them as `validatePage` does.
 */
export function checkSense(def: Field | LineField, path: string, report: (path: string, message: string) => void): void {
  const own = def as { type: string; min?: unknown; max?: unknown; default?: unknown; multiple?: boolean; other?: boolean; ownAnswers?: boolean; options?: { value?: unknown }[]; optionsFrom?: unknown; translate?: unknown; precision?: unknown };
  const number = own.type === 'integer' || own.type === 'float' || own.type === 'monetary';
  const min = typeof own.min === 'number' ? own.min : undefined;
  const max = typeof own.max === 'number' ? own.max : undefined;
  if (number && min !== undefined && max !== undefined && min > max) report(`${path}.min`, `the least (${min}) is more than the most (${max}): no value could be given`);
  // Each choice's value once: two that send the same are one choice twice.
  if (own.type === 'selection' && Array.isArray(own.options)) {
    const seen = new Set<string>();
    own.options.forEach((option, i) => {
      // An option that is no object is the shape's to refuse.
      if (!option || typeof option !== 'object' || option.value === undefined) return;
      const value = JSON.stringify(option.value);
      if (seen.has(value)) report(`${path}.options[${i}].value`, `${value} is the value of an option before it: each option's value once`);
      seen.add(value);
    });
  }
  if (own.default === undefined || own.default === null) return;
  const first = own.default;
  const at = `${path}.default`;
  const said = JSON.stringify(first);
  if (number) {
    if (typeof first !== 'number' || (own.type === 'integer' && !Number.isInteger(first))) return report(at, `${said} is not ${own.type === 'integer' ? 'a whole number' : 'a number'}: a${own.type === 'integer' ? 'n' : ''} ${own.type} field's first value is one, written as a number`);
    if ((min !== undefined && first < min) || (max !== undefined && first > max)) return report(at, `${said} is outside the field's own bounds (${min ?? '…'} to ${max ?? '…'}): its first value could never be sent`);
  }
  if (own.type === 'boolean' && typeof first !== 'boolean') return report(at, `${said} is not true or false: a yes-or-no field's first value is one of them`);
  if ((own.type === 'char' || own.type === 'text' || own.type === 'html') && typeof first !== 'string' && !(own.translate !== undefined && typeof first === 'object' && !Array.isArray(first))) {
    return report(at, `${said} is not words: a text field's first value is written in quotes`);
  }
  if (own.type === 'date' && !(typeof first === 'string' && /^(today([+-]\d{1,4})?|\d{4}-\d{2}-\d{2})$/.test(first))) {
    return report(at, `${said} is not a day: a date's first value is "YYYY-MM-DD", "today", or a day counted from it ("today+1")`);
  }
  // A choice's first value among the choices the page writes — unless an answer of one's own may be typed.
  if (own.type === 'selection' && Array.isArray(own.options) && own.options.length && own.optionsFrom === undefined && !own.other && !own.ownAnswers) {
    const values = new Set(own.options.filter((option) => option && typeof option === 'object').map((option) => JSON.stringify(option.value ?? null)));
    const given = own.multiple ? (Array.isArray(first) ? first : [first]) : [first];
    if (own.multiple && !Array.isArray(first)) return report(at, `${said} is one value: a choice of several starts with a list of them, as [${said}]`);
    const unknown = given.find((value) => !values.has(JSON.stringify(value)));
    if (unknown !== undefined) report(at, `${JSON.stringify(unknown)} is not one of the field's options: its first value is one of ${[...values].join(', ')}`);
  }
}

/**
 * Fields marked required that no part of the page shows (every one naming it hidden by `invisible: true`, or none at
 * all): the form checks only what it shows, so nothing ever asks for them — said where pages are made, as warnings,
 * never refusals (a record's page may carry a field the app always fills). One worked out, given a first value, set by
 * a rule or by a link is left alone.
 */
export function unseenRequired(page: { fields?: unknown; layout?: unknown; prefill?: unknown }): { path: string; message: string }[] {
  const fields = (page.fields ?? {}) as Record<string, { required?: unknown; compute?: unknown; default?: unknown; defaultFrom?: unknown; setWhen?: unknown }>;
  const layout = page.layout as { type?: string } | undefined;
  if (!layout || layout.type === 'list') return [];
  const shown = new Set<string>();
  const walk = (value: unknown) => {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== 'object') return;
    const part = value as Record<string, unknown>;
    if (part['invisible'] === true) return;
    if (typeof part['field'] === 'string') shown.add(part['field']);
    for (const inner of Object.values(part)) walk(inner);
  };
  walk(layout);
  // A field the link fills (`prefill`) is a hidden field: sent all the same.
  const from = (page.prefill as { fromUrl?: unknown } | undefined)?.fromUrl;
  const linked = new Set((Array.isArray(from) ? from : []).map((param) => (typeof param === 'string' ? param : (param as { field?: string } | null)?.field)));
  const found: { path: string; message: string }[] = [];
  for (const [name, def] of Object.entries(fields)) {
    if (def?.required !== true || shown.has(name) || linked.has(name)) continue;
    if (def.compute !== undefined || def.default !== undefined || def.defaultFrom !== undefined || def.setWhen !== undefined) continue;
    found.push({ path: `fields.${name}.required`, message: `"${name}" is required, but no part of the page shows it: the form only asks for what it shows — place it, or leave required out` });
  }
  return found;
}
