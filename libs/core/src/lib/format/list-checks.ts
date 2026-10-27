import type { ButtonNode, ListCard, ListNode, MapCard, Pin, RelatedNode, StatButton } from './layout';
import type { Field, FilterItem, LineField } from './field';
import type { Page } from './page';
import { BULK_KINDS, bulkSettable } from './bulk-edit';
import { IMPORT_KINDS, importable } from './import-fields';
import type { Scope } from './references';
import { checkListWork } from './list-rows-checks';

/**
 * The checks of a list page's own settings (`layout.type: "list"`): its filters, buttons, calendar, timeline, map, filter bar,
 * rows' cards and rules, Edit and Import — the reference check hands over its own tools, so what is said reads as the
 * rest of its findings — and a related list's, which the list part draws too: what it shares with a list, its columns,
 * order, search, cells and card.
 * In the one-tag script they come with the list part, which draws what they check: a list page's are run once it came,
 * before the page is drawn (later-checks.ts); the packages' `checkPage` and `validatePage` run them at once.
 */
export interface ListTools {
  readonly page: Page;
  need(name: string, path: string, scope?: Record<string, Field | LineField>): Field | LineField | undefined;
  report(path: string, message: string): void;
  claim(id: string, path: string): void;
  checkModifiers(owner: object, path: string, keys?: readonly string[], scope?: Scope): void;
  checkPress(button: ButtonNode | StatButton, path: string): void;
  checkPlace(at: { point?: string; latitude?: string; longitude?: string }, path: string, scope: Scope, pin?: Pin, card?: MapCard): void;
  /** Where the page's own expressions read. */
  here(): Scope;
  /** Whether the page checked is a table's line's own form. */
  readonly onLine: boolean;
  /** A money field's currency: a field beside it, or on a line `parent.` and a field of the record. */
  checkCurrency(name: string, path: string, fields: Record<string, Field | LineField>, lines: string | undefined, parent?: Record<string, Field | LineField>): void;
  /** A time zone the browser knows. */
  checkZone(zone: unknown, path: string): void;
  /** A filter's conditions, each valueFrom one that reads. */
  checkFilterItem(item: FilterItem, at: string, scope: Scope): void;
  /** Said where checks come in a part that has not come (the one-tag script's: later-checks.ts): they are owed. */
  owe(part: string): void;
  /** The whole check (`CheckOptions.sense`): a list's columns each once besides — what 0.35's viewer drew twice. */
  readonly whole?: boolean;
}

/** The kinds of field a list's filter bar can list the values of. */
const LISTS_ITS_VALUES = new Set(['selection', 'many2one', 'many2many', 'boolean', 'char', 'integer']);
/** The kinds of field a list's filter bar filters by their range, From and To: a whole number where the page says so. */
const HAS_A_RANGE: ReadonlySet<string> = new Set(['integer', 'float', 'monetary', 'date', 'datetime']);
/** The kinds whose range is all a filter can take of them: no list of their values. */
const RANGE_ONLY: ReadonlySet<string> = new Set(['float', 'monetary', 'date', 'datetime']);
/** What a calendar's start and end can be: a day, or a day and a time. */
const CALENDAR_TIMES: ReadonlySet<string> = new Set(['date', 'datetime']);
/** What a record's words on a calendar can be. */
const CALENDAR_WORDS: ReadonlySet<string> = new Set(['char', 'text', 'selection', 'many2one', 'integer', 'float', 'monetary', 'date', 'datetime']);
/** What a calendar's columns come from: a value that repeats. */
const CALENDAR_COLUMNS: ReadonlySet<string> = new Set(['many2one', 'selection', 'char', 'integer']);
/** What a record's colour comes from. */
const CALENDAR_COLOURS: ReadonlySet<string> = new Set(['many2one', 'selection', 'char', 'integer', 'boolean']);

