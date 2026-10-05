import type { Page } from '@fieldia/core';
import type { Designer } from './designer';
import { pageChanges } from './page-checks';
import { pageProblem } from './templates';
import { en } from './locales/en';

/**
 * The app's own assistant: given what a person asks and the page as it is,
 * it answers with a page. Fieldia ships no AI of its own; an app that has
 * one hands it to the designer. Its answer is checked as any page is, put
 * in place as one edit, and said back as the changes it made — or refused,
 * or reported, in words. Cancelled, it is told to stop, and an answer that
 * comes after is let go.
 */

export interface DesignerAssistant {
  /** A page for what was asked: a new one for a blank page, or the page changed. `signal` says when the person has cancelled. */
  describe(request: { prompt: string; page: Page; signal?: AbortSignal }): Promise<Page>;
  /** What the editor calls it, beside its box: such as "Demo assistant". */
  name?: string;
  /** A line under its box saying what it is and does. */
  note?: string;
}

export type AssistantResult =
  | { status: 'applied'; changes: string[] }
  | { status: 'unchanged' }
  | { status: 'refused'; problem: string }
  | { status: 'failed'; problem: string }
  | { status: 'cancelled' };

export interface AssistantRun {
  /** Stop: the assistant is told, and what it answers after is let go. */
  cancel(): void;
  done: Promise<AssistantResult>;
}

/** What is said when nothing is written for the assistant (in the designer's words: `words.assistant.askForWords`). */
export const ASK_FOR_WORDS = en.assistant.askForWords;

export function askAssistant(designer: Designer, assistant: DesignerAssistant, prompt: string): AssistantRun {
  const words = prompt.trim();
  const w = designer.words.assistant;
  const stop = new AbortController();
  let settle: (result: AssistantResult) => void = () => undefined;
  let settled = false;
  const done = new Promise<AssistantResult>((resolve) => (settle = resolve));
  const finish = (result: AssistantResult) => {
    if (settled) return;
    settled = true;
    settle(result);
  };
  const cancel = () => {
    if (settled) return;
    stop.abort();
    finish({ status: 'cancelled' });
  };
  if (!words) {
    finish({ status: 'refused', problem: w.askForWords });
    return { cancel, done };
  }
  const asked = designer.getPage();
  let answer: Promise<Page>;
  try {
    answer = Promise.resolve(assistant.describe({ prompt: words, page: JSON.parse(JSON.stringify(asked)) as Page, signal: stop.signal }));
  } catch (error) {
    answer = Promise.reject(error);
  }
  answer.then(
    (page) => {
      if (settled) return;
      const before = designer.getPage();
      const problem = pageProblem(before, page, designer.words);
      if (problem) return finish({ status: 'refused', problem: w.cannotBeUsed(problem) });
      if (JSON.stringify({ ...page, id: before.id, data: before.data }) === JSON.stringify(before)) return finish({ status: 'unchanged' });
      if (!designer.replacePage(page)) return finish({ status: 'refused', problem: w.cannotBeUsed(designer.getState().issues.join('; ')) });
      finish({ status: 'applied', changes: pageChanges(before, designer.getPage(), designer.words) });
    },
    (error: unknown) => {
      finish({ status: 'failed', problem: w.couldNot(error instanceof Error && error.message ? error.message : null) });
    }
  );
  return { cancel, done };
}
