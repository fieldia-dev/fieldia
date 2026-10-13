/** @jest-environment node */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { azureMaps } from './providers';
import { markSpellings, recorded, scoreCase, tally, type Answers, type CaseScore, type CorpusCase } from './test-address-corpus';

/**
 * Azure's suggestions in an address field, scored against what people in
 * Egypt, Saudi Arabia, the UAE and Jordan mean by them
 * (fixtures/azure-corpus-cases.json: 139 cases, English and Arabic; streets
 * with numbers and without, districts, cities): the row a person picks (one
 * named as the place, that says it is where they mean), the city and region
 * written (each spelled one way for every place of it, in each language),
 * the lines said with each place once, and where the place is (a street
 * within 1.5 km, a district within 4 km, a city within 15 km, or said to be
 * only near). Azure's answers are as it gave them live on 13 Oct 2026
 * (fixtures/azure-corpus-answers.json); a request Fieldia sends that is not
 * among them fails the case, so the answers stay the ones Fieldia asks for.
 *
 * Right in every way: 111 of the 139 now; 103 with this branch's round
 * before (b1a88d9, whose requests are answered here too: its
 * address-parts.ts and providers.ts against these files score it); 3 with
 * 0.19.0, whose requests were answered live the same day (196 more, not
 * kept). What is still wrong is in `STILL_WRONG`, each with what Azure
 * answers that makes it so.
 */

