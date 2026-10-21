/**
 * The languages part's form code (languages.ts, `formLanguagesPart`): a text kept in several languages checked language
 * by language. In the one-tag script it comes in one script with the widgets' switch between its languages, which draws
 * it (fieldia.languages.js), and with its page's checks (format/languages-checks.ts).
 */
import type { Field, LineField } from '../format/field';
import { checkValue } from './check';
import { languagesOf } from './languages';
import { fillMessage, MESSAGES, type Messages } from './messages';
import { isQuestion } from './record-words';
import type { Value } from './values';

/** The text a value holds in one language, as typed — or empty. */
export const textOf = (value: unknown, language: string): string => {
  const held = value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>)[language] : undefined;
  return typeof held === 'string' ? held : '';
};

const base = (tag: string) => tag.toLowerCase().split('-')[0];

/**
 * A text kept in several languages, as a reader of `reader` reads it: in their language where it was typed there (its
 * tag, or the same language's: "en" for "en-GB"), else in the first of `languages` (the field's order) it was typed in,
 * `other` then. A plain text — a source that gives one language — is itself. Null for none.
 */
export function textIn(value: unknown, reader: string, languages: readonly string[] = []): { text: string; language?: string; other: boolean } | null {
  if (typeof value === 'string') return value.trim() ? { text: value, other: false } : null;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const typed = Object.keys(value).filter((tag) => textOf(value, tag).trim());
  const own = typed.find((tag) => tag.toLowerCase() === reader.toLowerCase()) ?? typed.find((tag) => base(tag) === base(reader));
  const language = own ?? languages.find((tag) => typed.includes(tag)) ?? typed[0];
  return language ? { text: textOf(value, language), language, other: !own } : null;
}

/** A language's name, as the page's language says it ("Arabic", "العربية"): the browser's, else its tag. */
export function languageName(tag: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(tag);
    if (name && name !== tag) return name;
  } catch {
    // A browser with no names of languages, or a tag it cannot read.
  }
  return tag.toUpperCase();
}

/** Names joined as a sentence joins them, in the page's language: "Arabic and French". */
function joined(names: string[], locale: string): string {
  try {
    return new Intl.ListFormat(locale, { type: 'conjunction' }).format(names);
  } catch {
    return names.join(', ');
  }
}

/**
 * A text kept in several languages (`translate`) checked: an object of each language's text — a plain text, from a
 * source that gives one language, as its first language's — typed in every language a required answer is typed in
 * (`requiredIn`, else all): "Title is required in Arabic" while it is typed in some, "Title is required" while in none of
 * them; then each language's text as the field checks one text — its most characters, its pattern — named with its
 * language: "Title (Arabic) is 3 characters over its most". Undefined when it is fine.
 */
export function checkTranslated(field: Field | LineField, value: Value | undefined, required: boolean, messages: Messages = MESSAGES.en, today?: string, widget?: string): string | undefined {
  const languages = languagesOf(field) ?? [];
  const label = field.label || 'This field';
  const texts: unknown = typeof value === 'string' ? { [languages[0]]: value } : value;
  const say = (key: 'text' | 'required' | 'requiredQuestion' | 'languagesNeeded' | 'languagesNeededQuestion', values: Record<string, string> = {}) => fillMessage(messages, messages[key], { label, ...values });
  if (texts === null || texts === undefined) return required ? say(isQuestion(label) ? 'requiredQuestion' : 'required') : undefined;
  if (typeof texts !== 'object' || Array.isArray(texts) || Object.values(texts).some((text) => typeof text !== 'string' && text !== null)) return say('text');
  const asked = required ? ((field as { requiredIn?: string[] }).requiredIn ?? languages) : [];
  const missing = asked.filter((tag) => !textOf(texts, tag).trim());
  if (missing.length) {
    const none = languages.every((tag) => !textOf(texts, tag).trim());
    if (none && missing.length === languages.length) return say(isQuestion(label) ? 'requiredQuestion' : 'required');
    const names = joined(missing.map((tag) => languageName(tag, messages.locale)), messages.locale);
    return say(isQuestion(label) ? 'languagesNeededQuestion' : 'languagesNeeded', { languages: names });
  }
  // Each language's text as one text of the field: its label naming the language.
  const one = { ...field, translate: undefined, requiredIn: undefined } as Field;
  for (const tag of languages) {
    const text = textOf(texts, tag);
    if (!text.trim()) continue;
    const problem = checkValue({ ...one, label: `${label} (${languageName(tag, messages.locale)})` } as Field, text, false, messages, today, widget);
    if (problem) return problem;
  }
  return undefined;
}

/** Which of a text's languages a problem is in: those a required answer misses, and those whose text the field refuses. */
export function languagesAtFault(field: Field | LineField, value: Value | undefined, required: boolean, messages: Messages = MESSAGES.en, today?: string): string[] {
  const languages = languagesOf(field) ?? [];
  const asked = required ? ((field as { requiredIn?: string[] }).requiredIn ?? languages) : [];
  const one = { ...field, translate: undefined, requiredIn: undefined } as Field;
  return languages.filter((tag) => {
    const text = typeof value === 'string' ? (tag === languages[0] ? value : '') : textOf(value, tag);
    if (!text.trim()) return asked.includes(tag);
    return checkValue(one, text, false, messages, today) !== undefined;
  });
}
