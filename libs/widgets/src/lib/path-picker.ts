import type { JsonValue, RelatedRecord } from '@fieldia/core';
import { floatUnder } from './float';
import { drawIcon } from './icons';
import { fillIn, maker, rightToLeft, setAttr, setHidden, wordsFor } from './kind-parts';
import { scrollToRow } from './pick-list';
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
 * puts back what the box showed and closes, Tab leaves keeping the value.
 * The focus stays in the box all along; the row reached is its active one.
 */

/** As many records as the tree is built from: a tree of more is searched, as typed. */
const TREE_LIMIT = 500;
/** As many latest picks as are kept for a model. */
const KEPT = 10;
const DEBOUNCE_MS = 180;

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
  /** Whether the person has moved from the row reached as the list opened. */
  let moved = false;
  /** The records the words typed found: null while nothing is typed. */
  let matches: RelatedRecord[] | null = null;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;

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
    const element = make('div', { id: rowId, role: 'treeitem', class: 'fd-path-row', 'aria-selected': 'false', 'aria-level': String(level), style: `--fd-depth: ${level - 1}` }, nameCell);
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
    const record = made.record;
    close();
    remember(record);
    editing = false;
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
    const wanted = query.trim().toLocaleLowerCase();
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
        ? all.filter((record) => textOf(record).toLocaleLowerCase().includes(wanted) || record.label.toLocaleLowerCase().includes(wanted))
        : await form.search(name, query.trim(), 50).catch(() => [] as RelatedRecord[]);
      show(found);
    }, records ? 0 : DEBOUNCE_MS);
  }

  const forward = () => (getComputedStyle(element).direction === 'rtl' || rightToLeft(element) ? 'ArrowLeft' : 'ArrowRight');
  input.addEventListener('input', () => {
    if (readonly) return;
    editing = true;
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
    if (readonly) return;
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
      case 'Enter':
        event.preventDefault();
        if (here) choose(here);
        return;
      case 'Escape':
        event.preventDefault();
        // Only the list closes: not a dialog the field is in.
        event.stopPropagation();
        close();
        restore();
        return;
      case 'Tab':
        close();
        restore();
        return;
    }
  });
  input.addEventListener('blur', () => {
    close();
    // Emptied and left: no value.
    const emptied = editing && input.value.trim() === '' && current !== null;
    editing = false;
    if (emptied) form.setValue(name, null);
    else restore();
  });

  return {
    element,
    focus: () => input.focus(),
    destroy: () => close(),
    update(state) {
      const value = (state.value as RelatedRecord | null | undefined) ?? null;
      const changed = value?.id !== current?.id;
      current = value;
      if (changed && records) foldTo(current);
      readonly = state.readonly;
      if (input.readOnly !== readonly) input.readOnly = readonly;
      if (readonly) close();
      if (!editing && input.value !== textOf(current)) input.value = textOf(current);
      setAttr(input, 'aria-invalid', String(state.invalid));
      setAttr(input, 'aria-required', String(state.required));
      setAttr(input, 'aria-describedby', state.describedBy || null);
    },
  } satisfies Widget;
};
