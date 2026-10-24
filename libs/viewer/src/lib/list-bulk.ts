import { bulkEditFields, recordSentence, saveProblemOf, type DataSource, type Field, type LayoutNode, type LineField, type ListNode, type Locale, type Page, type RecordId, type RecordPermissions, type RecordVersion, type SaveProblem, type Value, type Values, intlFormat } from '@fieldia/core';
import { displayValue, type WidgetDialogs } from '@fieldia/widgets';
import type { ViewerLabels } from './labels';

/**
 * A list's Edit of many records: one field set to one value in each of the
 * rows ticked, or of every record that matches. The value is asked in a dialog
 * of the field's own box, with its rules (required, its pattern, its least
 * and most); then the question "Update 24 records?"; then the records are
 * written — by `writeMany`, a thousand at a time, or by `save` per record, a
 * few at once — each with the version it was listed at where the list knows
 * it. A record the list knows the person may not change is never sent, and
 * says why; what the source refuses says why too; the rest stays done.
 */

/** Records written by one `writeMany` call. */
const WRITE_AT_ONCE = 1000;
/** Records saved at once, one by one, where the source has no `writeMany`. */
const SAVES_AT_ONCE = 4;

/** What the list knows of a record from its row: its version and what the person may do with it. */
export interface KnownRecord {
  version?: RecordVersion;
  can?: RecordPermissions;
}

export interface BulkList {
  page: Page;
  node: ListNode;
  model: string;
  dataSource: DataSource | undefined;
  labels: ViewerLabels;
  fill: (template: string, values: Record<string, string | number>) => string;
  locale: Locale;
  known: (id: RecordId) => KnownRecord | undefined;
}

/** A record not changed, and why, in the person's words. */
export interface BulkFailure {
  id: RecordId;
  why: string;
}

/** Whether the list offers Edit: the page names fields one value can set, and the source can write them. */
export function bulkOffered(list: Pick<BulkList, 'page' | 'node' | 'dataSource'>): boolean {
  return !!(list.dataSource?.writeMany || list.dataSource?.save) && bulkEditFields(list.page, list.node).length > 0;
}

/** Whether the list knows this person may not set any field of this record. */
export const lockedOut = (known: KnownRecord | undefined): boolean => known?.can?.edit === false;

/** A field as a dialog of values may carry it: nothing that sets its value of itself, a default or a rule. */
function asked(def: Field): Field {
  const { default: _value, defaultFrom: _from, setWhen: _when, compute: _worked, ...rest } = def;
  return rest as Field;
}

/**
 * The field and the value, asked in a dialog: the field picked among those offered (none to pick when one is), its box
 * under it with its rules. Null when the person cancelled.
 */
export async function askBulkValue(list: BulkList, editValues: WidgetDialogs['editValues'], title: string): Promise<{ field: string; value: Value } | null> {
  const { page, labels } = list;
  const offered = bulkEditFields(page, list.node);
  // The picker's name: one no field of the page has.
  let pick = 'bulk_field';
  while (page.fields[pick]) pick = `${pick}_`;
  const fields: Record<string, Field> = {};
  // Every field of the page, so what a field reads of another (a currency, a link's filter) is there; only those offered are shown.
  for (const [name, def] of Object.entries(page.fields)) fields[name] = asked(def);
  const children: LayoutNode[] = offered.map((name) => ({ type: 'field', id: `bulk-${name}`, field: name, ...(offered.length > 1 ? { invisible: `${pick} != '${name}'` } : {}) }));
  if (offered.length > 1) {
    fields[pick] = { type: 'selection', label: labels.bulkField, required: true, options: offered.map((name) => ({ value: name, label: page.fields[name].label })) };
    children.unshift({ type: 'field', id: 'bulk-pick', field: pick, focus: true });
  }
  const values = await editValues({
    title,
    fields,
    values: {},
    layout: [{ type: 'section', id: 'bulk', columns: 1, children }],
    buttons: { done: labels.bulkApply, cancel: labels.cancel },
    // Its labels said as the list's page asks.
    ...(page.lowerLabels ? { lowerLabels: true } : {}),
  });
  if (!values) return null;
  const field = offered.length > 1 ? String(values[pick] ?? '') : offered[0];
  if (!offered.includes(field)) return null;
  const value = values[field];
  // A yes or no left unticked is No: one value for every record, never "cleared".
  if (page.fields[field].type === 'boolean') return { field, value: value === true };
  return { field, value: value === undefined || value === '' ? null : value };
}

