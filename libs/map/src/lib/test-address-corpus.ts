import type { Locale } from '@fieldia/core';
import type { AddressParts } from './address-parts';
import type { MapProvider, PlaceFound } from './providers';

/**
 * Scores an address search against what people mean
 * (fixtures/azure-corpus-cases.json): the row a person would pick, as an
 * address field lists them; the city and region it writes, each spelled as
 * it is for every other place of that city or region in that language; the
 * line it writes, each place named once; and whether the place it writes is
 * where the place is: a street within 1.5 km, a district within 4 km, a
 * city within 15 km, or said to be only near (`precise: false`), or not
 * written at all, when it is not.
 *
 * The row a person picks is one named as the place (its name, in any of its
 * spellings, the article aside: "El Zamalek" for Zamalek, never "El Dokki
 * Bridge" for Dokki nor "Fouad El Khateib Street" for Fouad Street), and of
 * those the first whose second line says it is where they mean; else the
 * first that says it is nowhere else. None, when every row named so is
 * somewhere else: the person types on.
 */

export type Kind = 'street' | 'district' | 'city';
type At = [number, number];

export interface CorpusCase {
  id: string;
  text: string;
  locale: Locale;
  near?: string;
  countries: string[];
  /**
   * The names the row's own line may have, and where its second line says it
   * is when several share them (a district, a city); `first`: the first row
   * so named that does not say it is elsewhere, as a person picks one whose
   * line says only its country.
   */
  pick: { names: string[]; in?: string; first?: boolean };
  kind: Kind;
  truth: { city: string; region: string; street?: string[]; at: At | At[] };
}

/** Where an address field's `near` puts the search, by name. */
export const NEAR: Record<string, { lat: number; lng: number }> = {
  cairo: { lat: 30.0444, lng: 31.2357 },
  alexandria: { lat: 31.2001, lng: 29.9187 },
  riyadh: { lat: 24.7136, lng: 46.6753 },
  jeddah: { lat: 21.4858, lng: 39.1925 },
  dubai: { lat: 25.2048, lng: 55.2708 },
  abuDhabi: { lat: 24.4539, lng: 54.3773 },
  sharjah: { lat: 25.3463, lng: 55.4209 },
  alAin: { lat: 24.2075, lng: 55.7447 },
  amman: { lat: 31.9539, lng: 35.9106 },
};

/** The names a city or region goes by, in English and Arabic, as a person or a provider may write it. */
export const NAMES: Record<string, string[]> = {
  cairo: ['Cairo', 'Cairo Governorate', 'Al Qahirah', 'القاهرة', 'محافظة القاهرة'],
  giza: ['Giza', 'Al Jizah', 'Giza Governorate', 'Gizeh', 'الجيزة', 'محافظة الجيزة'],
  newCairo: ['New Cairo', 'New Cairo City', 'Al Qahirah al Jadidah', 'القاهرة الجديدة', 'مدينة القاهرة الجديدة'],
  sheikhZayed: ['Sheikh Zayed', 'Sheikh Zayed City', 'El Sheikh Zayed', 'El Sheikh Zaid', 'El Sheikh Zayed City', 'الشيخ زايد', 'مدينة الشيخ زايد'],
  october: ['6th of October', '6th of October City', '6 October', '6th October', 'Sixth of October', 'السادس من أكتوبر', '6 أكتوبر', 'أكتوبر 6', 'مدينة 6 أكتوبر', 'مدينة السادس من أكتوبر'],
  alexandria: ['Alexandria', 'Al Iskandariyah', 'Alexandria Governorate', 'الإسكندرية', 'الاسكندرية', 'الأسكندرية', 'محافظة الإسكندرية'],
  riyadh: ['Riyadh', 'Ar Riyad', 'Riyadh Province', 'Riyadh Region', 'الرياض', 'منطقة الرياض'],
  jeddah: ['Jeddah', 'Jiddah', 'Jedda', 'جدة'],
  mecca: ['Mecca', 'Makkah', 'Makkah Al Mukarramah', 'مكة', 'مكة المكرمة'],
  makkah: ['Makkah', 'Mecca', 'Makkah Province', 'Makkah Region', 'Makkah Al Mukarramah', 'مكة', 'مكة المكرمة', 'منطقة مكة المكرمة'],
  dammam: ['Dammam', 'Ad Dammam', 'الدمام'],
  khobar: ['Al Khobar', 'Al Khubar', 'Khobar', 'الخبر'],
  eastern: ['Eastern', 'Eastern Province', 'Eastern Region', 'Ash Sharqiyah', 'الشرقية', 'المنطقة الشرقية'],
  dubai: ['Dubai', 'Dubai Emirate', 'دبي', 'إمارة دبي'],
  abuDhabi: ['Abu Dhabi', 'Abu Dhabi Emirate', 'Abu Zabi', 'أبو ظبي', 'أبوظبي', 'إمارة أبو ظبي', 'إمارة أبوظبي'],
  sharjah: ['Sharjah', 'Sharjah Emirate', 'Ash Shariqah', 'الشارقة', 'إمارة الشارقة', 'مدينة الشارقة'],
  alAin: ['Al Ain', 'Al Ayn', 'العين'],
  amman: ['Amman', 'Amman Governorate', 'Capital Governorate', 'عمان', 'عمّان', 'محافظة العاصمة', 'العاصمة'],
  mansoura: ['Mansoura', 'El Mansoura', 'Al Mansurah', 'المنصورة'],
  dakahlia: ['Dakahlia', 'Ad Daqahliyah', 'الدقهلية'],
  tanta: ['Tanta', 'طنطا'],
  gharbia: ['Gharbia', 'Al Gharbiyah', 'الغربية'],
  sohag: ['Sohag', 'Sawhaj', 'Suhaj', 'سوهاج'],
  zagazig: ['Zagazig', 'El Zaqaziq', 'Az Zaqaziq', 'الزقازيق'],
  sharqia: ['Sharqia', 'Sharkia', 'Ash Sharqiyah', 'الشرقية'],
  kharga: ['Kharga', 'El Kharga', 'Al Kharijah', 'الخارجة'],
  newValley: ['New Valley', 'Al Wadi al Jadid', 'الوادي الجديد'],
};

