import type { Page } from '@fieldia/core';
import type { ElementFactory } from './chrome';
import { findHeaderPart } from './header-commands';
import { isSection, isWrapper, locate } from './layout-tree';

/**
 * The panel's tabs: Content, Layout, Look, Rules and Data, and which of them
 * apply to what is picked — as the approved mockup's `tabsFor` gives them. A
 * part's words are its content; where it sits and how wide, its layout; how a
 * group or the page is drawn, its look; when it shows or must be answered,
 * its rules; what it is stored as, its data.
 */

export type PanelTab = 'content' | 'layout' | 'look' | 'rules' | 'data';

export const TAB_NAMES: Record<PanelTab, string> = { content: 'Content', layout: 'Layout', look: 'Look', rules: 'Rules', data: 'Data' };

/** In the order the tabs stand. */
export const TAB_ORDER: readonly PanelTab[] = ['content', 'layout', 'look', 'rules', 'data'];

/** What is picked, as the panel tells kinds of part apart. */
export type PartKind =
  | 'page'
  | 'field'
  | 'group'
  /** A section with no title in the plain style: there only to put parts side by side. */
  | 'arrangement'
  | 'tabs'
  | 'tab'
  /** Words, a heading, a button, an image, a divider or a spacer. */
  | 'block'
  | 'several'
  /** A button, a counter or a badge in a sheet's header. */
  | 'header'
  | 'statusbar'
  | 'list'
  | 'column'
  | 'action';

export function tabsFor(kind: PartKind): PanelTab[] {
  switch (kind) {
    case 'page':
      return ['content', 'layout', 'look'];
    case 'group':
      return ['content', 'layout', 'look', 'rules'];
    case 'field':
      return ['content', 'layout', 'rules', 'data'];
    case 'arrangement':
    case 'several':
      return ['layout'];
    case 'tabs':
    case 'block':
      return ['content', 'layout'];
    default:
      return ['content'];
  }
}

/** The kind of what is picked: nothing, one part, or several. */
export function partKindOf(page: Page, picked: readonly string[]): PartKind {
  if (picked.length > 1) return 'several';
  const id = picked[0] ?? null;
  const layout = page.layout;
  if (layout.type === 'list') {
    if (id?.startsWith('column:') && layout.columns.includes(id.slice('column:'.length))) return 'column';
    return id && layout.actions?.some((a) => a.id === id) ? 'action' : 'list';
  }
  if (id === null) return 'page';
  if (findHeaderPart(page, id)) return 'header';
  if (id === '#statusbar') return layout.type === 'sheet' && layout.statusbar ? 'statusbar' : 'page';
  const node = locate(page, id)?.node;
  if (!node) return 'page';
  if (node.type === 'field') return 'field';
  if (isSection(node)) return isWrapper(node) ? 'arrangement' : 'group';
  if (node.type === 'tabs' || node.type === 'tab') return node.type;
  return 'block';
}

let made = 0;

export interface TabStrip {
  element: HTMLElement;
  /** Draw these tabs, `current` chosen. */
  show(tabs: readonly PanelTab[], current: PanelTab): void;
  /** The id of the panel a tab controls. */
  panelId(tab: PanelTab): string;
  tabId(tab: PanelTab): string;
}

/**
 * The tabs, as a tablist: one in the Tab order, the arrows going along it and
 * round its ends (mirrored right to left), Home and End to its ends. A tab is
 * chosen as the arrows reach it, as the panels show at once.
 */
export function tabStrip(el: ElementFactory, choose: (tab: PanelTab) => void): TabStrip {
  const base = `fd-insp-${++made}`;
  const element = el('div', { class: 'fd-insp-tabs', role: 'tablist', 'aria-label': 'Settings' });
  const buttons = () => [...element.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  const go = (button: HTMLButtonElement | undefined) => {
    if (!button) return;
    choose(button.dataset['tab'] as PanelTab);
    // Chosen, the strip is drawn again: the tab of that name takes the focus.
    element.querySelector<HTMLButtonElement>(`[data-tab="${button.dataset['tab']}"]`)?.focus();
  };
  element.addEventListener('keydown', (event) => {
    const all = buttons();
    const at = all.indexOf(event.target as HTMLButtonElement);
    if (at === -1) return;
    const rtl = element.ownerDocument.defaultView?.getComputedStyle(element).direction === 'rtl';
    const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[event.key];
    let to: number | null = null;
    if (step !== undefined) to = (at + step + all.length) % all.length;
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = all.length - 1;
    if (to === null) return;
    event.preventDefault();
    go(all[to]);
  });
  const tabId = (tab: PanelTab) => `${base}-tab-${tab}`;
  const panelId = (tab: PanelTab) => `${base}-panel-${tab}`;
  return {
    element,
    tabId,
    panelId,
    show(tabs, current) {
      const key = tabs.join(',');
      if (element.dataset['tabs'] !== key) {
        element.dataset['tabs'] = key;
        element.replaceChildren(
          ...tabs.map((tab) => {
            const button = el('button', { type: 'button', role: 'tab', class: 'fd-insp-tab', id: tabId(tab), 'data-tab': tab, 'aria-controls': panelId(tab) }, TAB_NAMES[tab]);
            button.addEventListener('click', () => choose(tab));
            return button;
          })
        );
      }
      for (const button of buttons()) {
        const on = button.dataset['tab'] === current;
        button.setAttribute('aria-selected', String(on));
        button.tabIndex = on ? 0 : -1;
      }
    },
  };
}
