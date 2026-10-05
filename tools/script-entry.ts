/**
 * What the `<script>` bundle puts on `window.Fieldia`: everything a page with
 * no build step needs to show a form and handle what people enter. Its own
 * words are English; Arabic, German and French come as add-on scripts
 * (tools/script-language.ts).
 */
import { addLanguage } from '@fieldia/viewer';
import type { LanguageHost } from './script-language';

// The runtime alone: the format's schemas and validation library stay out of a page with no build step.
export * from '../libs/core/src/runtime';
export * from '@fieldia/widgets';
export * from '@fieldia/viewer';

declare const __FIELDIA_VERSION__: string;
/** The version of @fieldia/viewer this bundle was built from. */
export const VERSION: string = __FIELDIA_VERSION__;

// A language's script loaded before this one left its words behind: take them now.
const host = globalThis as LanguageHost;
for (const [locale, words] of host.FieldiaLanguages ?? []) addLanguage(locale, words);
delete host.FieldiaLanguages;
