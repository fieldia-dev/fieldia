import type { Field, FieldNode, Form, FormState, JsonValue, PropertyDefinition, Value } from '@fieldia/core';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/**
 * A properties field, one row per property, each edited with the widget for
 * its type: text, numbers, yes/no, a choice, a date. The field's `definitions`
 * say which properties there are; without them, each property is worked out
 * from its value. The properties stay one value: an object by property name.
 */

/** "lift_access" → "Lift access". */
const humanize = (name: string) => {
  const words = name.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A property's type, from what it holds. */
function guess(name: string, value: Value | undefined): PropertyDefinition {
  const label = humanize(name);
  if (typeof value === 'boolean') return { name, label, type: 'boolean' };
  if (typeof value === 'number') return { name, label, type: Number.isInteger(value) ? 'integer' : 'float' };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return { name, label, type: 'date' };
  return { name, label, type: 'char' };
}

export const propertiesWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document } = context;
  const declared = field.type === 'properties' ? field.definitions : undefined;
  const current = () => {
    const value = form.getState().values[name];
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, Value>) : {};
  };
  // Each property's widget sees the properties as its record, and writes into them.
  const properties: Form = {
    ...form,
    getState: (): FormState => ({ ...form.getState(), values: current() }),
    // Property values are plain JSON: text, numbers, yes/no, a choice, a date.
    setValue: (property: string, value: Value) => form.setValue(name, { ...current(), [property]: value } as JsonValue),
  };

  const element = document.createElement('div');
  element.className = 'fd-properties';
  element.setAttribute('role', 'group');
  let rows: { definition: PropertyDefinition; widget: Widget }[] = [];
  let drawn = '';

  function draw(definitions: PropertyDefinition[]) {
    for (const row of rows) row.widget.destroy?.();
    rows = definitions.map((definition) => {
      const rowId = `${id}-${definition.name}`;
      const propertyField = { type: definition.type, label: definition.label, ...(definition.options ? { options: definition.options } : {}) } as Field;
      const propertyNode: FieldNode = { type: 'field', id: `${node.id}.${definition.name}`, field: definition.name };
      const widget = createWidget({ ...context, form: properties, name: definition.name, field: propertyField, node: propertyNode, id: rowId });
      return { definition, widget };
    });
    element.replaceChildren(
      ...rows.map(({ definition, widget }) => {
        const row = document.createElement('div');
        row.className = 'fd-property';
        row.dataset['type'] = definition.type;
        const label = document.createElement('label');
        label.htmlFor = `${id}-${definition.name}`;
        label.textContent = definition.label;
        row.append(label, widget.element);
        return row;
      })
    );
  }

  return {
    element,
    focus: () => rows[0]?.widget.focus(),
    destroy: () => rows.forEach((row) => row.widget.destroy?.()),
    update(state) {
      const values = current();
      const definitions = declared ?? Object.keys(values).map((key) => guess(key, values[key]));
      const key = JSON.stringify(definitions);
      if (key !== drawn) {
        drawn = key;
        draw(definitions);
      }
      for (const { definition, widget } of rows) {
        widget.update({ value: values[definition.name] ?? null, values, readonly: state.readonly, required: false, invalid: false });
      }
    },
  };
};
