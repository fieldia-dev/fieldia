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
  return {
    element,
    update(field) {
      const choices = field.type === 'selection' ? field.options : null;
      const multiple = field.type === 'selection' && field.multiple === true;
      element.hidden = !choices;
      if (!choices) return;
      // Rings for one of them, boxes for several: the look draws them.
      element.toggleAttribute('data-multiple', multiple);
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
