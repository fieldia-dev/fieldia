import type { Field } from '@fieldia/core';
import type { Designer, DesignerState } from './designer';

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

export interface DesignerBar {
  element: HTMLElement;
  /** Why the last edit was refused, if it was. */
  issues: HTMLElement;
  update(state: DesignerState): void;
  destroy(): void;
}

/**
 * The page title, where the page stands (draft, published), and Undo, Redo
 * and Publish — each shown only when it can act. Ctrl/Cmd+Z and Shift+Z or Y
 * undo and redo anywhere in `root` outside a text box.
 */
export function designerBar(
  root: HTMLElement,
  designer: Designer,
  options: { titleLabel: string; placeholder: string; extra?: Node[] }
): DesignerBar {
  const doc = root.ownerDocument;
  const el = elementFactory(doc);
  const title = el('input', { class: 'fd-input fd-designer-title', 'aria-label': options.titleLabel, placeholder: options.placeholder });
  title.addEventListener('input', () => designer.setPageInfo({ title: title.value }));
  const status = el('span', { class: 'fd-designer-status', role: 'status' });
  const undo = el('button', { type: 'button', class: 'fd-button' }, 'Undo');
  const redo = el('button', { type: 'button', class: 'fd-button' }, 'Redo');
  const publish = el('button', { type: 'button', class: 'fd-button fd-button-primary' }, 'Publish');
  undo.addEventListener('click', () => designer.undo());
  redo.addEventListener('click', () => designer.redo());
  publish.addEventListener('click', () => void designer.publish().catch(() => undefined));
  const element = el('div', { class: 'fd-designer-bar' }, title, status, el('span', { class: 'fd-spacer' }), undo, redo, ...(options.extra ?? []), publish);
  const issues = el('div', { class: 'fd-alert fd-tone-danger fd-designer-issues', role: 'alert', hidden: '' });

  // On the document: clicking an area that cannot take focus leaves focus on
  // the body, and keys pressed then never reach the editor's own element.
  const onKey = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (target !== doc.body && !root.contains(target)) return;
    const typing = target.closest('input, textarea, select, [contenteditable]');
    if (typing || !(event.ctrlKey || event.metaKey)) return;
    const key = event.key.toLowerCase();
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
      if (doc.activeElement !== title) title.value = state.page.title ?? '';
      undo.hidden = !state.canUndo;
      redo.hidden = !state.canRedo;
      publish.hidden = !state.unpublished;
      const last = state.versions[state.versions.length - 1];
      status.textContent = !last ? 'Draft, not published yet' : state.unpublished ? 'Changes not published yet' : `Published · version ${last.version}`;
      issues.hidden = state.issues.length === 0;
      issues.textContent = state.issues.join('\n');
    },
    destroy() {
      doc.removeEventListener('keydown', onKey);
    },
  };
}

export interface OptionsEditor {
  element: HTMLElement;
  /** Show the field's options; hidden for a field without any. */
  update(field: Field): void;
}

/**
 * The choices of a question, one input each, kept by position so typing in
 * one keeps its focus — typed the Google Forms way: Enter adds the next one
 * under it, Backspace in an empty one takes it away, and one left empty goes
 * when the cursor leaves it.
 */
export function optionsEditor(el: ElementFactory, designer: Designer, nodeId: string): OptionsEditor {
  const list = el('ul', { class: 'fd-q-options' });
  const add = el('button', { type: 'button', class: 'fd-button fd-button-link' }, 'Add option');
  const element = el('div', { class: 'fd-q-option-box' }, list, add);
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
  /** Without the option at `index`; an only option stays. */
  const without = (index: number) => {
    const current = labels();
    if (current.length < 2) return false;
    current.splice(index, 1);
    return designer.setOptions(nodeId, current);
  };
  return {
    element,
    update(field) {
      const choices = field.type === 'selection' ? field.options : null;
      const multiple = field.type === 'selection' && field.multiple === true;
      element.hidden = !choices;
      if (!choices) return;
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
            if (without(at)) focusAt(Math.max(0, at - 1), true);
          }
        });
        input.addEventListener('blur', () => {
          if (input.value.trim() || !input.isConnected) return;
          if (!without(indexOf(input))) designer.setOptions(nodeId, labels().map((l, i) => (l.trim() ? l : `Option ${i + 1}`)));
        });
        const remove = iconButton(el, 'Remove option', '×', () => {
          const current = labels();
          current.splice([...list.children].indexOf(remove.parentElement as Element), 1);
          designer.setOptions(nodeId, current);
        });
        list.append(el('li', { class: 'fd-q-option' }, el('span', { class: 'fd-q-bullet', 'aria-hidden': 'true' }, multiple ? '☐' : '◯'), input, remove));
      }
      choices.forEach((option, i) => {
        const row = list.children[i] as HTMLElement;
        const input = row.querySelector('input') as HTMLInputElement;
        if (!focused(input)) input.value = option.label;
        const remove = row.querySelector('button') as HTMLButtonElement;
        remove.setAttribute('aria-label', `Remove option ${option.label}`);
        remove.hidden = choices.length === 1;
        (row.querySelector('.fd-q-bullet') as HTMLElement).textContent = multiple ? '☐' : '◯';
      });
    },
  };
}
