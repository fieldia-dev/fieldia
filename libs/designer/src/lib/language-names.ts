/** Common languages, by tag, named in English: offered when adding one, and their names when the browser has none. */
export const COMMON_LANGUAGES: Record<string, string> = {
  ar: 'Arabic',
  bn: 'Bengali',
  zh: 'Chinese',
  cs: 'Czech',
  da: 'Danish',
  nl: 'Dutch',
  en: 'English',
  fi: 'Finnish',
  fr: 'French',
  de: 'German',
  el: 'Greek',
  he: 'Hebrew',
  hi: 'Hindi',
  hu: 'Hungarian',
  id: 'Indonesian',
  it: 'Italian',
  ja: 'Japanese',
  ko: 'Korean',
  ckb: 'Central Kurdish',
  ms: 'Malay',
  nb: 'Norwegian Bokmål',
  fa: 'Persian',
  pl: 'Polish',
  pt: 'Portuguese',
  'pt-BR': 'Brazilian Portuguese',
  ro: 'Romanian',
  ru: 'Russian',
  es: 'Spanish',
  sw: 'Swahili',
  sv: 'Swedish',
  th: 'Thai',
  tr: 'Turkish',
  uk: 'Ukrainian',
  ur: 'Urdu',
  vi: 'Vietnamese',
};

const names = new Map<string, string>();

/**
 * A language's name in English or in Arabic, found once each: a list of
 * languages sorted by name asks for each many times. The browser's names;
 * failing those, in English the common ones', and else the tag itself.
 */
export function displayName(locale: 'en' | 'ar', tag: string): string {
  const key = `${locale}:${tag}`;
  let name = names.get(key);
  if (name === undefined) names.set(key, (name = nameOf(locale, tag)));
  return name;
}

function nameOf(locale: 'en' | 'ar', tag: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(tag);
    if (name && name !== tag) return name;
  } catch {
    // A browser with no names of languages, or a tag it cannot read.
  }
  if (locale !== 'en') return tag;
  const [base, ...rest] = tag.split('-');
  if (COMMON_LANGUAGES[tag]) return COMMON_LANGUAGES[tag];
  return COMMON_LANGUAGES[base] ? `${COMMON_LANGUAGES[base]} (${rest.join('-')})` : tag;
}
