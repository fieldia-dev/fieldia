import { ASK_FOR_WORDS, askAssistant, type AssistantRun, type DesignerAssistant } from './assistant';
import type { ElementFactory } from './chrome';
import type { Designer } from './designer';
import { isBlank } from './templates';

/**
 * The box a person describes a form in for the app's assistant: the words,
 * the assistant's name and what it is, and Build it (or Ask). Asked, it is
 * busy — the words held, Cancel in place of the button, the wait said aloud;
 * answered, the form goes in place and `onApplied` says what changed. What
 * went wrong is said under it, the words kept to try again. Ctrl or ⌘ with
 * Enter asks too; Enter alone starts a new line.
 */

export interface AssistantBoxOptions {
  el: ElementFactory;
  designer: Designer;
  assistant: DesignerAssistant;
  /** What the box asks for: "Describe the form you need", or what should change. */
  label: string;
  placeholder: string;
  /** The button's words, and what is said while it waits. */
  ask: string;
  busy: string;
  /** Its form is in place: these are the changes, and whether the page was blank before. */
  onApplied(changes: string[], wasBlank: boolean): void;
  /** It stopped waiting, whatever the answer. */
  onSettled?(): void;
}

export interface AssistantBox {
  element: HTMLElement;
  readonly busy: boolean;
  focus(): void;
  /** Stop waiting: the assistant is told, and its answer let go. */
  cancel(): void;
}

let made = 0;

export function assistantBox(options: AssistantBoxOptions): AssistantBox {
  const { el, designer, assistant } = options;
  const id = `fd-assist-${++made}`;
  const area = el('textarea', { id, class: 'fd-input fd-assist-prompt', rows: '3', placeholder: options.placeholder, spellcheck: 'true' }) as HTMLTextAreaElement;
  const label = el('label', { class: 'fd-assist-label', for: id }, options.label);
  const name = assistant.name ? el('span', { class: 'fd-assist-name' }, assistant.name) : null;
  const note = assistant.note ? el('p', { class: 'fd-assist-note', id: `${id}-note` }, el('bdi', {}, assistant.note)) : null;
  if (note) area.setAttribute('aria-describedby', note.id);
  const submit = el('button', { type: 'submit', class: 'fd-button fd-button-primary fd-assist-ask' }, options.ask);
  const cancelButton = el('button', { type: 'button', class: 'fd-button fd-assist-cancel', hidden: '' }, 'Cancel');
  const waiting = el('span', { class: 'fd-assist-busy', role: 'status', hidden: '' }, el('span', { class: 'fd-assist-spinner', 'aria-hidden': 'true' }), options.busy);
  const said = el('p', { class: 'fd-assist-said', role: 'status' });
  const problem = el('p', { class: 'fd-assist-problem', role: 'alert', hidden: '' });
  const element = el(
    'form',
    { class: 'fd-assist', 'aria-busy': 'false', novalidate: '' },
    el('div', { class: 'fd-assist-head' }, label, ...(name ? [name] : [])),
    area,
    ...(note ? [note] : []),
    el('div', { class: 'fd-assist-actions' }, submit, waiting, cancelButton, said),
    problem
  );
  let run: AssistantRun | null = null;

  function setBusy(busy: boolean) {
    element.setAttribute('aria-busy', String(busy));
    area.readOnly = busy;
    submit.hidden = busy;
    waiting.hidden = !busy;
    cancelButton.hidden = !busy;
  }
  /** Said under the box, each in its own direction: the assistant's words may be English on a page right to left. */
  function tell(words: string, wrong: boolean) {
    problem.replaceChildren(...(wrong ? [el('bdi', {}, words)] : []));
    problem.hidden = !wrong;
    said.replaceChildren(...(!wrong && words ? [el('bdi', {}, words)] : []));
  }
  async function ask() {
    if (run) return;
    tell('', false);
    if (!area.value.trim()) {
      tell(ASK_FOR_WORDS, true);
      area.focus();
      return;
    }
    const wasBlank = isBlank(designer.getPage());
    // Asked from in here: the button pressed is hidden while it waits, so the cursor waits on Cancel.
    const here = element.contains(element.ownerDocument.activeElement);
    const current = askAssistant(designer, assistant, area.value);
    run = current;
    setBusy(true);
    if (here) cancelButton.focus();
    const result = await current.done;
    if (run !== current) return;
    run = null;
    setBusy(false);
    options.onSettled?.();
    if (result.status === 'applied') {
      options.onApplied(result.changes, wasBlank);
      return;
    }
    if (result.status === 'unchanged') tell('The assistant left the form as it was.', false);
    else if (result.status !== 'cancelled') tell(result.problem, true);
    area.focus();
  }
  element.addEventListener('submit', (event) => {
    event.preventDefault();
    void ask();
  });
  area.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void ask();
    }
  });
  /** Stopped at once: the assistant is told, and the box is back to the words. */
  function cancel() {
    const current = run;
    if (!current) return;
    run = null;
    current.cancel();
    setBusy(false);
    options.onSettled?.();
    tell('Cancelled. Nothing was changed.', false);
    area.focus();
  }
  cancelButton.addEventListener('click', cancel);
  element.addEventListener('keydown', (event) => {
    // Escape stops the wait; with nothing to wait for, it is the place's own, a dialog's to close.
    if (event.key === 'Escape' && run) {
      event.preventDefault();
      cancel();
    }
  });

  return {
    element,
    get busy() {
      return run !== null;
    },
    focus: () => area.focus(),
    cancel,
  };
}
