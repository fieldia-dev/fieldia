import type { LineField, Locale, Tone } from '@fieldia/core';
import { displayValue } from './display';
import type { WidgetFactory } from './widgets';

/** The tones a value may be given. */
const TONES = new Set<Tone>(['info', 'success', 'warning', 'danger', 'muted']);

/**
 * A value drawn as a pill, never edited: Flectra's `widget="badge"`. Its
 * colour is the tone `options.tones` gives its value — `{ "high": "danger" }`
 * — else the tone of the part it sits in (a field's `tones`, a cell's), else
 * grey. Empty, it draws nothing.
 */
export const badgeWidget: WidgetFactory = ({ field, node, id, document, locale = 'en' as Locale }) => {
  const tones = (node.options?.['tones'] ?? {}) as Record<string, unknown>;
  const pill = document.createElement('span');
  pill.id = id;
  pill.className = 'fd-value-badge';
  pill.hidden = true;
  return {
    element: pill,
    focus: () => undefined,
    update({ value, values }) {
      const text = displayValue(field as LineField, value, values, locale);
      if (pill.textContent !== text) pill.textContent = text;
      pill.hidden = text === '';
      const key = value !== null && typeof value === 'object' && 'id' in value ? String((value as { id: unknown }).id) : String(value);
      const asked = tones[key];
      if (typeof asked === 'string' && TONES.has(asked as Tone)) pill.dataset['tone'] = asked;
      else delete pill.dataset['tone'];
    },
  };
};
