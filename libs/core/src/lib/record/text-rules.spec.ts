import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Field } from '../format/field';
import type { FieldNode } from '../format/layout';
import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { checkValue } from './check';
import { createForm } from './form';
import { settledText } from './inputs';
import { MESSAGES } from './messages';
import { postcodeFits, settledPostcode } from './structures';

/**
 * The input rules (0.21) for text: what a text answer is checked against —
 * its most characters counted as a server counts them, a pattern about the
 * whole answer with its digits as 0-9, a phone number, an email and a web
 * address without the direction marks Arabic text brings, a postcode by its
 * country, a property by its kind — and what a box keeps once it is left.
 */

/** One question on a page of its own, as the form checks it. */
function ask(field: Record<string, unknown>, node: Partial<FieldNode> = {}, locale: keyof typeof MESSAGES = 'en') {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { label: 'Answer', ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x', ...node }] },
  } as Page;
  const form = createForm({ page, messages: MESSAGES[locale] });
  return { form, problem: (value: unknown) => (form.setValue('x', value as never), form.problem('x')) };
}

describe('a text’s most characters', () => {
  it('counts an emoji as one, as a server counts characters', () => {
    const field = { type: 'char', label: 'Full name', size: 3 } as Field;
    expect(checkValue(field, '😀😀😀', false)).toBeUndefined();
    expect(checkValue(field, 'a😀😀😀', false)).toBe('Full name is 1 character too long: shorten it to 3');
  });

  it('says how far over a pasted text is, in each language', () => {
    const field = { type: 'text', label: 'Dietary needs', size: 300 } as Field;
    const text = 'No nuts.\n'.repeat(60);
    expect(checkValue(field, text, false)).toBe('Dietary needs is 240 characters too long: shorten it to 300');
    expect(checkValue(field, text, false, MESSAGES.ar)).toBe('Dietary needs: أطول بـ240 من الأحرف؛ اختصره إلى 300');
    expect(checkValue(field, text, false, MESSAGES.de)).toBe('Dietary needs ist 240 Zeichen zu lang: kürzen Sie es auf 300');
  });
});

describe('a field’s pattern', () => {
  it('is about the whole answer, as an answer rule’s pattern is', () => {
    const { problem } = ask({ type: 'char', label: 'Zip', pattern: '[0-9]{5}' });
    expect(problem('ab12345cd')).toBe('Zip is not in the expected format');
    expect(problem('call 12345 now')).toBe('Zip is not in the expected format');
    expect(problem('12345')).toBeNull();
  });

  it('is tested on the answer trimmed, its digits as 0-9 and with no direction marks', () => {
    const { problem } = ask({ type: 'char', label: 'Zip', pattern: '^\\d{5}$' }, {}, 'ar');
    for (const ok of [' 11511', '11511 ', '١١٥١١', '۱۱۵۱۱', '\u200e11511', '\u2066١١٥١١\u2069']) expect({ ok, says: problem(ok) }).toEqual({ ok, says: null });
    expect(problem('1151')).toBe('صيغة Zip غير صحيحة');
  });

  it('says the page’s own reason, when it gives one', () => {
    const { problem } = ask({ type: 'char', label: 'Badge', pattern: '[A-Z]{2}-\\d{4}', patternHint: '{label} is two capitals, a dash and four digits, like AB-1234' });
    expect(problem('ab-12')).toBe('Badge is two capitals, a dash and four digits, like AB-1234');
  });

  it('reads letters in any script with \\p{L}, and an old pattern written for reading without Unicode as it was', () => {
    expect(ask({ type: 'char', pattern: '\\p{L}+' }).problem('محمد')).toBeNull();
    expect(ask({ type: 'char', pattern: '[A-Z]{2}\\-\\d{2}' }).problem('AB-12')).toBeNull();
  });

  it('never throws on a pattern that does not read, which checkPage names', () => {
    const page = {
      fieldia: '0.1',
      id: 't',
      data: { kind: 'responses' },
      fields: { zip: { type: 'char', label: 'Zip', pattern: '[0-9' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'zip' }] },
    };
    const checked = checkPage(page);
    expect(checked.ok).toBe(false);
    expect(checked.ok ? [] : checked.issues).toEqual([{ path: 'fields.zip.pattern', message: expect.stringMatching(/^The pattern of Zip is not a valid pattern: /) }]);
    const form = createForm({ page: page as unknown as Page });
    form.setValue('zip', '123');
    expect(() => form.validate()).not.toThrow();
    expect(form.validate()).toBe(true);
  });

  it('lets the employee template’s own example IBAN through, spaced or not, in either case', () => {
    const template = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'examples', 'templates', 'employee-onboarding.page.json'), 'utf8')) as Page;
    const iban = template.fields['iban'] as Field;
    for (const ok of ['EG38 0019 0005 0000 0000 2631 8000 2', 'eg38 0019 0005 0000 0000 2631 8000 2', 'EG380019000500000000263180002']) expect({ ok, says: checkValue(iban, ok, false) }).toEqual({ ok, says: undefined });
    expect(checkValue(iban, 'EG38', false)).toBe('IBAN: two letters, two digits, then the account, like EG38 0019 0005 0000 0000 2631 8000 2');
  });
});

