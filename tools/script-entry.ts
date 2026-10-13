/**
 * What the `<script>` bundle puts on `window.Fieldia`: everything a page with
 * no build step needs to show a form and handle what people enter. Its own
 * words are English; Arabic, German and French come as add-on scripts
 * (tools/script-language.ts). What a page uses only now and then — a work
 * item's head, its text editor, a path picker, a filter bar — comes in parts
 * loaded the first time a page uses them (tools/script-parts.ts).
 */
import { addLanguage } from '@fieldia/viewer';
import type { LanguageHost } from './script-language';
import { startParts } from './script-parts';

// The runtime alone: the format's schemas and validation library stay out of a page with no build step.
export * from '../libs/core/src/runtime';
export * from '@fieldia/widgets';
export * from '@fieldia/viewer';

declare const __FIELDIA_VERSION__: string;
/** The version of @fieldia/viewer this bundle was built from. */
export const VERSION: string = __FIELDIA_VERSION__;

// Where this script came from, while the browser still says, and the parts whose scripts ran before it.
startParts();

// A language's script loaded before this one left its words behind: take them now.
const host = globalThis as LanguageHost;
for (const [locale, words] of host.FieldiaLanguages ?? []) addLanguage(locale, words);
delete host.FieldiaLanguages;
