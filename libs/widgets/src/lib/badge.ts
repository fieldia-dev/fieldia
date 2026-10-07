import type { Tone } from '@fieldia/core';
import type { WidgetFactory } from './widgets';

/**
 * A choice drawn as a coloured pill, as Flectra's widget="badge": the chosen
 * option's words, toned by the value through `options.tones` — `{ "high":
 * "danger", "low": "success" }` — muted for a value given none. It shows a
 * value; it is not picked from, so it is the same read-only or not.
 */
const TONES = new Set<Tone>(['info', 'success', 'warning', 'danger', 'muted']);

export const badgeWidget: WidgetFactory = ({ field, node, id, document }) => {
  const tones = (node.options?.['tones'] ?? {}) as Record<string, unknown>;
  const element = document.createElement('span');
  element.id = id;
  element.className = 'fd-badge fd-tone-muted';
  element.hidden = true;
  return {
    element,
    focus: () => undefined,
    update(state) {
      const value = state.value;
      const empty = value === null || value === undefined || value === '';
      if (element.hidden !== empty) element.hidden = empty;
      if (empty) return;
      const label = field.type === 'selection' ? field.options.find((o) => o.value === value)?.label ?? String(value) : String(value);
      const asked = tones[String(value)];
      const tone = typeof asked === 'string' && TONES.has(asked as Tone) ? asked : 'muted';
      const className = `fd-badge fd-tone-${tone}`;
      if (element.className !== className) element.className = className;
      if (element.textContent !== label) element.textContent = label;
    },
  };
};
