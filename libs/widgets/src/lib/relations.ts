import { foldDigits, foldForSearch, labelAt, stripMarks, type FieldNode, type Form, type ReferenceValue, type RelatedRecord } from '@fieldia/core';
import { WIDGET_LABELS, type WidgetLabels } from './labels';
import { floatUnder } from './float';
import { guard, quoted, refusalHint } from './input-rules';
import { setAttr, setHidden, typeInto } from './kind-parts';
import { drawIcon } from './icons';
import { detailLines, linkAvatar } from './link-avatar';
import { stillShown, whileShown } from './shown';
import { scanPart, scans } from './widget-parts';
import { loadingWay, startLoading, type Loading } from './loading';
import type { Widget, WidgetContext, WidgetFactory } from './widgets';

/**
 * Pickers for related records: a search-as-you-type combobox (the ARIA 1.2
 * combobox pattern), tags for a many2many, and a reference picker. Results
 * come from the data source through the form, so a field's filter applies.
 *
 * In the relations part (relations-part.ts), loaded the first time a page shows
 * one: drawn plainly meanwhile (relations-plain.ts), where words typed before it
 * came are kept and handed to its box as typed (`takeTyped`).
 */

const DEBOUNCE_MS = 180;
/** How many matches a link's list shows, as the data source's search would. */
const SHOWN = 8;
/** As many records of one exact name as are asked for: two tell there are several. */
const EXACT = 20;

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
  /** Words typed let go, and any reading of them on its way: what they were typed for changed (a reference's model). */
  drop(): void;
  /** Its reader taken from the form: at once, or once a name it is looking up is found (a cell's editor closing). */
  destroy(): void;
}

/**
 * What typed words come to (the input rules, 7): Enter takes the record of that exact name — whatever row the list
 * has reached, unless the arrows reached it since the words were typed — else the row reached, else the only match;
 * and never sends the form. Leaving the box, or a save, takes the exact name. Words that name none, or several, stay
 * as typed — the form keeps them unread with why, so a save is refused rather than made with the record the box held —
 * and the box says so under itself, politely; Escape puts back what it held.
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

/**
 * What typed words name among the records a search found: the one record of that exact name (or, on Enter, the only
 * match); `several` when more than one has it; `chosen` when it is a record already chosen (a tag there); else null.
 */
type Named = RelatedRecord | 'several' | 'chosen' | null;

/** A reading of words typed: what made it, whether a save waits for it, and its end. */
interface Reading {
  text: string;
  /** Enter: the only match is taken too. Leaving, and a save, take the exact name only. */
  enter: boolean;
  /** A save (or a check) waits for it: words that name nothing are kept, unread, never put back under it. */
  awaited: boolean;
  done: Promise<void>;
}

