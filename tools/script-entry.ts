/**
 * What the `<script>` bundle puts on `window.Fieldia`: everything a page with
 * no build step needs to show a form and handle what people enter. Its own
 * words are English; Arabic, German and French come as add-on scripts
 * (tools/script-language.ts). What a page uses only now and then — a list
 * screen, a table of lines, files and a signature, the business and survey
 * kinds, a work item's head, its text editor, a path picker, a filter bar, a
 * date's box, a theme, the quiet look, a memory source's members — comes in
 * parts loaded the first time a page uses them (tools/script-parts.ts).
 */
import type { Page, PageLoading } from '@fieldia/core';
import { addLanguage, defineFieldiaForm, partFiles } from '@fieldia/viewer';
import { partsComeByScriptTag } from '@fieldia/widgets';
import { partWords } from '../libs/viewer/src/lib/add-language';
import type { LanguageHost } from './script-language';
import { partTag, startParts } from './script-parts';

// The runtime alone: the format's schemas and validation library stay out of a page with no build step.
export * from '../libs/core/src/runtime';
// A memory source's members in a part of their own (fieldia.memory.js), loaded the first time a page makes one: an app
// that gives its own data source never downloads them. Its source is handed over at once, as ever.
export { createMemoryDataSource, memoryPart, type MemoryPart } from '../libs/core/src/lib/record/memory-later';
export * from '@fieldia/widgets';
export * from '@fieldia/viewer';

/**
 * The tags of the parts a page draws from (`partFiles`: the loading part too, where the viewer asks for it with them —
 * `loading`, the viewer's own, where the app gives one), as this script asks for each: its address beside fieldia.js and
 * all it carries — `crossorigin`, `integrity` (the sha256 of its file) — for a page that knows its page before it mounts
 * it, to write them exactly so as `<script async>` tags or `<link rel="preload" as="script">` links, which the browser
 * then uses as they are.
 */
export const partTags = (page: Page, loading?: PageLoading): ReturnType<typeof partTag>[] => partFiles(page, undefined, undefined, loading).map((file) => partTag(file.slice(8, -3)));

declare const __FIELDIA_VERSION__: string;
/** The version of @fieldia/viewer this bundle was built from. */
export const VERSION: string = __FIELDIA_VERSION__;

// Where this script came from, while the browser still says, and the parts whose scripts ran before it — each putting
// its own words in the tables as it comes.
startParts(partWords);
// Each part a script tag of its own, asked for anew after a failure: what offers to try again may (`Part.asksAgain`).
partsComeByScriptTag();

// `<fieldia-form>` defined as the script starts: a page needs no code of its own to show a form (its work in
// fieldia.element.js, loaded the first time one is put on a page).
defineFieldiaForm();

// A language's script loaded before this one left its words behind: take them now.
const host = globalThis as LanguageHost;
for (const [locale, words] of host.FieldiaLanguages ?? []) addLanguage(locale, words);
delete host.FieldiaLanguages;
