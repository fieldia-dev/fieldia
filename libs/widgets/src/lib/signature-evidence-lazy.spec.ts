import { createForm, createMemoryDataSource, type Field, type FieldNode, type FileValue, type Page } from '@fieldia/core';
import { WIDGET_LABELS } from './labels';
import { evidencePart, filesPart } from './widget-parts';
import { createWidget } from './widgets';

/**
 * A signature's evidence comes in a part of its own (evidence-part.ts: the canonical form, the fingerprint, who and
 * when said under the signature, Change answers), asked for only by a signature that signs answers
 * (`options.signs`): a page with uploads, or a plain signature, never asks for it. Before it has come, the signature
 * still draws and keeps its picture; its signing waits for the part, and a save waits for that signing as for one on
 * its way. This file starts with no part loaded (src/test-parts.ts leaves it so); the files part is brought in, the
 * evidence part left to the signature that asks for it. Its tests run in order.
 */

beforeAll(async () => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new Proxy({}, { get: () => () => undefined, set: () => true }) as never);
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => 'data:image/png;base64,QUJDRA==');
  jest.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, width: 300, height: 90, right: 300, bottom: 90, x: 0, y: 0, toJSON: () => ({}) }));
  await filesPart.load();
});
afterAll(() => jest.restoreAllMocks());
afterEach(() => document.body.replaceChildren());

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

function consent(options: Record<string, unknown>, record = false) {
  const page = {
    fieldia: '0.5',
    id: 'consent',
    data: record ? { kind: 'record', model: 'consent' } : { kind: 'responses' },
    fields: { patient: { type: 'char', label: 'Patient' }, docs: { type: 'binary', label: 'Documents' }, signature: { type: 'binary', label: 'Signature' } } as Record<string, Field>,
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-patient', field: 'patient' },
        { type: 'field', id: 'f-docs', field: 'docs' },
        { type: 'field', id: 'f-signature', field: 'signature', widget: 'signature', options },
      ],
    },
  } as unknown as Page;
  const saved: FileValue[] = [];
  const dataSource = createMemoryDataSource({ records: { consent: { 1: { patient: 'Mona Adel', docs: null, signature: null } } } });
  const save = dataSource.save.bind(dataSource);
  dataSource.save = (request) => (saved.push(request.values['signature'] as FileValue), save(request));
  const form = createForm({ page, ...(record ? { dataSource, recordId: 1 } : { values: { patient: 'Mona Adel' } }) });
  const draw = (name: string) => {
    const node = (page.layout as { children: FieldNode[] }).children.find((one) => one.field === name) as FieldNode;
    const widget = createWidget({ form, name, field: page.fields[name], node, id: `fd-${name}`, document, labels: WIDGET_LABELS.en, locale: 'en' });
    document.body.append(widget.element);
    const refresh = () => widget.update({ value: form.getState().values[name], values: form.getState().values, readonly: false, required: false, invalid: false });
    form.subscribe(refresh);
    refresh();
    return widget.element;
  };
  const sign = (element: HTMLElement) => {
    const pad = element.querySelector('canvas') as HTMLCanvasElement;
    for (const [type, x] of [['pointerdown', 10], ['pointermove', 120], ['pointerup', 120]] as const) pad.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 40, button: 0, bubbles: true, cancelable: true }));
  };
  return { form, draw, sign, saved, value: () => form.getState().values['signature'] as FileValue | null };
}

