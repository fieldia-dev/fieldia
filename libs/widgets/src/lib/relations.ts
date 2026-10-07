import type { FieldNode, Form, ReferenceValue, RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { floatUnder } from './float';
import { setAttr, setHidden } from './kind-parts';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * Pickers for related records: a search-as-you-type combobox (the ARIA 1.2
 * combobox pattern), tags for a many2many, and a reference picker. Results
 * come from the data source through the form, so a field's filter applies.
 */

const DEBOUNCE_MS = 180;
/** How many matches a link's list shows, as the data source's search would. */
const SHOWN = 8;

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
  /** How many found records the list shows; a search may find one more, to tell there are others. */
  shown?: number;
  /** The empty box's words: the page's own, else "Search…". */
  placeholder?: string;
  /** Further choices at the end of the list: each acts on the typed text and may hand back a record to pick. */
  more?: (typed: string, overflow: boolean) => { label: string; act: (typed: string) => Promise<RelatedRecord | null> }[];
}): Combobox {
  const { document: doc, id, labels } = options;
  const listId = `${id}-list`;
  const input = doc.createElement('input');
  Object.assign(input, { id, className: 'fd-input fd-combo-input', autocomplete: 'off' });
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'false');
  input.setAttribute('aria-controls', listId);
  input.placeholder = options.placeholder || labels.search;
  const list = doc.createElement('ul');
  list.id = listId;
  list.className = 'fd-listbox';
  list.setAttribute('role', 'listbox');
  list.hidden = true;
  const element = doc.createElement('div');
  element.className = 'fd-combo';
  element.append(input, list);
  const floating = floatUnder(input, list);

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
    // Its height changed: above its box or below, it is placed again.
    floating.place();
  }

  function open() {
    floating.show();
    input.setAttribute('aria-expanded', 'true');
  }

  function close() {
    // A search still on its way must not open the list again.
    clearTimeout(timer);
    seq++;
    floating.hide();
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
      // A record the arrow keys reached stays reached if the answer still lists it.
      const reached = results[active];
      const held = reached && reached !== creating && !extras.has(reached) ? reached.id : undefined;
      const hidden = options.exclude?.() ?? new Set();
      const kept = found.filter((record) => !hidden.has(record.id));
      const overflow = options.shown !== undefined && kept.length > options.shown;
      results = overflow ? kept.slice(0, options.shown) : kept;
      // Nothing found by that name: offer to make it.
      const typed = query.trim();
      creating = null;
      if (options.create && typed && !found.some((record) => record.label.trim().toLowerCase() === typed.toLowerCase())) {
        creatingText = typed;
        creating = { id: '__create__', label: fill(labels.createNamed, { name: typed }) };
        results = [...results, creating];
      }
      creatingText = typed;
      extras = new Map((options.more?.(typed, overflow) ?? []).map((extra, i) => [{ id: `__more_${i}__`, label: extra.label }, extra.act]));
      results = [...results, ...extras.keys()];
      active = held === undefined ? -1 : results.findIndex((record) => record.id === held);
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
      if (!editing && input.value !== text) input.value = text;
    },
    setReadonly(next) {
      readonly = next;
      if (input.readOnly !== next) input.readOnly = next;
      if (next) close();
    },
    close,
  };
}

/**
 * A linked record's picture, as Flectra's avatar widgets show one: its own,
 * or the initials of its name in a circle when it has none.
 */
export function linkAvatar(doc: Document, record: RelatedRecord | null | undefined, into?: HTMLElement): HTMLElement {
  const box = into ?? doc.createElement('span');
  box.className = 'fd-link-avatar';
  box.setAttribute('aria-hidden', 'true');
  if (!record) {
    box.hidden = true;
    box.replaceChildren();
    return box;
  }
  box.hidden = false;
  if (record.avatar) {
    const img = doc.createElement('img');
    img.src = record.avatar;
    img.alt = '';
    box.replaceChildren(img);
  } else {
    const words = record.label.trim().split(/\s+/).filter(Boolean);
    box.textContent = (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0]?.[0] ?? '')).toUpperCase();
  }
  return box;
}

