import type { FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { columnsEditor } from './columns-editor';
import type { Designer } from './designer';
import { kindOfField } from './kinds';

/**
 * What a kind of field has beyond its words, set in the picked field itself,
 * where it is seen: a rating's levels, where a scale starts and ends, an
 * amount's currency, what a link points to, a table's columns. A field of
 * the model keeps the model's, so it has none here. The panel has the same.
 */

export interface InlineSettings {
  element: HTMLElement;
  /** Draw for the field as it is now; true when the settings stand in for its widget, as a table's columns do. */
  update(page: Page, node: FieldNode): boolean;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

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
      element.replaceChildren(word('From', from), word('to', to));
      refresh = (page, node) => {
        const def = page.fields[node.field];
        from.value = String('min' in def && def.min !== undefined ? def.min : 0);
        to.value = String('max' in def && def.max !== undefined ? def.max : 10);
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
    } else if (kind === 'lines') {
      const columns = columnsEditor(el, designer, id);
      element.replaceChildren(columns.element);
      standsIn = true;
      refresh = (page, node) => columns.update(page.fields[node.field]);
    } else element.replaceChildren();
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
