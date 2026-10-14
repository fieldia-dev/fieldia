import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { Page } from '@fieldia/core';
import { useState } from 'react';
import { FieldiaForm, type FieldComponentProps, type SlotComponentProps } from './fieldia-form';

/**
 * The app's own React components kept to their place: one that throws as it renders — a field's or a slot's — shows
 * the small box that names it, and the rest of the form stays mounted and working. Without this, React takes down
 * the whole tree under the nearest boundary: the form with it.
 */

const page: Page = {
  fieldia: '0.1',
  id: 'react-contained',
  data: { kind: 'responses' },
  fields: { nickname: { type: 'char', label: 'Nickname' }, price: { type: 'float', label: 'Price' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nickname', field: 'nickname' },
      { type: 'field', id: 'f-price', field: 'price', widget: 'fancy' },
      { type: 'slot', id: 'n-feed', name: 'feed' },
    ],
  },
};

/** Throws once its value is 13, as a component with a bug for one value would. */
function Fancy({ value, id }: FieldComponentProps) {
  if (value === 13) throw new Error('thirteen');
  return <input id={id} aria-label="price" readOnly value={String(value ?? '')} />;
}

function Feed(_: SlotComponentProps) {
  const [broken, setBroken] = useState(false);
  if (broken) throw new Error('the feed fell over');
  return (
    <button type="button" onClick={() => setBroken(true)}>
      Break the feed
    </button>
  );
}

let consoleError: jest.SpyInstance;
beforeEach(() => {
  // React and Fieldia both say what went wrong: expected here.
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  cleanup();
  consoleError.mockRestore();
});

describe('<FieldiaForm> with a component that throws', () => {
  it("as a field's component renders: its box takes its place, and the form stays mounted and working", async () => {
    const onError = jest.fn();
    let handle: { form: { setValue(name: string, value: unknown): void; getState(): { values: Record<string, unknown> } } } | null = null;
    const { container } = render(<FieldiaForm page={page} fieldTypes={{ 'float.fancy': Fancy }} slots={{ feed: Feed }} onError={onError} onReady={(ready) => (handle = ready as never)} />);
    await act(async () => undefined);
    expect(container.querySelector('input[aria-label="price"]')).not.toBeNull();
    await act(async () => handle?.form.setValue('price', 13));
    expect(container.querySelector('[data-node="f-price"] .fd-broken')?.textContent).toBe('This field could not be shown: Price');
    expect(container.querySelector('input[aria-label="price"]')).toBeNull();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'thirteen' }), expect.objectContaining({ stage: 'update', part: 'field', field: 'price' }));
    // The rest is still there and still works.
    const nickname = container.querySelector('[data-node="f-nickname"] input') as HTMLInputElement;
    fireEvent.input(nickname, { target: { value: 'Sara' } });
    expect(handle!.form.getState().values['nickname']).toBe('Sara');
    expect(container.querySelector('.fd-form')).not.toBeNull();
  });

  it("as a slot's component renders: its box shows in the slot, and the form stays", async () => {
    const onError = jest.fn();
    const { container, getByText } = render(<FieldiaForm page={page} fieldTypes={{ 'float.fancy': Fancy }} slots={{ feed: Feed }} onError={onError} />);
    await act(async () => undefined);
    await act(async () => fireEvent.click(getByText('Break the feed')));
    const feed = container.querySelector('[data-node="n-feed"]') as HTMLElement;
    expect(feed.querySelector('.fd-broken')?.textContent).toBe('This part could not be shown');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'the feed fell over' }), expect.objectContaining({ part: 'slot', name: 'feed' }));
    expect(container.querySelector('[data-node="f-nickname"] input')).not.toBeNull();
  });
});
