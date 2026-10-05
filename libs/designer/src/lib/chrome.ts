import type { Field, FieldNode } from '@fieldia/core';
import type { Designer, DesignerState } from './designer';
import { openFind, type FindItem } from './find-anything';
import { kindOfField } from './kinds';
import { listSource } from './list-source';
import { designerIcon } from './icons';
import { checksButton, openPublishDialog, statusWords, versionsMenu, type GoTo } from './publish-ui';
import { setHidden, setText } from './writes';

/** The parts both editors share: the bar with undo and publish, and the list of options. */

export type ElementFactory = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | undefined>,
  ...children: (Node | string)[]
) => HTMLElementTagNameMap[K];

export function elementFactory(doc: Document): ElementFactory {
  return (tag, attrs = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) if (value !== undefined) node.setAttribute(name, value);
    node.append(...children);
    return node;
  };
}

export function iconButton(el: ElementFactory, label: string, text: string, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = el('button', { type: 'button', class: `fd-icon-button ${extra}`.trim(), 'aria-label': label, title: label }, text);
  b.addEventListener('click', onClick);
  return b;
}

/** What works on the thing picked, so a click on it keeps it picked: the panel, the toolbox, the bar, a menu, a dialog, and any control. */
const KEEPS_PICKED = '.fd-properties, .fd-rail, .fd-toolbox, .fd-designer-bar, .fd-designer-issues, .fd-menu, .fd-checks, .fd-find, .fd-dialog-backdrop, .fd-try, button, input, select, textarea, a, label, [role="button"], [role="tab"]';

/**
 * A click on empty room puts down what is picked: on the canvas around the
 * fields, between the editor's parts, or anywhere outside the editor. A click
 * on a field or a part of the page (`pickable`) picks that instead, and one
 * on the panel, the toolbox or any control works on what is picked, so both
 * leave it be. Returns the way to stop.
 */
export function putDownOnClickOutside(root: HTMLElement, designer: Designer, pickable: string, active: () => boolean): () => void {
  const doc = root.ownerDocument;
  const onClick = (event: MouseEvent) => {
    if (!active() || designer.getState().selected === null) return;
    const target = event.target as Element | null;
    // Gone from the page by its own click — a card that opened, a menu that closed: that click picked something.
    if (!target?.isConnected) return;
    if (root.contains(target) && target.closest(`${pickable}, ${KEEPS_PICKED}`)) return;
    designer.select(null);
  };
  doc.addEventListener('click', onClick);
  return () => doc.removeEventListener('click', onClick);
}

export interface DesignerBar {
  element: HTMLElement;
  /** Why the last edit was refused, if it was. */
  issues: HTMLElement;
  update(state: DesignerState): void;
  destroy(): void;
}

/**
 * The page title, where the page stands (draft, published) opening the
 * versions published, Undo and Redo, Checks, and Publish asking first — each
 * shown only when it can act. Ctrl/Cmd+Z and Shift+Z or Y undo and redo
 * anywhere in `root` outside a text box.
 */