/**
 * A linked record's lines under it — an address, a tax number — each a line
 * of its own that reads its own way: an address in English stays in its order
 * on a page read right to left, still lined up with the page.
 */
export function detailLines(box: HTMLElement, text: string): void {
  const doc = box.ownerDocument;
  box.replaceChildren(
    ...text.split('\n').map((line) => {
      const row = doc.createElement('div');
      row.textContent = line;
      return row;
    })
  );
}

/** What a link's node asks of it beyond its name: a picture, lines under it, a colour, and whether its record opens. */
function shows(node: FieldNode) {
  const options = node.options ?? {};
  return { avatar: options['avatar'] === true, details: options['details'] === true, colors: options['colors'] === true, opens: options['open'] !== false };
}

/** Making a record from a typed name, unless the page turns it off or the data source cannot. */
function creator(form: Form, name: string, node: FieldNode): ((text: string) => Promise<RelatedRecord>) | undefined {
  return node.options?.['create'] !== false && form.canCreate(name) ? (text) => form.quickCreate(name, text) : undefined;
}

export const many2oneWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, dialogs }) => {
  const relation = field.type === 'many2one' ? field.relation : '';
  const own = shows(node);
  // No button to open it where the page says so, as Flectra's no_open.
  const canOpen = own.opens && !!dialogs && dialogs.canOpen(relation);
  let readonly = false;
  const box = combobox({
    document,
    id,
    labels,
    // One past what the list shows, to know whether Search more… has more to find.
    search: (query) => form.search(name, query, SHOWN + 1),
    shown: SHOWN,
    pick: (record) => form.setValue(name, record),
    onCommitEmpty: () => form.setValue(name, null),
    create: creator(form, name, node),
    placeholder: node.placeholder,
    // With dialogs: make a record in its own page, or pick from a full list when the short one has no room.
    more: (typed, overflow) => {
      if (!dialogs || readonly) return [];
      const choices: { label: string; act: (text: string) => Promise<RelatedRecord | null> }[] = [];
      if (typed && canOpen && node.options?.['create'] !== false) {
        // The new record starts with the name typed and what the link hands on.
        choices.push({
          label: labels.createAndEdit,
          act: (text) => {
            const values = form.createValues(name);
            return dialogs.openRecord(relation, { name: text, title: field.label, ...(Object.keys(values).length ? { values } : {}) });
          },
        });
      }
      if (overflow) choices.push({ label: labels.searchMore, act: () => dialogs.searchMore({ title: field.label, search: (query, limit) => form.search(name, query, limit) }) });
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
  // The record's picture before its name; lines of it — an address — under the link.
  const avatar = own.avatar ? linkAvatar(document, null) : null;
  if (avatar) {
    box.element.prepend(avatar);
    box.element.setAttribute('data-avatar', '');
  }
  const details = own.details ? document.createElement('div') : null;
  let element = box.element;
  if (details) {
    details.className = 'fd-link-details';
    details.hidden = true;
    element = document.createElement('div');
    element.className = 'fd-link';
    element.append(box.element, details);
  }
  return {
    element,
    focus: () => box.input.focus(),
    update(state) {
      const record = state.value as RelatedRecord | null | undefined;
      if (avatar) linkAvatar(document, record, avatar);
      if (details) {
        const lines = record?.details?.trim() ?? '';
        setHidden(details, !lines);
        if (details.textContent !== lines.replace(/\n/g, '')) detailLines(details, lines);
      }
      readonly = state.readonly;
      box.setText(record?.label ?? '');
      box.setReadonly(state.readonly);
      setHidden(clear, !record || state.readonly);
      if (open) {
        setHidden(open, !record);
        if (record) setAttr(open, 'aria-label', fill(labels.openNamed, { name: record.label }));
      }
      setAttr(box.input, 'aria-invalid', String(state.invalid));
      setAttr(box.input, 'aria-required', String(state.required));
      if (state.describedBy) setAttr(box.input, 'aria-describedby', state.describedBy);
    },
  } satisfies Widget;
};

export const tagsWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, dialogs }) => {
  const relation = field.type === 'many2many' ? field.relation : '';
  const own = shows(node);
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
    // One past what the list shows, besides those chosen, to know whether Search more… has more to find.
    search: (query) => form.search(name, query, SHOWN + 1 + current().length),
    shown: SHOWN,
    pick: (record) => {
      if (!current().some((r) => r.id === record.id)) form.setValue(name, [...current(), record]);
      box.input.value = '';
    },
    exclude: () => new Set(current().map((record) => record.id)),
    onEmptyBackspace: () => {
      const records = current();
      if (records.length) form.setValue(name, records.slice(0, -1));
    },
    create: creator(form, name, node),
    placeholder: node.placeholder,
    // With dialogs: pick from a full list when the short one has no room.
    more: (_typed, overflow) => (dialogs && overflow ? [{ label: labels.searchMore, act: () => dialogs.searchMore({ title: field.label, search: (query, limit) => form.search(name, query, limit) }) }] : []),
  });
  // A linked record, opened from its tag in a dialog where the app can show it; a new name it is saved with follows here.
  const open =
    own.opens && dialogs && dialogs.canOpen(relation)
      ? async (record: RelatedRecord) => {
          const saved = await dialogs.openRecord(relation, { recordId: record.id, title: record.label });
          if (saved && saved.label !== record.label) form.setValue(name, current().map((r) => (r.id === record.id ? saved : r)));
        }
      : undefined;
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
      drawChips(chips, records, readonly, labels, (record) => form.setValue(name, current().filter((r) => r.id !== record.id)), open, own);
      box.setText('');
    },
  };
};

