import { createForm, type FieldNode, type Form, type LayoutNode, type Page, type SectionNode, type TabsNode } from '@fieldia/core';
import { applyLook, labelPlace, planSection, type Place } from '@fieldia/viewer';
import { createWidget, type Widget, type WidgetFactory } from '@fieldia/widgets';
import { advancedDrag } from './canvas-advanced';
import { blockViews } from './canvas-blocks';
import { canvasDrag, type CanvasDrag } from './canvas-drag';
import { canvasHeader } from './canvas-header';
import { canvasKeys, type CanvasKeys } from './canvas-keys';
import { lockWords, type DesignerMode } from './canvas-mode';
import { columnsAt, readSize, sizeSwitch, writeSize, type ScreenSize } from './canvas-size';
import { multiBar } from './canvas-multi';
import { canvasGuides } from './canvas-guides';
import { widthMarks } from './canvas-width';
import { elementFactory, optionsEditor, type OptionsEditor } from './chrome';
import type { Designer, DesignerState } from './designer';
import { fieldBar, type FieldBar } from './field-bar';
import { designerIcon } from './icons';
import { inlineSettings, type InlineSettings } from './inline-settings';
import { locate } from './layout-tree';
import { ruleMarks } from './rules-marks';
import { tabHolds } from './page-tree';
import { sampleRows } from './samples';

/**
 * The screen editor's canvas: the page drawn the way the viewer draws it —
 * its sections in the viewer's grid, each field with its real widget, the
 * sheet's tabs as tabs — and edited where it stands. The field picked opens
 * in place: its label and help become boxes to type in, a choice's options
 * become a list to type, and a bar on its edge does the rest. Nothing around
 * it moves, so what is seen is what people will get.
 *
 * Groups inside groups, arrangements laying parts on their grid's columns,
 * each group's style, where labels sit, tabs anywhere and the blocks between
 * fields are drawn with the viewer's own elements and placed by its own rules
 * (`planSection`, `labelPlace`), and the canvas wears the page's look as the
 * form does — so the canvas and the form agree to the pixel.
 *
 * Everything is keyed by id and patched in place, so the box being typed in
 * stays the same box, focused, while the page changes around it.
 */

export interface ScreenCanvasOptions {
  designer: Designer;
  doc: Document;
  /** The skin the form is drawn in: the canvas wears its tokens, as the form does. */
  skin?: string;
  /** Open the panel at a part of the field picked: its settings, or when it shows. */
  more(part: 'field' | 'when'): void;
  /** Simple mode's note on an arrangement was asked to open Advanced. */
  openAdvanced?(): void;
  /** Something from the toolbox was let go over a section, at a place among its fields. */
  dropTool(spec: string, section: string, index: number): void;
  /** The app's own widgets, by `type` or `type.widget`. */
  widgets?: Record<string, WidgetFactory>;
}

export interface ScreenCanvas {
  element: HTMLElement;
  drag: CanvasDrag;
  /** Advanced's keys: moves said aloud, and the help that lists them. */
  keys: CanvasKeys;
  update(state: DesignerState): void;
  /** The sections on show, in order: at the top, and in the open tab of each set of tabs. */
  visibleSections(): string[];
  /** Put the cursor in a field's label or help on the canvas; every word of it selected, for a field just added. */
  focus(id: string, part: 'label' | 'help', selectAll?: boolean): void;
  /** Put the cursor in a section's title on the canvas, every word selected. */
  focusTitle(id: string): void;
  /** Put the cursor in the words of a part of a sheet's header, every word selected. */
  focusPart(id: string): void;
  /** Fill the page with the made-up record at `index`, or with nothing: drawn at the next update. */
  setSample(index: number | null): void;
  /** Simple or Advanced: drawn at the next update. */
  setMode(mode: DesignerMode): void;
  destroy(): void;
}

/** What sits at the top of a screen or a sheet: sections, a sheet's tabs, and fields and blocks of their own. */
const topOf = (page: Page) => (page.layout as { children: LayoutNode[] }).children;

