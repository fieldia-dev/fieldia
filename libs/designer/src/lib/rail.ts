import type { FieldNode, LayoutNode, Page, SectionNode, TabsNode } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import { designerIcon } from './icons';
import { kindById, kindOfField, storedAs } from './kinds';
import { columnId } from './list-commands';
import type { ToolboxHandle } from './toolbox';

/**
 * The editor's left side, in three tabs: Add — the toolbox; Outline — the
 * page as a tree, each part picked from it, marked when it shows only for
 * some answers; and Data — where the page's records live, the model's fields
 * on the page or not, and a made-up record to fill the canvas with.
 */

export interface RailOptions {
  el: ElementFactory;
  doc: Document;
  designer: Designer;
  tools: ToolboxHandle;
  /** A survey keeps answers, not records: no model, no made-up record. */
  survey: boolean;
  /** Bring a part picked in the outline into view on the canvas. */
  reveal(id: string): void;
  /** Add a field of the model to the page, or as a column. */
  addModelField?(name: string): void;
  /** Fill the canvas with the made-up record at `index`, or with nothing. */
  onSample?(index: number | null): void;
}

export interface Rail {
  element: HTMLElement;
  update(state: DesignerState): void;
}

type Pane = 'add' | 'outline' | 'data';

interface Row {
  id: string;
  label: string;
  kind: string;
  level: number;
  icon?: string;
  /** Shown only for some answers or records. */
  ruled?: boolean;
}

const nameOf = (page: Page, node: FieldNode) => (node as FieldNode & { label?: string }).label ?? page.fields[node.field]?.label ?? node.field;
const ruled = (invisible: unknown) => invisible !== undefined && invisible !== null && invisible !== false && invisible !== '';

function fieldRow(page: Page, node: FieldNode, level: number): Row {
  const kind = kindOfField(page.fields[node.field], node);
  return { id: node.id, label: nameOf(page, node), kind: kind ? kindById(kind).label : 'Custom', level, icon: kind ?? 'short-answer', ruled: ruled(node.invisible) };
}

/** The page as rows of a tree, in reading order. */
export function outlineRows(page: Page): Row[] {
  const root = page.layout;
  const rows: Row[] = [];
  if (root.type === 'wizard') {
    for (const step of root.children) {
      rows.push({ id: step.id, label: step.label, kind: 'page', level: 0, ruled: ruled(step.invisible) });
      for (const node of step.children) if (node.type === 'field') rows.push(fieldRow(page, node, 1));
    }
    return rows;
  }
  if (root.type === 'list') return root.columns.map((name) => ({ id: columnId(name), label: page.fields[name]?.label ?? name, kind: 'column', level: 0 }));
  if (root.type === 'sheet') {
    if (root.statusbar) rows.push({ id: '#statusbar', label: 'Status steps', kind: page.fields[root.statusbar.field]?.label ?? '', level: 0, icon: 'status' });
    for (const [parts, kind] of [[root.buttons, 'button'], [root.statButtons, 'counter'], [root.badges, 'badge']] as const) for (const part of parts ?? []) rows.push({ id: part.id, label: part.label, kind, level: 0, ruled: ruled(part.invisible) });
  }
  const walk = (nodes: LayoutNode[], level: number) => {
    for (const node of nodes) {
      if (node.type === 'section') {
        const section = node as SectionNode;
        rows.push({ id: section.id, label: section.title || 'Untitled section', kind: 'section', level, icon: 'section', ruled: ruled(section.invisible) });
        for (const child of section.children) if (child.type === 'field') rows.push(fieldRow(page, child, level + 1));
        walk(section.children.filter((c) => c.type !== 'field'), level + 1);
      } else if (node.type === 'tabs') {
        const tabs = node as TabsNode;
        rows.push({ id: tabs.id, label: 'Tabs', kind: `${tabs.children.length} tab${tabs.children.length === 1 ? '' : 's'}`, level, icon: 'tabs' });
        for (const tab of tabs.children) {
          rows.push({ id: tab.id, label: tab.label, kind: 'tab', level: level + 1, ruled: ruled(tab.invisible) });
          walk(tab.children, level + 2);
        }
      }
    }
  };
  walk((root as { children: LayoutNode[] }).children ?? [], 0);
  return rows;
}

