import { blockIcon } from './canvas-icons';
import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import { designerIcon } from './icons';
import { treeKey, typeAhead } from './outline-keys';
import { outlineRows, shownRows, type OutlineRow } from './outline-rows';

/**
 * The outline: the page as a tree, drawn as the approved mockup draws it —
 * a row for every part, an arrow to fold what holds parts, its icon, its
 * name and, for a field, its kind — and answering the keys a tree does
 * (outline-keys.ts). One row takes Tab; the arrows go from row to row,
 * picking each and showing it on the page. What is folded stays folded
 * while the page changes, and the rows are kept by id, so the row the
 * keyboard is on keeps its focus.
 */

export interface OutlineViewOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  /** A survey says “answers”, a screen “records”. */
  survey: boolean;
  /** Bring a part into view on the canvas. */
  reveal(id: string): void;
  /** Whether several may be picked at once: always in a survey, in Advanced on a screen. */
  several(): boolean;
  /** Say words in the editor's polite live region. */
  say(words: string): void;
}

export interface OutlineView {
  element: HTMLElement;
  /** Draw the page as it is now; `shown` false while another tab of the rail is on show. */
  update(state: DesignerState, shown: boolean): void;
}

/** How long letters typed one after another go to one name. */
const TYPED_FOR = 700;

