import { createForm, createMemoryDataSource, type FieldNode, type Form, type Page, type SectionNode, type SectionsNode } from '@fieldia/core';
import { mountViewer, type Skin, type ViewerHandle } from '@fieldia/viewer';
import { createWidget, installStyles, type Widget } from '@fieldia/widgets';
import { designerBar, elementFactory, optionsEditor, type ElementFactory } from './chrome';
import { QUESTION_KINDS, type Designer, type DesignerState } from './designer';
import type { Grafloria, GrafloriaBoardHandle, GrafloriaWidget } from './grafloria';
import { flowCells, orderFromCells, rowsOf } from './screen-layout';
import { installDesignerStyles } from './styles';
import { kindOfQuestion } from './survey-editor';

/**
 * The screen editor: an app screen laid out on a canvas. Each section is a
 * Grafloria board with the section's columns; each field is a card on it,
 * drawn with its real widget. Dragging a card reorders the section and
 * resizing it sets the field's width — one undoable edit per gesture. A
 * palette adds fields and a properties panel changes the selected one.
 *
 * The page stores only an order and a width per field, so after every
 * gesture the board is laid out again from the page: what the canvas shows
 * is always where the viewer will put each field.
 */

export interface ScreenEditorOptions {
  designer: Designer;
  /** Grafloria's dashboard kit: `import * as grafloria from '@grafloria/element'`. */
  grafloria: Grafloria;
  skin?: Skin;
}

export interface ScreenEditorHandle {
  element: HTMLElement;
  destroy(): void;
}

/** Canvas row height and gap, px. One row holds a label, an input and a line of help. */
const ROW_HEIGHT = 84;
const GAP = 12;

const sectionsOf = (page: Page) => (page.layout as SectionsNode).children.filter((n): n is SectionNode => n.type === 'section');
const fieldNodes = (section: SectionNode) => section.children.filter((n): n is FieldNode => n.type === 'field');

function findField(page: Page, id: string): { node: FieldNode; section: SectionNode } | null {
  for (const section of sectionsOf(page)) {
    const node = fieldNodes(section).find((n) => n.id === id);
    if (node) return { node, section };
  }
  return null;
}

