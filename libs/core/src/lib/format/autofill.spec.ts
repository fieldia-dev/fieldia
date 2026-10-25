import type { Page } from './page';
import type { FieldNode } from './layout';
import { validatePage } from './validate';
import { checkPage } from './check-page';
import { AUTOFILL, autofillProblem, autofillPurpose } from './autofill';

/** A page of one field, placed as the test says. */
const pageWith = (node: Partial<FieldNode>, type: 'char' | 'json' = 'char'): Page => ({
  fieldia: '0.13',
  id: 'p',
  data: { kind: 'responses' },
  fields: { f: { type, label: 'F' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'f', ...node }] },
});

describe('a box’s autocomplete purpose', () => {
  it('takes every purpose of the HTML standard, with its group, whose it is and webauthn', () => {
    for (const value of [
      'name', 'given-name', 'family-name', 'email', 'tel', 'street-address', 'address-line1', 'postal-code', 'country',
      'organization', 'one-time-code', 'bday', 'cc-number', 'new-password', 'current-password', 'transaction-amount',
      'shipping postal-code', 'billing street-address', 'section-home shipping country', 'section- email',
      'work email', 'mobile tel', 'billing home tel-national', 'username webauthn', 'section-a billing work email webauthn',
      'on', 'off',
    ]) {
      expect([value, autofillProblem(value)]).toEqual([value, null]);
      expect(AUTOFILL.test(value)).toBe(true);
    }
  });

  it('refuses one it does not list, in capitals, or in the wrong order', () => {
    for (const value of ['nope', 'Email', 'phone', 'email shipping', 'work name', 'webauthn', 'shipping billing tel', 'given-name family-name', '', ' email']) {
      expect([value, autofillProblem(value)]).toEqual([value, expect.stringContaining('no purpose a browser fills in')]);
    }
  });

  it('asks a box for what it holds, and an address in parts for whose it is alone', () => {
    expect(autofillProblem('shipping')).toBe('"shipping" says whose it is, not what the box holds: add its purpose, such as "shipping postal-code"');
    expect(autofillProblem('shipping', true)).toBeNull();
    expect(autofillProblem('section-home billing', true)).toBeNull();
    expect(autofillProblem('off', true)).toBeNull();
    expect(autofillProblem('postal-code', true)).toBe('an address in parts names each part’s own purpose: give only whose address it is, such as "shipping", or "off"');
  });

  it('reads the purpose out of its group and whose it is', () => {
    expect(autofillPurpose('section-a shipping work tel webauthn')).toBe('tel');
    expect(autofillPurpose('one-time-code')).toBe('one-time-code');
    expect(autofillPurpose('off')).toBe('');
    expect(autofillPurpose('shipping')).toBe('');
  });

  it('is checked as the page is shown and where it is made, at the field’s path', () => {
    expect(validatePage(pageWith({ autocomplete: 'given-name', inputmode: 'text' })).ok).toBe(true);
    expect(checkPage(pageWith({ autocomplete: 'shipping' }, 'json'))).toEqual({ ok: false, issues: [{ path: 'layout.children[0].autocomplete', message: expect.stringContaining('says whose it is') }] });
    expect(checkPage(pageWith({ autocomplete: 'shipping', widget: 'address' }, 'json')).ok).toBe(true);
    expect(validatePage(pageWith({ autocomplete: 'billing', widget: 'address' }, 'json')).ok).toBe(true);
    expect(checkPage(pageWith({ autocomplete: 'country', widget: 'address' }, 'json'))).toEqual({ ok: false, issues: [{ path: 'layout.children[0].autocomplete', message: expect.stringContaining('an address in parts') }] });
    // One the standard does not list is the format's to refuse, where pages are made; a browser passes over it.
    expect(validatePage(pageWith({ autocomplete: 'telephone' }))).toEqual({ ok: false, issues: [{ path: 'layout.children[0].autocomplete', message: expect.stringContaining('from the HTML standard') }] });
    expect(checkPage(pageWith({ autocomplete: 'telephone' })).ok).toBe(true);
  });

  it('takes the keyboards a phone shows, and refuses another', () => {
    for (const inputmode of ['text', 'numeric', 'decimal', 'tel', 'email', 'url', 'search'] as const) expect(validatePage(pageWith({ inputmode })).ok).toBe(true);
    const none = validatePage(pageWith({ inputmode: 'none' as never }));
    expect(none.ok ? [] : none.issues.map((issue) => issue.path)).toEqual(['layout.children[0].inputmode']);
  });
});
