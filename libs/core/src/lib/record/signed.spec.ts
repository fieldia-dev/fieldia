import { checkPage, createForm, evidenceOf, signedBy, signsAnswers, validatePage, type Field, type Page, type SignatureEvidence } from '../../index';

/**
 * A signature that signs answers (`options.signs`) keeps who, when, which answers and their fingerprint beside its
 * picture (`FileValue.signed`): while it is kept, the form locks the answers it signed — whatever the page's
 * conditions say — and an app asks which signature locks one (`signedBy`). The form gives a signature what it needs:
 * its clock (`now`), the person (`user`) and the answers shown (`shownFields`). The format checks the settings.
 */

const EVIDENCE: SignatureEvidence = { format: 'fieldia-signature/1', by: 'Mona Adel', at: '2026-10-19T08:42:00.000Z', fields: ['patient', 'treatment'], sha256: 'ab'.repeat(32) };
const PICTURE = { name: 'signature.png', type: 'image/png', size: 4, data: 'QUJDRA==' };

const page = (signs: unknown = ['patient', 'treatment'], more: Record<string, unknown> = {}, given = true): Page =>
  ({
    fieldia: '0.9',
    id: 'consent',
    data: { kind: 'responses' },
    fields: {
      patient: { type: 'char', label: 'Patient' },
      treatment: { type: 'selection', label: 'Treatment', options: [{ value: 'botox', label: 'Anti-wrinkle injections' }] },
      pregnant: { type: 'boolean', label: 'Pregnant' },
      notes: { type: 'text', label: 'Notes' },
      signature: { type: 'binary', label: 'Signature' },
    } as Record<string, Field>,
    layout: {
      type: 'wizard',
      id: 'root',
      children: [
        {
          type: 'step',
          id: 'step-you',
          label: 'You',
          children: [
            { type: 'field', id: 'f-patient', field: 'patient' },
            { type: 'field', id: 'f-treatment', field: 'treatment', readonly: "patient == 'nobody'" },
            { type: 'field', id: 'f-pregnant', field: 'pregnant', invisible: "treatment != 'botox'" },
          ],
        },
        { type: 'step', id: 'step-extra', label: 'Extra', optional: true, children: [{ type: 'field', id: 'f-notes', field: 'notes' }] },
        { type: 'step', id: 'step-sign', label: 'Sign', children: [{ type: 'field', id: 'f-signature', field: 'signature', widget: 'signature', options: { ...(given ? { signs } : {}), ...more } }] },
      ],
    },
  }) as unknown as Page;

describe('answers a signature signed', () => {
  it('are read from the evidence its value keeps, and from nothing else', () => {
    expect(evidenceOf({ ...PICTURE, signed: EVIDENCE })).toBe(EVIDENCE);
    expect(evidenceOf(PICTURE)).toBeNull();
    expect(evidenceOf(null)).toBeNull();
    expect(evidenceOf({ ...PICTURE, signed: { fields: 'patient' } } as never)).toBeNull();
    const by = signedBy(page(), { signature: { ...PICTURE, signed: EVIDENCE } });
    expect([...by.keys()]).toEqual(['patient', 'treatment']);
    expect(by.get('patient')).toEqual({ field: 'signature', evidence: EVIDENCE });
    expect(signedBy(page(), { signature: PICTURE }).size).toBe(0);
    // A signature the page no longer has sign answers is a picture, whatever its value carries.
    expect(signedBy(page([]), { signature: { ...PICTURE, signed: EVIDENCE } }).size).toBe(0);
    expect(signsAnswers({ options: { signs: 'form' } })).toBe(true);
    expect(signsAnswers({ options: { signs: ['patient'] } })).toBe(true);
    expect(signsAnswers({ options: { signs: [] } })).toBe(false);
    expect(signsAnswers({ options: { penWidth: 5 } })).toBe(false);
    expect(signsAnswers({})).toBe(false);
  });

  it('are locked while it is kept, whatever the page’s conditions say; taken away, they open again', () => {
    const form = createForm({ page: page(), values: { patient: 'Mona Adel', treatment: 'botox' } });
    expect(form.node('f-patient').readonly).toBe(false);
    form.setValue('signature', { ...PICTURE, signed: EVIDENCE });
    expect(form.node('f-patient').readonly).toBe(true);
    expect(form.node('f-treatment').readonly).toBe(true);
    expect(form.fieldReadonly('treatment')).toBe(true);
    // Not signed, not locked; nor the signature itself.
    expect(form.node('f-notes').readonly).toBe(false);
    expect(form.node('f-signature').readonly).toBe(false);
    form.setValue('signature', null);
    expect(form.node('f-patient').readonly).toBe(false);
    expect(form.fieldReadonly('treatment')).toBe(false);
  });

  it('are locked as a record loads with its signature — and not where the page’s signature no longer signs answers', async () => {
    const opened = async (given: Page) => {
      const form = createForm({
        page: { ...given, data: { kind: 'record', model: 'consent' } } as Page,
        recordId: 1,
        dataSource: { load: async () => ({ patient: 'Mona Adel', treatment: 'botox', signature: { ...PICTURE, url: 'https://files/1', signed: EVIDENCE } }) },
      });
      await form.load();
      return form;
    };
    expect((await opened(page())).node('f-treatment').readonly).toBe(true);
    const plain = page();
    (plain.layout as unknown as { children: { children: Record<string, unknown>[] }[] }).children[2].children[0]['options'] = {};
    const form = await opened(plain);
    expect(form.node('f-treatment').readonly).toBe(false);
    expect(form.fieldReadonly('treatment')).toBe(false);
  });
});