export function mountScreenEditor(host: HTMLElement, options: ScreenEditorOptions): ScreenEditorHandle {
  const { designer, grafloria } = options;
  const doc = host.ownerDocument;
  installStyles(doc);
  installDesignerStyles(doc);
  const el = elementFactory(doc);
  const skin = options.skin ?? 'outlined';
  let current = designer.getPage();

  const root = el('div', { class: 'fd-form fd-designer fd-screen-designer', 'data-fd-skin': skin });
  const previewToggle = el('button', { type: 'button', class: 'fd-button', 'aria-pressed': 'false' }, 'Preview');
  const bar = designerBar(root, designer, { titleLabel: 'Screen title', placeholder: 'Untitled screen', extra: [previewToggle] });

  const palette = el('aside', { class: 'fd-palette', 'aria-label': 'Add a field' }, el('div', { class: 'fd-panel-title' }, 'Add a field'));
  for (const kind of QUESTION_KINDS) {
    const item = el('button', { type: 'button', class: 'fd-palette-item', 'data-kind': kind.id }, kind.label);
    item.addEventListener('click', () => addField(kind.id));
    palette.append(item);
  }
  const sectionsBox = el('div', { class: 'fd-canvas-sections' });
  const addSection = el('button', { type: 'button', class: 'fd-button' }, 'Add section');
  addSection.addEventListener('click', () => {
    const created = designer.addContainer(`Section ${sectionsOf(designer.getPage()).length + 1}`);
    if (created) designer.select(created);
  });
  const canvas = el('div', { class: 'fd-canvas' }, sectionsBox, addSection);
  const properties = el('aside', { class: 'fd-properties', 'aria-label': 'Properties' });
  const body = el('div', { class: 'fd-screen-body' }, palette, canvas, properties);
  const previewHost = el('div', { class: 'fd-screen-preview', hidden: '' });
  root.append(bar.element, bar.issues, body, previewHost);

  // ---- adding ----------------------------------------------------------------
  let focusLabel = false;
  /** The section a new field goes into: the selected one, the selected field's, or the last. */
  function targetSection(page: Page): string {
    const selected = designer.getState().selected;
    const all = sectionsOf(page);
    const owner = all.find((s) => s.id === selected || s.children.some((n) => n.id === selected));
    return (owner ?? all[all.length - 1]).id;
  }
  function addField(kind: string) {
    focusLabel = true;
    if (!designer.addQuestion(kind, { parent: targetSection(designer.getPage()) })) focusLabel = false;
    render(designer.getState());
  }

  // ---- cards -------------------------------------------------------------------
  const widgets = new Map<string, Widget>();
  const cards = new Map<string, HTMLElement>();
  let preview: { page: Page; form: Form } | null = null;
  const formFor = (page: Page) => (preview?.page === page ? preview.form : (preview = { page, form: createForm({ page }) }).form);

  /** Draw a field the way the viewer will, but inert: on the canvas a card is moved, not typed in. */
  function paint(nodeId: string, cell: HTMLElement) {
    widgets.get(nodeId)?.destroy?.();
    widgets.delete(nodeId);
    cell.replaceChildren();
    const found = findField(current, nodeId);
    if (!found) return;
    const { node } = found;
    const def = current.fields[node.field];
    const form = formFor(current);
    const id = `fd-canvas-${nodeId}`;
    const widget = createWidget({ form, name: node.field, field: def, node, id, document: doc });
    widget.update({ value: form.getState().values[node.field], values: form.getState().values, readonly: false, required: def.required === true, invalid: false });
    const helpText = node.help ?? def.help;
    const card = el(
      'div',
      { class: 'fd-field fd-canvas-field', 'data-node': nodeId, 'data-type': def.type, inert: '' },
      el('label', { class: 'fd-label', for: id }, node.label ?? def.label),
      widget.element,
      ...(helpText ? [el('div', { class: 'fd-help' }, helpText)] : [])
    );
    card.classList.toggle('fd-required', def.required === true);
    card.classList.toggle('fd-canvas-selected', designer.getState().selected === nodeId);
    cell.append(card);
    widgets.set(nodeId, widget);
    cards.set(nodeId, card);
  }

  // ---- sections and their boards ---------------------------------------------------
  interface SectionView {
    element: HTMLElement;
    title: HTMLButtonElement;
    meta: HTMLElement;
    boardHost: HTMLElement;
    empty: HTMLElement;
    board: { handle: GrafloriaBoardHandle; diagram: { dispose?(): void } | null | undefined | void } | null;
    /** What the board was built from; a different one means build it again. */
    layoutKey: string;
    /** What each card shows; a different one means paint that card again. */
    painted: Map<string, string>;
  }
  const sectionViews = new Map<string, SectionView>();
  /** Inside a board's own callback: rebuilding it there would pull it down mid-gesture. */
  let inGesture = false;
  let selecting = false;
  let deferred: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(deferred);
    deferred = setTimeout(() => render(designer.getState()), 0);
  };

  function makeSection(id: string): SectionView {
    const title = el('button', { type: 'button', class: 'fd-canvas-section-title' });
    const meta = el('span', { class: 'fd-canvas-section-meta' });
    title.addEventListener('click', () => designer.select(id));
    const boardHost = el('div', { class: 'fd-canvas-board' });
    const empty = el('div', { class: 'fd-canvas-empty' }, 'No fields in this section yet. Add one from the list.');
    const element = el('section', { class: 'fd-canvas-section', 'data-node': id }, el('header', { class: 'fd-canvas-section-head' }, title, meta), boardHost, empty);
    return { element, title, meta, boardHost, empty, board: null, layoutKey: '', painted: new Map() };
  }

  function disposeBoard(view: SectionView) {
    if (!view.board) return;
    for (const id of view.painted.keys()) {
      widgets.get(id)?.destroy?.();
      widgets.delete(id);
      cards.delete(id);
    }
    view.board.handle.dispose();
    view.board.diagram?.dispose?.();
    view.board = null;
    view.boardHost.replaceChildren();
  }

  const layoutKeyOf = (page: Page, section: SectionNode) =>
    JSON.stringify([section.columns ?? 1, fieldNodes(section).map((n) => [n.id, n.colspan ?? 1, rowsOf(page.fields[n.field], n)])]);
  const contentKeyOf = (page: Page, node: FieldNode) => JSON.stringify([node, page.fields[node.field]]);

  function buildBoard(view: SectionView, page: Page, section: SectionNode) {
    disposeBoard(view);
    view.painted = new Map();
    const nodes = fieldNodes(section);
    view.empty.hidden = nodes.length > 0;
    view.boardHost.hidden = nodes.length === 0;
    if (!nodes.length) return;
    const columns = section.columns ?? 1;
    const items = nodes.map((n) => ({ id: n.id, span: n.colspan ?? 1, rows: rowsOf(page.fields[n.field], n) }));
    const cells = flowCells(items, columns);
    const boardWidgets: GrafloriaWidget[] = nodes.map((n) => {
      const cell = cells.get(n.id) as { x: number; y: number; w: number; h: number };
      return { id: n.id, kind: 'field', x: cell.x, y: cell.y, span: cell.w, rows: cell.h, limits: { minRows: cell.h, maxRows: cell.h }, title: n.label ?? page.fields[n.field].label };
    });
    const rows = Math.max(...boardWidgets.map((w) => (w.y ?? 0) + (w.rows ?? 1)));
    view.boardHost.style.height = `${rows * ROW_HEIGHT + (rows + 1) * GAP}px`;
    for (const n of nodes) view.painted.set(n.id, contentKeyOf(page, n));
    const sectionId = section.id;
    const spec = grafloria.dashboard({
      columns,
      sizing: 'grow',
      rowHeight: ROW_HEIGHT,
      gap: GAP,
      float: true,
      widgets: boardWidgets,
      renderWidget: (widget, cell) => paint(widget.id, cell),
      onLayoutChange: (_view, changed) => arranged(sectionId, changed),
      onSelect: (id) => {
        if (!selecting && designer.getState().selected !== (id ?? sectionId)) designer.select(id ?? sectionId);
      },
      binder: { dragOut: 'cancel' },
    });
    selecting = true;
    try {
      view.board = { handle: spec.handle, diagram: grafloria.render(spec, view.boardHost) };
    } finally {
      selecting = false;
    }
  }

  /** A gesture ended: read the board back into the page, then lay the board out again from it. */
  function arranged(sectionId: string, changed: GrafloriaWidget[]) {
    const items = orderFromCells(changed);
    const section = sectionsOf(designer.getPage()).find((s) => s.id === sectionId);
    const before = section ? fieldNodes(section).map((n) => ({ id: n.id, colspan: n.colspan ?? 1 })) : [];
    inGesture = true;
    try {
      if (JSON.stringify(items) !== JSON.stringify(before)) designer.arrangeSection(sectionId, items);
    } finally {
      inGesture = false;
    }
    const view = sectionViews.get(sectionId);
    if (view) view.layoutKey = '';
    later();
  }

  function syncBoards(page: Page) {
    for (const section of sectionsOf(page)) {
      const view = sectionViews.get(section.id) as SectionView;
      const key = layoutKeyOf(page, section);
      if (key !== view.layoutKey) {
        buildBoard(view, page, section);
        view.layoutKey = key;
        continue;
      }
      for (const node of fieldNodes(section)) {
        const content = contentKeyOf(page, node);
        if (view.painted.get(node.id) === content) continue;
        view.painted.set(node.id, content);
        view.board?.handle.widget(node.id)?.repaint();
      }
    }
  }

  function syncSelection(state: DesignerState) {
    for (const [id, view] of sectionViews) {
      view.element.classList.toggle('fd-canvas-selected', state.selected === id);
      if (!view.board) continue;
      const section = sectionsOf(state.page).find((s) => s.id === id);
      const wanted = section && fieldNodes(section).some((n) => n.id === state.selected) ? (state.selected as string) : undefined;
      if (view.board.handle.getSelectedWidget() === wanted) continue;
      selecting = true;
      try {
        view.board.handle.selectWidget(wanted);
      } finally {
        selecting = false;
      }
    }
    for (const [id, card] of cards) card.classList.toggle('fd-canvas-selected', state.selected === id);
  }

  // ---- properties ------------------------------------------------------------------
  let propertiesKey = '';
  let updateProperties: ((page: Page) => void) | null = null;

  function renderProperties(state: DesignerState) {
    const selected = state.selected;
    const isField = selected !== null && findField(state.page, selected) !== null;
    const isSection = selected !== null && sectionsOf(state.page).some((s) => s.id === selected);
    const key = isField ? `field:${selected}` : isSection ? `section:${selected}` : 'none';
    if (key !== propertiesKey) {
      propertiesKey = key;
      const built = isField
        ? fieldProperties(el, designer, selected as string)
        : isSection
          ? sectionProperties(el, designer, selected as string)
          : { element: el('p', { class: 'fd-properties-hint' }, 'Select a field or a section to change it.'), update: () => undefined };
      properties.replaceChildren(el('div', { class: 'fd-panel-title' }, isField ? 'Field' : isSection ? 'Section' : 'Properties'), built.element);
      updateProperties = built.update;
    }
    updateProperties?.(state.page);
    if (focusLabel && isField) {
      const label = properties.querySelector<HTMLInputElement>('.fd-prop-label');
      // Select the placeholder text, so typing replaces it rather than adding to it.
      label?.focus();
      label?.select();
      focusLabel = false;
    }
  }

  // ---- preview ----------------------------------------------------------------------
  let previewing = false;
  let viewer: ViewerHandle | null = null;
  function showPreview() {
    previewToggle.setAttribute('aria-pressed', String(previewing));
    body.hidden = previewing;
    previewHost.hidden = !previewing;
    viewer?.destroy();
    viewer = null;
    previewHost.replaceChildren();
    if (previewing) {
      viewer = mountViewer(previewHost, { page: designer.getPage(), dataSource: createMemoryDataSource(), skin });
    } else {
      // The boards were laid out while hidden; measure them again.
      for (const view of sectionViews.values()) view.layoutKey = '';
      render(designer.getState());
    }
  }
  previewToggle.addEventListener('click', () => {
    previewing = !previewing;
    showPreview();
  });

  // ---- render ---------------------------------------------------------------------------
  function render(state: DesignerState) {
    current = state.page;
    bar.update(state);
    const sections = sectionsOf(state.page);
    const live = new Set(sections.map((s) => s.id));
    for (const [id, view] of sectionViews) {
      if (live.has(id)) continue;
      disposeBoard(view);
      view.element.remove();
      sectionViews.delete(id);
    }
    sections.forEach((section, index) => {
      let view = sectionViews.get(section.id);
      if (!view) sectionViews.set(section.id, (view = makeSection(section.id)));
      if (sectionsBox.children[index] !== view.element) sectionsBox.insertBefore(view.element, sectionsBox.children[index] ?? null);
      view.title.textContent = section.title || 'Untitled section';
      const columns = section.columns ?? 1;
      view.meta.textContent = columns === 1 ? '1 column' : `${columns} columns`;
    });
    if (inGesture) later();
    else if (!previewing) syncBoards(state.page);
    syncSelection(state);
    renderProperties(state);
  }

  host.append(root);
  const leave = designer.subscribe(render);
  render(designer.getState());

  return {
    element: root,
    destroy() {
      leave();
      bar.destroy();
      clearTimeout(deferred);
      for (const view of sectionViews.values()) disposeBoard(view);
      sectionViews.clear();
      viewer?.destroy();
      root.remove();
    },
  };
}

