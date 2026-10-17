import type { Field, LinkedField, Page, RelatedNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer, RelatedPatch } from './designer';
import { cardSettings } from './list-cards-settings';
import { rowSettings } from './list-rows-settings';
import { locate } from './layout-tree';
import type { BlockContent } from './panel-block';
import { onTab, segmented, setting } from './panel-controls';
import { settingNumber } from './number-box';
import { setHidden } from './writes';

/**
 * A related list's own settings, on the Content tab: its title; the model of the records it lists and their link to
 * this record; its columns, each a field of theirs — its words, its name and its kind; its records as cards on a phone,
 * and its rows' tones, bold and buttons, as a list's, of its own fields; how many rows a page holds; New; where a
 * row's record and New's open; and View all's page and where it opens. Its filter, order and cells are its JSON's. Its
 * records show in Try it.
 */

/** The kinds a new column can be, plainly: a choice's options and a link's model are set in its JSON. */
const KINDS = ['char', 'integer', 'float', 'monetary', 'date', 'datetime', 'boolean'] as const;
type Kind = LinkedField['type'];

const focused = (node: Element) => node.ownerDocument.activeElement === node;

export function relatedContent(el: ElementFactory, designer: Designer, id: string): BlockContent {
  const w = designer.words.relatedPart;
  const nodeOf = (page: Page) => {
    const node = locate(page, id)?.node;
    return node?.type === 'related' ? node : null;
  };
  const change = (patch: RelatedPatch) => designer.updateRelated(id, patch);

  // ---- its title, its records and their link: kept once typed and left, a name half typed being no name yet ----
  const title = el('input', { class: 'fd-input', 'aria-label': w.title, autocomplete: 'off' }) as HTMLInputElement;
  title.addEventListener('input', () => change({ title: title.value }));
  const model = el('input', { class: 'fd-input', 'aria-label': w.model, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  model.addEventListener('change', () => {
    if (!change({ model: model.value })) model.setAttribute('aria-invalid', 'true');
  });
  const field = el('input', { class: 'fd-input', 'aria-label': w.field, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  field.addEventListener('change', () => {
    if (!change({ field: field.value.trim() })) field.setAttribute('aria-invalid', 'true');
  });
  const fieldHint = el('p', { class: 'fd-properties-hint fd-set-hint' });

  // ---- its columns ----
  const columnsBox = el('div', { class: 'fd-related-columns' });
  const addColumn = el('button', { type: 'button', class: 'fd-button' }, w.addColumn);
  /** Its columns as they are, each with its field's definition. */
  const columnsOf = (node: RelatedNode) => node.columns.map((name) => ({ name, field: node.fields[name] ?? ({ type: 'char', label: name } as LinkedField) }));
  /** Its columns with one changed: its words, its name or its kind. */
  function edit(at: number, apply: (column: { name: string; field: LinkedField }) => { name: string; field: LinkedField }): boolean {
    const node = nodeOf(designer.getPage());
    if (!node) return false;
    const columns = columnsOf(node);
    columns[at] = apply(columns[at]);
    return change({ columns });
  }
  /** A column's field as another kind: its words kept, what only the old kind had let go. */
  const asKind = (field: LinkedField, kind: Kind): LinkedField => ({ type: kind, label: field.label }) as LinkedField;
  addColumn.addEventListener('click', () => {
    const node = nodeOf(designer.getPage());
    if (!node) return;
    const taken = new Set([...node.columns, ...Object.keys(node.fields)]);
    let n = node.columns.length + 1;
    while (taken.has(`column_${n}`)) n++;
    if (change({ columns: [...columnsOf(node), { name: `column_${n}`, field: { type: 'char', label: w.newColumn(n) } }] })) draw(designer.getPage(), true);
  });
  /** The columns drawn: by their names and kinds, made again only when those change, so a box typed in keeps the focus. */
  let drawnKey = '';
  function drawColumns(node: RelatedNode, focusLast: boolean) {
    const columns = columnsOf(node);
    const key = JSON.stringify(columns.map(({ name, field: def }) => [name, def.type]));
    if (key === drawnKey && !focusLast) {
      // Words typed elsewhere (undo, the JSON): each box not being typed in says what the page holds.
      columns.forEach(({ name, field: def }, at) => {
        const row = columnsBox.children[at];
        const words = row?.querySelector<HTMLInputElement>('input[data-part="words"]');
        if (words && !focused(words) && words.value !== def.label) words.value = def.label;
        const named = row?.querySelector<HTMLInputElement>('input[data-part="name"]');
        if (named && !focused(named)) {
          named.value = name;
          named.removeAttribute('aria-invalid');
        }
      });
      return;
    }
    drawnKey = key;
    const rows = columns.map(({ name, field: def }, at) => {
      const n = at + 1;
      const words = el('input', { class: 'fd-input', 'aria-label': w.columnLabel(n), autocomplete: 'off', 'data-part': 'words' }) as HTMLInputElement;
      words.value = def.label;
      words.addEventListener('input', () => edit(at, (column) => ({ ...column, field: { ...column.field, label: words.value } as LinkedField })));
      const named = el('input', { class: 'fd-input', 'aria-label': w.columnName(n), autocomplete: 'off', spellcheck: 'false', 'data-part': 'name' }) as HTMLInputElement;
      named.value = name;
      named.addEventListener('change', () => {
        if (!edit(at, (column) => ({ ...column, name: named.value.trim() }))) named.setAttribute('aria-invalid', 'true');
      });
      const kind = el('select', { class: 'fd-input fd-select', 'aria-label': w.columnKind(n) }) as HTMLSelectElement;
      // The plain kinds, and its own where it is another (a choice, a link): kept, its settings in its JSON.
      const offered: readonly Kind[] = (KINDS as readonly Kind[]).includes(def.type) ? KINDS : [...KINDS, def.type];
      kind.replaceChildren(...offered.map((value) => el('option', { value }, w.kinds[value as keyof typeof w.kinds] ?? value)));
      kind.value = def.type;
      kind.addEventListener('change', () => edit(at, (column) => ({ ...column, field: asKind(column.field, kind.value as Kind) })));
      const remove = el('button', { type: 'button', class: 'fd-button fd-button-link', 'aria-label': w.removeColumn(def.label || name), title: w.removeColumn(def.label || name) }, '×');
      remove.addEventListener('click', () => {
        const now = nodeOf(designer.getPage());
        if (now) change({ columns: columnsOf(now).filter((_, i) => i !== at) });
      });
      return el('div', { class: 'fd-related-column', 'data-column': name }, words, named, kind, remove);
    });
    columnsBox.replaceChildren(...rows);
    if (focusLast) (rows[rows.length - 1]?.querySelector('input') as HTMLInputElement | null)?.focus();
  }

  // ---- its records as cards on a phone, as a list's: of its own records' fields ----
  const cards = cardSettings(el, designer, {
    card: (page) => nodeOf(page)?.card,
    setCard: (card) => change({ card }),
    fields: (page, kinds) => Object.entries(nodeOf(page)?.fields ?? {}).map(([name, def]) => ({ name, field: def as Field })).filter(({ field: def }) => kinds.has(def.type)),
  });

  // ---- its rows' tones, bold and buttons, as a list's: each read on the row's record, of its own fields ----
  const rowRules = rowSettings(el, designer, {
    rules: (page) => nodeOf(page) ?? {},
    set: (patch) => change(patch),
    reads: (page) => ({ ...page, fields: (nodeOf(page)?.fields ?? {}) as Page['fields'] }),
  });

  // ---- rows a page, New, View all ----
  const rows = settingNumber(el, designer, {
    label: w.rows,
    attrs: { class: 'fd-input', placeholder: '5' },
    integer: true,
    min: 1,
    max: 100,
    optional: true,
    saved: () => nodeOf(designer.getPage())?.limit ?? null,
    commit: (n) => change({ limit: n }),
  });
  const create = el('input', { type: 'checkbox', 'aria-label': w.create }) as HTMLInputElement;
  create.addEventListener('change', () => change({ create: create.checked }));
  // Where a row's record and New's open: a dialog of the model's page, or the app's own way first.
  const rowsOpen = segmented<'dialog' | 'app'>(
    el,
    w.rowsOpen,
    (['dialog', 'app'] as const).map((value) => ({ value, words: w.rowsOpenIn[value] })),
    (value) => {
      if (value) change({ open: value });
    }
  );
  const allPage = el('input', { class: 'fd-input', 'aria-label': w.viewAll, autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
  allPage.addEventListener('change', () => {
    const page = allPage.value.trim();
    const as = nodeOf(designer.getPage())?.viewAll?.as;
    if (!change({ viewAll: page ? { page, ...(as ? { as } : {}) } : null })) allPage.setAttribute('aria-invalid', 'true');
  });
  const opens = segmented<'dialog' | 'panel' | 'page'>(
    el,
    w.opensIn,
    (['dialog', 'panel', 'page'] as const).map((value) => ({ value, words: w.opens[value] })),
    (value) => {
      const all = nodeOf(designer.getPage())?.viewAll;
      if (value && all) change({ viewAll: { page: all.page, as: value } });
    }
  );
  const opensRow = setting(el, 'content', 'View all opens in', opens.element, { words: w.opensIn });

  function draw(page: Page, focusLast = false) {
    const node = nodeOf(page);
    if (!node) return;
    if (!focused(title)) title.value = node.title ?? '';
    if (!focused(model)) {
      model.value = node.model;
      model.removeAttribute('aria-invalid');
    }
    if (!focused(field)) {
      field.value = node.field;
      field.removeAttribute('aria-invalid');
    }
    fieldHint.textContent = w.fieldHint(page.data.kind === 'record' ? page.data.model : '…');
    drawColumns(node, focusLast);
    cards.update(page);
    rowRules.update(page);
    rows.refresh();
    create.checked = node.create !== false;
    rowsOpen.set(node.open ?? 'dialog');
    if (!focused(allPage)) {
      allPage.value = node.viewAll?.page ?? '';
      allPage.removeAttribute('aria-invalid');
    }
    opens.set(node.viewAll ? (node.viewAll.as ?? 'dialog') : null);
    setHidden(opensRow, !node.viewAll);
  }

  return {
    rows: [
      setting(el, 'content', 'Title', title, { words: w.title }),
      setting(el, 'content', 'Records of', model, { hint: w.modelHint, words: w.model }),
      setting(el, 'content', 'Their link to this record', field, { hint: fieldHint, words: w.field }),
      setting(el, 'content', 'Columns', [columnsBox, addColumn], { words: w.columns }),
      setting(el, 'content', 'Cards on a phone', cards.element, { words: w.cards }),
      onTab(rowRules.element, 'content', 'Row tones and buttons'),
      setting(el, 'content', 'Rows a page', rows.input, { hint: w.rowsHint, words: w.rows }),
      setting(el, 'content', 'New', el('label', { class: 'fd-q-required' }, create, el('span', {}, w.create)), { hint: w.createHint, words: w.newWord }),
      setting(el, 'content', 'Rows and New open', rowsOpen.element, { hint: w.rowsOpenHint, words: w.rowsOpen }),
      setting(el, 'content', 'View all opens the page', allPage, { hint: w.viewAllHint, words: w.viewAll }),
      opensRow,
    ],
    update: (page) => draw(page),
  };
}
