import { lazyPart, type Part } from '../parts';
import type * as LanguagesModule from './languages-part';

/**
 * A text kept in several languages (a char, text or html field's `translate`), as people typed each: its value an object
 * of each language's text by its tag, `{ "ar": "فيلا على البحر", "en": "Sea-view villa" }`, a language not typed yet left
 * out. Nothing here translates: a language with no text shows another's, said to be another's, never a machine's guess.
 */
export type Translated = Record<string, string>;

/** The languages a field keeps its text in (`translate`), or undefined for a text in one. */
export const languagesOf = (field: { type: string } | undefined): string[] | undefined => {
  const tags = (field as { translate?: unknown } | undefined)?.translate;
  return Array.isArray(tags) && tags.length ? (tags as string[]) : undefined;
};

/** Whether a page keeps a text of its own in several languages: its form's languages part is asked for. */
export const hasLanguages = (page: { fields: Readonly<Record<string, { type: string }>> }): boolean => Object.values(page.fields).some((field) => languagesOf(field));

/** The languages part's form code (languages-part.ts). */
export type FormLanguagesPart = typeof LanguagesModule;

/**
 * A text in several languages read in the reader's language and checked language by language — required in those the
 * page says, each within the field's most characters and its pattern — loaded before a page with one is drawn; until
 * then a check says nothing of it, and a save waits for it.
 */
export const formLanguagesPart: Part<FormLanguagesPart> = lazyPart('languages', () => import('./languages-part'));
