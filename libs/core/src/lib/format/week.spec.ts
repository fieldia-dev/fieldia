import { firstWeekday } from './week';

/** Each case run as the engine has it, then as an engine whose Intl has no week (Firefox's): CLDR's table. */
function bothWays(check: () => void) {
  check();
  const proto = Intl.Locale.prototype as unknown as Record<string, unknown>;
  const [getWeekInfo, weekInfo] = [Object.getOwnPropertyDescriptor(proto, 'getWeekInfo'), Object.getOwnPropertyDescriptor(proto, 'weekInfo')];
  delete proto['getWeekInfo'];
  delete proto['weekInfo'];
  try {
    check();
  } finally {
    if (getWeekInfo) Object.defineProperty(proto, 'getWeekInfo', getWeekInfo);
    if (weekInfo) Object.defineProperty(proto, 'weekInfo', weekInfo);
  }
}

const [SUNDAY, MONDAY, FRIDAY, SATURDAY] = [0, 1, 5, 6];

describe('the week’s first day: which region decides it', () => {
  it('a plain English page starts its week where its reader is: Cairo’s Saturday, London’s Monday, New York’s Sunday', () =>
    bothWays(() => {
      expect(firstWeekday('en', null, ['en-EG'])).toBe(SATURDAY);
      expect(firstWeekday('en', null, ['en-GB'])).toBe(MONDAY);
      expect(firstWeekday('en', null, ['en-US'])).toBe(SUNDAY);
      expect(firstWeekday('en', { language: 'en' }, ['en-EG', 'en'])).toBe(SATURDAY);
    }));

  it('the reader’s region only where the browser asks for the page’s language: the first that names one', () =>
    bothWays(() => {
      // An Egyptian reading English in an Arabic browser: their English names no region, so English's own, the United States'.
      expect(firstWeekday('en', null, ['ar-EG', 'en'])).toBe(SUNDAY);
      expect(firstWeekday('en', null, ['ar-EG', 'en', 'en-GB'])).toBe(MONDAY);
      expect(firstWeekday('en', null, [])).toBe(SUNDAY);
      // A reader's tag no engine reads is passed over.
      expect(firstWeekday('en', null, ['not a tag', 'en-GB'])).toBe(MONDAY);
    }));

  it('the page’s own region before the reader’s: en-GB starts on Monday wherever it is read', () =>
    bothWays(() => {
      expect(firstWeekday('en', { language: 'en-GB' }, ['en-EG'])).toBe(MONDAY);
      expect(firstWeekday('en', { language: 'en-US' }, ['en-GB'])).toBe(SUNDAY);
      expect(firstWeekday('en-GB', null, ['en-US'])).toBe(MONDAY);
      // A page shown in another language than its own: the language shown decides, its region not the page's.
      expect(firstWeekday('en', { language: 'ar-EG' }, ['en-GB'])).toBe(MONDAY);
    }));

  it('Persian and Arabic: their region, else the reader’s, else Iran’s and Egypt’s Saturday', () =>
    bothWays(() => {
      expect(firstWeekday('fa', null, [])).toBe(SATURDAY);
      expect(firstWeekday('fa', null, ['fa-AF'])).toBe(SATURDAY);
      expect(firstWeekday('fa', null, ['en-GB'])).toBe(SATURDAY);
      expect(firstWeekday('ar', null, [])).toBe(SATURDAY);
      expect(firstWeekday('ar', null, ['ar-SA'])).toBe(SUNDAY);
      expect(firstWeekday('ar', null, ['ar-MA'])).toBe(MONDAY);
      expect(firstWeekday('ar', { language: 'ar-AE' }, ['ar-SA'])).toBe(MONDAY);
      expect(firstWeekday('ar', null, ['en-US'])).toBe(SATURDAY);
    }));

  it('every other language the same way: Urdu’s Pakistan, Turkish’s Turkey, the Maldives’ Friday', () =>
    bothWays(() => {
      expect(['ur', 'tr', 'es', 'de', 'fr', 'dv'].map((tag) => firstWeekday(tag, null, []))).toEqual([SUNDAY, MONDAY, MONDAY, MONDAY, MONDAY, FRIDAY]);
      expect(firstWeekday('es', null, ['es-MX'])).toBe(SUNDAY);
      expect(firstWeekday('pt', null, ['pt-PT'])).toBe(SUNDAY);
      expect(firstWeekday('fr', null, ['fr-CA'])).toBe(SUNDAY);
    }));

  it('a tag no engine reads: Monday', () => bothWays(() => expect(firstWeekday('not a tag', null, ['en-US'])).toBe(MONDAY)));

  it('the reader is the browser’s own where none is given (navigator.languages)', () => {
    const reader = globalThis as { navigator?: unknown };
    const was = Object.getOwnPropertyDescriptor(reader, 'navigator');
    try {
      for (const [languages, day] of [
        [['en-EG', 'en'], SATURDAY],
        [['en-GB'], MONDAY],
        [['en-US'], SUNDAY],
      ] as const) {
        Object.defineProperty(reader, 'navigator', { value: { languages }, configurable: true });
        expect({ languages, day: firstWeekday('en') }).toEqual({ languages, day });
      }
      Object.defineProperty(reader, 'navigator', { value: undefined, configurable: true });
      expect(firstWeekday('en')).toBe(SUNDAY);
    } finally {
      if (was) Object.defineProperty(reader, 'navigator', was);
      else delete reader.navigator;
    }
  });
});
