import { createForm, createMemoryDataSource, wideColumns, type FieldNode, type Form, type LayoutNode, type Page, type SectionNode, type TabsNode } from '@fieldia/core';
import { mountViewer, type Skin, type ViewerHandle } from '@fieldia/viewer';
import { createWidget, installStyles, type Widget } from '@fieldia/widgets';
import { designerBar, elementFactory } from './chrome';
import type { Designer, DesignerState } from './designer';
import type { Grafloria, GrafloriaBoardHandle, GrafloriaWidget } from './grafloria';
import { allSections, findField, findTab, tabHolds } from './page-tree';
import { flowCells, GAP, heightOfRows, orderFromCells, ROW_HEIGHT, rowsForHeight, rowsOf } from './screen-layout';
import { sectionDrag } from './section-drag';
import { fieldProperties, pageProperties, paletteGroups, sectionProperties, tabProperties, tabsProperties, type PropertiesView } from './screen-properties';
import { installDesignerStyles } from './styles';

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

/** Rows left empty at the end of a section: about one field. */
const SPARE_ROWS = 5;

/** How far a card's content reaches, padding included — what it needs, whatever box it was given. */
function contentHeight(card: HTMLElement): number {
  const top = card.getBoundingClientRect().top;
  let bottom = top;
  for (const child of card.children) bottom = Math.max(bottom, child.getBoundingClientRect().bottom);
  const style = card.ownerDocument.defaultView?.getComputedStyle(card);
  return bottom - top + (parseFloat(style?.paddingBottom ?? '') || 0) + (parseFloat(style?.borderBottomWidth ?? '') || 0);
}

