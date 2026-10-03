import type { LayoutNode, Page, TabsNode } from '@fieldia/core';
import type { Skin } from '@fieldia/viewer';
import { installStyles } from '@fieldia/widgets';
import { designerBar, elementFactory } from './chrome';
import { QUESTION_KINDS, SCREEN_KINDS, type Designer, type DesignerState, type Where } from './designer';
import { findHeaderPart } from './header-commands';
import { headerPartProperties, statusbarProperties } from './header-properties';
import { allSections, findField, findTab } from './page-tree';
import { screenCanvas } from './screen-canvas';
import { fieldProperties, pageProperties, sectionProperties, tabProperties, tabsProperties, type PropertiesView } from './screen-properties';
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
  const bar = designerBar(root, designer, { titleLabel: 'Screen title', placeholder: 'Untitled screen', extra: [trial.toggle] });

  const canvas = screenCanvas({
    designer,
    doc,
    more: (part) => openPanel(part),
    dropTool: (spec, section, index) => add(spec, { parent: section, index }),
  });
  const tools = toolbox({
    el,
    doc,
    kinds: [...QUESTION_KINDS, ...SCREEN_KINDS],
    layout: true,
    onPick: (spec) => add(spec, null),
    onPress: (spec, event, tile) => canvas.drag.press({ tool: spec }, event, tile),
  });
  const properties = el('aside', { class: 'fd-properties', 'aria-label': 'Properties' });
  const body = el('div', { class: 'fd-screen-body' }, tools.element, el('div', { class: 'fd-canvas-scroll' }, canvas.element), properties);
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

  // ---- the panel -------------------------------------------------------------------
  let panelKey = '';
  let panel: PropertiesView | null = null;

  function renderPanel(state: DesignerState) {
    const { selected, page } = state;
    const part = selected !== null ? findHeaderPart(page, selected) : null;
    const kind =
      part
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
    const key = kind === 'page' ? kind : `${kind}:${selected}`;
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
      };
      const [title, build] = panels[kind];
      panel = build();
      properties.replaceChildren(el('div', { class: 'fd-panel-title' }, title), panel.element);
    }
    panel?.update(page);
  }

  /** The rest of a field, in the panel: brought forward, and pointed out. */
  function openPanel(part: 'field' | 'when') {
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
    if (event.key === 'Escape' && selected) {
      // Escape leaves the box being typed in and puts the field down.
      if (typing && !target.closest('.fd-canvas')) return;
      (typing as HTMLElement | null)?.blur();
      designer.select(null);
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

  // ---- render -----------------------------------------------------------------------
  function render(state: DesignerState) {
    bar.update(state);
    canvas.update(state);
    tools.update({ modelFields: designer.modelFields(), tabs: state.page.layout.type === 'sheet' && !topOf(state.page).some((n) => n.type === 'tabs') });
    renderPanel(state);
  }

  host.append(root);
  const leave = designer.subscribe(render);
  render(designer.getState());

  return {
    element: root,
    destroy() {
      leave();
      bar.destroy();
      doc.removeEventListener('keydown', onKey);
      canvas.destroy();
      trial.destroy();
      root.remove();
    },
  };
}
