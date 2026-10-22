import { createHash } from 'node:crypto';
import type { Field, Line, Page, Values } from '@fieldia/core';
import { answersMatch, answersToSign, canonicalJson, sha256Hex, signAnswers, signatureFields, signatureText, signedAnswer, signedAnswers, SIGNATURE_FORMAT } from './signature-evidence';

/**
 * A signature's evidence: the answers it signs written in one canonical form, the form documented so an app can write
 * it again from what it keeps, and its SHA-256 — the browser's own where it has one, else worked out to the same result.
 */

const sha = (text: string) => createHash('sha256').update(Buffer.from(text, 'utf8')).digest('hex');

const page = {
  fieldia: '0.10',
  id: 'consent',
  data: { kind: 'record', model: 'clinic.consent' },
  fields: {
    patient: { type: 'char', label: 'Patient' },
    treatment: { type: 'selection', label: 'Treatment', options: [{ value: 'botox', label: 'Anti-wrinkle injections' }] },
    areas: { type: 'selection', label: 'Areas', multiple: true, options: [{ value: 'forehead', label: 'Forehead' }] },
    pregnant: { type: 'boolean', label: 'Pregnant' },
    dose: { type: 'float', label: 'Dose' },
    doctor: { type: 'many2one', label: 'Doctor', relation: 'res.users' },
    seen: { type: 'datetime', label: 'Seen' },
    lines: { type: 'one2many', label: 'Products', relation: 'line', fields: { product: { type: 'many2one', label: 'Product', relation: 'product' }, qty: { type: 'integer', label: 'Qty' } } },
    id_card: { type: 'binary', label: 'ID card' },
    notes: { type: 'text', label: 'Notes' },
    signature: { type: 'binary', label: 'Signature' },
    witness: { type: 'binary', label: 'Witness' },
  } as Record<string, Field>,
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-patient', field: 'patient' },
      { type: 'section', id: 's', children: [{ type: 'field', id: 'f-sign', field: 'signature', widget: 'signature', options: { signs: 'form' } }] },
      { type: 'field', id: 'f-witness', field: 'witness', widget: 'signature' },
    ],
  },
} as unknown as Page;

describe('the canonical form', () => {
  it('writes JSON as RFC 8785 does: no spaces, keys in the order of their code units, numbers as JavaScript writes them', () => {
    expect(canonicalJson({ b: 1, a: [true, null, 'x'], A: { z: 0.1, y: 12.0, x: -0 }, é: 'é', aa: undefined })).toBe('{"A":{"x":0,"y":12,"z":0.1},"a":[true,null,"x"],"b":1,"é":"é"}');
    expect(canonicalJson('line\n"quoted"')).toBe('"line\\n\\"quoted\\""');
  });

  it('reads each answer as the person saw it, the same however a store hands it back', () => {
    const f = page.fields;
    expect(signedAnswer(f['patient'], '')).toBeNull();
    expect(signedAnswer(f['patient'], '   ')).toBeNull();
    expect(signedAnswer(f['patient'], 'Mona Adel')).toBe('Mona Adel');
    expect(signedAnswer(f['areas'], [])).toBeNull();
    expect(signedAnswer(f['areas'], ['forehead'])).toEqual(['forehead']);
    expect(signedAnswer(f['pregnant'], false)).toBe(false);
    expect(signedAnswer(f['dose'], 0)).toBe(0);
    // A link is its record's id, whatever name or picture it came with.
    expect(signedAnswer(f['doctor'], { id: 7, label: 'Dr. Sara', avatar: 'x.png' })).toBe(7);
    expect(signedAnswer(undefined, { model: 'res.partner', id: 3, label: 'Nile' })).toEqual({ id: 3, model: 'res.partner' });
    // A file is its name, size and kind: never its bytes or where it is stored, which a save changes.
    expect(signedAnswer(f['id_card'], { name: 'id.png', type: 'image/png', size: 4, data: 'QUJDRA==' })).toEqual({ name: 'id.png', size: 4, type: 'image/png' });
    expect(signedAnswer(f['id_card'], { name: 'id.png', type: 'image/png', size: 4, url: 'https://files/1', fileId: 9 })).toEqual({ name: 'id.png', size: 4, type: 'image/png' });
    // An instant with its zone is the same instant however it is written; one without, its text.
    expect(signedAnswer(f['seen'], '2026-10-19T10:42:00+02:00')).toBe('2026-10-19T08:42:00.000Z');
    expect(signedAnswer(f['seen'], '2026-10-19T08:42:00Z')).toBe('2026-10-19T08:42:00.000Z');
    expect(signedAnswer(f['seen'], '2026-10-19T10:42')).toBe('2026-10-19T10:42');
    // Lines: each line's own fields, never its key or its id, which a save gives it.
    const lines: Line[] = [
      { key: 'k1', values: { product: { id: 5, label: 'Filler' }, qty: 2, extra: 'not the page’s' } },
      { key: 'k2', id: 40, values: { product: null, qty: null } },
    ];
    expect(signedAnswer(f['lines'], lines)).toEqual([
      { product: 5, qty: 2 },
      { product: null, qty: null },
    ]);
  });

  it('writes the text hashed in one documented order: answers, at, by, field, format, page', () => {
    const text = signatureText({ page: 'consent', field: 'signature', by: 'Mona Adel', at: '2026-10-19T08:42:00.000Z', answers: { treatment: 'botox', patient: 'Mona Adel', areas: ['forehead'], pregnant: false } });
    expect(text).toBe(
      '{"answers":{"areas":["forehead"],"patient":"Mona Adel","pregnant":false,"treatment":"botox"},"at":"2026-10-19T08:42:00.000Z","by":"Mona Adel","field":"signature","format":"fieldia-signature/1","page":"consent"}'
    );
    // No one named: no "by".
    expect(signatureText({ page: 'consent', field: 'signature', at: '2026-10-19T08:42:00.000Z', answers: {} })).toBe('{"answers":{},"at":"2026-10-19T08:42:00.000Z","field":"signature","format":"fieldia-signature/1","page":"consent"}');
    expect(SIGNATURE_FORMAT).toBe('fieldia-signature/1');
  });
});

