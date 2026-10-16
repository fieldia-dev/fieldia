import { foldDigits, foldForSearch, stripMarks, type FieldNode, type Form, type ReferenceValue, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { floatUnder } from './float';
import { guard, quoted, refusalHint } from './input-rules';
import { setAttr, setHidden } from './kind-parts';
import { drawIcon } from './icons';
import { stillShown, whileShown } from './shown';
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
  /** The box's own aria-describedby (`base`) with its hint's, while one shows. */
  describedBy(base: string | undefined): string | undefined;
  /** Whether the box holds words typed that the form keeps unread: marked, as a number box's are. */
  unread(): boolean;
  /** Its reader taken from the form: at once, or once a name it is looking up is found (a cell's editor closing). */
  destroy(): void;
}

/**
 * What typed words come to (the input rules, 7): Enter takes the match the arrows reached, else the only match,
 * else the record of that exact name — and never sends the form; leaving the box takes the exact name, else puts
 * back what it held. When nothing is called so, the box says it under itself, politely.
 */
interface TypedRules {
  /** The field's label, as the words name it. */
  label: string;
  /** Leaving with words typed takes the exact name: unless false (an adder button, which goes back to itself). */
  leave?: boolean;
  /** Enter with nothing matching: what the widget makes of it (a new tag, made), or false when it makes nothing. */
  unmatched?: (text: string) => Promise<unknown> | false;
  /**
   * The form the box writes, and its field's name there: words typed and not yet a pick are read for every save,
   * check and step forward (`form.settling`) — the record they name taken, waited for by a save — and kept unread
   * with why meanwhile, or when nothing is called so, so nothing is saved over them.
   */
  form?: Pick<Form, 'getState' | 'setUnread'> & Partial<Pick<Form, 'settling' | 'recordShown'>>;
  name?: string;
}

/** A reading of words typed: what made it, whether a save waits for it, and its end. */
interface Reading {
  text: string;
  /** Enter: the only match is taken too. Leaving, and a save, take the exact name only. */
  enter: boolean;
  /** A save (or a check) waits for it: words that name nothing are kept, unread, never put back under it. */
  awaited: boolean;
  done: Promise<void>;
}

