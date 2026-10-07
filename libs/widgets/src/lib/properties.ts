import type { Field, FieldNode, Form, FormState, JsonValue, PropertyDefinition, Value } from '@fieldia/core';
import { maker, wordsFor } from './kind-parts';
import { createWidget, type Widget, type WidgetFactory } from './widgets';

/**
 * A properties field, one row per property, each edited with the widget for
 * its type: text, numbers, yes/no, a choice, a date. The field's `definitions`
 * say which properties there are; with `definitionsFrom` the app gives them,
 * those the linked record keeps (Flectra's definition_record), loaded again as
 * the link changes; without either, each property is worked out from its
 * value. The properties stay one value: an object by property name.
 *
 * Options: `columns` (1 or 2), the properties side by side, as Flectra's
 * columns="2"; `add`, with definitions from a linked record, "Add a property"
 * under them — its name and kind, kept on that record through the app.
 */

/** "lift_access" → "Lift access". */
const humanize = (name: string) => {
  const words = name.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
};

/** A property's name from its label: "Locker number" → "locker_number". */
const nameFrom = (label: string) =>
  label
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/^(\d)/, 'p_$1') || 'property';

/** A property's type, from what it holds. */
function guess(name: string, value: Value | undefined): PropertyDefinition {
  const label = humanize(name);
  if (typeof value === 'boolean') return { name, label, type: 'boolean' };
  if (typeof value === 'number') return { name, label, type: Number.isInteger(value) ? 'integer' : 'float' };
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return { name, label, type: 'date' };
  return { name, label, type: 'char' };
}

/** The kinds a property added in place may be, in the order their words name them. */
const KINDS = ['char', 'text', 'integer', 'float', 'boolean', 'date'] as const;

export const propertiesWidget: WidgetFactory = (context) => {
  const { form, name, field, node, id, document, labels, locale } = context;
  const make = maker(document);
  const words = wordsFor(labels, locale);
  const declared = field.type === 'properties' ? field.definitions : undefined;
  const fromRecord = field.type === 'properties' && !!field.definitionsFrom;
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

  const list = make('div', { class: 'fd-properties-list' });
  const element = make('div', { class: 'fd-properties', role: 'group' }, list);
  const columns = node.options?.['columns'];
  if (columns === 2) element.dataset['columns'] = '2';
  const status = make('div', { class: 'fd-help', role: 'status', hidden: '' });
  element.append(status);

  // Adding one in place: its name and its kind, then Add.
  const adding = fromRecord && node.options?.['add'] === true;
  const addButton = make('button', { type: 'button', class: 'fd-button fd-button-link fd-property-add', hidden: '' }, `+ ${words.addProperty}`);
  const newName = make('input', { type: 'text', class: 'fd-input', 'aria-label': words.propertyName, placeholder: words.propertyName, autocomplete: 'off' });
  const kindNames = words.propertyTypes.split('|');
  const newKind = make('select', { class: 'fd-input fd-select', 'aria-label': words.propertyType }, ...KINDS.map((kind, i) => make('option', { value: kind }, kindNames[i] ?? kind)));
  const confirm = make('button', { type: 'button', class: 'fd-button fd-button-primary' }, words.add);
  const cancel = make('button', { type: 'button', class: 'fd-button' }, words.cancel);
  const newRow = make('div', { class: 'fd-property-new', hidden: '' }, newName, newKind, confirm, cancel);
  if (adding) element.append(addButton, newRow);
  let focusAfter: string | null = null;
  const closeNew = () => {
    newRow.hidden = true;
    addButton.hidden = false;
  };
  addButton.addEventListener('click', () => {
    newRow.hidden = false;
    addButton.hidden = true;
    newName.value = '';
    newKind.value = 'char';
    newName.focus();
  });
  cancel.addEventListener('click', () => {
    closeNew();
    addButton.focus();
  });
  const add = () => {
    const label = newName.value.trim();
    if (!label) return newName.focus();
    const taken = new Set(rows.map((row) => row.definition.name));
    let made = nameFrom(label);
    for (let n = 2; taken.has(made); n++) made = `${nameFrom(label)}_${n}`;
    focusAfter = made;
    closeNew();
    void form.addDefinition(name, { name: made, label, type: newKind.value as PropertyDefinition['type'] });
  };
  confirm.addEventListener('click', add);
  newRow.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target === newName) {
      event.preventDefault();
      add();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeNew();
      addButton.focus();
    }
  });

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
    list.replaceChildren(
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

  // Definitions from the linked record: asked for once shown, then again as the link changes.
  if (fromRecord && !form.getState().definitions[name]) form.loadDefinitions(name);

  return {
    element,
    focus: () => (rows[0]?.widget ?? { focus: () => addButton.focus() }).focus(),
    destroy: () => rows.forEach((row) => row.widget.destroy?.()),
    update(state) {
      const values = current();
      const loaded = fromRecord ? form.getState().definitions[name] : undefined;
      const definitions = fromRecord ? (loaded?.definitions ?? []) : (declared ?? Object.keys(values).map((key) => guess(key, values[key])));
      const key = JSON.stringify(definitions);
      if (key !== drawn) {
        drawn = key;
        draw(definitions);
      }
      for (const { definition, widget } of rows) {
        widget.update({ value: values[definition.name] ?? null, values, readonly: state.readonly, required: false, invalid: false });
      }
      status.textContent = loaded?.loading && !loaded.definitions ? words.loading : (loaded?.error ?? '');
      status.hidden = !status.textContent;
      if (adding) {
        if (state.readonly) closeNew();
        addButton.hidden = state.readonly || !newRow.hidden;
      }
      if (focusAfter && rows.some((row) => row.definition.name === focusAfter)) {
        rows.find((row) => row.definition.name === focusAfter)?.widget.focus();
        focusAfter = null;
      }
    },
  };
};
