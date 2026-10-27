import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { undoKeys } from './undo-keys';
import { undoPart } from './viewer-parts';
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

async function mount(keys?: { undo?: boolean }, values: Record<string, unknown> = {}) {
  const dataSource = createMemoryDataSource({ records: { project: { 1: { name: 'Office fit-out', email: 'site@example.com', signed: false, ...values } } } });
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

  it("makes again what a number box's own undo took back, once it is left: the record's Redo, never the browser's", async () => {
    // The how-to replay of 0.35 (a course's price): its own undo, the notes taken back and made again, then Ctrl+Shift+Z
    // was the browser's, whose history put "11000" after the price grouped as it was left — "9,500.0011000", refused.
    const { host, form } = await mount(undefined, { area: 9500 });
    const area = box(host, 'f-area');
    area.focus();
    // The undo part, asked for as the form is first entered: in before the person has typed.
    await undoPart.load();
    await Promise.resolve();
    expect(area.value).toBe('9500.0');
    // Typed over, all of it chosen.
    area.select();
    area.setRangeText('', 0, area.value.length);
    area.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    type(area, '11000');
    expect(form.getState().values['area']).toBe(11000);
    // Its own undo, the browser's: back to what it showed as it was entered.
    expect(press('z')).toBe(false);
    area.value = '9500.0';
    area.dispatchEvent(new InputEvent('input', { inputType: 'historyUndo', bubbles: true }));
    expect(form.getState().values['area']).toBe(9500);
    // Left: grouped again, the browser's history no longer what the box holds. Redo is the record's, and makes it again.
    const name = box(host, 'f-name');
    name.focus();
    await Promise.resolve();
    expect(area.value).toBe('9,500.0');
    expect(press('z', true)).toBe(true);
    expect(form.getState().values['area']).toBe(11000);
    expect(document.activeElement).toBe(area);
    await Promise.resolve();
    expect(area.value).toBe('11000.0');
    // Nothing left to make again: still the record's key, the browser's own kept out of it.
    expect(press('z', true)).toBe(true);
    expect(form.getState().values['area']).toBe(11000);
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
    // Nothing of the record's to take back: kept from the browser all the same — its history is the page's, the last
    // typing in another box, which a box may have written again since.
    expect(press('z')).toBe(true);
    expect(press('z', true)).toBe(true);
    expect(fresh.form.getState().values).toMatchObject({ name: 'Office fit-out', email: 'site@example.com' });
  });
});

describe('the keys, decided as they are pressed, whether the undo part has come or not', () => {
  it("takes a key from the browser for the record's step at once, the step's answer coming later; a box typed in keeps its own", async () => {
    const root = document.createElement('div');
    const [name, email] = [document.createElement('input'), document.createElement('input')];
    root.append(name, email);
    document.body.append(root);
    // The undo part on its way: each key handed over, answered later.
    const asked: { redo: boolean; written: () => void }[] = [];
    const stop = undoKeys(root, () => true, (redo, written) => (asked.push({ redo, written }), true));
    name.focus();
    await Promise.resolve();
    type(name, ' B');
    // Typed in here: the browser's own undo, never handed over.
    expect(press('z')).toBe(false);
    expect(asked).toEqual([]);
    email.focus();
    await Promise.resolve();
    // Not typed in: the record's, kept from the browser at once — its own would take back the name's typing.
    expect(press('z')).toBe(true);
    expect(press('z', true)).toBe(true);
    expect(press('y')).toBe(true);
    expect(asked.map((one) => one.redo)).toEqual([false, true, true]);
    // The part's step writes the box the person is in: what it shows then is what it shows as entered.
    email.value = 'written by the step';
    asked[0].written();
    await Promise.resolve();
    expect(press('z')).toBe(true);
    stop();
    expect(press('z')).toBe(false);
  });
});
