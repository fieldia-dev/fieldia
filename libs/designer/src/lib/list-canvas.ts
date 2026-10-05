import type { ButtonNode, LineField, ListNode, Page } from '@fieldia/core';
import { installListStyles, VIEWER_LABELS, type ViewerLabels } from '@fieldia/viewer';
import { displayValue } from '@fieldia/widgets';
import { canvasDrag, type CanvasDrag } from './canvas-drag';
import { pageLocale } from './chrome-language';
import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import { designerIcon } from './icons';
import { kindOfField } from './kinds';
import { canBeColumn, columnId } from './list-commands';
import { openMenu } from './menu';
import { sampleRows } from './samples';

/**
 * A list page on the canvas, drawn the way the viewer draws it: the search
 * bar with the filters that are on when it opens, the buttons for the rows
 * chosen, and the table, filled with made-up records of the right kinds. A
 * column is picked by a click — a bar on it moves it or takes it away — and
 * dragged along the row to another place; a field from the toolbox is
 * dropped between two columns, or added from the table's own "Column". A
 * button's words are typed where it stands.
 */

export interface ListCanvas {
  element: HTMLElement;
  drag: CanvasDrag;
  update(state: DesignerState): void;
  /** Put the cursor in a button's words, every word selected. */
  focusAction(id: string): void;
  destroy(): void;
}

export interface ListCanvasOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  /** Open the list's panel at its search and filters. */
  more(part: 'filters'): void;
  /** A tile from the toolbox was let go between two columns. */
  dropTool(spec: string, index: number): void;
}

/** Numbers line up on the end of their column, as the viewer lines them up. */
const NUMBERS = new Set(['integer', 'float', 'monetary']);
/** Rows of made-up records drawn, and how many the made-up list holds. */
const ROWS = 5;
const TOTAL = 128;

