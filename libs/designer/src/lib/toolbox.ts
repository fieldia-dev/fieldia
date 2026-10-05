import type { FieldNode } from '@fieldia/core';
import { blockIcon } from './canvas-icons';
import { APP_GROUP } from './app-kinds';
import type { ElementFactory } from './chrome';
import type { ModelField, QuestionKind } from './designer';
import { designerIcon } from './icons';
import { kindName, kindOfField, storedAs } from './kinds';
import type { DesignerWords } from './designer-words';
import { setAttr, setData, setHidden } from './writes';

/**
 * The toolbox: every kind of field as an icon and a short name, in groups
 * that fold, with a search — Quantia's toolbox, for forms. The model's fields
 * come first when there is a model. A tile clicked is added; a tile pressed
 * is handed to the canvas, which carries it if the pointer moves.
 *
 * A tile names what it adds: `kind:<id>`, `model:<field name>` or `layout:section` / `layout:tabs`;
 * in Advanced, the layout tiles are `block:<kind>` — groups, tabs and the blocks between fields.
 */

export interface ToolboxOptions {
  el: ElementFactory;
  doc: Document;
  /** The kinds it offers: a survey's, or a screen's. */
  kinds: readonly QuestionKind[];
  /** Sections and tabs, for a screen. */
  layout?: boolean;
  /** The designer's words. */
  words: DesignerWords;
  onPick(spec: string): void;
  onPress?(spec: string, event: PointerEvent, tile: HTMLElement): void;
}

export interface ToolboxHandle {
  element: HTMLElement;
  /** The model's fields still to place, whether tabs can be added, whether new fields can be — a list shows only what the model has — and whether it is Advanced. */
  update(state: { modelFields: ModelField[]; tabs: boolean; kinds?: boolean; advanced?: boolean }): void;
}

/** The kinds in the order and groups the toolbox shows them. */
export const TOOLBOX_GROUPS: readonly [string, readonly string[]][] = [
  ['Text', ['short-answer', 'paragraph', 'email', 'phone', 'website', 'keywords']],
  ['Numbers and dates', ['number', 'amount', 'rating', 'scale', 'slider', 'progress', 'date', 'date-time', 'time']],
  ['Choices', ['dropdown', 'multiple-choice', 'checkboxes', 'image-choice', 'tags', 'ranking', 'matrix', 'status', 'yes-no', 'tick']],
  ['Records', ['link', 'links', 'lines']],
  ['More', ['rich-text', 'image', 'file', 'signature', 'address', 'repeating']],
];

/**
 * The groups for these kinds: Fieldia's, then the app's own — each of its
 * kinds under the group it names, "Your kinds" unless it names one; a group
 * Fieldia has takes it at its end.
 */
export function toolboxGroups(kinds: readonly QuestionKind[]): [string, string[]][] {
  const groups: [string, string[]][] = TOOLBOX_GROUPS.map(([title, ids]) => [title, [...ids]]);
  for (const kind of kinds) {
    if (!kind.app) continue;
    const title = kind.app.group?.trim() || APP_GROUP;
    const group = groups.find(([name]) => name === title);
    if (group) group[1].push(kind.id);
    else groups.push([title, [kind.id]]);
  }
  return groups;
}