// ---- the properties panel ----------------------------------------------------------------

interface PropertiesView {
  element: HTMLElement;
  update(page: Page): void;
}

function prop(el: ElementFactory, text: string, control: HTMLElement): HTMLElement {
  return el('label', { class: 'fd-prop' }, el('span', { class: 'fd-prop-name' }, text), control);
}

function fieldProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const label = el('input', { class: 'fd-input fd-prop-label', 'aria-label': 'Label' });
  label.addEventListener('input', () => designer.updateQuestion(id, { label: label.value }));
  const kind = el('select', { class: 'fd-input fd-select', 'aria-label': 'Kind of field' });
  for (const k of QUESTION_KINDS) kind.append(el('option', { value: k.id }, k.label));
  kind.addEventListener('change', () => designer.changeKind(id, kind.value));
  const options = optionsEditor(el, designer, id);
  const required = el('input', { type: 'checkbox', 'aria-label': 'Required' });
  required.addEventListener('change', () => designer.updateQuestion(id, { required: required.checked }));
  const help = el('input', { class: 'fd-input', 'aria-label': 'Help text', placeholder: 'Optional' });
  help.addEventListener('input', () => designer.updateQuestion(id, { help: help.value }));
  const width = el('select', { class: 'fd-input fd-select', 'aria-label': 'Width' });
  width.addEventListener('change', () => designer.setColspan(id, Number(width.value)));
  const section = el('select', { class: 'fd-input fd-select', 'aria-label': 'Section' });
  section.addEventListener('change', () => {
    const target = sectionsOf(designer.getPage()).find((s) => s.id === section.value);
    if (target) designer.placeNode(id, target.id, target.children.length);
  });
  const duplicate = el('button', { type: 'button', class: 'fd-button' }, 'Duplicate');
  duplicate.addEventListener('click', () => {
    const copy = designer.duplicateNode(id);
    if (copy) designer.select(copy);
  });
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete field');
  remove.addEventListener('click', () => designer.removeNode(id));
  const widthRow = prop(el, 'Width', width);
  const element = el(
    'div',
    { class: 'fd-props' },
    prop(el, 'Label', label),
    prop(el, 'Kind', kind),
    options.element,
    el('label', { class: 'fd-q-required' }, required, el('span', {}, 'Required')),
    prop(el, 'Help text', help),
    widthRow,
    prop(el, 'Section', section),
    el('div', { class: 'fd-props-actions' }, duplicate, remove)
  );

  return {
    element,
    update(page) {
      const found = findField(page, id);
      if (!found) return;
      const def = page.fields[found.node.field];
      if (!focused(label)) label.value = found.node.label ?? def.label;
      const current = kindOfQuestion(def, found.node);
      kind.value = current ?? '';
      kind.disabled = current === null;
      options.update(def);
      required.checked = def.required === true;
      if (!focused(help)) help.value = found.node.help ?? def.help ?? '';
      const columns = found.section.columns ?? 1;
      widthRow.hidden = columns === 1;
      if (width.options.length !== columns) {
        width.replaceChildren(
          ...Array.from({ length: columns }, (_, i) => {
            const n = i + 1;
            const text = n === 1 ? '1 column' : `${n} columns${n === columns ? ' (full width)' : ''}`;
            return el('option', { value: String(n) }, text);
          })
        );
      }
      width.value = String(Math.min(found.node.colspan ?? 1, columns));
      section.replaceChildren(...sectionsOf(page).map((s) => el('option', { value: s.id }, s.title || 'Untitled section')));
      section.value = found.section.id;
    },
  };
}

function sectionProperties(el: ElementFactory, designer: Designer, id: string): PropertiesView {
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const title = el('input', { class: 'fd-input', 'aria-label': 'Section title' });
  title.addEventListener('input', () => designer.renameContainer(id, title.value));
  const columns = el('select', { class: 'fd-input fd-select', 'aria-label': 'Columns' });
  for (const n of [1, 2, 3, 4]) columns.append(el('option', { value: String(n) }, String(n)));
  columns.addEventListener('change', () => designer.setColumns(id, Number(columns.value) as 1 | 2 | 3 | 4));
  const remove = el('button', { type: 'button', class: 'fd-button fd-button-danger' }, 'Delete section');
  remove.addEventListener('click', () => designer.removeNode(id));
  const element = el('div', { class: 'fd-props' }, prop(el, 'Title', title), prop(el, 'Columns', columns), el('div', { class: 'fd-props-actions' }, remove));
  return {
    element,
    update(page) {
      const section = sectionsOf(page).find((s) => s.id === id);
      if (!section) return;
      if (!focused(title)) title.value = section.title ?? '';
      columns.value = String(section.columns ?? 1);
      remove.hidden = sectionsOf(page).length === 1;
    },
  };
}