const sectionsOf = allSections;
const fieldNodes = (section: SectionNode) => section.children.filter((n): n is FieldNode => n.type === 'field');
/** What sits at the top of a screen or a sheet: sections, and a sheet's tabs. */
const topOf = (page: Page) => (page.layout as { children: LayoutNode[] }).children;

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
  for (const [title, kinds] of paletteGroups()) {
    palette.append(el('div', { class: 'fd-palette-heading' }, title));
    for (const kind of kinds) {
      const item = el('button', { type: 'button', class: 'fd-palette-item', 'data-kind': kind.id }, kind.label);
      item.addEventListener('click', () => addField(kind.id));
      palette.append(item);
    }
  }
  const sectionsBox = el('div', { class: 'fd-canvas-sections' });
  const addSection = el('button', { type: 'button', class: 'fd-button' }, 'Add section');
  addSection.addEventListener('click', () => {
    const created = designer.addContainer(`Section ${sectionsOf(designer.getPage()).length + 1}`);
    if (created) designer.select(created);
  });
  const addTabs = el('button', { type: 'button', class: 'fd-button', hidden: '' }, 'Add tabs');
  addTabs.addEventListener('click', () => {
    const created = designer.addTabs();
    const tabs = created ? (topOf(designer.getPage()).find((n) => n.id === created) as TabsNode) : null;
    if (tabs) designer.select(tabs.children[0].id);
  });
  // A sheet's title, as people will see it: big, over everything else.
  const titleCard = el('button', { type: 'button', class: 'fd-canvas-title', hidden: '' });
  titleCard.addEventListener('click', () => designer.select(null));
  const canvas = el('div', { class: 'fd-canvas' }, titleCard, sectionsBox, el('div', { class: 'fd-canvas-adds' }, addSection, addTabs));
  const properties = el('aside', { class: 'fd-properties', 'aria-label': 'Properties' });
  // A card dragged onto another section moves there.
  const crossing = sectionDrag({
    canvas,
    move: (id, section, index) => {
      if (designer.placeNode(id, section, index)) designer.select(id);
    },
  });
  const body = el('div', { class: 'fd-screen-body' }, palette, canvas, properties);
  const previewHost = el('div', { class: 'fd-screen-preview', hidden: '' });
  root.append(bar.element, bar.issues, body, previewHost);

  // ---- adding ----------------------------------------------------------------
  /** The field just added, whose label takes the cursor once its properties show. */
  let focusLabelOf: string | null = null;
  /** The section a new field goes into: the selected one, the selected field's, the selected tab's first, or the last on show. */
  function targetSection(page: Page): string {
    const selected = designer.getState().selected;
    const all = sectionsOf(page);
    const owner = all.find((s) => s.id === selected || s.children.some((n) => n.id === selected));
    const tab = selected ? findTab(page, selected) : null;
    const inTab = tab?.tab.children.find((n): n is SectionNode => n.type === 'section');
    return (owner ?? inTab ?? visible[visible.length - 1] ?? all[all.length - 1]).id;
  }
  function addField(kind: string) {
    // Not before it exists: the edit's first notice still shows the field selected before it.
    const created = designer.addQuestion(kind, { parent: targetSection(designer.getPage()) });
    if (!created) return;
    focusLabelOf = created;
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
  /**
   * Rows each card turned out to need once drawn: its real widget, at its
   * real width, with its help text. A guess per kind cannot know that a
   * scale wraps in a narrow column, so the canvas measures and grows.
   */
  const measured = new Map<string, number>();
  const rowsFor = (page: Page, node: FieldNode) => Math.max(rowsOf(page.fields[node.field], node), measured.get(node.id) ?? 1);
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
    JSON.stringify([section.columns ?? 1, fieldNodes(section).map((n) => [n.id, n.colspan ?? 1, rowsFor(page, n)])]);
  const contentKeyOf = (page: Page, node: FieldNode) => JSON.stringify([node, page.fields[node.field]]);

  function buildBoard(view: SectionView, page: Page, section: SectionNode) {
    disposeBoard(view);
    view.painted = new Map();
    const nodes = fieldNodes(section);
    view.empty.hidden = nodes.length > 0;
    view.boardHost.hidden = nodes.length === 0;
    if (!nodes.length) return;
    const columns = wideColumns(section.columns);
    const items = nodes.map((n) => ({ id: n.id, span: n.colspan ?? 1, rows: rowsFor(page, n) }));
    const cells = flowCells(items, columns);
    const boardWidgets: GrafloriaWidget[] = nodes.map((n) => {
      const cell = cells.get(n.id) as { x: number; y: number; w: number; h: number };
      return { id: n.id, kind: 'field', x: cell.x, y: cell.y, span: cell.w, rows: cell.h, limits: { minRows: cell.h, maxRows: cell.h }, title: n.label ?? page.fields[n.field].label };
    });
    // One spare row at the end: somewhere to drop a field last, and room for
    // the cards a gesture pushes down before the section grows to hold them.
    const rows = Math.max(...boardWidgets.map((w) => (w.y ?? 0) + (w.rows ?? 1))) + SPARE_ROWS;
    view.boardHost.style.height = `${heightOfRows(rows) + 2 * GAP}px`;
    view.boardHost.style.setProperty('--fd-spare-height', `${heightOfRows(SPARE_ROWS)}px`);
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
    measureSoon();
  }

  let measureTimer: ReturnType<typeof setTimeout> | undefined;
  function measureSoon() {
    clearTimeout(measureTimer);
    measureTimer = setTimeout(measure, 30);
  }
  /** Give every card the rows its content needs; lay out again if any changed. */
  function measure() {
    if (previewing) return;
    let changed = false;
    for (const [id, card] of cards) {
      if (!card.isConnected) continue;
      const rows = rowsForHeight(contentHeight(card));
      if ((measured.get(id) ?? 1) === rows) continue;
      measured.set(id, rows);
      changed = true;
    }
    if (changed) render(designer.getState());
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

  /** Boards for the sections on show; a section in a closed tab has none until its tab opens. */
  function syncBoards(page: Page) {
    const open = new Set(visible.map((section) => section.id));
    for (const [id, view] of sectionViews) {
      if (open.has(id) || !view.board) continue;
      disposeBoard(view);
      view.layoutKey = '';
    }
    for (const section of visible) {
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
        measureSoon();
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
    const page = state.page;
    const isField = selected !== null && findField(page, selected) !== null;
    const kind = isField
      ? 'field'
      : selected !== null && sectionsOf(page).some((s) => s.id === selected)
        ? 'section'
        : selected !== null && findTab(page, selected)
          ? 'tab'
          : selected !== null && topOf(page).some((n) => n.id === selected && n.type === 'tabs')
            ? 'tabs'
            : 'page';
    const key = kind === 'page' ? kind : `${kind}:${selected}`;
    if (key !== propertiesKey) {
      propertiesKey = key;
      const id = selected as string;
      const panels: Record<typeof kind, [string, () => PropertiesView]> = {
        field: ['Field', () => fieldProperties(el, designer, id)],
        section: ['Section', () => sectionProperties(el, designer, id)],
        tab: ['Tab', () => tabProperties(el, designer, id)],
        tabs: ['Tabs', () => tabsProperties(el, designer, id)],
        page: ['Screen', () => pageProperties(el, designer)],
      };
      const [title, build] = panels[kind];
      const built = build();
      properties.replaceChildren(el('div', { class: 'fd-panel-title' }, title), built.element);
      updateProperties = built.update;
    }
    updateProperties?.(page);
    if (focusLabelOf && focusLabelOf === selected && isField) {
      const label = properties.querySelector<HTMLInputElement>('.fd-prop-label');
      // Select the placeholder text, so typing replaces it rather than adding to it.
      label?.focus();
      label?.select();
      focusLabelOf = null;
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

  // ---- tabs ----------------------------------------------------------------------------
  interface TabsView {
    element: HTMLElement;
    strip: HTMLElement;
    panel: HTMLElement;
    /** The tab on show. */
    active: string | null;
  }
  const tabsViews = new Map<string, TabsView>();

  function makeTabs(id: string): TabsView {
    const strip = el('div', { class: 'fd-canvas-tab-strip', role: 'tablist' });
    const addTab = el('button', { type: 'button', class: 'fd-canvas-add-tab', 'aria-label': 'Add tab' }, '+');
    const head = el('div', { class: 'fd-canvas-tabs-head' }, strip, addTab);
    const panel = el('div', { class: 'fd-canvas-tab-panel', role: 'tabpanel' });
    const element = el('div', { class: 'fd-canvas-tabs', 'data-node': id }, head, panel);
    const view: TabsView = { element, strip, panel, active: null };
    addTab.addEventListener('click', () => {
      const tabs = topOf(designer.getPage()).find((n) => n.id === id) as TabsNode | undefined;
      const created = tabs && designer.addTab(id, `Tab ${tabs.children.length + 1}`);
      if (!created) return;
      view.active = created;
      designer.select(created);
    });
    // The strip's empty space selects the tabs as a whole.
    head.addEventListener('click', (event) => {
      if (event.target === head || event.target === strip) designer.select(id);
    });
    return view;
  }

  /** The tabs on the canvas: a strip, and the sections of the tab on show; the tab of what is selected opens. */
  function drawTabs(node: TabsNode, state: DesignerState, sectionElement: (section: SectionNode) => HTMLElement): HTMLElement {
    let view = tabsViews.get(node.id);
    if (!view) tabsViews.set(node.id, (view = makeTabs(node.id)));
    const holding = node.children.find((tab) => tabHolds(tab, state.selected));
    if (holding) view.active = holding.id;
    if (!node.children.some((tab) => tab.id === view.active)) view.active = node.children[0]?.id ?? null;
    const shownView = view;
    view.strip.replaceChildren(
      ...node.children.map((tab) => {
        const button = el('button', { type: 'button', role: 'tab', class: 'fd-canvas-tab', 'data-node': tab.id, 'aria-selected': String(tab.id === shownView.active) }, tab.label || 'Untitled tab');
        button.classList.toggle('fd-canvas-selected', state.selected === tab.id);
        button.addEventListener('click', () => {
          shownView.active = tab.id;
          designer.select(tab.id);
        });
        return button;
      })
    );
    view.element.classList.toggle('fd-canvas-selected', state.selected === node.id);
    const open = node.children.find((tab) => tab.id === view.active);
    const sections = (open?.children ?? []).filter((n): n is SectionNode => n.type === 'section');
    const children = sections.map(sectionElement);
    if (children.length !== view.panel.children.length || children.some((child, i) => view.panel.children[i] !== child)) view.panel.replaceChildren(...children);
    return view.element;
  }

  // ---- render ---------------------------------------------------------------------------
  /** The sections on show: at the top, and in the open tab of each set of tabs. */
  let visible: SectionNode[] = [];

  function render(state: DesignerState) {
    current = state.page;
    bar.update(state);
    const page = state.page;
    const sections = sectionsOf(page);
    const live = new Set(sections.map((s) => s.id));
    for (const [id, view] of sectionViews) {
      if (live.has(id)) continue;
      disposeBoard(view);
      view.element.remove();
      sectionViews.delete(id);
    }
    const liveTabs = new Set(topOf(page).filter((n) => n.type === 'tabs').map((n) => n.id));
    for (const [id, view] of tabsViews) {
      if (liveTabs.has(id)) continue;
      view.element.remove();
      tabsViews.delete(id);
    }
    visible = [];
    const sectionElement = (section: SectionNode) => {
      let view = sectionViews.get(section.id);
      if (!view) sectionViews.set(section.id, (view = makeSection(section.id)));
      view.title.textContent = section.title || 'Untitled section';
      const columns = section.columns ?? 1;
      view.meta.textContent = columns === 1 ? '1 column' : `${columns} columns`;
      visible.push(section);
      return view.element;
    };
    const top = topOf(page).flatMap((node) => (node.type === 'section' ? [sectionElement(node)] : node.type === 'tabs' ? [drawTabs(node, state, sectionElement)] : []));
    // Sections of closed tabs leave the canvas until their tab opens.
    for (const [id, view] of sectionViews) if (!visible.some((s) => s.id === id)) view.element.remove();
    top.forEach((element, index) => {
      if (sectionsBox.children[index] !== element) sectionsBox.insertBefore(element, sectionsBox.children[index] ?? null);
    });
    while (sectionsBox.children.length > top.length) sectionsBox.lastElementChild?.remove();
    const root = page.layout;
    // One set of tabs to a sheet, as a record has.
    addTabs.hidden = root.type !== 'sheet' || liveTabs.size > 0;
    titleCard.hidden = root.type !== 'sheet' || !root.title;
    if (root.type === 'sheet' && root.title) titleCard.textContent = page.fields[root.title.field]?.label ?? root.title.field;
    titleCard.classList.toggle('fd-canvas-selected', state.selected === null);
    if (inGesture) later();
    else if (!previewing) syncBoards(page);
    syncSelection(state);
    renderProperties(state);
  }

  host.append(root);
  const leave = designer.subscribe(render);
  render(designer.getState());
  // A narrower canvas wraps a card's content onto more lines.
  const View = doc.defaultView as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
  const resized = View?.ResizeObserver ? new View.ResizeObserver(() => measureSoon()) : null;
  resized?.observe(canvas);

  return {
    element: root,
    destroy() {
      leave();
      bar.destroy();
      clearTimeout(deferred);
      clearTimeout(measureTimer);
      resized?.disconnect();
      crossing.destroy();
      for (const view of sectionViews.values()) disposeBoard(view);
      sectionViews.clear();
      viewer?.destroy();
      root.remove();
    },
  };
}
