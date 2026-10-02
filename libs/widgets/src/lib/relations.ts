import type { ReferenceValue, RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * Pickers for related records: a search-as-you-type combobox (the ARIA 1.2
 * combobox pattern), tags for a many2many, and a reference picker. Results
 * come from the data source through the form, so a field's filter applies.
 */

const DEBOUNCE_MS = 180;

function fill(template: string, values: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values[name] ?? match);
}

interface Combobox {
  element: HTMLElement;
  input: HTMLInputElement;
  /** Show this text when nobody is typing. */
  setText(text: string): void;
  setReadonly(readonly: boolean): void;
  close(): void;
}

/**
 * A text box with a list of matches under it. `search` finds records,
 * `pick` takes the chosen one, `exclude` hides records already chosen.
 */
function combobox(options: {
  document: Document;
  id: string;
  labels: WidgetLabels;
  search: (query: string) => Promise<RelatedRecord[]>;
  pick: (record: RelatedRecord) => void;
  exclude?: () => Set<RelatedRecord['id']>;
  onEmptyBackspace?: () => void;
  onCommitEmpty?: () => void;
}): Combobox {
  const { document: doc, id, labels } = options;
  const listId = `${id}-list`;
  const input = doc.createElement('input');
  Object.assign(input, { id, className: 'fd-input fd-combo-input', autocomplete: 'off' });
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  input.placeholder = labels.search;
  const list = doc.createElement('ul');
  list.id = listId;
  list.className = 'fd-listbox';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  const element = doc.createElement('div');
  element.className = 'fd-combo';
  element.append(input, list);

  let shown = '';
  /** True while the person's own typing is in the box. */
  let editing = false;
  let results: RelatedRecord[] = [];
  let active = -1;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let readonly = false;

  function render() {
    list.replaceChildren();
    results.forEach((record, i) => {
      const option = doc.createElement('li');
      option.id = `${listId}-${i}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(i === active));
      option.className = i === active ? 'fd-option fd-active' : 'fd-option';
      option.textContent = record.label;
      option.addEventListener('mousedown', (event) => event.preventDefault()); // keep focus in the box
      option.addEventListener('click', () => choose(i));
      list.append(option);
    });
    if (!results.length) {
      const empty = doc.createElement('li');
      empty.className = 'fd-empty';
      empty.textContent = labels.noResults;
      list.append(empty);
    }
    if (active >= 0) input.setAttribute('aria-activedescendant', `${listId}-${active}`);
    else input.removeAttribute('aria-activedescendant');
  }

  function open() {
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function choose(index: number) {
    const record = results[index];
    if (!record) return;
    close();
    editing = false;
    options.pick(record);
  }

  function lookUp(query: string) {
    clearTimeout(timer);
    const mine = ++seq;
    timer = setTimeout(async () => {
      const found = await options.search(query).catch(() => [] as RelatedRecord[]);
      if (mine !== seq || doc.activeElement !== input) return; // a newer search, or the person left
      const hidden = options.exclude?.() ?? new Set();
      results = found.filter((record) => !hidden.has(record.id));
      active = -1;
      render();
      open();
    }, DEBOUNCE_MS);
  }

  input.addEventListener('input', () => {
    editing = true;
    if (!readonly) lookUp(input.value);
  });
  input.addEventListener('focus', () => {
    if (!readonly) lookUp('');
  });
  input.addEventListener('keydown', (event) => {
    if (readonly) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (list.hidden) return lookUp(input.value);
        if (!results.length) return;
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        render();
        list.children[active]?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      case 'Enter':
        if (!list.hidden && active >= 0) {
          event.preventDefault();
          choose(active);
        }
        return;
      case 'Escape':
        if (!list.hidden) event.preventDefault();
        close();
        editing = false;
        input.value = shown;
        return;
      case 'Backspace':
        if (input.value === '') options.onEmptyBackspace?.();
        return;
    }
  });
  input.addEventListener('blur', () => {
    seq++;
    clearTimeout(timer);
    close();
    const emptied = editing && input.value.trim() === '' && shown !== '';
    editing = false;
    if (emptied) options.onCommitEmpty?.();
    else input.value = shown;
  });

  return {
    element,
    input,
    setText(text) {
      shown = text;
      if (!editing) input.value = text;
    },
    setReadonly(next) {
      readonly = next;
      input.readOnly = next;
      if (next) close();
    },
    close,
  };
}

export const many2oneWidget: WidgetFactory = ({ form, name, field, id, document, labels = WIDGET_LABELS.en }) => {
  const box = combobox({
    document,
    id,
    labels,
    search: (query) => form.search(name, query),
    pick: (record) => form.setValue(name, record),
    onCommitEmpty: () => form.setValue(name, null),
  });
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'fd-combo-clear';
  clear.textContent = '×';
  clear.setAttribute('aria-label', fill(labels.clear, { label: field.label }));
  clear.addEventListener('click', () => {
    form.setValue(name, null);
    box.input.focus();
  });
  box.element.append(clear);
  return {
    element: box.element,
    focus: () => box.input.focus(),
    update(state) {
      const record = state.value as RelatedRecord | null | undefined;
      box.setText(record?.label ?? '');
      box.setReadonly(state.readonly);
      clear.hidden = !record || state.readonly;
      box.input.setAttribute('aria-invalid', String(state.invalid));
      box.input.setAttribute('aria-required', String(state.required));
      if (state.describedBy) box.input.setAttribute('aria-describedby', state.describedBy);
    },
  } satisfies Widget;
};

export const tagsWidget: WidgetFactory = ({ form, name, id, document, labels = WIDGET_LABELS.en }) => {
  const current = () => (form.getState().values[name] as RelatedRecord[] | null) ?? [];
  const element = document.createElement('div');
  element.className = 'fd-tags';
  element.setAttribute('role', 'group');
  const chips = document.createElement('ul');
  chips.className = 'fd-chips';
  const box = combobox({
    document,
    id,
    labels,
    search: (query) => form.search(name, query),
    pick: (record) => {
      form.setValue(name, [...current(), record]);
      box.input.value = '';
    },
    exclude: () => new Set(current().map((record) => record.id)),
    onEmptyBackspace: () => {
      const records = current();
      if (records.length) form.setValue(name, records.slice(0, -1));
    },
  });
  element.append(chips, box.element);
  let readonly = false;
  let drawn = '';
  return {
    element,
    focus: () => box.input.focus(),
    update(state) {
      const records = (state.value as RelatedRecord[] | null) ?? [];
      // Rebuild the chips only when they change, not on every keystroke elsewhere.
      const key = JSON.stringify([state.readonly, records]);
      readonly = state.readonly;
      box.setReadonly(readonly);
      box.element.hidden = readonly;
      box.input.setAttribute('aria-invalid', String(state.invalid));
      if (state.describedBy) box.input.setAttribute('aria-describedby', state.describedBy);
      if (key === drawn) return;
      drawn = key;
      chips.replaceChildren(
        ...records.map((record) => {
          const chip = document.createElement('li');
          chip.className = 'fd-chip';
          const text = document.createElement('span');
          text.className = 'fd-chip-label';
          text.textContent = record.label;
          chip.append(text);
          if (!readonly) {
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'fd-chip-remove';
            remove.textContent = '×';
            remove.setAttribute('aria-label', fill(labels.remove, { name: record.label }));
            remove.addEventListener('click', () => form.setValue(name, current().filter((r) => r.id !== record.id)));
            chip.append(remove);
          }
          return chip;
        })
      );
      box.setText('');
    },
  };
};

/** Every record as a checkbox. For short lists: it loads up to 50. */
export const linkCheckboxesWidget: WidgetFactory = ({ form, name, id, document }) => {
  const element = document.createElement('div');
  element.id = id;
  element.className = 'fd-choices fd-choices-checkbox';
  element.setAttribute('role', 'group');
  let boxes: { record: RelatedRecord; box: HTMLInputElement }[] = [];
  let latest = { readonly: false, value: [] as RelatedRecord[] };
  // Built once, when the records arrive; updates only tick boxes, so focus stays put.
  const sync = () => {
    const chosen = new Set(latest.value.map((r) => r.id));
    for (const { record, box } of boxes) {
      box.checked = chosen.has(record.id);
      box.disabled = latest.readonly;
    }
  };
  void form.search(name, '', 50).then((records) => {
    boxes = records.map((record, i) => {
      const box = document.createElement('input');
      box.type = 'checkbox';
      box.id = `${id}-${i}`;
      box.addEventListener('change', () => {
        const now = (form.getState().values[name] as RelatedRecord[] | null) ?? [];
        form.setValue(name, box.checked ? [...now, record] : now.filter((r) => r.id !== record.id));
      });
      const label = document.createElement('label');
      label.className = 'fd-choice';
      label.htmlFor = box.id;
      const text = document.createElement('span');
      text.textContent = record.label;
      label.append(box, text);
      element.append(label);
      return { record, box };
    });
    sync();
  });
  return {
    element,
    focus: () => element.querySelector('input')?.focus(),
    update(state) {
      latest = { readonly: state.readonly, value: (state.value as RelatedRecord[] | null) ?? [] };
      sync();
    },
  };
};

export const referenceWidget: WidgetFactory = (context: WidgetContext) => {
  const { form, name, field, id, document, labels = WIDGET_LABELS.en } = context;
  const models = field.type === 'reference' ? field.models : [];
  const element = document.createElement('div');
  element.className = 'fd-reference';
  const select = document.createElement('select');
  select.className = 'fd-input fd-select';
  select.setAttribute('aria-label', field.label);
  select.append(document.createElement('option'));
  for (const model of models) {
    const option = document.createElement('option');
    option.value = String(model.value);
    option.textContent = model.label;
    select.append(option);
  }
  let model = '';
  select.addEventListener('change', () => {
    model = select.value;
    form.setValue(name, null);
  });
  const box = combobox({
    document,
    id,
    labels,
    search: (query) => (model ? form.search(name, query, 8, { model }) : Promise.resolve([])),
    pick: (record) => form.setValue(name, { model, id: record.id, label: record.label }),
    onCommitEmpty: () => form.setValue(name, null),
  });
  element.append(select, box.element);
  return {
    element,
    focus: () => (model ? box.input.focus() : select.focus()),
    update(state) {
      const value = state.value as ReferenceValue | null | undefined;
      if (value) model = value.model;
      select.value = model;
      select.disabled = state.readonly;
      box.setText(value?.label ?? '');
      box.setReadonly(state.readonly || !model);
    },
  };
};
