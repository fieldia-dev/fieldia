import type { Page } from '@fieldia/core';
import { customers, partners, until } from './test-list';
import { mountViewer, type ViewerHandle } from './viewer';

/** A country with buttons that leave it: its customers in a list, and its page on the web. */
const country: Page = {
  fieldia: '0.1',
  id: 'country',
  title: 'Country',
  data: { kind: 'record', model: 'country' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    buttons: [
      {
        type: 'button',
        id: 'customers',
        label: 'Customers',
        steps: [{ do: 'open', page: 'customers', as: 'page', filter: [{ field: 'country_id', op: '=', valueFrom: 'id' }] }],
      },
      { type: 'button', id: 'web', label: 'On the web', steps: [{ do: 'openUrl', url: "'https://en.wikipedia.org/wiki/' + name" }] },
    ],
    children: [{ type: 'field', id: 'f-name', field: 'name' }],
  },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
  jest.restoreAllMocks();
});

async function mountCountry() {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = partners();
  dataSource.records['country'] = { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } };
  handle = mountViewer(host, { page: country, dataSource, recordId: 1, pages: { customers } });
  await handle.form.settled();
  return host;
}
const press = (host: Element, name: string) => ([...host.querySelectorAll('button')].find((b) => b.textContent?.trim() === name) as HTMLButtonElement).click();
const names = (host: Element) => [...host.querySelectorAll('.fd-list-table tbody tr.fd-list-row')].map((row) => row.querySelectorAll('td')[1]?.textContent);

describe('steps that leave the form', () => {
  it('opens a list of the records related to this one, whatever is searched there', async () => {
    const host = await mountCountry();
    press(host, 'Customers');
    await until(() => names(host).length);
    expect(names(host)).toEqual(['Amira Clinics', 'Nile Traders']);
    expect(host.querySelector('.fd-pager-text')?.textContent).toBe('1–2 / 2');
  });

  it('opens a web address in a new tab, apart from this page', async () => {
    const open = jest.spyOn(window, 'open').mockReturnValue(null);
    const host = await mountCountry();
    press(host, 'On the web');
    await until(() => open.mock.calls.length);
    expect(open).toHaveBeenCalledWith('https://en.wikipedia.org/wiki/Egypt', '_blank', 'noopener,noreferrer');
  });
});
