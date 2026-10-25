import type { DataSource, FieldNode, LayoutNode, Page, TabsNode } from '@fieldia/core';
import type { ListViewFactory, MapPartFactory, Skin } from '@fieldia/viewer';
import { askCanvasParts } from './canvas-parts';
import { installStyles, useStyleNonce, type WidgetFactory } from '@fieldia/widgets';
import { modeSwitch, readMode, writeMode, type DesignerMode } from './canvas-mode';
import { designerBar, elementFactory, putDownOnClickOutside } from './chrome';
import { deletedToast, removeWithUndo } from './deleted-toast';
import { speakIn } from './chrome-language';
import { QUESTION_KINDS, SCREEN_KINDS, type Designer, type DesignerState, type Where } from './designer';
import { kindName } from './kinds';
import { findHeaderPart } from './header-commands';
import { listCanvas } from './list-canvas';
import { canBeColumn } from './list-commands';
import type { FindItem } from './find-anything';
import { locate } from './layout-tree';
import type { BlockKind } from './layout-ops';
import { allSections, findField, findTab, sectionLabel } from './page-tree';
import { screenCanvas } from './screen-canvas';
import { screenPanel } from './panel-screen';
import { clipboardKeys } from './clipboard-keys';
import { shortcutKeys } from './shortcuts-sheet';
import { rail } from './rail';
import { installDesignerStyles } from './styles';
import { toolbox } from './toolbox';
import { toolsSheet } from './tools-sheet';
import { keepClearOfBar } from './bottom-bar';
import { designerIcon } from './icons';
import { tryIt } from './try-it';
import { translationsView } from './translations-view';
import { jsonView } from './json-view';
import { rulesOverview } from './rules-overview';
import type { DesignerAssistant } from './assistant';
import type { PageTemplate } from './templates';
import { startHere } from './templates-start';
import { dropEcho } from './drop-echo';
import { closeMenusIn, openMenu } from './menu';
import { setHidden } from './writes';

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
  /** The app's own data source: Try it takes the choices of the app's lists from it, and saves nothing through it. */
  dataSource?: DataSource;
  /** The app's own widgets, by `type` or `type.widget`: its kinds are drawn with them on the canvas and in Try it. */
  widgets?: Record<string, WidgetFactory>;
  /** The app's other ways of showing a list's records, for Try it: a map with @fieldia/map's mapListViews. */
  listViews?: Record<string, ListViewFactory>;
  /** Draws a page's maps in Try it (`type: "map"`): @fieldia/map's mapParts. */
  maps?: MapPartFactory;
  /** Where Try it's made-up records are, on a list's map: the middle of the app's maps. */
  sampleCentre?: { lat: number; lng: number };
  /** The app's own templates for a blank screen, after the designer's. */
  templates?: readonly PageTemplate[];
  /** The app's own assistant, in place of the designer's. Without one, nothing about it shows. */
  assistant?: DesignerAssistant;
  /** The page's Content-Security-Policy nonce: every <style> the designer and the forms in it add carries it (the viewer's `nonce`). */
  nonce?: string;
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
  // Every part the canvas draws the page from asked for at once, as the editor opens (canvas-parts.ts).
  const pageWords = askCanvasParts(designer.getPage(), options.widgets);
  useStyleNonce(doc, options.nonce);
  installStyles(doc);
  installDesignerStyles(doc);
  const el = elementFactory(doc);
  const skin = options.skin ?? 'outlined';

  const root = el('div', { class: 'fd-form fd-designer fd-screen-designer', 'data-fd-skin': skin });
  const trial = tryIt({ el, doc, designer, skin, dataSource: options.dataSource, widgets: options.widgets, listViews: options.listViews, maps: options.maps, sampleCentre: options.sampleCentre, onChange: (trying) => (body.hidden = trying) });
  /** Every kind of field, then the app's own. */
  const kinds = [...QUESTION_KINDS, ...SCREEN_KINDS, ...designer.appKinds()];
  // Simple or Advanced: the person's preference, kept in this browser, never in the page.
  let mode: DesignerMode = readMode(doc.defaultView);
  const modes = modeSwitch(el, mode, (next) => setMode(next), designer.words);
  root.dataset['mode'] = mode;
  function setMode(next: DesignerMode) {
    mode = next;
    writeMode(doc.defaultView, next);
    root.dataset['mode'] = next;
    modes.set(next);
    canvas.setMode(next);
    panel.setMode(next);
    render(designer.getState());
  }
  const bar = designerBar(root, designer, {
    titleLabel: designer.words.bar.screenTitle,
    placeholder: designer.words.bar.untitledScreen,
    extra: [modes.element, trial.toggle],
    find: () => [...start.items(), ...findItems(), ...trial.items(), ...words.items(), ...ruleList.items(), ...panel.findItems(), ...json.items(), ...shortcuts.items()],
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
    widgets: options.widgets,
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
    kinds,
    words: designer.words,
    layout: true,
    // A map among the blocks, when the app draws maps.
    maps: !!options.maps,
    forms: true,
    related: true,
    // Picked in the sheet, the sheet goes first: the field added takes the focus. A saved form is picked from a menu
    // under its tile, which the sheet keeps until one is picked.
    onPick: (spec) => (spec === 'form:saved' ? add(spec, null) : sheet.closeFor(() => add(spec, null))),
    // A tile is carried onto the screen from beside it; in the sheet over the screen it is only picked.
    onPress: (spec, event, tile) => !sheet.open && (isList() ? list.drag : canvas.drag).press({ tool: spec }, event, tile),
  });
  const side = rail({
    el,
    doc,
    designer,
    tools,
    survey: false,
    several: () => mode === 'advanced',
    reveal(id) {
      const column = id.startsWith('column:') ? `.fd-list-table th[data-node="${id.slice('column:'.length)}"]` : null;
      root.querySelector(column ?? `[data-node="${id}"], [data-part="${id}"]`)?.scrollIntoView?.({ block: 'nearest' });
    },
    addModelField: (name) => sheet.closeFor(() => (isList() ? designer.addColumn(name) : add(`model:${name}`, null))),
    onSample(index) {
      canvas.setSample(index);
      render(designer.getState());
    },
  });
  // A field's answer rules are tried beside them by its own widget, the app's among them; what cannot be tried there, in Try it.
  const panel = screenPanel({ el, doc, designer, wearer: canvas.element, sampling: { widgets: options.widgets, tryIt: () => trial.start() } });
  panel.setMode(mode);
  // A blank screen: templates to start from.
  const start = startHere({ el, doc, designer, root, survey: false, templates: options.templates, assistant: options.assistant ?? designer.assistant(), blankFocus: () => root.querySelector('.fd-tool-find') });
  // Where the toolbox cannot sit beside the screen (a phone, a tablet held upright), it waits behind the + of a bar at the
  // foot of the screen, in a sheet (tools-sheet.ts), so the screen starts near the top.
  const openTools = el('button', { type: 'button', class: 'fd-rail-button fd-rail-tools', 'aria-label': designer.words.toolbox.openToolbox, title: designer.words.toolbox.openToolbox, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, designerIcon(doc, 'plus'));
  const foot = el('div', { class: 'fd-foot-bar', role: 'toolbar', 'aria-label': designer.words.toolbox.add }, openTools);
  const body = el('div', { class: 'fd-screen-body' }, side.element, el('div', { class: 'fd-canvas-scroll' }, start.element, canvas.element, list.element), panel.element, foot);
  const sheet = toolsSheet({ el, doc, root, side: side.element, words: designer.words });
  openTools.addEventListener('click', () => sheet.show(openTools));
  // Nothing a person works on is left under the bar at the foot.
  const unclear = keepClearOfBar(foot, body);
  const json = jsonView({ el, doc, designer, trial, body });
  root.append(bar.element, bar.issues, body, trial.element, json.element);
  // The editor in its own language; the screen drawn as the page around it runs, as the form will.
  const followHost = speakIn(root, host, designer, () => [canvas.element, list.element]);
  const words = translationsView({ el, doc, designer, root, body, modes: trial.toggle });
  const ruleList = rulesOverview({ el, doc, designer, root, body, modes: trial.toggle });
  const clip = clipboardKeys({ root, designer, active: () => !trial.trying && !json.open });
  const shortcuts = shortcutKeys({ el, root, survey: false, words: designer.words, active: () => !trial.trying && !json.open });
  // gap lane: a drag in the outline shows where it lands on the canvas, and one on the canvas in the outline.
  const echoes = dropEcho({
    editor: root,
    canvas: canvas.element,
    parts: canvas.element.querySelector('.fd-canvas-body') as HTMLElement,
    tree: side.element.querySelector('.fd-outline-tree') as HTMLElement,
    designer,
    rtl: () => doc.defaultView?.getComputedStyle(canvas.element).direction === 'rtl',
  });

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
    else if (kind === 'block') designer.addBlock(name as BlockKind, where ?? blockWhere(page));
    else if (kind === 'form') void pickSavedForm(where ?? blockWhere(page));
    else if (spec === 'layout:section') {
      const selected = designer.getState().selected;
      const tab = selected ? findTab(page, selected) : null;
      const created = designer.addContainer(designer.words.defaults.section(allSections(page).length + 1), tab ? { parent: tab.tab.id } : {});
      if (!created) return;
      designer.select(created);
      canvas.focusTitle(created);
    } else if (spec === 'layout:tabs') {
      const created = designer.addTabs();
      const tabs = created ? (topOf(designer.getPage()).find((n) => n.id === created) as TabsNode) : null;
      if (tabs) designer.select(tabs.children[0].id);
    }
  }

  /**
   * One of the app's saved forms, picked from a menu under the toolbox's tile,
   * placed where it was dropped or would go. It is loaded first, with what it
   * places, so one that would hold this page is refused, saying why.
   */
  async function pickSavedForm(where: Where) {
    const anchor = root.querySelector<HTMLElement>('.fd-toolbox [data-tool="form:saved"]');
    if (!anchor) return;
    const found = await designer.savedForms();
    openMenu({
      el,
      anchor,
      title: designer.words.savedForms.tile,
      items: found.map((form) => ({ id: form.id, label: form.title, icon: 'saved-form' })),
      note: designer.words.savedForms.menuNote(found.length > 0),
      onPick: async (id) => {
        // Picked from the toolbox's sheet: the sheet goes with the menu.
        sheet.close(false);
        await designer.loadSavedForm(id);
        designer.addForm(id, where);
      },
    });
  }

  /** Where a block clicked in the toolbox goes: right after what is picked, into a picked tab, or where a field would. */
  function blockWhere(page: Page): Where {
    const selected = designer.getState().selected;
    const at = selected ? locate(page, selected) : null;
    if (at?.node.type === 'tab') return { parent: at.node.id };
    if (at) return { after: at.node.id };
    return target(page);
  }

  // ---- find anything -----------------------------------------------------------
  /** On a screen: a field of the model or a kind to add, a field or a section to go to. On a list: a column to add or go to. */
  function findItems(): FindItem[] {
    const f = designer.words.canvas.find;
    const page = designer.getPage();
    const layout = page.layout;
    if (layout.type === 'list') {
      const own = Object.entries(page.fields).filter(([name]) => !layout.columns.includes(name)).map(([name, field]) => ({ name, field }));
      return [
        ...[...own, ...designer.modelFields()].filter(({ field }) => canBeColumn(field)).map(({ name, field }) => ({ label: f.addColumn(field.label), hint: f.column, run: () => designer.addColumn(name) })),
        ...layout.columns.map((name) => ({ label: f.goToColumn(page.fields[name]?.label ?? name), hint: f.column, run: () => designer.select(`column:${name}`) })),
        { label: f.addListButton, hint: f.list, run: () => (root.querySelector('[data-add-part="action"]') as HTMLButtonElement | null)?.click() },
      ];
    }
    const fields = allSections(page).flatMap((section) => section.children.filter((n): n is FieldNode => n.type === 'field').map((node) => ({ node, section })));
    return [
      ...designer.modelFields().map(({ name, field }) => ({ label: f.addModelField(field.label), hint: f.fromModel, run: () => add(`model:${name}`, null) })),
      ...kinds.map((kind) => ({ label: f.addField(kindName(kind, designer.words)), hint: f.newField, run: () => add(`kind:${kind.id}`, null) })),
      ...fields.map(({ node, section }) => ({
        label: f.goTo((node as FieldNode & { label?: string }).label ?? page.fields[node.field]?.label ?? node.id),
        hint: sectionLabel(page, section, designer.words),
        run: () => {
          designer.select(node.id);
          canvas.focus(node.id, 'label');
        },
      })),
      ...allSections(page).map((section) => ({ label: f.goToSection(sectionLabel(page, section, designer.words)), hint: f.section, run: () => designer.select(section.id) })),
      { label: f.addSection, hint: f.layout, run: () => add('layout:section', null) },
      ...(designer.canPlaceForms() ? [{ label: designer.words.savedForms.add, hint: designer.words.savedForms.hint, run: () => add('form:saved', null) }] : []),
      ...(layout.type === 'sheet' && !topOf(page).some((n) => n.type === 'tabs') ? [{ label: f.addTabs, hint: f.layout, run: () => add('layout:tabs', null) }] : []),
    ];
  }

  // ---- the panel -------------------------------------------------------------------
  /** The rest of a field, in the panel: brought forward on its tab, and pointed out. */
  function openPanel(part: 'field' | 'when' | 'filters') {
    panel.open(part);
  }

  // ---- the keyboard ----------------------------------------------------------------
  // On the document: a click on the canvas leaves focus on the body, and keys pressed then never reach the editor's own element.
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target !== doc.body && !root.contains(target)) return;
    if (trial.trying || json.open || event.defaultPrevented) return;
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
    // On the Advanced canvas: moves, widths and what is picked, from the keyboard.
    if (mode === 'advanced' && !typing && layout.type !== 'list' && canvas.keys.handle(event)) {
      event.preventDefault();
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
        removeWithUndo(designer, selected, () => designer.removeHeaderPart(selected), 'part');
      }
      return;
    }
    if (typing || !selected || !findField(designer.getPage(), selected)) return;
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      designer.moveNode(selected, event.key === 'ArrowUp' ? -1 : 1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      removeWithUndo(designer, selected);
    }
  };
  doc.addEventListener('keydown', onKey);
  // What a Delete took away, said with Undo at the foot of the screen.
  const deletions = deletedToast(root, designer, el, false);
  // A click on empty room puts the field down; one on a field, a part of the page or a control does not.
  const stopPuttingDown = putDownOnClickOutside(
    root,
    designer,
    '.fd-canvas-field, .fd-canvas-section-title, .fd-canvas-tabs-head, .fd-canvas-part, .fd-canvas-statusbar, .fd-canvas-title, .fd-field-bar, .fd-list-table th, .fd-list-table td, .fd-canvas-search, .fd-list-selection, .fd-canvas-body [data-node]:not(.fd-canvas-section), .fd-screen-designer[data-mode="advanced"] .fd-canvas-section, .fd-multi, .fd-width-handle, .fd-gutter, .fd-canvas-resize, .fd-simple-lock',
    () => !trial.trying
  );

  // ---- render -----------------------------------------------------------------------
  function render(state: DesignerState) {
    followHost();
    bar.update(state);
    start.update(state);
    const listing = state.page.layout.type === 'list';
    setHidden(canvas.element, listing);
    setHidden(list.element, !listing);
    if (listing) list.update(state);
    else canvas.update(state);
    tools.update({
      // A list shows only what the model has, and only what a column can show.
      modelFields: listing ? designer.modelFields().filter((m) => canBeColumn(m.field)) : designer.modelFields(),
      tabs: state.page.layout.type === 'sheet' && !topOf(state.page).some((n) => n.type === 'tabs'),
      kinds: !listing,
      advanced: mode === 'advanced',
      forms: designer.canPlaceForms(),
      // A related list lists the records that point at a record: on a record's page.
      related: state.page.data.kind === 'record',
    });
    side.update(state);
    panel.update(state);
  }

  host.append(root);
  canvas.setMode(mode);
  const leave = designer.subscribe(render);
  render(designer.getState());
  // The page's language's words, once in: the canvas drawn again in them.
  let gone = false;
  void pageWords?.then(() => gone || render(designer.getState()));

  return {
    element: root,
    destroy() {
      gone = true;
      leave();
      sheet.destroy();
      unclear();
      bar.destroy();
      doc.removeEventListener('keydown', onKey);
      stopPuttingDown();
      canvas.destroy();
      panel.destroy();
      side.destroy();
      clip.destroy();
      shortcuts.destroy();
      list.destroy();
      trial.destroy();
      words.destroy();
      json.destroy();
      ruleList.destroy();
      echoes.destroy();
      deletions.destroy();
      closeMenusIn(root);
      root.remove();
    },
  };
}
