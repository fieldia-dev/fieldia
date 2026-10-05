import type { DesignerAssistant } from './assistant';
import { assistantBox } from './assistant-box';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';

/**
 * "Ask the assistant…", for a page that has parts: the assistant's box in a
 * dialog, saying what should change. Its form in place, the dialog closes and
 * `onApplied` says what changed. Escape, the × or a click outside close it,
 * cancelling a wait; the keyboard stays inside while it is open, and goes
 * back where it was when it closes without an answer.
 */

export interface AssistantDialogOptions {
  el: ElementFactory;
  root: HTMLElement;
  designer: Designer;
  assistant: DesignerAssistant;
  onApplied(changes: string[]): void;
}

let made = 0;

export function openAssistantDialog(options: AssistantDialogOptions): { close(): void } {
  const { el, root, designer, assistant } = options;
  const doc = root.ownerDocument;
  const opener = doc.activeElement as HTMLElement | null;
  const id = `fd-assist-dialog-${++made}`;
  const w = designer.words.assistant;
  const box = assistantBox({
    el,
    designer,
    assistant,
    label: w.whatShouldChange,
    placeholder: w.changeExample,
    ask: w.ask,
    busy: w.changing,
    onApplied(changes) {
      close(false);
      options.onApplied(changes);
    },
  });
  const closeX = el('button', { type: 'button', class: 'fd-dialog-close', 'aria-label': w.close }, '×');
  const dialog = el(
    'div',
    { class: 'fd-form-dialog fd-size-small fd-assist-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': `${id}-title`, tabindex: '-1' },
    el('div', { class: 'fd-form-dialog-head' }, el('h2', { class: 'fd-form-dialog-title', id: `${id}-title` }, w.askTitle), closeX),
    el('div', { class: 'fd-assist-dialog-body' }, box.element)
  );
  const backdrop = el('div', { class: 'fd-dialog-backdrop fd-assist-backdrop' }, dialog);

  function close(refocus = true) {
    if (!backdrop.isConnected) return;
    box.cancel();
    backdrop.remove();
    if (refocus) opener?.focus?.();
  }
  closeX.addEventListener('click', () => close());
  backdrop.addEventListener('pointerdown', (event) => event.target === backdrop && close());
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      // The keyboard stays in the dialog.
      const stops = [...dialog.querySelectorAll<HTMLElement>('button, textarea')].filter((e) => !e.closest('[hidden]') && !(e as HTMLButtonElement).disabled);
      const first = stops[0];
      const last = stops[stops.length - 1];
      if (event.shiftKey && doc.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && doc.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  });
  root.append(backdrop);
  box.focus();
  return { close: () => close() };
}
