import type { FieldNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { ModelField, QuestionKind } from './designer';
import { designerIcon } from './icons';
import { kindOfField, storedAs } from './kinds';

/**
 * The toolbox: every kind of field as an icon and a short name, in groups
 * that fold, with a search — Quantia's toolbox, for forms. The model's fields
 * come first when there is a model. A tile clicked is added; a tile pressed
 * is handed to the canvas, which carries it if the pointer moves.
 *
 * A tile names what it adds: `kind:<id>`, `model:<field name>` or `layout:section` / `layout:tabs`.
 */

export interface ToolboxOptions {
  el: ElementFactory;
  doc: Document;
  /** The kinds it offers: a survey's, or a screen's. */
  kinds: readonly QuestionKind[];
  /** Sections and tabs, for a screen. */
  layout?: boolean;
  onPick(spec: string): void;
  onPress?(spec: string, event: PointerEvent, tile: HTMLElement): void;
}

export interface ToolboxHandle {
  element: HTMLElement;
  /** The model's fields still to place, whether tabs can be added, and whether new fields can be — a list shows only what the model has. */
  update(state: { modelFields: ModelField[]; tabs: boolean; kinds?: boolean }): void;
}

/** The kinds in the order and groups the toolbox shows them. */
export const TOOLBOX_GROUPS: readonly [string, readonly string[]][] = [
  ['Text', ['short-answer', 'paragraph', 'email', 'phone', 'website', 'keywords']],
  ['Numbers and dates', ['number', 'amount', 'rating', 'scale', 'slider', 'progress', 'date', 'date-time']],
  ['Choices', ['dropdown', 'multiple-choice', 'checkboxes', 'image-choice', 'tags', 'ranking', 'matrix', 'status', 'yes-no']],
  ['Records', ['link', 'links', 'lines']],
  ['More', ['rich-text', 'image', 'file', 'signature', 'address', 'repeating']],
];

export function toolbox(options: ToolboxOptions): ToolboxHandle {
  const { el, doc } = options;
  const offered = new Map(options.kinds.map((k) => [k.id, k]));
  const folded = new Set<string>();
  let query = '';
  let kindsOn = true;

  const find = el('input', { type: 'search', class: 'fd-input fd-tool-find', placeholder: 'Find a field or a kind', 'aria-label': 'Find a field or a kind' });
  const none = el('p', { class: 'fd-tool-none', hidden: '' }, 'Nothing by that name.');
  const groupsBox = el('div', { class: 'fd-tool-groups' });
  const element = el('aside', { class: 'fd-toolbox', 'aria-label': 'Add a field' }, find, groupsBox, none);

  function tile(spec: string, icon: string, name: string, title: string, extra = ''): HTMLButtonElement {
    const button = el('button', { type: 'button', class: `fd-tool ${extra}`.trim(), 'data-tool': spec, title }, designerIcon(doc, icon), el('span', { class: 'fd-tool-name' }, name));
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

  const fromModel = group('model', 'From the model');
  fromModel.element.classList.add('fd-tool-group-model');
  const kindGroups = TOOLBOX_GROUPS.map(([title, ids]) => {
    const g = group(title, title);
    for (const id of ids) {
      const kind = offered.get(id);
      if (kind) g.tiles.append(tile(`kind:${id}`, id, kind.label, `${kind.label}: add a new field`));
    }
    return g;
  }).filter((g) => g.tiles.children.length > 0);
  const layout = group('layout', 'Layout');
  const tabsTile = tile('layout:tabs', 'tabs', 'Tabs', 'Tabs: pages of sections on a record sheet');
  layout.tiles.append(tile('layout:section', 'section', 'Section', 'Section: a titled group of fields'), tabsTile);
  groupsBox.append(fromModel.element, ...kindGroups.map((g) => g.element), ...(options.layout ? [layout.element] : []));

  /** What the search and the folding leave on show. */
  function show() {
    let any = false;
    for (const g of [fromModel, ...kindGroups, layout]) {
      const shut = folded.has(g.key) && !query;
      g.heading.setAttribute('aria-expanded', String(!shut));
      g.element.classList.toggle('fd-tool-shut', shut);
      let shown = 0;
      for (const t of g.tiles.children as HTMLCollectionOf<HTMLElement>) {
        const name = t.querySelector('.fd-tool-name')?.textContent?.toLowerCase() ?? '';
        const unavailable = (g !== fromModel && !kindsOn) || (t === tabsTile && tabsTile.dataset['allowed'] !== 'true');
        t.hidden = unavailable || (!!query && !name.includes(query));
        if (!t.hidden) shown++;
      }
      g.tiles.hidden = shut;
      g.element.hidden = shown === 0;
      if (shown) any = true;
    }
    none.hidden = any;
  }
  find.addEventListener('input', () => {
    query = find.value.trim().toLowerCase();
    show();
  });

  return {
    element,
    update({ modelFields, tabs, kinds = true }) {
      kindsOn = kinds;
      const key = modelFields.map((m) => `${m.name}:${m.field.label}:${m.field.type}`).join('|');
      if (fromModel.element.dataset['key'] !== key) {
        fromModel.element.dataset['key'] = key;
        fromModel.tiles.replaceChildren(
          ...modelFields.map((m) => {
            const node: FieldNode = { type: 'field', id: m.name, field: m.name };
            const icon = kindOfField(m.field, node) ?? 'short-answer';
            return tile(`model:${m.name}`, icon, m.field.label, `${m.field.label}: already in the model, stored as ${storedAs(m.field)}`, 'fd-tool-model');
          })
        );
        fromModel.count.textContent = String(modelFields.length);
        fromModel.count.hidden = modelFields.length === 0;
      }
      tabsTile.dataset['allowed'] = String(tabs);
      show();
    },
  };
}
