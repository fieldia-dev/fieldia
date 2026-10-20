import { ANY_FUNCTION, compileModifier, relatedInTab, type ButtonNode, type LayoutNode, type Page, type SheetNode } from '@fieldia/core';

/**
 * What a record's head (`SheetHead`) holds, for the designer's walk through a
 * page: the parts with ids of their own — its buttons and their menus' items,
 * its row's fields and links, its band's parts — and the fields it names, so
 * an edit elsewhere never drops a field the head shows or reads.
 */

/** The parts of a sheet's head with ids of their own. */
export function headParts(root: SheetNode): { id: string }[] {
  const head = root.head;
  if (!head) return [];
  const buttons = head.actions ?? [];
  return [...buttons, ...buttons.flatMap((button) => button.menu ?? []), ...(head.meta ?? []), ...(head.band?.children ?? [])];
}

/** The fields a sheet's head names besides its parts' own: the kind's and the number's, who updated it and when, and what a toggle reads. */
export function headFields(root: SheetNode): string[] {
  const head = root.head;
  if (!head) return [];
  const names = [head.kind?.field, head.kind?.numberField, head.updated?.byField, head.updated?.atField].filter((name): name is string => !!name);
  for (const button of [...(head.actions ?? []), ...(root.buttons ?? [])]) names.push(...pressedReads(button));
  return names;
}

/** The fields a toggle's condition reads. */
function pressedReads(button: ButtonNode): string[] {
  if (typeof button.pressed !== 'string') return [];
  try {
    return [...compileModifier(button.pressed, ANY_FUNCTION).fields];
  } catch {
    // A condition that does not read is the page's checks' to say.
    return [];
  }
}

/** The fields a page's tabs count (a tab's `count`, a field's), wherever the tabs are. */
export function tabCountFields(page: Page): string[] {
  const found: string[] = [];
  const walk = (nodes: readonly LayoutNode[]) => {
    for (const node of nodes) {
      if (node.type === 'section') walk(node.children);
      if (node.type === 'tabs') {
        for (const tab of node.children) {
          if (typeof tab.count === 'string' && tab.count) found.push(tab.count);
          walk(tab.children);
        }
      }
    }
  };
  const root = page.layout;
  if (root.type === 'tabs') walk([root]);
  else if (root.type === 'wizard') for (const step of root.children) walk(step.children);
  else if (root.type !== 'list') walk(root.children);
  return found;
}

/**
 * A tab's count of a related list it no longer holds — the list taken away, or moved out of the tab — goes with it:
 * the tab is left without a count, as it was before one was set.
 */
export function forgetGoneCounts(page: Page): void {
  const walk = (nodes: readonly LayoutNode[]) => {
    for (const node of nodes) {
      if (node.type === 'section') walk(node.children);
      if (node.type === 'tabs') {
        for (const tab of node.children) {
          if (tab.count && typeof tab.count !== 'string' && !relatedInTab(tab, tab.count.related)) delete tab.count;
          walk(tab.children);
        }
      }
    }
  };
  const root = page.layout;
  if (root.type === 'tabs') walk([root]);
  else if (root.type === 'wizard') for (const step of root.children) walk(step.children);
  else if (root.type !== 'list') walk(root.children);
}
