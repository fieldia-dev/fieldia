import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createForm, createMemoryDataSource, type Page, type RecordId } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import { createRef, useState } from 'react';
import { FieldiaForm, useFormState, type FieldComponentProps, type SlotComponentProps } from './fieldia-form';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));

const custom: Page = {
  fieldia: '0.1',
  id: 'custom-parts',
  data: { kind: 'responses' },
  fields: { nickname: { type: 'char', label: 'Nickname' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nickname', field: 'nickname', widget: 'shout' },
      { type: 'slot', id: 'note', name: 'note' },
    ],
  },
};

/** A product priced by the app, saved as a record. */
const pricing: Page = {
  fieldia: '0.1',
  id: 'pricing',
  data: { kind: 'record', model: 'shop.order' },
  fields: { product: { type: 'char', label: 'Product' }, price: { type: 'float', label: 'Price' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-product', field: 'product' },
      { type: 'field', id: 'f-price', field: 'price' },
      { type: 'button', id: 'price', label: 'Price it', action: 'price' },
    ],
  },
};

/** Two employees over a sheet with a gear menu, for the pager, the trail and the record's events. */
const staffPage: Page = {
  fieldia: '0.1',
  id: 'staff',
  data: { kind: 'record', model: 'hr.employee' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: { type: 'sheet', id: 'sheet', title: { field: 'name' }, toolbar: { menu: [{ id: 'm-dup', builtin: 'duplicate' }] }, children: [] },
};
const staff = () => createMemoryDataSource({ records: { 'hr.employee': { 1: { name: 'Mona Adel' }, 2: { name: 'Karim Fathy' } } } });
const waitFor = async (check: () => unknown) => {
  for (let waited = 0; !check() && waited < 2000; waited += 10) await new Promise((resolve) => setTimeout(resolve, 10));
};

function Shout({ value, onChange, id, readonly }: FieldComponentProps) {
  return (
    <span>
      <input id={id} aria-label="nickname" value={(value as string) ?? ''} readOnly={readonly} onChange={(e) => onChange(e.target.value || null)} />
      <output>{String(value ?? '').toUpperCase()}!</output>
    </span>
  );
}

function Note({ form }: SlotComponentProps) {
  const [clicks, setClicks] = useState(0);
  const state = useFormState(form);
  return (
    <div>
      <button type="button" onClick={() => setClicks((n) => n + 1)}>
        Clicked {clicks} {clicks === 1 ? 'time' : 'times'}
      </button>
      <span data-testid="seen">{String(state.values['nickname'] ?? '')}</span>
    </div>
  );
}

describe('<FieldiaForm>', () => {
  it('mounts the viewer into its own element', () => {
    const { container } = render(<FieldiaForm page={page('survey')} />);
    expect(container.querySelector('.fd-form')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDefined();
  });

  it('draws a saved form placed in the page from the pages it is given', () => {
    const { container } = render(<FieldiaForm page={page('delivery')} pages={{ address: page('address') }} />);
    const part = container.querySelector('[data-node="delivery-address"]') as HTMLElement;
    expect(part.querySelector('legend')?.textContent).toBe('Delivery address');
    expect(part.querySelector('[data-node="street"] .fd-label')?.textContent).toBe('Street and number');
  });

  it('hands the form the person using it: parts shown to their roles, again when they change', () => {
    const lock: Page = { ...pricing, layout: { type: 'sections', id: 'root', children: [{ type: 'button', id: 'lock', label: 'Lock', action: 'lock', roles: ['sales.manager'] }] } };
    const { rerender } = render(<FieldiaForm page={lock} user={{ id: 4, roles: ['sales.user'] }} />);
    expect(screen.queryByRole('button', { name: 'Lock' })).toBeNull();
    rerender(<FieldiaForm page={lock} user={{ id: 5, roles: ['sales.manager'] }} />);
    expect(screen.getByRole('button', { name: 'Lock' })).toBeDefined();
  });

  it('hands the form the values the app passes in, as context, again when they change', () => {
    const lock: Page = { ...pricing, layout: { type: 'sections', id: 'root', children: [{ type: 'button', id: 'lock', label: 'Lock', action: 'lock', invisible: "context.code != 'incoming'" }] } };
    const { rerender } = render(<FieldiaForm page={lock} context={{ code: 'outgoing' }} />);
    expect(screen.queryByRole('button', { name: 'Lock' })).toBeNull();
    rerender(<FieldiaForm page={lock} context={{ code: 'incoming' }} />);
    expect(screen.getByRole('button', { name: 'Lock' })).toBeDefined();
  });

  it('switches skin without mounting again', () => {
    let mounts = 0;
    const survey = page('survey');
    const { container, rerender } = render(<FieldiaForm page={survey} skin="underline" onReady={() => mounts++} />);
    rerender(<FieldiaForm page={survey} skin="outlined" onReady={() => mounts++} />);
    expect(container.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('outlined');
    expect(mounts).toBe(1);
  });

  it('wears a theme on its own skin, and switches it without mounting again', () => {
    let mounts = 0;
    const survey = page('survey');
    const { container, rerender } = render(<FieldiaForm page={survey} theme="material" onReady={() => mounts++} />);
    const form = () => container.querySelector('.fd-form');
    expect(form()?.getAttribute('data-fd-theme')).toBe('material');
    expect(form()?.getAttribute('data-fd-skin')).toBe('outlined');
    rerender(<FieldiaForm page={survey} theme="odoo" onReady={() => mounts++} />);
    expect(form()?.getAttribute('data-fd-theme')).toBe('odoo');
    expect(form()?.getAttribute('data-fd-skin')).toBe('underline');
    expect(mounts).toBe(1);
  });

  it('wears the host’s tokens, and new ones in their place as they change, without mounting again', () => {
    let mounts = 0;
    const survey = page('survey');
    const { container, rerender } = render(<FieldiaForm page={survey} tokens={{ accent: '#0f766e' }} onReady={() => mounts++} />);
    const form = () => container.querySelector('.fd-form') as HTMLElement;
    expect(form().style.getPropertyValue('--fd-accent')).toBe('#0f766e');
    rerender(<FieldiaForm page={survey} tokens={{ accent: '#b45309', surface: '#1b2320' }} onReady={() => mounts++} />);
    expect(form().style.getPropertyValue('--fd-accent')).toBe('#b45309');
    expect(form().style.getPropertyValue('--fd-surface')).toBe('#1b2320');
    expect(mounts).toBe(1);
  });

  it('locks and unlocks the form as its readonly changes, without mounting again', () => {
    let mounts = 0;
    const signup = page('signup');
    const { container, rerender } = render(<FieldiaForm page={signup} readonly onReady={() => mounts++} />);
    const name = () => container.querySelector('[data-node="f-name"] input') as HTMLInputElement;
    expect(name().readOnly).toBe(true);
    rerender(<FieldiaForm page={signup} readonly={false} onReady={() => mounts++} />);
    expect(name().readOnly).toBe(false);
    expect(mounts).toBe(1);
  });

  it('hands the viewer out through a ref', () => {
    const ref = createRef<ViewerHandle | null>();
    render(<FieldiaForm ref={ref} page={page('survey')} />);
    expect(ref.current?.form.page.id).toBe('product-feedback');
  });

  it('renders a custom field written in React, both ways', () => {
    const ref = createRef<ViewerHandle | null>();
    render(<FieldiaForm ref={ref} page={custom} fieldTypes={{ 'char.shout': Shout }} />);
    fireEvent.change(screen.getByLabelText('nickname'), { target: { value: 'hello' } });
    expect(ref.current?.form.getState().values['nickname']).toBe('hello');
    expect(screen.getByText('HELLO!')).toBeDefined();
    act(() => ref.current?.form.setValue('nickname', 'from outside'));
    expect((screen.getByLabelText('nickname') as HTMLInputElement).value).toBe('from outside');
  });

  it('fills a slot with a React component that keeps its own state', () => {
    const ref = createRef<ViewerHandle | null>();
    render(<FieldiaForm ref={ref} page={custom} fieldTypes={{ 'char.shout': Shout }} slots={{ note: Note }} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clicked 0 times' }));
    expect(screen.getByRole('button', { name: 'Clicked 1 time' })).toBeDefined();
    act(() => ref.current?.form.setValue('nickname', 'Sam'));
    expect(screen.getByTestId('seen').textContent).toBe('Sam');
  });

  it('uses a form made elsewhere, so two views can share one record', () => {
    const shared = createForm({ page: page('survey') });
    render(<FieldiaForm page={shared.page} form={shared} />);
    act(() => shared.setValue('name', 'Shared'));
    expect((document.querySelector('[data-node="q-name"] input') as HTMLInputElement).value).toBe('Shared');
  });

  it('opens a list’s record through the newest onOpenRecord it was given, without mounting again', async () => {
    const dataSource = createMemoryDataSource({ records: { partner: { 7: { name: 'Delta Foods' } } } });
    const first: RecordId[] = [];
    const second: RecordId[] = [];
    const customers = page('customers');
    const { rerender } = render(<FieldiaForm page={customers} dataSource={dataSource} onOpenRecord={(id) => first.push(id)} />);
    const row = await screen.findByText('Delta Foods');
    fireEvent.click(row);
    rerender(<FieldiaForm page={customers} dataSource={dataSource} onOpenRecord={(id) => second.push(id)} />);
    fireEvent.click(screen.getByText('Delta Foods'));
    expect(first).toEqual([7]);
    expect(second).toEqual([7]);
  });

  it('tells the app the form’s events, through the newest handlers, and takes what onAction answers', async () => {
    const heard: string[] = [];
    const dataSource = createMemoryDataSource();
    const { rerender } = render(
      <FieldiaForm
        page={pricing}
        dataSource={dataSource}
        onChange={({ field, by }) => heard.push(`old change ${field} by ${by}`)}
      />
    );
    rerender(
      <FieldiaForm
        page={pricing}
        dataSource={dataSource}
        onAction={({ action }) => (action === 'price' ? { values: { price: 380 }, say: 'Priced' } : undefined)}
        onChange={({ field, by }) => heard.push(`change ${field} by ${by}`)}
        onRun={({ id, result }) => heard.push(`run ${id} ${result.done ? 'done' : result.reason}`)}
        onSave={({ values }) => heard.push(`save ${values['price']}`)}
      />
    );
    fireEvent.input(document.querySelector('[data-node="f-product"] input') as HTMLInputElement, { target: { value: 'Desk lamp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Price it' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect((document.querySelector('[data-node="f-price"] input') as HTMLInputElement).value).toBe('380.00');
    expect(document.querySelector('.fd-say')?.textContent).toContain('Priced');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(heard).toEqual(['change product by person', 'change price by step', 'run price done', 'save 380']);
  });

  it('opens a page a step asks for through the newest onOpen, without mounting again', async () => {
    const asked: string[] = [];
    const ref = createRef<ViewerHandle | null>();
    const into = { customer_id: 'id' };
    const withCustomer: Page = { ...pricing, fields: { ...pricing.fields, customer_id: { type: 'many2one', label: 'Customer', relation: 'partner' } } };
    const { rerender } = render(<FieldiaForm ref={ref} page={withCustomer} onOpen={() => undefined} />);
    rerender(<FieldiaForm ref={ref} page={withCustomer} onOpen={(request) => (asked.push(request.page), Promise.resolve({ saved: true, recordId: 4, values: { name: 'Delta Foods' } }))} />);
    let result: unknown;
    await act(async () => {
      result = await ref.current?.run([{ do: 'open', page: 'customer', as: 'page', into }]);
    });
    expect(result).toEqual({ done: true });
    expect(asked).toEqual(['customer']);
    expect(ref.current?.form.getState().values['customer_id']).toEqual({ id: 4, label: 'Delta Foods' });
  });

  it('tells the app a response sent and a wizard step entered', async () => {
    const sent: unknown[] = [];
    const steps: string[] = [];
    render(<FieldiaForm page={page('survey')} dataSource={createMemoryDataSource()} onSend={({ values }) => sent.push(values)} onStep={({ step }) => steps.push(step)} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.input(document.querySelector('[data-node="q-name"] input') as HTMLInputElement, { target: { value: 'Sara' } });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(steps).toEqual(['step-about', 'step-usage']);
    cleanup();
    render(<FieldiaForm page={{ ...pricing, data: { kind: 'responses' } }} dataSource={createMemoryDataSource()} onSend={({ values }) => sent.push(values)} />);
    fireEvent.input(document.querySelector('[data-node="f-product"] input') as HTMLInputElement, { target: { value: 'Desk lamp' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(sent).toEqual([{ product: 'Desk lamp', price: null }]);
  });

  it('draws the pager and the breadcrumbs the app gives, and tells each record the form shows', async () => {
    const shown: unknown[] = [];
    const { container } = render(<FieldiaForm page={staffPage} dataSource={staff()} recordId={1} records={[1, 2]} breadcrumbs={[{ label: 'Employees' }]} onRecord={(event) => shown.push(event.recordId)} />);
    await waitFor(() => container.querySelector('.fd-crumb-current')?.textContent === 'Mona Adel');
    expect(container.querySelector('.fd-record-pager-text')?.textContent).toBe('1 / 2');
    fireEvent.click(screen.getByRole('button', { name: 'Next record' }));
    await waitFor(() => container.querySelector('.fd-record-pager-text')?.textContent === '2 / 2');
    await waitFor(() => shown.length === 2);
    expect(shown).toEqual([1, 2]);
  });

  it('cleans up when it unmounts', () => {
    const { container, unmount } = render(<FieldiaForm page={page('survey')} />);
    const host = container.firstElementChild as HTMLElement;
    unmount();
    expect(host.querySelector('.fd-form')).toBeNull();
  });
});