/** Words as a search compares them: case, Arabic letter forms and digits folded. */
const folded = (text: string) => foldForSearch(text).trim();
/** A query as the data source gets it: digits in any script as 0-9, no direction marks. */
const asQuery = (text: string) => foldDigits(stripMarks(text));

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
  /** What Enter and leaving make of typed words: a record's box's rules. Left out, Enter acts only on a match reached. */
  typed?: TypedRules;
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
  // Why typed words were not taken, under the box: polite, gone at the next key.
  const hint = options.typed ? refusalHint(input, element) : null;

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
  /** The last list found, for the words it was asked for: a save reads an exact name from it without a wait. */
  let lastFound: { query: string; found: RelatedRecord[] } | null = null;

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
    // A record picked from the list: words a save kept unread go with it.
    typedSeq++;
    pending = null;
    letGo();
    // A record made, or picked in a dialog, is for the record the form showed as it was asked for: never another's.
    const pick = whileShown(options.typed?.form, options.pick);
    if (record === creating && options.create) {
      void options.create(typed).then(pick, () => undefined);
      return;
    }
    const act = extras.get(record);
    if (act) {
      void act(typed).then((picked) => picked && pick(picked), () => undefined);
      return;
    }
    options.pick(record);
  }

  function lookUp(query: string) {
    clearTimeout(timer);
    const mine = ++seq;
    timer = setTimeout(async () => {
      const found = await options.search(asQuery(query)).catch(() => [] as RelatedRecord[]);
      if (mine !== seq || doc.activeElement !== input) return; // a newer search, or the person left
      // A record the arrow keys reached stays reached if the answer still lists it.
      const reached = results[active];
      const held = reached && reached !== creating && !extras.has(reached) ? reached.id : undefined;
      const hidden = options.exclude?.() ?? new Set();
      const kept = found.filter((record) => !hidden.has(record.id));
      lastFound = { query, found: kept };
      const overflow = options.shown !== undefined && kept.length > options.shown;
      results = overflow ? kept.slice(0, options.shown) : kept;
      // Nothing found by that name: offer to make it.
      const typed = query.trim();
      creating = null;
      if (options.create && typed && !found.some((record) => folded(record.label) === folded(typed))) {
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

  /**
   * The record typed words name: the only match (on Enter), else the one of that exact name, in any case and with
   * Arabic letters in any of their forms; null for none.
   */
  async function named(text: string, onlyMatch: boolean): Promise<RelatedRecord | null> {
    const found = await options.search(asQuery(text.trim())).catch(() => [] as RelatedRecord[]);
    const hidden = options.exclude?.() ?? new Set();
    const kept = found.filter((record) => !hidden.has(record.id));
    if (onlyMatch && kept.length === 1) return kept[0];
    return kept.find((record) => folded(record.label) === folded(text)) ?? null;
  }
  /** Why nothing was taken of words typed: nothing is called so (or, where it can be, it is not made yet). */
  const noMatchWords = (text: string) => fill(options.create ? labels.noMatchCreate : labels.noMatch, { label: options.typed?.label ?? '', text: quoted(text) });
  /** Nothing is called what was typed: said under the box, with what the field still holds. */
  function noMatch(text: string) {
    if (!hint || !options.typed) return;
    const words = noMatchWords(text);
    hint.show(shown ? `${words}. ${fill(labels.stillHolds, { label: options.typed.label, value: shown })}` : words);
  }

  // ---- words typed, read --------------------------------------------------------------------------------------
  // Enter reads them (the only match, else the exact name), and so does leaving the box (the exact name); a save,
  // a check and a step forward read them too (`form.settling`), as if the box were left, and a save waits for the
  // record they name. Meanwhile, and when nothing is called so, the form keeps them unread, with why: a save made
  // while they are looked up, or that finds none, never saves the record the box held before them.
  const form = options.typed?.form;
  const path = options.typed?.name;
  const unreadNow = () => (form && path ? form.getState().unread?.[path] : undefined);
  const keep = (text: string, message: string) => form && path && form.setUnread(path, { text, message });
  const letGo = () => form && path && unreadNow() && form.setUnread(path, null);
  /** Words left typed in the box: one of every Enter, leaving or save, the latest, is acted on. */
  let typedSeq = 0;
  /** The words being looked up now, and what is waiting for them. */
  let pending: Reading | null = null;

  /** The record typed words name, taken: the box shows it, its words go, and the form's unread text with them. */
  function take(record: RelatedRecord) {
    close();
    editing = false;
    hint?.hide();
    letGo();
    options.pick(record);
  }

  /** Words read: the record they name taken; else said, and — when a save waits for them — kept unread, with why. */
  function readWords(text: string, enter: boolean, awaited: boolean): Reading {
    const mine = ++typedSeq;
    const reading: Reading = { text, enter, awaited, done: Promise.resolve() };
    const asked = stillShown(form);
    reading.done = named(text, enter).then(async (record) => {
      if (pending === reading) pending = null;
      // Typed on a record no longer shown — another opened, it loaded again, the person's Discard: nothing is taken, and
      // the box shows what the record shown holds.
      if (!asked()) {
        if (!editing && input.value === text) input.value = unreadNow()?.text ?? shown;
        return;
      }
      // Typed in again, or read again, since: the latest acts; a save waiting for these reads what the box holds now.
      if (mine !== typedSeq) {
        if (reading.awaited) await readForSave();
        return;
      }
      const here = doc.activeElement === input;
      if (here && input.value !== text) return;
      // Left, then come back to before they were found: the words are still the person's, and the next leaving acts.
      if (here && !enter && !reading.awaited) return;
      if (record) return take(record);
      if (here && enter) {
        // Enter on words that name nothing: the widget may make something of them (a new tag), else it says so.
        const made = options.typed?.unmatched?.(text.trim());
        if (made) {
          await made;
          letGo();
          return;
        }
        close();
        noMatch(text.trim());
        if (reading.awaited) keep(text, noMatchWords(text.trim()));
        return;
      }
      if (reading.awaited) {
        // A save waits: the words stay as typed, marked, and it is refused with why, never saving what the box held.
        if (input.value !== text) input.value = text;
        if (here) noMatch(text.trim());
        keep(text, noMatchWords(text.trim()));
        return;
      }
      // Left with words that name nothing: what it held comes back, and it says so.
      input.value = shown;
      letGo();
      noMatch(text.trim());
    });
    pending = reading;
    return reading;
  }

  /**
   * The words typed, read for a save, a check or a step forward, as if the box were left: the exact name taken at
   * once when the last list found holds it, else looked up — kept unread meanwhile, a save waiting for it.
   */
  function readForSave(): Promise<void> | undefined {
    if (readonly || !options.typed) return undefined;
    const typing = doc.activeElement === input && editing;
    const text = typing ? input.value : (pending?.text ?? null);
    if (text === null) return undefined;
    if (typing && text.trim() === '') {
      // Emptied, and saved so: no record, as leaving it would make it.
      editing = false;
      letGo();
      if (shown !== '') options.onCommitEmpty?.();
      return undefined;
    }
    if (typing && text === shown) return undefined;
    if (pending && pending.text === text) {
      pending.awaited = true;
      keep(text, fill(labels.lookingUp, { label: options.typed.label, text: quoted(text.trim()) }));
      return pending.done;
    }
    // The list for these very words is here: the record of that exact name in it, at once.
    const listed = lastFound && folded(lastFound.query) === folded(text) ? lastFound.found.find((record) => folded(record.label) === folded(text)) : undefined;
    if (listed) {
      typedSeq++;
      take(listed);
      return undefined;
    }
    keep(text, fill(labels.lookingUp, { label: options.typed.label, text: quoted(text.trim()) }));
    return readWords(text, false, true).done;
  }
  // Still typed in: autosave, which nobody pressed, waits until the box is left, never reading the words under the keys.
  const stopReading = form && path && typeof form.settling === 'function' ? form.settling(readForSave, () => doc.activeElement === input && editing) : null;

  input.addEventListener('input', () => {
    editing = true;
    // Words typed since a reading began: that reading no longer acts on them.
    typedSeq++;
    hint?.hide();
    if (!readonly) lookUp(input.value);
  });
  input.addEventListener('focus', () => {
    // Come back to words the form keeps unread, or still being looked up: they are the person's own, and leaving
    // reads them again.
    if ((unreadNow() && input.value === unreadNow()?.text) || (pending && input.value === pending.text)) editing = true;
    if (!readonly) lookUp('');
  });
  // A click on the box opens its list, as a focus does: after Escape closed it, the focus has not left to come back.
  input.addEventListener('click', () => {
    if (!readonly && list.hidden && doc.activeElement === input) lookUp(editing ? input.value : '');
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
      case 'Enter': {
        if (!list.hidden && active >= 0) {
          event.preventDefault();
          choose(active);
          return;
        }
        const text = input.value;
        // Words typed: never the form's Enter. The only match, or the exact name, is taken; else it says so. With
        // Ctrl, the form's save follows, and waits for this reading (`readForSave`).
        if (!options.typed || !editing || !text.trim()) return;
        event.preventDefault();
        if (pending?.text === text && pending.enter) return;
        readWords(text, true, !!pending?.awaited);
        return;
      }
      case 'Tab': {
        // A record the arrows reached goes with the person, as Enter would take it (never a Create… or Search more…).
        const reached = results[active];
        if (options.typed && !list.hidden && reached && reached !== creating && !extras.has(reached)) choose(active);
        return;
      }
      case 'Escape':
        if (!list.hidden) event.preventDefault();
        close();
        editing = false;
        typedSeq++;
        pending = null;
        input.value = shown;
        letGo();
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
    const text = input.value;
    const emptied = editing && text.trim() === '' && shown !== '';
    const left = editing && text.trim() !== '' && text !== shown && options.typed && options.typed.leave !== false;
    editing = false;
    if (emptied) {
      letGo();
      return options.onCommitEmpty?.();
    }
    if (!left) {
      // Typed back to what it holds: nothing is left unread.
      if (text === shown) letGo();
      if (!unreadNow()) input.value = shown;
      return;
    }
    // Words left in the box: the record of that exact name is taken; else what it held comes back, and it says so —
    // unless a save is waiting for them, which keeps them, unread, with why. Enter's reading of them, on its way, acts.
    if (pending?.text !== text) readWords(text, false, false);
  });

  return {
    element,
    input,
    setText(text) {
      shown = text;
      // Words the form keeps unread stay as typed, marked; anything else shows what the field holds.
      const kept = unreadNow();
      const want = kept && !pending ? kept.text : text;
      if (!editing && !pending && input.value !== want) input.value = want;
    },
    setReadonly(next) {
      readonly = next;
      if (input.readOnly !== next) input.readOnly = next;
      if (next) close();
    },
    close,
    describedBy: (base) => (hint ? hint.describedBy(base) : base || undefined),
    unread: () => !!unreadNow(),
    destroy() {
      if (!stopReading) return;
      // A name still being looked up is still read for a save: its reader goes once it is found, or not.
      if (pending) void pending.done.then(stopReading, stopReading);
      else stopReading();
    },
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

/**
 * Tags added from a button (`options.adder: "button"`), as a work tracker's
 * "Add Tag": its words the page's placeholder, else "Add {label}". Pressed,
 * it turns into the tag box with its suggestions; it comes back once a tag is
 * added, on Escape, and when the box is left.
 */
function tagAdder(doc: Document, words: string, box: Combobox, home: HTMLElement) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'fd-tags-adder';
  button.textContent = words;
  let adding = false;
  let readonly = false;
  const show = () => {
    setHidden(button, adding || readonly);
    setHidden(box.element, !adding || readonly);
  };
  const stop = (focus: boolean) => {
    if (!adding) return;
    adding = false;
    box.close();
    box.input.value = '';
    show();
    if (focus) button.focus();
  };
  button.addEventListener('click', () => {
    adding = true;
    show();
    box.input.focus();
  });
  box.input.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !adding) return;
    // Back to the button, the tags as they are: not the field's own Escape, which puts back what it held.
    event.preventDefault();
    stop(true);
  });
  // Left for somewhere else (not for its own list, which keeps the focus): the button again.
  box.input.addEventListener('blur', () => setTimeout(() => adding && !home.contains(doc.activeElement) && stop(false)));
  show();
  return {
    button,
    /** A tag added: the button again, the focus on it. */
    added: () => stop(true),
    setReadonly(next: boolean) {
      readonly = next;
      if (next) adding = false;
      show();
    },
  };
}

/** The words of a button that adds tags: the page's own, else "Add {label}". */
const adderWords = (node: FieldNode, label: string, labels: WidgetLabels) => node.placeholder || fill(labels.addNamed, { label });

/** A person's outline, as a work tracker draws one where no one is picked yet: a head over a bowl. */
const NOBODY = { nobody: '<circle cx="10.5" cy="5.9" r="3.3"/><path d="M3.75 12.75h13.5v1.5a6.75 6 0 0 1-13.5 0z"/>' };

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
    typed: { label: node.label ?? field.label, form, name },
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
      const rename = whileShown(form, (saved: RelatedRecord) => form.setValue(name, saved));
      const saved = await dialogs.openRecord(relation, { recordId: current.id, title: current.label });
      if (saved && saved.label !== current.label) rename(saved);
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
  // No one picked yet, a person's outline stands where the picture will (shown in the quiet look: "No one selected").
  const nobody = avatar ? document.createElement('span') : null;
  if (avatar && nobody) {
    nobody.className = 'fd-link-nobody';
    nobody.setAttribute('aria-hidden', 'true');
    const outline = drawIcon(document, 'nobody', NOBODY);
    if (outline) nobody.append(outline);
    box.element.prepend(avatar, nobody);
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
    destroy: () => box.destroy(),
    update(state) {
      const record = state.value as RelatedRecord | null | undefined;
      if (avatar) linkAvatar(document, record, avatar);
      if (nobody) setHidden(nobody, !!record);
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
      // Words left unread are marked once the box is left, as a number box's are.
      setAttr(box.input, 'aria-invalid', String(state.invalid || (box.unread() && document.activeElement !== box.input)));
      setAttr(box.input, 'aria-required', String(state.required));
      setAttr(box.input, 'aria-describedby', box.describedBy(state.describedBy) ?? null);
    },
  } satisfies Widget;
};

