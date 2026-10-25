import { intlFormat } from './intl-format';

describe('intlFormat', () => {
  it('gives the same formatter for the same kind, language and options, and writes as Intl does', () => {
    const one = intlFormat('NumberFormat', 'de', { minimumFractionDigits: 2 });
    expect(intlFormat('NumberFormat', 'de', { minimumFractionDigits: 2 })).toBe(one);
    expect(one.format(1234.5)).toBe(new Intl.NumberFormat('de', { minimumFractionDigits: 2 }).format(1234.5));
    expect(intlFormat('NumberFormat', 'de', { minimumFractionDigits: 3 })).not.toBe(one);
    expect(intlFormat('NumberFormat', 'fr', { minimumFractionDigits: 2 })).not.toBe(one);
    expect(intlFormat('DateTimeFormat', 'de', { minimumFractionDigits: 2 } as Intl.DateTimeFormatOptions)).not.toBe(one);
    // No language is the browser's, and not an empty one.
    expect(intlFormat('DateTimeFormat').resolvedOptions().locale).toBe(new Intl.DateTimeFormat().resolvedOptions().locale);
    expect(() => intlFormat('DateTimeFormat', '')).toThrow(RangeError);
  });

  it('makes each kind, a list of languages too', () => {
    expect(intlFormat('PluralRules', 'en').select(1)).toBe('one');
    expect(intlFormat('ListFormat', 'en', { type: 'conjunction' }).format(['a', 'b', 'c'])).toBe('a, b, and c');
    expect(intlFormat('DisplayNames', ['en'], { type: 'region' }).of('EG')).toBe('Egypt');
    expect(intlFormat('RelativeTimeFormat', 'en', { numeric: 'always' }).format(-1, 'day')).toBe('1 day ago');
    expect(intlFormat('Collator', 'en', { numeric: true }).compare('a2', 'a10')).toBe(-1);
  });

  it('makes its own with a constructor put in Intl\'s place (a polyfill), and none where the browser has none', () => {
    const real = Intl.DisplayNames;
    const before = intlFormat('DisplayNames', ['en'], { type: 'language' });
    class Polyfill extends real {}
    (Intl as { DisplayNames?: unknown }).DisplayNames = Polyfill;
    try {
      expect(intlFormat('DisplayNames', ['en'], { type: 'language' })).toBeInstanceOf(Polyfill);
      (Intl as { DisplayNames?: unknown }).DisplayNames = undefined;
      expect(() => intlFormat('DisplayNames', ['en'], { type: 'language' })).toThrow(TypeError);
    } finally {
      (Intl as { DisplayNames?: unknown }).DisplayNames = real;
    }
    expect(intlFormat('DisplayNames', ['en'], { type: 'language' })).toBe(before);
  });

  it('throws as Intl does for what it refuses, every time, keeping nothing for it', () => {
    expect(() => intlFormat('DateTimeFormat', 'en', { timeZone: 'Nowhere/Never' })).toThrow(RangeError);
    expect(() => intlFormat('DateTimeFormat', 'en', { timeZone: 'Nowhere/Never' })).toThrow(RangeError);
    expect(() => intlFormat('NumberFormat', 'en', { style: 'currency', currency: 'not a code' })).toThrow(RangeError);
  });
});
