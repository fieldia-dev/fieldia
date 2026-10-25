/**
 * Where the week starts, by region, as CLDR (47) has it — for an engine whose Intl does not say (`weekInfo`): Sunday's
 * regions, Saturday's and Friday's; every other region's week starts on Monday.
 */
const WEEK_STARTS: readonly (readonly [number, string])[] = [
  [0, 'AG AS BD BR BS BT BW BZ CA CO DM DO ET GT GU HK HN ID IL IN JM JP KE KH KR LA MH MM MO MT MX MZ NI NP PA PE PH PK PR PT PY SA SG SV TH TT TW UM US VE VI WS YE ZA ZW'],
  [6, 'AF BH DJ DZ EG IQ IR JO KW LY OM QA SD SY'],
  [5, 'MV'],
];

type WeekLocale = Intl.Locale & { getWeekInfo?: () => { firstDay: number }; weekInfo?: { firstDay: number } };

/** The languages the reader's browser asks for, its first first (`navigator.languages`); none outside a browser. */
const readerLanguages = (): readonly string[] => (globalThis as { navigator?: { languages?: readonly string[] } }).navigator?.languages ?? [];

/** A tag read, or none where it is not one: read once a tag (each date box asks for its week's first day). */
const read = new Map<string, Intl.Locale | null>();
const localeOf = (tag: string): Intl.Locale | null => {
  let found = read.get(tag);
  if (found === undefined) {
    try {
      found = new Intl.Locale(tag);
    } catch {
      found = null;
    }
    read.set(tag, found);
  }
  return found;
};

/**
 * The week's first day, 0 Sunday to 6 Saturday — the one every week Fieldia draws starts on (a list's "this week", a
 * calendar's and a timeline's weeks, a date's and a range's month, booking slots' month, a week's hours, a repeat's
 * days, a chatter's history). Which region decides it:
 *
 * 1. the language's own tag where it names one: the page's (`page.language`, where the page is shown in its own
 *    language — `en-GB` for an `en` page) or the one asked for (`en-GB`): Monday;
 * 2. else the reader's, where the browser asks for the same language with a region (`navigator.languages`, the first
 *    that does): an `en` page read in `en-EG` starts on Saturday, in `en-GB` on Monday, in `en-US` on Sunday;
 * 3. else the region CLDR has the language most spoken in: `en` the United States' (Sunday), `ar` Egypt's and `fa`
 *    Iran's (Saturday), `ur` Pakistan's (Sunday), `tr` Turkey's and `de` Germany's (Monday).
 *
 * The region's first day is the engine's own where its Intl says (`getWeekInfo`), else CLDR's table. Monday for a tag
 * no engine reads.
 */
export function firstWeekday(language: string, page?: { readonly language?: string } | null, readers: readonly string[] = readerLanguages()): number {
  const shown = localeOf(language);
  if (!shown) return 1;
  const own = page?.language ? localeOf(page.language) : null;
  const tagged = !shown.region && own?.language === shown.language && own.region ? own : shown;
  const region = tagged.region ?? readers.map(localeOf).find((reader) => reader?.language === shown.language && reader.region)?.region;
  try {
    const locale = (region && region !== tagged.region ? new Intl.Locale(tagged.toString(), { region }) : tagged) as WeekLocale;
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info) return info.firstDay % 7;
    const at = region ?? locale.maximize().region ?? '';
    return WEEK_STARTS.find(([, regions]) => at.length === 2 && regions.includes(at))?.[0] ?? 1;
  } catch {
    return 1;
  }
}
