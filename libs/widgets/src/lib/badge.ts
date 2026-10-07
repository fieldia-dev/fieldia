import type { LineField, Locale } from '@fieldia/core';
import { displayValue } from './display';
import type { WidgetFactory } from './widgets';

/**
 * A value drawn as a pill, never edited: Flectra's `widget="badge"`. Its
 * colour is the tone of the part it sits in — a field's `tones`, a cell's —
 * and grey while none holds. Empty, it draws nothing.
 */
export const badgeWidget: WidgetFactory = ({ field, id, document, locale = 'en' as Locale }) => {
  const pill = document.createElement('span');
  pill.id = id;
  pill.className = 'fd-value-badge';
  return {
    element: pill,
    focus: () => undefined,
    update({ value, values }) {
      const text = displayValue(field as LineField, value, values, locale);
      if (pill.textContent !== text) pill.textContent = text;
      pill.hidden = text === '';
    },
  };
};
