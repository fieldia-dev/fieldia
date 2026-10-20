import { createForm, createMemoryDataSource, type Field, type FieldNode, type FileValue, type FormUser, type Page, type SignatureEvidence, type Values } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { signatureText, signedAnswers } from './signature-evidence';
import { createHash } from 'node:crypto';

/**
 * A signature that signs answers (`options.signs`): drawn or typed, it keeps who signed, when and the fingerprint of
 * the answers it signs, once what was typed in them is read; an answer still to put right is said, and nothing is
 * signed. Under it, who and when and whether the answers are still as signed, and Change answers — asked first —
 * which takes it away. While it is kept, the form locks the answers it signed.
 */

beforeEach(() => {
  jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => new Proxy({}, { get: () => () => undefined, set: () => true }) as never);
  let n = 0;
  // Each picture of the pad its own: a stroke more is a new picture.
  jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => `data:image/png;base64,${btoa(`pad${++n}`)}`);
  jest.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockImplementation(() => ({ left: 0, top: 0, width: 300, height: 90, right: 300, bottom: 90, x: 0, y: 0, toJSON: () => ({}) }));
});
afterEach(() => jest.restoreAllMocks());

const NOW = new Date('2026-10-19T08:42:00Z');
const sha = (text: string) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');
/** Every answer waited for: the reading, the fingerprint, the form's state told. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

function consent(options: { signs?: unknown; signerField?: string; user?: FormUser; values?: Values; record?: boolean } = {}) {
  const page = {
    fieldia: '0.6',
    id: 'consent',
    timeZone: 'Africa/Cairo',
    data: options.record ? { kind: 'record', model: 'clinic.consent' } : { kind: 'responses' },
    fields: {
      patient: { type: 'char', label: 'Patient', required: true },
      treatment: { type: 'selection', label: 'Treatment', required: true, options: [{ value: 'botox', label: 'Anti-wrinkle injections' }, { value: 'peel', label: 'Chemical peel' }] },
      age: { type: 'integer', label: 'Age' },
      notes: { type: 'text', label: 'Doctor’s notes' },
      signature: { type: 'binary', label: 'Signature' },
    } as Record<string, Field>,
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-patient', field: 'patient' },
        { type: 'field', id: 'f-treatment', field: 'treatment' },
        { type: 'field', id: 'f-age', field: 'age' },
        {
          type: 'field',
          id: 'f-signature',
          field: 'signature',
          widget: 'signature',
          options: { signs: options.signs ?? ['patient', 'treatment', 'age'], ...(options.signerField ? { signerField: options.signerField } : {}) },
        },
        { type: 'field', id: 'f-notes', field: 'notes' },
      ],
    },
  } as unknown as Page;
  const source = createMemoryDataSource({ records: { 'clinic.consent': { 1: { patient: 'Mona Adel', treatment: 'botox', age: 34, notes: '', signature: null } } } });
  const saved: Values[] = [];
  const save = source.save.bind(source);
  source.save = (request) => (saved.push(request.values), save(request));
  const form = createForm({ page, now: () => NOW, ...(options.user ? { user: options.user } : {}), ...(options.record ? { dataSource: source, recordId: 1 } : { values: options.values ?? { patient: 'Mona Adel', treatment: 'botox', age: 34 } }) });
  const node = (page.layout as { children: FieldNode[] }).children[3];
  const widget = createWidget({ form, name: 'signature', field: page.fields['signature'], node, id: 'fd-signature', document, labels: WIDGET_LABELS.en, locale: 'en' });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['signature'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const el = widget.element;
  const pad = el.querySelector('canvas') as HTMLCanvasElement;
  const draw = () => {
    for (const [type, x] of [['pointerdown', 10], ['pointermove', 120], ['pointerup', 120]] as const) pad.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: 40, button: 0, bubbles: true, cancelable: true }));
  };
  const value = () => form.getState().values['signature'] as FileValue | null;
  const text = (selector: string) => (el.querySelector(selector) as HTMLElement | null)?.textContent ?? '';
  const shown = (selector: string) => !(el.querySelector(selector) as HTMLElement | null)?.hidden;
  const button = (words: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === words && !b.hidden) as HTMLButtonElement | undefined;
  return { form, page, el, draw, value, text, shown, button, saved, widget };
}

describe('a signature that signs answers', () => {
  it('keeps who signed, when, which answers and their fingerprint, and says so under it', async () => {
    const { form, page, draw, value, text, shown } = consent({ signerField: 'patient' });
    draw();
    await settle();
    const signed = value()?.signed as SignatureEvidence;
    expect(signed).toEqual({ format: 'fieldia-signature/1', by: 'Mona Adel', at: '2026-10-19T08:42:00.000Z', fields: ['patient', 'treatment', 'age'], sha256: expect.any(String) });
    // The fingerprint of the documented text, as the app writes it again from what it keeps.
    const again = signatureText({ page: 'consent', field: 'signature', by: 'Mona Adel', at: signed.at, answers: signedAnswers(page, form.getState().values, signed.fields) });
    expect(again).toBe('{"answers":{"age":34,"patient":"Mona Adel","treatment":"botox"},"at":"2026-10-19T08:42:00.000Z","by":"Mona Adel","field":"signature","format":"fieldia-signature/1","page":"consent"}');
    expect(signed.sha256).toBe(sha(again));
    // Who and when on the page's clock (Cairo's summer time, its name said where it is not the computer's), and that the
    // answers are as signed.
    expect(text('.fd-signature-who')).toMatch(/^Signed by Mona Adel, 19 Oct 2026, 11:42( EEST)?$/);
    await settle();
    expect(shown('.fd-signature-state')).toBe(true);
    expect(text('.fd-signature-state')).toBe('✓The answers are as they were signed.');
  });

  it('locks the answers it signed while it is kept; an answer it does not sign stays open', async () => {
    const { form, draw } = consent();
    expect(form.node('f-treatment').readonly).toBe(false);
    draw();
    await settle();
    for (const id of ['f-patient', 'f-treatment', 'f-age']) expect(form.node(id).readonly).toBe(true);
    expect(form.fieldReadonly('treatment')).toBe(true);
    expect(form.node('f-notes').readonly).toBe(false);
    expect(form.node('f-signature').readonly).toBe(false);
  });

  it('names the signer by the name typed, else the person using the form, else no one', async () => {
    const typedIn = consent({ user: { id: 3, name: 'Sara (reception)' } });
    const box = typedIn.el.querySelector('input.fd-signature-typed') as HTMLInputElement;
    box.value = 'Mona A.';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(typedIn.value()?.signed?.by).toBe('Mona A.');
    expect(typedIn.value()?.text).toBe('Mona A.');

    const drawnBy = consent({ user: { id: 3, name: 'Sara (reception)' } });
    drawnBy.draw();
    await settle();
    expect(drawnBy.value()?.signed?.by).toBe('Sara (reception)');

    const nobody = consent();
    nobody.draw();
    await settle();
    expect(nobody.value()?.signed && 'by' in nobody.value()!.signed!).toBe(false);
    expect(nobody.text('.fd-signature-who')).toMatch(/^Signed 19 Oct 2026, 11:42( EEST)?$/);
  });

  it('signs nothing while an answer it signs is still to give or does not read: it says which, and keeps the strokes', async () => {
    const { form, draw, value, text, shown, button } = consent({ values: { patient: 'Mona Adel', treatment: null, age: 34 } });
    form.setUnread('age', { text: '3x', message: 'Age is a whole number' });
    draw();
    await settle();
    expect(value()).toBeNull();
    expect(text('.fd-signature-note')).toBe('Not signed yet: first put right Treatment and Age, then sign again.');
    // What was drawn stays on the pad, to clear or to add to once the answers are right.
    expect(shown('.fd-signature-pad')).toBe(true);
    expect(button('Clear')).toBeDefined();
    expect(form.node('f-treatment').readonly).toBe(false);
    // Put right, a stroke more signs.
    form.setValue('treatment', 'peel');
    form.setUnread('age', null);
    draw();
    await settle();
    expect(value()?.signed?.fields).toEqual(['patient', 'treatment', 'age']);
    expect(shown('.fd-signature-note')).toBe(false);
  });

  it('says what is left to put right as the answers change, then signs the drawing kept with Sign now: no second drawing', async () => {
    // The owner's walk of 0.27: signed first, then every answer filled in — the note still named them all, and the
    // drawing kept on the pad counted for nothing.
    const { form, draw, value, text, shown, button } = consent({ values: { patient: '', treatment: null, age: 34 } });
    draw();
    await settle();
    expect(text('.fd-signature-note')).toBe('Not signed yet: first put right Patient and Treatment, then sign again.');
    expect(button('Sign now')).toBeUndefined();
    form.setValue('patient', 'Mona Adel');
    await settle();
    // One left: the note names it alone.
    expect(text('.fd-signature-note')).toBe('Not signed yet: first put right Treatment, then sign again.');
    expect(button('Sign now')).toBeUndefined();
    form.setValue('treatment', 'peel');
    await settle();
    // Nothing left: the note says so, and the drawing still on the pad is signed by a press — the person's own act.
    expect(text('.fd-signature-note')).toBe('Your answers are ready to sign.');
    expect(value()).toBeNull();
    expect(form.node('f-treatment').readonly).toBe(false);
    button('Sign now')?.click();
    await settle();
    expect(value()?.signed?.fields).toEqual(['patient', 'treatment', 'age']);
    expect(shown('.fd-signature-note')).toBe(false);
    expect(button('Sign now')).toBeUndefined();
    expect(form.node('f-treatment').readonly).toBe(true);
  });

  it('says nothing more of a drawing cleared after it was refused', async () => {
    const { form, draw, text, shown, button } = consent({ values: { patient: 'Mona Adel', treatment: null, age: 34 } });
    draw();
    await settle();
    expect(text('.fd-signature-note')).toBe('Not signed yet: first put right Treatment, then sign again.');
    button('Clear')?.click();
    form.setValue('treatment', 'peel');
    await settle();
    expect(shown('.fd-signature-note')).toBe(false);
    expect(button('Sign now')).toBeUndefined();
  });

  it('reads what is typed in a signed answer before it signs: the answer as the person saw it', async () => {
    const { form, draw, value } = consent();
    // A box of the page that reads its text when the form settles, as the viewer's does for the box with the focus.
    form.settling(() => form.setValue('age', 35));
    draw();
    await settle();
    expect(value()?.signed?.sha256).toBe(sha(signatureText({ page: 'consent', field: 'signature', at: '2026-10-19T08:42:00.000Z', answers: { patient: 'Mona Adel', treatment: 'botox', age: 35 } })));
  });

  it('takes the signature away by Change answers, asked first: Keep keeps it, Escape too', async () => {
    const { form, draw, value, text, shown, button, el } = consent();
    draw();
    await settle();
    expect(button('Clear')).toBeUndefined();
    button('Change answers')!.click();
    expect(text('.fd-signature-ask span')).toBe('Change your answers? The signature is taken away, and you sign again once they are right.');
    expect(document.activeElement?.textContent).toBe('Keep');
    button('Keep')!.click();
    expect(shown('.fd-signature-ask')).toBe(false);
    expect(document.activeElement?.textContent).toBe('Change answers');
    button('Change answers')!.click();
    el.querySelector('.fd-signature-ask')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(shown('.fd-signature-ask')).toBe(false);
    expect(value()?.signed).toBeDefined();
    button('Change answers')!.click();
    ([...el.querySelectorAll('.fd-signature-ask button')].find((b) => b.textContent === 'Change answers') as HTMLButtonElement).click();
    expect(value()).toBeNull();
    expect(form.node('f-treatment').readonly).toBe(false);
    expect(text('.fd-signature-note')).toBe('Signature taken away: change your answers, then sign again.');
    expect(shown('.fd-signature-evidence')).toBe(false);
    expect(document.activeElement).toBe(el.querySelector('input.fd-signature-typed'));
  });

  it('says when an answer changed after it was signed: by a step, the app or the store', async () => {
    const { form, draw, text } = consent();
    draw();
    await settle();
    await settle();
    expect(text('.fd-signature-state')).toBe('✓The answers are as they were signed.');
    form.setValue('treatment', 'peel', { by: 'app' });
    await settle();
    expect(text('.fd-signature-state')).toBe('⚠An answer has changed since it was signed.');
    form.setValue('treatment', 'botox', { by: 'app' });
    await settle();
    expect(text('.fd-signature-state')).toBe('✓The answers are as they were signed.');
  });

  it('is waited for by a save made at once: the record is saved with its evidence', async () => {
    const { form, draw, saved } = consent({ record: true });
    await form.load();
    draw();
    expect(await form.save()).toBe(true);
    expect((saved[0]['signature'] as FileValue).signed?.fields).toEqual(['patient', 'treatment', 'age']);
  });

  it('lays nothing on a form the person’s Discard emptied while it signed', async () => {
    const { form, draw, value } = consent();
    draw();
    form.reset();
    await settle();
    expect(value()).toBeNull();
  });

  it('keeps the answers signed while it is signed again, a stroke more: never unlocked between', async () => {
    const { form, draw, value } = consent();
    draw();
    await settle();
    const first = value()?.signed;
    const locks: boolean[] = [];
    form.subscribe(() => locks.push(form.node('f-patient').readonly));
    draw();
    await settle();
    expect(locks.every(Boolean)).toBe(true);
    expect(value()?.signed).not.toBe(first);
  });
});

describe('a signature that signs nothing', () => {
  it('keeps its picture as before: no evidence, nothing locked', () => {
    const { form, draw, value, el } = consent({ signs: [] });
    draw();
    expect(value()).toEqual({ name: 'signature.png', type: 'image/png', size: 4, data: btoa('pad1') });
    expect(form.node('f-patient').readonly).toBe(false);
    // Its evidence's part is never asked for: no line under it.
    expect(el.querySelector('.fd-signature-evidence')).toBeNull();
  });
});