describe('an answer rule’s pattern', () => {
  it('reads Arabic and Persian digits as 0-9', () => {
    const { problem } = ask({ type: 'char', label: 'Postcode' }, { validate: [{ pattern: '^[0-9]{5}$', message: 'A postcode is five figures' }] });
    for (const ok of ['١١٥١١', '۱۱۵۱۱', '11511', '\u200f11511']) expect({ ok, says: problem(ok) }).toEqual({ ok, says: null });
    expect(problem('١١٥١')).toBe('A postcode is five figures');
  });
});

describe('a phone number copied from Arabic text', () => {
  const { problem } = ask({ type: 'char', label: 'Site phone' }, { widget: 'phone' }, 'ar');

  it('is taken with its direction marks, which are no part of it', () => {
    const example = /\u2066([^\u2069]+)\u2069/.exec(MESSAGES.ar.phone)?.[0] as string;
    for (const ok of ['\u200e+20 10 1234 5678', '\u202a+20 10 1234 5678\u202c', example, '٠١٠١٢٣٤٥٦٧٨']) expect({ ok, says: problem(ok) }).toEqual({ ok, says: null });
  });
});

describe('an email', () => {
  const { problem } = ask({ type: 'char', label: 'Email' }, { widget: 'email' });

  it('is taken with the direction marks copying brings, and never with another invisible character', () => {
    expect(problem('\u200fname@example.com\u200f')).toBeNull();
    expect(problem('name\u200b@example.com')).toBe('Enter an email address, like name@example.com');
    expect(problem('na\u00adme@example.com')).toBe('Enter an email address, like name@example.com');
    // An international domain, as written.
    expect(problem('ali@مثال.مصر')).toBeNull();
    expect(problem('user@münchen.de')).toBeNull();
  });
});

describe('what a box keeps once it is left', () => {
  it('trims one line, spaces alone being nothing, and its direction marks at its ends', () => {
    expect(settledText('  Cairo office  ', {})).toBe('Cairo office');
    expect(settledText('   ', {})).toBe('');
    expect(settledText('\u200fمكتب القاهرة\u200f', {})).toBe('مكتب القاهرة');
    // Free text keeps its digits as typed: customer data is never translated.
    expect(settledText(' شقة ١٢ ', {})).toBe('شقة ١٢');
  });

  it('keeps a phone number and an answer a pattern checks in 0-9, an email and a web address without marks', () => {
    expect(settledText(' ٠١٠١٢٣٤٥٦٧٨ ', { widget: 'phone' })).toBe('01012345678');
    expect(settledText('\u2066+20 100 123 4567\u2069', { widget: 'phone' })).toBe('+20 100 123 4567');
    expect(settledText('١١٥١١', { pattern: true })).toBe('11511');
    expect(settledText('\u200fname@example.com ', { widget: 'email' })).toBe('name@example.com');
    expect(settledText(' example.com\u200e', { widget: 'url' })).toBe('example.com');
    // A password, exactly as typed.
    expect(settledText('  S3cret! ', { widget: 'password' })).toBe('  S3cret! ');
  });
});