/**
 * Chips for tags, each with a remove button unless read-only; with `open`,
 * each one's words a button that opens it. With `look`, each in its record's
 * colour (Flectra's 1 to 11) and with its picture.
 */
function drawChips(chips: HTMLElement, records: RelatedRecord[], readonly: boolean, labels: WidgetLabels, remove: (record: RelatedRecord) => void, open?: (record: RelatedRecord) => void, look: { avatar?: boolean; colors?: boolean } = {}) {
  const doc = chips.ownerDocument;
  chips.replaceChildren(
    ...records.map((record) => {
      const chip = doc.createElement('li');
      chip.className = 'fd-chip';
      if (look.colors && typeof record.color === 'number' && record.color >= 1 && record.color <= 11) chip.setAttribute('data-color', String(Math.trunc(record.color)));
      if (look.avatar) chip.append(linkAvatar(doc, record));
      const text = doc.createElement(open ? 'button' : 'span');
      text.className = 'fd-chip-label';
      text.textContent = record.label;
      if (open) {
        (text as HTMLButtonElement).type = 'button';
        text.setAttribute('aria-label', fill(labels.openNamed, { name: record.label }));
        text.addEventListener('click', () => open(record));
      }
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
 * is "," unless set; with `options.max`, the box goes once there are as many.
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
    if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase()) && !(tags.length >= (options['max'] as number))) write([...tags, tag]);
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
    placeholder: node.placeholder,
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
      box.element.hidden = state.readonly || tags.length >= (options['max'] as number);
      box.input.setAttribute('aria-invalid', String(state.invalid));
      if (state.describedBy) box.input.setAttribute('aria-describedby', state.describedBy);
      const key = JSON.stringify([state.readonly, tags]);
      if (key === drawn) return;
      drawn = key;
      const typing = document.activeElement === box.input;
      drawChips(chips, tags.map((t) => ({ id: t, label: t })), state.readonly, labels, (record) => write(current().filter((t) => t !== record.label)));
      box.setText('');
      // The box gone at the most, the cursor stays in the keywords: on the last one's ×.
      if (typing && box.element.hidden) chips.querySelector<HTMLButtonElement>('li:last-child button')?.focus();
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
    placeholder: context.node.placeholder,
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