describe('what the form gives a signature', () => {
  it('its clock, the person, and the answers shown in the page’s order: none hidden, none in a step passed over', () => {
    const now = new Date('2026-10-19T08:42:00Z');
    const form = createForm({ page: page(), now: () => now, user: { id: 3, name: 'Sara' }, values: { patient: 'Mona Adel', treatment: 'peel' } });
    expect(form.now()).toBe(now);
    expect(form.user()).toEqual({ id: 3, name: 'Sara' });
    expect(createForm({ page: page() }).user()).toBeNull();
    expect(createForm({ page: page() }).now()).toBeInstanceOf(Date);
    expect(form.shownFields()).toEqual(['patient', 'treatment', 'notes', 'signature']);
    form.setValue('treatment', 'botox');
    expect(form.shownFields()).toEqual(['patient', 'treatment', 'pregnant', 'notes', 'signature']);
    form.next();
    form.skip();
    expect(form.shownFields()).toEqual(['patient', 'treatment', 'pregnant', 'signature']);
  });
});

describe('a signature that signs answers, in the page format', () => {
  const issues = (given: Page) => {
    const full = validatePage(given);
    const quick = checkPage(given);
    return { full: full.ok ? [] : full.issues.map((i) => `${i.path}: ${i.message}`), quick: quick.ok ? [] : quick.issues.map((i) => `${i.path}: ${i.message}`) };
  };
  const at = 'layout.children[2].children[0]';

  it('signs every answer or the fields it names, its signer named by a field of words', () => {
    expect(issues(page())).toEqual({ full: [], quick: [] });
    expect(issues(page('form', { signerField: 'patient' }))).toEqual({ full: [], quick: [] });
  });

  it('refuses settings written wrong, names of no field, itself, and a signer it cannot read a name from', () => {
    expect(issues(page('everything')).full).toEqual([`${at}.options.signs: signs is "form" (every answer shown) or the fields it signs, by name: ["treatment", "consent"]`]);
    expect(issues(page([])).full).toEqual([expect.stringMatching(/options\.signs/)]);
    expect(issues(page(['patient', 'colour'])).quick).toEqual([`${at}.options.signs[1]: no field "colour"`]);
    expect(issues(page(['signature'])).quick).toEqual([`${at}.options.signs[0]: a signature signs other answers than its own`]);
    expect(issues(page('form', { signerField: 'pregnant' })).quick).toEqual([`${at}.options.signerField: "pregnant" is a boolean; the signer's name is kept in a char field, or is a many2one's record`]);
    expect(issues(page('form', { signerField: 'nobody' })).quick).toEqual([`${at}.options.signerField: no field "nobody"`]);
    expect(issues(page(undefined, { signerField: 'patient' }, false)).quick).toEqual([`${at}.options.signerField: signerField names who signs the answers in signs: say which it signs`]);
  });

  it('is a signature on a binary field', () => {
    const wrong = page();
    (wrong.layout as unknown as { children: { children: Record<string, unknown>[] }[] }).children[2].children[0]['field'] = 'notes';
    expect(issues(wrong).quick).toEqual([`${at}.widget: signature is for a binary field; "notes" is a text`]);
  });
});
