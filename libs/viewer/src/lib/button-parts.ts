import type { ActionStep, ButtonNode, Form, FormState, MenuItem, RunResult, Tone } from '@fieldia/core';
import { drawIcon, type IconSet } from '@fieldia/widgets';
import { setAttr, setHidden, setText, type El } from './dom';
import { hotkeyOn } from './hotkeys';
import type { ViewerLabels } from './labels';

/** What a button of the newer kinds needs of the viewer that draws it. */
export interface ButtonContext {
  doc: Document;
  el: El;
  form: Form;
  labels: ViewerLabels;
  icons?: IconSet;
  uid(id: string): string;
  withIcon(name: string | undefined, text: string): (Node | string)[];
  /** A press: one run at a time, the button busy meanwhile. */
  press(button: HTMLElement, run: () => Promise<RunResult>): Promise<void>;
  say(message: string, tone: Tone): void;
  /** Its updater, run at every change of the form. */
  watch(update: (state: FormState) => void): void;
  cleanups: (() => void)[];
}

/** Whether a button asks for more than words and steps: its icon alone, a toggle, a menu, a look that follows the record's changes. */
export function isRichButton(node: ButtonNode): boolean {
  return !!(node.iconOnly || node.pressed !== undefined || node.menu?.length || node.primaryWhenChanged);
}

/** Steps that only put back what changed: Undo's. */
export const onlyResets = (steps: readonly ActionStep[] | undefined, action?: string) => !!steps?.length && action === undefined && steps.every((step) => step.do === 'reset');

/**
 * A press that has nothing to do says so instead: Undo with nothing changed
 * ("Nothing has changed."), never a control greyed out without a reason.
 * True when it said so.
 */
export function nothingToUndo(node: ButtonNode, form: Form, say: (message: string, tone: Tone) => void, labels: ViewerLabels): boolean {
  if (!onlyResets(node.steps, node.action) || form.getState().dirty.length) return false;
  say(labels.nothingChanged, 'info');
  return true;
}

/**
 * A button of the record's head, or one anywhere asking for the same: its
 * icon alone (named by its label, which is its tooltip too); a toggle,
 * pressed while its condition holds and showing its pressed words meanwhile;
 * a split button — its press, then a chevron (or its own icon, Follow's gear)
 * opening a menu of more; a menu button when it has nothing of its own to
 * run; the primary look while the record has changes, quiet but usable
 * otherwise — with nothing changed, Save and Close simply closes.
 */
