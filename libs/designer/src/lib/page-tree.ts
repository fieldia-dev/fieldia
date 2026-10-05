import type { FieldNode, FilterItem, LayoutNode, Page, SectionNode, StepNode, TabNode, TabsNode } from '@fieldia/core';
import type { DesignerWords } from './designer-words';
import { en } from './locales/en';

/**
 * Finding one's way around a page's layout, for the designer's edits: the
 * containers that hold fields, a node and where it sits, a tab and its tabs.
 */

export type Container = { id: string; children: LayoutNode[] };

/** Every container that holds fields: steps, sections, tabs, and a page of sections or a sheet itself. */
export function containers(page: Page): Container[] {
  const found: Container[] = [];
  const walk = (nodes: LayoutNode[]) => {
    for (const node of nodes) {
      if (node.type === 'section') {
        found.push(node);
        walk(node.children);
      } else if (node.type === 'tabs') {
        for (const tab of node.children) {
          found.push(tab);
          walk(tab.children);
        }
      }
    }
  };
  const root = page.layout;
  if (root.type === 'wizard') {
    for (const step of root.children) {
      found.push(step);
      walk(step.children);
    }
  } else if (root.type === 'tabs') {
    for (const tab of root.children) {
      found.push(tab);
      walk(tab.children);
    }
  } else if (root.type !== 'list') {
    if (root.type === 'sections' || root.type === 'sheet') found.push(root);
    walk(root.children);
  }
  return found;
}

export function findNode(page: Page, id: string): { node: LayoutNode; parent: Container; index: number } | null {
  for (const parent of containers(page)) {
    const index = parent.children.findIndex((child) => child.id === id);
    if (index !== -1) return { node: parent.children[index], parent, index };
  }
  return null;
}

export function findContainer(page: Page, id: string): Container | (StepNode | SectionNode | TabNode) | null {
  return containers(page).find((c) => c.id === id) ?? null;
}

/** Every tabs node, wherever it sits. */
export function tabsNodes(page: Page): TabsNode[] {
  const found: TabsNode[] = [];
  const root = page.layout;
  if (root.type === 'tabs') found.push(root);
  for (const container of containers(page)) for (const child of container.children) if (child.type === 'tabs') found.push(child);
  return found;
}

/** A tab, the tabs it belongs to, and its place among them. */
export function findTab(page: Page, id: string): { tab: TabNode; tabs: TabsNode; index: number } | null {
  for (const tabs of tabsNodes(page)) {
    const index = tabs.children.findIndex((tab) => tab.id === id);
    if (index !== -1) return { tab: tabs.children[index], tabs, index };
  }
  return null;
}

/** The first section, wherever it sits: where a field with nowhere else to go is put. */
export function firstSection(page: Page): SectionNode | null {
  return (containers(page).find((c) => (c as SectionNode).type === 'section') as SectionNode | undefined) ?? null;
}

export function nextName(taken: (name: string) => boolean, prefix: string, sep: string): string {
  for (let n = 1; ; n++) if (!taken(`${prefix}${sep}${n}`)) return `${prefix}${sep}${n}`;
}

export function allIds(page: Page): Set<string> {
  const ids = new Set<string>([page.layout.id]);
  for (const c of containers(page)) {
    ids.add(c.id);
    for (const child of c.children) ids.add(child.id);
  }
  // A sheet's header parts have ids of their own.
  const root = page.layout;
  if (root.type === 'sheet') for (const part of [...(root.buttons ?? []), ...(root.statButtons ?? []), ...(root.badges ?? []), ...(root.alerts ?? []), ...(root.ribbon ? [root.ribbon] : [])]) ids.add(part.id);
  // A list's filters and buttons too.
  if (root.type === 'list') for (const part of [...(root.filters ?? []), ...(root.actions ?? [])]) ids.add(part.id);
  return ids;
}

/** The fields the page shows somewhere: in its containers, and in a sheet's title, statusbar and stat buttons. */
export function shownFields(page: Page): Set<string> {
  const shown = new Set(containers(page).flatMap((c) => c.children.filter((n): n is FieldNode => n.type === 'field').map((n) => n.field)));
  const root = page.layout;
  if (root.type === 'sheet') {
    const title = root.title;
    for (const name of [title?.field, title?.subtitleField, title?.avatarField, root.statusbar?.field, ...(root.statButtons ?? []).map((s) => s.field)]) if (name) shown.add(name);
    for (const node of [...(title?.above ?? []), ...(title?.below ?? [])]) shown.add(node.field);
  }
  // A list names its fields in its columns, order, search, filters and groupings.
  if (root.type === 'list') {
    const read = (items: readonly FilterItem[]): string[] => items.flatMap((i) => ('any' in i ? read(i.any) : 'all' in i ? read(i.all) : [i.field]));
    for (const name of [...root.columns, ...(root.sort ?? []).map((s) => s.field), ...(root.searchFields ?? []), ...(root.groupBy ?? []), ...(root.filters ?? []).flatMap((f) => read(f.filter))]) shown.add(name);
  }
  return shown;
}

/** Every section, wherever it sits: at the top, in a section, or in a tab. */
export function allSections(page: Page): SectionNode[] {
  return containers(page).filter((c): c is SectionNode => (c as SectionNode).type === 'section');
}

/** A field node in a section, and that section. */
export function findField(page: Page, id: string): { node: FieldNode; section: SectionNode } | null {
  for (const section of allSections(page)) {
    const node = section.children.find((n): n is FieldNode => n.type === 'field' && n.id === id);
    if (node) return { node, section };
  }
  return null;
}

/** A section's name as a list of them shows it: the tab it is in first, when it is in one. */
export function sectionLabel(page: Page, section: SectionNode, words: DesignerWords = en): string {
  const own = section.title || words.parts.untitledSection;
  const tab = tabsNodes(page)
    .flatMap((tabs) => tabs.children)
    .find((t) => t.children.includes(section));
  return tab ? words.parts.inTab(tab.label, own) : own;
}

/** Whether `id` is the tab, or something inside it. */
export function tabHolds(tab: TabNode, id: string | null): boolean {
  if (!id) return false;
  if (tab.id === id) return true;
  const walk = (nodes: LayoutNode[]): boolean => nodes.some((n) => n.id === id || ('children' in n && Array.isArray(n.children) && walk(n.children as LayoutNode[])));
  return walk(tab.children);
}
