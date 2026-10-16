import { ADDRESS_PARTS, type Field, type Option, type Value } from '@fieldia/core';
import { countriesIn } from './countries';
import { wordsFor } from './kind-parts';
import type { WidgetContext, WidgetFactory } from './widgets';

/**
 * The survey kinds (survey-part.ts) as they are drawn before their part has
 * come — by an app that mounts a page without waiting for its parts, as the
 * viewer does: each value plainly, in words, a line each, shown as it is and
 * never changed, until the part's own widget takes its place with it
 * (partWidget). A ranking is its order, a matrix its answers by row, a colour
 * its code or its name, an address its lines, properties a line each. A
 * slider is a number box meanwhile, pictures to choose from the choices' own
 * radios or boxes, and a progress bar its number (widgets.ts): each reads and
 * writes the same value its part's widget does.
 */

/** The value in words, a line each, named by the field's label: shown, never written. */
function plainLines(lines: (value: Value, context: WidgetContext) => string[]): WidgetFactory {
  return (context) => {
    const { id, document } = context;
    const output = document.createElement('output');
    output.id = id;
    output.className = 'fd-value-text';
    return {
      element: output,
      focus: () => undefined,
      update({ value }) {
        output.replaceChildren(...lines(value ?? null, context).flatMap((line, i) => (i ? [document.createElement('br'), line] : [line])));
      },
    };
  };
}

const optionsOf = (field: Field): readonly Option[] => (field.type === 'selection' ? field.options : []);
/** An option's words, or the value itself where no option has it. */
const labelOf = (options: readonly Option[], value: unknown) => options.find((option) => option.value === value)?.label ?? String(value);
const entries = (value: Value) => (value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value).filter(([, v]) => v !== null && v !== undefined && v !== '') : []);

/** A ranking as its order in words: "1. Kitchen", "2. Gym". Not yet ranked, nothing. */
export const plainRanking = plainLines((value, { field }) => (Array.isArray(value) ? value.map((v, i) => `${i + 1}. ${labelOf(optionsOf(field), v)}`) : []));

/** A matrix as its answers, a row each, in its rows' order: "Service: Good". */
export const plainMatrix = plainLines((value, { field }) => {
  if (field.type !== 'matrix') return [];
  const answers = new Map(entries(value));
  return field.rows.filter((row) => answers.has(String(row.value))).map((row) => `${row.label}: ${[answers.get(String(row.value))].flat().map((v) => labelOf(field.columns, v)).join(', ')}`);
});

/** A colour as its code ("#2c8397"), or a tag colour by its name ("Teal"). */
export const plainColour = plainLines((value, { labels, locale }) =>
  typeof value === 'number' ? [wordsFor(labels, locale).colourNames.split('|')[value] ?? String(value)] : typeof value === 'string' && value ? [value] : []
);

/** An address as its lines: each part given, in the parts' order, its country by name in the page's language. */
export const plainAddress = plainLines((value, { locale = 'en' }) => {
  const parts = new Map(entries(value));
  const order = [...ADDRESS_PARTS, ...[...parts.keys()].filter((part) => !(ADDRESS_PARTS as readonly string[]).includes(part))];
  return order.filter((part) => parts.has(part)).map((part) => {
    const text = String(parts.get(part));
    return part === 'country' ? (countriesIn(locale).find(([code]) => code === text)?.[1] ?? text) : text;
  });
});

/** Properties as a line each: "Lift access: Yes", named by their definitions where the field has them. */
export const plainProperties = plainLines((value, { field, labels, locale }) => {
  const words = wordsFor(labels, locale);
  const declared = field.type === 'properties' ? (field.definitions ?? []) : [];
  return entries(value).map(([name, v]) => {
    const definition = declared.find((one) => one.name === name);
    const text = v === true ? words.yes : v === false ? words.no : typeof v === 'object' ? JSON.stringify(v) : labelOf(definition?.options ?? [], v);
    return `${definition?.label ?? name}: ${text}`;
  });
});
