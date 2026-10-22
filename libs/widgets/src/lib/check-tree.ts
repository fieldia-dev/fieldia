import { foldDigits, foldForSearch, stripMarks, type RecordId, type RelatedRecord } from '@fieldia/core';
import { drawIcon } from './icons';
import { fillIn, maker, rightToLeft, setAttr, setHidden, setText, wordsFor } from './kind-parts';
import { inPlural } from './labels';
import { installPathStyles } from './styles-path';
import type { WidgetFactory } from './widgets';

/**
 * A checkbox tree (`"widget": "tree"` on a many2many): several records of a tree picked at once — areas, specialties,
 * permissions — each a row with a box to tick, a branch's box ticked when all under it are, part-ticked when some are,
 * and ticking it ticks all under it. Its records are the link's, each placed by its `path` (RelatedRecord.path: its
 * names from the top down), as a path picker's are: the first 500 the source finds, and those a search finds beyond them.
 *
 * What the field keeps (`options.keeps`): every record ticked ("all", the default: a branch's own record too once all
 * under it are); a whole branch as its own record alone ("top": all of Nasr City kept as Nasr City); or the records with
 * none under them alone ("leaves"). A record the value holds that the tree does not show is kept as it is.
 *
 * The ARIA tree, several picked: ↓ and ↑ move, → opens a branch or goes to its first child, ← closes it or goes to its
 * parent (the other way round right to left), Home and End go to the first and the last, Space ticks or unticks, typing
 * a row's first letters goes to it. A search over the tree (`options.search`, shown unless false) keeps the rows whose
 * names have the words typed, with the branches they are in, open; ↓ goes from it into the tree. How many are chosen
 * is said under it. In the path part, with the path picker.
 */

/** As many records as the tree is built from: past them, a search asks the source for more. */
const TREE_LIMIT = 500;
const FOUND = 50;
const DEBOUNCE_MS = 180;

interface Branch {
  key: string;
  name: string;
  record: RelatedRecord | null;
  parent: Branch | null;
  children: Branch[];
  depth: number;
}

type Keeps = 'all' | 'top' | 'leaves';
const names = (record: RelatedRecord): string[] => (record.path?.length ? record.path : [record.label]);
const keyOf = (path: readonly string[]) => path.join('\u0001');