/** A record's colour as Flectra numbers them, 1 to 11: the same as its tag's (`.fd-chip[data-color]`, styles-sheet.ts). */
const RECORD_COLOURS = ['#f06050', '#f4a460', '#f7cd1f', '#6cc1ed', '#814968', '#eb7e7f', '#2c8397', '#475577', '#d6145f', '#30c381', '#9365b8'];

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
  /**
   * The records named exactly so (`form.search`'s `exact`): asked when a search's first answers, cut at the list's
   * room, did not hold the name typed — or held it once, where others of that name may come after.
   */
  exact?: (name: string) => Promise<RelatedRecord[]>;
  /** The record typed words name as a code, asked before they are read as a name: a link scanned into (`typedLink`). */
  code?: (typed: string) => Promise<RelatedRecord | null>;
  /** How many found records the list shows; a search may find one more, to tell there are others. */
  shown?: number;
  /** The empty box's words: the page's own, else "Search…". */
  placeholder?: string;
  /** Further choices at the end of the list: each acts on the typed text and may hand back a record to pick. */
  more?: (typed: string, overflow: boolean) => { label: string; act: (typed: string) => Promise<RelatedRecord | null> }[];
  /** What Enter and leaving make of typed words: a record's box's rules. Left out, Enter acts only on a match reached. */
  typed?: TypedRules;
  /** How its search waits (`search`, loading.ts): "Searching…" in its list unless the page says otherwise. */
  loading?: Loading | undefined;
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
  /** The last list found, for the words it was asked for (those chosen left in): a save reads an exact name from it without a wait. */
  let lastFound: { query: string; found: RelatedRecord[] } | null = null;
  /** The words in the box when the arrows last reached a row: Enter takes that row only for the same words. */
  let reachedFor: string | null = null;

  function render() {
    list.replaceChildren();
    results.forEach((record, i) => {
      const option = doc.createElement('li');
      option.id = `${listId}-${i}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(i === active));
      option.className = `fd-option${i === active ? ' fd-active' : ''}${record === creating || extras.has(record) ? ' fd-option-create' : ''}`;
      // What a record shows besides its name, where its source gives it: its picture or its colour before it, its first
      // line of details under it (a staff member's role, a service's price), and its words at the row's end. They
      // describe the row, read after its name; the row is named by the record's name alone, as it always was.
      const avatar = record.avatar ? linkAvatar(doc, record) : null;
      const color = typeof record.color === 'number' && record.color >= 1 && record.color <= 11 ? doc.createElement('span') : null;
      if (color) {
        color.className = 'fd-option-dot';
        color.setAttribute('data-color', String(Math.trunc(record.color as number)));
        color.style.setProperty('--fd-option-color', RECORD_COLOURS[Math.trunc(record.color as number) - 1]);
      }
      const details = record.details?.split('\n').find((line) => line.trim());
      if (avatar || color || details || record.aside) {
        option.classList.add('fd-option-rich');
        const text = doc.createElement('span');
        text.className = 'fd-option-text';
        text.append(record.label);
        const more = (className: string, words: string, id: string) => {
          const span = Object.assign(doc.createElement('span'), { className, textContent: words, id: `${option.id}-${id}` });
          span.setAttribute('aria-hidden', 'true');
          return span;
        };
        const said = [...(details ? [more('fd-option-caption', details, 'more')] : []), ...(record.aside ? [more('fd-option-aside', record.aside, 'aside')] : [])];
        if (details) text.append(said[0]);
        option.append(...[avatar ?? color, text].filter((part): part is HTMLElement => !!part));
        if (record.aside) option.append(said[said.length - 1]);
        if (said.length) option.setAttribute('aria-describedby', said.map((span) => span.id).join(' '));
      } else option.textContent = record.label;
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

  /**
   * Its search's wait (`search`): "Searching…" in its list where the suggestions come — a ring at its box's end, as the
   * page says — taken over by the next search typed, never drawn twice; a search that fails says so there, with Retry.
   */
  const searching = (query: string) => {
    const inline = loadingWay(options.loading, 'search') !== 'spinner';
    return startLoading(inline ? list : element, 'search', options.loading, {
      part: id,
      failWords: labels.cantSearch,
      retry: () => {
        input.focus();
        lookUp(query);
      },
      place: (loader) => {
        if (!inline) return void element.append(loader);
        // In the list, never one of its options: a screen reader hears the wait said once, in the form's live region.
        const row = doc.createElement('li');
        row.className = 'fd-empty';
        row.setAttribute('role', 'none');
        // Its Retry pressed keeps the focus in the box, as a suggestion does.
        row.addEventListener('mousedown', (event) => event.preventDefault());
        row.append(loader);
        list.replaceChildren(row);
        open();
        floating.place();
        return row;
      },
    });
  };

  function lookUp(query: string) {
    clearTimeout(timer);
    const mine = ++seq;
    timer = setTimeout(async () => {
      const wait = searching(query);
      let found: RelatedRecord[];
      try {
        found = await options.search(asQuery(query));
      } catch (error) {
        if (mine !== seq || doc.activeElement !== input) return wait.stop();
        return wait.fail(error);
      }
      if (mine !== seq || doc.activeElement !== input) return wait.stop(); // a newer search, or the person left
      await wait.done();
      if (mine !== seq || doc.activeElement !== input) return;
      // A record the arrow keys reached stays reached if the answer still lists it.
      const reached = results[active];
      const held = reached && reached !== creating && !extras.has(reached) ? reached.id : undefined;
      const hidden = options.exclude?.() ?? new Set();
      const kept = found.filter((record) => !hidden.has(record.id));
      lastFound = { query, found };
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

  /** Whether a search's answer may have been cut at its limit: the list's room filled, one past it asked. */
  const cut = (found: readonly RelatedRecord[]) => options.shown !== undefined && found.filter((record) => !(options.exclude?.() ?? new Set()).has(record.id)).length > options.shown;

  /**
   * What typed words name among records found — in any case, with Arabic letters in any of their forms: the one
   * record of that exact name; on Enter (`onlyMatch`), the only match too; several, one already chosen, or none.
   */
  function among(text: string, found: readonly RelatedRecord[], onlyMatch: boolean): Named {
    const hidden = options.exclude?.() ?? new Set();
    const kept = found.filter((record) => !hidden.has(record.id));
    if (onlyMatch && kept.length === 1) return kept[0];
    const same = [...new Map(kept.filter((record) => folded(record.label) === folded(text)).map((record) => [String(record.id), record])).values()];
    if (same.length) return same.length === 1 ? same[0] : 'several';
    return found.some((record) => hidden.has(record.id) && folded(record.label) === folded(text)) ? 'chosen' : null;
  }

  /**
   * The record typed words name, looked up: as `among` finds it in a search for them. A search stops at its limit, in
   * the source's order, so where it filled the list the name is asked for exactly before it is called none — and
   * before one of that name is taken, in case another has it too.
   */
  async function named(text: string, onlyMatch: boolean): Promise<Named> {
    const coded = options.code ? await options.code(text).catch(() => null) : null;
    if (coded) return coded;
    const query = asQuery(text.trim());
    const found = await options.search(query).catch(() => [] as RelatedRecord[]);
    const first = among(text, found, onlyMatch);
    if (!options.exact || !cut(found) || first === 'several' || (first && first !== 'chosen' && folded(first.label) !== folded(text))) return first;
    const exact = await options.exact(query).catch(() => null);
    if (!exact) return first;
    const all = [...new Map([...found, ...exact].map((record) => [String(record.id), record])).values()];
    return among(text, all, false);
  }
  /** Why nothing was taken of words typed: nothing is called so (or, where it can be, it is not made yet), or several are. */
  const noMatchWords = (text: string, several = false) =>
    fill(several ? labels.severalCalled : options.create ? labels.noMatchCreate : labels.noMatch, { label: options.typed?.label ?? '', text: quoted(text) });
  /** Nothing — or more than one — is called what was typed: said under the box, with what the field still holds. */
  function noMatch(text: string, several = false) {
    if (!hint || !options.typed) return;
    const words = noMatchWords(text, several);
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

  /** Words naming a record already chosen (a tag there): nothing to add, nothing refused — they go, and it is said. */
  function there(text: string) {
    close();
    editing = false;
    letGo();
    input.value = shown;
    hint?.show(fill(labels.tagThere, { tag: text.trim() }));
  }

  /**
   * Words read: the record they name taken; else said, and kept unread with why — the words stay as typed, so a save
   * is refused over them rather than made with the record the box held. Enter on words that name none, the box still
   * the person's, keeps them there and says so (a widget may make something of them: a new tag).
   */
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
      if (record === 'chosen') return there(text);
      const several = record === 'several';
      if (record && !several) return take(record);
      if (here && enter && !several) {
        // Enter on words that name nothing: the widget may make something of them (a new tag), else it says so.
        const made = options.typed?.unmatched?.(text.trim());
        if (made) {
          await made;
          letGo();
          return;
        }
      }
      if (here && enter) {
        close();
        noMatch(text.trim(), several);
        if (reading.awaited) keep(text, noMatchWords(text.trim(), several));
        return;
      }
      // Left, or a save waits: the words stay as typed, marked, kept unread with why — a save refused over them,
      // never made with what the box held, which it still holds. Escape puts that back.
      if (input.value !== text) input.value = text;
      noMatch(text.trim(), several);
      keep(text, noMatchWords(text.trim(), several));
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
    // The list for these very words is here, whole: the record of that exact name in it, at once.
    const listed = lastFound && folded(lastFound.query) === folded(text) && !cut(lastFound.found) ? among(text, lastFound.found, false) : null;
    if (listed === 'chosen') {
      typedSeq++;
      there(text);
      return undefined;
    }
    if (listed && listed !== 'several') {
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
  });
  // Its list drops open for a person — a click (or a tap) on the box, a word typed, Alt+Down or the arrows — never for
  // the focus alone: the program takes the focus into a box (a dialog's first field, a refused save to the field to
  // fix, a label's press) and the list would fall over the fields under it, unasked. Tab into it, the same.
  input.addEventListener('click', () => {
    if (!readonly && list.hidden && doc.activeElement === input) lookUp(editing ? input.value : '');
  });
  input.addEventListener('keydown', (event) => {
    // A key an IME is composing with — the Enter that takes its word, the arrows through its candidates — is the IME's.
    if (readonly || event.isComposing || event.keyCode === 229) return;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        event.preventDefault();
        if (list.hidden) return lookUp(input.value);
        if (!results.length) return;
        active = (active + (event.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
        reachedFor = input.value;
        render();
        list.children[active]?.scrollIntoView?.({ block: 'nearest' });
        return;
      }
      case 'Enter': {
        const text = input.value;
        if (!list.hidden && active >= 0) {
          event.preventDefault();
          // A record of exactly the name typed is taken, whatever row is reached — unless the arrows reached it since.
          const exact = options.typed && reachedFor !== text && lastFound && folded(lastFound.query) === folded(text) ? among(text, lastFound.found, false) : null;
          if (exact && exact !== 'several' && exact !== 'chosen') {
            typedSeq++;
            pending = null;
            take(exact);
            return;
          }
          choose(active);
          return;
        }
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
  /** The box left — its blur, or the box taken away with the person's words in it (`destroy`). */
  function leave() {
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
      if (!unreadNow() && !pending) input.value = shown;
      return;
    }
    // Words left in the box: the record of that exact name is taken; else they stay, kept unread with why, and it says
    // so. Enter's reading of them, on its way, acts.
    if (pending?.text !== text) readWords(text, false, false);
  }
  input.addEventListener('blur', leave);

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
    drop() {
      close();
      editing = false;
      typedSeq++;
      pending = null;
      hint?.hide();
      letGo();
      input.value = shown;
    },
    destroy() {
      // Taken away with the person's words in it — a cell's editor closed, which a browser may do without a blur
      // (Firefox, WebKit): read as leaving reads them, never dropped.
      if (editing) leave();
      if (!stopReading) return;
      // A name still being looked up is still read for a save: its reader goes once it is found, or not.
      if (pending) void pending.done.then(stopReading, stopReading);
      else stopReading();
    },
  };
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

/** The words of a button that adds tags: the page's own, else "Add {label}", its label small where the page asks. */
const adderWords = (node: FieldNode, label: string, labels: WidgetLabels, form: Form, locale?: string) =>
  node.placeholder || fill(labels.addNamed, { label: labelAt(labels.addNamed, 'label', form.page.lowerLabels, locale)(label) });

/** A person's outline, as a work tracker draws one where no one is picked yet: a head over a bowl. */
const NOBODY = { nobody: '<circle cx="10.5" cy="5.9" r="3.3"/><path d="M3.75 12.75h13.5v1.5a6.75 6 0 0 1-13.5 0z"/>' };

/** Making a record from a typed name, unless the page turns it off or the data source cannot. */
function creator(form: Form, name: string, node: FieldNode): ((text: string) => Promise<RelatedRecord>) | undefined {
  return node.options?.['create'] !== false && form.canCreate(name) ? (text) => form.quickCreate(name, text) : undefined;
}

export const many2oneWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, dialogs, locale, loading }) => {
  const relation = field.type === 'many2one' ? field.relation : '';
  const own = shows(node);
  // No button to open it where the page says so, as Flectra's no_open.
  const canOpen = own.opens && !!dialogs && dialogs.canOpen(relation);
  let readonly = false;
  const box = combobox({
    document,
    id,
    loading,
    labels,
    // One past what the list shows, to know whether Search more… has more to find.
    search: (query) => form.search(name, query, SHOWN + 1),
    exact: (typed) => form.search(name, typed, EXACT, { exact: true }),
    // A link scanned into (`options.scan`) reads what is typed as the camera reads a code first — a scanner gun types
    // it — its record by its code; else, as ever, by its name.
    ...(scans(node) ? { code: (typed: string) => scanPart.loaded?.typedLink({ form, name, field, node }, typed) ?? Promise.resolve(null) } : {}),
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
  clear.setAttribute('aria-label', fill(labels.clear, { label: labelAt(labels.clear, 'label', form.page.lowerLabels, locale)(field.label) }));
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
    // Words typed in the plain box drawn before this one came: still the person's, found as they are typed on.
    takeTyped: (typed) => {
      if (box.input.readOnly) return false;
      typeInto(box.input, typed);
      return true;
    },
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

export const tagsWidget: WidgetFactory = ({ form, name, field, node, id, document, labels = WIDGET_LABELS.en, dialogs, locale, loading }) => {
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
    loading,
    labels,
    // One past what the list shows, besides those chosen, to know whether Search more… has more to find.
    search: (query) => form.search(name, query, SHOWN + 1 + current().length),
    exact: (typed) => form.search(name, typed, EXACT + current().length, { exact: true }),
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
  const adder = node.options?.['adder'] === 'button' ? tagAdder(document, adderWords(node, field.label, labels, form, locale), box, element) : null;
  element.append(chips, box.element, ...(adder ? [adder.button] : []));
  let readonly = false;
  let drawn = '';
  return {
    element,
    focus: () => box.input.focus(),
    // Words typed in the plain box drawn before this one came, a tag to add: still the person's, found as they are typed
    // on — in the box its button opens, where tags are added from a button.
    takeTyped: (typed) => {
      if (readonly) return false;
      adder?.button.click();
      typeInto(box.input, typed);
      return true;
    },
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
export const charTagsWidget: WidgetFactory = ({ form, name, field, node, id, document, labels, locale, loading }) => {
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
  /** Whether the record they were typed on is still shown: another shown, they are not its tags. */
  let waitingOn: () => boolean = () => false;
  const box = combobox({
    document,
    id,
    loading,
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
  // Enter with nothing chosen from the list adds what was typed; never sends the form. The Enter an IME takes its word
  // with is the IME's: the word is not made yet.
  box.input.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented || event.isComposing || event.keyCode === 229 || box.input.value.trim() === '') return;
    event.preventDefault();
    const left = addAll(pieces(box.input.value));
    keep(left);
    box.close();
    if (!left.length) adder?.added();
  });
  // A separator typed ends a tag; not one an IME is still composing.
  box.input.addEventListener('input', (event) => {
    if ((event as InputEvent).isComposing) return;
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
    waitingOn = waiting ? stillShown(form) : () => false;
    if (box.input.value !== waiting) keep(left);
    box.setText(waiting);
    form.setUnread(name, waiting ? { text: waiting, message: fill(words.tagsAtMost, { label, max: String(max), tags: waiting }) } : null);
  };
  /**
   * Tags waiting for room, read for a save, a check or a step forward as leaving reads them: taken now there is room
   * — a chip taken away, the field written another way — else still waiting, unread with why. Never dropped by a
   * save in silence while the box shows them.
   */
  const readWaiting = () => {
    if (!waiting || box.input.readOnly || document.activeElement === box.input) return;
    if (!waitingOn()) return forgetWaiting();
    box.input.value = waiting;
    commit();
  };
  /** Another record shown: the tags typed on the last one go from the box. */
  const forgetWaiting = () => {
    waiting = '';
    if (document.activeElement !== box.input) box.input.value = '';
    box.setText('');
  };
  const stopReading = typeof form.settling === 'function' ? form.settling(readWaiting) : null;
  // Typed and left without Enter, or taken by Ctrl+Enter's save (a change): kept. (Before the box itself hears it left.)
  box.input.addEventListener('change', commit);
  element.addEventListener('blur', (event) => event.target === box.input && commit(), true);
  // Added from a button, "Add Tag", that turns into the box and comes back once a tag is added.
  const adder = options['adder'] === 'button' ? tagAdder(document, adderWords(node, field.label, words, form, locale), box, element) : null;
  element.append(chips, box.element, ...(adder ? [adder.button] : []));
  let drawn = '';
  return {
    element,
    focus: () => box.input.focus(),
    destroy: () => {
      clearTimeout(marked);
      checks.destroy();
      stopReading?.();
    },
    update(state) {
      const tags = split(state.value);
      // The form let the tags waiting go with the record they were typed on: the box lets them go too.
      if (waiting && !form.getState().unread?.[name] && !waitingOn()) forgetWaiting();
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
  const { form, name, field, id, document, labels = WIDGET_LABELS.en, loading } = context;
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
    // A name typed, or still being looked up, was for the model before: its answer is let go with the value.
    box.drop();
    form.setValue(name, null);
  });
  /** Records found, each kept with the model it was found in: one found after the model changed is of no use. */
  const inModel = (asked: string, found: RelatedRecord[]) => (asked === model ? found : []);
  const box = combobox({
    document,
    id,
    loading,
    labels,
    placeholder: context.node.placeholder,
    search: (query) => {
      const asked = model;
      return asked ? form.search(name, query, SHOWN + 1, { model: asked }).then((found) => inModel(asked, found)) : Promise.resolve([]);
    },
    exact: (typed) => {
      const asked = model;
      return asked ? form.search(name, typed, EXACT, { model: asked, exact: true }).then((found) => inModel(asked, found)) : Promise.resolve([]);
    },
    shown: SHOWN,
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
