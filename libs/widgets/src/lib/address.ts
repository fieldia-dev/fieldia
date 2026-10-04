import type { WidgetLabels } from './labels';
import { describeState, maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * An address on a JSON field (`json.address`), in its parts — street, city,
 * postcode and country — each a box with its own label, filled in by the
 * browser when it can. `options.parts` chooses which, and in what order. The
 * value is an object of the parts filled in, keeping any part it was given
 * that it does not ask for; nothing at all when every part is empty.
 */

const PARTS = {
  street: { words: 'addressStreet', autocomplete: 'street-address' },
  city: { words: 'addressCity', autocomplete: 'address-level2' },
  postcode: { words: 'addressPostcode', autocomplete: 'postal-code' },
  country: { words: 'addressCountry', autocomplete: 'country-name' },
} as const satisfies Record<string, { words: keyof WidgetLabels; autocomplete: string }>;
type Part = keyof typeof PARTS;
const isPart = (name: unknown): name is Part => typeof name === 'string' && name in PARTS;

export const addressWidget: WidgetFactory = ({ form, name, node, id, document, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const asked = node.options?.['parts'];
  const parts: Part[] = Array.isArray(asked) ? asked.filter(isPart) : (Object.keys(PARTS) as Part[]);
  const element = make('div', { id, class: 'fd-address', role: 'group' });
  const boxes = parts.map((part) => {
    const input = make('input', { id: `${id}-${part}`, type: 'text', class: 'fd-input', 'data-part': part, autocomplete: PARTS[part].autocomplete });
    input.addEventListener('input', () => {
      const now = form.getState().values[name];
      const kept: Record<string, unknown> = now && typeof now === 'object' && !Array.isArray(now) ? { ...(now as Record<string, unknown>) } : {};
      kept[part] = input.value;
      // Only the parts with something in them.
      const filled = Object.fromEntries(Object.entries(kept).filter(([, v]) => typeof v !== 'string' || v.trim() !== ''));
      form.setValue(name, Object.keys(filled).length ? (filled as never) : null);
    });
    element.append(make('div', { class: `fd-address-part fd-address-${part}` }, make('label', { class: 'fd-address-label', for: input.id }, words[PARTS[part].words]), input));
    return { part, input };
  });

  return {
    element,
    focus: () => boxes[0]?.input.focus(),
    update(state) {
      const value = state.value && typeof state.value === 'object' && !Array.isArray(state.value) ? (state.value as Record<string, unknown>) : {};
      for (const { part, input } of boxes) {
        const text = typeof value[part] === 'string' ? (value[part] as string) : '';
        // What is being typed stays as typed.
        if (document.activeElement !== input && input.value !== text) input.value = text;
        input.readOnly = state.readonly;
        input.setAttribute('aria-invalid', String(state.invalid));
      }
      describeState(element, state);
    },
  };
};
