import type { FieldNode, Form, ReferenceValue, RelatedRecord } from '@fieldia/core';
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
  /** Make a record from what was typed, offered when nothing found has that name. */
  create?: (text: string) => Promise<RelatedRecord>;
  /** Further choices at the end of the list: each acts on the typed text and may hand back a record to pick. */
  more?: (typed: string) => { label: string; act: (typed: string) => Promise<RelatedRecord | null> }[];
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
  /** The "Create …" choice in the list, and the text it would make a record from. */
  let creating: RelatedRecord | null = null;
  let creatingText = '';
  /** The further choices at the end of the list, by the entry that stands for each. */
  let extras = new Map<RelatedRecord, (typed: string) => Promise<RelatedRecord | null>>();
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
      option.className = `fd-option${i === active ? ' fd-active' : ''}${record === creating || extras.has(record) ? ' fd-option-create' : ''}`;
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
    // A search still on its way must not open the list again.
    clearTimeout(timer);
    seq++;
    list.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function choose(index: number) {
    const record = results[index];
    if (!record) return;
    const typed = creatingText;
    close();
    editing = false;
    if (record === creating && options.create) {
      void options.create(typed).then(options.pick, () => undefined);
      return;
    }
    const act = extras.get(record);
    if (act) {
      void act(typed).then((picked) => picked && options.pick(picked), () => undefined);
      return;
    }
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
      // Nothing found by that name: offer to make it.
      const typed = query.trim();
      creating = null;
      if (options.create && typed && !found.some((record) => record.label.trim().toLowerCase() === typed.toLowerCase())) {
        creatingText = typed;
        creating = { id: '__create__', label: fill(labels.createNamed, { name: typed }) };
        results = [...results, creating];
      }
      creatingText = typed;
      extras = new Map((options.more?.(typed) ?? []).map((extra, i) => [{ id: `__more_${i}__`, label: extra.label }, extra.act]));
      results = [...results, ...extras.keys()];
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

/** Making a record from a typed name, unless the page turns it off or the data source cannot. */
function creator(form: Form, name: string, node: FieldNode): ((text: string) => Promise<RelatedRecord>) | undefined {
  return node.options?.['create'] !== false && form.canCreate(name) ? (text) => form.quickCreate(name, text) : undefined;
}

export const many2oneWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, dialogs }) => {
  const relation = field.type === 'many2one' ? field.relation : '';
  const canOpen = !!dialogs && dialogs.canOpen(relation);
  let readonly = false;
  const box = combobox({
    document,
    id,
    labels,
    search: (query) => form.search(name, query),
    pick: (record) => form.setValue(name, record),
    onCommitEmpty: () => form.setValue(name, null),
    create: creator(form, name, node),
    // With dialogs: make a record in its own page, or pick from a full list.
    more: (typed) => {
      if (!dialogs || readonly) return [];
      const choices: { label: string; act: (text: string) => Promise<RelatedRecord | null> }[] = [];
      if (typed && canOpen && node.options?.['create'] !== false) {
        choices.push({ label: labels.createAndEdit, act: (text) => dialogs.openRecord(relation, { name: text, title: field.label }) });
      }
      choices.push({ label: labels.searchMore, act: () => dialogs.searchMore({ title: field.label, search: (query, limit) => form.search(name, query, limit) }) });
      return choices;
    },
  });
  // The linked record, opened in a dialog where the app can show it; a new name it is saved with follows here.
  const open = canOpen ? document.createElement('button') : null;
  if (open) {
    open.type = 'button';
    open.className = 'fd-combo-open';
    open.textContent = '↗';
    open.hidden = true;
    open.addEventListener('click', async () => {
      const current = form.getState().values[name] as RelatedRecord | null;
      if (!current || !dialogs) return;
      const saved = await dialogs.openRecord(relation, { recordId: current.id, title: current.label });
      if (saved && saved.label !== current.label) form.setValue(name, saved);
    });
  }
  const clear = document.createElement('button');
  clear.type = 'button';
  clear.className = 'fd-combo-clear';
  clear.textContent = '×';
  clear.setAttribute('aria-label', fill(labels.clear, { label: field.label }));
  clear.addEventListener('click', () => {
    form.setValue(name, null);
    box.input.focus();
  });
  box.element.append(clear, ...(open ? [open] : []));
  return {
    element: box.element,
    focus: () => box.input.focus(),
    update(state) {
      const record = state.value as RelatedRecord | null | undefined;
      readonly = state.readonly;
      box.setText(record?.label ?? '');
      box.setReadonly(state.readonly);
      clear.hidden = !record || state.readonly;
      if (open) {
        open.hidden = !record;
        if (record) open.setAttribute('aria-label', fill(labels.openNamed, { name: record.label }));
      }
      box.input.setAttribute('aria-invalid', String(state.invalid));
      box.input.setAttribute('aria-required', String(state.required));
      if (state.describedBy) box.input.setAttribute('aria-describedby', state.describedBy);
    },
  } satisfies Widget;
};