export function toolbox(options: ToolboxOptions): ToolboxHandle {
  const { el, doc } = options;
  const w = options.words.toolbox;
  const groupName = (key: string) => (Object.prototype.hasOwnProperty.call(options.words.kinds.groups, key) ? options.words.kinds.groups[key as keyof DesignerWords['kinds']['groups']] : key);
  const offered = new Map(options.kinds.map((k) => [k.id, k]));
  const folded = new Set<string>();
  let query = '';
  let kindsOn = true;
  let advancedOn = false;

  const find = el('input', { type: 'search', class: 'fd-input fd-tool-find', placeholder: w.find, 'aria-label': w.find });
  const none = el('p', { class: 'fd-tool-none', hidden: '' }, w.nothing);
  const groupsBox = el('div', { class: 'fd-tool-groups' });
  const element = el('aside', { class: 'fd-toolbox', 'aria-label': w.addAField }, find, groupsBox, none);

  function tile(spec: string, icon: string | SVGSVGElement, name: string, title: string, extra = ''): HTMLButtonElement {
    const picture = typeof icon === 'string' ? designerIcon(doc, icon) : icon;
    const button = el('button', { type: 'button', class: `fd-tool ${extra}`.trim(), 'data-tool': spec, title }, picture, el('span', { class: 'fd-tool-name' }, name));
    button.addEventListener('click', () => options.onPick(spec));
    button.addEventListener('pointerdown', (event) => {
      if ((event as PointerEvent).button === 0) options.onPress?.(spec, event as PointerEvent, button);
    });
    return button;
  }

  interface Group {
    key: string;
    element: HTMLElement;
    heading: HTMLButtonElement;
    count: HTMLElement;
    tiles: HTMLElement;
  }
  function group(key: string, title: string): Group {
    const count = el('b', { class: 'fd-tool-count', hidden: '' });
    const heading = el('button', { type: 'button', class: 'fd-tool-heading', 'aria-expanded': 'true' }, el('span', { class: 'fd-tool-caret', 'aria-hidden': 'true' }), el('span', { class: 'fd-tool-heading-name' }, title), count);
    const tiles = el('div', { class: 'fd-tools' });
    const element = el('section', { class: 'fd-tool-group', 'data-group': key }, heading, tiles);
    heading.addEventListener('click', () => {
      if (folded.has(key)) folded.delete(key);
      else folded.add(key);
      show();
    });
    return { key, element, heading, count, tiles };
  }

  const fromModel = group('model', w.fromTheModel);
  fromModel.element.classList.add('fd-tool-group-model');
  const kindGroups = toolboxGroups(options.kinds).map(([title, ids]) => {
    // Fieldia's groups by their key, in the designer's words; an app's by the name it gave.
    const g = group(title, groupName(title));
    for (const id of ids) {
      const kind = offered.get(id);
      const name = kind ? kindName(kind, options.words) : '';
      if (kind) g.tiles.append(tile(`kind:${id}`, id, name, w.addNew(name)));
    }
    return g;
  }).filter((g) => g.tiles.children.length > 0);
  const layout = group('layout', w.layout);
  const tabsTile = tile('layout:tabs', 'tabs', w.tabs, w.tabsTip);
  layout.tiles.append(tile('layout:section', 'section', w.section, w.sectionTip), tabsTile);
  // Advanced's layout tiles: dropped beside, under, into or between parts like any field.
  const blocks = ['group', 'side', 'tabs', 'heading', 'text', 'divider', 'spacer', 'image', 'button'] as const;
  const blockTiles = blocks.map((kind) => {
    const [name, tip] = w.blocks[kind];
    return tile(`block:${kind}`, blockIcon(doc, kind), name, w.blockTip(name, tip));
  });
  layout.tiles.append(...blockTiles);
  groupsBox.append(fromModel.element, ...kindGroups.map((g) => g.element), ...(options.layout ? [layout.element] : []));

  /** What the search and the folding leave on show. */
  function show() {
    let any = false;
    for (const g of [fromModel, ...kindGroups, layout]) {
      const shut = folded.has(g.key) && !query;
      setAttr(g.heading, 'aria-expanded', String(!shut));
      g.element.classList.toggle('fd-tool-shut', shut);
      let shown = 0;
      for (const t of g.tiles.children as HTMLCollectionOf<HTMLElement>) {
        const name = t.querySelector('.fd-tool-name')?.textContent?.toLowerCase() ?? '';
        const block = blockTiles.includes(t as HTMLButtonElement);
        const simpleOnly = g === layout && !block;
        const unavailable = (g !== fromModel && !kindsOn) || (t === tabsTile && tabsTile.dataset['allowed'] !== 'true') || (block && !advancedOn) || (simpleOnly && advancedOn);
        setHidden(t, unavailable || (!!query && !name.includes(query)));
        if (!t.hidden) shown++;
      }
      setHidden(g.tiles, shut);
      setHidden(g.element, shown === 0);
      if (shown) any = true;
    }
    setHidden(none, any);
  }
  find.addEventListener('input', () => {
    query = find.value.trim().toLowerCase();
    show();
  });

  return {
    element,
    update({ modelFields, tabs, kinds = true, advanced = false }) {
      kindsOn = kinds;
      advancedOn = advanced;
      const key = modelFields.map((m) => `${m.name}:${m.field.label}:${m.field.type}`).join('|');
      if (fromModel.element.dataset['key'] !== key) {
        fromModel.element.dataset['key'] = key;
        fromModel.tiles.replaceChildren(
          ...modelFields.map((m) => {
            const node: FieldNode = { type: 'field', id: m.name, field: m.name };
            const icon = kindOfField(m.field, node) ?? 'short-answer';
            return tile(`model:${m.name}`, icon, m.field.label, w.inTheModel(m.field.label, storedAs(m.field, options.words)), 'fd-tool-model');
          })
        );
        fromModel.count.textContent = String(modelFields.length);
        fromModel.count.hidden = modelFields.length === 0;
      }
      setData(tabsTile, 'allowed', String(tabs));
      show();
    },
  };
}
