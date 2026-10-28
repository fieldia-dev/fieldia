import type { Field } from '../format/field';
import type { Page } from '../format/page';
import { checkValue } from './check';
import type { FormInner, FormJoin } from './joins';
import { structuredCopy, type Value, type Values } from './values';

/**
 * The link a page is opened with: its whole address, or only its `?…` part (`location.href`, `location.search`) — or
 * its parameters by name, as an app read them itself.
 */
export type PageLink = string | Readonly<Record<string, string>>;

/** A part of a link as written, `+` and `%xx` read: a part that does not decode is kept as written. */
const decoded = (text: string): string => {
  try {
    return decodeURIComponent(text.replace(/\+/g, ' '));
  } catch {
    return text;
  }
};

/** A link's parameters by name, the first of each as written there, decoded; none for a link without them. */
export function linkParams(link: PageLink): Map<string, string> {
  const params = new Map<string, string>();
  if (typeof link !== 'string') {
    for (const [name, value] of Object.entries(link)) if (typeof value === 'string') params.set(name, value);
    return params;
  }
  const query = (link.includes('?') ? link.slice(link.indexOf('?') + 1) : link.includes('=') ? link : '').split('#')[0];
  for (const pair of query.split('&')) {
    const at = pair.indexOf('=');
    const name = decoded(at < 0 ? pair : pair.slice(0, at));
    if (name && !params.has(name)) params.set(name, decoded(at < 0 ? '' : pair.slice(at + 1)));
  }
  return params;
}

/** The most a link's words fill a line of text with: longer is no campaign's, broker's or unit's name, and is left out. */
const MOST = 500;

/**
 * A parameter's words as its field holds a value — a number as a number, yes or no, a choice by one of its options'
 * values, a day as 2026-10-20, a day and time as an instant — or undefined where they do not read so: never guessed.
 */
export function linkValue(field: Field, text: string): Value | undefined {
  const words = text.trim();
  if (!words) return undefined;
  switch (field.type) {
    case 'char':
    case 'text':
      return words.length <= MOST ? words : undefined;
    case 'integer':
      return /^-?\d{1,15}$/.test(words) ? Number(words) : undefined;
    case 'float':
    case 'monetary':
      return /^-?\d{1,15}(\.\d+)?$/.test(words) ? Number(words) : undefined;
    case 'boolean':
      return /^(1|true|yes|on)$/i.test(words) ? true : /^(0|false|no|off)$/i.test(words) ? false : undefined;
    case 'selection':
      return field.options?.find((option) => String(option.value) === words)?.value;
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(words) && !Number.isNaN(Date.parse(words)) && new Date(Date.parse(words)).toISOString().startsWith(words) ? words : undefined;
    case 'datetime':
      // An instant with its offset, or in UTC: a day and time alone names no moment.
      return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(words) && !Number.isNaN(Date.parse(words)) ? new Date(Date.parse(words)).toISOString() : undefined;
    default:
      return undefined;
  }
}

/** The fields a page's link fills (`prefill.fromUrl`), each by the parameter that fills it. */
export function prefilledFields(page: Page): Map<string, string> {
  const filled = new Map<string, string>();
  for (const one of page.prefill?.fromUrl ?? []) {
    const [param, field] = typeof one === 'string' ? [one, one] : [one.param, one.field];
    if (!filled.has(field)) filled.set(field, param);
  }
  return filled;
}

/**
 * What a page's link fills as the form starts (`prefill`): each field named, by its parameter's words read as the
 * field reads them — left out where they do not read so, or where the field's own checks (its most characters, its
 * pattern, its least and most, its days) would refuse them: a hidden field no one can put right never stops a send.
 */
export function linkValues(page: Page, link: PageLink | undefined): Values {
  return linkValuesOn(page, link);
}

/** The same, a field's limits of "today" counted from `today` — a form's, by its clock — else the computer's. */
function linkValuesOn(page: Page, link: PageLink | undefined, today?: string): Values {
  const values: Values = {};
  if (!page.prefill || link === undefined) return values;
  const params = linkParams(link);
  for (const [name, param] of prefilledFields(page)) {
    const field = page.fields[name];
    const text = params.get(param);
    if (!field || text === undefined) continue;
    const value = linkValue(field, text);
    if (value !== undefined && checkValue(field, value, false, undefined, today) === undefined) values[name] = value;
  }
  return values;
}

/**
 * The prefill part's side of a form (`prefill` on its page, joins.ts): the fields the link fills laid where a new record
 * or response starts — as loaded ones are, never a change to save, never over what the form was given (`values`) or
 * what the person changed — and laid again as another starts; the hidden ones, placed nowhere and seen by no one, sent
 * with the answers all the same. The link is the form's `url`, else the page's own address.
 */
export function join(host: FormInner): FormJoin {
  const { form, page, options } = host;
  const placed = new Set((JSON.stringify(page.layout).match(/"field":"[^"]+"/g) ?? []).map((one) => one.slice(9, -1)));
  const lay = () => {
    const state = form.getState();
    if (state.recordId != null) return;
    const link = linkValuesOn(page, options.url ?? (globalThis as { location?: { href: string } }).location?.href, form.today());
    for (const name of Object.keys(link)) if (state.dirty.includes(name) || (options.values && name in options.values)) delete link[name];
    form.setValues(link, { stored: true });
  };
  lay();
  return {
    reset: lay,
    // In the answers themselves: what the response is sent with is what its ending reads, what the form tells, and what
    // an app's checkout is handed before it goes.
    values(answers) {
      const values = form.getState().values;
      for (const name of prefilledFields(page).keys()) if (!placed.has(name) && !(name in answers)) answers[name] = structuredCopy(values[name] ?? null);
    },
  };
}
