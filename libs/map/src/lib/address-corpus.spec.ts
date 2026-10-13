/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { azureMaps } from './providers';
import { scoreCase, tally, type CaseScore, type CorpusCase } from './test-address-corpus';

/**
 * Azure's suggestions in an address field, scored against what people in
 * Egypt, Saudi Arabia, the UAE and Jordan mean by them
 * (fixtures/azure-corpus-cases.json: 102 cases, English and Arabic; streets
 * with numbers and without, districts, cities): the row a person picks, the
 * city and region written, and where the place is (a street within 1.5 km,
 * a district within 4 km, a city within 15 km, or said to be only near).
 * Azure's answers are as it gave them live on 13 Oct 2026
 * (fixtures/azure-corpus-answers.json); a request Fieldia sends that is not
 * among them fails the case, so the answers stay the ones Fieldia asks for.
 *
 * Before Azure's own structure was read (0.19.0's guesses at names), 63 of
 * the 102 were right in every way; now 84. What is still wrong is Azure's:
 * the place meant is not among its suggestions, or it files a town in
 * another governorate.
 */

const CASES = (JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-corpus-cases.json'), 'utf8')) as { cases: CorpusCase[] }).cases;
const ANSWERS = (JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-corpus-answers.json'), 'utf8')) as { answers: Record<string, { status: number; body: unknown }> }).answers;

/** The address field's kinds of place: every one Azure's autocomplete knows but a postcode alone. */
const ADDRESS_TYPES = 129;

/** A request as the answers name it: its path, its parameters in order (numbers as numbers), the key left out, the address field's types said short; and its language. */
function said(url: string, language: string) {
  const at = new URL(url);
  const params = [...at.searchParams.entries()]
    .filter(([key]) => key !== 'subscription-key')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => {
      if (key === 'resultTypes') {
        const names = value.split(',');
        return `${key}=${!names.includes('Postcode1') && names.length === ADDRESS_TYPES ? '(all but Postcode1)' : value}`;
      }
      return `${key}=${/^-?[\d.]+(,-?[\d.]+)*$/.test(value) ? value.split(',').map(Number).join(',') : value}`;
    });
  return `${at.pathname}?${params.join('&')} ${language}`;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Azure as it answered: each recorded answer given back to the very request; any other, refused and noted. */
function azure() {
  const unanswered: string[] = [];
  const asked: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = said(String(input), (init?.headers as Record<string, string> | undefined)?.['Accept-Language'] ?? '');
    asked.push(request);
    const answer = ANSWERS[request];
    if (answer) return json(answer.status, answer.body);
    unanswered.push(request);
    return json(404, { error: { message: `not recorded: ${request}` } });
  }) as typeof globalThis.fetch;
  return { fetch, asked, unanswered };
}

/** What a case gets wrong, by name. */
const wrong = (score: CaseScore) =>
  (['listed', 'rowCity', 'city', 'region', 'placed', 'honest', 'street'] as const).filter((test) => score[test] === false);

/**
 * The cases still wrong, and what Azure answers that makes them so. A row
 * picked for another place of the name is placed as that place, precisely:
 * Fieldia cannot know the person meant another (`honest` then).
 */
const STILL_WRONG: Record<string, { wrong: string[]; why: string }> = {
  'eg-zayed-en': { wrong: ['city', 'region'], why: 'Azure files Sheikh Zayed City under Cairo alone (it is in Giza); its Arabic answer is right' },
  'eg-october-en': { wrong: ['city', 'region', 'placed'], why: 'Azure suggests no 6th of October City for these words, only a street named for the date' },
  'eg-akkad-ar': { wrong: ['placed', 'honest'], why: 'Azure’s first Cairo row is another Abbas El Akkad Street, in Al Zafaran, not Nasr City’s' },
  'eg-road9-en': { wrong: ['placed'], why: 'Azure suggests no Road 9 in Maadi, only other streets’ house 9 (near, said so)' },
  'eg-road9-ar': { wrong: ['placed'], why: 'Azure suggests no Road 9 in Maadi, only other streets’ house 9 (near, said so)' },
  'eg-gameat-en': { wrong: ['listed', 'rowCity', 'city', 'region', 'placed'], why: 'Azure suggests nothing for these words' },
  'eg-mahmoud-en': { wrong: ['placed', 'honest'], why: 'Azure suggests a Mohamed Mahmoud Street in Dar El Salam, not Downtown’s' },
  'eg-mahmoud-ar': { wrong: ['rowCity', 'city', 'region', 'placed', 'honest'], why: 'Azure suggests a شارع محمد محمود in Giza, not Downtown Cairo’s' },
  'eg-corniche-alex-en': { wrong: ['listed', 'rowCity', 'city', 'region', 'placed'], why: 'Azure suggests nothing for these words' },
  'sa-malq-nonear-en': { wrong: ['placed', 'honest'], why: 'With no place to look near, Azure ranks Qassim’s Al Malqa and a street of the name before Riyadh’s district' },
  'sa-yasmin-ar': { wrong: ['city', 'placed', 'honest'], why: 'Azure ranks Al Wasiah’s الياسمين first near Riyadh, and suggests no Riyadh district of the name' },
  'sa-tahlia-jeddah-en': { wrong: ['rowCity', 'city', 'region', 'placed', 'honest'], why: 'Near Jeddah, Azure suggests Riyadh’s, Abha’s and Dammam’s Tahlia streets, not Jeddah’s' },
  'ae-jimi-en': { wrong: ['rowCity'], why: 'Azure files Al Ain’s quarters under the emirate alone: the row cannot say Al Ain; the place found does' },
  'ae-corniche-ad-en': { wrong: ['listed', 'rowCity', 'city', 'region', 'placed'], why: 'Azure suggests nothing for these words' },
  'jo-rainbow-en': { wrong: ['listed', 'rowCity', 'city', 'region', 'placed'], why: 'Azure suggests nothing for these words' },
  'jo-shmeisani-en': { wrong: ['listed', 'rowCity', 'city', 'region', 'placed'], why: 'Azure suggests nothing for these words' },
  'jo-zahran-en': { wrong: ['placed'], why: 'Azure suggests Khalil Zahran Street, in Sweileh, not Zahran Street (near, said so)' },
  'jo-zahran-ar': { wrong: ['placed', 'honest'], why: 'Azure suggests شارع خليل زهران, in Sweileh, not Zahran Street' },
};

