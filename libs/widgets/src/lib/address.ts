import { ADDRESS_PARTS } from '@fieldia/core';
import type { WidgetLabels } from './labels';
import { describeState, maker, wordsFor } from './kind-parts';
import type { WidgetFactory } from './widgets';

/**
 * An address on a JSON field (`json.address`), in its parts — street, a
 * second line, city, region, postcode and country — each with its own label,
 * filled in by the browser when it can. `options.parts` chooses which, and in
 * what order: street, city, postcode and country unless it says. The country
 * is chosen from a list in the page's language and kept as its ISO code;
 * `options.country` is the one it starts on, kept once anything else is
 * typed. `options.requiredParts` are marked, and the form asks for them. The
 * value is an object of the parts filled in, keeping any part it was given
 * that it does not ask for; nothing at all when every part is empty.
 */

const PARTS: Record<(typeof ADDRESS_PARTS)[number], [keyof WidgetLabels, string]> = {
  street: ['addressStreet', 'street-address'],
  line2: ['addressLine2', 'address-line2'],
  city: ['addressCity', 'address-level2'],
  region: ['addressRegion', 'address-level1'],
  postcode: ['addressPostcode', 'postal-code'],
  country: ['addressCountry', 'country'],
};
type Part = keyof typeof PARTS;
const isPart = (name: unknown): name is Part => typeof name === 'string' && name in PARTS;

/** Codes with a region's name that are no country: old ones, groups, and the like. */
const NOT_COUNTRIES = 'AC AN BU CP CQ CS DD DG DY EA EU EZ FX HV IC NH QO RH SU TA TP UK UN VD XA XB YD YU ZR ZZ';
const countries: Record<string, [string, string][]> = {};
/** Every country, by its code and its name in the language, in the language's order. */
export function countriesIn(locale: string): [string, string][] {
  if (!countries[locale]) {
    const names = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' });
    const found: [string, string][] = [];
    for (let a = 65; a < 91; a++)
      for (let b = 65; b < 91; b++) {
        const code = String.fromCharCode(a, b);
        const name = !NOT_COUNTRIES.includes(code) && names.of(code);
        if (name) found.push([code, name]);
      }
    countries[locale] = found.sort((x, y) => x[1].localeCompare(y[1], locale));
  }
  return countries[locale];
}

export const addressWidget: WidgetFactory = ({ form, name, node, id, document, labels, locale = 'en' }) => {
  const words = wordsFor(labels, locale);
  const make = maker(document);
  const options = node.options ?? {};
  const asked = options['parts'];
  const parts: Part[] = Array.isArray(asked) ? asked.filter(isPart) : ['street', 'city', 'postcode', 'country'];
  const needed = Array.isArray(options['requiredParts']) ? options['requiredParts'] : [];
  const start = typeof options['country'] === 'string' ? options['country'] : '';
  const element = make('div', { id, class: 'fd-address', role: 'group' });
  /** The parts as they are now, a part as typed in place of its own. */
  const write = (part: Part, text: string) => {
    const now = form.getState().values[name];
    const kept: Record<string, unknown> = now && typeof now === 'object' && !Array.isArray(now) ? { ...(now as Record<string, unknown>) } : {};
    kept[part] = text;
    // The country it starts on goes with the parts typed, but is no answer on its own.
    if (start && parts.includes('country') && kept['country'] === undefined) kept['country'] = start;
    // Only the parts with something in them.
    const filled = Object.fromEntries(Object.entries(kept).filter(([, v]) => typeof v !== 'string' || v.trim() !== ''));
    const keys = Object.keys(filled);
    form.setValue(name, keys.length && (part === 'country' || keys.join() !== 'country' || filled['country'] !== start) ? (filled as never) : null);
  };
  const boxes = parts.map((part) => {
    const [label, autocomplete] = PARTS[part];
    const attrs = { id: `${id}-${part}`, class: 'fd-input', 'data-part': part, autocomplete: part === 'street' && parts.includes('line2') ? 'address-line1' : autocomplete, 'aria-required': needed.includes(part) ? 'true' : undefined };
    const input =
      part === 'country'
        ? make('select', attrs, make('option', { value: '' }), ...countriesIn(locale).map(([code, country]) => make('option', { value: code }, country)))
        : make('input', { type: 'text', ...attrs });
    input.addEventListener(part === 'country' ? 'change' : 'input', () => write(part, input.value));
    if (part === 'country') input.classList.add('fd-select');
    element.append(make('div', { class: `fd-address-part fd-address-${part}${needed.includes(part) ? ' fd-required' : ''}` }, make('label', { class: 'fd-address-label', for: input.id }, words[label]), input));
    return { part, input };
  });

  return {
    element,
    focus: () => boxes[0]?.input.focus(),
    update(state) {
      const value = state.value && typeof state.value === 'object' && !Array.isArray(state.value) ? (state.value as Record<string, unknown>) : {};
      for (const { part, input } of boxes) {
        const text = typeof value[part] === 'string' ? (value[part] as string) : part === 'country' && value['country'] === undefined ? start : '';
        if (input instanceof HTMLSelectElement) {
          // A country given in words is shown as it was given.
          if (text && ![...input.options].some((o) => o.value === text)) input.append(make('option', { value: text }, text));
          input.disabled = state.readonly;
        } else input.readOnly = state.readonly;
        // What is being typed stays as typed.
        if (document.activeElement !== input && input.value !== text) input.value = text;
        // Wrong, a part that must be filled and is not is marked.
        input.setAttribute('aria-invalid', String(state.invalid && (!needed.length || (needed.includes(part) && !text.trim()))));
      }
      describeState(element, state);
    },
  };
};