/** How near counts as there, by kind. */
export const WITHIN_KM: Record<Kind, number> = { street: 1.5, district: 4, city: 15 };

/** Words as compared here: without accents, vowel marks and tatweel, Arabic's alif, ta marbuta and ya each one letter, digits as numbers. */
export const plain = (words: unknown) =>
  String(words ?? '')
    .normalize('NFD')
    .replace(/[\p{M}ـ]/gu, '')
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** The articles a name is written with or without ("El Zamalek", "Zamalek"; "الزمالك"): left out where names are compared. */
const ARTICLES = new Set(['al', 'el', 'ad', 'ar', 'as', 'ash', 'at', 'az', 'an']);
export const bare = (words: unknown) =>
  plain(words)
    .split(' ')
    .filter((word) => !ARTICLES.has(word))
    .map((word) => (word.length > 3 && word.startsWith('ال') ? word.slice(2) : word))
    .join(' ');

const RADIUS = 6371;
const rad = (d: number) => (d * Math.PI) / 180;
function km([lat1, lng1]: At, [lat2, lng2]: At) {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * RADIUS * Math.asin(Math.sqrt(a));
}
/** How far a point is from a place: a point, or the nearest stretch of a road's line. */
export function kmFrom(point: At, at: At | At[]): number {
  if (typeof at[0] === 'number') return km(point, at as At);
  const line = at as At[];
  if (line.length === 1) return km(point, line[0]);
  let best = Infinity;
  for (let i = 1; i < line.length; i++) {
    const [a, b] = [line[i - 1], line[i]];
    // On a plane around the point: a few km of road is flat enough.
    const k = Math.cos(rad(point[0]));
    const [ax, ay, bx, by, px, py] = [a[1] * k, a[0], b[1] * k, b[0], point[1] * k, point[0]];
    const len = (bx - ax) ** 2 + (by - ay) ** 2;
    const t = len ? Math.max(0, Math.min(1, ((px - ax) * (bx - ax) + (py - ay) * (by - ay)) / len)) : 0;
    best = Math.min(best, km(point, [ay + t * (by - ay), (ax + t * (bx - ax)) / k]));
  }
  return best;
}

export interface Located {
  lat: number;
  lng: number;
  address?: string;
  parts?: AddressParts;
  precise?: false;
}

export interface CaseScore {
  id: string;
  /** A row named as the place meant is listed (and picked). */
  listed: boolean;
  /** The row picked says it is where the person means (the district or city), so they can tell it from the others of the name. */
  rowCity: boolean;
  city: boolean;
  region: boolean;
  /** The city and region spelled as every other case of that city or region in this language has them ("Riyadh", never "Riyadh" here and "Riyadh Region" there). */
  spelled: boolean;
  /** No place named twice, in the row or in the address written ("Giza, Al Jizah", "Cairo، القاهرة"). */
  once: boolean;
  /** The street as it is written, where the case says it, never with a house number made up. */
  street?: boolean;
  /** Where it is, within the kind's distance. */
  placed: boolean;
  /** Placed, or said to be only near, or not written: never a wrong place said to be right. */
  honest: boolean;
  /** What was picked and written, to read. */
  row?: string;
  address?: string;
  parts?: AddressParts;
  km?: number;
  precise?: false;
  error?: string;
  /** What spellings are compared by: the truth's city and region, in this language. */
  of: { city: string; region: string; locale: Locale };
}

