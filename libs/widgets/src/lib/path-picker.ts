import { foldDigits, foldForSearch, stripMarks, type JsonValue, type RelatedRecord } from '@fieldia/core';
import { floatUnder } from './float';
import { drawIcon } from './icons';
import { quoted, refusalHint } from './input-rules';
import { fillIn, maker, rightToLeft, setAttr, setHidden, typeInto, wordsFor } from './kind-parts';
import { scrollToRow } from './pick-list';
import { stillShown } from './shown';
import { installPathStyles } from './styles-path';
import type { PreferenceStore } from './preferences';
import type { Widget, WidgetFactory } from './widgets';

/**
 * A path picker (`"widget": "path"` on a many2one): a record of a tree — an
 * area, an iteration — shown as its path, "Portal\Sprint 14", as a work
 * tracker shows one. Its list, as wide as its box, holds:
 *
 * - "Suggestions": the value, and the person's latest picks of the model
 *   before it, kept in the viewer's preferences under `recent:<model>`
 *   (`fieldia:recent:<model>` in the browser's storage) — up to
 *   `options.suggestions`, 5 unless said, none at 0;
 * - the tree of every record (an empty search, up to 500), built from each
 *   one's `path` (RelatedRecord.path: its names from the top down), folded to
 *   the value's branch, unless `options.tree` is false;
 * - each row's `aside` (an iteration's dates) at its end.
 *
 * Typing shows the records whose path has the words typed, flat, each with
 * its whole path. `options.separator` joins a path's names: "\" unless said.
 *
 * A combobox (`aria-haspopup="tree"`) whose list is a tree, its suggestions a
 * group named by their heading. ↓ and ↑ move, → opens a branch or goes to its
 * first child, ← closes it or goes to its parent (the other way round right
 * to left), Home and End go to the first and the last, Enter picks, Escape
 * puts back what the box showed and closes, Tab leaves keeping the value — or
 * taking the match that typing reached. The focus stays in the box all along;
 * the row reached is its active one. Words typed and left — by Tab, Enter or
 * a click elsewhere, before or after their list came — take the record they
 * name exactly: its whole path, or its own name where only it has that name,
 * whatever row the list has reached. Words that name none, or several, stay
 * as typed, kept unread with why, and it says so: the field still holds what
 * it held, and a save is refused rather than made with it; Escape puts it
 * back. Enter on words that are no record's name takes the row reached;
 * Ctrl+Enter, a save, takes it only when the arrows reached it — else it
 * reads the words as leaving does, however soon it is pressed. A save, a
 * check or a step forward made while words are still typed, or still being
 * found, reads them as leaving would (`form.settling`) and a save waits for
 * them.
 *
 * Typed words find a path as a search finds words: in any case, Arabic
 * letters in any of their forms, digits in any script, and its separator
 * written "\", "/" or with spaces round it — "Portal / Sprint 13" finds
 * "Portal\Sprint 13".
 */

/** As many records as the tree is built from: a tree of more is searched, as typed. */
const TREE_LIMIT = 500;
/** As many latest picks as are kept for a model. */
const KEPT = 10;
const DEBOUNCE_MS = 180;
/** As many records a search for a typed name is asked for, where the tree is too big to hold. */
const FOUND = 50;

/** Where the person's latest picks of a model are kept in the viewer's preferences. */
export const recentPicksKey = (model: string): string => `recent:${model}`;

interface Branch {
  key: string;
  name: string;
  record: RelatedRecord | null;
  depth: number;
  parent: Branch | null;
  children: Branch[];
}

interface Row {
  id: string;
  /** Who it is, whatever its place: a suggestion, a branch of the tree, a match, by its record or its path. */
  key: string;
  /** The record it picks; none for a branch the tree names but has no record of. */
  record: RelatedRecord | null;
  branch?: Branch;
  element: HTMLElement;
}

const names = (record: RelatedRecord): string[] => (record.path?.length ? record.path : [record.label]);
const keyOf = (path: readonly string[]) => path.join('\u0001');
/** Words as a path is found by them: folded, and a separator — the picker's, "\\" or "/", spaces round it or not — as one. */
const findable = (text: string, separator: string) => foldForSearch(text.split(separator).join('\\')).replace(/\s*[\\/]\s*/g, '\u0001');

