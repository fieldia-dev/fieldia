import type { FieldNode, LayoutNode, Page, TabsNode } from '@fieldia/core';
import type { Skin } from '@fieldia/viewer';
import { installStyles } from '@fieldia/widgets';
import { modeSwitch, readMode, writeMode, type DesignerMode } from './canvas-mode';
import { designerBar, elementFactory, putDownOnClickOutside } from './chrome';
import { QUESTION_KINDS, SCREEN_KINDS, type Designer, type DesignerState, type Where } from './designer';
import { findHeaderPart } from './header-commands';
import { headerPartProperties, statusbarProperties } from './header-properties';
import { listCanvas } from './list-canvas';
import { canBeColumn } from './list-commands';
import { columnProperties, listActionProperties, listProperties } from './list-properties';
import type { FindItem } from './find-anything';
import { allSections, findField, findTab, sectionLabel } from './page-tree';
import { screenCanvas } from './screen-canvas';
import { fieldProperties, pageProperties, sectionProperties, tabProperties, tabsProperties, type PropertiesView } from './screen-properties';
import { rail } from './rail';
import { installDesignerStyles } from './styles';
import { toolbox } from './toolbox';
import { tryIt } from './try-it';

/**
 * The screen editor: an app screen built where it is seen. On the left, the
 * toolbox — the model's fields, then every kind of field as an icon; in the
 * middle, the screen drawn as the viewer draws it, the field picked edited in
 * place; on the right, the panel with everything about what is picked.
 * Fields are dragged in from the toolbox and about the canvas, one undoable
 * edit per gesture. Try it shows the screen working, at a desktop's, a
 * tablet's or a phone's width, left to right or right to left.
 */

export interface ScreenEditorOptions {
  designer: Designer;
  skin?: Skin;
}

export interface ScreenEditorHandle {
  element: HTMLElement;
  destroy(): void;
}

/** What sits at the top of a screen or a sheet: sections, and a sheet's tabs. */
const topOf = (page: Page) => (page.layout as { children: LayoutNode[] }).children;