export function screenCanvas(options: ScreenCanvasOptions): ScreenCanvas {
  const { designer, doc } = options;
  const el = elementFactory(doc);
  const titleCard = el('button', { type: 'button', class: 'fd-canvas-title', hidden: '' });
  titleCard.addEventListener('click', () => designer.select(null));
  const body = el('div', { class: 'fd-canvas-body' });
  const header = canvasHeader({ el, doc, designer });
  // Several picked, in Advanced: a bar at the top of the canvas, taking no room.
  const multi = multiBar({ el, doc, designer });
  const keys = canvasKeys({ el, designer, rtl: () => doc.defaultView?.getComputedStyle(element).direction === 'rtl' });
  // A form of its own, in the form's skin: its look and its widths are the page's, not the designer's.
  // The size of screen shown, chosen on the stage at the canvas's top, with the keys' help; Advanced only.
  let size: ScreenSize = readSize(doc.defaultView);
  const sizes = sizeSwitch(el, doc, size, (next) => {
    size = next;
    writeSize(doc.defaultView, next);
    sizes.set(next);
    api.update(designer.getState());
  });
  const stage = el('div', { class: 'fd-canvas-stage' }, sizes.element, keys.help);
  const element = el('div', { class: 'fd-canvas fd-form', 'data-fd-skin': options.skin ?? 'outlined' }, multi.element, stage, header.top, header.card, titleCard, body, keys.said);
  const blocks = blockViews({ el, doc, designer });
  let page = designer.getPage();
  let selected: string | null = null;
  let picked: string[] = [];
  let mode: DesignerMode = 'simple';
  /** The size shown: the one chosen, in Advanced; a desktop, in Simple. */
  const shownSize = (): ScreenSize => (mode === 'advanced' ? size : 'desktop');
  let visible: string[] = [];
  /** Every part drawn this time round, by id. */
  let drawnIds = new Set<string>();

  // The widgets are drawn from a form of the page, made again only when the page, or the record filling it, changes.
  let sample: number | null = null;
  let drawn: { page: Page; sample: number | null; form: Form } | null = null;
  const form = () => {
    if (drawn?.page === page && drawn.sample === sample) return drawn.form;
    const values = sample === null ? undefined : sampleRows(page.fields, Object.keys(page.fields), sample + 1)[sample];
    drawn = { page, sample, form: createForm({ page, values }) };
    return drawn.form;
  };

  // ---- fields ------------------------------------------------------------------
  interface Card {
    element: HTMLElement;
    editing: boolean;
    widgetBox: HTMLElement;
    widget: Widget | null;
    painted: string;
    label: HTMLElement;
    help: HTMLElement;
    bar: FieldBar | null;
    options: OptionsEditor | null;
    settings: InlineSettings | null;
  }
  const cards = new Map<string, Card>();

  function dropCard(card: Card) {
    card.widget?.destroy?.();
    card.element.remove();
  }

  /** Six dots beside a field, shown when it is pointed at or picked: what it is carried by. For the pointer only — the keys move it too — so no control of its own. */
  const gripOf = () => el('span', { class: 'fd-card-grip', 'data-grip': '', 'aria-hidden': 'true', title: 'Drag to move · Alt+↑ or ↓ moves it too' }, designerIcon(doc, 'grip'));

  function buildCard(id: string, editing: boolean, ownChoice: boolean): Card {
    const widgetBox = el('div', { class: 'fd-canvas-widget', inert: '' });
    if (!editing) {
      const label = el('label', { class: 'fd-label' });
      const help = el('div', { class: 'fd-help' });
      // Reached by Tab and picked by Enter or Space, as a click picks it (WCAG 2.1.1).
      const element = el('div', { class: 'fd-field fd-canvas-field', 'data-node': id, role: 'button', tabindex: '0' }, gripOf(), label, widgetBox, help);
      return { element, editing, widgetBox, widget: null, painted: '', label, help, bar: null, options: null, settings: null };
    }
    const bar = fieldBar({ el, doc, designer, id, more: options.more });
    const label = el('input', { class: 'fd-canvas-label-input', 'data-inline': 'label', 'aria-label': 'Label', autocomplete: 'off' });
    label.addEventListener('input', () => {
      sizeToWords(label as HTMLInputElement);
      designer.updateQuestion(id, { label: (label as HTMLInputElement).value });
    });
    const help = el('input', { class: 'fd-canvas-help-input fd-help', 'data-inline': 'help', 'aria-label': 'Help', placeholder: 'Add a line of help', autocomplete: 'off' });
    help.addEventListener('input', () => designer.updateQuestion(id, { help: (help as HTMLInputElement).value }));
    // Enter goes from the label to the help, and from the help out.
    label.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') {
        event.preventDefault();
        (help as HTMLInputElement).focus();
      }
    });
    help.addEventListener('keydown', (event) => {
      if ((event as KeyboardEvent).key === 'Enter') {
        event.preventDefault();
        (help as HTMLInputElement).blur();
      }
    });
    const choices = ownChoice ? optionsEditor(el, designer, id) : null;
    const settings = inlineSettings(el, designer, id);
    const element = el(
      'div',
      { class: 'fd-field fd-canvas-field fd-editing', 'data-node': id },
      gripOf(),
      bar.element,
      el('div', { class: 'fd-label fd-canvas-label-row' }, label),
      ...(choices ? [choices.element] : [widgetBox]),
      settings.element,
      help
    );
    return { element, editing, widgetBox, widget: null, painted: '', label, help, bar, options: choices, settings };
  }

  /** As wide as its words, so the required mark stays beside them. */
  function sizeToWords(input: HTMLInputElement) {
    input.size = Math.max(4, input.value.length + 1);
  }

  function drawCard(node: FieldNode, labels: Place['labels'], place: { index: number; underTabs: boolean; columns: number }): HTMLElement {
    const def = page.fields[node.field];
    const editing = selected === node.id;
    const ownChoice = def.type === 'selection' && !designer.isFromModel(node.id);
    let card = cards.get(node.id);
    if (card && (card.editing !== editing || (editing && !!card.options !== ownChoice))) {
      dropCard(card);
      card = undefined;
    }
    if (!card) cards.set(node.id, (card = buildCard(node.id, editing, ownChoice)));
    const element = card.element;
    element.dataset['type'] = def.type;
    const labelsAt = labelPlace(node, def.type, labels);
    if (labelsAt) element.dataset['labels'] = labelsAt;
    else delete element.dataset['labels'];
    element.classList.toggle('fd-canvas-picked', picked.includes(node.id) && picked.length > 1);
    if (node.colspan) element.style.setProperty('--fd-span', String(node.colspan));
    else element.style.removeProperty('--fd-span');
    element.classList.toggle('fd-required', def.required === true || node.required === true);
    element.classList.toggle('fd-hidden-sometimes', node.invisible !== undefined);
    const labelText = node.label ?? def.label;
    const helpText = node.help ?? def.help ?? '';
    if (card.editing) {
      const label = card.label as HTMLInputElement;
      const help = card.help as HTMLInputElement;
      if (doc.activeElement !== label) {
        label.value = labelText;
        sizeToWords(label);
      }
      if (doc.activeElement !== help) help.value = helpText;
      // Right under the tabs, the bar goes below the field, so it does not cover the tabs' names.
      element.classList.toggle('fd-bar-below', place.underTabs && place.index < place.columns);
      card.bar?.update(page);
      card.options?.update(def, node);
      // A table's columns, typed in, stand in for the table itself.
      card.widgetBox.hidden = card.settings?.update(page, node) === true;
    } else {
      card.label.textContent = labelText;
      card.help.textContent = helpText;
      card.help.hidden = !helpText;
    }
    if (!card.options) paint(card, node);
    return element;
  }

  /** The field's real widget, inert: on the canvas it is looked at and moved, not typed in. */
  function paint(card: Card, node: FieldNode) {
    const def = page.fields[node.field];
    const key = JSON.stringify([node, def, sample]);
    if (card.painted === key && card.widget) return;
    card.painted = key;
    card.widget?.destroy?.();
    const f = form();
    const widget = createWidget({ form: f, name: node.field, field: def, node, id: `fd-canvas-${node.id}`, document: doc }, options.widgets);
    widget.update({ value: f.getState().values[node.field], values: f.getState().values, readonly: false, required: def.required === true, invalid: false });
    card.widget = widget;
    card.widgetBox.replaceChildren(widget.element);
  }

  // ---- sections ----------------------------------------------------------------
  interface SectionView {
    element: HTMLElement;
    legend: HTMLElement;
    title: HTMLButtonElement;
    titleInput: HTMLInputElement;
    description: HTMLElement;
    grid: HTMLElement;
    empty: HTMLElement;
    lock: HTMLElement;
  }
  const sections = new Map<string, SectionView>();

  /** A group is a fieldset, named by its title; an arrangement is no group to name, and a fieldset cannot lay parts on the columns round it. */
  function makeSection(id: string, tag: 'fieldset' | 'div'): SectionView {
    const title = el('button', { type: 'button', class: 'fd-canvas-section-title' });
    const titleInput = el('input', { class: 'fd-canvas-section-title-input', 'aria-label': 'Section title', placeholder: 'Untitled section', autocomplete: 'off' });
    titleInput.addEventListener('input', () => designer.renameContainer(id, titleInput.value));
    titleInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') titleInput.blur();
    });
    title.addEventListener('click', () => {
      designer.select(id);
      titleInput.focus();
      titleInput.select();
    });
    const legend = el('legend', { class: 'fd-section-title' }, title, titleInput);
    const description = el('p', { class: 'fd-section-description', hidden: '' });
    const grid = el('div', { class: 'fd-grid', 'data-drop-grid': '', 'data-container': id });
    const empty = el('p', { class: 'fd-canvas-empty' }, 'Drop a field here, or pick one in the toolbox.');
    // Simple mode's word on an arrangement it keeps as Advanced laid it out.
    const advanced = el('button', { type: 'button', class: 'fd-button' }, 'Open in Advanced');
    advanced.addEventListener('click', () => options.openAdvanced?.());
    const lock = el('div', { class: 'fd-simple-lock', hidden: '' }, el('span', { class: 'fd-simple-lock-how' }), el('span', {}, 'Simple mode keeps it as it is. Edit what is inside by picking it.'), advanced);
    const element = el(tag, { class: 'fd-section fd-canvas-section', 'data-node': id, 'data-drop-section': id }, legend, description, grid, empty, lock);
    return { element, legend, title, titleInput, description, grid, empty, lock };
  }

  /** Where a part's colspan is, for the grid it sits in. */
  function span(element: HTMLElement, colspan: number | undefined) {
    if (colspan) element.style.setProperty('--fd-span', String(colspan));
    else element.style.removeProperty('--fd-span');
  }

  function drawSection(section: SectionNode, place: Place, underTabs: boolean): HTMLElement {
    const plan = planSection(section, place);
    const tag = plan.arrangement ? 'div' : 'fieldset';
    let view = sections.get(section.id);
    if (view && view.element.tagName.toLowerCase() !== tag) {
      view.element.remove();
      view = undefined;
    }
    if (!view) sections.set(section.id, (view = makeSection(section.id, tag)));
    visible.push(section.id);
    const element = view.element;
    element.dataset['style'] = plan.style;
    if (plan.at) element.dataset['place'] = plan.at;
    else delete element.dataset['place'];
    element.toggleAttribute('data-on-page', plan.style === 'card' && place.onPage);
    element.classList.toggle('fd-canvas-arrangement', plan.arrangement);
    span(element, section.colspan);
    if (section.labelWidth) element.style.setProperty('--fd-label-width', `${section.labelWidth}px`);
    else element.style.removeProperty('--fd-label-width');
    const isPicked = selected === section.id;
    element.classList.toggle('fd-canvas-selected', isPicked);
    element.classList.toggle('fd-canvas-picked', picked.includes(section.id) && picked.length > 1);
    // An arrangement has no title to show or type: it only holds parts.
    view.legend.hidden = plan.arrangement;
    view.title.textContent = section.title || 'Untitled section';
    view.title.classList.toggle('fd-canvas-untitled', !section.title);
    view.title.hidden = isPicked;
    view.titleInput.hidden = !isPicked;
    if (doc.activeElement !== view.titleInput) view.titleInput.value = section.title ?? '';
    view.description.hidden = !section.description;
    view.description.textContent = section.description ?? '';
    // On its grid's tracks it has no columns of its own; else its own, and those it keeps on smaller screens.
    const grid = view.grid;
    const columns = plan.at === 'tracks' ? null : section.columns;
    if (columns === null) grid.style.removeProperty('--fd-columns');
    else grid.style.setProperty('--fd-columns', String(typeof columns === 'object' ? columns.wide : (columns ?? 1)));
    // The columns of the size shown, whatever the canvas's own width: on a grid's tracks, or sharing a cell, as the form lays them.
    if (plan.at) grid.style.removeProperty('--fd-cols');
    else grid.style.setProperty('--fd-cols', String(columnsAt(section.columns, shownSize(), options.skin ?? 'outlined')));
    for (const width of ['medium', 'narrow'] as const) {
      const count = typeof columns === 'object' && columns !== null ? columns[width] : undefined;
      if (count === undefined) {
        grid.removeAttribute(`data-columns-${width}`);
        grid.style.removeProperty(`--fd-columns-${width}`);
      } else {
        grid.setAttribute(`data-columns-${width}`, String(count));
        grid.style.setProperty(`--fd-columns-${width}`, String(count));
      }
    }
    const inner = section.children.map((child, index) => drawItem(child, plan.inner, { index, underTabs: underTabs && !section.title, columns: plan.inner.columns }));
    arrange(grid, inner);
    view.empty.hidden = section.children.length > 0;
    const locked = mode === 'simple' && plan.arrangement && isPicked;
    view.lock.hidden = !locked;
    if (locked) (view.lock.firstElementChild as HTMLElement).textContent = lockWords(page, section);
    return element;
  }

  /** Any part where it sits: a field, a group or an arrangement, tabs, or a block between fields. */
  function drawItem(node: LayoutNode, place: Place, at: { index: number; underTabs: boolean; columns: number }): HTMLElement {
    drawnIds.add(node.id);
    if (node.type === 'field') return drawCard(node, place.labels, at);
    if (node.type === 'section') return drawSection(node, place, at.underTabs);
    if (node.type === 'tabs') return drawTabs(node, place);
    const element = blocks.draw(node, selected === node.id);
    element.classList.toggle('fd-canvas-selected', selected === node.id);
    element.classList.toggle('fd-canvas-picked', picked.includes(node.id) && picked.length > 1);
    return element;
  }

  // ---- tabs --------------------------------------------------------------------
  interface TabsView {
    element: HTMLElement;
    list: HTMLElement;
    panel: HTMLElement;
    grid: HTMLElement;
    add: HTMLButtonElement;
    active: string | null;
  }
  const tabsViews = new Map<string, TabsView>();

  function makeTabs(id: string): TabsView {
    const list = el('div', { class: 'fd-tablist', role: 'tablist' });
    const add = el('button', { type: 'button', class: 'fd-canvas-add-tab', 'aria-label': 'Add a tab', title: 'Add a tab' }, '+');
    const grid = el('div', { class: 'fd-grid', 'data-drop-grid': '' });
    grid.style.setProperty('--fd-columns', '1');
    const panel = el('div', { class: 'fd-tabpanel', role: 'tabpanel' }, grid);
    const element = el('div', { class: 'fd-tabs fd-canvas-tabs', 'data-node': id }, el('div', { class: 'fd-canvas-tabs-head' }, list, add), panel);
    const view: TabsView = { element, list, panel, grid, add, active: null };
    add.addEventListener('click', () => {
      const tabs = locate(designer.getPage(), id)?.node as TabsNode | undefined;
      const created = tabs && designer.addTab(id, `Tab ${tabs.children.length + 1}`);
      if (!created) return;
      view.active = created;
      designer.select(created);
    });
    return view;
  }

  function drawTabs(node: TabsNode, place: Place): HTMLElement {
    let view = tabsViews.get(node.id);
    if (!view) tabsViews.set(node.id, (view = makeTabs(node.id)));
    const holding = node.children.find((tab) => tabHolds(tab, selected));
    if (holding) view.active = holding.id;
    if (!node.children.some((tab) => tab.id === view?.active)) view.active = node.children[0]?.id ?? null;
    const shown = view;
    shown.element.classList.toggle('fd-canvas-selected', selected === node.id);
    shown.element.classList.toggle('fd-canvas-picked', picked.includes(node.id) && picked.length > 1);
    span(shown.element, node.colspan);
    const buttons = node.children.map((tab) => {
      const button = el('button', { type: 'button', role: 'tab', class: 'fd-tab fd-canvas-tab', 'data-node': tab.id, 'aria-selected': String(tab.id === shown.active) }, tab.label || 'Untitled tab');
      button.classList.toggle('fd-canvas-selected', selected === tab.id);
      button.addEventListener('click', () => {
        shown.active = tab.id;
        designer.select(tab.id);
      });
      return button;
    });
    shown.list.replaceChildren(...buttons);
    const open = node.children.find((tab) => tab.id === shown.active);
    // The open tab's parts sit where the tabs do: on the page, or in the box round them.
    if (open) {
      shown.panel.dataset['dropSection'] = open.id;
      shown.grid.dataset['container'] = open.id;
    }
    const inner: Place = { columns: 1, onPage: place.onPage, labels: place.labels };
    arrange(shown.grid, (open?.children ?? []).map((child, i) => drawItem(child, inner, { index: i, underTabs: i === 0, columns: 1 })));
    return shown.element;
  }

  /** Put these children in this order, moving only what is out of place. */
  /**
   * Put a container's parts in this order, moving only what is out of place: a part moved loses the focus,
   * so the one being typed in stays put. What the canvas draws over the parts (the guides) is left alone.
   */
  function arrange(parent: HTMLElement, children: HTMLElement[]) {
    const now = [...parent.children].filter((c) => !c.classList.contains('fd-guides')) as HTMLElement[];
    children.forEach((child, index) => {
      if (now[index] === child) return;
      parent.insertBefore(child, now[index] ?? null);
      const was = now.indexOf(child);
      if (was !== -1) now.splice(was, 1);
      now.splice(index, 0, child);
    });
    for (const extra of now.slice(children.length)) extra.remove();
  }

  // ---- picking -----------------------------------------------------------------
  element.addEventListener('click', (event) => {
    const target = event.target as Element;
    // The bar, the boxes and the lists of the field being edited handle themselves.
    if (target.closest('.fd-field-bar, input, textarea, select, button, .fd-q-option-box, .fd-multi')) return;
    // In Advanced, Shift, ⌘ or Ctrl adds a part to what is picked, or lets it go.
    const adding = mode === 'advanced' && (event.shiftKey || event.metaKey || event.ctrlKey);
    const any = target.closest<HTMLElement>('[data-node]');
    if (adding && any && body.contains(any) && any.getAttribute('role') !== 'tab') {
      designer.pick(any.dataset['node'] as string, { add: true });
      return;
    }
    const card = target.closest<HTMLElement>('.fd-canvas-field[data-node]');
    if (card) {
      const id = card.dataset['node'] as string;
      if (selected === id && picked.length <= 1) return;
      // Clicking a field's words opens it with the cursor in those words.
      const part = target.closest('.fd-label') ? 'label' : target.closest('.fd-help') ? 'help' : null;
      designer.select(id);
      if (part) focusIn(id, part, false);
      return;
    }
    // A block, a group, an arrangement or tabs: the nearest part round what was clicked.
    const part = target.closest<HTMLElement>('[data-node]');
    if (part && body.contains(part) && part.getAttribute('role') !== 'tab') {
      const id = part.dataset['node'] as string;
      if (selected !== id || picked.length > 1) designer.select(id);
      return;
    }
    if (target === element || target === body) designer.select(null);
  });

  // A field not picked, focused: Enter or Space picks it, the cursor going to its label as a click on its words does.
  element.addEventListener('keydown', (event) => {
    const card = event.target as HTMLElement;
    if ((event.key !== 'Enter' && event.key !== ' ') || !card.matches('.fd-canvas-field[data-node]:not(.fd-editing)')) return;
    event.preventDefault();
    const id = card.dataset['node'] as string;
    designer.select(id);
    focusIn(id, 'label', false);
  });

  function focusIn(id: string, part: 'label' | 'help', selectAll: boolean) {
    const card = cards.get(id);
    if (!card?.editing) return;
    const input = (part === 'label' ? card.label : card.help) as HTMLInputElement;
    input.focus();
    if (selectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }

  // Simple carries fields among fields, as before; Advanced drops any part beside, under, into or between others.
  const simpleDrag = canvasDrag({
    canvas: element,
    parts: '[data-node]:not([role="tab"])',
    enabled: () => mode === 'simple',
    drop: (source, section, index) => {
      if ('node' in source) {
        if (designer.placeNode(source.node, section, index)) designer.select(source.node);
      } else options.dropTool(source.tool, section, index);
    },
  });
  const advanced = advancedDrag({
    canvas: element,
    root: body,
    designer,
    rtl: () => doc.defaultView?.getComputedStyle(element).direction === 'rtl',
    // A new field comes with its name selected, to be typed over where it stands.
    placed: (id, source) => 'tool' in source && source.tool.startsWith('kind:') && focusIn(id, 'label', true),
  });
  advanced.setEnabled(false);
  // Advanced's width handle and gutter, on the part picked.
  // Advanced's guides: the columns of the grid the picked part sits on.
  const guides = canvasGuides({ root: body, designer });
  const widths = widthMarks({ canvas: element, root: body, designer, rtl: () => doc.defaultView?.getComputedStyle(element).direction === 'rtl' });
  const drag: CanvasDrag = {
    press: (source, event, tile) => (mode === 'advanced' ? advanced : simpleDrag).press(source, event, tile),
    destroy() {
      simpleDrag.destroy();
      advanced.destroy();
    },
  };

  const api: ScreenCanvas = {
    element,
    drag,
    keys,
    setSample(index) {
      sample = index;
    },
    setMode(next) {
      mode = next;
      element.dataset['mode'] = next;
      advanced.setEnabled(next === 'advanced');
    },
    update(state) {
      element.dataset['size'] = shownSize();
      page = state.page;
      selected = state.selected;
      picked = state.picked;
      visible = [];
      drawnIds = new Set();
      // The page's look, worn as the form wears it: an attribute or token for each setting, none left from before.
      for (const name of ['font', 'density', 'corners', 'scheme', 'accent']) element.removeAttribute(`data-${name}`);
      for (const token of ['--fd-label-width', '--fd-look-accent', '--fd-look-accent-text', '--fd-look-accent-dark', '--fd-look-accent-dark-text']) element.style.removeProperty(token);
      applyLook(element, page.look);
      // The page's own parts sit as the form puts them: one column, on the page — in a sheet, in its card.
      const root = page.layout;
      const sheet = root.type === 'sheet';
      body.dataset['node'] = root.id;
      body.dataset['container'] = root.id;
      body.classList.toggle('fd-sections', !sheet);
      const top: Place = { columns: 1, onPage: !sheet, labels: page.look?.labels };
      arrange(body, topOf(page).map((node, index) => drawItem(node, top, { index, underTabs: false, columns: 1 })));
      // Gone from the page, or in a tab not on show: their views go.
      for (const [id, card] of cards) {
        if (drawnIds.has(id)) continue;
        dropCard(card);
        cards.delete(id);
      }
      for (const [id, view] of tabsViews) if (!drawnIds.has(id)) {
        view.element.remove();
        tabsViews.delete(id);
      }
      for (const [id, view] of sections) {
        if (visible.includes(id)) continue;
        view.element.remove();
        sections.delete(id);
      }
      blocks.keep(drawnIds);
      titleCard.hidden = root.type !== 'sheet' || !root.title;
      if (root.type === 'sheet' && root.title) {
        // A made-up record names itself in the title; else the field's name stands in, as a placeholder does.
        const value = sample === null ? null : form().getState().values[root.title.field];
        titleCard.textContent = typeof value === 'string' && value ? value : (page.fields[root.title.field]?.label ?? root.title.field);
        titleCard.classList.toggle('fd-canvas-title-filled', typeof value === 'string' && !!value);
      }
      titleCard.classList.toggle('fd-canvas-selected', selected === null);
      header.update(page, selected, form);
      guides.update(state, mode === 'advanced');
      widths.update(state, mode === 'advanced');
      multi.update(state, mode === 'advanced');
      ruleMarks(element, page, designer);
    },
    visibleSections: () => [...visible],
    focus: (id, part, selectAll = false) => focusIn(id, part, selectAll),
    focusPart: (id) => header.focus(id),
    focusTitle(id) {
      const input = sections.get(id)?.titleInput;
      input?.focus();
      input?.select();
    },
    destroy() {
      drag.destroy();
      widths.destroy();
      header.destroy();
      for (const card of cards.values()) dropCard(card);
      cards.clear();
      sections.clear();
      tabsViews.clear();
      body.replaceChildren();
    },
  };
  return api;
}