describe('the fingerprint', () => {
  const texts = ['', 'abc', 'x'.repeat(55), 'x'.repeat(56), 'x'.repeat(64), 'y'.repeat(1000), 'منى عادل — موافقة', 'emoji 🙂 and a lone \ud800 half'];

  it('is SHA-256 of the text’s UTF-8, in small hexadecimal letters', async () => {
    expect(await sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    for (const text of texts) expect(await sha256Hex(text)).toBe(sha(text));
  });

  it('is the same where the browser keeps SubtleCrypto from the page (served without https): worked out here', async () => {
    const crypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true });
    try {
      for (const text of texts) expect(await sha256Hex(text)).toBe(sha(text));
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true });
    }
  });

  it('uses the browser’s own where it has one', async () => {
    const digest = jest.fn(async () => new Uint8Array(32).fill(171).buffer);
    const crypto = globalThis.crypto;
    Object.defineProperty(globalThis, 'crypto', { value: { subtle: { digest } }, configurable: true });
    try {
      expect(await sha256Hex('abc')).toBe('ab'.repeat(32));
      expect(digest).toHaveBeenCalledWith('SHA-256', expect.any(Uint8Array));
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: crypto, configurable: true });
    }
  });
});

describe('signing answers', () => {
  const values: Values = { patient: 'Mona Adel', treatment: 'botox', areas: ['forehead'], pregnant: false, dose: 1.5, doctor: { id: 7, label: 'Dr. Sara' }, notes: '' };
  const fields = ['patient', 'treatment', 'areas', 'pregnant', 'dose', 'doctor', 'notes'];

  it('keeps who, when, which answers, and the fingerprint an app works out again from the documented text', async () => {
    const signed = await signAnswers({ page, field: 'signature', values, fields, by: '  Mona Adel ', at: new Date('2026-10-19T08:42:00Z') });
    expect(signed).toEqual({ format: 'fieldia-signature/1', by: 'Mona Adel', at: '2026-10-19T08:42:00.000Z', fields, sha256: expect.stringMatching(/^[0-9a-f]{64}$/) });
    // What an app writes again, from the record it keeps.
    const text = signatureText({ page: 'consent', field: 'signature', by: 'Mona Adel', at: '2026-10-19T08:42:00.000Z', answers: signedAnswers(page, values, fields) });
    expect(text).toBe(
      '{"answers":{"areas":["forehead"],"doctor":7,"dose":1.5,"notes":null,"patient":"Mona Adel","pregnant":false,"treatment":"botox"},"at":"2026-10-19T08:42:00.000Z","by":"Mona Adel","field":"signature","format":"fieldia-signature/1","page":"consent"}'
    );
    expect(signed.sha256).toBe(sha(text));
  });

  it('says whether the answers are still as signed: a store’s way of writing them is no change, a changed answer is', async () => {
    const signed = await signAnswers({ page, field: 'signature', values, fields, at: '2026-10-19T08:42:00.000Z' });
    expect(await answersMatch(signed, page, 'signature', values)).toBe(true);
    // As a store hands it back: an empty text as null, the link with more about it, a field nobody signed changed.
    expect(await answersMatch(signed, page, 'signature', { ...values, notes: null, doctor: { id: 7, label: 'Dr. Sara Hany', avatar: 'a.png' }, seen: '2026-10-20T09:00:00Z' })).toBe(true);
    expect(await answersMatch(signed, page, 'signature', { ...values, areas: ['forehead', 'lips'] })).toBe(false);
    expect(await answersMatch(signed, page, 'signature', { ...values, dose: 2 })).toBe(false);
    // Who and when are signed too.
    expect(await answersMatch({ ...signed, at: '2026-10-19T08:43:00.000Z' }, page, 'signature', values)).toBe(false);
    // A form this Fieldia does not write is never said to match.
    expect(await answersMatch({ ...signed, format: 'fieldia-signature/2' }, page, 'signature', values)).toBe(false);
  });
});

describe('the answers a signature signs', () => {
  const shown = ['patient', 'treatment', 'areas', 'signature', 'witness', 'notes'];

  it('finds every field drawn as a signature, wherever it stands', () => {
    expect([...signatureFields(page)]).toEqual(['signature', 'witness']);
  });

  it('signs every answer shown for "form", or those it names that are shown, in the page’s order — never a signature', () => {
    expect(answersToSign(page, { field: 'signature', options: { signs: 'form' } }, shown)).toEqual(['patient', 'treatment', 'areas', 'notes']);
    expect(answersToSign(page, { field: 'signature', options: { signs: ['notes', 'patient', 'dose', 'witness', 'signature'] } }, shown)).toEqual(['patient', 'notes']);
    expect(answersToSign(page, { field: 'signature', options: {} }, shown)).toEqual([]);
  });
});
