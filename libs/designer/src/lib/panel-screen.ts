import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { settingItems, type FindItem } from './find-anything';
import type { Designer, DesignerState } from './designer';
import { findHeaderPart } from './header-commands';
import { headerPartProperties, statusbarProperties } from './header-properties';
import { kindById, kindOfField } from './kinds';
import { locate, nameOf, seenAs } from './layout-tree';
import { columnProperties, listActionProperties, listProperties } from './list-properties';
import { fieldProperties } from './panel-field';
import { arrangementProperties, groupProperties } from './panel-group';
import { inspectorShell, settingRows, type InspectorHead, type SettingRow } from './panel-inspector';
import { pageLookSettings, wearLook } from './panel-look';
import { pageProperties } from './panel-page';
import type { SampleOptions } from './rules-sample';
import { blockProperties, severalProperties } from './panel-parts';
import { settingSearch } from './panel-search';
import { partKindOf, TAB_NAMES, type PanelTab, type PartKind } from './panel-tabs';
import { tabProperties, tabsProperties, type PropertiesView } from './screen-properties';

/**
 * The screen editor's panel: the view of what is picked — a field, a group,
 * parts side by side, tabs, a block, several parts, a header's part, a list's
 * column, or the screen itself — in the panel's tabs, headed by its kind and
 * its name.
 */

export interface ScreenPanel {
  element: HTMLElement;
  update(state: DesignerState): void;
  /** Bring part of what is picked forward, on its tab: its settings, when it shows, a list's filters. */
  open(part: 'field' | 'when' | 'filters'): void;
  /** For Find anything: the settings of what is picked, and the page's look. */
  findItems(): FindItem[];
  /** Simple or Advanced: the tabs and settings on show follow it. */
  setMode(mode: 'simple' | 'advanced'): void;
  destroy(): void;
}

/** The tab each part the canvas asks for is on. */
const PART_TAB: Record<'field' | 'when' | 'filters', PanelTab> = { field: 'content', when: 'rules', filters: 'content' };

const BLOCK_WORDS: Record<string, [string, string]> = {
  button: ['Button', 'play'],
  image: ['Image', 'image'],
  divider: ['Divider', 'width'],
  spacer: ['Spacer', 'width'],
  slot: ['The app’s own part', 'more'],
  form: ['Saved form', 'saved-form'],
};

/** What is picked, as the head says it: its kind, with an icon, and its name. */
export function headOf(page: Page, kind: PartKind, picked: readonly string[], fromModel: (id: string) => boolean): InspectorHead {
  const id = picked[picked.length - 1] ?? '';
  const node = locate(page, id)?.node;
  const layout = page.layout;
  switch (kind) {
    case 'several':
      return { icon: 'check', kind: 'Several', name: `${picked.length} parts picked` };
    case 'field': {
      const field = node?.type === 'field' ? node : null;
      const def = field ? page.fields[field.field] : undefined;
      const made = field && def ? kindOfField(def, field) : null;
      return { icon: made ?? 'short-answer', kind: made ? kindById(made).label : 'Field', note: fromModel(id) ? 'from the model' : undefined, name: nameOf(page, node ?? null) };
    }
    case 'group':
      return { icon: 'section', kind: 'Group', name: nameOf(page, node ?? null) || 'Untitled section' };
    case 'arrangement':
      return { icon: 'width', kind: 'Side by side', name: node ? seenAs(page, node) : '' };
    case 'tabs':
      return { icon: 'tabs', kind: 'Tabs', name: node?.type === 'tabs' ? node.children.map((t) => t.label).join(', ') : 'Tabs' };
    case 'tab':
      return { icon: 'tabs', kind: 'Tab', name: nameOf(page, node ?? null) };
    case 'block': {
      const heading = node?.type === 'text' && node.style === 'heading';
      const [words, icon] = node?.type === 'text' ? [heading ? 'Heading' : 'Words', 'paragraph'] : (BLOCK_WORDS[node?.type ?? ''] ?? ['Part', 'more']);
      return { icon, kind: words, name: nameOf(page, node ?? null) };
    }
    case 'header': {
      const part = findHeaderPart(page, id);
      const words = { button: 'Button', stat: 'Counter', badge: 'Badge' } as const;
      return { icon: 'play', kind: part ? words[part.kind] : 'Button', name: part?.part.label ?? '' };
    }
    case 'statusbar': {
      const field = layout.type === 'sheet' ? layout.statusbar?.field : undefined;
      return { icon: 'status', kind: 'Status steps', name: field ? (page.fields[field]?.label ?? field) : '' };
    }
    case 'list':
      return { icon: 'lines', kind: 'List', name: page.title || 'Untitled list' };
    case 'column': {
      const name = id.slice('column:'.length);
      return { icon: 'lines', kind: 'Column', name: page.fields[name]?.label ?? name };
    }
    case 'action': {
      const action = layout.type === 'list' ? layout.actions?.find((a) => a.id === id) : undefined;
      return { icon: 'play', kind: 'Button', name: action?.label ?? '' };
    }
    default:
      return { icon: 'file', kind: layout.type === 'sheet' ? 'Sheet' : 'Screen', name: page.title || 'Untitled screen' };
  }
}