export function checkList(list: ListNode, path: string, tools: ListTools): void {
  if (tools.page.data.kind !== 'record') tools.report('data', 'a list shows records: its data needs kind "record" and a model');
  checkListed(list, tools.page.fields, path, tools);
  list.groupBy?.forEach((name, i) => tools.need(name, `${path}.groupBy[${i}]`));
  // A list's filters are about its own records: their fields are the page's, and there is no record to take a value from.
  const walk = (item: FilterItem, at: string): void => {
    if ('any' in item) return item.any.forEach((inner, i) => walk(inner, `${at}.any[${i}]`));
    if ('all' in item) return item.all.forEach((inner, i) => walk(inner, `${at}.all[${i}]`));
    tools.need(item.field, `${at}.field`);
    if (item.valueFrom !== undefined) tools.report(`${at}.valueFrom`, "a list's filter compares with values, not with another field");
  };
  const named = new Set<string>();
  list.filters?.forEach((filter, i) => {
    tools.claim(filter.id, `${path}.filters[${i}]`);
    named.add(filter.id);
    filter.filter?.forEach((item, j) => walk(item, `${path}.filters[${i}].filter[${j}]`));
    // A period is of a date, or a date and time.
    const dated = filter.period ? tools.need(filter.period.field, `${path}.filters[${i}].period.field`) : undefined;
    if (dated && dated.type !== 'date' && dated.type !== 'datetime') tools.report(`${path}.filters[${i}].period.field`, `"${filter.period?.field}" is a ${dated.type}; a period is of a date, or a date and time`);
  });
  list.defaultFilters?.forEach((id, i) => {
    if (!named.has(id)) tools.report(`${path}.defaultFilters[${i}]`, `no filter "${id}" in this list`);
  });
  list.actions?.forEach((button, i) => {
    tools.claim(button.id, `${path}.actions[${i}]`);
    tools.checkPress(button, `${path}.actions[${i}]`);
  });
  if (list.map) checkListMap(list.map, `${path}.map`, tools);
  if (list.calendar) checkListCalendar(list, `${path}.calendar`, tools);
  if (list.gantt) checkListGantt(list, `${path}.gantt`, tools);
  checkListCells(list, path, tools);
  checkListRows(list, path, tools);
  // Its rows a person works in: opened in place (list-rows-checks.ts).
  checkListWork(list, path, tools, checkListed);
}

/**
 * A list's cards, gallery, columns people choose and rows' own rules: a
 * card's fields the page's, its picture one that can hold a picture; the
 * optional columns among the columns; a row's tones, bold and buttons
 * reading the list's record (its fields, `id`, `user`); and the list
 * opening on one thing.
 */
function checkListRows(list: ListNode, path: string, tools: ListTools): void {
  if (list.card) checkListCard(list.card, `${path}.card`, tools.page.fields, tools);
  for (const column of Object.keys(list.optionalColumns ?? {})) {
    if (!list.columns.includes(column)) tools.report(`${path}.optionalColumns.${column}`, `"${column}" is no column of this list: a person shows or hides its columns`);
  }
  // A column a person may hide, every one hidden at first: the list would open with no column but its own.
  if (list.optionalColumns && list.columns.every((column) => list.optionalColumns?.[column] === 'hide')) tools.report(`${path}.optionalColumns`, 'every column starts hidden: show one at least, as the list opens');
  if (list.gallery?.opens === 'gallery') {
    if (list.map?.view && list.map.view !== 'list') tools.report(`${path}.gallery.opens`, 'the list opens on its map (map.view) and on its gallery: say one');
    if (list.calendar?.opens === 'calendar') tools.report(`${path}.gallery.opens`, 'the list opens on its calendar and on its gallery: say one');
    if (list.gantt?.opens === 'gantt') tools.report(`${path}.gallery.opens`, 'the list opens on its timeline and on its gallery: say one');
  }
  list.rowTones?.forEach((tone, i) => tools.checkModifiers(tone, `${path}.rowTones[${i}]`, ['when']));
  tools.checkModifiers(list, path, ['rowBold']);
  list.rowButtons?.forEach((button, i) => {
    tools.claim(button.id, `${path}.rowButtons[${i}]`);
    tools.checkPress(button, `${path}.rowButtons[${i}]`);
    // Shown by a condition on each row's record.
    tools.checkModifiers(button, `${path}.rowButtons[${i}]`, ['invisible']);
  });
}

/** A field a list's calendar or timeline names, of a kind that can be it; its definition, as checked. */
const typedIn = (path: string, tools: ListTools) => (name: string | undefined, key: string, ok: ReadonlySet<string>, says: string) => {
  if (name === undefined) return undefined;
  const def = tools.need(name, `${path}.${key}`);
  if (def && !ok.has(def.type)) tools.report(`${path}.${key}`, `"${name}" is a ${def.type}; ${says}`);
  return def;
};

/**
 * What a calendar and a timeline share: a start (a date, or a date and time) and an end of the same kind, each named
 * as `whose` (a calendar's, a bar's); and its views or scales each offered once, the one it opens on among them.
 */
