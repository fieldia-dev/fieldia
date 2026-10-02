import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { createForm, type Page } from '@fieldia/core';
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

  it('switches skin without mounting again', () => {
    let mounts = 0;
    const survey = page('survey');
    const { container, rerender } = render(<FieldiaForm page={survey} skin="underline" onReady={() => mounts++} />);
    rerender(<FieldiaForm page={survey} skin="outlined" onReady={() => mounts++} />);
    expect(container.querySelector('.fd-form')?.getAttribute('data-fd-skin')).toBe('outlined');
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

  it('cleans up when it unmounts', () => {
    const { container, unmount } = render(<FieldiaForm page={page('survey')} />);
    const host = container.firstElementChild as HTMLElement;
    unmount();
    expect(host.querySelector('.fd-form')).toBeNull();
  });
});
