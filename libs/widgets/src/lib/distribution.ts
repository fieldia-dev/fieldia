import { readNumber, type Field, type Form, type FormState, type JsonValue, type Locale, type RecordId, type RelatedRecord, type Value } from '@fieldia/core';
import { fillIn, maker, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { guard, leftWords, numberFits, numberRules, refusalHint, type Guard, type NumberBox, type RefusalHint } from './input-rules';
import { formatNumber } from './numbers';
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
  /** Its share's box's input rules, and their hint. */
  checks: Guard;
  hint: RefusalHint;
  /** Text left in its share's box that does not read, and why: the share keeps what it held. */
  unread: { text: string; message: string } | null;
  /** An account's name typed that names none, or is still looked up, and why: the line keeps the account it had. */
  accountUnread: { text: string; message: string } | null;
}

/** The model a distribution's accounts are records of: its `options.model`, else Flectra's analytic accounts. */
export const distributionModel = (options: Readonly<Record<string, unknown>> | undefined): string => (typeof options?.['model'] === 'string' ? (options['model'] as string) : 'account.analytic.account');

/** The accounts' ids a distribution names, each once, as a data source finds them. */
export function distributionIds(value: Value | undefined): RecordId[] {
  return [...new Set(sharesOf(value).flatMap(([key]) => key.split(',')))].map((one) => (/^\d+$/.test(one) ? Number(one) : one));
}

/**
 * A distribution in a few words, for a table's cell: each account by its
 * name — `nameOf`, when it knows it — and its share, "Sales 60% · Marketing
 * 40%"; the shares alone without names. Empty for none.
 */
export function distributionWords(value: Value | undefined, locale: Locale = 'en', nameOf?: (id: string) => string | undefined): string {
  const percent = (n: number) => `${formatNumber(n, Number.isInteger(n) ? 0 : 2, locale)}%`;
  return sharesOf(value)
    .map(([key, share]) => {
      const name = nameOf ? key.split(',').map((one) => nameOf(one) ?? `#${one}`).join(' · ') : '';
      return name ? `${name} ${percent(share)}` : percent(share);
    })
    .join(nameOf ? ', ' : ' · ');
}

const sharesOf = (value: Value | undefined): [string, number][] =>
  value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>).map(([key, share]) => [key, typeof share === 'number' ? share : Number(share) || 0]) : [];

