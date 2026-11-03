import type { ActionStep } from './actions';
import type { Field, LineField } from './field';
import type { ButtonNode, FieldNode, LayoutNode, MenuItem, RelatedNode, RootLayout, SheetNode, TabNode, TabsNode } from './layout';
// The head part's checks, through their stand-ins: owed until they are in (owed-checks.ts).
import { checkMenuOpener, checkSheetHead } from './owed-checks';

/**
 * The checks of a record's head (`SheetHead`) and of the parts it brought to
 * the format: the band's and the row's fields, its link and its buttons, a
 * tab's count, the tabs placed in the head, and the access keys of fields.
 * The reference check hands over its own tools, so what is said reads as the
 * rest of its findings.
 */
export interface HeadTools {
  claim(id: string, path: string): void;
  need(name: string, path: string): Field | LineField | undefined;
  report(path: string, message: string): void;
  /** A part as any in a group: its id, its conditions, its fields. */
  walkNode(node: LayoutNode, path: string): void;
  checkModifiers(owner: object, path: string, keys?: readonly string[]): void;
  checkSteps(steps: ActionStep[], path: string): void;
  /** A button's press: steps, an action, or a menu. */
  checkPress(button: ButtonNode, path: string): void;
  /** Whether an id is a part of this page, once the whole page has been walked. */
  isPart(id: string): boolean;
  /** Whether an id is a tab or a wizard step of this page. */
  isPlace(id: string): boolean;
  /** Said where checks come in a part that has not come (the one-tag script's: later-checks.ts): they are owed. */
  owe(part: string): void;
}

/** What a tab's count can count: a number, lines, links, files. */
const COUNTED = new Set(['integer', 'float', 'monetary', 'one2many', 'many2many', 'binary', 'image']);

/**
 * A button's own parts, wherever it stands: an icon to show alone, the
 * condition that presses a toggle, and the items of its menu — each one
 * doing something, and with words.
 */
export function checkButtonParts(button: ButtonNode, path: string, tools: MenuTools): void {
  if (button.iconOnly && !button.icon) tools.report(`${path}.iconOnly`, 'a button shown by its icon alone needs an icon');
  if (button.pressedLabel !== undefined && button.pressed === undefined) tools.report(`${path}.pressedLabel`, 'words while pressed need the condition that presses it (pressed)');
  if ((button.menuIcon !== undefined || button.menuLabel !== undefined) && !button.menu?.length) tools.report(`${path}.menu`, 'a chevron of its own needs a menu to open');
  tools.checkModifiers(button, path, ['pressed']);
  button.menu?.forEach((item, i) => checkMenuItem(item, `${path}.menu[${i}]`, tools));
}

/** What a menu's checks use of the reference check's tools. */
export type MenuTools = Pick<HeadTools, 'claim' | 'report' | 'checkModifiers' | 'checkSteps' | 'owe'>;

/**
 * An item of a menu — the record's gear menu, a button's — as a button of the record: its id, its condition, and what
 * it does, with words unless it is a built-in. A divider, and one that opens a menu of its own or the app's, are checked
 * with the head part, which draws them (`checkMenuOpener`).
 */
export function checkMenuItem(item: MenuItem, path: string, tools: MenuTools): void {
  tools.claim(item.id, path);
  tools.checkModifiers(item, path);
  if (item.type || item.menu || item.menuFrom !== undefined) return checkMenuOpener(item, path, { ...tools, item: checkMenuItem });
  if (!item.steps && item.action === undefined && !item.builtin) tools.report(path, 'a menu item needs steps, an action, a built-in, or a menu of its own');
  if (item.label === undefined && !item.builtin) tools.report(`${path}.label`, 'a menu item needs words, unless it is a built-in');
  if (item.steps) tools.checkSteps(item.steps, `${path}.steps`);
}