/** "Update 24 records? Status becomes “Active”.", in the page's language. */
export function bulkQuestion(list: BulkList, count: number, field: string, value: Value, number: (n: number) => string): string {
  const { labels, fill } = list;
  const def = list.page.fields[field];
  const one = intlFormat('PluralRules', list.locale).select(count) === 'one';
  const words = value === null || value === undefined ? '' : def.type === 'boolean' ? (value ? labels.yes : labels.no) : displayValue(def as LineField, value, {}, list.locale);
  const what = words ? fill(labels.bulkSet, { field: def.label, value: words }) : fill(labels.bulkClear, { field: def.label });
  const ask = one ? recordSentence(list.page.records, labels.bulkAskNounOne, labels.bulkAskOne, list.locale) : recordSentence(list.page.records, labels.bulkAskNoun, labels.bulkAsk, list.locale);
  return `${fill(ask, { n: number(count) })} ${what}`;
}

/** Why the source refused a record, as the list says it: who changed it since it was listed, the field's own words, or the source's. */
function whyOf(list: BulkList, problem: SaveProblem): string {
  if (problem.kind === 'conflict') return list.fill(list.labels.bulkChangedSince, { name: problem.conflict?.version.by ?? list.labels.someoneElse });
  return Object.values(problem.fields ?? {})[0] ?? problem.message;
}

/** Writes the value in each record, saying how far it has got; the records not changed, in their order, and why. */
export async function writeBulk(list: BulkList, ids: readonly RecordId[], field: string, value: Value, progress: (done: number, total: number) => void): Promise<{ done: number; failed: BulkFailure[] }> {
  const { labels, model } = list;
  const readOnly = recordSentence(list.page.records, labels.readOnlyRecordNoun, labels.readOnlyRecord, list.locale);
  const source = list.dataSource as DataSource;
  const def = list.page.fields[field];
  const failed: BulkFailure[] = [];
  const sent: RecordId[] = [];
  // What the list knows the person may not change is never sent: it says why at once.
  for (const id of ids) {
    const can = list.known(id)?.can;
    if (can?.edit === false) failed.push({ id, why: can.reason ?? readOnly });
    else if (can?.readonlyFields?.includes(field) || can?.hiddenFields?.includes(field)) failed.push({ id, why: can.reason ?? labels.fieldNotYours });
    else sent.push(id);
  }
  let done = 0;
  const tell = () => progress(done + failed.length, ids.length);
  tell();
  const versionOf = (id: RecordId) => list.known(id)?.version;
  if (source.writeMany) {
    for (let at = 0; at < sent.length; at += WRITE_AT_ONCE) {
      const some = sent.slice(at, at + WRITE_AT_ONCE);
      const versions: Record<string, RecordVersion> = {};
      for (const id of some) {
        const version = versionOf(id);
        if (version) versions[String(id)] = version;
      }
      try {
        const answer = await source.writeMany({ model, ids: some, values: { [field]: value }, fields: { [field]: def }, ...(Object.keys(versions).length ? { versions } : {}) });
        const refused = new Map(answer.failed.map((one) => [String(one.id), one]));
        for (const id of some) {
          const one = refused.get(String(id));
          if (one) failed.push({ id, why: one.problem ? whyOf(list, one.problem) : one.message });
          else done++;
        }
      } catch (error) {
        // The whole call failed (the network): none of these was changed.
        const why = whyOf(list, saveProblemOf(error));
        for (const id of some) failed.push({ id, why });
      }
      tell();
    }
  } else if (source.save) {
    const save = source.save.bind(source);
    let next = 0;
    const one = async () => {
      while (next < sent.length) {
        const id = sent[next++];
        const version = versionOf(id);
        const values: Values = { [field]: value };
        try {
          await save({ model, id, fields: { [field]: def }, changes: { values, lines: {}, links: {} }, values, partial: true, ...(version ? { version } : {}) });
          done++;
        } catch (error) {
          failed.push({ id, why: whyOf(list, saveProblemOf(error)) });
        }
        tell();
      }
    };
    await Promise.all(Array.from({ length: Math.min(SAVES_AT_ONCE, sent.length) }, one));
  }
  const place = new Map(ids.map((id, i) => [String(id), i]));
  failed.sort((a, b) => (place.get(String(a.id)) as number) - (place.get(String(b.id)) as number));
  return { done, failed };
}