export function rail(options: RailOptions): Rail {
  const { el, doc, designer } = options;
  let pane: Pane = 'add';
  let sample: number | null = null;
  const outline = el('nav', { class: 'fd-outline', 'aria-label': 'Outline', hidden: '' });
  const data = el('div', { class: 'fd-data', hidden: '' });
  const panes: Record<Pane, HTMLElement> = { add: options.tools.element, outline, data };
  const tabs = (['add', 'outline', 'data'] as const).map((name) => {
    const button = el('button', { type: 'button', role: 'tab', class: 'fd-rail-tab', 'data-rail': name, 'aria-selected': String(name === pane) }, { add: 'Add', outline: 'Outline', data: 'Data' }[name]);
    button.addEventListener('click', () => {
      pane = name;
      draw(designer.getState());
    });
    return button;
  });
  const element = el('aside', { class: 'fd-rail', 'aria-label': 'Add, outline and data' }, el('div', { class: 'fd-rail-tabs', role: 'tablist', 'aria-label': 'Beside the page' }, ...tabs), options.tools.element, outline, data);
  // The toolbox is its own aside; inside the rail it is a pane.
  options.tools.element.classList.add('fd-rail-pane');

  function drawOutline(state: DesignerState) {
    const rows = outlineRows(state.page);
    const list = el(
      'ul',
      { class: 'fd-outline-tree' },
      ...rows.map((row) => {
        const button = el(
          'button',
          { type: 'button', 'data-pick': row.id, 'data-level': String(row.level), 'aria-current': String(state.selected === row.id), style: `--fd-level: ${row.level}` },
          ...(row.icon ? [designerIcon(doc, row.icon)] : []),
          el('span', { class: 'fd-outline-label' }, row.label),
          ...(row.ruled ? [el('span', { class: 'fd-outline-when', title: options.survey ? 'Shown only for some answers' : 'Shown only for some records' }, designerIcon(doc, 'when'))] : []),
          el('span', { class: 'fd-outline-kind' }, row.kind)
        );
        button.addEventListener('click', () => {
          designer.select(row.id);
          options.reveal(row.id);
        });
        return el('li', {}, button);
      })
    );
    outline.replaceChildren(
      el('p', { class: 'fd-properties-hint' }, options.survey ? 'Pages and their questions. Pick one to open it.' : 'The whole page as a tree. Pick a part to open it.'),
      rows.length ? list : el('p', { class: 'fd-properties-hint' }, 'Nothing on the page yet.')
    );
  }

  function drawData(state: DesignerState) {
    const page = state.page;
    if (options.survey || page.data.kind !== 'record') {
      data.replaceChildren(
        el('div', { class: 'fd-data-card' }, el('span', {}, 'Answers are kept as responses:'), el('b', { class: 'fd-data-model' }, 'one record per person, one field per question')),
        el('p', { class: 'fd-properties-hint' }, 'A survey makes its own fields: each question added is a new one, so every kind is offered.')
      );
      return;
    }
    const unused = designer.modelFields();
    const onPage = Object.entries(page.fields);
    const list = page.layout.type === 'list';
    const row = (name: string, label: string, type: string, used: boolean, stored: string) => {
      const add = !used && options.addModelField ? el('button', { type: 'button', class: 'fd-button fd-button-link' }, list ? 'Add as a column' : 'Add') : null;
      add?.addEventListener('click', () => options.addModelField?.(name));
      return el(
        'div',
        { class: 'fd-data-row', 'data-field': name, title: `${label}: ${stored}` },
        el('span', { class: 'fd-data-label' }, label),
        el('span', { class: `fd-data-used${used ? ' fd-data-on' : ''}` }, used ? 'On the page' : 'Not used'),
        el('code', {}, `${name} · ${type}`),
        ...(add ? [add] : [])
      );
    };
    const samples = list
      ? []
      : [
          el(
            'div',
            { class: 'fd-prop' },
            el('span', { class: 'fd-prop-name' }, 'Record on the canvas'),
            el(
              'div',
              { class: 'fd-seg', role: 'group', 'aria-label': 'Record on the canvas' },
              ...([['none', 'Empty'], ['0', 'Record 1'], ['1', 'Record 2'], ['2', 'Record 3']] as const).map(([key, words]) => {
                const button = el('button', { type: 'button', class: 'fd-seg-button', 'data-sample': key, 'aria-pressed': String((sample === null ? 'none' : String(sample)) === key) }, words);
                button.addEventListener('click', () => {
                  sample = key === 'none' ? null : Number(key);
                  options.onSample?.(sample);
                  drawData(designer.getState());
                });
                return button;
              })
            ),
            el('p', { class: 'fd-properties-hint' }, 'A made-up record fills the page, so it reads as it will with real ones. Nothing here is saved.')
          ),
        ];
    data.replaceChildren(
      el('div', { class: 'fd-data-card' }, el('span', {}, list ? 'This list shows records of' : 'This page shows records of'), el('b', { class: 'fd-data-model' }, page.data.model), el('span', { class: 'fd-data-count' }, `${onPage.length + unused.length} fields · ${onPage.length} on this page`)),
      ...samples,
      el('div', { class: 'fd-data-rows' }, ...onPage.map(([name, field]) => row(name, field.label, field.type, true, storedAs(field))), ...unused.map(({ name, field }) => row(name, field.label, field.type, false, storedAs(field))))
    );
  }

  function draw(state: DesignerState) {
    for (const t of tabs) t.setAttribute('aria-selected', String(t.dataset['rail'] === pane));
    for (const [name, p] of Object.entries(panes)) p.hidden = name !== pane;
    if (pane === 'outline') drawOutline(state);
    if (pane === 'data') drawData(state);
  }

  return { element, update: draw };
}