describe('Azure’s suggestions in an address field, scored against what people mean', () => {
  let scores: CaseScore[];
  let asked: string[];
  let unanswered: string[];
  beforeAll(async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const live = azure();
    const maps = azureMaps({ key: 'K', fetch: live.fetch });
    scores = [];
    for (const one of CASES) scores.push(await scoreCase(maps, one));
    ({ asked, unanswered } = live);
    warn.mockRestore();
  });

  it('asks Azure only what was asked of it live, so each case is scored on Azure’s own answer', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(100);
    expect(unanswered).toEqual([]);
  });

  it('gets 84 of the 102 right in every way: the row, its city and region, and the place within reach (63 before)', () => {
    expect(tally(scores)).toEqual({ cases: 102, listed: 97, rowCity: 94, city: 92, region: 93, placed: 86, honest: 95, street: '3/3', allRight: 84 });
  });

  it('gets each other case wrong only as Azure’s answer makes it', () => {
    const wrongs = Object.fromEntries(scores.map((score) => [score.id, wrong(score)]).filter(([, tests]) => tests.length));
    expect(wrongs).toEqual(Object.fromEntries(Object.entries(STILL_WRONG).map(([id, { wrong: tests }]) => [id, tests])));
  });

  it('never says a place is exact where it is not, but for a row of another place of the name, placed as that place', () => {
    const misplaced = scores.filter((score) => !score.honest).map((score) => score.id);
    expect(misplaced.every((id) => STILL_WRONG[id]?.wrong.includes('honest'))).toBe(true);
  });

  it('asks for every kind of place but a postcode alone, for an address field', () => {
    const suggestions = asked.filter((request) => request.startsWith('/geocode:autocomplete'));
    expect(suggestions.length).toBeGreaterThan(100);
    expect(suggestions.every((request) => request.includes('resultTypes=(all but Postcode1)'))).toBe(true);
  });

  it('asks Azure’s geocoding by a suggestion’s own parts, in its structured form; by its two lines a place with a name of its own, or one its parts do not find', () => {
    const geocoding = asked.filter((request) => request.startsWith('/geocode?'));
    const first = (id: string) => scores.find((score) => score.id === id);
    expect(first('sa-rawdah-en')?.km).toBeLessThan(1);
    // A place with a name of its own, or a neighbourhood its locality does not name, by its two lines; the others by their parts.
    expect(geocoding.filter((request) => /[?&]query=/.test(request)).length).toBeLessThan(geocoding.filter((request) => /[?&]locality=|[?&]adminDistrict=/.test(request)).length);
  });

  it('writes Riyadh’s districts in Riyadh, and says so in the row (Al Rawdah, Al Quds, النهضة: villages of the name elsewhere were taken before)', () => {
    for (const id of ['sa-rawdah-en', 'sa-rawdah-ar', 'sa-quds-en', 'sa-nahdah-ar']) {
      const score = scores.find((one) => one.id === id)!;
      expect([id, score.rowCity, score.city, score.placed, score.precise]).toEqual([id, true, true, true, undefined]);
    }
  });

  it('writes Cairo’s districts as Cairo’s, never as a city of their own (El Zamalek, مدينة نصر)', () => {
    for (const id of ['eg-zamalek-en', 'eg-zamalek-ar', 'eg-nasr-ar', 'eg-maadi-en']) expect(scores.find((one) => one.id === id)?.parts?.city).toMatch(/^(Cairo|القاهرة)$/);
  });

  it('never makes a house number of a street’s own number, in either digits (شارع 26 يوليو, شارع ٢٦ يوليو)', () => {
    expect(['eg-26july-en', 'eg-26july-ar', 'eg-26july-ar-digits'].map((id) => scores.find((one) => one.id === id)?.parts?.street)).toEqual(['26 July Street', 'شارع 26 يوليو', 'شارع 26 يوليو']);
  });
});
