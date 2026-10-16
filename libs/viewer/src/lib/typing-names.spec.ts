import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Locale, type Page } from '@fieldia/core';
import { quoted, WIDGET_LABELS } from '@fieldia/widgets';
import { mountViewer, type ViewerHandle } from './viewer';

/** Waits for what a test expects next, instead of guessing how long the machine takes (a slow CI runner lost to 100 ms). */
async function until(happened: () => boolean, ms = 3000): Promise<void> {
  const end = Date.now() + ms;
  while (!happened() && Date.now() < end) await new Promise((done) => setTimeout(done, 10));
}

/**
 * Words typed into a box that picks a record by its name — a link — and every
 * way a value is saved: Ctrl+Enter while the name is still being looked up,
 * the Save button (the box left first, its lookup on its way), the pager, a
 * wizard's Next, Done. In English, Arabic right to left and French. The save
 * waits for the record the words name and saves it; words that name none are
 * refused with why, kept in the box — never the record the box held before
 * them saved in their place.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const fields = (): Page => JSON.parse(readFileSync(join(EXAMPLES, 'fields.page.json'), 'utf8'));

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

/** A client's name as each language's people write one. */
const NILE: Record<'en' | 'ar' | 'fr', string> = { en: 'Nile Interiors', ar: 'النيل للديكور', fr: 'Intérieurs du Nil' };

async function mount(locale: 'en' | 'ar' | 'fr', more: { records?: number[]; editSwitch?: boolean } = {}) {
  const dataSource = createMemoryDataSource({
    records: {
      project: { 1: { name: 'Office fit-out', client_id: { id: 1, label: 'Acme' } }, 2: { name: 'Clinic', client_id: null } },
      partner: { 1: { name: 'Acme' }, 2: { name: NILE[locale] }, 3: { name: `${NILE[locale]} 2` } },
    },
    // A search that takes its time, as a server's does.
    delayMs: 20,
  });
  const host = document.createElement('div');
  if (locale === 'ar') host.dir = 'rtl';
  document.body.append(host);
  handle = mountViewer(host, { page: fields(), dataSource, recordId: 1, locale, ...(more.records ? { records: more.records } : {}), ...(more.editSwitch ? { editSwitch: true } : {}) });
  await handle.form.settled();
  return { host, form: handle.form, stored: () => dataSource.records['project'][1]['client_id'] };
}

const at = (host: Element, node: string) => host.querySelector(`[data-node="${node}"]`) as HTMLElement;
const linkBox = (host: Element) => at(host, 'f-client').querySelector('input[role="combobox"]') as HTMLInputElement;
const errorOf = (host: Element) => at(host, 'f-client').querySelector('.fd-error') as HTMLElement | null;

/** Keys pressed one by one where the caret is, as a person types them. */
function keys(input: HTMLInputElement, text: string) {
  for (const char of [...text]) {
    const before = new InputEvent('beforeinput', { inputType: 'insertText', data: char, cancelable: true, bubbles: true });
    if (!input.dispatchEvent(before)) continue;
    const start = input.selectionStart ?? input.value.length;
    input.setRangeText(char, start, input.selectionEnd ?? start, 'end');
    input.dispatchEvent(new InputEvent('input', { inputType: 'insertText', data: char, bubbles: true }));
  }
}
/** The box entered with its text all chosen, so typing replaces it. */
function enter(input: HTMLInputElement) {
  input.focus();
  input.setSelectionRange(0, input.value.length);
}
const ctrlEnter = (input: HTMLInputElement) => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
/** The box left for a button, as a press on it leaves it: the focus goes before the press lands. */
const leave = (input: HTMLInputElement) => input.blur();
/** Why words were not taken, as the link box says it in the page's language. */
const noMatch = (locale: Locale, form: ViewerHandle['form'], text: string) => {
  const words = WIDGET_LABELS[locale];
  return (form.canCreate('client_id') ? words.noMatchCreate : words.noMatch).replace('{label}', 'Client').replace('{text}', quoted(text));
};
const label = (value: unknown) => (value as { label?: string } | null)?.label ?? null;

