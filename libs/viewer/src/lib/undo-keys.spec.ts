import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * Ctrl+Z and Ctrl+Shift+Z (Ctrl+Y) while filling: the record's last change taken back and made again, across fields;
 * in a box typed in since it was entered, the browser's own undo first, the record's once it has nothing left there.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(keys?: { undo?: boolean }) {
  const dataSource = createMemoryDataSource({ records: { project: { 1: { name: 'Office fit-out', email: 'site@example.com', signed: false } } } });
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: page('fields'), dataSource, recordId: 1, ...(keys ? { keys } : {}) });
  await handle.form.settled();
  return { host, form: handle.form };
}

const box = (host: Element, node: string) => host.querySelector(`[data-node="${node}"] input`) as HTMLInputElement;

/** Text typed where the caret is, key by key, as the browser tells it. */
function type(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    input.setRangeText(char, input.value.length, input.value.length, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}

/** A key with Ctrl, on what has the focus; whether the page took it (`preventDefault`). */
function press(key: string, shift = false): boolean {
  const target = document.activeElement ?? document.body;
  return !target.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, shiftKey: shift, bubbles: true, cancelable: true }));
}

describe('Ctrl+Z while filling', () => {
  it('takes back the last change across fields from a box not typed in, the field taking the focus, and Ctrl+Shift+Z makes it again', async () => {
    const { host, form } = await mount();
    const name = box(host, 'f-name');
    name.focus();
    await Promise.resolve();
    type(name, ' B');
    name.dispatchEvent(new Event('change', { bubbles: true }));
    expect(form.getState().values['name']).toBe('Office fit-out B');
    const email = box(host, 'f-email');
    email.focus();
    await Promise.resolve();
    // Typed in nothing yet: the record's undo, which takes the name back, and the focus to it.
    expect(press('z')).toBe(true);
    expect(form.getState().values['name']).toBe('Office fit-out');
    expect(name.value).toBe('Office fit-out');
    expect(document.activeElement).toBe(name);
    await new Promise((resolve) => setTimeout(resolve, 1));
    expect(host.querySelector('.fd-undo-heard')?.textContent).toBe('Undone: Project');
    expect(press('z', true)).toBe(true);
    expect(form.getState().values['name']).toBe('Office fit-out B');
    await Promise.resolve();
    expect(press('z')).toBe(true);
    await Promise.resolve();
    expect(press('y')).toBe(true);
    expect(form.getState().values['name']).toBe('Office fit-out B');
  });

  it("leaves Ctrl+Z to the browser in a box typed in, and takes it once the browser's undo has taken it all back", async () => {
    const { host, form } = await mount();
    const name = box(host, 'f-name');
    name.focus();
    await Promise.resolve();
    type(name, 'X');
    name.dispatchEvent(new Event('change', { bubbles: true }));
    const email = box(host, 'f-email');
    email.focus();
    await Promise.resolve();
    type(email, 'Y');
    // The browser's: typed in here.
    expect(press('z')).toBe(false);
    email.value = 'site@example.com';
    email.dispatchEvent(new InputEvent('input', { inputType: 'historyUndo', bubbles: true }));
    // Nothing left of it there: the record's, and back past the email typed back to where it was, to the name.
    expect(press('z')).toBe(true);
    expect(form.getState().values['name']).toBe('Office fit-out');
    expect(form.getState().values['email']).toBe('site@example.com');
  });

  it('takes nothing when there is nothing to take back, and nothing at all where the app turned it off', async () => {
    const { host, form } = await mount({ undo: false });
    const name = box(host, 'f-name');
    name.focus();
    await Promise.resolve();
    type(name, 'X');
    name.dispatchEvent(new Event('change', { bubbles: true }));
    box(host, 'f-email').focus();
    await Promise.resolve();
    expect(press('z')).toBe(false);
    expect(form.getState().values['name']).toBe('Office fit-outX');
    handle?.destroy();
    document.body.replaceChildren();
    const fresh = await mount();
    box(fresh.host, 'f-email').focus();
    await Promise.resolve();
    expect(press('z')).toBe(false);
  });
});
