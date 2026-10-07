import type { Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/** A field's own value in a tone and bold while a condition holds, and a value drawn as a pill in its tone. */
let handle: ViewerHandle | undefined;
afterEach(() => {
  handle?.destroy();
  handle = undefined;
  document.body.replaceChildren();
});

const page = {
  fieldia: '0.1',
  id: 'ledger',
  data: { kind: 'record', model: 'legal.matter' },
  fields: {
    available: { type: 'float', label: 'Available' },
    minimum: { type: 'float', label: 'Minimum' },
    status: { type: 'selection', label: 'Deadline status', options: [{ value: 'ok', label: 'On time' }, { value: 'late', label: 'Overdue' }] },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-available', field: 'available', tones: [{ tone: 'danger', when: 'available < minimum' }], bold: 'available < 0' },
      { type: 'field', id: 'f-minimum', field: 'minimum' },
      { type: 'field', id: 'f-status', field: 'status', widget: 'badge', tones: [{ tone: 'danger', when: "status == 'late'" }, { tone: 'success', when: "status == 'ok'" }] },
    ],
  },
} as unknown as Page;

function mount(values: Record<string, unknown>) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page, values: values as never });
  return { host, form: handle.form };
}

const field = (host: Element, id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;

describe('a field’s own value in a tone', () => {
  it('takes the tone while its condition holds, and loses it once it does not', () => {
    const { host, form } = mount({ available: 50, minimum: 100, status: 'late' });
    expect(field(host, 'f-available').dataset['tone']).toBe('danger');
    expect(field(host, 'f-available').classList.contains('fd-value-bold')).toBe(false);
    form.setValue('available', -5);
    expect(field(host, 'f-available').classList.contains('fd-value-bold')).toBe(true);
    form.setValue('available', 500);
    expect(field(host, 'f-available').dataset['tone']).toBeUndefined();
    expect(field(host, 'f-minimum').dataset['tone']).toBeUndefined();
  });

  it('draws a choice as a pill in its tone, never as a box to edit', () => {
    const { host, form } = mount({ status: 'late' });
    const pill = field(host, 'f-status').querySelector('.fd-value-badge') as HTMLElement;
    expect(pill.textContent).toBe('Overdue');
    expect(field(host, 'f-status').dataset['tone']).toBe('danger');
    expect(field(host, 'f-status').querySelector('select')).toBeNull();
    form.setValue('status', 'ok');
    expect(pill.textContent).toBe('On time');
    expect(field(host, 'f-status').dataset['tone']).toBe('success');
  });
});
