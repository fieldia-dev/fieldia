import type { Field, Value } from '@fieldia/core';
import type { WidgetFactory } from './widgets';

/**
 * A matrix question: rows down the side, columns across — a Likert grid. Each
 * row is a group of radios (or of boxes when several may be chosen), named by
 * its row for screen readers, so the arrow keys move within a row. The table
 * scrolls sideways inside its own box when the screen is narrow.
 */
export const matrixWidget: WidgetFactory = ({ form, name, field, id, document }) => {
  const def = field as Extract<Field, { type: 'matrix' }>;
  const kind = def.multiple ? 'checkbox' : 'radio';
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) => {
    const element = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
    element.append(...children);
    return element;
  };
  const table = make('table', { id, class: 'fd-matrix-table' });
  table.append(make('thead', {}, make('tr', {}, make('th', { scope: 'col' }), ...def.columns.map((c) => make('th', { scope: 'col' }, c.label)))));
  const body = make('tbody');
  const inputs: HTMLInputElement[] = [];
  for (const row of def.rows) {
    const tr = make('tr', { role: kind === 'radio' ? 'radiogroup' : 'group', 'aria-label': row.label });
    tr.append(make('th', { scope: 'row' }, row.label));
    for (const column of def.columns) {
      const input = make('input', { type: kind, name: `${id}-${row.value}`, value: String(column.value), 'data-row': String(row.value), 'aria-label': `${row.label}: ${column.label}` }) as HTMLInputElement;
      input.addEventListener('change', save);
      inputs.push(input);
      tr.append(make('td', {}, input));
    }
    body.append(tr);
  }
  table.append(body);
  const element = make('div', { class: 'fd-matrix' }, table);

  /** Column values come back as written: a number stays a number. */
  const columnValue = (text: string) => def.columns.find((c) => String(c.value) === text)?.value ?? text;
  function save() {
    const value: Record<string, Value> = {};
    for (const row of def.rows) {
      const picked = inputs.filter((i) => i.dataset['row'] === String(row.value) && i.checked).map((i) => columnValue(i.value));
      if (def.multiple ? picked.length : picked.length === 1) value[String(row.value)] = (def.multiple ? picked : picked[0]) as Value;
    }
    form.setValue(name, Object.keys(value).length ? (value as Value) : null);
  }

  return {
    element,
    focus: () => (inputs.find((i) => i.checked) ?? inputs[0])?.focus(),
    update(state) {
      const value = state.value && typeof state.value === 'object' && !Array.isArray(state.value) ? (state.value as Record<string, unknown>) : {};
      for (const input of inputs) {
        const answer = value[input.dataset['row'] ?? ''];
        const chosen = Array.isArray(answer) ? answer.map(String) : answer === undefined || answer === null ? [] : [String(answer)];
        input.checked = chosen.includes(input.value);
        input.disabled = state.readonly;
      }
      table.setAttribute('aria-invalid', String(state.invalid));
      table.setAttribute('aria-required', String(state.required));
      if (state.describedBy) table.setAttribute('aria-describedby', state.describedBy);
      else table.removeAttribute('aria-describedby');
    },
  };
};