const isName = (key: string, value: unknown) => !!value && (NAMES[key] ?? [key]).some((name) => plain(name) === plain(value));
/** Whether a line names a place, as whole words. */
const says = (line: string, name: string) => ` ${bare(line)} `.includes(` ${bare(name)} `);
const names = (key: string, line: string) => (NAMES[key] ?? [key]).some((name) => says(line, name));

/** Whether a line names a city or region of the corpus other than these, by a name none of these goes by ("Makkah" is Mecca's and its region's both). */
function namesOther(keys: string[], line: string) {
  const own = new Set(keys.flatMap((key) => (NAMES[key] ?? [key]).map(bare)));
  return Object.keys(NAMES).some((key) => !keys.includes(key) && NAMES[key].some((name) => !own.has(bare(name)) && says(line, name)));
}

/** The corpus's countries, as a row's second line may end. */
const COUNTRIES = ['Egypt', 'مصر', 'Saudi Arabia', 'المملكة العربية السعودية', 'السعودية', 'United Arab Emirates', 'الإمارات العربية المتحدة', 'Jordan', 'الأردن'];

/** Whether a row's second line says nothing but its country, a postcode, or the places meant: a row that says it is nowhere else. */
function saysNowhereElse(keys: string[], detail: string | undefined) {
  return (detail ?? '')
    .split(/[,،]/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .every((piece) => /^\d[\d\s-]*$/.test(piece) || COUNTRIES.some((country) => plain(country) === plain(piece)) || keys.some((key) => isName(key, piece)));
}

/** Whether a row's own line is one of the place's names, the article aside. */
const named = (place: PlaceFound, c: Pick<CorpusCase, 'pick'>) => c.pick.names.some((name) => bare(place.label) === bare(name));

/**
 * The row a person would pick: one named as the place, and of those the
 * first whose second line says it is where they mean (`in`, or the city
 * they mean), or that is that city itself, nowhere else; else the first
 * named so that says nothing but its country (`there` false then).
 */
export function pickRow(found: PlaceFound[], c: Pick<CorpusCase, 'pick' | 'truth'>): { row: PlaceFound; there: boolean } | undefined {
  const { pick, truth } = c;
  const matching = found.filter((place) => named(place, c));
  const keys = [truth.city, truth.region];
  const there = pick.in
    ? (place: PlaceFound) => says(place.detail ?? '', pick.in!)
    : (place: PlaceFound) => names(truth.city, place.detail ?? '') || (isName(truth.city, place.label) && !namesOther(keys, place.detail ?? ''));
  if (pick.first) {
    const first = matching.find((place) => there(place) || saysNowhereElse(keys, place.detail));
    return first && { row: first, there: there(first) };
  }
  const right = matching.find(there);
  if (right) return { row: right, there: true };
  const unsaid = matching.find((place) => saysNowhereElse(keys, place.detail));
  return unsaid && { row: unsaid, there: false };
}

/** Whether a line names one corpus place in two of its pieces ("Giza, Al Jizah"): each piece compared whole. */
function twice(line: string | undefined) {
  const pieces = (line ?? '').split(/[,،|]/).map((piece) => piece.trim()).filter(Boolean);
  return Object.keys(NAMES).some((key) => pieces.filter((piece) => isName(key, piece)).length > 1);
}

/** One case: searched as an address field searches (its parts asked for, addresses first), its row picked and located. */
export async function scoreCase(provider: MapProvider, c: CorpusCase): Promise<CaseScore> {
  const of = { city: c.truth.city, region: c.truth.region, locale: c.locale };
  const none: CaseScore = { id: c.id, listed: false, rowCity: false, city: false, region: false, spelled: true, once: true, placed: false, honest: true, ...(c.truth.street ? { street: false } : {}), of };
  let found: PlaceFound[];
  try {
    found = await provider.search!({ text: c.text, near: c.near ? NEAR[c.near] : undefined, locale: c.locale, countries: c.countries, parts: true, addresses: true });
  } catch (e) {
    return { ...none, error: (e as Error).message };
  }
  const picked = pickRow(found, c);
  if (!picked) return none;
  const { row, there } = picked;
  let located: Located | null = null;
  let error: string | undefined;
  if (row.lat !== undefined && row.lng !== undefined) located = { lat: row.lat, lng: row.lng };
  else if (row.locate) {
    try {
      located = await row.locate();
    } catch (e) {
      error = (e as Error).message;
    }
  }
  const parts = located?.parts ?? row.parts;
  const distance = located ? kmFrom([located.lat, located.lng], c.truth.at) : undefined;
  const placed = distance !== undefined && distance <= WITHIN_KM[c.kind];
  const shown = [row.label, row.detail].filter(Boolean).join(' | ');
  return {
    id: c.id,
    listed: true,
    rowCity: there,
    city: isName(c.truth.city, parts?.city),
    region: isName(c.truth.region, parts?.region),
    spelled: true,
    once: !twice(shown) && !twice(located?.address),
    ...(c.truth.street ? { street: c.truth.street.some((name) => plain(name) === plain(parts?.street)) } : {}),
    placed,
    honest: placed || !located || located.precise === false,
    row: shown,
    ...(located?.address ? { address: located.address } : {}),
    ...(parts ? { parts } : {}),
    ...(distance !== undefined ? { km: Math.round(distance * 100) / 100 } : {}),
    ...(located?.precise === false ? { precise: false as const } : {}),
    ...(error ? { error } : {}),
    of,
  };
}

/**
 * Each case's city and region checked against how the others of the same
 * place, in the same language, spell it: the spelling most of them write
 * (the first, between as many) is the place's; a case that writes another
 * is not `spelled`. Only right names are compared.
 */
export function markSpellings(scores: CaseScore[]): CaseScore[] {
  const most = (pick: (s: CaseScore) => string | undefined, key: (s: CaseScore) => string, right: (s: CaseScore) => boolean) => {
    const counts = new Map<string, Map<string, number>>();
    for (const s of scores.filter(right)) {
      const spelling = pick(s) ?? '';
      const of = counts.get(key(s)) ?? new Map<string, number>();
      of.set(spelling, (of.get(spelling) ?? 0) + 1);
      counts.set(key(s), of);
    }
    return (s: CaseScore) => {
      if (!right(s)) return true;
      const of = [...(counts.get(key(s)) ?? new Map<string, number>()).entries()];
      const top = of.reduce((best, one) => (one[1] > best[1] ? one : best), of[0]);
      return pick(s) === top[0];
    };
  };
  const city = most((s) => s.parts?.city, (s) => `${s.of.city} ${s.of.locale}`, (s) => s.city);
  const region = most((s) => s.parts?.region, (s) => `${s.of.region} ${s.of.locale}`, (s) => s.region);
  return scores.map((s) => ({ ...s, spelled: city(s) && region(s) }));
}

/** Right in every way: the row, its city and region (spelled as the others), the line said once, the street as written, the place within reach. */
export const allRight = (s: CaseScore) => s.listed && s.rowCity && s.city && s.region && s.spelled && s.once && s.placed && s.street !== false;

/** How many cases pass each test, of all. */
export function tally(scores: CaseScore[]) {
  const count = (test: (s: CaseScore) => boolean | undefined) => scores.filter(test).length;
  const streets = scores.filter((s) => s.street !== undefined);
  return {
    cases: scores.length,
    listed: count((s) => s.listed),
    rowCity: count((s) => s.rowCity),
    city: count((s) => s.city),
    region: count((s) => s.region),
    spelled: count((s) => s.spelled),
    once: count((s) => s.once),
    placed: count((s) => s.placed),
    honest: count((s) => s.honest),
    street: `${count((s) => s.street)}/${streets.length}`,
    allRight: count(allRight),
  };
}

// ---- Azure's answers, as recorded ----------------------------------------------

/** The address field's kinds of place: every one Azure's autocomplete knows but a postcode alone. */
const ADDRESS_TYPES = 129;

/** A request as the recorded answers name it: its path, its parameters in order (numbers as numbers), the key left out, the address field's types said short; and its language. */
export function said(url: string, language: string) {
  const at = new URL(url);
  const params = [...at.searchParams.entries()]
    .filter(([key]) => key !== 'subscription-key')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => {
      if (key === 'resultTypes') {
        const types = value.split(',');
        return `${key}=${!types.includes('Postcode1') && types.length === ADDRESS_TYPES ? '(all but Postcode1)' : value}`;
      }
      return `${key}=${/^-?[\d.]+(,-?[\d.]+)*$/.test(value) ? value.split(',').map(Number).join(',') : value}`;
    });
  return `${at.pathname}?${params.join('&')} ${language}`;
}

export type Answers = Record<string, { status: number; body: unknown }>;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Azure as it answered: each recorded answer given back to the very request; any other, refused and noted. */
export function recorded(answers: Answers) {
  const unanswered: string[] = [];
  const asked: string[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = said(String(input), (init?.headers as Record<string, string> | undefined)?.['Accept-Language'] ?? '');
    asked.push(request);
    const answer = answers[request];
    if (answer) return json(answer.status, answer.body);
    unanswered.push(request);
    return json(404, { error: { message: `not recorded: ${request}` } });
  }) as typeof globalThis.fetch;
  return { fetch, asked, unanswered };
}
