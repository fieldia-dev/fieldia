import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { PATTERN_MOST } from '../format/pattern';
import { checkSubmission } from './submission';

/**
 * The server is the final gate (audit M10, S-M7): `checkSubmission` runs a page's checks where its answers arrive — a
 * request made by hand passes none of the browser's — and works out what is due itself, never trusting the amount a
 * browser sent.
 */

const enquiry = (more: Partial<Page> = {}): Page =>
  ({
    fieldia: '0.13',
    id: 'enquiry',
    data: { kind: 'responses' },
    fields: {
      name: { type: 'char', label: 'Your name', required: true, size: 40 },
      email: { type: 'char', label: 'Email', pattern: '^[^@\\s]+@[^@\\s]+$' },
      phone: { type: 'char', label: 'Mobile' },
      visit: { type: 'selection', label: 'Visit', options: [{ value: 'view', label: 'Book a viewing' }, { value: 'reserve', label: 'Reserve the unit now' }] },
      company: { type: 'char', label: 'Company', required: true, invisible: "visit != 'reserve'" },
      fee: { type: 'monetary', label: 'Fee', currency: 'EGP' },
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-name', field: 'name' },
        { type: 'field', id: 'f-email', field: 'email' },
        { type: 'field', id: 'f-phone', field: 'phone', widget: 'phone', options: { verify: true } },
        { type: 'field', id: 'f-visit', field: 'visit' },
        { type: 'field', id: 'f-company', field: 'company', invisible: "visit != 'reserve'" },
      ],
    },
    ...more,
  }) as Page;

const paid = { payment: { label: 'Reservation fee', amount: 10000, currency: 'EGP', when: "visit == 'reserve'" } } as Partial<Page>;

describe('checkSubmission: the browser’s checks, again where the answers arrive', () => {
  it('passes answers the browser would have sent, worked out over every field', async () => {
    const check = await checkSubmission(enquiry(), { name: 'Hana Fouad', email: 'hana@example.com', visit: 'view' });
    expect(check).toEqual({ ok: true, errors: {}, problems: [], values: { name: 'Hana Fouad', email: 'hana@example.com', phone: null, visit: 'view', company: null, fee: null }, due: null });
  });

  it('refuses what a request made by hand skips: required, a pattern, a length, an option, a field the page has not', async () => {
    const check = await checkSubmission(enquiry(), { email: 'not an email', visit: 'free', name: 'x'.repeat(41), admin: true });
    expect(check.ok).toBe(false);
    expect(check.errors).toEqual({
      name: 'Your name is 1 character too long: shorten it to 40',
      email: 'Email is not in the expected format',
      visit: 'Must be one of: Book a viewing, Reserve the unit now',
    });
    expect(check.problems).toEqual(['"admin" is no field of this page']);
    // Required by a condition, as the browser reads it.
    expect((await checkSubmission(enquiry(), { name: 'Hana', visit: 'reserve' })).errors).toEqual({ company: 'Company is required' });
  });

  it('a phone that asks for a code is proved only with the value proved and the app’s proof', async () => {
    const values = { name: 'Hana', phone: '+201012345678' };
    const words = { phone: 'Mobile is not confirmed: send a code and type it in' };
    expect((await checkSubmission(enquiry(), values)).errors).toEqual(words);
    expect((await checkSubmission(enquiry(), values, { verified: { phone: { value: '+201012345678' } } })).errors).toEqual(words);
    expect((await checkSubmission(enquiry(), values, { verified: { phone: { value: '+201099999999', proof: 'signed' } } })).errors).toEqual(words);
    expect((await checkSubmission(enquiry(), values, { verified: { phone: { value: '+201012345678', proof: 'signed' } } })).ok).toBe(true);
  });

  it('works out what is due itself, and refuses answers paid short, in another currency, or not at all', async () => {
    const values = { name: 'Hana', visit: 'reserve', company: 'Nile' };
    const none = await checkSubmission(enquiry(paid), values);
    expect(none.due).toEqual({ amount: 10000, currency: 'EGP', label: 'Reservation fee' });
    expect(none.problems).toEqual(['Reservation fee of 10000 EGP is due, and the answers carry none']);
    const short = await checkSubmission(enquiry(paid), values, { payment: { amount: 1, currency: 'EGP', key: 'pay-1' } });
    expect(short.problems).toEqual(['10000 EGP is due, and the answers carry 1 EGP']);
    const other = await checkSubmission(enquiry(paid), values, { payment: { amount: 10000, currency: 'USD', key: 'pay-1' } });
    expect(other.ok).toBe(false);
    expect((await checkSubmission(enquiry(paid), values, { payment: { amount: 10000, currency: 'EGP', key: 'pay-1', reference: 'PAY-1' } })).ok).toBe(true);
    // Nothing due for a viewing: none asked.
    expect(await checkSubmission(enquiry(paid), { name: 'Hana', visit: 'view' })).toMatchObject({ ok: true, due: null });
  });

  it('an amount from a field is read from the answers checked here: what a checkout charges is `due`', async () => {
    const page = enquiry({ payment: { label: 'Deposit', amount: 'fee' } } as Partial<Page>);
    const check = await checkSubmission(page, { name: 'Hana', fee: 2500 }, { payment: { amount: 2500, currency: 'EGP', key: 'k' } });
    expect(check).toMatchObject({ ok: true, due: { amount: 2500, currency: 'EGP' } });
  });

  it('checks a pattern as the browser does, one checker for both: a pattern refused in a page refuses the answers, a long answer fails its pattern untried', async () => {
    // A pattern that could take seconds on a short answer: the browser's page check refuses the page, and so does this.
    const risky = enquiry({ fields: { ...enquiry().fields, email: { type: 'char', label: 'Email', pattern: '(a+)+@x' } } } as Partial<Page>);
    expect(checkPage(risky).ok).toBe(false);
    const refused = await checkSubmission(risky, { name: 'Hana', email: 'aaaa@x' });
    expect(refused.ok).toBe(false);
    expect(refused.problems.join(' ')).toMatch(/^The page cannot take answers: fields\.email\.pattern: .*seconds/);
    // And an answer rule's: refused the same way.
    const plain = enquiry();
    const children = (plain.layout as { children: { id: string }[] }).children.map((node) => (node.id === 'f-name' ? { ...node, validate: [{ pattern: '(x|x)*y' }] } : node));
    const rule = enquiry({ layout: { ...plain.layout, children } } as Partial<Page>);
    expect(checkPage(rule).ok).toBe(false);
    expect((await checkSubmission(rule, { name: 'xxxy' })).ok).toBe(false);
    // An answer longer than a pattern is tried on is not of it, here as in the browser: never tried, at once.
    const long = `${'a'.repeat(PATTERN_MOST)}@nile.example`;
    const started = Date.now();
    const checked = await checkSubmission(enquiry(), { name: 'Hana', email: long });
    expect(Date.now() - started).toBeLessThan(500);
    expect(checked.errors['email']).toBeTruthy();
  });

  it('refuses answers larger than they may be, before reading them', async () => {
    const check = await checkSubmission(enquiry(), { name: 'x'.repeat(2000) }, { maxBytes: 1000 });
    expect(check).toMatchObject({ ok: false, problems: ['The answers take 2011 bytes, more than the 1000 they may'] });
    expect((await checkSubmission(enquiry(), [] as never)).problems).toEqual(['The answers are not an object of values by field']);
  });
});