export function designerBar(
  root: HTMLElement,
  designer: Designer,
  options: { titleLabel: string; placeholder: string; extra?: Node[]; goTo?: GoTo; find?: () => FindItem[] }
): DesignerBar {
  const doc = root.ownerDocument;
  const el = elementFactory(doc);
  const title = el('input', { class: 'fd-input fd-designer-title', 'aria-label': options.titleLabel, placeholder: options.placeholder });
  title.addEventListener('input', () => designer.setPageInfo({ title: title.value }));
  // Where the page stands, as words a screen reader hears change; pressed, the versions published.
  const status = el('button', { type: 'button', class: 'fd-designer-status', 'aria-haspopup': 'menu', 'aria-expanded': 'false', title: 'Versions' });
  status.addEventListener('click', () => versionsMenu(el, designer, status));
  const goTo: GoTo = options.goTo ?? (() => undefined);
  const checks = checksButton(el, doc, designer, goTo);
  const undo = el('button', { type: 'button', class: 'fd-button' }, 'Undo');
  const redo = el('button', { type: 'button', class: 'fd-button' }, 'Redo');
  const publish = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, 'Publish');
  undo.addEventListener('click', () => designer.undo());
  redo.addEventListener('click', () => designer.redo());
  publish.addEventListener('click', () => openPublishDialog(el, designer, root, goTo));
  // Find anything: what the editor offers, then what the bar itself can do.
  const findItems = (): FindItem[] => {
    const state = designer.getState();
    return [
      ...(options.find?.() ?? []),
      { label: 'Show the checks', hint: checks.element.getAttribute('aria-label') ?? '', run: () => checks.element.click() },
      ...(state.unpublished ? [{ label: 'Publish', hint: `version ${(state.versions[state.versions.length - 1]?.version ?? 0) + 1}`, run: () => publish.click() }] : []),
      ...(state.canUndo ? [{ label: 'Undo', hint: '⌘Z', run: () => designer.undo() }] : []),
      ...(state.canRedo ? [{ label: 'Redo', hint: '⇧⌘Z', run: () => designer.redo() }] : []),
      ...(state.versions.length ? [{ label: 'Open an earlier version', hint: 'versions', run: () => status.click() }] : []),
    ];
  };
  const mac = /Mac|iPhone|iPad/.test(doc.defaultView?.navigator.platform ?? '');
  const keys = mac ? '⌘K' : 'Ctrl K';
  const find = el('button', { type: 'button', class: 'fd-button fd-find-button', 'aria-label': 'Find anything', title: `Find anything · ${keys} or /` }, designerIcon(doc, 'search'), el('kbd', { class: 'fd-find-keys', 'aria-hidden': 'true' }, keys));
  find.addEventListener('click', () => openFind(el, root, findItems()));
  // Where the bar breaks when it has less room than its parts: the ways to look at the page go under the rest.
  const lineBreak = el('span', { class: 'fd-bar-break', 'aria-hidden': 'true' });
  const element = el('div', { class: 'fd-designer-bar' }, title, el('span', { class: 'fd-designer-status-box', role: 'status' }, status), el('span', { class: 'fd-spacer' }), find, undo, redo, lineBreak, ...(options.extra ?? []), checks.element, publish);
  // What sticks under the bar while the page scrolls (the toolbox, the panel) stops below it, as tall as it is now.
  // And what takes focus is scrolled to below it, never under it (WCAG 2.4.11): the page's scroller keeps that room at its top.
  const scroller = doc.documentElement;
  const room = () => {
    const height = Math.ceil(element.getBoundingClientRect().height);
    root.style.setProperty('--fd-bar-room', `${height + 12}px`);
    scroller.style.scrollPaddingTop = `${height + 8}px`;
  };
  const view = root.ownerDocument.defaultView;
  const sized = view && 'ResizeObserver' in view ? new view.ResizeObserver(room) : null;
  sized?.observe(element);
  const issues = el('div', { class: 'fd-alert fd-tone-danger fd-designer-issues', role: 'alert', hidden: '' });

  // On the document: clicking an area that cannot take focus leaves focus on
  // the body, and keys pressed then never reach the editor's own element.
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target !== doc.body && !root.contains(target)) return;
    const typing = target.closest('input, textarea, select, [contenteditable]');
    const key = event.key.toLowerCase();
    // ⌘K or Ctrl+K anywhere, / when not typing: Find anything. Not with Shift: Ctrl+Shift+K moves a question.
    const chord = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey && key === 'k';
    const slash = key === '/' && !typing && !event.ctrlKey && !event.metaKey && !event.altKey;
    if ((chord || slash) && !root.querySelector('.fd-find')) {
      event.preventDefault();
      openFind(el, root, findItems());
      return;
    }
    if (typing || !(event.ctrlKey || event.metaKey)) return;
    if (key === 'z' && !event.shiftKey) {
      event.preventDefault();
      designer.undo();
    } else if ((key === 'z' && event.shiftKey) || key === 'y') {
      event.preventDefault();
      designer.redo();
    }
  };
  doc.addEventListener('keydown', onKey);

  return {
    element,
    issues,
    update(state) {
      if (doc.activeElement !== title && title.value !== (state.page.title ?? '')) title.value = state.page.title ?? '';
      setHidden(undo, !state.canUndo);
      setHidden(redo, !state.canRedo);
      setHidden(publish, !state.unpublished);
      setText(status, statusWords(state));
      checks.update();
      setHidden(issues, state.issues.length === 0);
      setText(issues, state.issues.join('\n'));
    },
    destroy() {
      doc.removeEventListener('keydown', onKey);
      sized?.disconnect();
      scroller.style.removeProperty('scroll-padding-top');
      checks.destroy();
    },
  };
}

