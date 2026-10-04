import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { columnsEditor } from './columns-editor';
import type { Designer } from './designer';
import { kindOfField } from './kinds';
import { kindSettings } from './kind-settings';

/**
 * What a kind of field has beyond its words, set in the picked field itself,
 * where it is seen: a rating's levels, where a scale starts and ends, an
 * amount's currency, what a link points to, a table's columns — and the
 * newer kinds' own, from `kind-settings`. A field of the model keeps the
 * model's, so it has none here. The panel has the same.
 */

export interface InlineSettings {
  element: HTMLElement;
  /** Draw for the field as it is now; true when the settings stand in for its widget, as a table's columns do. */
  update(page: Page, node: FieldNode): boolean;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

/** Kinds of file, as people name them, and the media types each takes. */
const FILE_TYPES: [string, string[]][] = [
  ['Images', ['image/*']],
  ['PDF', ['application/pdf']],
  ['Documents', ['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.oasis.opendocument.text', 'text/plain']],
  ['Spreadsheets', ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.oasis.opendocument.spreadsheet', 'text/csv']],
  ['Presentations', ['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.oasis.opendocument.presentation']],
  ['Video', ['video/*']],
  ['Audio', ['audio/*']],
];
/** The largest file, in bytes, and in words. */
const FILE_SIZES: [number, string][] = [
  [1024 * 1024, '1 MB'],
  [10 * 1024 * 1024, '10 MB'],
  [100 * 1024 * 1024, '100 MB'],
  [1024 * 1024 * 1024, '1 GB'],
];

export function inlineSettings(el: ElementFactory, designer: Designer, id: string): InlineSettings {
  const element = el('div', { class: 'fd-inline-settings', hidden: '' });
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const select = (label: string, values: string[]) => el('select', { class: 'fd-inline-select', 'aria-label': label }, ...values.map((v) => el('option', { value: v }, v))) as HTMLSelectElement;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  let drawn = '';
  let refresh: (page: Page, node: FieldNode) => void = () => undefined;
  let standsIn = false;

  function build(kind: string | null) {
    standsIn = false;
    refresh = () => undefined;
    if (kind === 'rating') {
      const levels = select('Levels', range(3, 10));
      levels.addEventListener('change', () => designer.setRange(id, { min: 1, max: Number(levels.value) }));
      element.replaceChildren(word('Levels', levels));
      refresh = (page, node) => {
        const def = page.fields[node.field];
        levels.value = String('max' in def && def.max !== undefined ? def.max : 5);
      };
    } else if (kind === 'scale') {
      const from = select('From', ['0', '1']);
      const to = select('To', range(2, 10));
      const save = () => designer.setRange(id, { min: Number(from.value), max: Number(to.value) });
      from.addEventListener('change', save);
      to.addEventListener('change', save);
      // Words at either end, each typed beside its number, as Google Forms has them.
      const end = (which: 'start' | 'end') => {
        const number = el('span', { class: 'fd-inline-end-number' });
        const words = el('input', { class: 'fd-inline-input fd-inline-end-words', 'aria-label': `Words at the ${which}`, placeholder: 'Label (optional)', autocomplete: 'off' }) as HTMLInputElement;
        words.addEventListener('input', () => designer.setWidgetOptions(id, { [`${which}Label`]: words.value }));
        return { element: el('label', { class: 'fd-inline-end' }, number, words), number, words };
      };
      const start = end('start');
      const finish = end('end');
      element.replaceChildren(el('div', { class: 'fd-inline-row' }, word('From', from), word('to', to)), start.element, finish.element);
      refresh = (page, node) => {
        const def = page.fields[node.field];
        const min = 'min' in def && def.min !== undefined ? def.min : 0;
        const max = 'max' in def && def.max !== undefined ? def.max : 10;
        from.value = String(min);
        to.value = String(max);
        start.number.textContent = String(min);
        finish.number.textContent = String(max);
        if (!focused(start.words)) start.words.value = String(node.options?.['startLabel'] ?? '');
        if (!focused(finish.words)) finish.words.value = String(node.options?.['endLabel'] ?? '');
      };
    } else if (kind === 'amount') {
      const currency = el('input', { class: 'fd-inline-input fd-inline-currency', 'aria-label': 'Currency', maxlength: '3', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      // Three letters make a currency; until then nothing is saved.
      currency.addEventListener('input', () => /^[A-Za-z]{3}$/.test(currency.value.trim()) && designer.setCurrency(id, currency.value));
      element.replaceChildren(word('Currency', currency));
      refresh = (page, node) => {
        const def = page.fields[node.field];
        if (!focused(currency)) currency.value = def.type === 'monetary' ? (def.currency ?? '') : '';
      };
    } else if (kind === 'link' || kind === 'links') {
      const target = el('input', { class: 'fd-inline-input', 'aria-label': 'Links to', placeholder: 'contact', autocomplete: 'off', spellcheck: 'false' }) as HTMLInputElement;
      target.addEventListener('input', () => target.value.trim() && designer.setRelation(id, target.value));
      element.replaceChildren(word('Links to', target));
      refresh = (page, node) => {
        const def = page.fields[node.field];
        if (!focused(target)) target.value = 'relation' in def ? def.relation : '';
      };
    } else if (kind === 'file') {
      // Which kinds of file it takes — none picked, any — and the largest.
      const types = FILE_TYPES.map(([label, accept]) => {
        const button = el('button', { type: 'button', class: 'fd-inline-chip', 'aria-pressed': 'false' }, label) as HTMLButtonElement;
        button.addEventListener('click', () => {
          const on = new Set(current());
          const all = accept.every((a) => on.has(a));
          for (const a of accept) {
            if (all) on.delete(a);
            else on.add(a);
          }
          designer.setFileRules(id, { accept: FILE_TYPES.flatMap(([, list]) => list).filter((a) => on.has(a)) });
        });
        return { button, accept };
      });
      let current: () => string[] = () => [];
      const largest = select('Largest file', FILE_SIZES.map(([bytes]) => String(bytes)));
      FILE_SIZES.forEach(([, words], i) => (largest.options[i].textContent = words));
      largest.addEventListener('change', () => designer.setFileRules(id, { maxSize: Number(largest.value) }));
      element.replaceChildren(
        el('div', { class: 'fd-inline-row' }, el('span', {}, 'Takes only'), el('div', { class: 'fd-inline-chips', role: 'group', 'aria-label': 'Kinds of file' }, ...types.map((t) => t.button))),
        word('Largest file', largest)
      );
      refresh = (page, node) => {
        const def = page.fields[node.field];
        const accept = def.type === 'binary' ? (def.accept ?? []) : [];
        current = () => accept;
        for (const t of types) t.button.setAttribute('aria-pressed', String(t.accept.every((a) => accept.includes(a))));
        largest.value = String(def.type === 'binary' && def.maxSize ? def.maxSize : FILE_SIZES[1][0]);
      };
    } else if (kind === 'lines') {
      const columns = columnsEditor(el, designer, id);
      element.replaceChildren(columns.element);
      standsIn = true;
      refresh = (page, node) => columns.update(page.fields[node.field]);
    } else {
      // The newer kinds, and the choices' Shuffle and points.
      const more = kindSettings(el, designer, id, kind);
      element.replaceChildren(...(more?.elements ?? []));
      standsIn = more?.standsIn ?? false;
      if (more) refresh = more.refresh;
    }
  }

  return {
    element,
    update(page, node) {
      const def = page.fields[node.field];
      const kind = designer.isFromModel(id) ? null : kindOfField(def, node);
      if ((kind ?? '') !== drawn) {
        drawn = kind ?? '';
        build(kind);
      }
      element.hidden = !element.childElementCount;
      refresh(page, node);
      return standsIn && !element.hidden;
    },
  };
}