export const tagsWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, dialogs }) => {
  const relation = field.type === 'many2many' ? field.relation : '';
  const own = shows(node);
  const current = () => (form.getState().values[name] as RelatedRecord[] | null) ?? [];
  const createTag = creator(form, name, node);
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
      adder?.added();
    },
    exclude: () => new Set(current().map((record) => record.id)),
    onEmptyBackspace: () => {
      const records = current();
      if (records.length) form.setValue(name, records.slice(0, -1));
    },
    create: creator(form, name, node),
    placeholder: node.placeholder,
    // Added from a button, Enter with no tag of that name makes one; leaving goes back to the button.
    typed: {
      label: node.label ?? field.label,
      leave: node.options?.['adder'] !== 'button',
      form,
      name,
      unmatched: (text) => {
        if (node.options?.['adder'] !== 'button' || !createTag) return false;
        return createTag(text).then(
          whileShown(form, (record: RelatedRecord) => {
            if (!current().some((r) => r.id === record.id)) form.setValue(name, [...current(), record]);
            adder?.added();
          }),
          () => undefined
        );
      },
    },
    // With dialogs: pick from a full list when the short one has no room.
    more: (_typed, overflow) => (dialogs && overflow ? [{ label: labels.searchMore, act: () => dialogs.searchMore({ title: field.label, search: (query, limit) => form.search(name, query, limit) }) }] : []),
  });
  // A linked record, opened from its tag in a dialog where the app can show it; a new name it is saved with follows here.
  const open =
    own.opens && dialogs && dialogs.canOpen(relation)
      ? async (record: RelatedRecord) => {
          const rename = whileShown(form, (saved: RelatedRecord) => form.setValue(name, current().map((r) => (r.id === record.id ? saved : r))));
          const saved = await dialogs.openRecord(relation, { recordId: record.id, title: record.label });
          if (saved && saved.label !== record.label) rename(saved);
        }
      : undefined;
  // Added from a button, "Add Tag": Enter adds the tag typed, an existing one by its name or a new one (`typed` above).
  const adder = node.options?.['adder'] === 'button' ? tagAdder(document, adderWords(node, field.label, labels), box, element) : null;
  element.append(chips, box.element, ...(adder ? [adder.button] : []));
  let readonly = false;
  let drawn = '';
  return {
    element,
    focus: () => box.input.focus(),
    destroy: () => box.destroy(),
    update(state) {
      const records = (state.value as RelatedRecord[] | null) ?? [];
      // Rebuild the chips only when they change, not on every keystroke elsewhere.
      const key = JSON.stringify([state.readonly, records]);
      readonly = state.readonly;
      box.setReadonly(readonly);
      if (adder) adder.setReadonly(readonly);
      else box.element.hidden = readonly;
      box.input.setAttribute('aria-invalid', String(state.invalid || (box.unread() && document.activeElement !== box.input)));
      setAttr(box.input, 'aria-describedby', box.describedBy(state.describedBy) ?? null);
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
 * Free-text tags on a text field, kept as "oak, glass": Enter adds what was
 * typed, and so does a separator — the page's (`options.separator`, "," unless
 * set), and always "," and the Arabic "،" an Arabic keyboard's comma key types
 * — or a line break or a tab, so a list pasted on lines, or a row of cells
 * copied from a spreadsheet, is one tag a line or a cell. Backspace in
 * an empty box takes the last one away, and the node's `options.suggestions`
 * are offered as you type. A tag already there, in any case, is not added
 * twice: the hint under the box says so and its chip is marked. With
 * `options.max`, the box stays at the most and says so, naming the tags not
 * added; they stay in the box, and the form keeps them as text it could not
 * take, so Save says so too. Typing never moves the focus to a chip.
 */
export const charTagsWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale }) => {
  const words = labels ?? WIDGET_LABELS[locale ?? 'en'] ?? WIDGET_LABELS.en;
  const options = node.options ?? {};
  const separator = typeof options['separator'] === 'string' && options['separator'] ? options['separator'] : ',';
  const max = typeof options['max'] === 'number' ? options['max'] : Infinity;
  const label = node.label ?? field.label;
  const suggestions = Array.isArray(options['suggestions']) ? options['suggestions'].filter((s): s is string => typeof s === 'string') : [];
  const split = (text: unknown) =>
    typeof text === 'string' ? text.split(separator).map((t) => t.trim()).filter((t) => t !== '') : [];
  /** Typed or pasted text in its tags: at the page's separator, a comma in either script, a line break, and a tab (cells copied side by side). */
  const pieces = (text: string) => text.split(separator).flatMap((part) => part.split(/[,\u060c\r\n\t]/));
  const current = () => split(form.getState().values[name]);
  const write = (tags: string[]) => form.setValue(name, tags.length ? tags.join(`${separator} `) : null);
  /** A tag added, or why not: nothing typed, there already (in any case), or the most there already. */
  const add = (raw: string): 'added' | 'empty' | 'there' | 'full' => {
    const tag = raw.trim();
    const tags = current();
    if (!tag) return 'empty';
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return 'there';
    if (tags.length >= max) return 'full';
    write([...tags, tag]);
    return 'added';
  };
  /** Tags typed or pasted added in turn; the hint says which are there already, or not added at the most. Those not added. */
  const addAll = (raws: string[]): string[] => {
    const left: string[] = [];
    let there = '';
    for (const raw of raws) {
      const result = add(raw);
      if (result === 'full') left.push(raw.trim());
      else if (result === 'there') there = raw.trim();
    }
    if (left.length) hint.show(fill(words.tagsAtMost, { label, max: String(max), tags: left.join(`${separator} `) }));
    else if (there) {
      hint.show(fill(words.tagThere, { tag: there }));
      markThere(there);
    }
    return left;
  };

  const element = document.createElement('div');
  element.className = 'fd-tags';
  element.setAttribute('role', 'group');
  const chips = document.createElement('ul');
  chips.className = 'fd-chips';
  /** Tags not added at the most, waiting in the box for room. */
  let waiting = '';
  const box = combobox({
    document,
    id,
    labels: words,
    placeholder: node.placeholder || words.addTag,
    search: async (query) => {
      const taken = new Set(current().map((t) => t.toLowerCase()));
      const wanted = query.trim().toLowerCase();
      return suggestions
        .filter((s) => !taken.has(s.toLowerCase()) && s.toLowerCase().includes(wanted))
        .map((s) => ({ id: s, label: s }));
    },
    pick: (record) => {
      addAll([record.label]);
      box.input.value = '';
      adder?.added();
    },
    onEmptyBackspace: () => {
      const tags = current();
      if (tags.length) write(tags.slice(0, -1));
    },
  });
  // Said under the tags, as any box's refusals are: a tag there already, tags past the most.
  const hint = refusalHint(box.input, element);
  const checks = guard(box.input, {
    judge: () => null,
    // A list pasted — on lines, or with separators — is its tags, added at once; one word is typed as any.
    paste(text) {
      const parts = pieces(text);
      if (parts.length < 2) return { text: text.trim() };
      const left = addAll([box.input.value, ...parts]);
      box.input.value = '';
      return left.length || hint.words ? { refuse: hint.words } : { text: '' };
    },
  }, hint);
  /** The chip of a tag there already, marked a moment for the eye. */
  let marked: ReturnType<typeof setTimeout> | undefined;
  function markThere(tag: string) {
    const chip = [...chips.querySelectorAll<HTMLElement>('.fd-chip')].find((c) => c.querySelector('.fd-chip-label')?.textContent?.toLowerCase() === tag.toLowerCase());
    if (!chip) return;
    chip.classList.add('fd-chip-there');
    clearTimeout(marked);
    marked = setTimeout(() => chip.classList.remove('fd-chip-there'), 1600);
  }
  /** What is left in the box: the tags not added, kept for the person to see. */
  const keep = (left: string[], rest = '') => (box.input.value = [...left, rest].filter(Boolean).join(`${separator} `));
  // Enter with nothing chosen from the list adds what was typed; never sends the form.
  box.input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented || box.input.value.trim() === '') return;
    event.preventDefault();
    const left = addAll(pieces(box.input.value));
    keep(left);
    box.close();
    if (!left.length) adder?.added();
  });
  // A separator typed ends a tag.
  box.input.addEventListener('input', () => {
    const parts = pieces(box.input.value);
    if (parts.length < 2) return;
    keep(addAll(parts.slice(0, -1)), parts[parts.length - 1].trimStart());
    checks.accept();
  });
  /** What is typed and not yet added, taken: added, or kept waiting in the box, the form keeping it with the reason. */
  const commit = () => {
    if (box.input.readOnly) return;
    const typed = box.input.value.trim();
    const left = typed ? addAll(pieces(typed)) : [];
    waiting = left.join(`${separator} `);
    if (box.input.value !== waiting) keep(left);
    box.setText(waiting);
    form.setUnread(name, waiting ? { text: waiting, message: fill(words.tagsAtMost, { label, max: String(max), tags: waiting }) } : null);
  };
  // Typed and left without Enter, or taken by Ctrl+Enter's save (a change): kept. (Before the box itself hears it left.)
  box.input.addEventListener('change', commit);
  element.addEventListener('blur', (event) => event.target === box.input && commit(), true);
  // Added from a button, "Add Tag", that turns into the box and comes back once a tag is added.
  const adder = options['adder'] === 'button' ? tagAdder(document, adderWords(node, field.label, words), box, element) : null;
  element.append(chips, box.element, ...(adder ? [adder.button] : []));
  let drawn = '';
  return {
    element,
    focus: () => box.input.focus(),
    destroy: () => {
      clearTimeout(marked);
      checks.destroy();
    },
    update(state) {
      const tags = split(state.value);
      box.setReadonly(state.readonly);
      const full = tags.length >= max;
      // At the most, the box stays: what is typed there is told it waits for room.
      if (adder) adder.setReadonly(state.readonly || full);
      else box.element.hidden = state.readonly;
      box.input.setAttribute('aria-invalid', String(state.invalid || !!form.getState().unread?.[name]));
      const described = hint.describedBy(state.describedBy);
      if (described) box.input.setAttribute('aria-describedby', described);
      else box.input.removeAttribute('aria-describedby');
      const key = JSON.stringify([state.readonly, tags]);
      if (key === drawn) return;
      drawn = key;
      drawChips(chips, tags.map((t) => ({ id: t, label: t })), state.readonly, words, (record) => write(current().filter((t) => t !== record.label)));
      box.setText(waiting);
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
    typed: { label: context.node.label ?? field.label, form, name },
  });
  element.append(select, box.element);
  return {
    element,
    focus: () => (model ? box.input.focus() : select.focus()),
    destroy: () => box.destroy(),
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