export interface OptionsEditor {
  element: HTMLElement;
  /** Show the field's options; hidden for a field without any. With its node, the kind decides the rest: numbers for a dropdown, "Other" for multiple choice and checkboxes. */
  update(field: Field, node?: FieldNode): void;
}

/**
 * The choices of a question, one input each, kept by position so typing in
 * one keeps its focus — typed the Google Forms way: Enter adds the next one
 * under it, Backspace in an empty one takes it away, and one left empty goes
 * when the cursor leaves it. Each is moved by its grip, or by Alt+↑/↓ in its
 * box; checkboxes take "None of these", an option that goes alone.
 */
export function optionsEditor(el: ElementFactory, designer: Designer, nodeId: string): OptionsEditor {
  const list = el('ul', { class: 'fd-q-options' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-add-option' }, 'Add option');
  // Google Forms' "Add option or add "Other"": an answer of one's own, after the options.
  const addOther = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-add-other' }, 'add “Other”');
  addOther.addEventListener('click', () => designer.setOther(nodeId, true));
  const or = el('span', { class: 'fd-q-or' }, 'or');
  const removeOther = iconButton(el, 'Remove “Other”', '×', () => designer.setOther(nodeId, false));
  const otherRow = el('div', { class: 'fd-q-option fd-q-option-other', hidden: '' }, el('span', { class: 'fd-q-bullet', 'aria-hidden': 'true' }), el('span', { class: 'fd-q-other-words' }, 'Other…'), removeOther);
  // "None of these", for checkboxes: picked, it clears the others.
  const addNone = el('button', { type: 'button', class: 'fd-button fd-button-link fd-q-add-none' }, 'add “None of these”');
  addNone.addEventListener('click', () => designer.addNoneOption(nodeId));
  const orNone = el('span', { class: 'fd-q-or' }, 'or');
  const addRow = el('div', { class: 'fd-q-add-row' }, add, or, addOther);
  const source = listSource(el, designer, nodeId);
  const element = el('div', { class: 'fd-q-option-box' }, source.element, list, otherRow, addRow, source.list);
  const inputs = () => [...list.querySelectorAll<HTMLInputElement>('input')];
  const labels = () => inputs().map((i) => i.value);
  const focused = (node: Element) => node.ownerDocument.activeElement === node;
  const focusAt = (index: number, atEnd = false) => {
    const input = inputs()[index];
    input?.focus();
    if (input && atEnd) input.setSelectionRange(input.value.length, input.value.length);
    else input?.select();
  };
  add.addEventListener('click', () => {
    const current = labels();
    designer.setOptions(nodeId, [...current, `Option ${current.length + 1}`]);
    focusAt(inputs().length - 1);
  });
  const indexOf = (input: HTMLInputElement) => inputs().indexOf(input);
  /** An edit of this list's own: the blur it causes is not a person leaving a box. */
  let busy = false;
  /**
   * Without the option at `index`, the cursor going to the one before it; an
   * only option stays. The cursor leaves the boxes first, so every box is
   * redrawn with the words now at its place — rows are kept by position.
   */
  const without = (index: number) => {
    const current = labels();
    if (current.length < 2) return false;
    current.splice(index, 1);
    busy = true;
    try {
      (list.ownerDocument.activeElement as HTMLElement | null)?.blur();
      if (!designer.setOptions(nodeId, current)) return false;
    } finally {
      busy = false;
    }
    focusAt(Math.max(0, index - 1), true);
    return true;
  };
  /** The option at `from` moved a place up or down, the cursor going with it. */
  const moveBy = (from: number, step: number) => {
    const to = from + step;
    if (to < 0 || to >= labels().length) return;
    busy = true;
    try {
      (list.ownerDocument.activeElement as HTMLElement | null)?.blur();
      if (!designer.moveOption(nodeId, from, to)) return;
    } finally {
      busy = false;
    }
    focusAt(to, true);
  };
  /** Dragged by its grip: the row follows the pointer from place to place, and the move is kept when it is let go. */
  const drag = (grip: HTMLElement, event: PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const row = grip.parentElement as HTMLElement;
    const rows = () => [...list.children] as HTMLElement[];
    const from = rows().indexOf(row);
    grip.setPointerCapture?.(event.pointerId);
    row.classList.add('fd-q-option-lifted');
    const onMove = (e: PointerEvent) => {
      const others = rows().filter((r) => r !== row);
      const at = others.filter((r) => {
        const box = r.getBoundingClientRect();
        return box.top + box.height / 2 < e.clientY;
      }).length;
      if (rows().indexOf(row) !== at) list.insertBefore(row, others[at] ?? null);
    };
    const onEnd = () => {
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onEnd);
      grip.removeEventListener('pointercancel', onEnd);
      row.classList.remove('fd-q-option-lifted');
      const to = rows().indexOf(row);
      if (to !== from) designer.moveOption(nodeId, from, to);
    };
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onEnd);
    grip.addEventListener('pointercancel', onEnd);
  };
  return {
    element,
    update(field, node) {
      const choices = field.type === 'selection' ? field.options : null;
      const multiple = field.type === 'selection' && field.multiple === true;
      element.hidden = !choices;
      if (!choices) return;
      // Rings for one of them, boxes for several, numbers down a dropdown: the look draws them.
      element.toggleAttribute('data-multiple', multiple);
      const kind = node ? kindOfField(field, node) : null;
      element.toggleAttribute('data-numbered', kind === 'dropdown');
      const takesOther = (kind === 'multiple-choice' || kind === 'checkboxes') && !designer.isFromModel(nodeId);
      const hasOther = field.type === 'selection' && field.other === true;
      otherRow.hidden = !hasOther;
      or.hidden = addOther.hidden = !takesOther || hasOther;
      // In the row only where it is offered.
      if (kind === 'checkboxes' && !designer.isFromModel(nodeId) && !choices.some((o) => o.exclusive)) addRow.append(orNone, addNone);
      else {
        orNone.remove();
        addNone.remove();
      }
      element.style.setProperty('--fd-next-number', `"${choices.length + 1}."`);
      // Choices from the app's list: its name and what it changes with, in place of the options written here.
      const listed = source.update(field, node);
      list.hidden = addRow.hidden = listed;
      if (listed) otherRow.hidden = true;
      while (list.children.length > choices.length) list.lastElementChild?.remove();
      while (list.children.length < choices.length) {
        const index = list.children.length;
        const input = el('input', { class: 'fd-input', 'aria-label': `Option ${index + 1}` });
        // An option emptied while it is typed in stays, empty, until Backspace or the cursor leaving it says what to do.
        input.addEventListener('input', () => input.value.trim() && designer.setOptions(nodeId, labels()));
        input.addEventListener('keydown', (event) => {
          const at = indexOf(input);
          if (event.key === 'Enter') {
            event.preventDefault();
            const current = labels();
            current.splice(at + 1, 0, `Option ${current.length + 1}`);
            if (designer.setOptions(nodeId, current)) focusAt(at + 1);
          } else if (event.key === 'Backspace' && input.value === '' && labels().length > 1) {
            event.preventDefault();
            without(at);
          } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
            event.preventDefault();
            moveBy(at, event.key === 'ArrowUp' ? -1 : 1);
          }
        });
        // Lines pasted into an option become options, one to a line, as Google Forms makes them; one line is the box's own.
        input.addEventListener('paste', (event) => {
          const text = (event as ClipboardEvent).clipboardData?.getData('text/plain') ?? '';
          const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
          if (lines.length < 2) return;
          event.preventDefault();
          const at = indexOf(input);
          const current = labels();
          const start = input.selectionStart ?? input.value.length;
          const end = input.selectionEnd ?? start;
          const before = input.value.slice(0, start);
          const after = input.value.slice(end);
          lines[0] = before + lines[0];
          lines[lines.length - 1] += after;
          current.splice(at, 1, ...lines);
          busy = true;
          try {
            input.blur();
            if (!designer.setOptions(nodeId, current)) return;
          } finally {
            busy = false;
          }
          focusAt(at + lines.length - 1, true);
        });
        // An option left empty goes once the cursor has gone somewhere else — after the blur, never inside it.
        input.addEventListener('blur', () => {
          if (busy) return;
          setTimeout(() => {
            if (!input.isConnected || input.value.trim() || focused(input)) return;
            const at = indexOf(input);
            const current = labels();
            if (current.length < 2) {
              designer.setOptions(nodeId, ['Option 1']);
              return;
            }
            current.splice(at, 1);
            // Gone into another option of this list: it is followed to its new place.
            const active = list.ownerDocument.activeElement as HTMLInputElement | null;
            const was = active && list.contains(active) ? indexOf(active) : -1;
            busy = true;
            try {
              if (was !== -1) active?.blur();
              designer.setOptions(nodeId, current);
            } finally {
              busy = false;
            }
            if (was !== -1) focusAt(was > at ? was - 1 : was, true);
          }, 0);
        });
        const remove = iconButton(el, 'Remove option', '×', () => {
          const current = labels();
          current.splice([...list.children].indexOf(remove.parentElement as Element), 1);
          designer.setOptions(nodeId, current);
        });
        // For the pointer only: Alt+↑/↓ in the box moves it too, so the grip is no stop of its own.
        const grip = el('span', { class: 'fd-q-option-grip', 'aria-hidden': 'true', title: 'Drag to move · Alt+↑ or ↓ moves it too' }, designerIcon(list.ownerDocument, 'grip'));
        grip.addEventListener('pointerdown', (event) => drag(grip, event));
        const alone = el('span', { class: 'fd-q-alone', hidden: '' }, 'goes alone');
        list.append(el('li', { class: 'fd-q-option' }, grip, el('span', { class: 'fd-q-bullet', 'aria-hidden': 'true' }, multiple ? '☐' : '◯'), input, alone, remove));
      }
      choices.forEach((option, i) => {
        const row = list.children[i] as HTMLElement;
        const input = row.querySelector('input') as HTMLInputElement;
        if (!focused(input)) input.value = option.label;
        const remove = row.querySelector('button') as HTMLButtonElement;
        remove.setAttribute('aria-label', `Remove option ${option.label}`);
        remove.hidden = choices.length === 1;
        (row.querySelector('.fd-q-alone') as HTMLElement).hidden = !option.exclusive;
        (row.querySelector('.fd-q-option-grip') as HTMLElement).hidden = choices.length === 1;
        (row.querySelector('.fd-q-bullet') as HTMLElement).textContent = kind === 'dropdown' ? `${i + 1}.` : multiple ? '☐' : '◯';
      });
    },
  };
}