describe.each(['en', 'ar', 'fr'] as const)('%s: a link box’s words and the keys that save', (locale) => {
  it('Ctrl+Enter while the name is still being looked up saves the record it names, never the one it replaced', async () => {
    const { host, form, stored } = await mount(locale);
    const box = linkBox(host);
    enter(box);
    keys(box, NILE[locale]);
    ctrlEnter(box);
    await form.settled();
    expect(label(stored())).toBe(NILE[locale]);
    expect(form.getState().status).toBe('saved');
    expect(form.getState().dirty).toEqual([]);
  });

  it('Ctrl+Enter on words that name none is refused with why, the words kept in the box, nothing saved', async () => {
    const { host, form, stored } = await mount(locale);
    const box = linkBox(host);
    enter(box);
    const typed = NILE[locale].slice(0, 4);
    keys(box, typed);
    ctrlEnter(box);
    await form.settled();
    expect(label(stored())).toBe('Acme');
    expect(box.value).toBe(typed);
    expect(form.getState().unread['client_id']?.text).toBe(typed);
    expect(errorOf(host)?.textContent).toBe(noMatch(locale, form, typed));
  });

  it('the Save button, pressed as the box is left with its lookup on its way, saves the record named', async () => {
    const { host, form, stored } = await mount(locale);
    const box = linkBox(host);
    enter(box);
    keys(box, NILE[locale]);
    leave(box);
    expect(await form.save()).toBe(true);
    expect(label(stored())).toBe(NILE[locale]);
  });

  it('the Save button with words that name none refuses them, and keeps them, marked, in the box left', async () => {
    const { host, form, stored } = await mount(locale);
    const box = linkBox(host);
    enter(box);
    keys(box, 'Narnia');
    leave(box);
    expect(await form.save()).toBe(false);
    expect(label(stored())).toBe('Acme');
    expect(box.value).toBe('Narnia');
    expect(box.getAttribute('aria-invalid')).toBe('true');
    expect(form.getState().errors['client_id']).toBe(noMatch(locale, form, 'Narnia'));
    // Left alone again with nothing waiting for it, the words stay, still unread with why: never put back unsaid.
    box.focus();
    leave(box);
    await form.settled();
    expect(box.value).toBe('Narnia');
    expect(form.getState().unread['client_id']?.text).toBe('Narnia');
    expect(await form.save()).toBe(false);
  });

  it('a check made while the name is looked up refuses it meanwhile, and passes once it is found', async () => {
    const { host, form } = await mount(locale);
    const box = linkBox(host);
    enter(box);
    keys(box, NILE[locale]);
    expect(form.validate()).toBe(false);
    expect(form.reading()).toBe(true);
    expect(form.getState().errors['client_id']).toBe(WIDGET_LABELS[locale].lookingUp.replace('{label}', 'Client').replace('{text}', quoted(NILE[locale])));
    await form.settle();
    expect(form.reading()).toBe(false);
    expect(form.validate()).toBe(true);
    expect(label(form.getState().values['client_id'])).toBe(NILE[locale]);
  });

  it('the box emptied and saved by Ctrl+Enter saves no client, as leaving it would', async () => {
    const { host, form, stored } = await mount(locale);
    const box = linkBox(host);
    enter(box);
    box.value = '';
    box.dispatchEvent(new InputEvent('input', { inputType: 'deleteContentBackward', bubbles: true }));
    ctrlEnter(box);
    await form.settled();
    expect(stored()).toBeNull();
  });

  it('Done saves the record the words name before it locks; words that name none keep it open, said', async () => {
    const { host, form, stored } = await mount(locale, { editSwitch: true });
    const done = host.querySelector('.fd-edit-switch') as HTMLButtonElement;
    const box = linkBox(host);
    enter(box);
    keys(box, 'Narnia');
    leave(box);
    done.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await form.settled();
    const locked = () => (host.querySelector('.fd-form') as HTMLElement).hasAttribute('data-readonly');
    expect(locked()).toBe(false);
    expect(label(stored())).toBe('Acme');
    expect(form.getState().errors['client_id']).toBe(noMatch(locale, form, 'Narnia'));
    box.focus();
    box.value = '';
    keys(box, NILE[locale]);
    leave(box);
    done.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
    await form.settled();
    expect(label(stored())).toBe(NILE[locale]);
    expect(locked()).toBe(true);
  });

  it('the pager saves the record the words name before it moves on', async () => {
    const { host, form, stored } = await mount(locale, { records: [1, 2] });
    const box = linkBox(host);
    enter(box);
    keys(box, NILE[locale]);
    const next = host.querySelectorAll<HTMLButtonElement>('.fd-record-step')[1];
    next.click();
    await until(() => form.getState().recordId === 2);
    await form.settled();
    expect(label(stored())).toBe(NILE[locale]);
    expect(form.getState().recordId).toBe(2);
  });
});

describe('a wizard’s Next with a name still being looked up', () => {
  const wizard = {
    fieldia: '0.1',
    id: 'visit',
    data: { kind: 'responses' },
    fields: { client: { type: 'many2one', label: 'Client', relation: 'partner', required: true }, note: { type: 'char', label: 'Note' } },
    layout: {
      type: 'wizard',
      id: 'w',
      children: [
        { type: 'step', id: 's1', label: 'Who', children: [{ type: 'field', id: 'f-client', field: 'client' }] },
        { type: 'step', id: 's2', label: 'What', children: [{ type: 'field', id: 'f-note', field: 'note' }] },
      ],
    },
  } as unknown as Page;

  it('goes on once the record is found, with it; words that name none keep it on the step, said', async () => {
    const dataSource = createMemoryDataSource({ records: { partner: { 1: { name: 'Acme' }, 2: { name: 'Nile Interiors' } } }, delayMs: 20 });
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountViewer(host, { page: wizard, dataSource });
    const form = handle.form;
    const box = linkBox(host);
    enter(box);
    keys(box, 'Narnia');
    ctrlEnter(box);
    await until(() => (form.getState().errors['client'] ?? '').includes('Narnia'));
    expect(form.getState().step).toBe('s1');
    expect(form.getState().errors['client']).toContain('Narnia');
    box.value = '';
    keys(box, 'Nile Interiors');
    ctrlEnter(box);
    await until(() => form.getState().step === 's2');
    expect(form.getState().step).toBe('s2');
    expect(label(form.getState().values['client'])).toBe('Nile Interiors');
  });
});