export function outlineView(options: OutlineViewOptions): OutlineView {
  const { el, doc, designer } = options;
  const tree = el('div', { class: 'fd-outline-tree', role: 'tree', 'aria-label': 'The page’s parts', 'aria-multiselectable': 'true' });
  const empty = el('p', { class: 'fd-properties-hint', hidden: '' }, 'Nothing on the page yet.');
  const help = el('p', { class: 'fd-outline-help' }, options.survey ? 'Pages and their questions. Pick one to open it.' : 'The whole page as a tree. Pick a part to open it.');
  const element = el('nav', { class: 'fd-outline', 'aria-label': 'Outline', hidden: '' }, tree, empty, help);

  /** Rows folded by the person, by id: kept while the page changes. */
  const folded = new Set<string>();
  const views = new Map<string, HTMLElement>();
  let all: OutlineRow[] = [];
  let shown: OutlineRow[] = [];
  /** The row that takes Tab, and that the keys move from. */
  let active: string | null = null;
  /** The part picked last time round: a new pick, from anywhere, becomes the row to Tab to. */
  let lead: string | null = null;
  let typed = '';
  let typedAt = 0;

  const rtl = () => doc.defaultView?.getComputedStyle(element).direction === 'rtl';
  const indexOf = (id: string | null) => shown.findIndex((r) => r.id === id);
  const opens = (row: OutlineRow) => row.holds && row.children > 0;

  function words(row: OutlineRow): string {
    const parts = [row.label, row.kind];
    if (row.ruled) parts.push(options.survey ? 'shown only for some answers' : 'shown only for some records');
    if (row.required) parts.push('required');
    return parts.join(', ');
  }

  function drawRow(row: OutlineRow, state: DesignerState, setSize: number, position: number): HTMLElement {
    let view = views.get(row.id);
    if (!view) {
      view = el('div', { class: 'fd-outline-row', role: 'treeitem', 'data-pick': row.id });
      views.set(row.id, view);
    }
    const open = opens(row);
    view.dataset['level'] = String(row.level);
    view.style.setProperty('--fd-level', String(row.level));
    view.setAttribute('aria-level', String(row.level + 1));
    view.setAttribute('aria-setsize', String(setSize));
    view.setAttribute('aria-posinset', String(position));
    view.setAttribute('aria-selected', String(state.picked.includes(row.id)));
    view.setAttribute('aria-label', words(row));
    if (open) view.setAttribute('aria-expanded', String(!folded.has(row.id)));
    else view.removeAttribute('aria-expanded');
    view.tabIndex = row.id === active ? 0 : -1;
    const icon = row.block ? blockIcon(doc, row.icon) : designerIcon(doc, row.icon);
    // A field and a block say their kind after their name; what holds parts says it in its badge.
    const kind = row.holds || row.label === row.kind || row.movable === false ? null : el('span', { class: 'fd-outline-kind' }, ` · ${row.kind}`);
    view.replaceChildren(
      open ? el('span', { class: 'fd-outline-twist', 'data-twist': '', 'aria-hidden': 'true' }, designerIcon(doc, 'chevron')) : el('span', { class: 'fd-outline-twist', 'aria-hidden': 'true' }),
      icon,
      el('span', { class: 'fd-outline-name' }, el('span', { class: 'fd-outline-label' }, row.label), ...(kind ? [kind] : [])),
      ...(row.ruled ? [el('span', { class: 'fd-outline-when', title: options.survey ? 'Shown only for some answers' : 'Shown only for some records', 'aria-hidden': 'true' }, designerIcon(doc, 'when'))] : []),
      ...(row.required ? [el('span', { class: 'fd-outline-required', title: 'Required', 'aria-hidden': 'true' }, designerIcon(doc, 'required'))] : []),
      ...(row.badge ? [el('span', { class: 'fd-outline-badge', title: row.badgeWords, 'aria-hidden': 'true' }, row.badge)] : [])
    );
    return view;
  }

  function draw(state: DesignerState) {
    all = outlineRows(state.page);
    for (const id of [...folded]) if (!all.some((r) => r.id === id && opens(r))) folded.delete(id);
    shown = shownRows(all, folded);
    const inTree = tree.contains(doc.activeElement);
    if (state.selected !== lead && indexOf(state.selected) !== -1) active = state.selected;
    lead = state.selected;
    if (indexOf(active) === -1) active = shown.find((r) => r.id === state.selected)?.id ?? shown[0]?.id ?? null;
    const siblings = new Map<string | null, string[]>();
    for (const row of all) siblings.set(row.parent, [...(siblings.get(row.parent) ?? []), row.id]);
    const drawn = shown.map((row) => {
      const own = siblings.get(row.parent) ?? [row.id];
      return drawRow(row, state, own.length, own.indexOf(row.id) + 1);
    });
    drawn.forEach((view, index) => {
      if (tree.children[index] !== view) tree.insertBefore(view, tree.children[index] ?? null);
    });
    while (tree.children.length > drawn.length) tree.lastElementChild?.remove();
    for (const id of [...views.keys()]) if (!shown.some((r) => r.id === id)) views.delete(id);
    tree.hidden = !shown.length;
    empty.hidden = shown.length > 0;
    // The row the keyboard was on went (taken off, or folded away): the keyboard goes to the row now taking Tab.
    if (inTree && !tree.contains(doc.activeElement) && active) views.get(active)?.focus();
  }

  /** Make a row the one the keyboard is on. */
  function focusRow(id: string) {
    active = id;
    for (const [rowId, view] of views) view.tabIndex = rowId === id ? 0 : -1;
    views.get(id)?.focus();
  }

  function pickRow(id: string, reveal: boolean) {
    designer.pick(id);
    if (reveal) options.reveal(id);
  }

  function setFolded(id: string, fold: boolean) {
    if (fold) folded.add(id);
    else folded.delete(id);
    draw(designer.getState());
  }

  tree.addEventListener('click', (event) => {
    const target = event.target as Element;
    const view = target.closest<HTMLElement>('[role="treeitem"]');
    if (!view) return;
    const id = view.dataset['pick'] as string;
    if (target.closest('[data-twist]')) {
      setFolded(id, !folded.has(id));
      focusRow(id);
      return;
    }
    focusRow(id);
    pickRow(id, true);
  });

  tree.addEventListener('focusin', (event) => {
    const view = (event.target as Element).closest<HTMLElement>('[role="treeitem"]');
    if (view && view.dataset['pick'] !== active) {
      active = view.dataset['pick'] as string;
      for (const [rowId, other] of views) other.tabIndex = rowId === active ? 0 : -1;
    }
  });

  tree.addEventListener('keydown', (event) => {
    const view = (event.target as Element).closest<HTMLElement>('[role="treeitem"]');
    if (!view) return;
    const at = indexOf(view.dataset['pick'] as string);
    const step = treeKey(shown, at, event, rtl(), folded);
    if (!step) {
      // Letters go to the row whose name starts with them.
      if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey || event.key === ' ') return;
      const now = Date.now();
      typed = now - typedAt > TYPED_FOR ? event.key : typed + event.key;
      typedAt = now;
      const to = typeAhead(shown, at, typed);
      event.preventDefault();
      event.stopPropagation();
      if (to === -1) return;
      focusRow(shown[to].id);
      pickRow(shown[to].id, true);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if ('none' in step) return;
    if ('fold' in step) return setFolded(step.fold, true);
    if ('unfold' in step) return setFolded(step.unfold, false);
    const id = shown[at].id;
    if ('pick' in step) return pickRow(id, step.reveal);
    focusRow(shown[step.to].id);
    pickRow(shown[step.to].id, true);
  });

  return {
    element,
    update(state, visible) {
      if (visible) draw(state);
    },
  };
}
