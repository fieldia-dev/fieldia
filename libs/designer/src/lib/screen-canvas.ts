import { createForm, wideColumns, type FieldNode, type Form, type LayoutNode, type Page, type SectionNode, type TabsNode } from '@fieldia/core';
import { createWidget, type Widget } from '@fieldia/widgets';
import { canvasDrag, type CanvasDrag } from './canvas-drag';
import { canvasHeader } from './canvas-header';
import { elementFactory, optionsEditor, type OptionsEditor } from './chrome';
import type { Designer, DesignerState } from './designer';
import { fieldBar, type FieldBar } from './field-bar';
import { designerIcon } from './icons';
import { inlineSettings, type InlineSettings } from './inline-settings';
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
 * Everything is keyed by id and patched in place, so the box being typed in
 * stays the same box, focused, while the page changes around it.
 */

export interface ScreenCanvasOptions {
  designer: Designer;
  doc: Document;
  /** Open the panel at a part of the field picked: its settings, or when it shows. */
  more(part: 'field' | 'when'): void;
  /** Something from the toolbox was let go over a section, at a place among its fields. */
  dropTool(spec: string, section: string, index: number): void;
}

export interface ScreenCanvas {
  element: HTMLElement;
  drag: CanvasDrag;
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
  destroy(): void;
}

/** What sits at the top of a screen or a sheet: sections, and a sheet's tabs. */
const topOf = (page: Page) => (page.layout as { children: LayoutNode[] }).children;
const fieldsOf = (section: SectionNode) => section.children.filter((n): n is FieldNode => n.type === 'field');

