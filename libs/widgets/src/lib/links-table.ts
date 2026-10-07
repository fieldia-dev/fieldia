import type { Field, LineField, RelatedRecord, Values } from '@fieldia/core';
import { displayValue } from './display';
import { fillIn, maker, setAttr } from './kind-parts';
import { WIDGET_LABELS } from './labels';
import type { WidgetFactory } from './widgets';

/**
 * A many2many as a table of the records it links to, as Flectra's list of
 * them: a row for each, its `columns` — fields of those records, named in the
 * many2many's `fields` — read from the data source by their ids. Add a line
 * finds one more record by searching (the dialog's Search more…); × takes a
 * record away, never deleting it; ↗ opens a record's own page, when the app
 * gives one for the model. The node's `options.addLabel` and
 * `options.emptyLabel` word its button and its sentence while empty.
 */
export const linksTableWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, locale, dialogs }) => {
  const def = field as Extract<Field, { type: 'many2many' }>;
  const make = maker(document);
  const fields = (def.fields ?? {}) as Record<string, LineField>;
  const columns = (node.columns ?? []).filter((column) => fields[column]);
  const words = (key: string) => (typeof node.options?.[key] === 'string' && (node.options[key] as string).trim() ? (node.options[key] as string) : null);
  const canOpen = !!dialogs && dialogs.canOpen(def.relation);

  const head = make('tr', {}, ...columns.map((column) => make('th', { scope: 'col', 'data-column': column }, fields[column].label)), make('th', { class: 'fd-lines-tools' }));
  const body = make('tbody');
  const table = make('table', { class: 'fd-lines-table fd-links-table' }, make('thead', {}, head), body);
  const add = make('button', { type: 'button', class: 'fd-button fd-button-link fd-lines-add', 'data-add': 'line' }, `+ ${words('addLabel') ?? labels.addLine}`) as HTMLButtonElement;
  const adds = make('div', { class: 'fd-lines-adds' }, add);
  const emptyWords = words('emptyLabel');
  const empty = emptyWords ? make('div', { class: 'fd-help fd-lines-empty' }, emptyWords) : null;
  const element = make('div', { class: 'fd-lines fd-links', id, role: 'group' }, make('div', { class: 'fd-lines-scroll' }, table), ...(empty ? [empty] : []), adds);

  /** The records' values, by id, as the data source last gave them; those asked for and not back yet. */
  const known = new Map<string, Values>();
  const asked = new Set<string>();
  let readonly = false;
  let shown: RelatedRecord[] = [];
  const linked = () => (form.getState().values[name] as RelatedRecord[] | null) ?? [];

  /** The values of records not read yet, read in one go, and the table drawn again once they are. */
  function read(records: readonly RelatedRecord[], again = false) {
    const ids = records.map((r) => r.id).filter((recordId) => again || (!known.has(String(recordId)) && !asked.has(String(recordId))));
    if (!ids.length) return;
    for (const recordId of ids) asked.add(String(recordId));
    void form.linkedValues(name, ids, columns).then(
      (found) => {
        for (const { id: recordId, values } of found) known.set(String(recordId), values);
        for (const recordId of ids) asked.delete(String(recordId));
        draw();
      },
      () => ids.forEach((recordId) => asked.delete(String(recordId)))
    );
  }

  add.addEventListener('click', async () => {
    if (!dialogs || readonly) return;
    const found = await dialogs.searchMore({ title: def.label, search: (query, limit) => form.search(name, query, limit) });
    if (!found || linked().some((r) => r.id === found.id)) return;
    form.setValue(name, [...linked(), { id: found.id, label: found.label }]);
  });

  async function open(record: RelatedRecord) {
    const saved = await dialogs?.openRecord(def.relation, { recordId: record.id, title: record.label });
    if (!saved) return;
    // What its page saved: read again, and its name kept if it changed.
    if (saved.label !== record.label) form.setValue(name, linked().map((r) => (r.id === record.id ? { id: r.id, label: saved.label } : r)));
    read([record], true);
  }

  function row(record: RelatedRecord): HTMLTableRowElement {
    const values = known.get(String(record.id));
    const cells = columns.map((column, i) => {
      // Until its values are read, a record shows its name in the first column.
      const text = values ? displayValue(fields[column], values[column] ?? null, values, locale) : i === 0 ? record.label : '';
      return make('td', { 'data-column': column }, make('span', { class: 'fd-value-text' }, text));
    });
    const tools = make('td', { class: 'fd-lines-tools' });
    if (canOpen) {
      const opener = make('button', { type: 'button', class: 'fd-line-open', 'aria-label': fillIn(labels.openNamed, { name: record.label }), title: labels.openLine }, '↗') as HTMLButtonElement;
      opener.addEventListener('click', () => void open(record));
      tools.append(opener);
    }
    if (!readonly) {
      const remove = make('button', { type: 'button', class: 'fd-line-delete', 'aria-label': fillIn(labels.remove, { name: record.label }) }, '×') as HTMLButtonElement;
      remove.addEventListener('click', () => form.setValue(name, linked().filter((r) => r.id !== record.id)));
      tools.append(remove);
    }
    return make('tr', { 'data-record': String(record.id) }, ...cells, tools) as HTMLTableRowElement;
  }

  function draw() {
    const focused = document.activeElement;
    const keep = element.contains(focused) ? (focused as HTMLElement).closest('tr')?.dataset['record'] : undefined;
    body.replaceChildren(...shown.map(row));
    if (keep) (body.querySelector(`tr[data-record="${CSS.escape(keep)}"] button`) as HTMLElement | null)?.focus();
  }

  return {
    element,
    focus: () => (body.querySelector('button') ?? add).focus(),
    update(state) {
      const now = (state.value as RelatedRecord[] | null) ?? [];
      const changed = now !== shown || state.readonly !== readonly;
      readonly = state.readonly;
      shown = now;
      adds.hidden = readonly || !dialogs;
      if (empty) empty.hidden = now.length > 0;
      setAttr(element, 'aria-invalid', String(state.invalid));
      setAttr(element, 'aria-describedby', state.describedBy || null);
      if (changed) draw();
      read(now);
    },
  };
};