export const checkTreeWidget: WidgetFactory = ({ form, name, field, node, id, document: doc, labels, locale }) => {
  installPathStyles(doc);
  const words = wordsFor(labels, locale);
  const make = maker(doc);
  const options = node.options ?? {};
  const keeps: Keeps = options['keeps'] === 'top' || options['keeps'] === 'leaves' ? options['keeps'] : 'all';
  const label = node.label ?? field.label;

  const searching = options['search'] !== false;
  // The field's label points at its search, where it has one: a press on the label goes there.
  const search = make('input', { type: 'search', ...(searching ? { id } : {}), class: 'fd-input fd-tree-search', autocomplete: 'off', 'aria-label': fillIn(words.treeSearch, { label }), 'aria-controls': `${id}-tree`, placeholder: words.search });
  const tree = make('div', { id: `${id}-tree`, role: 'tree', class: 'fd-check-tree', 'aria-multiselectable': 'true', 'aria-labelledby': `${id}-label` });
  const empty = make('div', { class: 'fd-empty fd-tree-empty', role: 'status', hidden: '' });
  const count = make('div', { id: `${id}-count`, class: 'fd-tree-count', role: 'status' });
  const element = make('div', { class: 'fd-tree-box' }, ...(searching ? [search] : []), tree, empty, count);

  let records: RelatedRecord[] = [];
  let roots: Branch[] = [];
  const byKey = new Map<string, Branch>();
  const byId = new Map<RecordId, Branch>();
  const open = new Set<string>();
  /** The rows ticked that have none under them: what every box's state is worked out from. */
  const ticked = new Set<string>();
  /** Records the value holds that the tree does not show: kept as they are. */
  let outside: RelatedRecord[] = [];
  let readonly = false;
  let active: string | null = null;
  let filter = '';
  let loaded = false;
  let seq = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** The value and the look drawn last: a form's every change redraws the tree only where they changed. */
  let drawnFor = '';

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
          branch = { key, name: part, record: null, parent, children: [], depth };
          byKey.set(key, branch);
          (parent ? parent.children : roots).push(branch);
        }
        parent = branch;
      });
      const own = byKey.get(keyOf(path));
      if (own && !own.record) {
        own.record = record;
        byId.set(record.id, own);
      }
    }
  }
  const leavesOf = (branch: Branch): Branch[] => (branch.children.length ? branch.children.flatMap(leavesOf) : [branch]);
  const stateOf = (branch: Branch): 'true' | 'false' | 'mixed' => {
    const leaves = leavesOf(branch);
    const on = leaves.filter((leaf) => ticked.has(leaf.key)).length;
    return on === 0 ? 'false' : on === leaves.length ? 'true' : 'mixed';
  };

  /** The value read into the boxes: each record held ticks its row, and all under it. */
  function readValue(value: unknown) {
    ticked.clear();
    outside = [];
    for (const record of Array.isArray(value) ? (value as RelatedRecord[]) : []) {
      const branch = byId.get(record.id);
      if (!branch) outside.push(record);
      else for (const leaf of leavesOf(branch)) ticked.add(leaf.key);
    }
  }
  /** The boxes written into the value, as the field keeps them, in the tree's order; those it does not show kept. */
  function writeValue() {
    const kept: RelatedRecord[] = [];
    const walk = (branches: Branch[]) => {
      for (const branch of branches) {
        const state = stateOf(branch);
        if (state === 'false') continue;
        const leaf = !branch.children.length;
        if (keeps === 'top' && state === 'true' && branch.record) {
          kept.push(branch.record);
          continue;
        }
        if (branch.record && (leaf || (keeps === 'all' && state === 'true'))) kept.push(branch.record);
        walk(branch.children);
      }
    };
    walk(roots);
    form.setValue(name, [...kept, ...outside]);
  }
  function toggle(branch: Branch) {
    if (readonly) return;
    const on = stateOf(branch) !== 'true';
    for (const leaf of leavesOf(branch)) {
      if (on) ticked.add(leaf.key);
      else ticked.delete(leaf.key);
    }
    writeValue();
  }

  /** The rows shown: the tree as it is opened, or, while words are typed, the rows they find and the branches they are in. */
  function shown(): Branch[] {
    const rows: Branch[] = [];
    const wanted = filter ? foldForSearch(foldDigits(stripMarks(filter))).trim() : '';
    const matches = (branch: Branch): boolean => foldForSearch(branch.name).includes(wanted) || branch.children.some(matches);
    const walk = (branches: Branch[]) => {
      for (const branch of branches) {
        if (wanted && !matches(branch)) continue;
        rows.push(branch);
        if (branch.children.length && (wanted || open.has(branch.key))) walk(branch.children);
      }
    };
    walk(roots);
    return rows;
  }

  function draw(focus = false) {
    const rows = shown();
    if (active === null || !rows.some((row) => row.key === active)) active = rows[0]?.key ?? null;
    tree.replaceChildren(
      ...rows.map((branch) => {
        const siblings = branch.parent ? branch.parent.children : roots;
        const state = stateOf(branch);
        const item = make('div', {
          role: 'treeitem',
          id: `${id}-row-${[...byKey.keys()].indexOf(branch.key)}`,
          class: 'fd-tree-row',
          'aria-level': String(branch.depth + 1),
          'aria-setsize': String(siblings.length),
          'aria-posinset': String(siblings.indexOf(branch) + 1),
          'aria-checked': state,
          tabindex: branch.key === active ? '0' : '-1',
          style: `--fd-depth: ${branch.depth}`,
          ...(branch.children.length ? { 'aria-expanded': String(!!filter || open.has(branch.key)) } : {}),
          ...(readonly ? { 'aria-disabled': 'true' } : {}),
        });
        const twist = make('span', { class: 'fd-tree-twist', 'aria-hidden': 'true' });
        if (branch.children.length) {
          const icon = drawIcon(doc, filter || open.has(branch.key) ? 'chevron-down' : 'chevron-right');
          if (icon) twist.append(icon);
          twist.addEventListener('click', (event) => {
            event.stopPropagation();
            fold(branch, !open.has(branch.key));
          });
        }
        // Its box: a tick when all under it are ticked, a dash when some are (drawn by the sheet).
        const box = make('span', { class: 'fd-tree-check', 'aria-hidden': 'true' });
        const tick = state === 'true' ? drawIcon(doc, 'check') : null;
        if (tick) box.append(tick);
        item.append(twist, box, make('span', { class: 'fd-tree-name' }, branch.name), ...(branch.record?.aside ? [make('span', { class: 'fd-tree-aside' }, branch.record.aside)] : []));
        item.addEventListener('click', () => {
          active = branch.key;
          toggle(branch);
          draw(true);
        });
        item.addEventListener('keydown', (event) => onKey(event, branch));
        return item;
      })
    );
    setHidden(empty, rows.length > 0 || !loaded);
    setText(empty, rows.length ? '' : words.noResults);
    const chosen = (form.getState().values[name] as unknown[] | null)?.length ?? 0;
    setText(count, chosen ? inPlural(words.treeChosen, words.treeChosenOne, chosen, locale) : '');
    if (focus) tree.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
  }
  function fold(branch: Branch, opened: boolean) {
    if (opened) open.add(branch.key);
    else open.delete(branch.key);
    active = branch.key;
    draw(true);
  }
  function onKey(event: KeyboardEvent, branch: Branch) {
    const rows = shown();
    const at = rows.findIndex((row) => row.key === branch.key);
    const go = (to: Branch | undefined) => {
      if (!to) return;
      active = to.key;
      draw(true);
    };
    const forward = rightToLeft(element) ? 'ArrowLeft' : 'ArrowRight';
    const back = forward === 'ArrowLeft' ? 'ArrowRight' : 'ArrowLeft';
    const opened = !!filter || open.has(branch.key);
    if (event.key === 'ArrowDown') go(rows[at + 1]);
    else if (event.key === 'ArrowUp') {
      if (at === 0 && searching) search.focus();
      else go(rows[at - 1]);
    } else if (event.key === 'Home') go(rows[0]);
    else if (event.key === 'End') go(rows[rows.length - 1]);
    else if (event.key === forward) {
      if (branch.children.length && !opened) fold(branch, true);
      else go(branch.children[0]);
    } else if (event.key === back) {
      if (branch.children.length && opened && !filter) fold(branch, false);
      else go(branch.parent ?? undefined);
    } else if (event.key === ' ' || event.key === 'Enter') {
      toggle(branch);
      draw(true);
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const wanted = foldForSearch(event.key);
      go([...rows.slice(at + 1), ...rows.slice(0, at + 1)].find((row) => foldForSearch(row.name).startsWith(wanted)));
    } else return;
    event.preventDefault();
  }

  function load() {
    void form.search(name, '', TREE_LIMIT).then(
      (found) => {
        build(found);
        loaded = true;
        readValue(form.getState().values[name]);
        drawnFor = '';
        // Opened to show what is ticked where some of a branch is: one ticked whole says so by its own box, folded.
        for (const branch of byKey.values()) if (branch.children.length && stateOf(branch) === 'mixed') open.add(branch.key);
        draw();
      },
      () => undefined
    );
  }
  search.addEventListener('input', () => {
    filter = search.value;
    draw();
    // Past the records the tree holds, the source is asked for those the words find, and they join the tree.
    clearTimeout(timer);
    if (records.length < TREE_LIMIT || !filter.trim()) return;
    const asked = ++seq;
    timer = setTimeout(() => {
      void form.search(name, foldDigits(stripMarks(filter.trim())), FOUND).then((found) => {
        if (asked !== seq) return;
        const known = new Set(records.map((record) => record.id));
        const added = found.filter((record) => !known.has(record.id));
        if (!added.length) return;
        build([...records, ...added]);
        readValue(form.getState().values[name]);
        draw();
      });
    }, DEBOUNCE_MS);
  });
  search.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      tree.querySelector<HTMLElement>('[tabindex="0"]')?.focus();
    } else if (event.key === 'Escape' && search.value) {
      event.preventDefault();
      search.value = '';
      filter = '';
      draw();
    }
  });
  load();

  return {
    element,
    focus: () => (searching ? search : tree.querySelector<HTMLElement>('[tabindex="0"]'))?.focus(),
    destroy: () => clearTimeout(timer),
    update(state) {
      readonly = state.readonly;
      search.readOnly = state.readonly;
      const now = `${state.readonly}|${(Array.isArray(state.value) ? (state.value as RelatedRecord[]) : []).map((record) => record.id).join(',')}`;
      if (loaded && now !== drawnFor) {
        drawnFor = now;
        readValue(state.value);
        draw(tree.contains(doc.activeElement));
      }
      setAttr(tree, 'aria-invalid', String(state.invalid));
      setAttr(tree, 'aria-describedby', [state.describedBy, count.id].filter(Boolean).join(' ') || null);
    },
  };
};