describe('a postcode by its country', () => {
  const address = (locale: keyof typeof MESSAGES = 'en') => ask({ type: 'json', label: 'Badge address' }, { widget: 'address', options: { parts: ['street', 'city', 'postcode', 'country'] } }, locale).problem;

  it('is five digits in Egypt, Saudi Arabia, Kuwait and Jordan; three or four in Bahrain; three in Oman', () => {
    const problem = address();
    for (const [country, postcode] of [['EG', '11511'], ['SA', '12271'], ['KW', '13001'], ['JO', '11118'], ['BH', '317'], ['BH', '1209'], ['OM', '112']]) {
      expect({ country, postcode, says: problem({ postcode, country }) }).toEqual({ country, postcode, says: null });
    }
    expect(problem({ postcode: 'ABCDE', country: 'EG' })).toBe('Badge address: a postcode in Egypt has 5 digits, like 11511');
    expect(problem({ postcode: '115', country: 'EG' })).toBe('Badge address: a postcode in Egypt has 5 digits, like 11511');
    expect(problem({ postcode: '😀', country: 'SA' })).toBe('Badge address: a postcode in Saudi Arabia has 5 digits, like 12271');
    expect(problem({ postcode: '12', country: 'BH' })).toBe('Badge address: a postcode in Bahrain has 3–4 digits, like 317');
  });

  it('reads Arabic digits and spaces at its ends, and leaves other countries’ postcodes alone', () => {
    const problem = address();
    expect(problem({ postcode: ' 11511 ', country: 'EG' })).toBeNull();
    expect(problem({ postcode: '١١٥١١', country: 'EG' })).toBeNull();
    expect(problem({ postcode: 'SW1A 1AA', country: 'GB' })).toBeNull();
    expect(problem({ postcode: 'ABCDE' })).toBeNull();
    expect(settledPostcode(' ١١٥١١\u200f ')).toBe('11511');
    expect(postcodeFits('eg', '11511')).toBe(true);
    expect(postcodeFits('FR', '75001')).toBeNull();
  });

  it('says so in Arabic, French and German', () => {
    expect(address('ar')({ postcode: '115', country: 'EG' })).toBe('Badge address: الرمز البريدي في مصر من 5 أرقام، مثل 11511');
    expect(address('fr')({ postcode: '115', country: 'EG' })).toBe('Badge address : code postal de 5 chiffres attendu pour Égypte, par exemple 11511');
    expect(address('de')({ postcode: '115', country: 'EG' })).toBe('Badge address: Postleitzahl für Ägypten mit 5 Ziffern, z. B. 11511');
  });
});

describe('a properties field', () => {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: {
      extra: {
        type: 'properties',
        label: 'Building details',
        definitions: [
          { name: 'floor', label: 'Floor', type: 'integer' },
          { name: 'lift_access', label: 'Lift access', type: 'char' },
          { name: 'weight', label: 'Weight', type: 'float' },
        ],
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'extra' }] },
  } as unknown as Page;

  it('checks each property as a field of its kind, on its own row', () => {
    const form = createForm({ page });
    form.setValue('extra', { floor: 'twelve', lift_access: 'Yes', weight: 2.5 });
    expect(form.problem('extra')).toBe('Floor must be a number');
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ 'extra.floor': 'Floor must be a number' });
    form.setValue('extra', { floor: 12.5 });
    expect(form.validate()).toBe(false);
    expect(form.getState().errors).toEqual({ 'extra.floor': 'Floor must be a whole number' });
    form.setValue('extra', { floor: 12, weight: 1234.5 });
    expect(form.validate()).toBe(true);
  });

  it('keeps a row’s text left unread at its path, says it as the row is left, and lets it go once the row reads', () => {
    const form = createForm({ page, messages: MESSAGES.fr });
    form.setValue('extra', { floor: 3 });
    form.setUnread('extra.floor', { text: '3 étages', message: 'Floor : « 3 étages » n’est pas un nombre' });
    expect(form.problem('extra')).toBe('Floor : « 3 étages » n’est pas un nombre');
    form.boxLeft('extra.floor');
    expect(form.getState().errors['extra.floor']).toBe('Floor : « 3 étages » n’est pas un nombre');
    // Leaving the whole field says nothing more under it: the row says it.
    form.boxLeft('extra');
    expect(form.getState().errors['extra']).toBeUndefined();
    expect(form.validate()).toBe(false);
    // Another property written keeps it; the row written another way lets it go.
    form.setValue('extra', { floor: 3, weight: 2 });
    expect(form.getState().unread['extra.floor']).toBeDefined();
    form.setValue('extra', { floor: 4, weight: 2 });
    expect(form.getState().unread['extra.floor']).toBeUndefined();
    expect(form.validate()).toBe(true);
  });

  it('checks the properties a linked record gives, once they load', async () => {
    const linked = {
      ...page,
      fields: { extra: { type: 'properties', label: 'Details', definitionsFrom: { list: 'project' } } },
    } as unknown as Page;
    const form = createForm({ page: linked, dataSource: { load: async () => ({}), save: async () => ({ id: 1 }), definitions: async () => [{ name: 'count', label: 'Count', type: 'integer' }] } as never });
    form.loadDefinitions('extra');
    await new Promise((resolve) => setTimeout(resolve, 0));
    form.setValue('extra', { count: 1.5 });
    expect(form.problem('extra')).toBe('Count must be a whole number');
  });
});
