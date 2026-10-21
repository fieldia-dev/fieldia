import type { RunResult } from '@fieldia/core';
import type { El } from './dom';
import { viewerWords } from './labels';
import { sayer } from './say';

/**
 * A toast with Undo: the words a one-tap press said, Undo beside them for a few seconds, and what Undo did said in their
 * place — drawn by the undo part (undo-toast.ts), in before these tests (test-parts.ts), a moment after it is asked.
 */

const words = viewerWords('en');
const drawn = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};
const el: El = (tag, attrs = {}, ...children) => {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) if (value !== undefined) element.setAttribute(name, value);
  element.append(...children);
  return element;
};

afterEach(() => {
  jest.useRealTimers();
  document.body.replaceChildren();
});

function toasts() {
  const root = document.createElement('div');
  document.body.append(root);
  return { root, say: sayer(root, el, words) };
}

describe('a toast with Undo', () => {
  it('shows Undo beside the words, takes the press back on a press, and says it was undone', async () => {
    const { root, say } = toasts();
    let undone = 0;
    say('Follow-up marked done', 'success', { undo: async (): Promise<RunResult> => (undone++, { done: true }) });
    await drawn();
    const undo = root.querySelector<HTMLButtonElement>('.fd-say .fd-say-undo') as HTMLButtonElement;
    expect(undo.textContent).toBe('Undo');
    expect(root.querySelector('.fd-say > span')?.textContent).toBe('Follow-up marked done');
    undo.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(undone).toBe(1);
    expect(root.querySelector('.fd-say-undo')).toBeNull();
    expect(root.querySelector('.fd-say > span')?.textContent).toBe('Undone.');
  });

  it('says why where Undo could not take it back', async () => {
    const { root, say } = toasts();
    say('Archived.', 'success', { undo: async () => ({ done: false, reason: 'cannot', message: 'Another record is shown now: the rest of these steps did not run.' }) });
    await drawn();
    root.querySelector<HTMLButtonElement>('.fd-say-undo')?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(root.querySelector('.fd-say > span')?.textContent).toBe('Another record is shown now: the rest of these steps did not run.');
  });

  it('stays a few seconds, longer than plain words, and goes by itself', async () => {
    jest.useFakeTimers();
    const { root, say } = toasts();
    say('Marked done', 'success', { undo: async () => ({ done: true }) });
    await drawn();
    say('Saved', 'info');
    jest.advanceTimersByTime(6500);
    expect([...root.querySelectorAll('.fd-say > span')].map((one) => one.textContent)).toEqual(['Marked done']);
    jest.advanceTimersByTime(2000);
    expect(root.querySelectorAll('.fd-say')).toHaveLength(0);
  });

  it('draws no Undo for plain words', () => {
    const { root, say } = toasts();
    say('Saved', 'info');
    expect(root.querySelector('.fd-say-undo')).toBeNull();
  });
});
