import type { RelatedRecord } from '@fieldia/core';
import type { WidgetFactory } from './widgets';

/**
 * Where a record stands, as a row of steps with the current one marked: a
 * selection's states, or the records a link may point to (stages). Used in a
 * sheet's header, and anywhere in a form with `"widget": "statusbar"`. Options:
 *
 *   clickable      true to let a click move the record to another step
 *   visibleStates  the values to show; the current one always shows
 */

interface Step {
  key: string;
  label: string;
  value: unknown;
}

export const statusbarWidget: WidgetFactory = ({ form, name, field, node, id, document }) => {
  const options = node.options ?? {};
  const clickable = options['clickable'] === true;
  const visible = Array.isArray(options['visibleStates']) ? options['visibleStates'] : null;
  const list = document.createElement('ol');
  list.className = 'fd-statusbar';
  list.id = id;
  list.setAttribute('aria-label', field.label);

  const keyOf = (value: unknown) =>
    value && typeof value === 'object' && 'id' in value ? `id:${String((value as RelatedRecord).id)}` : `v:${String(value)}`;
  // A selection knows its steps; a link's are looked up once.
  let steps: Step[] =
    field.type === 'selection' ? field.options.map((o) => ({ key: keyOf(o.value), label: o.label, value: o.value })) : [];
  let lookedUp = field.type === 'selection';
  let last: { value: unknown; readonly: boolean } = { value: undefined, readonly: false };

  function draw() {
    const { value, readonly } = last;
    const currentKey = value === null || value === undefined ? null : keyOf(value);
    let shown = steps.filter((s) => !visible || visible.some((v) => keyOf(v) === s.key) || s.key === currentKey);
    if (currentKey && !shown.some((s) => s.key === currentKey) && value && typeof value === 'object') {
      shown = [...shown, { key: currentKey, label: (value as RelatedRecord).label, value }];
    }
    list.replaceChildren(
      ...shown.map((step) => {
        const label = document.createElement('span');
        label.textContent = step.label;
        const inner = document.createElement(clickable ? 'button' : 'span');
        if (inner instanceof HTMLButtonElement) {
          inner.type = 'button';
          inner.disabled = readonly;
          inner.addEventListener('click', () => form.setValue(name, step.value as never));
        }
        inner.append(label);
        if (step.key === currentKey) inner.setAttribute('aria-current', 'step');
        const item = document.createElement('li');
        item.append(inner);
        return item;
      })
    );
  }

  return {
    element: list,
    focus: () => list.querySelector<HTMLElement>('button:not([disabled])')?.focus(),
    update(state) {
      last = { value: state.value, readonly: state.readonly };
      draw();
      if (!lookedUp) {
        lookedUp = true;
        void form
          .search(name, '', 20)
          .then((records) => {
            steps = records.map((r) => ({ key: keyOf(r), label: r.label, value: r }));
            draw();
          })
          .catch(() => undefined);
      }
    },
  };
};