function checkTimes(spec: { start: string; end?: string }, whose: string, path: string, tools: ListTools, offered: readonly string[], shown: string | undefined, keys: [string, string, string]): void {
  const typed = typedIn(path, tools);
  const start = typed(spec.start, 'start', CALENDAR_TIMES, `${whose} start is a date, or a date and time`);
  const end = typed(spec.end, 'end', CALENDAR_TIMES, `${whose} end is a date, or a date and time`);
  if (start && end && CALENDAR_TIMES.has(start.type) && CALENDAR_TIMES.has(end.type) && start.type !== end.type) {
    tools.report(`${path}.end`, `"${spec.end}" is a ${end.type}; an end is the same kind of field as its start, a ${start.type}`);
  }
  const [many, one, called] = keys;
  offered.forEach((item, i) => {
    if (offered.indexOf(item) !== i) tools.report(`${path}.${many}[${i}]`, `"${item}" is offered twice`);
  });
  if (shown && !offered.includes(shown)) tools.report(`${path}.${one}`, `"${shown}" is not one of its ${called} (${offered.join(', ')})`);
}

/** Said where a list opens on its map and on this, both. */
const mapAnd = (list: ListNode, path: string, tools: ListTools, what: string) => list.map?.view && list.map.view !== 'list' && tools.report(`${path}.opens`, `the list opens on its map (map.view) and on its ${what}: say one`);

/**
 * A list's calendar: when each record starts (a date, or a date and time)
 * and ends (the same kind), its words, its colour and its columns, each
 * from a field that can; the view it opens on is one it offers, its hours
 * run forward, and the list opens on one thing.
 */
function checkListCalendar(list: ListNode, path: string, tools: ListTools): void {
  const calendar = list.calendar as NonNullable<ListNode['calendar']>;
  const typed = typedIn(path, tools);
  checkTimes(calendar, "a calendar's", path, tools, calendar.views ?? ['day', 'week', 'month', 'agenda'], calendar.view, ['views', 'view', 'views']);
  typed(calendar.title, 'title', CALENDAR_WORDS, "a record's words on a calendar are a field that can be said");
  typed(calendar.colour, 'colour', CALENDAR_COLOURS, 'a colour comes from a link, a choice, text, a whole number or a yes or no');
  typed(calendar.resource, 'resource', CALENDAR_COLUMNS, 'a column for each comes from a link, a choice, text or a whole number');
  if (calendar.hours && calendar.hours.end <= calendar.hours.start) tools.report(`${path}.hours`, `the hours end at ${calendar.hours.end}, before they start at ${calendar.hours.start}`);
  if (calendar.opens === 'calendar') mapAnd(list, path, tools, 'calendar');
}

/**
 * A list's Gantt timeline: when each record starts (a date, or a date and time) and ends (the same kind) or how many
 * days it lasts (a number) — one or the other —, its words, its group and its colour, each from a field that can; the
 * records it waits for, a many2many of the list's own records; the scale it opens on is one it offers; and the list
 * opens on one thing.
 */
function checkListGantt(list: ListNode, path: string, tools: ListTools): void {
  const gantt = list.gantt as NonNullable<ListNode['gantt']>;
  const typed = typedIn(path, tools);
  checkTimes(gantt, "a bar's", path, tools, gantt.zooms ?? ['day', 'week', 'month'], gantt.zoom, ['zooms', 'zoom', 'scales']);
  typed(gantt.duration, 'duration', new Set(['integer', 'float']), 'how long a bar lasts is a number of days');
  if (gantt.end !== undefined && gantt.duration !== undefined) tools.report(`${path}.duration`, 'a bar ends at its end or lasts its duration: say one');
  typed(gantt.title, 'title', CALENDAR_WORDS, "a bar's words are a field that can be said");
  typed(gantt.group, 'group', CALENDAR_COLUMNS, 'a group comes from a link, a choice, text or a whole number');
  typed(gantt.colour, 'colour', CALENDAR_COLOURS, 'a colour comes from a link, a choice, text, a whole number or a yes or no');
  const waits = typed(gantt.dependsOn, 'dependsOn', new Set(['many2many']), "what a bar waits for is a many2many of the list's own records");
  const model = tools.page.data.kind === 'record' ? tools.page.data.model : '';
  if (waits?.type === 'many2many' && waits.relation !== model) tools.report(`${path}.dependsOn`, `"${gantt.dependsOn}" links to ${waits.relation}; a bar waits for records of this list, ${model}`);
  if (gantt.opens !== 'gantt') return;
  mapAnd(list, path, tools, 'timeline');
  if (list.calendar?.opens === 'calendar') tools.report(`${path}.opens`, 'the list opens on its calendar and on its timeline: say one');
}

