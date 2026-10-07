import type { Field, Form, FormState, JsonValue, RecordId, RelatedRecord, Value } from '@fieldia/core';
import { fillIn, maker, setHidden, setText, wordsFor } from './kind-parts';
import { formatNumber, normalizeNumber } from './numbers';
import { many2oneWidget } from './relations';
import type { Widget, WidgetFactory } from './widgets';

/**
 * An analytic distribution: Flectra's widget="analytic_distribution". Its
 * value is an object of shares by account, `{"12": 60, "14": 40}`, the key
 * an account's id (or ids joined by commas, one per plan), the share a per
 * cent. Shown as lines — the account, found by its name among the records of
 * `options.model`, and its share — with their total, and words when they do
 * not add up to 100 %. A new line takes what is left of 100 %.
 */

interface Row {
  /** The account's id, as the value keys it; empty while a new line has none yet. */
  key: string;
  share: number;
  /** Who drew it, so a line typed in keeps its widgets. */
  element: HTMLTableRowElement;
  account: Widget;
  input: HTMLInputElement;
  remove: HTMLButtonElement;
}

const sharesOf = (value: Value | undefined): [string, number][] =>
  value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>).map(([key, share]) => [key, typeof share === 'number' ? share : Number(share) || 0]) : [];

export const distributionWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document, labels, locale = 'en' } = context;
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const model = typeof node.options?.['model'] === 'string' ? (node.options['model'] as string) : 'account.analytic.account';
  /** The accounts' names, by their key, as they are found. */
  const names = new Map<string, string>();
  const nameOf = (key: string) => key.split(',').map((one) => names.get(one) ?? `#${one}`).join(' · ');
  const percent = (n: number) => `${formatNumber(n, Number.isInteger(n) ? 0 : 2, locale)}%`;

  const body = make('tbody');
  const total = make('td', { class: 'fd-distribution-total' });
  const table = make(
    'table',
    { class: 'fd-lines-table fd-distribution-table' },
    make('thead', {}, make('tr', {}, make('th', { scope: 'col' }, words.account), make('th', { scope: 'col', class: 'fd-distribution-share' }, words.share), make('th', { class: 'fd-lines-tools' }))),
    body,
    make('tfoot', {}, make('tr', { class: 'fd-lines-totals' }, make('td', {}, words.total), total, make('td')))
  );
  const add = make('button', { type: 'button', class: 'fd-button fd-button-link fd-lines-add fd-distribution-add' }, `+ ${words.addAccount}`);
  const off = make('div', { class: 'fd-warning fd-distribution-off', role: 'status', hidden: '' });
  const element = make('div', { id, class: 'fd-distribution', role: 'group' }, make('div', { class: 'fd-lines-scroll' }, table), add, off);
  let rows: Row[] = [];
  let readonly = false;

  /** The value the lines say: those with an account, in their order. */
  function save() {
    const value: Record<string, number> = {};
    for (const row of rows) if (row.key) value[row.key] = row.share;
    form.setValue(name, (rows.some((row) => row.key) ? value : null) as JsonValue);
  }

  function makeRow(key: string, share: number): Row {
    const n = rows.length;
    const cellId = `${id}-${n}-${Math.random().toString(36).slice(2, 7)}`;
    // The account's own link box: it searches the model's records, and its pick becomes the line's key.
    const row = { key, share } as Row;
    const own: Form = {
      ...form,
      getState: (): FormState => ({ ...form.getState(), values: { account: row.key ? ({ id: row.key, label: nameOf(row.key) } as RelatedRecord) : null } }),
      setValue: (_name: string, picked: Value) => {
        const record = picked as RelatedRecord | null;
        row.key = record ? String(record.id) : '';
        if (record) names.set(String(record.id), record.label);
        save();
      },
      search: (_name: string, query: string, limit?: number) => form.search(name, query, limit, { model }),
      canCreate: () => false,
    };
    const accountField = { type: 'many2one', label: words.account, relation: model } as Field;
    row.account = many2oneWidget({ ...context, form: own, name: 'account', field: accountField, node: { type: 'field', id: `${node.id}.account`, field: 'account', options: { create: false } }, id: cellId });
    row.input = make('input', { type: 'text', class: 'fd-input fd-number-input fd-share', inputmode: 'decimal', autocomplete: 'off', 'aria-label': words.share });
    row.input.addEventListener('input', () => {
      const text = normalizeNumber(row.input.value.trim(), locale);
      if (!/^\d+\.?\d*$|^\.\d+$/.test(text)) return;
      row.share = Number(text);
      save();
    });
    row.remove = make('button', { type: 'button', class: 'fd-line-delete', 'aria-label': words.deleteLine }, '×');
    row.remove.addEventListener('click', () => {
      rows = rows.filter((other) => other !== row);
      row.account.destroy?.();
      row.element.remove();
      save();
      draw();
    });
    row.element = make('tr', {}, make('td', {}, make('label', { class: 'fd-sr-only', for: cellId }, words.account), row.account.element), make('td', { class: 'fd-distribution-share' }, make('span', { class: 'fd-number' }, row.input, make('span', { class: 'fd-unit' }, '%'))), make('td', { class: 'fd-lines-tools' }, row.remove));
    return row;
  }

  add.addEventListener('click', () => {
    const left = Math.max(0, 100 - rows.reduce((sum, row) => sum + row.share, 0));
    const row = makeRow('', Math.round(left * 100) / 100);
    rows.push(row);
    body.append(row.element);
    draw();
    row.account.focus();
  });

  /** Names for the accounts the value holds that are not known yet. */
  let asked = '';
  function findNames(keys: string[]) {
    const unknown = [...new Set(keys.flatMap((key) => key.split(',')))].filter((one) => !names.has(one));
    if (!unknown.length || unknown.join() === asked) return;
    asked = unknown.join();
    const ids: RecordId[] = unknown.map((one) => (/^\d+$/.test(one) ? Number(one) : one));
    form.search(name, '', unknown.length, { model, ids }).then(
      (found) => {
        for (const record of found) names.set(String(record.id), record.label);
        draw();
      },
      () => undefined
    );
  }

  function draw() {
    const sum = rows.reduce((total, row) => total + row.share, 0);
    setText(total, percent(Math.round(sum * 100) / 100));
    const wrong = rows.some((row) => row.key) && Math.abs(sum - 100) > 0.001;
    setText(off, wrong ? fillIn(words.sharesOff, { n: percent(Math.round(sum * 100) / 100) }) : '');
    setHidden(off, !wrong);
    setHidden(add, readonly);
    for (const row of rows) {
      row.account.update({ value: row.key ? { id: row.key, label: nameOf(row.key) } : null, values: {}, readonly, required: false, invalid: false });
      const text = formatNumber(row.share, Number.isInteger(row.share) ? 0 : 2, locale);
      if (document.activeElement !== row.input && row.input.value !== text) row.input.value = text;
      row.input.readOnly = readonly;
      if (readonly) row.remove.remove();
      else if (!row.remove.isConnected) row.element.lastElementChild?.append(row.remove);
    }
  }

  return {
    element,
    focus: () => (rows[0]?.input ?? add).focus(),
    destroy: () => rows.forEach((row) => row.account.destroy?.()),
    update(state) {
      readonly = state.readonly;
      const shares = sharesOf(state.value);
      // Lines follow the value: those it holds, in its order, and a new one still without its account.
      const same = shares.length === rows.filter((row) => row.key).length && shares.every(([key, share], i) => rows.filter((row) => row.key)[i]?.key === key && rows.filter((row) => row.key)[i]?.share === share);
      if (!same) {
        for (const row of rows) row.account.destroy?.();
        const waiting = rows.filter((row) => !row.key);
        rows = shares.map(([key, share]) => makeRow(key, share));
        rows.push(...waiting.map((row) => makeRow('', row.share)));
        body.replaceChildren(...rows.map((row) => row.element));
      }
      findNames(shares.map(([key]) => key));
      draw();
    },
  };
};