export const distributionWidget: WidgetFactory = (context) => {
  const { form, name, node, id, document, labels, locale = 'en' } = context;
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const model = distributionModel(node.options);
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
  const off = make('div', { class: 'fd-warning fd-distribution-off', id: `${id}-off`, role: 'status', hidden: '' });
  const element = make('div', { id, class: 'fd-distribution', role: 'group' }, make('div', { class: 'fd-lines-scroll' }, table), add, off);
  let rows: Row[] = [];
  let readonly = false;
  // A share is a per cent of 0 or more, with two places at most; "25%" and "٢٥٪" read too.
  const shareBox: NumberBox & { percent: boolean } = { label: words.share, locale, labels, limits: () => ({ min: 0, places: 2, percent: true }), percent: true };
  /** The share and account boxes' unread text is the field's: Save refuses while one holds any. */
  function sayUnread() {
    const first = rows.find((row) => row.accountUnread)?.accountUnread ?? rows.find((row) => row.unread)?.unread ?? null;
    form.setUnread(name, first);
  }

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
      getState: (): FormState => ({ ...form.getState(), values: { account: row.key ? ({ id: row.key, label: nameOf(row.key) } as RelatedRecord) : null }, unread: row.accountUnread ? { account: row.accountUnread } : {} }),
      // An account's name that names none is the distribution's unread text: Save waits for it.
      setUnread: (_name: string, unread) => {
        row.accountUnread = unread;
        sayUnread();
      },
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
    row.unread = null;
    row.accountUnread = null;
    const shareCell = make('span', { class: 'fd-number' }, row.input, make('span', { class: 'fd-unit' }, '%'));
    row.hint = refusalHint(row.input, shareCell);
    row.checks = guard(row.input, numberRules(shareBox), row.hint);
    row.input.addEventListener('input', () => {
      const read = readNumber(row.input.value, locale, { percent: true });
      // Half-typed, emptied, not reading yet or not as it stands ("12.345" in two places): the share waits for the box to be left.
      if (!read.ok || read.value === null || !numberFits(row.input.value, shareBox)) return;
      // Saved first: the value and the lines agree before anything else is told.
      row.share = read.value;
      const had = !!row.unread;
      row.unread = null;
      save();
      if (had) sayUnread();
    });
    let entered = row.share;
    row.input.addEventListener('focus', () => (entered = row.share));
    /** The share as typed, read as its box is left or as a save reads it first (a change): never one passed on the way. */
    const read = () => {
      if (row.input.readOnly) return;
      // Keys held after a refused one are part of what was typed; the row's own words take over from the hint.
      const held = row.checks.held();
      if (held) row.hint.hide();
      const text = held?.text ?? row.input.value;
      const reading = readNumber(text, locale, { percent: true });
      // A share the box held as it was entered (one from outside with more places) is let be.
      const words = held ? (leftWords(text, shareBox) ?? held.words) : reading.ok && reading.value === entered ? null : leftWords(text, shareBox);
      if (held) {
        row.input.value = text;
        row.checks.accept();
      }
      if (words) {
        // Kept as typed, marked, with why; the share keeps what it held as the box was entered.
        if (row.share !== entered) {
          row.share = entered;
          save();
        }
        row.unread = { text, message: words };
        sayUnread();
        draw();
        return;
      }
      // Emptied and left, a share is 0, and the total shows it.
      const read = readNumber(text, locale, { percent: true });
      row.share = read.ok && read.value !== null ? read.value : 0;
      const had = !!row.unread;
      row.unread = null;
      save();
      if (had) sayUnread();
      draw();
    };
    row.input.addEventListener('change', read);
    row.input.addEventListener('blur', read);
    row.remove = make('button', { type: 'button', class: 'fd-line-delete', 'aria-label': words.deleteLine }, '×');
    row.remove.addEventListener('click', () => {
      rows = rows.filter((other) => other !== row);
      row.account.destroy?.();
      row.checks.destroy();
      row.element.remove();
      if (row.unread || row.accountUnread) sayUnread();
      save();
      draw();
    });
    row.element = make('tr', {}, make('td', {}, make('label', { class: 'fd-sr-only', for: cellId }, words.account), row.account.element), make('td', { class: 'fd-distribution-share' }, shareCell), make('td', { class: 'fd-lines-tools' }, row.remove));
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
    // A share left that does not read is said first: the total cannot be trusted until it is fixed.
    const unread = rows.find((row) => row.accountUnread)?.accountUnread?.message ?? rows.find((row) => row.unread)?.unread?.message ?? '';
    setText(off, unread || (wrong ? fillIn(words.sharesOff, { n: percent(Math.round(sum * 100) / 100) }) : ''));
    setHidden(off, !unread && !wrong);
    setHidden(add, readonly);
    for (const row of rows) {
      row.account.update({ value: row.key ? { id: row.key, label: nameOf(row.key) } : null, values: {}, readonly, required: false, invalid: false });
      // A box holding text that does not read keeps it, marked, until it is put right.
      const text = row.unread ? row.unread.text : formatNumber(row.share, Number.isInteger(row.share) ? 0 : 2, locale);
      if (document.activeElement !== row.input && row.input.value !== text) row.input.value = text;
      setAttr(row.input, 'aria-invalid', row.unread ? 'true' : null);
      setAttr(row.input, 'aria-describedby', row.hint.describedBy(row.unread ? off.id : undefined) ?? null);
      row.input.readOnly = readonly;
      if (readonly) row.remove.remove();
      else if (!row.remove.isConnected) row.element.lastElementChild?.append(row.remove);
    }
  }

  return {
    element,
    focus: () => (rows[0]?.input ?? add).focus(),
    destroy: () =>
      rows.forEach((row) => {
        row.account.destroy?.();
        row.checks.destroy();
      }),
    update(state) {
      readonly = state.readonly;
      const shares = sharesOf(state.value);
      // Lines follow the value: those it holds, in its order, and a new one still without its account.
      const same = shares.length === rows.filter((row) => row.key).length && shares.every(([key, share], i) => rows.filter((row) => row.key)[i]?.key === key && rows.filter((row) => row.key)[i]?.share === share);
      if (!same) {
        for (const row of rows) {
          row.account.destroy?.();
          row.checks.destroy();
        }
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
