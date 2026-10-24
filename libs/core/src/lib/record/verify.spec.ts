import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';

/**
 * Proof that the person owns an email or a phone (`options.verify`), as the form keeps it: a send refused while a field
 * asking for a code holds a value not proved, the proof kept while the field holds the value proved and carried by
 * every send, nothing asked where the source cannot send and check codes; and the memory source's codes, as an app's
 * service would send and check them.
 */

const enquiry = (verify: unknown = { by: ['whatsapp', 'sms'] }): Page => ({
  fieldia: '0.12',
  id: 'enquiry',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' }, phone: { type: 'char', label: 'Mobile', required: true }, email: { type: 'char', label: 'Email' }, kind: { type: 'selection', label: 'Kind', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-phone', field: 'phone', widget: 'phone', options: { verify: verify as boolean } },
      { type: 'field', id: 'f-email', field: 'email', widget: 'email', options: { verify: true }, invisible: "kind != 'b'" },
      { type: 'field', id: 'f-kind', field: 'kind' },
    ],
  },
});

describe('a phone or an email proved by a code', () => {
  it('refuses a send while the value is not proved, and sends the proof once it is', async () => {
    const dataSource = createMemoryDataSource({ codes: { code: () => '482913' } });
    const form = createForm({ page: enquiry(), dataSource });
    expect(form.joined('verify')?.asks('phone')).toBe(true);
    // A hidden field asks for nothing; neither does a field with nothing in it.
    expect(form.joined('verify')?.asks('email')).toBe(false);
    form.setValues({ name: 'Mona', phone: '+201012345678' });
    expect(await form.save()).toBe(false);
    expect(form.getState().errors).toEqual({ phone: 'Mobile is not confirmed: send a code and type it in' });
    expect(dataSource.responses).toEqual([]);

    const sent = await dataSource.sendCode({ pageId: 'enquiry', model: '', recordId: null, field: 'phone', value: '+201012345678', kind: 'phone', by: 'whatsapp', language: 'en' });
    expect(sent).toMatchObject({ id: 'code-1', retryAfter: 30, length: 6 });
    expect(await dataSource.checkCode({ pageId: 'enquiry', model: '', recordId: null, field: 'phone', value: '+201012345678', code: '111111', id: 'code-1' })).toEqual({ ok: false, triesLeft: 2 });
    const right = await dataSource.checkCode({ pageId: 'enquiry', model: '', recordId: null, field: 'phone', value: '+201012345678', code: '482913', id: 'code-1' });
    expect(right).toEqual({ ok: true, proof: 'proved:code-1' });
    form.joined('verify')?.mark('phone', { value: '+201012345678', proof: right.proof });
    // Proved: what said it was not is said no more.
    expect(form.getState().errors).toEqual({});
    expect(await form.save()).toBe(true);
    expect(dataSource.responses[0].verified).toEqual({ phone: { value: '+201012345678', proof: 'proved:code-1' } });
    // Started again: a new response proves its own.
    form.reset();
    expect(form.getState().verified).toEqual({});
  });

  it('keeps a proof only while the field holds the value proved, and lets a late one for a value changed go', async () => {
    const dataSource = createMemoryDataSource();
    const form = createForm({ page: enquiry(true), dataSource });
    form.setValues({ phone: '+201012345678' });
    form.joined('verify')?.mark('phone', { value: '+201012345678', proof: 'p1' });
    form.setValues({ phone: '+201099999999' });
    expect(await form.save()).toBe(false);
    expect(form.getState().errors['phone']).toBe('Mobile is not confirmed: send a code and type it in');
    // A proof for a value the field no longer holds is let go.
    form.joined('verify')?.mark('phone', { value: '+201000000000', proof: 'late' });
    expect(form.getState().verified?.['phone']).toEqual({ value: '+201012345678', proof: 'p1' });
    // Back to the value proved: proved again, and sent with its proof.
    form.setValues({ phone: '+201012345678' });
    expect(await form.save()).toBe(true);
    expect(dataSource.responses[0].verified).toEqual({ phone: { value: '+201012345678', proof: 'p1' } });
    form.joined('verify')?.mark('phone', null);
    expect(form.getState().verified).toEqual({});
  });

  it('asks nothing where the source cannot send and check codes, and sends as before', async () => {
    const memory = createMemoryDataSource();
    const form = createForm({ page: enquiry(), dataSource: { submit: (request) => memory.submit(request) } });
    expect(form.joined('verify')?.asks('phone')).toBe(false);
    form.setValues({ phone: '+201012345678' });
    expect(await form.save()).toBe(true);
    expect(memory.responses[0]).not.toHaveProperty('verified');
  });

  it('carries the proof on a record’s save too', async () => {
    const dataSource = createMemoryDataSource();
    const page: Page = { ...enquiry(true), data: { kind: 'record', model: 'lead' } };
    const form = createForm({ page, dataSource });
    form.setValues({ phone: '+201012345678' });
    form.joined('verify')?.mark('phone', { value: '+201012345678' });
    expect(await form.save()).toBe(true);
    const saved = dataSource.calls.find((call) => call.method === 'save')?.request as { verified?: unknown };
    expect(saved.verified).toEqual({ phone: { value: '+201012345678' } });
  });

  it('sends codes as a service would: a wait before another, an end, the tries taken, a value refused', async () => {
    let now = 0;
    const dataSource = createMemoryDataSource({ codes: { code: (_request, count) => `00000${count}`, expiresIn: 60, retryAfter: 30, tries: 2, now: () => now, refuse: (request) => (request.value.endsWith('000') ? 'This number cannot get codes' : undefined) } });
    const ask = { pageId: 'p', model: '', recordId: null, field: 'phone', value: '+201012345678', kind: 'phone' as const, language: 'en' };
    await dataSource.sendCode(ask);
    await expect(dataSource.sendCode(ask)).rejects.toMatchObject({ problem: { kind: 'rule', message: 'Wait 30 seconds before asking for another code' } });
    now = 31_000;
    const second = await dataSource.sendCode(ask);
    expect(dataSource.codes.map((code) => code.code)).toEqual(['000001', '000002']);
    const check = { ...ask, code: '9', id: second.id };
    expect(await dataSource.checkCode(check)).toEqual({ ok: false, triesLeft: 1 });
    expect(await dataSource.checkCode(check)).toEqual({ ok: false, triesLeft: 0 });
    expect(await dataSource.checkCode({ ...check, code: '000002' })).toEqual({ ok: false, triesLeft: 0 });
    now = 200_000;
    const third = await dataSource.sendCode(ask);
    now = 300_000;
    expect(await dataSource.checkCode({ ...ask, code: '000003', id: third.id })).toEqual({ ok: false, expired: true });
    await expect(dataSource.sendCode({ ...ask, value: '+201012345000' })).rejects.toMatchObject({ problem: { message: 'This number cannot get codes' } });
  });

  it('refuses a code on a field that is no email or phone, and ways no one can read', () => {
    const page = enquiry({ by: ['whatsapp', 'whatsapp', 'Viber', { value: 'viber' }], how: 'x' });
    (page.layout as { children: unknown[] }).children.push({ type: 'field', id: 'f-name2', field: 'name', options: { verify: true } });
    const checked = checkPage(page);
    const issues = checked.ok ? [] : checked.issues.map((issue) => `${issue.path}: ${issue.message}`);
    expect(issues).toEqual([
      'layout.children[1].options.verify.how: verify takes "by" alone: the ways a code may be sent',
      'layout.children[1].options.verify.by[1]: "whatsapp" is named twice',
      'layout.children[1].options.verify.by[2]: a way a code is sent is a short name in small letters ("whatsapp"), or { "value": "viber", "label": "Viber" }',
      'layout.children[1].options.verify.by[3].label: the words people read for "viber": "label": "Viber"',
      'layout.children[4].options.verify: a code proves an email or a phone: "name" is shown as neither — give it "widget": "email" or "phone"',
    ]);
    expect(checkPage(enquiry()).ok).toBe(true);
  });
});
