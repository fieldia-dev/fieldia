import { act, render } from '@testing-library/react';
import type { Page } from '@fieldia/core';
import type { ViewerHandle } from '@fieldia/viewer';
import { datePart } from '@fieldia/widgets';
import { createRef } from 'react';
import { FieldiaForm, type FieldComponentProps } from './fieldia-form';

/**
 * Before its parts have come (parts.ts in @fieldia/widgets): a page with a
 * date is drawn once the date part has come, after the component mounted —
 * and its fields written in React and its slots are rendered then, never
 * left out. This file starts with no part loaded (src/test-parts.ts leaves it so).
 */

const visit: Page = {
  fieldia: '0.1',
  id: 'visit',
  data: { kind: 'responses' },
  fields: { nickname: { type: 'char', label: 'Nickname' }, day: { type: 'date', label: 'Day' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-nickname', field: 'nickname', widget: 'shout' },
      { type: 'field', id: 'f-day', field: 'day' },
      { type: 'slot', id: 'note', name: 'note' },
    ],
  },
} as Page;

const Shout = ({ value, id, onChange }: FieldComponentProps) => <input id={id} aria-label="nickname" value={(value as string) ?? ''} onChange={(e) => onChange(e.target.value || null)} />;
const Note = () => <p data-testid="note">A note</p>;

describe('<FieldiaForm> before its parts have come', () => {
  it('renders its React fields and slots once a page that waited for its date part is drawn', async () => {
    expect(datePart.loaded).toBeUndefined();
    const ref = createRef<ViewerHandle | null>();
    const { container } = render(<FieldiaForm ref={ref} page={visit} fieldTypes={{ 'char.shout': Shout }} slots={{ note: Note }} />);
    // Nothing of the page yet: it waits for the date part.
    expect(container.querySelector('[data-node]')).toBeNull();
    await act(async () => {
      await ref.current?.drawn;
    });
    expect(container.querySelector('[data-node="f-day"] .fd-date-pick')).not.toBeNull();
    expect(container.querySelector('[data-node="note"] [data-testid="note"]')).not.toBeNull();
    expect(container.querySelector('[data-node="f-nickname"] input[aria-label="nickname"]')).not.toBeNull();
  });
});