const CASES = (JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-corpus-cases.json'), 'utf8')) as { cases: CorpusCase[] }).cases;
const ANSWERS = (JSON.parse(readFileSync(join(__dirname, 'fixtures/azure-corpus-answers.json'), 'utf8')) as { answers: Answers }).answers;

/** What a case gets wrong, by name. */
const wrong = (score: CaseScore) => (['listed', 'rowCity', 'city', 'region', 'spelled', 'once', 'placed', 'honest', 'street'] as const).filter((test) => score[test] === false);

/** Nothing listed for the place meant: no row named as it, or every such row somewhere else. */
const UNLISTED = ['listed', 'rowCity', 'city', 'region', 'placed'];

/**
 * The cases still wrong, and what Azure answers that makes them so. A row
 * picked for another place of the name is placed as that place, precisely:
 * Fieldia cannot know the person meant another (`honest` then).
 */
const STILL_WRONG: Record<string, { wrong: string[]; why: string }> = {
  'eg-dokki-en': { wrong: UNLISTED, why: 'Azure’s English answer has no Dokki district: a bridge, a metro station, and lanes of the name in Suez' },
  'eg-shubra-en': { wrong: UNLISTED, why: 'Azure suggests no Cairo district Shubra: Shubra El Kheima, in Qalyubia, and villages of the name' },
  'eg-zayed-en': { wrong: UNLISTED, why: 'Azure’s one Sheikh Zayed City row says Cairo; the city is in Giza, as its Arabic answer says' },
  'eg-october-en': { wrong: UNLISTED, why: 'Azure suggests no 6th of October City for these words, only a street there and one named for the date' },
  'eg-alex-ar': { wrong: UNLISTED, why: 'Azure’s Arabic answer has no row for the city: a street of its name in Cairo, a lighthouse, institutes' },
  'eg-fouad-en': { wrong: UNLISTED, why: 'Azure suggests no Fouad Street, only others with Fouad in their names' },
  'eg-akkad-en': { wrong: UNLISTED, why: 'Azure suggests no Nasr City Abbas El Akkad Street: one in 6th of October, crossings, a school' },
  'eg-akkad-ar': { wrong: ['placed', 'honest'], why: 'Azure’s first Cairo row is another Abbas El Akkad Street, in Al Zafaran, not Nasr City’s' },
  'eg-road9-en': { wrong: UNLISTED, why: 'Azure suggests no Road 9 in Maadi, only other streets’ house 9' },
  'eg-gameat-en': { wrong: UNLISTED, why: 'Azure suggests nothing for these words' },
  'sa-malq-nonear-en': { wrong: UNLISTED, why: 'With no place to look near, Azure lists Qassim’s Al Malqa and a street of the name, not Riyadh’s district' },
  'sa-yasmin-ar': { wrong: ['city', 'placed', 'honest'], why: 'Azure ranks Al Wasiah’s الياسمين first near Riyadh, and suggests no Riyadh district of the name' },
  'sa-tahlia-jeddah-en': { wrong: UNLISTED, why: 'Near Jeddah, Azure suggests Riyadh’s, Abha’s and Dammam’s Tahlia streets, not Jeddah’s' },
  'sa-mecca-en': { wrong: UNLISTED, why: 'Azure’s English answer lists Mecca’s metro stations, not the city' },
  'ae-abudhabi-ar': { wrong: UNLISTED, why: 'Azure’s Arabic answer has no row for the city: a university, its paths, an industrial town' },
  'ae-jimi-en': { wrong: ['rowCity'], why: 'Azure files Al Ain’s quarters under the emirate alone: the row cannot say Al Ain; the place found does' },
  'jo-rainbow-en': { wrong: UNLISTED, why: 'Azure suggests nothing for these words' },
  'jo-shmeisani-en': { wrong: UNLISTED, why: 'Azure suggests nothing for these words' },
  'eg-mahmoud-en': { wrong: ['placed', 'honest'], why: 'Azure’s first Cairo row is a Mohamed Mahmoud Street in Dar El Salam, not Downtown’s' },
  'eg-mahmoud-ar': { wrong: UNLISTED, why: 'Azure suggests شارع محمد محمود in Giza only, not Downtown Cairo’s' },
  'eg-corniche-alex-en': { wrong: UNLISTED, why: 'Azure suggests nothing for these words' },
  'ae-corniche-ad-en': { wrong: UNLISTED, why: 'Azure suggests nothing for these words' },
  'jo-zahran-en': { wrong: UNLISTED, why: 'Azure suggests Khalil Zahran Street, in Sweileh, not Zahran Street' },
  'jo-zahran-ar': { wrong: UNLISTED, why: 'Azure suggests شارع خليل زهران, in Sweileh, not Zahran Street' },
  'ae-majaz-ar': { wrong: UNLISTED, why: 'Azure’s Arabic answer has no Al Majaz district, only numbered streets of other districts' },
  'sa-rayan-ar': { wrong: UNLISTED, why: 'Azure’s one الريان row is Madinah’s, not Riyadh’s district' },
  'sa-quds-ar': { wrong: ['city', 'placed', 'honest'], why: 'Azure’s القدس is a village in Al Ruwaydah’s governorate (its row says so), and it lists no Riyadh district of the name' },
  'sa-woroud-en': { wrong: ['city', 'placed', 'honest'], why: 'Azure’s Al Wurud rows are Al Kharj’s and Al Hofuf’s; it spells Riyadh’s district Al Woroud' },
};

describe('Azure’s suggestions in an address field, scored against what people mean', () => {
  let scores: CaseScore[];
  let asked: string[];
  let unanswered: string[];
  const of = (id: string) => scores.find((score) => score.id === id)!;
  beforeAll(async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const live = recorded(ANSWERS);
    const maps = azureMaps({ key: 'K', fetch: live.fetch });
    const each: CaseScore[] = [];
    for (const one of CASES) each.push(await scoreCase(maps, one));
    scores = markSpellings(each);
    ({ asked, unanswered } = live);
    warn.mockRestore();
  });

  it('asks Azure only what was asked of it live, so each case is scored on Azure’s own answer', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(100);
    expect(unanswered).toEqual([]);
  });

  it('gets 111 of the 139 right in every way: the row, its city and region spelled one way, each place said once, the place within reach (103 before)', () => {
    expect(tally(scores)).toEqual({ cases: 139, listed: 117, rowCity: 116, city: 114, region: 117, spelled: 139, once: 139, placed: 112, honest: 134, street: '3/3', allRight: 111 });
  });

  it('gets each other case wrong only as Azure’s answer makes it', () => {
    const wrongs = Object.fromEntries(scores.map((score) => [score.id, wrong(score)]).filter(([, tests]) => tests.length));
    expect(wrongs).toEqual(Object.fromEntries(Object.entries(STILL_WRONG).map(([id, { wrong: tests }]) => [id, tests])));
  });

  it('never says a place is exact where it is not, but for a row of another place of the name, placed as that place', () => {
    const misplaced = scores.filter((score) => !score.honest).map((score) => score.id);
    expect(misplaced.every((id) => STILL_WRONG[id]?.wrong.includes('honest'))).toBe(true);
  });

  it('spells a region and a city one way in each language, whichever of its names Azure gives it ("Sharjah Emirate", "Ash Shāriqah"; "منطقة الرياض", "الرياض")', () => {
    const spellings = new Map<string, Set<string>>();
    for (const score of scores.filter((one) => one.region && one.city)) {
      for (const [what, name] of [
        [`region ${score.of.region} ${score.of.locale}`, score.parts?.region],
        [`city ${score.of.city} ${score.of.locale}`, score.parts?.city],
      ]) spellings.set(what!, (spellings.get(what!) ?? new Set()).add(name!));
    }
    const several = [...spellings].filter(([, names]) => names.size > 1).map(([what, names]) => `${what}: ${[...names].join(' / ')}`);
    expect(several).toEqual([]);
    expect(['ae-sharjah-en', 'ae-majaz-en', 'ae-qasimia-en'].map((id) => of(id).parts?.region)).toEqual(['Sharjah', 'Sharjah', 'Sharjah']);
    expect(['ae-sharjah-ar', 'sa-olaya-ar', 'sa-rawdah-ar'].map((id) => [of(id).parts?.city, of(id).parts?.region])).toEqual([
      ['الشارقة', 'الشارقة'],
      ['الرياض', 'الرياض'],
      ['الرياض', 'الرياض'],
    ]);
  });

  it('asks for every kind of place but a postcode alone, for an address field', () => {
    const suggestions = asked.filter((request) => request.startsWith('/geocode:autocomplete'));
    expect(suggestions.length).toBeGreaterThan(100);
    expect(suggestions.every((request) => request.includes('resultTypes=(all but Postcode1)'))).toBe(true);
  });

  it('asks Azure’s geocoding by a suggestion’s own parts, in its structured form; by its two lines a place with a name of its own, or one its parts do not find', () => {
    const geocoding = asked.filter((request) => request.startsWith('/geocode?'));
    expect(of('sa-rawdah-en').km).toBeLessThan(1);
    expect(geocoding.filter((request) => /[?&]query=/.test(request)).length).toBeLessThan(geocoding.filter((request) => /[?&]locality=|[?&]adminDistrict=/.test(request)).length);
  });

  it('writes Riyadh’s districts in Riyadh, and says so in the row (Al Rawdah, Al Quds, النهضة: villages of the name elsewhere were taken before)', () => {
    for (const id of ['sa-rawdah-en', 'sa-rawdah-ar', 'sa-quds-en', 'sa-nahdah-ar']) expect([id, of(id).rowCity, of(id).city, of(id).placed, of(id).precise]).toEqual([id, true, true, true, undefined]);
  });

  it('writes Cairo’s districts as Cairo’s, never as a city of their own (El Zamalek, مدينة نصر)', () => {
    for (const id of ['eg-zamalek-en', 'eg-zamalek-ar', 'eg-nasr-ar', 'eg-maadi-en']) expect(of(id).parts?.city).toMatch(/^(Cairo|القاهرة)$/);
  });

  it('never makes a house number of a street’s own number, in either digits (شارع 26 يوليو, شارع ٢٦ يوليو)', () => {
    expect(['eg-26july-en', 'eg-26july-ar', 'eg-26july-ar-digits'].map((id) => of(id).parts?.street)).toEqual(['26 July Street', 'شارع 26 يوليو', 'شارع 26 يوليو']);
  });

  it('says the district of a street named by its number, which Azure gives only in its line, and places it there: never at another district’s street of the number', () => {
    // "8 | البطين": Azure's geocoding finds 8 Streets in four other districts, and Al Ain's Al Bateen before Abu Dhabi's.
    expect([of('ae-bateen-8-ar').row, of('ae-bateen-8-ar').placed, of('ae-bateen-8-ar').precise]).toEqual(['8 | البطين، أبوظبي، الإمارات العربية المتحدة', true, false]);
    // "12 | الخالدية": Azure's one 12 is Al Manhal's; Al Khalidiyah is found instead, and said to be only near.
    expect([of('ae-khalidiyah-12-ar').placed, of('ae-khalidiyah-12-ar').precise]).toEqual([true, false]);
    // "شارع 6 | الخالدية": of Azure's five, Al Khalidiyah's own.
    expect([of('ae-khalidiyah-6-ar').placed, of('ae-khalidiyah-6-ar').precise]).toEqual([true, undefined]);
  });
});
