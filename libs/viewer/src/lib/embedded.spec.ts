import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type PageRequest, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * A saved form placed in another: drawn where it stands from the page the
 * app gives for its id, its fields answered and checked as on their own
 * page, its answers sent nested under its name. A page still coming shows a
 * quiet placeholder; one that cannot be found, or would hold itself, says so.
 */

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const example = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));

const address: Page = {
  fieldia: '0.1',
  id: 'address',
  title: 'Address',
  data: { kind: 'responses' },
  fields: {
    street: { type: 'char', label: 'Street', required: true },
    city: { type: 'char', label: 'City' },
  },
  layout: { type: 'sections', id: 'root', children: [{ type: 'section', id: 'where', columns: 2, children: [{ type: 'field', id: 'street', field: 'street' }, { type: 'field', id: 'city', field: 'city' }] }] },
};

function delivery(...extra: Record<string, unknown>[]): Page {
  return {
    fieldia: '0.1',
    id: 'delivery',
    title: 'Delivery',
    data: { kind: 'responses' },
    fields: { full_name: { type: 'char', label: 'Full name' }, locked: { type: 'boolean', label: 'Locked' } },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'n', field: 'full_name' },
        { type: 'form', id: 'home', page: 'address', name: 'home', title: 'Home address' },
        { type: 'form', id: 'work', page: 'address', name: 'work', ...(extra[0] ?? {}) },
        ...extra.slice(1),
      ],
    },
  } as unknown as Page;
}

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount(page: Page, options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, pages: { address }, ...options });
  return { host, form: handle.form };
}