/**
 * A list drawn as a backlog: each column's cells are a column's, a lead's
 * icon is by a field's values; the filter bar's fields can list their
 * values; rows nest under a link to the list's own records; and buttons for
 * the rows chosen need a box to choose one.
 */
function checkListCells(list: ListNode, path: string, tools: ListTools): void {
  if (list.filterFields && list.search !== 'fields') tools.report(`${path}.filterFields`, 'the filter fields are for the "fields" search: add "search": "fields"');
  list.filterFields?.forEach((name, i) => {
    const def = tools.need(name, `${path}.filterFields[${i}]`);
    if (def && !LISTS_ITS_VALUES.has(def.type) && !RANGE_ONLY.has(def.type)) {
      tools.report(`${path}.filterFields[${i}]`, `"${name}" is a ${def.type}; a filter lists the values of a choice, a link, links, a yes or no, text or a whole number, or takes the range of a number or a date`);
    }
  });
  // A filter's own name is for a filter the bar offers.
  for (const name of Object.keys(list.filterLabels ?? {})) {
    if (!list.filterFields?.includes(name)) tools.report(`${path}.filterLabels.${name}`, `"${name}" is no field of filterFields: its name is for a filter the bar offers`);
  }
  // A range is a number's or a date's the bar offers; the presses for its least values are a number's, in order.
  for (const [name, range] of Object.entries(list.filterRanges ?? {})) {
    const at = `${path}.filterRanges.${name}`;
    if (!list.filterFields?.includes(name)) {
      tools.report(at, `"${name}" is no field of filterFields: a range is for a filter the bar offers`);
      continue;
    }
    const def = tools.page.fields[name];
    if (!def) continue;
    if (!HAS_A_RANGE.has(def.type)) {
      tools.report(at, `"${name}" is a ${def.type}; a range is a number's or a date's`);
      continue;
    }
    const least = range.atLeast ?? [];
    if (least.length && (def.type === 'date' || def.type === 'datetime')) tools.report(`${at}.atLeast`, `"${name}" is a ${def.type}; the presses for a least value are a number's`);
    else if (def.type === 'integer' && least.some((n) => !Number.isInteger(n))) tools.report(`${at}.atLeast`, `"${name}" holds whole numbers: each least value is one`);
    else if (least.some((n, i) => i > 0 && n <= least[i - 1])) tools.report(`${at}.atLeast`, 'the least values go from the smallest to the largest, each once');
  }
  if (list.filterSheet && list.search !== 'fields') tools.report(`${path}.filterSheet`, 'the filter sheet is the filter bar\'s on a phone: add "search": "fields"');
  if (list.parentField !== undefined) {
    const def = tools.need(list.parentField, `${path}.parentField`);
    const model = tools.page.data.kind === 'record' ? tools.page.data.model : '';
    if (def && (def.type !== 'many2one' || def.relation !== model)) {
      tools.report(`${path}.parentField`, `"${list.parentField}" ${def.type === 'many2one' ? `links to ${def.relation}` : `is a ${def.type}`}; a parent is a many2one to the list’s own model, ${model}`);
    }
  }
  if (list.choose === false && list.actions?.length) tools.report(`${path}.actions`, 'a list’s buttons act on the rows chosen: with "choose": false there is no way to choose one');
  checkBulkEdit(list, path, tools);
  checkImport(list, path, tools);
}

/** A list's Edit: each field it names one value can set in many records, and rows to choose to set it on. */
function checkBulkEdit(list: ListNode, path: string, tools: ListTools): void {
  if (!list.bulkEdit) return;
  if (list.choose === false) tools.report(`${path}.bulkEdit`, 'Edit changes the rows chosen: with "choose": false there is no way to choose one');
  if (list.bulkEdit === true) {
    if (!list.columns.some((name) => bulkSettable(tools.page.fields[name]))) tools.report(`${path}.bulkEdit`, 'Edit offers the columns one value can set, and none of these can: name the fields it offers');
    return;
  }
  const named = list.bulkEdit;
  named.forEach((name, i) => {
    const at = `${path}.bulkEdit[${i}]`;
    if (named.indexOf(name) !== i) tools.report(at, `"${name}" is offered twice`);
    const def = tools.need(name, at);
    if (!def) return;
    if (!BULK_KINDS.has(def.type)) tools.report(at, `"${name}" is a ${def.type}; one value set in many records is words, a number, money, a yes or no, a date, a choice or a link`);
    else if (def.readonly === true || def.compute) tools.report(at, `"${name}" is ${def.compute ? 'worked out from other fields' : 'read-only'}; Edit sets a field people can change`);
  });
}

