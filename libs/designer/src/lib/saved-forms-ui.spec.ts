import type { FormNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, type PageStore } from './designer';
import { button, choose, field, mount, tile } from './test-editor';

/**
 * The screen editor with saved forms: “A saved form” in the toolbox's More,
 * a menu of the app's saved forms, the one placed drawn on the canvas as the
 * form draws it — read-only, in a frame with its title and “Open it” — and
 * its settings in the panel: which one, its version, its title, where its
 * answers go.
 */

const address = (street: string): Page => ({
  fieldia: '0.1',
  id: 'address',
  title: 'Address',
  data: { kind: 'responses' },
  fields: { street: { type: 'char', label: street, required: true }, city: { type: 'char', label: 'City' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 'where', columns: 2, children: [{ type: 'field', id: 'street', field: 'street' }, { type: 'field', id: 'city', field: 'city' }] }] },
});
const contact: Page = {
  fieldia: '0.1',
  id: 'contact',
  title: 'Contact person',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'name', field: 'name' }, { type: 'form', id: 'visit', page: 'site-visit', name: 'visit' }] },
};

const settle = async () => {
  for (let i = 0; i < 6; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

async function editor(options: { list?: boolean; openForm?: (id: string) => void } = {}) {
  const store = createMemoryPageStore();
  await store.publish(address('Street'));
  await store.publish(address('Street and number'));
  await store.publish(contact);
  const used: PageStore = options.list === false ? { load: store.load, saveDraft: store.saveDraft, publish: store.publish } : store;
  const designer = createDesigner({ page: blankPage('screen', 'Site visit'), store: used, openForm: options.openForm });
  designer.updateQuestion(designer.addQuestion('short-answer', { parent: 'section-1' }) as string, { label: 'Visitor' });
  const { host } = mount(designer, { mode: 'advanced' });
  return { designer, host };
}

const parts = (page: Page) => (page.layout as { children: SectionNode[] }).children[0].children.filter((n) => n.type === 'form') as FormNode[];
const frame = (host: Element, id: string) => host.querySelector(`.fd-canvas-form[data-node="${id}"]`) as HTMLElement;

async function place(host: Element, which: string) {
  tile(host, 'form:saved').click();
  await settle();
  (document.querySelector(`.fd-menu [data-item="${which}"]`) as HTMLButtonElement).click();
  await settle();
}

describe('the screen editor with saved forms', () => {
  it('offers “A saved form” under More, only when the app’s store lists its saved forms', async () => {
    const listed = await editor();
    const more = tile(listed.host, 'form:saved');
    expect(more.closest('.fd-tool-group')?.getAttribute('data-group')).toBe('More');
    expect(more.textContent).toBe('A saved form');
    expect(more.hidden).toBe(false);
    document.body.replaceChildren();
    const unlisted = await editor({ list: false });
    expect(tile(unlisted.host, 'form:saved').hidden).toBe(true);
  });

  it('places the one picked from a menu of the app’s saved forms, drawn as the form draws it, in a frame, nothing in it to type in', async () => {
    const { designer, host } = await editor();
    tile(host, 'form:saved').click();
    await settle();
    expect([...document.querySelectorAll('.fd-menu [data-item]')].map((item) => item.textContent)).toEqual(['Address', 'Contact person']);
    (document.querySelector('.fd-menu [data-item="address"]') as HTMLButtonElement).click();
    await settle();
    const [part] = parts(designer.getPage());
    // A whole row of its group.
    expect(part).toMatchObject({ page: 'address', name: 'address', colspan: 2 });
    expect(designer.getState().selected).toBe(part.id);
    const shown = frame(host, part.id);
    expect(shown.querySelector('.fd-canvas-form-tag')?.textContent).toBe('Saved form “Address” · latest version');
    // Placed as the form places it: its card, its title over it, its fields; shown, never used here.
    const body = shown.querySelector('.fd-canvas-form-body') as HTMLElement;
    expect(body.hasAttribute('inert')).toBe(true);
    expect(body.querySelector('.fd-form-part > legend')?.textContent).toBe('Address');
    expect(body.querySelector('[data-saved-node="street"] .fd-label')?.textContent).toBe('Street and number');
    expect(body.querySelector('[data-saved-node="street"] input')).not.toBeNull();
    // Its parts keep their ids apart from the page's: the canvas never mistakes one for a part of this page.
    expect(body.querySelector('[data-node]')).toBeNull();
    // No “Open it” without the app's way to open one.
    expect(button(shown, 'Open it')).toBeUndefined();
  });

  it('opens the saved form where it is made, the app’s way', async () => {
    const opened: string[] = [];
    const { designer, host } = await editor({ openForm: (id) => opened.push(id) });
    await place(host, 'address');
    const [part] = parts(designer.getPage());
    button(frame(host, part.id), 'Open it')?.click();
    expect(opened).toEqual(['address']);
  });

  it('keeps to a version picked in the panel, and draws that version', async () => {
    const { designer, host } = await editor();
    await place(host, 'address');
    const [part] = parts(designer.getPage());
    expect(field(host, 'Saved form')?.value).toBe('address');
    const version = field(host, 'Version') as HTMLSelectElement;
    expect([...version.options].map((o) => o.textContent?.replace(/ ·.*$/, ''))).toEqual(['Latest version', 'Version 2', 'Version 1']);
    choose(version, '1');
    expect(parts(designer.getPage())[0].version).toBe(1);
    const shown = frame(host, part.id);
    expect(shown.querySelector('.fd-canvas-form-tag')?.textContent).toBe('Saved form “Address” · version 1');
    expect(shown.querySelector('[data-saved-node="street"] .fd-label')?.textContent).toBe('Street');
  });

  it('takes a title and a name for its answers in the panel, and refuses a name that would mix them', async () => {
    const { designer, host } = await editor();
    await place(host, 'address');
    const [part] = parts(designer.getPage());
    const name = field(host, 'Answers go under') as HTMLInputElement;
    expect(name.value).toBe('address');
    name.value = 'home';
    name.dispatchEvent(new Event('change', { bubbles: true }));
    expect(parts(designer.getPage())[0].name).toBe('home');
    const title = field(host, 'Title') as HTMLInputElement;
    expect(title.placeholder).toBe('Address');
    title.value = 'Home address';
    title.dispatchEvent(new Event('input', { bubbles: true }));
    expect(frame(host, part.id).querySelector('.fd-form-part > legend')?.textContent).toBe('Home address');
    (field(host, 'Show a title') as HTMLInputElement).click();
    expect(parts(designer.getPage())[0].title).toBe('');
    expect(frame(host, part.id).querySelector('.fd-form-part > legend')).toBeNull();
    (field(host, 'Show a title') as HTMLInputElement).click();
    expect(parts(designer.getPage())[0].title).toBeUndefined();
    const firstField = Object.keys(designer.getPage().fields)[0];
    const again = field(host, 'Answers go under') as HTMLInputElement;
    again.value = firstField;
    again.dispatchEvent(new Event('change', { bubbles: true }));
    expect(parts(designer.getPage())[0].name).toBe('home');
    expect(again.getAttribute('aria-invalid')).toBe('true');
    expect(designer.getState().issues.join(' ')).toContain('is a field of this page');
  });

  it('refuses a saved form that would hold this page, in words', async () => {
    const { designer, host } = await editor();
    await place(host, 'contact');
    expect(parts(designer.getPage())).toEqual([]);
    expect(designer.getState().issues).toEqual(['“Contact person” holds this page: it would be placed inside itself (Site visit → Contact person → Site visit)']);
    expect(host.textContent).toContain('“Contact person” holds this page');
  });

  it('says on the canvas what the Checks list says of one that cannot be found', async () => {
    const { designer, host } = await editor();
    await place(host, 'address');
    const [part] = parts(designer.getPage());
    designer.setForm(part.id, { page: 'nowhere' });
    await settle();
    const note = frame(host, part.id).querySelector('.fd-canvas-form-note') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe('The saved form “nowhere” cannot be found: the form would say so in its place.');
    expect(designer.checks().some((c) => c.at === part.id && c.severity === 'must')).toBe(true);
  });
});
