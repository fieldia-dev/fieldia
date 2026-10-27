import type { FilterCondition, FilterItem } from './field';
import type { JsonValue } from './json';
import type { ListFilter } from './layout';

/** Something a search view says that Fieldia's search does not, and why: `at`, the filter's name. */
export interface SearchViewNote {
  at: string;
  words: string;
}

/** A search view read as a list's search: its named filters, its Group By, the fields its box searches, and what was left out. */
export interface SearchViewFilters {
  filters: ListFilter[];
  groupBy: string[];
  searchFields: string[];
  notes: SearchViewNote[];
}

/** The operators a filter's condition takes, as Odoo's domains write them. */
const OPS = new Set<string>(['=', '!=', '<', '>', '<=', '>=', 'in', 'not in', 'like', 'ilike', '=?']);
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const unescape = (text: string) => text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (all, name: string) => (name[0] === '#' ? String.fromCodePoint(Number(name[1] === 'x' || name[1] === 'X' ? `0${name.slice(1)}` : name.slice(1))) : (ENTITIES[name] ?? all)));

/** Each element's tag, its attributes and whether it closes, in order: what a search view's few elements need. */
function tagsOf(xml: string): { name: string; attrs: Record<string, string>; end: boolean; selfClosing: boolean }[] {
  const tags = [];
  const text = xml.replace(/<!--[\s\S]*?-->/g, '').replace(/<\?[\s\S]*?\?>/g, '');
  for (const [, end, name, body, self] of text.matchAll(/<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g)) {
    const attrs: Record<string, string> = {};
    for (const [, key, double, single] of body.matchAll(/([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) attrs[key] = unescape(double ?? single);
    tags.push({ name, attrs, end: end === '/', selfClosing: self === '/' });
  }
  return tags;
}

/** The first name a domain reads that is no value written in it — `uid`, `time.strftime(…)` — outside its words; or null. */
function readsAtRun(domain: string): string | null {
  const bare = domain.replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"/g, '""');
  for (const [name, dotted, call] of bare.matchAll(/\b([A-Za-z_][\w]*(?:\.[A-Za-z_]\w*)*)\s*(\()?/g)) {
    if (!['True', 'False', 'None'].includes(dotted)) return `${dotted}${call ? '(…)' : ''}`.trim() || name;
  }
  return null;
}

/** A domain's Python literal as JSON: lists and tuples, words, numbers, True, False and None; anything else refused. */
function literal(source: string): JsonValue {
  let at = 0;
  const skip = () => {
    while (/\s/.test(source[at] ?? '')) at++;
  };
  const value = (): JsonValue => {
    skip();
    const char = source[at];
    if (char === '[' || char === '(') {
      const close = char === '[' ? ']' : ')';
      at++;
      const items: JsonValue[] = [];
      for (;;) {
        skip();
        if (source[at] === close) break;
        items.push(value());
        skip();
        if (source[at] === ',') at++;
        else if (source[at] !== close) throw new Error('unreadable');
      }
      at++;
      return items;
    }
    if (char === "'" || char === '"') {
      let words = '';
      for (at++; source[at] !== char; at++) {
        if (at >= source.length) throw new Error('unreadable');
        words += source[at] === '\\' ? source[++at] : source[at];
      }
      at++;
      return words;
    }
    const number = /^-?\d+(\.\d+)?/.exec(source.slice(at));
    if (number) {
      at += number[0].length;
      return Number(number[0]);
    }
    const word = /^(True|False|None)\b/.exec(source.slice(at));
    if (!word) throw new Error('unreadable');
    at += word[0].length;
    return word[0] === 'True' ? true : word[0] === 'False' ? false : null;
  };
  const read = value();
  skip();
  if (at !== source.length) throw new Error('unreadable');
  return read;
}

/** Why a domain's term is no filter of Fieldia's, said by `refuse`. */
class Unsaid extends Error {}

/** A domain — Polish notation: `|` and `&` before their two terms, the rest all holding — as a filter's items. */
function domainItems(domain: JsonValue[]): FilterItem[] {
  let at = 0;
  const term = (): FilterItem => {
    const one = domain[at++];
    if (one === '|' || one === '&') {
      const [a, b] = [term(), term()];
      const kind = one === '|' ? 'any' : 'all';
      const parts = (item: FilterItem) => (kind in item ? (item as Record<string, FilterItem[]>)[kind] : [item]);
      return { [kind]: [...parts(a), ...parts(b)] } as FilterItem;
    }
    if (one === '!') throw new Unsaid('a filter of Fieldia’s has no “not” (!): write the opposite condition');
    if (!Array.isArray(one) || one.length !== 3 || typeof one[0] !== 'string' || typeof one[1] !== 'string') throw new Error('unreadable');
    const [field, op, value] = one as [string, string, JsonValue];
    const said = op === '==' ? '=' : op;
    // A link, a date or a text not set: Odoo writes it `= False`.
    if ((said === '=' || said === '!=') && (value === false || value === null)) return { field, op: said === '=' ? 'notset' : 'set' };
    if (!OPS.has(said)) throw new Unsaid(`its domain compares with ${op}, which a filter of Fieldia’s does not`);
    return { field, op: said as FilterCondition['op'], value };
  };
  const items: FilterItem[] = [];
  while (at < domain.length) items.push(term());
  return items;
}

/**
 * An Odoo (or Flectra) search view's `<search>` read as a list's search, for a page made from an Odoo screen: each
 * `<filter>` with a domain a named filter (its `name` its id, its `string` its words, its domain its conditions), each
 * `<separator/>` between them starting a new group (`group`, named by its first filter: "or" within, "and" between,
 * as Odoo's menu has them — none where the view has no separator, so they are any of them, as Odoo reads them), each
 * `group_by` filter a field of Group By, each `<field>` a field the box searches. What a filter of Fieldia's cannot say
 * — a domain worked out on the server (`uid`, today's date), a "not", an operator of its own, a date's own periods, a
 * filter not shown — is left out and said in `notes`.
 */
export function searchViewFilters(arch: string): SearchViewFilters {
  const tags = tagsOf(arch);
  if (tags[0]?.name !== 'search' || tags[0].end) throw new Error('a search view is a <search> element: its filters, separators, fields and Group By');
  const runs: ListFilter[][] = [[]];
  const groupBy: string[] = [];
  const searchFields: string[] = [];
  const notes: SearchViewNote[] = [];
  let depth = 0;
  for (const tag of tags.slice(1)) {
    if (tag.name === 'group') {
      if (!tag.selfClosing) depth += tag.end ? -1 : 1;
      continue;
    }
    if (tag.end) continue;
    if (tag.name === 'field' && depth === 0 && tag.attrs['name']) searchFields.push(tag.attrs['name']);
    if (tag.name === 'separator' && depth === 0) runs.push([]);
    if (tag.name !== 'filter') continue;
    const { name = '', string: label = name, domain, context = '', date } = tag.attrs;
    const grouped = /['"]group_by['"]\s*:\s*['"]([\w.]+)/.exec(context)?.[1];
    if (grouped) {
      if (!groupBy.includes(grouped)) groupBy.push(grouped);
      continue;
    }
    const leave = (words: string) => notes.push({ at: name, words: `${label} is left out: ${words}` });
    if (tag.attrs['invisible'] === '1' || tag.attrs['invisible'] === 'True') leave('it is not shown in the menu (invisible)');
    else if (date) leave(`a date’s own periods (date="${date}") are named filters of their own: write each as a period, { "field": "${date}", "is": "thisMonth" }`);
    else if (domain === undefined) continue;
    else {
      const reads = readsAtRun(domain);
      // A date before today's: Fieldia's own period says it, counted on the reader's clock.
      const late = /\(\s*['"]([\w.]+)['"]\s*,\s*['"]<['"]\s*,\s*(?:time\.strftime|context_today|fields\.Date\.(?:today|context_today))/.exec(domain)?.[1];
      if (reads) leave(`its domain reads ${reads}, worked out on the server${late ? ` (write it as a period: { "field": "${late}", "is": "overdue" })` : ''}`);
      else {
        try {
          const read = literal(domain.trim());
          if (!Array.isArray(read)) throw new Error('unreadable');
          const filter = domainItems(read);
          if (!filter.length) throw new Error('unreadable');
          runs[runs.length - 1].push({ id: name, label, filter });
        } catch (error) {
          leave(error instanceof Unsaid ? error.message : 'its domain cannot be read');
        }
      }
    }
  }
  const kept = runs.filter((run) => run.length);
  // A group per run between separators, named by its first filter; none where there is one run, as Odoo reads one.
  const filters = kept.length > 1 ? kept.flatMap((run) => run.map((filter) => ({ ...filter, group: run[0].id }))) : (kept[0] ?? []);
  return { filters, groupBy: groupBy.map((field) => field.split(':')[0]), searchFields, notes };
}