describe('the evidence part', () => {
  it('is never asked for by a page with uploads, or a plain signature: the picture is kept as before', async () => {
    const { draw, sign, value } = consent({ penWidth: 5 });
    draw('docs');
    const signature = draw('signature');
    sign(signature);
    expect(value()).toEqual({ name: 'signature.png', type: 'image/png', size: 4, data: 'QUJDRA==' });
    for (let turn = 0; turn < 5; turn++) await tick();
    expect(evidencePart.loaded).toBeUndefined();
    expect(value()?.signed).toBeUndefined();
    expect(signature.querySelector('.fd-signature-evidence')).toBeNull();
  });

  it('is asked for by a signature that signs answers: before it comes the picture is kept, the signing waits, and a save waits for the signing', async () => {
    const { form, draw, sign, value, saved } = consent({ signs: ['patient'], signerField: 'patient' }, true);
    await form.load();
    const signature = draw('signature');
    expect(evidencePart.loaded).toBeUndefined();
    sign(signature);
    // The picture at once, its evidence once the part has come.
    expect(value()).toEqual({ name: 'signature.png', type: 'image/png', size: 4, data: 'QUJDRA==' });
    expect(await form.save()).toBe(true);
    expect(evidencePart.loaded).toBeDefined();
    expect(saved[0]?.signed).toEqual({ format: 'fieldia-signature/1', by: 'Mona Adel', at: expect.any(String), fields: ['patient'], sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    // Its evidence under it, from the part, and its sheet in.
    expect(signature.querySelector('.fd-signature-who')?.textContent).toMatch(/^Signed by Mona Adel, /);
    expect(document.getElementById('fieldia-evidence-styles')).not.toBeNull();
    expect(form.node('f-patient').readonly).toBe(true);
  });

  it('that cannot come never keeps the picture unsigned in silence: said, with Try again; a save refuses it until signed', async () => {
    // Parts that come by a script tag of their own (the one-tag script): asked for again, they can come.
    const again = jest.spyOn(evidencePart, 'asksAgain', 'get').mockReturnValue(true);
    const asked = jest.spyOn(evidencePart, 'load').mockRejectedValueOnce(new Error('offline'));
    const { form, draw, sign, value, saved } = consent({ signs: ['patient'], signerField: 'patient' }, true);
    await form.load();
    const signature = draw('signature');
    sign(signature);
    await form.settle();
    await tick();
    const note = signature.querySelector('.fd-signature-unloaded') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.getAttribute('role')).toBe('alert');
    expect(note.textContent).toBe('Not signed yet: the signing could not load. Try again');
    // The picture kept, on the pad and in the field — unsigned, and said so to every save.
    expect(value()).toEqual({ name: 'signature.png', type: 'image/png', size: 4, data: 'QUJDRA==' });
    expect((signature.querySelector('canvas') as HTMLCanvasElement).hidden).toBe(false);
    expect(await form.save()).toBe(false);
    expect(saved).toEqual([]);
    expect(form.getState().errors['signature']).toBe('Not signed yet: the signing could not load.');
    expect(form.validate()).toBe(false);
    // Try again asks for the part once more: signed, the save goes.
    (note.querySelector('button') as HTMLButtonElement).click();
    expect(note.hidden).toBe(true);
    for (let turn = 0; turn < 5; turn++) await tick();
    await form.settle();
    expect(asked).toHaveBeenCalledTimes(2);
    expect(value()?.signed?.fields).toEqual(['patient']);
    expect(form.getState().unread['signature']).toBeUndefined();
    expect(note.hidden).toBe(true);
    expect(await form.save()).toBe(true);
    expect(saved[0]?.signed?.by).toBe('Mona Adel');
    asked.mockRestore();
    again.mockRestore();
  });

  it('that cannot come where asking again cannot bring it (an app’s modules): a reload said, no Try again, a save refused', async () => {
    expect(evidencePart.asksAgain).toBe(false);
    const asked = jest.spyOn(evidencePart, 'load').mockRejectedValue(new Error('offline'));
    const { form, draw, sign, value, saved } = consent({ signs: ['patient'], signerField: 'patient' }, true);
    await form.load();
    const signature = draw('signature');
    sign(signature);
    await form.settle();
    await tick();
    const note = signature.querySelector('.fd-signature-unloaded') as HTMLElement;
    expect(note.hidden).toBe(false);
    expect(note.textContent).toBe('Not signed yet: the signing could not load. Reload the page to sign.');
    expect(note.querySelector('button')).toBeNull();
    expect(value()?.signed).toBeUndefined();
    expect(await form.save()).toBe(false);
    expect(saved).toEqual([]);
    expect(form.getState().errors['signature']).toBe('Not signed yet: the signing could not load. Reload the page to sign.');
    asked.mockRestore();
  });

  it('that cannot come lets a picture taken away go with its refusal: Clear leaves nothing to refuse', async () => {
    const asked = jest.spyOn(evidencePart, 'load').mockRejectedValue(new Error('offline'));
    const { form, draw, sign } = consent({ signs: ['patient'] });
    const signature = draw('signature');
    sign(signature);
    await form.settle();
    await tick();
    expect(form.getState().unread['signature']?.message).toBe('Not signed yet: the signing could not load. Reload the page to sign.');
    (signature.querySelector('.fd-signature-clear') as HTMLButtonElement).click();
    expect(form.getState().unread['signature']).toBeUndefined();
    expect((signature.querySelector('.fd-signature-unloaded') as HTMLElement).hidden).toBe(true);
    asked.mockRestore();
  });
});