/** Every part of a layout with where it stands, the head's and the title's fields included. */
function eachPart(root: RootLayout, path: string, visit: (node: LayoutNode | TabNode, at: string, parent: RootLayout | LayoutNode | TabNode) => void) {
  const walk = (nodes: readonly LayoutNode[], at: string, parent: RootLayout | LayoutNode | TabNode) =>
    nodes.forEach((node, i) => {
      const here = `${at}[${i}]`;
      visit(node, here, parent);
      if (node.type === 'section') walk(node.children, `${here}.children`, node);
      if (node.type === 'tabs') {
        node.children.forEach((tab, j) => {
          visit(tab, `${here}.children[${j}]`, node);
          walk(tab.children, `${here}.children[${j}].children`, tab);
        });
      }
      if (node.type === 'field' && node.lineForm) walk(node.lineForm.children, `${here}.lineForm.children`, node);
    });
  if (root.type === 'tabs') {
    visit(root, path, root);
    root.children.forEach((tab, j) => {
      visit(tab, `${path}.children[${j}]`, root);
      walk(tab.children, `${path}.children[${j}].children`, tab);
    });
    return;
  }
  if (root.type === 'list') return;
  if (root.type === 'wizard') return root.children.forEach((step, i) => walk(step.children, `${path}.children[${i}].children`, root));
  walk(root.children, `${path}.children`, root);
  if (root.type !== 'sheet') return;
  for (const place of ['above', 'before', 'after', 'below'] as const) walk(root.title?.[place] ?? [], `${path}.title.${place}`, root);
  walk((root.head?.meta ?? []).filter((part): part is FieldNode => part.type === 'field'), `${path}.head.meta`, root);
  walk(root.head?.band?.children ?? [], `${path}.head.band.children`, root);
}

/**
 * The record's head, once the whole page is walked: its kind, its row, its
 * buttons, its band and "Updated by"; then, over the whole page, tabs placed
 * in a head they are not directly under, a tab's icon and count, and the
 * access keys of fields — one field each.
 */
export function checkHead(root: RootLayout, path: string, tools: HeadTools): void {
  if (root.type === 'sheet' && root.head) checkSheetHead(root, path, tools);
  const keys = new Map<string, string>();
  let headTabs = 0;
  eachPart(root, path, (node, at, parent) => {
    if (node.type === 'tabs' && node.place === 'head') {
      const placed = parent.type === 'sheet' && !!(parent as SheetNode).head && (parent as SheetNode).children.includes(node);
      if (!placed) tools.report(`${at}.place`, 'tabs go in the head only from directly in a sheet with a head');
      else if (++headTabs > 1) tools.report(`${at}.place`, 'a head holds one row of tabs');
    }
    if (node.type === 'tab') checkTab(node, at, tools);
    if (node.type === 'field' && node.hotkey !== undefined) {
      const first = keys.get(node.hotkey);
      if (first !== undefined) tools.report(`${at}.hotkey`, `Alt+${node.hotkey.toUpperCase()} takes the focus to the field at ${first} already`);
      else keys.set(node.hotkey, at);
    }
  });
}

/** A tab's icon shown alone, and the field or the related list in it it counts. */
function checkTab(tab: TabNode, path: string, tools: HeadTools) {
  if (tab.iconOnly && !tab.icon) tools.report(`${path}.iconOnly`, 'a tab shown by its icon alone needs an icon');
  const count = tab.count;
  if (count === undefined) return;
  if (typeof count !== 'string') {
    if (!relatedInTab(tab, count.related)) tools.report(`${path}.count.related`, `"${count.related}" is no related list in this tab: a tab counts the records of one it holds`);
    return;
  }
  const def = tools.need(count, `${path}.count`);
  if (def && !COUNTED.has(def.type)) tools.report(`${path}.count`, `"${count}" is a ${def.type}; a tab counts a number, a table's lines, links or files`);
}

/** The related list of this id inside a tab — in its groups, or tabs of its own — whose records it counts; null where it holds none. */
export function relatedInTab(tab: TabNode, id: string): RelatedNode | null {
  const find = (nodes: readonly LayoutNode[]): RelatedNode | null => {
    for (const node of nodes) {
      if (node.type === 'related' && node.id === id) return node;
      const inner = node.type === 'section' ? find(node.children) : node.type === 'tabs' ? find(node.children.flatMap((one) => one.children)) : null;
      if (inner) return inner;
    }
    return null;
  };
  return find(tab.children);
}

/** The tabs a sheet places in its head, if it does. */
export function headTabs(sheet: SheetNode): TabsNode | undefined {
  return sheet.head ? sheet.children.find((child): child is TabsNode => child.type === 'tabs' && child.place === 'head') : undefined;
}
