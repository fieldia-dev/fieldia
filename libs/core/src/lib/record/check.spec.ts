import type { Field } from '../format/field';
import { checkValue } from './check';
import { MESSAGES } from './messages';

const F = (field: Record<string, unknown>) => ({ label: 'Name', ...field }) as Field;

describe('checkValue — required', () => {
  it('names the field that is missing, as the React engine did', () => {
    expect(checkValue(F({ type: 'char' }), null, true)).toBe('Name is required');
    expect(checkValue(F({ type: 'char' }), '  ', true)).toBe('Name is required');
    expect(checkValue(F({ type: 'many2many', relation: 't' }), [], true)).toBe('Name is required');
  });

  it('lets an empty optional value through every other check', () => {
    expect(checkValue(F({ type: 'char', pattern: '^x$' }), null, false)).toBeUndefined();
    expect(checkValue(F({ type: 'integer', min: 5 }), null, false)).toBeUndefined();
  });
});

describe('checkValue — text', () => {
  it('limits length', () => {
    // A text over its most was pasted whole: how far over it is, to shorten.
    expect(checkValue(F({ type: 'char', size: 3 }), 'abcdef', false)).toBe('Name is 3 characters over its 3: shorten it to save');
    // Counted as a server counts: an emoji is one character.
    expect(checkValue(F({ type: 'char', size: 3 }), '😀😀😀', false)).toBeUndefined();
    expect(checkValue(F({ type: 'char', size: 3 }), 'abc', false)).toBeUndefined();
  });

  it('checks a pattern', () => {
    const email = F({ type: 'char', label: 'Email', pattern: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$' });
    expect(checkValue(email, 'not-an-email', false)).toBe('Email is not in the expected format');
    expect(checkValue(email, 'a@b.co', false)).toBeUndefined();
  });

  it('refuses a value that is not text', () => {
    expect(checkValue(F({ type: 'char' }), 5, false)).toBe('Name must be text');
  });
});

describe('checkValue — numbers', () => {
  it('wants whole numbers for an integer', () => {
    expect(checkValue(F({ type: 'integer' }), 2.5, false)).toBe('Name must be a whole number');
    expect(checkValue(F({ type: 'integer' }), '3', false)).toBe('Name must be a number');
  });

  it('enforces min and max', () => {
    const rating = F({ type: 'integer', label: 'Rating', min: 1, max: 5 });
    expect(checkValue(rating, 0, false)).toBe('Rating must be at least 1');
    expect(checkValue(rating, 6, false)).toBe('Rating must be at most 5');
    expect(checkValue(rating, 3, false)).toBeUndefined();
  });

  it('limits decimal places, naming the field, in the plural form its number takes', () => {
    expect(checkValue(F({ type: 'float', digits: [16, 2] }), 1.234, false)).toBe('Name takes at most 2 decimal places');
    expect(checkValue(F({ type: 'float', label: 'Floor area (m²)', digits: [10, 1] }), 12.345, false)).toBe('Floor area (m²) takes at most 1 decimal place');
    expect(checkValue(F({ type: 'float', digits: [10, 0] }), 1.5, false)).toBe('Name must be a whole number');
    expect(checkValue(F({ type: 'monetary', digits: [16, 2] }), 1.23, false)).toBeUndefined();
  });

  it.each([
    ['ar', 1, 'Name: منزلة عشرية واحدة على الأكثر'],
    ['ar', 2, 'Name: منزلتان عشريتان على الأكثر'],
    ['ar', 3, 'Name: 3 منازل عشرية على الأكثر'],
    ['ar', 11, 'Name: 11 منزلة عشرية على الأكثر'],
    ['fr', 1, 'Name accepte au plus une décimale'],
    ['fr', 2, 'Name accepte au plus 2 décimales'],
    ['de', 1, 'Name hat höchstens eine Nachkommastelle'],
    ['de', 3, 'Name hat höchstens 3 Nachkommastellen'],
  ] as const)('%s: %s decimal places', (locale, places, said) => {
    expect(checkValue(F({ type: 'float', digits: [30, places] }), 0.123456789012, false, MESSAGES[locale])).toBe(said);
  });

  it('refuses a value past what a number keeps exactly, or past the field’s digits', () => {
    expect(checkValue(F({ type: 'integer' }), 12345678901234567000, false)).toBe('Name takes at most 15 digits');
    expect(checkValue(F({ type: 'integer' }), 1e30, false)).toBe('Name takes at most 15 digits');
    expect(checkValue(F({ type: 'float' }), 1e16, false)).toBe('Name takes at most 15 digits');
    expect(checkValue(F({ type: 'float', digits: [10, 1] }), 1e30, false)).toBe('Name takes at most 15 digits');
    // Past the whole part a field of [10, 1] keeps, nine digits: said as such, never "at most 10" of a number of 10 (df827a7).
    expect(checkValue(F({ type: 'float', digits: [10, 1] }), 1234567890, false)).toBe('Name takes at most 9 digits before the decimal point');
    expect(checkValue(F({ type: 'float', digits: [10, 0] }), 12345678901, false)).toBe('Name takes at most 10 digits');
    expect(checkValue(F({ type: 'float', digits: [10, 1] }), 123456789.5, false)).toBeUndefined();
    expect(checkValue(F({ type: 'integer' }), 999999999999999, false)).toBeUndefined();
  });

  it('counts a per cent’s places as its box shows them: digits [5, 2] keep 12.50 %, the fraction 0.1250', () => {
    const cut = F({ type: 'float', digits: [5, 2] });
    const asPercent = (value: number) => checkValue(cut, value, false, undefined, undefined, 'percentage');
    expect(asPercent(0.125)).toBeUndefined();
    expect(asPercent(0.12345)).toBe('Name takes at most 2 decimal places');
    expect(asPercent(9.9999)).toBeUndefined();
    expect(asPercent(10)).toBe('Name takes at most 3 digits before the decimal point');
    // Shown as a number, the same field keeps the fraction to two places.
    expect(checkValue(cut, 0.125, false)).toBe('Name takes at most 2 decimal places');
  });

  it('refuses infinity and NaN', () => {
    expect(checkValue(F({ type: 'float' }), Infinity, false)).toBe('Name must be a number');
    expect(checkValue(F({ type: 'float' }), NaN, false)).toBe('Name must be a number');
  });
});

describe('checkValue — dates', () => {
  it('wants YYYY-MM-DD and a real day', () => {
    expect(checkValue(F({ type: 'date' }), '02/10/2026', false)).toBe('Invalid date format (expected YYYY-MM-DD)');
    expect(checkValue(F({ type: 'date' }), '2026-02-30', false)).toBe('Invalid date (check month/day values)');
    expect(checkValue(F({ type: 'date' }), '2026-02-28', false)).toBeUndefined();
  });

  it('wants an ISO date and time', () => {
    expect(checkValue(F({ type: 'datetime' }), '2026-10-02 10:00:00', false)).toBe(
      'Invalid date and time format (expected YYYY-MM-DDTHH:MM:SS)'
    );
    expect(checkValue(F({ type: 'datetime' }), '2026-10-02T25:00:00Z', false)).toBe('Invalid date and time (check the values)');
    expect(checkValue(F({ type: 'datetime' }), '2026-10-02T10:00:00Z', false)).toBeUndefined();
    expect(checkValue(F({ type: 'datetime' }), '2026-10-02T10:00:00.120+02:00', false)).toBeUndefined();
  });
});

describe('checkValue — choices and relations', () => {
  const status = F({
    type: 'selection',
    label: 'Status',
    options: [
      { value: 'draft', label: 'Draft' },
      { value: 'done', label: 'Done' },
    ],
  });

  it('wants one of the options, listing them by label', () => {
    expect(checkValue(status, 'lost', false)).toBe('Must be one of: Draft, Done');
    expect(checkValue(status, 'done', false)).toBeUndefined();
  });

  it('checks every choice of a multiple selection', () => {
    const multi = { ...status, multiple: true } as Field;
    expect(checkValue(multi, ['draft', 'lost'], false)).toBe('Must be one of: Draft, Done');
    expect(checkValue(multi, ['draft', 'done'], false)).toBeUndefined();
    expect(checkValue(multi, 'draft', false)).toBe('Status must be a list of choices');
  });

  it('takes an answer of its own where the field has an “Other” choice, one only, and never a blank one', () => {
    const other = { ...status, other: true } as Field;
    expect(checkValue(other, 'Archived last week', false)).toBeUndefined();
    expect(checkValue(other, 'done', false)).toBeUndefined();
    // Typed in and rubbed out: nothing was answered.
    expect(checkValue(other, '   ', true)).toBe('Status is required');
    expect(checkValue(other, 7, false)).toBe('Must be one of: Draft, Done, or an answer of its own');
    const several = { ...other, multiple: true } as Field;
    expect(checkValue(several, ['draft', 'Something else'], false)).toBeUndefined();
    expect(checkValue(several, ['draft', 'One', 'Two'], false)).toBe('Must be one of: Draft, Done, or an answer of its own');
    expect(checkValue(several, ['draft', ' '], false)).toBe('Must be one of: Draft, Done, or an answer of its own');
  });

  it('wants a many2one to be a record with an id and a label', () => {
    const country = F({ type: 'many2one', label: 'Country', relation: 'country' });
    expect(checkValue(country, 5, false)).toBe('Country must be a record');
    expect(checkValue(country, { id: 5, label: 'Egypt' }, false)).toBeUndefined();
  });

  it('wants a reference to point at one of its models', () => {
    const doc = F({ type: 'reference', label: 'Document', models: [{ value: 'sale.order', label: 'Sales order' }] });
    expect(checkValue(doc, { model: 'invoice', id: 1, label: 'INV1' }, false)).toBe('Document must point to a Sales order');
    expect(checkValue(doc, { model: 'sale.order', id: 1, label: 'SO1' }, false)).toBeUndefined();
  });
});

describe('checkValue — files', () => {
  const upload = F({ type: 'binary', label: 'Contract', accept: ['application/pdf', 'image/*'], maxSize: 1048576 });

  it('enforces size', () => {
    expect(checkValue(upload, { name: 'a.pdf', type: 'application/pdf', size: 2 * 1048576 }, false)).toBe(
      'Contract is larger than 1 MB'
    );
  });

  it('enforces accepted types, wildcards included', () => {
    expect(checkValue(upload, { name: 'a.zip', type: 'application/zip', size: 10 }, false)).toBe(
      'Contract must be a PDF or image file'
    );
    expect(checkValue(upload, { name: 'a.png', type: 'image/png', size: 10 }, false)).toBeUndefined();
  });
});

describe('checkValue — other languages', () => {
  const name = F({ type: 'char', label: 'الاسم' });

  it('speaks Arabic, German and French', async () => {
    const { MESSAGES } = await import('./messages');
    expect(checkValue(name, null, true, MESSAGES.ar)).toBe('الاسم مطلوب');
    expect(checkValue(F({ type: 'integer', label: 'Bewertung', min: 1 }), 0, false, MESSAGES.de)).toBe('Bewertung muss mindestens 1 sein');
    expect(checkValue(F({ type: 'char', label: 'Nom', size: 3 }), 'abcdef', false, MESSAGES.fr)).toBe('Nom dépasse de 3 caractères la limite de 3 : raccourcissez-le pour enregistrer');
  });

  it('joins choices with the language’s own "or"', async () => {
    const { MESSAGES } = await import('./messages');
    const upload = F({ type: 'binary', label: 'العقد', accept: ['application/pdf', 'image/*'] });
    expect(checkValue(upload, { name: 'a.zip', type: 'application/zip', size: 1 }, false, MESSAGES.ar)).toBe('يجب أن يكون العقد ملف PDF أو image');
  });

  it('gives every language every message, with only the placeholders English uses', async () => {
    const { MESSAGES } = await import('./messages');
    const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [locale, messages] of Object.entries(MESSAGES)) {
      expect({ locale, keys: Object.keys(messages).sort() }).toEqual({ locale, keys: Object.keys(MESSAGES.en).sort() });
      for (const [key, text] of Object.entries(messages)) {
        const allowed = new Set([...placeholders(MESSAGES.en[key as keyof typeof MESSAGES.en]), 'label', 'aTypes', 'aModels', 'types', 'models']);
        for (const used of placeholders(text)) expect({ locale, key, used, ok: allowed.has(used) }).toEqual({ locale, key, used, ok: true });
      }
    }
  });
});
