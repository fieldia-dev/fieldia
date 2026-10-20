import type { Page, SignatureEvidence } from '@fieldia/core';
import { mountViewer, type ViewerHandle, type ViewerOptions } from './viewer';

/**
 * An answer a signature signed (`options.signs`) is locked while the signature is kept: its lock says how to change it
 * — by taking the signature away, Change answers under it — where the record's source does not lock it for this person
 * anyway. A page with no signature says nothing new.
 */

let handle: ViewerHandle | null = null;
// jsdom draws nothing: the signature's pad has no pen.
beforeEach(() => jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => null));
afterEach(() => {
  jest.restoreAllMocks();
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const SIGNED: SignatureEvidence = { format: 'fieldia-signature/1', by: 'Mona Adel', at: '2026-10-19T08:42:00.000Z', fields: ['patient', 'treatment', 'total'], sha256: 'ab'.repeat(32) };

const consent: Page = {
  fieldia: '0.5',
  id: 'consent',
  data: { kind: 'responses' },
  fields: {
    patient: { type: 'char', label: 'Patient' },
    treatment: { type: 'char', label: 'Treatment', readonly: false },
    sessions: { type: 'integer', label: 'Sessions' },
    total: { type: 'integer', label: 'Total', compute: 'sessions * 2' },
    notes: { type: 'text', label: 'Notes' },
    signature: { type: 'binary', label: 'Signature' },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-patient', field: 'patient' },
      { type: 'field', id: 'f-treatment', field: 'treatment', readonly: "patient == 'nobody'", readonlyReason: 'Set by the doctor' },
      { type: 'field', id: 'f-total', field: 'total' },
      { type: 'field', id: 'f-notes', field: 'notes', readonly: "patient == 'Mona Adel'", readonlyReason: 'Kept by the clinic' },
      { type: 'field', id: 'f-signature', field: 'signature', widget: 'signature', options: { signs: ['patient', 'treatment', 'total'] } },
    ],
  },
} as Page;

function mount(options: Partial<ViewerOptions> = {}) {
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountViewer(host, { page: consent, values: { patient: 'Mona Adel', treatment: 'Peel', sessions: 2 }, ...options });
  const field = (id: string) => host.querySelector(`[data-node="${id}"]`) as HTMLElement;
  const lock = (id: string) => field(id).querySelector('.fd-lock-wrap') as HTMLElement | null;
  const why = (id: string) => (lock(id) && !lock(id)?.hidden ? lock(id)?.querySelector('[role="tooltip"]')?.textContent : null);
  return { host, form: handle.form, field, why };
}

describe('an answer a signature signed', () => {
  it('is locked while the signature is kept, its lock saying how to change it; taken away, it opens', () => {
    const { form, field, why } = mount();
    expect(why('f-patient')).toBeNull();
    form.setValue('signature', { name: 'signature.png', type: 'image/png', size: 4, data: 'QUJDRA==', signed: SIGNED });
    const input = field('f-patient').querySelector('input') as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    expect(why('f-patient')).toBe('Signed. To change it, press Change answers under the signature.');
    // Signed, its own rule's reason gives way: the signature is what locks it now.
    expect(why('f-treatment')).toBe('Signed. To change it, press Change answers under the signature.');
    // A value worked out from others says nothing of it; an answer not signed keeps its own reason.
    expect(why('f-total')).toBeNull();
    expect(why('f-notes')).toBe('Kept by the clinic');
    form.setValue('signature', null);
    expect(input.readOnly).toBe(false);
    expect(why('f-patient')).toBeNull();
  });

  it('says the source’s reason where the source locks it for this person anyway', async () => {
    const page = { ...consent, data: { kind: 'record', model: 'consent' } } as Page;
    const { why } = mount({
      page,
      recordId: 1,
      values: undefined,
      dataSource: {
        load: async () => ({
          $loaded: true,
          values: { patient: 'Mona Adel', treatment: 'Peel', sessions: 2, signature: { name: 'signature.png', type: 'image/png', size: 4, url: 'https://files/1', signed: SIGNED } },
          can: { readonlyFields: ['patient'], reason: 'Only the doctor changes it.' },
        }),
      },
    });
    await handle?.form.settled();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(why('f-patient')).toBe('Only the doctor changes it.');
    expect(why('f-treatment')).toBe('Signed. To change it, press Change answers under the signature.');
  });
});
