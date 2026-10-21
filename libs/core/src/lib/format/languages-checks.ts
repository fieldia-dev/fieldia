import { languagesOf } from '../record/languages';
import type { FieldTools } from './part-checks';

/** A field placed on the page, where it is: its node's widget and whether it says it is required. */
interface Placed {
  path: string;
  widget?: unknown;
  required?: unknown;
}

/** Every field node of a layout, by the field it places, with its path. */
function placed(layout: unknown, path: string, found: Map<string, Placed[]>): Map<string, Placed[]> {
  if (Array.isArray(layout)) layout.forEach((item, i) => placed(item, `${path}[${i}]`, found));
  else if (layout !== null && typeof layout === 'object') {
    const node = layout as Record<string, unknown>;
    if (node['type'] === 'field' && typeof node['field'] === 'string') found.set(node['field'], [...(found.get(node['field']) ?? []), { path, widget: node['widget'], required: node['required'] }]);
    for (const [key, value] of Object.entries(node)) if (value !== null && typeof value === 'object') placed(value, `${path}.${key}`, found);
  }
  return found;
}

/**
 * A page's texts kept in several languages (`translate`): each placed as words people type — a line, a paragraph or
 * formatted text, never another widget (an email, a phone, tags in two languages are no one's); and `requiredIn` on a
 * text that is required somewhere, by its field or a place of it, which it says the languages of. In the one-tag script
 * they come with the languages part, which a page with one asks for.
 */
export function checkLanguages(tools: FieldTools): void {
  const { page } = tools;
  const nodes = placed(page.layout, 'layout', new Map());
  for (const [name, field] of Object.entries(page.fields)) {
    if (!languagesOf(field)) continue;
    for (const node of nodes.get(name) ?? []) {
      if (typeof node.widget === 'string') tools.report(`${node.path}.widget`, `"${name}" keeps its text in several languages, each typed by a person: it is a line, a paragraph or formatted text, never shown as ${node.widget}`);
    }
    const required = (field as { required?: boolean }).required === true || (nodes.get(name) ?? []).some((node) => node.required !== undefined && node.required !== false);
    if ((field as { requiredIn?: string[] }).requiredIn !== undefined && !required) tools.report(`fields.${name}.requiredIn`, 'requiredIn says which languages a required answer is typed in: make it required, by the field or where it is placed');
  }
}