const part = (host: Element, id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
const box = (within: Element, node: string) => within.querySelector(`[data-node="${node}"] input`) as HTMLInputElement;
const visible = (el: Element | null) => !!el && !el.closest('[hidden]');
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
function type(input: HTMLInputElement, text: string) {
  input.focus();
  input.value = text;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('a saved form placed in another', () => {
  it('draws the saved form’s fields in place, under its title, once for each copy', () => {
    const { host } = mount(delivery());
    const home = part(host, 'home');
    expect(home.tagName).toBe('FIELDSET');
    expect(home.querySelector(':scope > legend')?.textContent).toBe('Home address');
    // The saved page's own title when the part gives none.
    expect(part(host, 'work').querySelector(':scope > legend')?.textContent).toBe('Address');
    expect(home.querySelector('[data-node="street"] .fd-label')?.textContent).toBe('Street');
    expect(home.querySelector('[data-node="street"]')?.classList.contains('fd-required')).toBe(true);
    // Two copies, and every element still has an id of its own, its label naming its own box.
    const ids = [...host.querySelectorAll('[id]')].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const label = home.querySelector('[data-node="street"] label') as HTMLLabelElement;
    expect(label.htmlFor).toBe(box(home, 'street').id);
  });

  it('keeps each copy’s answers under its name', () => {
    const { host, form } = mount(delivery());
    type(box(part(host, 'home'), 'street'), '12 Nile Street');
    type(box(part(host, 'work'), 'street'), '3 Harbour Road');
    expect(form.getState().values['home']).toEqual({ street: '12 Nile Street', city: null });
    expect(form.getState().values['work']).toEqual({ street: '3 Harbour Road', city: null });
  });

  it('refuses to send while a field inside asks for an answer, in that field’s words, and sends the answers nested', async () => {
    const dataSource = createMemoryDataSource();
    const { host, form } = mount(delivery(), { dataSource });
    type(box(part(host, 'work'), 'street'), '3 Harbour Road');
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await form.settled();
    const home = part(host, 'home');
    const error = home.querySelector('[data-node="street"] .fd-error') as HTMLElement;
    expect(visible(error)).toBe(true);
    expect(error.textContent).toBe('Street is required');
    expect(box(home, 'street').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(box(home, 'street'));
    // The words said at once name the field, and the saved form it is in.
    await new Promise((resolve) => setTimeout(resolve, 5));
    expect(host.querySelector('.fd-announce')?.textContent).toBe('Not sent. Check: Street (Home address)');
    type(box(home, 'street'), '12 Nile Street');
    expect(visible(error)).toBe(false);
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await form.settled();
    expect(dataSource.responses[0].values).toEqual({
      full_name: null,
      home: { street: '12 Nile Street', city: null },
      work: { street: '3 Harbour Road', city: null },
    });
  });

  it('shows a quiet placeholder while the page comes, then the form', async () => {
    let give: (page: Page) => void = () => undefined;
    const asked: PageRequest[] = [];
    const { host, form } = mount(delivery({ version: 2 }), {
      pages: (request) => {
        asked.push(request);
        return new Promise<Page>((resolve) => (give = resolve));
      },
    });
    const work = part(host, 'work');
    expect(work.querySelector('.fd-form-part-note')?.textContent).toBe('Loading…');
    expect(work.getAttribute('aria-busy')).toBe('true');
    expect(asked).toEqual([{ id: 'address' }, { id: 'address', version: 2 }]);
    give(address);
    await flush();
    expect(work.querySelector('.fd-form-part-note')).toBeNull();
    expect(work.hasAttribute('aria-busy')).toBe(false);
    type(box(work, 'street'), 'Kept to version 2');
    expect(form.getState().values['work']).toEqual({ street: 'Kept to version 2', city: null });
  });

  it('finds a version kept to by `id@version` in a record of pages', () => {
    const second = { ...address, title: 'Address, second version' };
    const { host } = mount(delivery({ version: 2 }), { pages: { address, 'address@2': second } });
    expect(part(host, 'work').querySelector(':scope > legend')?.textContent).toBe('Address, second version');
  });

  it('says so when the page cannot be found, and the rest of the form still works', async () => {
    const dataSource = createMemoryDataSource();
    const { host, form } = mount(delivery({ page: 'nowhere' }), { dataSource });
    const work = part(host, 'work');
    expect(work.querySelector('.fd-form-part-note')?.textContent).toBe('The saved form “nowhere” cannot be found.');
    type(box(part(host, 'home'), 'street'), '12 Nile Street');
    (host.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    await form.settled();
    expect(dataSource.responses[0].values).toEqual({ full_name: null, home: { street: '12 Nile Street', city: null } });
  });

  it('says so when the app’s finder fails', async () => {
    const { host } = mount(delivery(), { pages: () => Promise.reject(new Error('offline')) });
    await flush();
    expect(part(host, 'home').querySelector('.fd-form-part-note')?.textContent).toBe('The saved form “address” cannot be found.');
  });

  it('refuses a page that would hold itself, through another, in words', () => {
    const loop: Page = { ...address, id: 'loop', title: 'Loop', layout: { type: 'sections', id: 'root', children: [{ type: 'form', id: 'back', page: 'delivery', name: 'back' }] } };
    const { host } = mount(delivery({ page: 'loop' }), { pages: { address, loop, delivery: delivery() } });
    const back = part(host, 'work').querySelector('[data-node="back"]') as HTMLElement;
    expect(back.querySelector('.fd-form-part-note')?.textContent).toBe('The saved form “Delivery” is not shown here: it would be placed inside itself (Delivery → Loop → Delivery).');
  });

  it('refuses a wizard, a sheet or a list, which cannot sit in another form', () => {
    const { host } = mount(delivery({ page: 'survey' }), { pages: { address, survey: example('survey') } });
    expect(part(host, 'work').querySelector('.fd-form-part-note')?.textContent).toBe(
      'The saved form “Product feedback” cannot be placed here: only a form of sections or tabs can.'
    );
  });

  it('shows no title when the part’s title is empty', () => {
    const { host } = mount(delivery({ title: '' }));
    expect(part(host, 'work').querySelector(':scope > legend')).toBeNull();
  });

  it('hides it by its condition, and locks its fields while the part is read-only or the form is', () => {
    const { host, form } = mount(delivery({ invisible: 'full_name == "hide"', readonly: 'locked' }));
    const work = part(host, 'work');
    form.setValue('full_name', 'hide');
    expect(work.hidden).toBe(true);
    form.setValue('full_name', 'Sara');
    expect(work.hidden).toBe(false);
    expect(box(work, 'street').readOnly).toBe(false);
    form.setValue('locked', true);
    expect(box(work, 'street').readOnly).toBe(true);
    expect(box(part(host, 'home'), 'street').readOnly).toBe(false);
    handle?.setReadonly(true);
    expect(box(part(host, 'home'), 'street').readOnly).toBe(true);
  });

  it('draws its words in the page’s language, and runs right to left with it', () => {
    const arabic: Page = { ...address, translations: { ar: { Address: 'العنوان', Street: 'الشارع' } } };
    const { host } = mount(delivery(), { pages: { address: arabic }, locale: 'ar' });
    const work = part(host, 'work');
    expect(work.querySelector(':scope > legend')?.textContent).toBe('العنوان');
    expect(work.querySelector('[data-node="street"] .fd-label')?.textContent).toBe('الشارع');
    expect(host.querySelector('.fd-form')?.getAttribute('dir')).toBe('rtl');
  });

  it('opens a link’s record from `pages` too, by its model', async () => {
    const customer = { name: 'Nile Traders', is_company: true, state: 'active' };
    const dataSource = createMemoryDataSource({ records: { partner: { 1: customer } } });
    const { host, form } = mount(example('fields'), { dataSource, pages: { partner: example('customer') } });
    form.setValue('client_id', { id: 1, label: 'Nile Traders' });
    await flush();
    (part(host, 'f-client').querySelector('button.fd-combo-open') as HTMLButtonElement).click();
    await flush();
    expect(document.querySelector('.fd-form-dialog [data-node="#title"] input')).not.toBeNull();
  });
});