export const pathPickerWidget: WidgetFactory = ({ form, name, field, node, id, document: doc, labels, locale, preferences }) => {
  installPathStyles(doc);
  const words = wordsFor(labels, locale);
  const make = maker(doc);
  const relation = field.type === 'many2one' ? field.relation : '';
  const options = node.options ?? {};
  const separator = typeof options['separator'] === 'string' && options['separator'] ? options['separator'] : '\\';
  const suggesting = typeof options['suggestions'] === 'number' ? Math.max(0, Math.trunc(options['suggestions'])) : 5;
  const withTree = options['tree'] !== false;
  const textOf = (record: RelatedRecord | null | undefined) => (record ? names(record).join(separator) : '');

  const treeId = `${id}-tree`;
  const headingId = `${id}-suggestions`;
  const input = make('input', { id, class: 'fd-input fd-combo-input fd-path-input', autocomplete: 'off', role: 'combobox', 'aria-autocomplete': 'list', 'aria-haspopup': 'tree', 'aria-expanded': 'false', 'aria-controls': treeId });
  if (node.placeholder) input.placeholder = node.placeholder;
  const chevron = make('span', { class: 'fd-path-chevron', 'aria-hidden': 'true' });
  const down = drawIcon(doc, 'chevron-down');
  if (down) chevron.append(down);
  const tree = make('div', { id: treeId, role: 'tree', class: 'fd-path-tree', 'aria-label': field.label });
  const empty = make('div', { class: 'fd-empty fd-path-empty', role: 'status' });
  const callout = make('div', { class: 'fd-path-callout', hidden: '' }, tree, empty);
  const element = make('div', { class: 'fd-combo fd-path' }, input, chevron, callout);
  const floating = floatUnder(input, callout, { sameWidth: true, maxHeight: 278, gap: 0 });
  // Words left that name no record: put back, and said under the box.
  const hint = refusalHint(input, element);

  let current: RelatedRecord | null = null;
  let readonly = false;
  /** The person's own words in the box, not yet a pick. */
  let editing = false;
  let records: RelatedRecord[] | null = null;
  let loading: Promise<void> | null = null;
  let roots: Branch[] = [];
  const byKey = new Map<string, Branch>();
  const byId = new Map<string, Branch>();
  const unfolded = new Set<string>();
  let rows: Row[] = [];
  let active = -1;
  /** Whether the person has moved with the keys from the row reached as the list opened, or as the words were last typed. */
  let moved = false;
  /** The records the words typed found: null while nothing is typed. */
  let matches: RelatedRecord[] | null = null;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Words left typed in the box: one of every leaving, the latest, is acted on. */
  let typedSeq = 0;
  /** Words being found now, and whether a save waits for them. */
  let pending: { text: string; awaited: boolean; done: Promise<void> } | null = null;
  const unreadNow = () => form.getState().unread?.[name];
  const letGo = () => unreadNow() && form.setUnread(name, null);

  // ---- the person's latest picks --------------------------------------------
  const store: PreferenceStore | undefined = preferences;
  function recent(): RelatedRecord[] {
    const kept = store?.get(recentPicksKey(relation));
    if (!Array.isArray(kept)) return [];
    return kept
      .map((item): RelatedRecord | null => {
        // A pick kept as its id, or as the record it was; the tree's own, when it has it, is the newer.
        const known = byId.get(String(item && typeof item === 'object' && !Array.isArray(item) ? item['id'] : item))?.record;
        if (known) return known;
        if (item && typeof item === 'object' && !Array.isArray(item) && (typeof item['id'] === 'number' || typeof item['id'] === 'string') && typeof item['label'] === 'string') {
          const path = Array.isArray(item['path']) ? item['path'].filter((n): n is string => typeof n === 'string') : undefined;
          return { id: item['id'], label: item['label'], ...(path?.length ? { path } : {}), ...(typeof item['aside'] === 'string' ? { aside: item['aside'] } : {}) };
        }
        return null;
      })
      // One the whole tree no longer holds is gone; a tree too big to hold whole may simply not show it.
      .filter((record): record is RelatedRecord => record !== null && (!records || records.length >= TREE_LIMIT || byId.has(String(record.id))));
  }
  function remember(record: RelatedRecord) {
    if (!store || !relation) return;
    const kept = [record, ...recent().filter((r) => r.id !== record.id)].slice(0, KEPT);
    store.set(
      recentPicksKey(relation),
      kept.map((r) => ({ id: r.id, label: r.label, ...(r.path ? { path: r.path } : {}), ...(r.aside ? { aside: r.aside } : {}) })) as unknown as JsonValue
    );
  }
  /** The value and the latest picks: in the order picked when the value is among the first of them, else the value first. */
  function suggestions(): RelatedRecord[] {
    if (!suggesting) return [];
    const latest = recent();
    const first = latest.slice(0, suggesting);
    if (!current || first.some((r) => r.id === current?.id)) return first;
    return [current, ...latest.filter((r) => r.id !== current?.id)].slice(0, suggesting);
  }

  // ---- the tree -------------------------------------------------------------
  function build(found: RelatedRecord[]) {
    records = found;
    roots = [];
    byKey.clear();
    byId.clear();
    for (const record of found) {
      const path = names(record);
      let parent: Branch | null = null;
      path.forEach((part, depth) => {
        const key = keyOf(path.slice(0, depth + 1));
        let branch = byKey.get(key);
        if (!branch) {
          branch = { key, name: part, record: null, depth, parent, children: [] };
          byKey.set(key, branch);
          (parent ? parent.children : roots).push(branch);
        }
        parent = branch;
      });
      const own = byKey.get(keyOf(path));
      if (own && !own.record) {
        own.record = record;
        byId.set(String(record.id), own);
      }
    }
  }
  function load(): Promise<void> {
    if (!withTree) return Promise.resolve();
    loading ??= form.search(name, '', TREE_LIMIT).then(
      (found) => {
        build(found);
        foldTo(current);
      },
      () => {
        loading = null; // asked again the next time it opens
      }
    );
    return loading;
  }
  /** Folded to the value's branch: every branch above it open. */
  function foldTo(record: RelatedRecord | null) {
    let branch = record ? (byId.get(String(record.id)) ?? byKey.get(keyOf(names(record)))) : undefined;
    for (branch = branch?.parent ?? undefined; branch; branch = branch.parent ?? undefined) unfolded.add(branch.key);
  }

  // ---- drawing --------------------------------------------------------------
  function row(rowId: string, key: string, record: RelatedRecord | null, text: string, level: number, extra: { branch?: Branch; set?: number; at?: number; aside?: string } = {}): Row {
    const nameCell = make('span', { class: 'fd-path-name' });
    const branch = extra.branch;
    if (branch?.children.length) {
      const open = unfolded.has(branch.key);
      const twist = make('button', { type: 'button', class: 'fd-path-twist', tabindex: '-1', 'aria-label': fillIn(open ? words.collapseNamed : words.expandNamed, { name: branch.name }), title: fillIn(open ? words.collapseNamed : words.expandNamed, { name: branch.name }) });
      const icon = drawIcon(doc, open ? 'chevron-down' : 'chevron-right');
      if (icon) twist.append(icon);
      twist.addEventListener('click', (event) => {
        event.stopPropagation();
        toggle(branch, !open);
      });
      nameCell.append(twist);
    }
    nameCell.append(make('span', { class: 'fd-path-words' }, text));
    const element = make('div', { id: rowId, role: 'treeitem', class: 'fd-path-row', 'aria-selected': 'false', 'aria-level': String(level) }, nameCell);
    // Its depth through its style object, never a style attribute: a strict Content-Security-Policy lets one be.
    element.style.setProperty('--fd-depth', String(level - 1));
    if (extra.set) {
      element.setAttribute('aria-setsize', String(extra.set));
      element.setAttribute('aria-posinset', String(extra.at));
    }
    if (branch?.children.length) element.setAttribute('aria-expanded', String(unfolded.has(branch.key)));
    const aside = extra.aside ?? record?.aside;
    if (aside) element.append(make('span', { class: 'fd-path-aside' }, make('span', {}, aside)));
    if (!record) element.setAttribute('data-branch-only', '');
    const made: Row = { id: rowId, key, record, element, ...(branch ? { branch } : {}) };
    element.addEventListener('click', () => choose(made));
    return made;
  }

  function draw(keep?: string) {
    const was = keep ?? (moved ? rows[active]?.key : undefined);
    rows = [];
    tree.replaceChildren();
    if (matches) {
      matches.forEach((record, i) => rows.push(row(`${id}-m-${i}`, `m:${record.id}`, record, textOf(record), 1, { set: matches?.length, at: i + 1 })));
      tree.append(...rows.map((r) => r.element));
    } else {
      const suggested = suggestions();
      if (suggested.length) {
        const group = make('div', { role: 'group', class: 'fd-path-group', 'aria-labelledby': headingId }, make('div', { id: headingId, class: 'fd-path-heading' }, words.suggestions));
        suggested.forEach((record, i) => {
          const made = row(`${id}-s-${i}`, `s:${record.id}`, record, textOf(record), 1, { set: suggested.length, at: i + 1 });
          rows.push(made);
          group.append(made.element);
        });
        tree.append(group);
      }
      if (records && roots.length) {
        if (suggested.length) tree.append(make('div', { class: 'fd-path-divider', 'aria-hidden': 'true' }));
        const walk = (branches: Branch[]) =>
          branches.forEach((branch, i) => {
            const made = row(`${id}-t-${byKeyIndex(branch)}`, `t:${branch.key}`, branch.record, branch.name, branch.depth + 1, { branch, set: branches.length, at: i + 1 });
            rows.push(made);
            tree.append(made.element);
            if (branch.children.length && unfolded.has(branch.key)) walk(branch.children);
          });
        walk(roots);
      }
    }
    const nothing = !rows.length;
    setHidden(tree, nothing);
    setHidden(empty, !nothing || (!matches && !records && !!loading));
    empty.textContent = nothing ? words.noResults : '';
    // The row reached before stays reached; else the value's, else the first.
    let at = was === undefined ? -1 : rows.findIndex((r) => r.key === was);
    if (at < 0 && current) at = rows.findIndex((r) => r.record?.id === current?.id);
    reach(at < 0 ? (rows.length ? 0 : -1) : at);
    floating.place();
  }
  const keys = new Map<string, number>();
  const byKeyIndex = (branch: Branch) => {
    if (!keys.has(branch.key)) keys.set(branch.key, keys.size);
    return keys.get(branch.key);
  };

  function reach(at: number) {
    active = at;
    rows.forEach((r, i) => {
      setAttr(r.element, 'aria-selected', String(i === at));
      setAttr(r.element, 'data-active', i === at ? '' : null);
    });
    if (at >= 0 && rows[at]) {
      input.setAttribute('aria-activedescendant', rows[at].id);
      scrollToRow(callout, rows[at].element);
    } else input.removeAttribute('aria-activedescendant');
  }

  // ---- opening, picking, closing ---------------------------------------------
  function open() {
    if (readonly || !callout.hidden) return;
    matches = null;
    moved = false;
    // Folded again to the value's branch, as each opening starts.
    unfolded.clear();
    foldTo(current);
    floating.show();
    input.setAttribute('aria-expanded', 'true');
    draw();
    // The tree arrives: drawn again, the row reached kept.
    if (withTree && !records) void load().then(() => !callout.hidden && !matches && draw());
  }
  function close() {
    clearTimeout(timer);
    seq++;
    floating.hide();
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
    matches = null;
  }
  function restore() {
    editing = false;
    input.value = textOf(current);
  }
  function choose(made: Row) {
    if (!made.record) {
      if (made.branch) toggle(made.branch, !unfolded.has(made.branch.key));
      return;
    }
    pick(made.record);
  }
  /** The record words typed are the very name of, among those here now (the tree, or their matches): none when it would take a wait. */
  function exactly(text: string): RelatedRecord | null {
    const known = records && records.length < TREE_LIMIT ? records : matches;
    const found = known ? named(text, known) : null;
    if (!found || found === 'several') return null;
    typedSeq++;
    pending = null;
    return found;
  }
  /** A record taken: the box shows its path, words kept unread go, and it is among the latest picks. */
  function pick(record: RelatedRecord) {
    close();
    remember(record);
    editing = false;
    hint.hide();
    letGo();
    form.setValue(name, record);
    input.value = textOf(record);
  }
  function toggle(branch: Branch, on: boolean) {
    if (on) unfolded.add(branch.key);
    else unfolded.delete(branch.key);
    draw(`t:${branch.key}`);
  }

  /** The records whose path has the words typed: the tree's own, or the data source's for a tree too big to hold. */
  function lookUp(query: string) {
    clearTimeout(timer);
    const mine = ++seq;
    const wanted = findable(query.trim(), separator);
    const show = (found: RelatedRecord[]) => {
      if (mine !== seq || doc.activeElement !== input) return;
      matches = wanted ? found : null;
      if (callout.hidden) {
        floating.show();
        input.setAttribute('aria-expanded', 'true');
      }
      draw(rows[active]?.key);
      if (wanted) reach(rows.length ? 0 : -1);
    };
    if (!wanted) return show([]);
    timer = setTimeout(async () => {
      if (withTree) await load();
      const all = records && records.length < TREE_LIMIT ? records : null;
      const found = all
        ? all.filter((record) => findable(textOf(record), separator).includes(wanted) || findable(record.label, separator).includes(wanted))
        : await form.search(name, foldDigits(stripMarks(query.trim())), FOUND).catch(() => [] as RelatedRecord[]);
      show(found);
    }, records ? 0 : DEBOUNCE_MS);
  }

  /** The record words name exactly: the one whose whole path they are, else the one whose own name they are; 'several' when more than one has that name. */
  function named(text: string, found: readonly RelatedRecord[]): RelatedRecord | 'several' | null {
    const wanted = findable(text.trim(), separator);
    if (!wanted) return null;
    const one = (list: RelatedRecord[]) => [...new Map(list.map((r) => [String(r.id), r])).values()];
    const byPath = one(found.filter((record) => findable(textOf(record), separator) === wanted));
    if (byPath.length) return byPath.length === 1 ? byPath[0] : 'several';
    const byName = one(found.filter((record) => findable(record.label, separator) === wanted));
    return byName.length === 1 ? byName[0] : byName.length ? 'several' : null;
  }
  /**
   * The records words typed may name: the tree's own, when it holds them all; else the data source's for their last
   * name — "Portal\\Sprint 13" asks for "Sprint 13" — as a search finds them, and, where that search filled its
   * limit, the records of that very name asked for exactly. Without a wait when the tree is here.
   */
  function candidates(text: string, then: (found: readonly RelatedRecord[]) => void): void {
    const whole = () => (records && records.length < TREE_LIMIT ? records : null);
    const here = whole();
    if (here) return then(here);
    const last = foldDigits(stripMarks(text.trim().split(separator).join('\\').split(/\s*[\\/]\s*/).pop() ?? ''));
    const searched = async (): Promise<readonly RelatedRecord[]> => {
      const found = await form.search(name, last, FOUND);
      if (found.length < FOUND) return found;
      const exact = await form.search(name, last, FOUND, { exact: true }).catch(() => []);
      return [...found, ...exact];
    };
    void (withTree ? load() : Promise.resolve())
      .then(() => whole() ?? searched())
      .catch(() => [] as RelatedRecord[])
      .then(then);
  }
  /**
   * Words typed that are no pick yet, taken now: the record they name exactly; else it says why — and, left
   * (`leaving`) or a save waiting for them (`awaited`), they stay, kept unread with why, the field holding what it held.
   */
  function settleTyped(text: string, leaving: boolean, awaited = false): Promise<void> {
    const mine = ++typedSeq;
    let finish: () => void = () => undefined;
    const reading = { text, awaited, done: new Promise<void>((resolve) => (finish = resolve)) };
    pending = reading;
    // Typed on the record shown now: found once another is shown, nothing is taken, and the box shows what that one holds.
    const asked = stillShown(form);
    candidates(text, (found) => {
      if (pending === reading) pending = null;
      const after = act(found);
      if (after) void after.then(finish, finish);
      else finish();
    });
    return reading.done;

    function act(found: readonly RelatedRecord[]): Promise<void> | void {
      if (!asked()) {
        if (!editing && input.value.trim() === text.trim()) restore();
        return;
      }
      // Typed in again, or another leaving since: that one acts — and a save waiting for these reads the box again.
      if (mine !== typedSeq) return reading.awaited ? readNow() : undefined;
      // Back in the box before they were found: the words are still the person's, and the next leaving acts on them.
      if (leaving && doc.activeElement === input && !reading.awaited) return;
      const record = named(text, found);
      if (record && record !== 'several') return pick(record);
      const label = node.label ?? field.label;
      const said = fillIn(record === 'several' ? words.severalCalled : words.noMatch, { label, text: quoted(text) });
      if (reading.awaited || leaving) {
        // Left, or a save waits: the words stay as typed, marked, kept unread with why — a save refused over them, never
        // made with what the box held, which it still holds. Escape puts that back.
        if (input.value.trim() !== text) input.value = text;
        editing = false;
        hint.show(current && !reading.awaited ? `${said}. ${fillIn(words.stillHolds, { label, value: textOf(current) })}` : said);
        form.setUnread(name, { text, message: said });
      } else hint.show(said);
    }
  }

  /**
   * The words typed, read for a save, a check or a step forward, as if the box were left: the record they name
   * exactly taken (at once when the tree is here), else kept unread with why — a save waiting while they are found.
   */
  function readNow(): Promise<void> | undefined {
    if (readonly) return undefined;
    const typing = doc.activeElement === input && editing;
    const text = typing ? input.value.trim() : (pending?.text ?? null);
    if (text === null) return undefined;
    if (typing && text === '') {
      // Emptied, and saved so: no value, as leaving it would make it.
      editing = false;
      letGo();
      if (current !== null) form.setValue(name, null);
      return undefined;
    }
    if (typing && text === textOf(current)) return void letGo();
    const label = node.label ?? field.label;
    form.setUnread(name, { text, message: fillIn(words.lookingUp, { label, text: quoted(text) }) });
    if (pending && pending.text === text) {
      pending.awaited = true;
      return pending.done;
    }
    return settleTyped(text, false, true);
  }
  // Still typed in: autosave, which nobody pressed, waits until the box is left, never reading the words under the keys.
  const stopReading = typeof form.settling === 'function' ? form.settling(readNow, () => doc.activeElement === input && editing) : null;

  const forward = () => (getComputedStyle(element).direction === 'rtl' || rightToLeft(element) ? 'ArrowLeft' : 'ArrowRight');
  input.addEventListener('input', () => {
    hint.hide();
    if (readonly) return;
    editing = true;
    typedSeq++;
    // Typed: the row reached is the list's, until the arrows move again.
    moved = false;
    lookUp(input.value);
  });
  input.addEventListener('click', () => {
    if (callout.hidden) open();
  });
  chevron.addEventListener('mousedown', (event) => event.preventDefault());
  chevron.addEventListener('click', () => {
    if (readonly) return;
    input.focus();
    if (callout.hidden) open();
    else close();
  });
  // The list never takes the focus from the box: a press on a row or its scroll bar keeps it there.
  callout.addEventListener('mousedown', (event) => event.preventDefault());
  input.addEventListener('keydown', (event) => {
    // A key an IME is composing with — the Enter that takes its word, the arrows through its candidates — is the IME's.
    if (readonly || event.isComposing || event.keyCode === 229) return;
    const shown = !callout.hidden;
    if (!shown) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'F4') {
        event.preventDefault();
        open();
      }
      return;
    }
    const here = rows[active];
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        event.preventDefault();
        if (event.altKey && event.key === 'ArrowUp') return void (close(), restore());
        moved = true;
        reach(Math.max(0, Math.min(rows.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))));
        return;
      case 'Home':
      case 'End':
        if (!rows.length) return;
        event.preventDefault();
        moved = true;
        reach(event.key === 'Home' ? 0 : rows.length - 1);
        return;
      case 'PageDown':
      case 'PageUp':
        event.preventDefault();
        moved = true;
        reach(Math.max(0, Math.min(rows.length - 1, active + (event.key === 'PageDown' ? 8 : -8))));
        return;
      case 'ArrowLeft':
      case 'ArrowRight': {
        // On the tree's rows the arrows walk the tree; on a suggestion or a match they move in the words typed.
        const branch = here?.branch;
        if (!branch || matches) return;
        event.preventDefault();
        moved = true;
        const opening = event.key === forward();
        if (opening) {
          if (!branch.children.length) return;
          if (!unfolded.has(branch.key)) return toggle(branch, true);
          const child = rows.findIndex((r) => r.branch === branch.children[0]);
          if (child >= 0) reach(child);
        } else if (branch.children.length && unfolded.has(branch.key)) toggle(branch, false);
        else if (branch.parent) {
          const parent = rows.findIndex((r) => r.branch === branch.parent);
          if (parent >= 0) reach(parent);
        }
        return;
      }
      case 'Enter': {
        event.preventDefault();
        const text = input.value.trim();
        if (editing && text) {
          // Words that are a record's very name — its path, or a name only it has — take it, whatever row is reached.
          const exact = exactly(text);
          if (exact) return pick(exact);
          // Words whose list has not come yet, or found nothing — or Ctrl+Enter's save on a row the person did not
          // reach: the record they name, or why there is none, the same however soon it is pressed.
          if (!matches?.length || ((event.ctrlKey || event.metaKey) && !moved)) {
            void settleTyped(text, false);
            return;
          }
        }
        if (here) choose(here);
        return;
      }
      case 'Escape':
        event.preventDefault();
        // Only the list closes: not a dialog the field is in.
        event.stopPropagation();
        close();
        typedSeq++;
        pending = null;
        restore();
        letGo();
        return;
      case 'Tab': {
        // Words that are a record's very name take it; else the match reached goes with the person; else, left, the
        // box reads the words.
        const exact = editing && input.value.trim() ? exactly(input.value.trim()) : null;
        if (exact) return pick(exact);
        if (matches && here?.record) return choose(here);
        close();
        return;
      }
    }
  });
  /** The box left — its blur, or the box taken away with the person's words in it (`destroy`). */
  function leave() {
    close();
    const text = input.value.trim();
    // Emptied and left: no value. Words left: the record they name exactly is taken (the box keeps them until it is
    // found); else they stay, unread with why, and it says so.
    const emptied = editing && text === '' && current !== null;
    const unmatched = editing && text !== '' && text !== textOf(current);
    if (!unmatched) editing = false;
    if (emptied) {
      letGo();
      return form.setValue(name, null);
    }
    if (!unmatched) {
      // Words kept unread, not typed in since (left twice: taken away, then blurred): they stay.
      if (unreadNow() && input.value.trim() === unreadNow()?.text.trim()) return;
      letGo();
      return restore();
    }
    // Still the person's words while they are looked up: nothing redrawn puts the old value over them.
    if (pending?.text !== text) void settleTyped(text, true);
  }
  input.addEventListener('blur', leave);
  // Come back to words the form keeps unread: they are still the person's own, and leaving reads them again.
  input.addEventListener('focus', () => {
    const kept = unreadNow();
    if (kept && input.value === kept.text) editing = true;
  });

  return {
    element,
    focus: () => input.focus(),
    // Words typed in the plain box before this one came: still the person's, found as they are typed on.
    takeTyped: (typed) => {
      typeInto(input, typed);
      return true;
    },
    destroy: () => {
      // Taken away with the person's words in it — a cell's editor closed, which a browser may do without a blur:
      // read as leaving reads them, never dropped.
      if (editing) leave();
      close();
      // Words still being found are still read for a save: its reader goes once they are.
      if (pending) void pending.done.then(() => stopReading?.());
      else stopReading?.();
    },
    update(state) {
      const value = (state.value as RelatedRecord | null | undefined) ?? null;
      const changed = value?.id !== current?.id;
      current = value;
      if (changed && records) foldTo(current);
      readonly = state.readonly;
      if (input.readOnly !== readonly) input.readOnly = readonly;
      if (readonly) close();
      // Words a save kept unread stay as typed, marked; else the value's path.
      const kept = unreadNow();
      if (!editing && !pending && input.value !== (kept ? kept.text : textOf(current))) input.value = kept ? kept.text : textOf(current);
      setAttr(input, 'aria-invalid', String(state.invalid || (!!kept && doc.activeElement !== input)));
      setAttr(input, 'aria-required', String(state.required));
      setAttr(input, 'aria-describedby', hint.describedBy(state.describedBy) ?? null);
    },
  } satisfies Widget;
};
