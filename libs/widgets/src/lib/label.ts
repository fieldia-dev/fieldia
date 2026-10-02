import type { Locale, RelatedRecord, Value } from '@fieldia/core';
import { formatNumber } from './numbers';
import { summary, type WidgetFactory } from './widgets';

/**
 * A value shown as text between a prefix and a suffix: "24 months",
 * "240.0 m". Never edited. Options:
 *
 *   prefix, suffix            words around the value
 *   prefixField, suffixField  a field whose value is the prefix or suffix instead
 */

/** Another field's value as words: a link's label, or the value itself. */
function words(value: Value | undefined): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && 'label' in (value as object)) return (value as RelatedRecord).label;
  return String(value);
}

export const labelWidget: WidgetFactory = ({ field, node, id, document, locale = 'en' as Locale }) => {
  const options = node.options ?? {};
  const text = (key: 'prefix' | 'suffix') => (typeof options[key] === 'string' ? (options[key] as string) : '');
  const from = (key: 'prefixField' | 'suffixField') => (typeof options[key] === 'string' ? (options[key] as string) : null);
  const decimals =
    field.type === 'integer' ? 0 : field.type === 'float' || field.type === 'monetary' ? (field.digits?.[1] ?? 2) : null;

  const output = document.createElement('output');
  output.id = id;
  output.className = 'fd-value-text';
  return {
    element: output,
    focus: () => undefined,
    update({ value, values }) {
      if (value === null || value === undefined || value === '') {
        output.textContent = '';
        return;
      }
      const shown = decimals !== null && typeof value === 'number' ? formatNumber(value, decimals, locale) : summary(value, field);
      const prefixField = from('prefixField');
      const suffixField = from('suffixField');
      const prefix = prefixField ? words(values[prefixField]) : text('prefix');
      const suffix = suffixField ? words(values[suffixField]) : text('suffix');
      output.textContent = [prefix, shown, suffix].filter((part) => part !== '').join(' ');
    },
  };
};