export function listCanvas(options: ListCanvasOptions): ListCanvas {
  const { el, doc, designer } = options;
  const w = designer.words.list;
  installListStyles(doc);
  /** What the viewer itself says on the list — its search box, its pager, the rows chosen — in the page's language, as the form will. */
  const viewerWords = (page: Page): ViewerLabels => VIEWER_LABELS[pageLocale(page)];

  // ---- the search bar and the pager ----------------------------------------------------
  const facets = el('span', { class: 'fd-facets' });
  const searchWords = el('span', { class: 'fd-search-placeholder' });
  const search = el(
    'div',
    { class: 'fd-search fd-canvas-search', role: 'button', tabindex: '0', 'aria-label': w.searchAndFilters, title: w.searchTitle },
    el('div', { class: 'fd-search-field' }, designerIcon(doc, 'search'), facets, searchWords)
  );
  const openFilters = () => {
    designer.select(null);
    options.more('filters');
  };
  search.addEventListener('click', openFilters);
  search.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openFilters();
    }
  });
  const pagerText = el('span', { class: 'fd-pager-text' });
  const step = (text: string) => el('button', { type: 'button', class: 'fd-button fd-pager-button', tabindex: '-1', 'aria-hidden': 'true', disabled: '' }, text);
  const bar = el('div', { class: 'fd-list-bar' }, search, el('div', { class: 'fd-pager' }, pagerText, step('‹'), step('›')));

  // ---- the buttons for the rows chosen -----------------------------------------------------
  const actions = el('div', { class: 'fd-canvas-list-actions' });
  const chosen = el('span', { class: 'fd-list-count' });
  const addAction = el('button', { type: 'button', class: 'fd-canvas-add-part', 'data-add-part': 'action' }, designerIcon(doc, 'plus'), w.addButton);
  addAction.addEventListener('click', () => {
    const created = designer.addListAction(designer.words.defaults.newButton);
    if (created) focusAction(created);
  });
  const selection = el(
    'div',
    { class: 'fd-list-selection fd-canvas-selection' },
    chosen,
    el('span', { class: 'fd-canvas-selection-hint' }, w.showsWhenChosen),
    actions,
    addAction
  );

  interface ActionView {
    element: HTMLElement;
    key: string;
    input: HTMLInputElement | null;
  }
  const views = new Map<string, ActionView>();

  function closedAction(action: ButtonNode): HTMLElement {
    const button = el('button', { type: 'button', class: `fd-button fd-button-${action.style ?? 'secondary'} fd-canvas-part`, 'data-part': action.id }, action.label);
    button.addEventListener('click', () => {
      designer.select(action.id);
      focusAction(action.id, false);
    });
    return button;
  }

  function openAction(action: ButtonNode): ActionView {
    const input = el('input', { class: 'fd-part-input', 'aria-label': w.words, autocomplete: 'off', size: String(Math.max(4, action.label.length + 1)) }) as HTMLInputElement;
    input.addEventListener('input', () => {
      input.size = Math.max(4, input.value.length + 1);
      designer.updateListAction(action.id, { label: input.value });
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        input.blur();
      }
    });
    const remove = el('button', { type: 'button', class: 'fd-bar-button', 'aria-label': w.delete, title: w.delete }, designerIcon(doc, 'delete'));
    remove.addEventListener('click', () => designer.removeListAction(action.id));
    const tools = el('div', { class: 'fd-field-bar fd-part-bar', role: 'toolbar', 'aria-label': action.label }, remove);
    const element = el('span', { class: `fd-button fd-button-${action.style ?? 'secondary'} fd-canvas-part fd-editing`, 'data-part': action.id }, tools, input);
    return { element, key: '', input };
  }

  function drawActions(list: ListNode, selected: string | null) {
    const live = new Set<string>();
    const drawn = (list.actions ?? []).map((action) => {
      live.add(action.id);
      const editing = selected === action.id;
      const key = `${editing}:${JSON.stringify(action)}`;
      let view = views.get(action.id);
      // The button being typed in stays the same box, focused.
      if (!(view && (editing ? view.input !== null : view.key === key))) {
        view = editing ? openAction(action) : { element: closedAction(action), key, input: null };
        views.set(action.id, view);
      }
      view.key = key;
      if (view.input && doc.activeElement !== view.input) view.input.value = action.label;
      if (view.input) view.element.className = `fd-button fd-button-${action.style ?? 'secondary'} fd-canvas-part fd-editing`;
      return view.element;
    });
    drawn.forEach((child, index) => {
      if (actions.children[index] !== child) actions.insertBefore(child, actions.children[index] ?? null);
    });
    while (actions.children.length > drawn.length) actions.lastElementChild?.remove();
    for (const id of [...views.keys()]) if (!live.has(id)) views.delete(id);
  }

  function focusAction(id: string, selectAll = true) {
    const input = views.get(id)?.input;
    if (!input) return;
    input.focus();
    if (selectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }

  // ---- the table ------------------------------------------------------------------------------
  const table = el('table', { class: 'fd-list-table' });
  const scroll = el('div', { class: 'fd-list-scroll fd-canvas-list-scroll', 'data-drop-section': 'columns', 'data-drop-flow': 'row' }, table);
  let tableKey = '';

  function addColumnMenu(anchor: HTMLElement) {
    const page = designer.getPage();
    const columns = (page.layout as ListNode).columns;
    const own = Object.entries(page.fields)
      .filter(([name]) => !columns.includes(name))
      .map(([name, field]) => ({ name, field }));
    const choices = [...own, ...designer.modelFields()].filter(({ field }) => canBeColumn(field));
    openMenu({
      el,
      anchor,
      title: w.addColumn,
      items: choices.map(({ name, field }) => ({ id: name, label: field.label, icon: kindOfField(field, { type: 'field', id: name, field: name }) ?? 'short-answer' })),
      note: w.addColumnNote(choices.length > 0),
      onPick: (name) => designer.addColumn(name),
    });
  }

  function columnBar(name: string, index: number, count: number): HTMLElement {
    const tool = (label: string, icon: string, run: () => void) => {
      const button = el('button', { type: 'button', class: 'fd-bar-button', 'aria-label': label, title: label }, designerIcon(doc, icon));
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        run();
      });
      return button;
    };
    return el(
      'div',
      { class: 'fd-field-bar fd-column-bar', role: 'toolbar', 'aria-label': w.column },
      ...(index > 0 ? [tool(w.moveLeft, 'left', () => designer.moveColumn(name, index - 1))] : []),
      ...(index < count - 1 ? [tool(w.moveRight, 'right', () => designer.moveColumn(name, index + 1))] : []),
      tool(w.removeColumn, 'delete', () => designer.removeColumn(name))
    );
  }

  function drawTable(page: Page, list: ListNode, selected: string | null) {
    const key = JSON.stringify([list.columns, list.sort?.[0], list.columns.map((name) => page.fields[name]), selected]);
    if (key === tableKey) return;
    tableKey = key;
    const box = () => el('input', { type: 'checkbox', class: 'fd-list-checkbox', tabindex: '-1', 'aria-hidden': 'true', disabled: '' });
    const order = list.sort?.[0];
    const heads = list.columns.map((name, index) => {
      const def = page.fields[name];
      const picked = selected === columnId(name);
      const th = el(
        'th',
        { scope: 'col', 'data-node': name, tabindex: '0', class: ['fd-canvas-column', NUMBERS.has(def.type) ? 'fd-num' : '', picked ? 'fd-picked' : ''].filter(Boolean).join(' ') },
        el('span', { class: 'fd-list-sort' }, def.label)
      );
      if (order?.field === name) th.setAttribute('aria-sort', order.desc ? 'descending' : 'ascending');
      if (picked) th.append(columnBar(name, index, list.columns.length));
      const pick = () => designer.select(columnId(name));
      th.addEventListener('click', pick);
      th.addEventListener('keydown', (event) => {
        if (event.target === th && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          pick();
        }
      });
      return th;
    });
    const add = el('button', { type: 'button', class: 'fd-canvas-add-part', 'aria-label': w.addColumn, title: w.addColumn }, designerIcon(doc, 'plus'), w.column);
    add.addEventListener('click', () => addColumnMenu(add));
    const rows = sampleRows(page.fields, list.columns, ROWS).map((values) =>
      el(
        'tr',
        { class: 'fd-list-row' },
        el('td', { class: 'fd-list-check' }, box()),
        ...list.columns.map((name) => {
          const td = el('td', { 'data-node': name, class: [NUMBERS.has(page.fields[name].type) ? 'fd-num' : '', selected === columnId(name) ? 'fd-picked' : ''].filter(Boolean).join(' ') || undefined });
          td.textContent = displayValue(page.fields[name] as LineField, values[name], values);
          td.addEventListener('click', () => designer.select(columnId(name)));
          return td;
        }),
        el('td', { class: 'fd-canvas-add-column' })
      )
    );
    table.replaceChildren(
      el('thead', {}, el('tr', {}, el('th', { class: 'fd-list-check', scope: 'col' }, box()), ...heads, el('th', { class: 'fd-canvas-add-column' }, add))),
      el('tbody', {}, ...rows)
    );
  }

  const element = el('div', { class: 'fd-canvas fd-list-canvas' }, el('div', { class: 'fd-list' }, bar, selection, scroll));

  const drag = canvasDrag({
    words: designer.words,
    canvas: element,
    cards: '.fd-list-table th[data-node]',
    drop(source, _section, index) {
      if ('node' in source) designer.moveColumn(source.node, index);
      else options.dropTool(source.tool, index);
    },
  });

  return {
    element,
    drag,
    focusAction,
    update(state) {
      const { page, selected } = state;
      if (page.layout.type !== 'list') return;
      const list = page.layout;
      const on = new Set(list.defaultFilters ?? []);
      facets.replaceChildren(...(list.filters ?? []).filter((f) => on.has(f.id)).map((f) => el('span', { class: 'fd-facet' }, el('span', { class: 'fd-facet-text' }, f.label))));
      const size = list.pageSize ?? 40;
      const said = viewerWords(page);
      searchWords.textContent = said.search;
      chosen.textContent = said.selected.replace('{n}', '2');
      pagerText.textContent = said.range.replace('{from}', '1').replace('{to}', String(Math.min(size, TOTAL))).replace('{total}', String(TOTAL));
      drawActions(list, selected);
      drawTable(page, list, selected);
    },
    destroy() {
      drag.destroy();
      views.clear();
    },
  };
}