/** A list's Import: each field it names one a file's cell can fill, and at least one such field on the page. */
function checkImport(list: ListNode, path: string, tools: ListTools): void {
  if (!list.import) return;
  if (list.import === true) {
    if (!Object.values(tools.page.fields).some((def) => importable(def))) tools.report(`${path}.import`, 'Import fills the fields a file’s cell can, and this page has none: words, a number, money, yes or no, a date, a choice or a link people can change');
    return;
  }
  const named = list.import;
  named.forEach((name, i) => {
    const at = `${path}.import[${i}]`;
    if (named.indexOf(name) !== i) tools.report(at, `"${name}" is offered twice`);
    const def = tools.need(name, at);
    if (!def) return;
    if (!IMPORT_KINDS.has(def.type)) tools.report(at, `"${name}" is a ${def.type}; a file's cell fills words, a number, money, a yes or no, a date, a choice, or a link or links by name`);
    else if (def.readonly === true || def.compute) tools.report(at, `"${name}" is ${def.compute ? 'worked out from other fields' : 'read-only'}; Import fills a field people can change`);
  });
}

/** A list's map: where each record is, and the fields its pin and its card show, each of a type that can. */
function checkListMap(map: NonNullable<ListNode['map']>, path: string, tools: ListTools): void {
  const pair = map.latitude !== undefined || map.longitude !== undefined;
  if (map.point !== undefined && pair) tools.report(path, 'a map takes point, or latitude and longitude, not both');
  else if (map.point === undefined && (map.latitude === undefined || map.longitude === undefined)) tools.report(path, 'a map needs where each record is: point, or latitude and longitude');
  tools.checkPlace(map, path, tools.here(), map.pin, map.card);
  if (map.regions) tools.need(map.regions.field, `${path}.regions.field`);
  if (typeof map.heat === 'object' && map.heat.weight !== undefined) {
    const def = tools.need(map.heat.weight, `${path}.heat.weight`);
    if (def && def.type !== 'float' && def.type !== 'integer' && def.type !== 'monetary') tools.report(`${path}.heat.weight`, `"${map.heat.weight}" is a ${def.type}; a weight is a number field`);
  }
}

/** Whether a record holds a key of its own. */
const has = (record: object, key: string) => Object.prototype.hasOwnProperty.call(record, key);

/**
 * A related list: on a record's page, its columns, order, search, cells, card and rows' rules of its own records'
 * fields, its link to this record a link of theirs to this model where its fields name it, and its filter's
 * `valueFrom` this record's.
 */
export function checkRelated(node: RelatedNode, path: string, tools: ListTools): void {
  // The quick check reads no shapes: a part with nothing to go by is said here.
  if (typeof node.model !== 'string' || typeof node.field !== 'string' || !Array.isArray(node.columns) || !node.fields || typeof node.fields !== 'object') {
    return tools.report(path, 'a related list needs the model of its records, their link to this record (field), their fields and its columns');
  }
  const model = tools.page.data.kind === 'record' ? tools.page.data.model : null;
  if (!model || tools.onLine) tools.report(path, 'a related list shows the records that point at a record: it belongs on a record’s page');
  const fields = node.fields as Record<string, Field | LineField>;
  checkListed(node, fields, path, tools);
  // On a phone its rows are cards, as a list's: of its own records' fields.
  if (node.card) checkListCard(node.card, `${path}.card`, fields, tools);
  // Its rows' own rules, as a list's, each read on the row's record: its own fields, its id, the person, the context.
  const row: Scope = { fields };
  node.rowTones?.forEach((tone, i) => tools.checkModifiers(tone, `${path}.rowTones[${i}]`, ['when'], row));
  tools.checkModifiers(node, path, ['rowBold'], row);
  node.rowButtons?.forEach((button, i) => {
    tools.claim(button.id, `${path}.rowButtons[${i}]`);
    tools.checkPress(button, `${path}.rowButtons[${i}]`);
    tools.checkModifiers(button, `${path}.rowButtons[${i}]`, ['invisible'], row);
  });
  const link = has(fields, node.field) ? fields[node.field] : undefined;
  if (link && model && (link.type !== 'many2one' || link.relation !== model)) {
    tools.report(`${path}.field`, `"${node.field}" ${link.type === 'many2one' ? `links to ${link.relation}` : `is a ${link.type}`}; the records listed point at this one by a many2one to ${model}`);
  }
  for (const [name, def] of Object.entries(fields)) {
    if (def.type === 'monetary' && def.currencyField !== undefined) tools.checkCurrency(def.currencyField, `${path}.fields.${name}.currencyField`, fields, undefined, fields);
    if (def.type === 'datetime' && def.timeZone !== undefined) tools.checkZone(def.timeZone, `${path}.fields.${name}.timeZone`);
  }
  // Its filter is about its records, by their fields; what it compares with may be read from this record.
  node.filter?.forEach((item, i) => tools.checkFilterItem(item, `${path}.filter[${i}]`, tools.here()));
  if (node.viewAll && node.viewAll.page === tools.page.id) tools.report(`${path}.viewAll.page`, 'View all opens a list of the records related: this page is the record they point at');
}