export function screenCanvas(options: ScreenCanvasOptions): ScreenCanvas {
  const { designer, doc } = options;
  const el = elementFactory(doc);
  const titleCard = el('button', { type: 'button', class: 'fd-canvas-title', hidden: '' });
  titleCard.addEventListener('click', () => designer.select(null));
  const body = el('div', { class: 'fd-canvas-body' });
  const header = canvasHeader({ el, doc, designer });
  const element = el('div', { class: 'fd-canvas' }, header.top, header.card, titleCard, body);
  let page = designer.getPage();
  let selected: string | null = null;
  let visible: string[] = [];

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

  /** Six dots beside a field, shown when it is pointed at or picked: what it is carried by. */
  const gripOf = () => el('button', { type: 'button', class: 'fd-card-grip', 'data-grip': '', 'aria-label': 'Drag to move', title: 'Drag to move · Alt+↑ or ↓ moves it too', tabindex: '-1' }, designerIcon(doc, 'grip'));

  function buildCard(id: string, editing: boolean, ownChoice: boolean): Card {
    const widgetBox = el('div', { class: 'fd-canvas-widget', inert: '' });
    if (!editing) {
      const label = el('label', { class: 'fd-label' });
      const help = el('div', { class: 'fd-help' });
      const element = el('div', { class: 'fd-field fd-canvas-field', 'data-node': id }, gripOf(), label, widgetBox, help);
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

  function drawCard(node: FieldNode, section: SectionNode, place: { index: number; underTabs: boolean }): HTMLElement {
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
      element.classList.toggle('fd-bar-below', place.underTabs && place.index < wideColumns(section.columns));
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
    const widget = createWidget({ form: f, name: node.field, field: def, node, id: `fd-canvas-${node.id}`, document: doc });
    widget.update({ value: f.getState().values[node.field], values: f.getState().values, readonly: false, required: def.required === true, invalid: false });
    card.widget = widget;
    card.widgetBox.replaceChildren(widget.element);
  }

  // ---- sections ----------------------------------------------------------------
  interface SectionView {
    element: HTMLFieldSetElement;
    legend: HTMLElement;
    title: HTMLButtonElement;
    titleInput: HTMLInputElement;
    grid: HTMLElement;
    empty: HTMLElement;
  }
  const sections = new Map<string, SectionView>();

  function makeSection(id: string): SectionView {
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
    const grid = el('div', { class: 'fd-grid', 'data-drop-grid': '' });
    const empty = el('p', { class: 'fd-canvas-empty' }, 'Drop a field here, or pick one in the toolbox.');
    const element = el('fieldset', { class: 'fd-section fd-canvas-section', 'data-node': id, 'data-drop-section': id }, legend, grid, empty);
    return { element, legend, title, titleInput, grid, empty };
  }

  function drawSection(section: SectionNode, underTabs: boolean): HTMLElement {
    let view = sections.get(section.id);
    if (!view) sections.set(section.id, (view = makeSection(section.id)));
    visible.push(section.id);
    const picked = selected === section.id;
    view.element.classList.toggle('fd-canvas-selected', picked);
    view.title.textContent = section.title || 'Untitled section';
    view.title.classList.toggle('fd-canvas-untitled', !section.title);
    view.title.hidden = picked;
    view.titleInput.hidden = !picked;
    if (doc.activeElement !== view.titleInput) view.titleInput.value = section.title ?? '';
    view.grid.style.setProperty('--fd-columns', String(wideColumns(section.columns)));
    const fields = fieldsOf(section);
    const elements = fields.map((node, index) => drawCard(node, section, { index, underTabs: underTabs && !section.title }));
    arrange(view.grid, elements);
    view.empty.hidden = fields.length > 0;
    return view.element;
  }

  // ---- tabs --------------------------------------------------------------------
  interface TabsView {
    element: HTMLElement;
    list: HTMLElement;
    panel: HTMLElement;
    add: HTMLButtonElement;
    active: string | null;
  }
  const tabsViews = new Map<string, TabsView>();

  function makeTabs(id: string): TabsView {
    const list = el('div', { class: 'fd-tablist', role: 'tablist' });
    const add = el('button', { type: 'button', class: 'fd-canvas-add-tab', 'aria-label': 'Add a tab', title: 'Add a tab' }, '+');
    const panel = el('div', { class: 'fd-tabpanel', role: 'tabpanel' });
    const element = el('div', { class: 'fd-tabs fd-canvas-tabs', 'data-node': id }, el('div', { class: 'fd-canvas-tabs-head' }, list, add), panel);
    const view: TabsView = { element, list, panel, add, active: null };
    add.addEventListener('click', () => {
      const tabs = topOf(designer.getPage()).find((n) => n.id === id) as TabsNode | undefined;
      const created = tabs && designer.addTab(id, `Tab ${tabs.children.length + 1}`);
      if (!created) return;
      view.active = created;
      designer.select(created);
    });
    return view;
  }

  function drawTabs(node: TabsNode): HTMLElement {
    let view = tabsViews.get(node.id);
    if (!view) tabsViews.set(node.id, (view = makeTabs(node.id)));
    const holding = node.children.find((tab) => tabHolds(tab, selected));
    if (holding) view.active = holding.id;
    if (!node.children.some((tab) => tab.id === view?.active)) view.active = node.children[0]?.id ?? null;
    const shown = view;
    shown.element.classList.toggle('fd-canvas-selected', selected === node.id);
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
    const inTab = (open?.children ?? []).filter((n): n is SectionNode => n.type === 'section');
    arrange(shown.panel, inTab.map((section, i) => drawSection(section, i === 0)));
    return shown.element;
  }

  /** Put these children in this order, moving only what is out of place. */
  function arrange(parent: HTMLElement, children: HTMLElement[]) {
    children.forEach((child, index) => {
      if (parent.children[index] !== child) parent.insertBefore(child, parent.children[index] ?? null);
    });
    while (parent.children.length > children.length) parent.lastElementChild?.remove();
  }

  // ---- picking -----------------------------------------------------------------
  element.addEventListener('click', (event) => {
    const target = event.target as Element;
    // The bar, the boxes and the lists of the field being edited handle themselves.
    if (target.closest('.fd-field-bar, input, textarea, select, button, .fd-q-option-box')) return;
    const card = target.closest<HTMLElement>('.fd-canvas-field[data-node]');
    if (card) {
      const id = card.dataset['node'] as string;
      if (selected === id) return;
      // Clicking a field's words opens it with the cursor in those words.
      const part = target.closest('.fd-label') ? 'label' : target.closest('.fd-help') ? 'help' : null;
      designer.select(id);
      if (part) focusIn(id, part, false);
      return;
    }
    const section = target.closest<HTMLElement>('[data-drop-section]');
    if (section) {
      if (selected !== section.dataset['dropSection']) designer.select(section.dataset['dropSection'] as string);
      return;
    }
    if (target === element || target === body) designer.select(null);
  });

  function focusIn(id: string, part: 'label' | 'help', selectAll: boolean) {
    const card = cards.get(id);
    if (!card?.editing) return;
    const input = (part === 'label' ? card.label : card.help) as HTMLInputElement;
    input.focus();
    if (selectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }

  const drag = canvasDrag({
    canvas: element,
    drop: (source, section, index) => {
      if ('node' in source) {
        if (designer.placeNode(source.node, section, index)) designer.select(source.node);
      } else options.dropTool(source.tool, section, index);
    },
  });

  return {
    element,
    drag,
    setSample(index) {
      sample = index;
    },
    update(state) {
      page = state.page;
      selected = state.selected;
      visible = [];
      const top = topOf(page).flatMap((node) => (node.type === 'section' ? [drawSection(node, false)] : node.type === 'tabs' ? [drawTabs(node)] : []));
      arrange(body, top);
      // Gone from the page, or in a tab not on show: their views go.
      const shownFields = new Set(visible.flatMap((id) => [...(sections.get(id)?.grid.children ?? [])].map((c) => (c as HTMLElement).dataset['node'])));
      for (const [id, card] of cards) {
        if (shownFields.has(id)) continue;
        dropCard(card);
        cards.delete(id);
      }
      const live = new Set(topOf(page).map((n) => n.id));
      for (const [id] of tabsViews) if (!live.has(id)) tabsViews.delete(id);
      for (const [id, view] of sections) {
        if (visible.includes(id)) continue;
        view.element.remove();
        sections.delete(id);
      }
      const root = page.layout;
      titleCard.hidden = root.type !== 'sheet' || !root.title;
      if (root.type === 'sheet' && root.title) {
        // A made-up record names itself in the title; else the field's name stands in, as a placeholder does.
        const value = sample === null ? null : form().getState().values[root.title.field];
        titleCard.textContent = typeof value === 'string' && value ? value : (page.fields[root.title.field]?.label ?? root.title.field);
        titleCard.classList.toggle('fd-canvas-title-filled', typeof value === 'string' && !!value);
      }
      titleCard.classList.toggle('fd-canvas-selected', selected === null);
      header.update(page, selected, form);
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
      header.destroy();
      for (const card of cards.values()) dropCard(card);
      cards.clear();
      sections.clear();
      tabsViews.clear();
      body.replaceChildren();
    },
  };
}
