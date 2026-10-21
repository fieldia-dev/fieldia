import type { Field, FieldNode, Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import type { StructurePart } from './kind-settings-structures';
import { settingNumber } from './number-box';

/**
 * The work tracker's pickers, set in the picked field and in the side panel
 * alike: a link drawn as a path in a tree (Area, Iteration) with what joins
 * its names, how many suggestions it makes and whether the tree is under
 * them; tags added from a button ("Add Tag"); a choice in Fieldia's own list
 * (Priority, Severity); and a state's list with its dots or a tick alone,
 * each state in a colour of its own.
 */

/** What may join a path's names: the work tracker's backslash first, the usual one. */
const SEPARATORS: [string, string][] = [
  ['\\', 'Portal\\Sprint 14'],
  ['/', 'Portal/Sprint 14'],
  [' › ', 'Portal › Sprint 14'],
];

export function pickerSettings(el: ElementFactory, designer: Designer, id: string, kind: string | null): StructurePart[] {
  const w = designer.words.questions;
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const word = (text: string, control: HTMLElement) => el('label', { class: 'fd-inline-setting' }, el('span', {}, text), control);
  const toggle = (label: string, onClick: (on: boolean) => void) => {
    const button = el('button', { type: 'button', class: 'fd-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': label }) as HTMLButtonElement;
    button.addEventListener('click', () => onClick(button.getAttribute('aria-checked') !== 'true'));
    return { button, element: el('span', { class: 'fd-inline-setting fd-inline-toggle' }, button, el('span', { 'aria-hidden': 'true' }, label)) };
  };
  const widget = (patch: Record<string, string | number | boolean | null>) => designer.setWidgetOptions(id, patch);
  const option = (node: FieldNode, key: string) => node.options?.[key];

  /** A link to a record of a tree, drawn as its path: what joins its names, how many it suggests, the tree. */
  function path(): StructurePart {
    const made = toggle(w.pathPicker, (on) => designer.setPathPicker(id, on));
    const separator = el('select', { class: 'fd-inline-select', 'aria-label': w.joinedBy }, ...SEPARATORS.map(([value, example]) => el('option', { value }, example))) as HTMLSelectElement;
    separator.addEventListener('change', () => widget({ separator: separator.value === '\\' ? null : separator.value }));
    // Kept once typed and left: 5 unless said, none at 0; a whole number 0 to 20, said so when it is not, never clamped in silence.
    let shown: number | null = null;
    const count = settingNumber(el, designer, {
      label: w.suggestionsShown,
      attrs: { class: 'fd-inline-input fd-inline-number', placeholder: '5' },
      integer: true,
      min: 0,
      max: 20,
      optional: true,
      saved: () => shown,
      commit: (n) => widget({ suggestions: n === 5 ? null : n }),
    });
    const tree = toggle(w.treeShown, (on) => widget({ tree: on ? null : false }));
    const more = el('div', { class: 'fd-inline-row' }, word(w.joinedBy, separator), word(w.suggestionsShown, count.input), tree.element);
    return {
      element: el('div', { class: 'fd-kind-block fd-path-settings' }, made.element, more),
      refresh(_page, node) {
        const on = node.widget === 'path';
        made.button.setAttribute('aria-checked', String(on));
        more.hidden = !on;
        if (!on) return;
        if (!focused(separator)) separator.value = String(option(node, 'separator') ?? '\\');
        const suggestions = option(node, 'suggestions');
        shown = typeof suggestions === 'number' ? suggestions : null;
        count.refresh();
        tree.button.setAttribute('aria-checked', String(option(node, 'tree') !== false));
      },
    };
  }

  /**
   * Links to several records of a tree drawn as a tree to tick — areas, permissions — what it keeps (every one ticked,
   * a whole branch as itself, the last ones alone), and whether a search is over it.
   */
  function checkTree(): StructurePart {
    const made = toggle(w.checkTree, (on) => designer.setCheckTree(id, on));
    const keeps = el('select', { class: 'fd-inline-select', 'aria-label': w.treeKeeps }, el('option', { value: '' }, w.treeKeepsAll), el('option', { value: 'top' }, w.treeKeepsTop), el('option', { value: 'leaves' }, w.treeKeepsLeaves)) as HTMLSelectElement;
    keeps.addEventListener('change', () => widget({ keeps: keeps.value || null }));
    const search = toggle(w.treeSearchShown, (on) => widget({ search: on ? null : false }));
    const more = el('div', { class: 'fd-inline-row' }, word(w.treeKeeps, keeps), search.element);
    return {
      element: el('div', { class: 'fd-kind-block fd-tree-settings' }, made.element, more),
      refresh(_page, node) {
        const on = node.widget === 'tree';
        made.button.setAttribute('aria-checked', String(on));
        // Its own look, or tags: a tree to tick only where the field is drawn as neither else (checkboxes, a table).
        made.element.hidden = !!node.widget && !on;
        more.hidden = !on;
        if (!on) return;
        if (!focused(keeps)) keeps.value = option(node, 'keeps') === 'top' || option(node, 'keeps') === 'leaves' ? String(option(node, 'keeps')) : '';
        search.button.setAttribute('aria-checked', String(option(node, 'search') !== false));
      },
    };
  }

  /** Tags added from a button, as a work tracker's "Add Tag": its words are the field's placeholder. */
  function adder(): StructurePart {
    const made = toggle(w.addedFromButton, (on) => widget({ adder: on ? 'button' : null }));
    return { element: made.element, refresh: (_page, node) => made.button.setAttribute('aria-checked', String(option(node, 'adder') === 'button')) };
  }

  /** A choice in Fieldia's own list, a tick by the option picked, in place of the browser's. */
  function ownList(): StructurePart {
    const made = toggle(w.ownList, (on) => widget({ list: on ? 'own' : null }));
    return { element: made.element, refresh: (_page, node) => made.button.setAttribute('aria-checked', String(option(node, 'list') === 'own')) };
  }

  /** A state's list with its dots, or a tick alone; each state in a colour of its own. */
  function dots(): StructurePart {
    const made = toggle(w.dotsInList, (on) => widget({ listDots: on ? null : false }));
    const colours = el('div', { class: 'fd-inline-row fd-dot-colours' });
    let drawn = '';
    return {
      element: el('div', { class: 'fd-kind-block' }, made.element, colours),
      refresh(page: Page, node: FieldNode) {
        made.button.setAttribute('aria-checked', String(option(node, 'listDots') !== false));
        const def: Field = page.fields[node.field];
        const options = def.type === 'selection' ? def.options : [];
        const chosen = (option(node, 'colours') ?? {}) as Record<string, string>;
        const key = JSON.stringify([options, chosen]);
        if (key === drawn) return;
        drawn = key;
        colours.replaceChildren(
          ...options.map((o) => {
            const own = chosen[String(o.value)];
            const pick = el('input', { type: 'color', class: 'fd-inline-colour', 'aria-label': w.colourFor(o.label), value: own ?? '#808080' }) as HTMLInputElement;
            pick.addEventListener('change', () => designer.setDotColour(id, o.value, pick.value));
            const clear = el('button', { type: 'button', class: 'fd-button fd-button-link fd-inline-clear', 'aria-label': w.noColourFor(o.label), title: w.noColourFor(o.label) }, '×') as HTMLButtonElement;
            clear.hidden = !own;
            clear.addEventListener('click', () => designer.setDotColour(id, o.value, null));
            return el('span', { class: 'fd-inline-setting' }, el('span', {}, o.label), pick, clear);
          })
        );
      },
    };
  }

  const parts: StructurePart[] = [];
  if (kind === 'link' || kind === 'model:link') parts.push(path());
  if (kind === 'links' || kind === 'model:links') parts.push(checkTree());
  if (kind === 'links' || kind === 'model:links' || kind === 'keywords') parts.push(adder());
  if (kind === 'dropdown') parts.push(ownList());
  if (kind === 'state-dot') parts.push(dots());
  return parts;
}
