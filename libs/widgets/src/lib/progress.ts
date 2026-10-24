import type { Field, Locale } from '@fieldia/core';
import { installSurveyStyles } from './styles-survey';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';
import { intlFormat } from '@fieldia/core';

/**
 * A number shown as a bar that fills towards a maximum, coloured by how far
 * it has come: red under 30 %, yellow under 70 %, green from there. Options:
 *
 *   max        the maximum: the field's own, else 100 (min: the field's own, else 0)
 *   maxField   a number field that holds the maximum instead
 *   color      "auto", or always "success", "warning", "danger" or "info"
 *   showPercent  false to leave the percentage off the bar
 *   editable   true for a box beside the bar to type the value in
 *
 * The box is the number box, drawn by `widgetFor`: the main script's createWidget,
 * which the registry hands over (widgets.ts), so this part never imports it.
 */

function percent(value: number, locale: Locale) {
  return intlFormat('NumberFormat', locale, { style: 'percent', maximumFractionDigits: 0, numberingSystem: 'latn' }).format(value / 100);
}

export const progressbarWidget = (widgetFor: (context: WidgetContext) => Widget): WidgetFactory => (context) => {
  const { field, node, id, document, locale = 'en' } = context;
  installSurveyStyles(document);
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
  const fill = document.createElement('div');
  fill.className = 'fd-progressbar-fill';
  const text = document.createElement('span');
  text.className = 'fd-progressbar-text';
  bar.append(fill, text);

  // Editable: the field's own number box takes the value; the bar beside it only shows it.
  let box: Widget | null = null;
  let element: HTMLElement = bar;
  if (options['editable'] === true) {
    // The bar's own range is the box's least and most: a minus is refused where it starts at 0 or more, and a value
    // outside is said on leaving and at Save (checkInput), so the bar and its box never disagree.
    const ranged = { ...field, min, ...(maxField ? {} : { max: fixedMax }) } as Field;
    box = widgetFor({ ...context, field: ranged, node: { ...node, widget: undefined } });
    bar.setAttribute('aria-hidden', 'true');
    element = document.createElement('div');
    element.className = 'fd-progressbar-edit';
    element.append(bar, box.element);
  } else {
    bar.id = id;
    // Named by its field: a <label> cannot name it, and in a table's cell nothing else does. The viewer's own name, where it gives one, wins.
    // (Beside its own box it is hidden, the box being what is named and typed in.)
    bar.setAttribute('aria-label', node.label ?? field.label);
  }

  return {
    element,
    focus: () => box?.focus(),
    update(state) {
      const value = typeof state.value === 'number' ? state.value : 0;
      const max = maxField ? Number(state.values[maxField] ?? 0) : fixedMax;
      // The bar fills no further than its ends; its words say the real share ("150%"), as a screen reader hears it.
      const real = max > min ? ((value - min) / (max - min)) * 100 : 0;
      const share = Math.min(100, Math.max(0, real));
      const rounded = Math.round(share * 10) / 10;
      fill.style.width = `${rounded}%`;
      bar.setAttribute('aria-valuenow', String(value));
      bar.setAttribute('aria-valuemin', String(min));
      bar.setAttribute('aria-valuemax', String(max));
      bar.setAttribute('aria-valuetext', percent(real, locale));
      text.textContent = showPercent ? percent(real, locale) : '';
      bar.dataset['tone'] = color !== 'auto' ? color : share < 30 ? 'danger' : share < 70 ? 'warning' : 'success';
      box?.update(state);
    },
  };
};