export function richButton(context: ButtonContext, node: ButtonNode): HTMLElement {
  const { el, form, labels } = context;
  const own = !!node.steps?.length || node.action !== undefined;
  const menu = node.menu?.length ? node.menu : null;
  const look = () => (node.primaryWhenChanged ? (form.getState().dirty.length ? 'primary' : 'subtle') : node.style ?? 'secondary');
  const words = el('bdi', { class: 'fd-button-words' }, node.label);
  const icon = drawIcon(context.doc, node.icon, context.icons);
  const main = el('button', { type: 'button', class: 'fd-button', 'data-node': menu && own ? undefined : node.id });
  if (icon) main.append(icon);
  if (node.iconOnly) {
    main.classList.add('fd-button-icon-only');
    main.setAttribute('aria-label', node.label);
    main.title = node.label;
  } else main.append(words);
  if (node.hotkey) hotkeyOn(main, node.hotkey, node.label);

  /** What a press of the button itself does: its steps and action — Save and Close with nothing to save only closes. */
  const run = (): Promise<RunResult> => {
    const state = form.getState();
    if (node.primaryWhenChanged && !state.dirty.length && state.recordId != null && node.steps?.some((step) => step.do === 'save')) {
      const steps: ActionStep[] = [...(node.steps ?? []).filter((step) => step.do !== 'save'), ...(node.action !== undefined ? [{ do: 'call' as const, action: node.action, ...(node.params ? { params: node.params } : {}) }] : [])];
      return form.run(steps, { id: node.id });
    }
    return form.runAction(node.id);
  };

  if (!menu) {
    main.classList.add(`fd-button-${look()}`);
    main.addEventListener('click', () => {
      if (!nothingToUndo(node, form, context.say, labels)) void context.press(main, run);
    });
    context.watch(() => paint(main));
    return main;
  }

  // ---- a menu beside it, or a menu alone ----
  const id = context.uid(`${node.id}-menu`);
  const chevron = drawIcon(context.doc, node.menuIcon ?? 'chevron-down', context.icons);
  const opener = own ? el('button', { type: 'button', class: 'fd-button fd-split-more', id: `${id}-button`, 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': id }) : main;
  // Its own name, never the button's: a reader hears two buttons, not one twice.
  const menuName = node.menuLabel ?? labels.optionsFor.replace('{label}', node.label);
  if (own) {
    opener.setAttribute('aria-label', menuName);
    opener.title = menuName;
  } else {
    opener.id = `${id}-button`;
    for (const [name, value] of Object.entries({ 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': id })) opener.setAttribute(name, value);
  }
  if (chevron) {
    chevron.classList.add('fd-split-icon');
    opener.append(chevron);
  }
  const list = el('div', { class: 'fd-record-menu fd-button-menu', role: 'menu', id, 'aria-labelledby': opener.id, hidden: '' });
  const items = menu.map((item: MenuItem) => {
    const button = el('button', { type: 'button', role: 'menuitem', tabindex: '-1', class: 'fd-record-menu-item', 'data-node': item.id }, ...context.withIcon(item.icon, item.label ?? item.id));
    button.addEventListener('click', () => {
      close(true);
      void context.press(opener, () => form.runAction(item.id));
    });
    return { item, button };
  });
  list.append(...items.map((i) => i.button));
  const parts: HTMLElement[] = own ? [main, el('span', { class: 'fd-split-rule', 'aria-hidden': 'true' }), opener] : [main];
  const box = el('div', { class: `fd-split${own ? '' : ' fd-split-alone'}`, 'data-node': node.id, role: own ? 'group' : undefined, 'aria-label': own ? node.label : undefined }, ...parts, list);

  const shown = () => items.filter((i) => !i.button.hidden).map((i) => i.button);
  const outside = (event: Event) => {
    if (!box.contains(event.target as Node)) close(false);
  };
  function open(at: 'first' | 'last') {
    if (!list.hidden) return;
    list.hidden = false;
    // Under the button's start, unless that runs past the window: then from its end.
    list.removeAttribute('data-end');
    const room = list.getBoundingClientRect();
    if (room.right > context.doc.documentElement.clientWidth - 4 || room.left < 4) list.setAttribute('data-end', '');
    opener.setAttribute('aria-expanded', 'true');
    context.doc.addEventListener('pointerdown', outside, true);
    const found = shown();
    (at === 'first' ? found[0] : found[found.length - 1])?.focus();
  }
  function close(refocus: boolean) {
    if (list.hidden) return;
    list.hidden = true;
    opener.setAttribute('aria-expanded', 'false');
    context.doc.removeEventListener('pointerdown', outside, true);
    if (refocus) opener.focus();
  }
  context.cleanups.push(() => context.doc.removeEventListener('pointerdown', outside, true));
  opener.addEventListener('click', () => (list.hidden ? open('first') : close(false)));
  opener.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    open(event.key === 'ArrowDown' ? 'first' : 'last');
  });
  if (own) {
    main.addEventListener('click', () => {
      if (!nothingToUndo(node, form, context.say, labels)) void context.press(main, run);
    });
  }
  list.addEventListener('keydown', (event) => {
    const found = shown();
    const at = found.indexOf(context.doc.activeElement as HTMLButtonElement);
    const to = ({ ArrowDown: at + 1, ArrowUp: at - 1, Home: 0, End: found.length - 1 } as Record<string, number>)[event.key];
    if (to !== undefined) {
      event.preventDefault();
      found[(to + found.length) % found.length]?.focus();
    } else if (event.key === 'Escape') {
      // Escape closes the menu, not the dialog round the form.
      event.preventDefault();
      event.stopPropagation();
      close(true);
    } else if (event.key === 'Tab') close(false);
  });
  context.watch(() => {
    paint(main);
    if (own) paint(opener);
    box.setAttribute('data-look', look());
    for (const { item, button } of items) setHidden(button, form.node(item.id).invisible);
    // A menu with nothing in it shows no chevron.
    setHidden(opener, !items.some((i) => !i.button.hidden) && own);
  });
  return box;

  /** Its look and its words now: primary or quiet, pressed or not, hidden by its condition. */
  function paint(button: HTMLElement) {
    const at = form.node(node.id);
    if (button === main || !own) setHidden(menu ? box : button, at.invisible);
    for (const one of ['primary', 'secondary', 'subtle', 'danger', 'link']) button.classList.toggle(`fd-button-${one}`, one === look());
    if (node.pressed === undefined || button !== main) return;
    const pressed = at.pressed === true;
    setAttr(main, 'aria-pressed', String(pressed));
    const said = pressed && node.pressedLabel ? node.pressedLabel : node.label;
    if (node.iconOnly) {
      setAttr(main, 'aria-label', said);
      main.title = said;
    } else setText(words, said);
  }
}