export function screenPanel(options: { el: ElementFactory; doc: Document; designer: Designer; wearer?: HTMLElement; sampling?: SampleOptions }): ScreenPanel {
  const { el, doc, designer, wearer } = options;
  const shell = inspectorShell(el, doc);
  const search = settingSearch(el, doc, shell);
  let key = '';
  let view: PropertiesView | null = null;
  let mode: 'simple' | 'advanced' = 'advanced';

  function viewOf(kind: PartKind, picked: readonly string[]): PropertiesView {
    const id = picked[picked.length - 1] ?? '';
    switch (kind) {
      case 'header':
        return headerPartProperties(el, designer, id);
      case 'statusbar':
        return statusbarProperties(el, designer);
      case 'field':
        return fieldProperties(el, designer, id, options.sampling);
      case 'group':
        return groupProperties(el, designer, id);
      case 'arrangement':
        return arrangementProperties(el, designer, id);
      case 'tabs':
        return tabsProperties(el, designer, id);
      case 'tab':
        return tabProperties(el, designer, id);
      case 'block':
        return blockProperties(el, designer, id);
      case 'several':
        return severalProperties(el, designer, picked);
      case 'list':
        return listProperties(el, designer);
      case 'column':
        return columnProperties(el, designer, id.slice('column:'.length));
      case 'action':
        return listActionProperties(el, designer, id);
      default:
        return pageProperties(el, designer);
    }
  }

  /** Go to a setting on show, by its tab and name: a choice made first, unless it is made already. */
  function go(tab: PanelTab, name: string, choice?: string) {
    const find = () => shell.rows().find((row: SettingRow) => row.tab === tab && row.name === name);
    const button = choice === undefined ? undefined : find()?.choices.find((c) => c.value === choice)?.button;
    if (button && button.getAttribute('aria-pressed') !== 'true') button.click();
    // Made, the choice may have drawn the panel again: the setting is looked for afresh.
    const row = find();
    if (row) shell.go(row, choice);
  }

  return {
    element: shell.element,
    update(state) {
      const { page, picked } = state;
      const kind = partKindOf(page, picked);
      const now = `${mode}:${kind === 'page' || kind === 'list' ? kind : `${kind}:${picked.join(',')}`}`;
      if (now !== key) {
        key = now;
        view?.destroy?.();
        view = viewOf(kind, picked);
        shell.show(kind, view, mode);
      }
      view?.update(page);
      shell.head(headOf(page, kind, picked, (id) => designer.isFromModel(id)));
      search.refresh();
      // The canvas wears the page's look as it is set.
      if (wearer) wearLook(wearer, page.look);
    },
    setMode(next) {
      mode = next;
      key = '';
      this.update(designer.getState());
    },
    destroy() {
      view?.destroy?.();
      view = null;
    },
    findItems() {
      const page = designer.getPage();
      const own = shell.rows();
      const items = settingItems(
        own.map((row) => ({ ...row, tab: TAB_NAMES[row.tab], row })),
        ({ row }, choice) => go(row.tab, row.name, choice)
      );
      // The page's look, from wherever: what is picked is put down to show it. Simple keeps the look as it is.
      if (mode === 'simple' || partKindOf(page, designer.getState().picked) === 'page' || page.layout.type === 'list') return items;
      const look = pageLookSettings(el, designer);
      look.update(page);
      const names = new Set(own.map((row) => row.name));
      const rows = settingRows(el('div', {}, ...look.rows), 'look');
      return [
        ...items,
        ...settingItems(
          rows.map((row) => ({ ...row, name: names.has(row.name) ? `The page’s ${row.name.toLowerCase()}` : row.name, tab: 'the page’s look', own: row.name })),
          ({ own: name }, choice) => {
            designer.select(null);
            go('look', name, choice);
          }
        ),
      ];
    },
    open(part) {
      shell.choose(PART_TAB[part]);
      view?.focus?.(part);
      const panel = shell.element;
      panel.classList.remove('fd-flash');
      void panel.offsetWidth;
      panel.classList.add('fd-flash');
    },
  };
}
