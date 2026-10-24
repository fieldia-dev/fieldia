import { createMemoryDataSource, type DataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from './viewer';

/**
 * Proof of a phone by a code, as the viewer draws it (the verify part): Send a code by each way the page offers once
 * the number reads, the code's box focused with how long it works, a wrong code's tries left, Confirmed once right — the
 * proof kept on the form — and nothing of it where the source cannot send and check codes.
 */

const enquiry: Page = {
  fieldia: '0.12',
  id: 'enquiry',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, phone: { type: 'char', label: 'Mobile' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-phone', field: 'phone', widget: 'phone', options: { verify: { by: ['whatsapp', 'sms'] } } },
    ],
  },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const settled = () => new Promise((done) => setTimeout(done, 0));

function mount(dataSource: DataSource) {
  const host = document.body.appendChild(document.createElement('div'));
  handle = mountViewer(host, { page: enquiry, dataSource });
  const field = host.querySelector('[data-node="f-phone"]') as HTMLElement;
  return { host, field, form: handle.form };
}

describe('a phone proved by a code', () => {
  it('sends a code by the way picked, takes a wrong one with its tries left, and confirms the right one', async () => {
    const dataSource = createMemoryDataSource({ codes: { code: () => '482913' } });
    const { field, form } = mount(dataSource);
    const box = field.querySelector('.fd-verify') as HTMLElement;
    // Nothing to prove yet.
    expect(box.hidden).toBe(true);
    form.setValue('phone', '+201012345678');
    expect(box.hidden).toBe(false);
    const sends = [...field.querySelectorAll<HTMLButtonElement>('.fd-verify-send')];
    expect(sends.map((button) => button.textContent)).toEqual(['Send a code by WhatsApp', 'Send a code by SMS']);
    sends[0].click();
    await settled();
    expect(dataSource.calls.find((call) => call.method === 'sendCode')?.request).toMatchObject({ field: 'phone', value: '+201012345678', kind: 'phone', by: 'whatsapp', language: 'en' });
    const code = field.querySelector('.fd-verify-code') as HTMLInputElement;
    expect(document.activeElement).toBe(code);
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code.getAttribute('aria-label')).toBe('Code sent to +201012345678');
    expect(field.querySelector('.fd-verify-said')?.textContent).toBe('We sent a code to +201012345678 by WhatsApp. It works for 10 minutes.');
    expect((field.querySelector('.fd-verify-row:not(.fd-verify-code-row)') as HTMLElement).hidden).toBe(true);
    expect(field.querySelector('.fd-verify-wait')?.textContent).toMatch(/^Send again in 0:(30|29)$/);
    // A whole code typed is checked at once; Arabic digits read as theirs.
    code.value = '111111';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    await settled();
    expect(field.querySelector('.fd-verify-said')?.textContent).toBe('That code is not right: 2 tries left.');
    code.value = '٤٨٢٩١٣';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    await settled();
    expect(form.getState().verified).toEqual({ phone: { value: '+201012345678', proof: 'proved:code-1' } });
    expect((field.querySelector('.fd-verify-done') as HTMLElement).hidden).toBe(false);
    expect(field.querySelector('.fd-verify-done')?.textContent).toBe('Confirmed');
    expect((field.querySelector('.fd-verify-code-row') as HTMLElement).hidden).toBe(true);
    // Another number: asked again.
    form.setValue('phone', '+201099999999');
    expect((field.querySelector('.fd-verify-done') as HTMLElement).hidden).toBe(true);
    expect((field.querySelector('.fd-verify-row') as HTMLElement).hidden).toBe(false);
  });

  it('confirms with Enter in the code’s box without sending the form, and says a refused send in the app’s words', async () => {
    const dataSource = createMemoryDataSource({ codes: { code: () => '123456', refuse: (request) => (request.by === 'sms' ? 'SMS is not offered in your country' : undefined) } });
    const { field, form } = mount(dataSource);
    form.setValue('phone', '+201012345678');
    (field.querySelectorAll('.fd-verify-send')[1] as HTMLButtonElement).click();
    await settled();
    expect(field.querySelector('.fd-verify-said')?.textContent).toBe('SMS is not offered in your country');
    expect(field.querySelector('.fd-verify-said')?.classList.contains('fd-verify-error')).toBe(true);
    (field.querySelectorAll('.fd-verify-send')[0] as HTMLButtonElement).click();
    await settled();
    const code = field.querySelector('.fd-verify-code') as HTMLInputElement;
    code.value = '12345';
    const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    code.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true);
    await settled();
    expect(field.querySelector('.fd-verify-said')?.textContent).toBe('That code is not right: 2 tries left.');
    expect(dataSource.responses).toEqual([]);
  });

  it('draws nothing where the source cannot send and check codes', () => {
    const { field } = mount({ submit: async () => ({}) });
    expect(field.querySelector('.fd-verify')).toBeNull();
  });
});
