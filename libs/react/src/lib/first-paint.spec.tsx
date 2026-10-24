import { act } from '@testing-library/react';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import type { Ref } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { FieldiaForm } from './fieldia-form';

/**
 * A Next page's form: `<FieldiaForm firstPaint>` renders the form's first paint on the server (react-dom/server, as
 * Next renders a client component), the browser hydrates it as it is — no mismatch, nothing drawn again — and the
 * viewer mounts over it once drawn and loaded, keeping what was typed in the first paint meanwhile.
 */

const page: Page = {
  fieldia: '0.11',
  id: 'enquiry',
  title: 'Property enquiry',
  data: { kind: 'record', model: 'crm.enquiry' },
  fields: { name: { type: 'char', label: 'Client', required: true }, email: { type: 'char', label: 'Email' }, garden: { type: 'boolean', label: 'Needs a garden' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-email', field: 'email' },
      { type: 'field', id: 'f-garden', field: 'garden' },
    ],
  },
};
const record = { name: 'Nile Traders', email: '', garden: true };

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe('<FieldiaForm firstPaint> in Next', () => {
  it('renders the first paint on the server, hydrates it as it is, and the viewer mounts over it keeping what was typed', async () => {
    const dataSource = createMemoryDataSource({ records: { 'crm.enquiry': { 1: record } } });
    const app = (ref?: Ref<ViewerHandle | null>) => <FieldiaForm ref={ref} page={page} dataSource={dataSource} recordId={1} nonce="r4nd0m" firstPaint={{ values: record }} />;
    // The server's HTML: the form's values, Fieldia's look with the nonce, no script needed.
    const html = renderToString(app());
    expect(html).toContain('data-fd-first-paint');
    expect(html).toContain('value="Nile Traders"');
    expect(html).toContain('<style id="fieldia-styles" nonce="r4nd0m">');
    const container = document.createElement('div');
    container.innerHTML = html;
    document.body.append(container);
    // A person types in it before the page's script has come.
    const typed = container.querySelector<HTMLInputElement>('[data-fd-first-paint] [data-field="email"] input') as HTMLInputElement;
    typed.value = 'sales@nile.example';
    typed.focus();
    const complaints = jest.spyOn(console, 'error');
    const handle = { current: null as ViewerHandle | null };
    await act(async () => {
      root = hydrateRoot(container, app(handle));
    });
    // Hydrated as it was: nothing said about a mismatch.
    expect(complaints.mock.calls.filter((call) => /hydrat|did not match|mismatch/i.test(String(call[0])))).toEqual([]);
    complaints.mockRestore();
    await act(async () => {
      await handle.current?.drawn;
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector('[data-fd-first-paint]')).toBeNull();
    const live = container.querySelector<HTMLInputElement>('.fd-form [data-field="email"] input') as HTMLInputElement;
    expect(live.value).toBe('sales@nile.example');
    expect(handle.current?.form.getState().values).toMatchObject({ email: 'sales@nile.example', name: 'Nile Traders', garden: true });
    expect(document.activeElement).toBe(live);
    // Fieldia's sheet from the server, kept: none added twice.
    expect(document.querySelectorAll('#fieldia-styles')).toHaveLength(1);
  });

  it('without firstPaint, renders an empty host on the server, as before', () => {
    expect(renderToString(<FieldiaForm page={page} />)).toBe('<div></div>');
  });
});