/** Kinds of field a list's card shows as its picture: a picture held, or text holding a picture's address. */
const PICTURES: ReadonlySet<string> = new Set(['image', 'binary', 'char']);

/**
 * What a list shows of its records — a list page's, or a related list's of its own records' fields: its columns, its
 * order and the fields its search looks in, each a field; each column's cells for a column of it, a sum, an average,
 * the lowest and the highest of a number column (any column's count), a lead's icon by a field's values.
 */
function checkListed(list: Pick<ListNode, 'columns' | 'sort' | 'searchFields' | 'cells'>, fields: Record<string, Field | LineField>, path: string, tools: ListTools): void {
  list.columns.forEach((name, i) => {
    if (tools.whole && list.columns.indexOf(name) !== i) tools.report(`${path}.columns[${i}]`, `"${name}" is a column before it: each column once`);
    else tools.need(name, `${path}.columns[${i}]`, fields);
  });
  list.sort?.forEach((order, i) => tools.need(order.field, `${path}.sort[${i}].field`, fields));
  list.searchFields?.forEach((name, i) => tools.need(name, `${path}.searchFields[${i}]`, fields));
  for (const [column, cell] of Object.entries(list.cells ?? {})) {
    const at = `${path}.cells.${column}`;
    if (!list.columns.includes(column)) {
      tools.report(at, `"${column}" is no column of this list: its cells are for its columns`);
      continue;
    }
    const kind = has(fields, column) ? fields[column].type : undefined;
    if (cell.total && cell.total !== 'count' && kind && kind !== 'integer' && kind !== 'float' && kind !== 'monetary') {
      tools.report(`${at}.total`, `"${column}" is a ${kind}; its total "${cell.total}" is of numbers — an integer, a float or an amount — and any column's is "count"`);
    }
    if (!cell.lead) continue;
    const def = tools.need(cell.lead.field, `${at}.lead.field`, fields);
    if (def?.type !== 'selection') continue;
    const values = new Set(def.options.map((option) => String(option.value)));
    for (const value of Object.keys(cell.lead.looks)) if (!values.has(value)) tools.report(`${at}.lead.looks.${value}`, `"${value}" is no value of "${cell.lead.field}"`);
  }
}

/**
 * What a list's card shows — a list page's, or a related list's of its own records' fields: its title, subtitle,
 * status and lines each a field, its picture one that can hold a picture.
 */
function checkListCard(card: ListCard, at: string, fields: Record<string, Field | LineField>, tools: ListTools): void {
  for (const key of ['title', 'subtitle', 'status'] as const) if (card[key] !== undefined) tools.need(card[key] as string, `${at}.${key}`, fields);
  if (card.image !== undefined) {
    const def = tools.need(card.image, `${at}.image`, fields);
    if (def && !PICTURES.has(def.type)) tools.report(`${at}.image`, `"${card.image}" is a ${def.type}; a card's picture is an image or binary field, or text holding a picture's address`);
  }
  card.fields?.forEach((line, i) =>
    (Array.isArray(line) ? line : [line]).forEach((part, j) => tools.need(typeof part === 'string' ? part : part.field, `${at}.fields[${i}]${Array.isArray(line) ? `[${j}]` : ''}${typeof part === 'string' ? '' : '.field'}`, fields))
  );
}
