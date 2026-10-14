import { unsavedWork, uploadGoing, type Form, type FormState, type Values } from '@fieldia/core';
import { keepTabIn } from './focus-trap';

/**
 * Work of the person's that only save safety keeps, which no way out of a
 * record asked about before it: changes Reload set aside, files still on their
 * way. A way out that has always let a change not saved go — a plain dialog's
 * Escape and ×, Back from a page opened in its place, a page's own `close`
 * step — asks about these.
 */
export const keptWork = (state: FormState): boolean => state.setAside != null || (state.uploads ?? []).some(uploadGoing);

/**
 * What a form last sent, as its `send` told: a page of responses keeps its
 * answers as they were sent, so a change since is told from them. Null until
 * it sends.
 */
export function lastSent(form: Form): { values(): Readonly<Values> | null; stop(): void } {
  let sent: Readonly<Values> | null = null;
  const stop = form.on('send', ({ values }) => (sent = values));
  return { values: () => sent, stop };
}

/**
 * Whether work of the person's is still not saved once a save or a send went
 * through. A record's, any (`unsavedWork`): a change made while it saved, a
 * file picked meanwhile, changes Reload set aside. A page of responses keeps
 * its answers as they were sent: an answer changed since (`sent`), or a file
 * still on its way.
 */
export function workLeft(form: Form, sent: Readonly<Values> | null): boolean {
  const state = form.getState();
  if (form.page.data.kind !== 'responses') return unsavedWork(state);
  return keptWork(state) || (sent !== null && Object.keys(sent).some((name) => JSON.stringify(state.values[name] ?? null) !== JSON.stringify(sent[name] ?? null)));
}

/** The words the question needs: "Discard your changes?", Cancel and Discard, in the page's language. */
export interface DiscardWords {
  discardChanges: string;
  cancel: string;
  discard: string;
}

/**
 * "Discard your changes?" over `place`: true for Discard. The focus starts on
 * Cancel, so Enter keeps the work; Escape is Cancel too, and Tab stays in the
 * question. The focus goes back where it was as it closes. `ended` is told the
 * moment it is answered, before the promise settles: a way out pressed right
 * after Cancel asks again.
 */
export function askDiscard(place: HTMLElement, words: DiscardWords, ended?: () => void): Promise<boolean> {
  const doc = place.ownerDocument;
  return new Promise<boolean>((answer) => {
    const was = doc.activeElement as HTMLElement | null;
    const text = doc.createElement('p');
    text.id = `fd-discard-${++asked}`;
    text.textContent = words.discardChanges;
    const button = (label: string, primary: boolean) => {
      const made = doc.createElement('button');
      made.type = 'button';
      made.className = primary ? 'fd-button fd-button-primary' : 'fd-button';
      made.textContent = label;
      return made;
    };
    const no = button(words.cancel, false);
    const yes = button(words.discard, true);
    const buttons = doc.createElement('div');
    buttons.className = 'fd-actions fd-actions-end';
    buttons.append(no, yes);
    const question = doc.createElement('div');
    question.className = 'fd-dialog';
    question.setAttribute('role', 'alertdialog');
    question.setAttribute('aria-modal', 'true');
    question.setAttribute('aria-labelledby', text.id);
    question.append(text, buttons);
    const shade = doc.createElement('div');
    shade.className = 'fd-dialog-backdrop';
    shade.append(question);
    const end = (discarding: boolean) => {
      shade.remove();
      was?.focus();
      ended?.();
      answer(discarding);
    };
    no.addEventListener('click', () => end(false));
    yes.addEventListener('click', () => end(true));
    shade.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        end(false);
      } else keepTabIn(question, event);
    });
    place.append(shade);
    no.focus();
  });
}

let asked = 0;