export const tagsWidget: WidgetFactory = ({ form, name, node, id, document, labels = WIDGET_LABELS.en }) => {
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
    create: creator(form, name, node),
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
      drawChips(chips, records, readonly, labels, (record) => form.setValue(name, current().filter((r) => r.id !== record.id)));
      box.setText('');
    },
  };
};

/** Chips for tags, each with a remove button unless read-only. */
function drawChips(chips: HTMLElement, records: RelatedRecord[], readonly: boolean, labels: WidgetLabels, remove: (record: RelatedRecord) => void) {
  const doc = chips.ownerDocument;
  chips.replaceChildren(
    ...records.map((record) => {
      const chip = doc.createElement('li');
      chip.className = 'fd-chip';
      const text = doc.createElement('span');
      text.className = 'fd-chip-label';
      text.textContent = record.label;
      chip.append(text);
      if (!readonly) {
        const button = doc.createElement('button');
        button.type = 'button';
        button.className = 'fd-chip-remove';
        button.textContent = '×';
        button.setAttribute('aria-label', fill(labels.remove, { name: record.label }));
        button.addEventListener('click', () => remove(record));
        chip.append(button);
      }
      return chip;
    })
  );
}

/**
 * Free-text tags on a text field, kept as "oak, glass": Enter or a comma adds
 * what was typed, Backspace in an empty box takes the last one away, and the
 * node's `options.suggestions` are offered as you type. `options.separator`
 * is "," unless set.
 */
export const charTagsWidget: WidgetFactory = ({ form, name, node, id, document, labels = WIDGET_LABELS.en }) => {
  const options = node.options ?? {};
  const separator = typeof options['separator'] === 'string' && options['separator'] ? options['separator'] : ',';
  const suggestions = Array.isArray(options['suggestions']) ? options['suggestions'].filter((s): s is string => typeof s === 'string') : [];
  const split = (text: unknown) =>
    typeof text === 'string' ? text.split(separator).map((t) => t.trim()).filter((t) => t !== '') : [];
  const current = () => split(form.getState().values[name]);
  const write = (tags: string[]) => form.setValue(name, tags.length ? tags.join(`${separator} `) : null);
  const add = (raw: string) => {
    const tag = raw.trim();
    const tags = current();
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) write([...tags, tag]);
  };

  const element = document.createElement('div');
  element.className = 'fd-tags';
  element.setAttribute('role', 'group');
  const chips = document.createElement('ul');
  chips.className = 'fd-chips';
  const box = combobox({
    document,
    id,
    labels,
    search: async (query) => {
      const taken = new Set(current().map((t) => t.toLowerCase()));
      const wanted = query.trim().toLowerCase();
      return suggestions
        .filter((s) => !taken.has(s.toLowerCase()) && s.toLowerCase().includes(wanted))
        .map((s) => ({ id: s, label: s }));
    },
    pick: (record) => {
      add(record.label);
      box.input.value = '';
    },
    onEmptyBackspace: () => {
      const tags = current();
      if (tags.length) write(tags.slice(0, -1));
    },
  });
  // Enter with nothing chosen from the list adds what was typed.
  box.input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented || box.input.value.trim() === '') return;
    event.preventDefault();
    add(box.input.value);
    box.input.value = '';
    box.close();
  });
  // A separator typed ends a tag.
  box.input.addEventListener('input', () => {
    const parts = box.input.value.split(separator);
    if (parts.length < 2) return;
    for (const part of parts.slice(0, -1)) add(part);
    box.input.value = parts[parts.length - 1].trimStart();
  });
  // Typed and left without Enter: kept. (change comes before blur clears the box.)
  box.input.addEventListener('change', () => {
    if (box.input.value.trim()) add(box.input.value);
  });
  element.append(chips, box.element);
  let drawn = '';
  return {
    element,
    focus: () => box.input.focus(),
    update(state) {
      const tags = split(state.value);
      box.setReadonly(state.readonly);
      box.element.hidden = state.readonly;
      box.input.setAttribute('aria-invalid', String(state.invalid));
      if (state.describedBy) box.input.setAttribute('aria-describedby', state.describedBy);
      const key = JSON.stringify([state.readonly, tags]);
      if (key === drawn) return;
      drawn = key;
      drawChips(chips, tags.map((t) => ({ id: t, label: t })), state.readonly, labels, (record) => write(current().filter((t) => t !== record.label)));
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