export function mountScreenEditor(host: HTMLElement, options: ScreenEditorOptions): ScreenEditorHandle {
  const { designer } = options;
  const doc = host.ownerDocument;
  installStyles(doc);
  installDesignerStyles(doc);
  const el = elementFactory(doc);
  const skin = options.skin ?? 'outlined';

  const root = el('div', { class: 'fd-form fd-designer fd-screen-designer', 'data-fd-skin': skin });
  const trial = tryIt({ el, doc, designer, skin, onChange: (trying) => (body.hidden = trying) });
  // Simple or Advanced: the person's preference, kept in this browser, never in the page.
  let mode: DesignerMode = readMode(doc.defaultView);
  const modes = modeSwitch(el, mode, (next) => setMode(next));
  root.dataset['mode'] = mode;
  function setMode(next: DesignerMode) {
    mode = next;
    writeMode(doc.defaultView, next);
    root.dataset['mode'] = next;
    modes.set(next);
    canvas.setMode(next);
    render(designer.getState());
  }
  const bar = designerBar(root, designer, {
    titleLabel: 'Screen title',
    placeholder: 'Untitled screen',
    extra: [modes.element, trial.toggle],
    find: () => [...findItems(), ...trial.items()],
    // A check about a field's words or options: it is open on the canvas by now, the cursor goes there.
    goTo(id, part) {
      if (part === 'label') return canvas.focus(id, 'label', true);
      const option = root.querySelector<HTMLInputElement>(`.fd-canvas-field[data-node="${id}"] .fd-q-option input`);
      option?.focus();
      option?.select();
    },
  });

  const canvas = screenCanvas({
    designer,
    doc,
    skin,
    openAdvanced: () => setMode('advanced'),
    more: (part) => openPanel(part),
    dropTool: (spec, section, index) => add(spec, { parent: section, index }),
  });
  const list = listCanvas({
    el,
    doc,
    designer,
    more: (part) => openPanel(part),
    dropTool: (spec, index) => spec.startsWith('model:') && designer.addColumn(spec.slice('model:'.length), index),
  });
  const isList = () => designer.getPage().layout.type === 'list';
  const tools = toolbox({
    el,
    doc,
    kinds: [...QUESTION_KINDS, ...SCREEN_KINDS],
    layout: true,
    onPick: (spec) => add(spec, null),
    onPress: (spec, event, tile) => (isList() ? list.drag : canvas.drag).press({ tool: spec }, event, tile),
  });
  const side = rail({
    el,
    doc,
    designer,
    tools,
    survey: false,
    reveal(id) {
      const column = id.startsWith('column:') ? `.fd-list-table th[data-node="${id.slice('column:'.length)}"]` : null;
      root.querySelector(column ?? `[data-node="${id}"], [data-part="${id}"]`)?.scrollIntoView?.({ block: 'nearest' });
    },
    addModelField: (name) => (isList() ? designer.addColumn(name) : add(`model:${name}`, null)),
    onSample(index) {
      canvas.setSample(index);
      render(designer.getState());
    },
  });
  const properties = el('aside', { class: 'fd-properties', 'aria-label': 'Properties' });
  const body = el('div', { class: 'fd-screen-body' }, side.element, el('div', { class: 'fd-canvas-scroll' }, canvas.element, list.element), properties);
  root.append(bar.element, bar.issues, body, trial.element);

  // ---- adding ------------------------------------------------------------------
  /** Where something picked in the toolbox goes: after the field picked, into the section picked or a picked tab's first, or the last on show. */
  function target(page: Page): Where {
    const selected = designer.getState().selected;
    if (selected && findField(page, selected)) return { after: selected };
    const sections = allSections(page);
    if (selected && sections.some((s) => s.id === selected)) return { parent: selected };
    const tab = selected ? findTab(page, selected) : null;
    const inTab = tab?.tab.children.find((n) => n.type === 'section');
    if (inTab) return { parent: inTab.id };
    const shown = canvas.visibleSections();
    const last = shown[shown.length - 1] ?? sections[sections.length - 1]?.id;
    return last ? { parent: last } : {};
  }

  function add(spec: string, where: Where | null) {
    const page = designer.getPage();
    const [kind, name] = [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)];
    // A list takes the model's fields as columns, at the end.
    if (page.layout.type === 'list') {
      if (kind === 'model') designer.addColumn(name);
      return;
    }
    if (kind === 'kind') {
      const created = designer.addQuestion(name, where ?? target(page));
      // A new field comes with its name selected, to be typed over where it stands.
      if (created) canvas.focus(created, 'label', true);
    } else if (kind === 'model') designer.addModelField(name, where ?? target(page));
    else if (spec === 'layout:section') {
      const selected = designer.getState().selected;
      const tab = selected ? findTab(page, selected) : null;
      const created = designer.addContainer(`Section ${allSections(page).length + 1}`, tab ? { parent: tab.tab.id } : {});
      if (!created) return;
      designer.select(created);
      canvas.focusTitle(created);
    } else if (spec === 'layout:tabs') {
      const created = designer.addTabs();
      const tabs = created ? (topOf(designer.getPage()).find((n) => n.id === created) as TabsNode) : null;
      if (tabs) designer.select(tabs.children[0].id);
    }
  }

  // ---- find anything -----------------------------------------------------------
  /** On a screen: a field of the model or a kind to add, a field or a section to go to. On a list: a column to add or go to. */
  function findItems(): FindItem[] {
    const page = designer.getPage();
    const layout = page.layout;
    if (layout.type === 'list') {
      const own = Object.entries(page.fields).filter(([name]) => !layout.columns.includes(name)).map(([name, field]) => ({ name, field }));
      return [
        ...[...own, ...designer.modelFields()].filter(({ field }) => canBeColumn(field)).map(({ name, field }) => ({ label: `Add the column “${field.label}”`, hint: 'column', run: () => designer.addColumn(name) })),
        ...layout.columns.map((name) => ({ label: `Go to the column “${page.fields[name]?.label ?? name}”`, hint: 'column', run: () => designer.select(`column:${name}`) })),
        { label: 'Add a button for the rows chosen', hint: 'list', run: () => (root.querySelector('[data-add-part="action"]') as HTMLButtonElement | null)?.click() },
      ];
    }
    const fields = allSections(page).flatMap((section) => section.children.filter((n): n is FieldNode => n.type === 'field').map((node) => ({ node, section })));
    return [
      ...designer.modelFields().map(({ name, field }) => ({ label: `Add “${field.label}”`, hint: 'from the model', run: () => add(`model:${name}`, null) })),
      ...[...QUESTION_KINDS, ...SCREEN_KINDS].map((kind) => ({ label: `Add a field: ${kind.label}`, hint: 'new field', run: () => add(`kind:${kind.id}`, null) })),
      ...fields.map(({ node, section }) => ({
        label: `Go to “${(node as FieldNode & { label?: string }).label ?? page.fields[node.field]?.label ?? node.id}”`,
        hint: sectionLabel(page, section),
        run: () => {
          designer.select(node.id);
          canvas.focus(node.id, 'label');
        },
      })),
      ...allSections(page).map((section) => ({ label: `Go to the section “${sectionLabel(page, section)}”`, hint: 'section', run: () => designer.select(section.id) })),
      { label: 'Add a section', hint: 'layout', run: () => add('layout:section', null) },
      ...(layout.type === 'sheet' && !topOf(page).some((n) => n.type === 'tabs') ? [{ label: 'Add tabs', hint: 'layout', run: () => add('layout:tabs', null) }] : []),
    ];
  }

  // ---- the panel -------------------------------------------------------------------
  let panelKey = '';
  let panel: PropertiesView | null = null;

  function renderPanel(state: DesignerState) {
    const { selected, page } = state;
    const part = selected !== null ? findHeaderPart(page, selected) : null;
    const layout = page.layout;
    const kind =
      layout.type === 'list'
        ? selected?.startsWith('column:') && layout.columns.includes(selected.slice('column:'.length))
          ? 'column'
          : selected && layout.actions?.some((a) => a.id === selected)
            ? 'action'
            : 'list'
        : part
        ? 'part'
        : selected === '#statusbar' && page.layout.type === 'sheet' && page.layout.statusbar
          ? 'statusbar'
          : selected !== null && findField(page, selected)
        ? 'field'
        : selected !== null && allSections(page).some((s) => s.id === selected)
          ? 'section'
          : selected !== null && findTab(page, selected)
            ? 'tab'
            : selected !== null && topOf(page).some((n) => n.id === selected && n.type === 'tabs')
              ? 'tabs'
              : 'page';
    const key = kind === 'page' || kind === 'list' ? kind : `${kind}:${selected}`;
    if (key !== panelKey) {
      panelKey = key;
      const id = selected as string;
      const partTitle = { button: 'Button', stat: 'Counter', badge: 'Badge' } as const;
      const panels: Record<typeof kind, [string, () => PropertiesView]> = {
        part: [part ? partTitle[part.kind] : '', () => headerPartProperties(el, designer, id)],
        statusbar: ['Status steps', () => statusbarProperties(el, designer)],
        field: ['Field', () => fieldProperties(el, designer, id)],
        section: ['Section', () => sectionProperties(el, designer, id)],
        tab: ['Tab', () => tabProperties(el, designer, id)],
        tabs: ['Tabs', () => tabsProperties(el, designer, id)],
        page: ['Screen', () => pageProperties(el, designer)],
        list: ['List', () => listProperties(el, designer)],
        column: ['Column', () => columnProperties(el, designer, id.slice('column:'.length))],
        action: ['Button', () => listActionProperties(el, designer, id)],
      };
      const [title, build] = panels[kind];
      panel = build();
      properties.replaceChildren(el('div', { class: 'fd-panel-title' }, title), panel.element);
    }
    panel?.update(page);
  }

  /** The rest of a field, in the panel: brought forward, and pointed out. */
  function openPanel(part: 'field' | 'when' | 'filters') {
    panel?.focus?.(part);
    properties.classList.remove('fd-flash');
    void properties.offsetWidth;
    properties.classList.add('fd-flash');
  }

  // ---- the keyboard ----------------------------------------------------------------
  // On the document: a click on the canvas leaves focus on the body, and keys pressed then never reach the editor's own element.
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target !== doc.body && !root.contains(target)) return;
    if (trial.trying || event.defaultPrevented) return;
    const selected = designer.getState().selected;
    const typing = target.closest('input, textarea, select, [contenteditable]');
    const layout = designer.getPage().layout;
    if (event.key === 'Escape' && selected) {
      // Escape leaves the box being typed in and puts the field down.
      if (typing && !target.closest('.fd-canvas')) return;
      (typing as HTMLElement | null)?.blur();
      designer.select(null);
      return;
    }
    // A list's column moves along the row, and goes with Delete; so does a button for the rows chosen.
    if (!typing && selected && layout.type === 'list') {
      const column = selected.startsWith('column:') ? selected.slice('column:'.length) : null;
      const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      if (column && event.altKey && (back || event.key === 'ArrowRight' || event.key === 'ArrowDown')) {
        event.preventDefault();
        designer.moveColumn(column, layout.columns.indexOf(column) + (back ? -1 : 1));
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        if (column) designer.removeColumn(column);
        else if (layout.actions?.some((a) => a.id === selected)) designer.removeListAction(selected);
      }
      return;
    }
    // A part of the header moves along its row, and goes with Delete.
    if (!typing && selected && findHeaderPart(designer.getPage(), selected)) {
      const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
      if (event.altKey && (back || event.key === 'ArrowRight' || event.key === 'ArrowDown')) {
        event.preventDefault();
        designer.moveHeaderPart(selected, back ? -1 : 1);
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        designer.removeHeaderPart(selected);
      }
      return;
    }
    if (typing || !selected || !findField(designer.getPage(), selected)) return;
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      designer.moveNode(selected, event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      designer.removeNode(selected);
    }
  };
  doc.addEventListener('keydown', onKey);
  // A click on empty room puts the field down; one on a field, a part of the page or a control does not.
  const stopPuttingDown = putDownOnClickOutside(
    root,
    designer,
    '.fd-canvas-field, .fd-canvas-section-title, .fd-canvas-tabs-head, .fd-canvas-part, .fd-canvas-statusbar, .fd-canvas-title, .fd-field-bar, .fd-list-table th, .fd-list-table td, .fd-canvas-search, .fd-list-selection',
    () => !trial.trying
  );

  // ---- render -----------------------------------------------------------------------
  function render(state: DesignerState) {
    bar.update(state);
    const listing = state.page.layout.type === 'list';
    canvas.element.hidden = listing;
    list.element.hidden = !listing;
    if (listing) list.update(state);
    else canvas.update(state);
    tools.update({
      // A list shows only what the model has, and only what a column can show.
      modelFields: listing ? designer.modelFields().filter((m) => canBeColumn(m.field)) : designer.modelFields(),
      tabs: state.page.layout.type === 'sheet' && !topOf(state.page).some((n) => n.type === 'tabs'),
      kinds: !listing,
    });
    side.update(state);
    renderPanel(state);
  }

  host.append(root);
  canvas.setMode(mode);
  const leave = designer.subscribe(render);
  render(designer.getState());

  return {
    element: root,
    destroy() {
      leave();
      bar.destroy();
      doc.removeEventListener('keydown', onKey);
      stopPuttingDown();
      canvas.destroy();
      list.destroy();
      trial.destroy();
      root.remove();
    },
  };
}
