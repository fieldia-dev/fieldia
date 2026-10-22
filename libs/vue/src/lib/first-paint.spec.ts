import { createMemoryDataSource, type Page } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import { renderToString } from '@vue/server-renderer';
import { createSSRApp, h } from 'vue';
import { FieldiaForm } from './fieldia-form';

/**
 * A Nuxt page's form: `<FieldiaForm :first-paint>` renders the form's first paint on the server (@vue/server-renderer,
 * as Nuxt renders it), the browser hydrates it as it is — no mismatch, nothing drawn again — and the viewer mounts over
 * it once drawn and loaded, keeping what was typed in the first paint meanwhile.
 */

const page: Page = {
  fieldia: '0.9',
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

afterEach(() => {
  document.body.replaceChildren();
  document.head.replaceChildren();
});

describe('<FieldiaForm :first-paint> in Nuxt', () => {
  it('renders the first paint on the server, hydrates it as it is, and the viewer mounts over it keeping what was typed', async () => {
    const dataSource = createMemoryDataSource({ records: { 'crm.enquiry': { 1: record } } });
    let handle: ViewerHandle | null = null;
    const app = () => createSSRApp({ render: () => h(FieldiaForm, { page, dataSource, recordId: 1, nonce: 'r4nd0m', firstPaint: { values: record }, onReady: (ready: ViewerHandle) => (handle = ready) }) });
    // The server's HTML: the form's values, Fieldia's look with the nonce, no script needed.
    const html = await renderToString(app());
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
    const complaints = [jest.spyOn(console, 'warn'), jest.spyOn(console, 'error')];
    const mounted = app();
    mounted.mount(container);
    // Hydrated as it was: nothing said about a mismatch.
    expect(complaints.flatMap((spy) => spy.mock.calls).filter((call) => /hydrat|mismatch/i.test(String(call[0])))).toEqual([]);
    for (const spy of complaints) spy.mockRestore();
    expect(handle).not.toBeNull();
    await (handle as unknown as ViewerHandle).drawn;
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(container.querySelector('[data-fd-first-paint]')).toBeNull();
    const live = container.querySelector<HTMLInputElement>('.fd-form [data-field="email"] input') as HTMLInputElement;
    expect(live.value).toBe('sales@nile.example');
    expect((handle as unknown as ViewerHandle).form.getState().values).toMatchObject({ email: 'sales@nile.example', name: 'Nile Traders', garden: true });
    expect(document.activeElement).toBe(live);
    expect(document.querySelectorAll('#fieldia-styles')).toHaveLength(1);
    mounted.unmount();
  });

  it('without a first paint, renders an empty host on the server, as before', async () => {
    // Its host, in the fragment Vue marks a component of several roots with.
    expect(await renderToString(createSSRApp({ render: () => h(FieldiaForm, { page }) }))).toBe('<!--[--><div></div><!--]-->');
  });
});
