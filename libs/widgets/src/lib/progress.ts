import type { Locale } from '@fieldia/core';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/**
 * A number shown as a bar that fills towards a maximum, coloured by how far
 * it has come: red under 30 %, yellow under 70 %, green from there. Options:
 *
 *   max        the maximum: the field's own, else 100 (min: the field's own, else 0)
 *   maxField   a number field that holds the maximum instead
 *   color      "auto", or always "success", "warning", "danger" or "info"
 *   showPercent  false to leave the percentage off the bar
 *   editable   true for a box beside the bar to type the value in
 */

const percents = new Map<Locale, Intl.NumberFormat>();
function percent(value: number, locale: Locale) {
  let format = percents.get(locale);
  if (!format) {
    format = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0, numberingSystem: 'latn' });
    percents.set(locale, format);
  }
  return format.format(value / 100);
}

export const progressbarWidget: WidgetFactory = (context) => {
  const { field, node, id, document, locale = 'en' } = context;
  const options = node.options ?? {};
  const range = (key: 'min' | 'max', usual: number) => {
    const set = options[key] ?? (field as Record<string, unknown>)[key];
    return typeof set === 'number' ? set : usual;
  };
  const min = range('min', 0);
  const fixedMax = range('max', 100);
  const maxField = typeof options['maxField'] === 'string' ? options['maxField'] : null;
  const color = typeof options['color'] === 'string' ? options['color'] : 'auto';
  const showPercent = options['showPercent'] !== false;

  const bar = document.createElement('div');
  bar.className = 'fd-progressbar';
  bar.setAttribute('role', 'progressbar');
  // Named by its field: a <label> cannot name it, and in a table's cell nothing else does. The viewer's own name, where it gives one, wins.
  bar.setAttribute('aria-label', node.label ?? field.label);
  const fill = document.createElement('div');
  fill.className = 'fd-progressbar-fill';
  const text = document.createElement('span');
  text.className = 'fd-progressbar-text';
  bar.append(fill, text);

  // Editable: the field's own number box takes the value; the bar beside it only shows it.
  let box: Widget | null = null;
  let element: HTMLElement = bar;
  if (options['editable'] === true) {
    box = createWidget({ ...context, node: { ...node, widget: undefined } });
    bar.setAttribute('aria-hidden', 'true');
    element = document.createElement('div');
    element.className = 'fd-progressbar-edit';
    element.append(bar, box.element);
  } else {
    bar.id = id;
  }

  return {
    element,
    focus: () => box?.focus(),
    update(state) {
      const value = typeof state.value === 'number' ? state.value : 0;
      const max = maxField ? Number(state.values[maxField] ?? 0) : fixedMax;
      const share = max > min ? Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100)) : 0;
      const rounded = Math.round(share * 10) / 10;
      fill.style.width = `${rounded}%`;
      bar.setAttribute('aria-valuenow', String(value));
      bar.setAttribute('aria-valuemin', String(min));
      bar.setAttribute('aria-valuemax', String(max));
      bar.setAttribute('aria-valuetext', percent(share, locale));
      text.textContent = showPercent ? percent(share, locale) : '';
      bar.dataset['tone'] = color !== 'auto' ? color : share < 30 ? 'danger' : share < 70 ? 'warning' : 'success';
      box?.update(state);
    },
  };
};
