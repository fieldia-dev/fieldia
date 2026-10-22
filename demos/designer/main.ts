import type { Locale, Page } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, designerWordsReady, mountSurveyEditor } from '@fieldia/designer';
import { demoFunctions } from '../shared/functions';
import { APP_LISTS, APP_LISTS_AR, pages, sampleDataSource } from '../shared/sample-data';
import type { Skin } from '@fieldia/viewer';
import { APP_WIDGETS, appKinds } from '../shared/app-kinds';
import { demoAssistant } from '../shared/assistant';
import { bigSurvey } from '../shared/big-page';
import { timeFirstPaint } from '../shared/timing';

/**
 * The survey editor on its own page. `?start=survey` opens the example survey
 * to edit, `?start=big` a survey of 500 questions, for timing,
 * `?start=template-<id>` a survey of the template library, in steps, to change;
 * `?assistant-delay=` sets how long the demo assistant takes, in ms.
 * `?locale=ar` shows the designer in Arabic (`tr`, `fa`, `ur`, `es`: Turkish, Persian, Urdu, Spanish — machine-assisted,
 * not yet reviewed by a native speaker), and `?dir=rtl` puts it on a page written right to left, in Arabic (or the
 * Persian or Urdu asked for): the form and its canvas run that way.
 */
const params = new URLSearchParams(location.search);
const locale = params.get('locale') ?? undefined;
const arabic = !!locale?.startsWith('ar');
// The page the designer sits on: right to left, and in Arabic, as an Arabic app's page is.
if (params.get('dir') === 'rtl') Object.assign(document.documentElement, { dir: 'rtl', lang: locale && /^(fa|ur)\b/.test(locale) ? locale : 'ar' });
const store = createMemoryPageStore();
// `?start=template-<id>`: a survey of the template library, in steps, to change. Screens are the screen editor's (screen/).
const asked = params.get('start') ?? '';
const template = asked.startsWith('template-') && pages[asked]?.layout.type === 'wizard' ? pages[asked] : undefined;
// The designer's words in Turkish, Persian, Urdu or Spanish come in a chunk of their own: fetched before it is made.
void designerWordsReady(locale).then(() => {
  // With nothing asked for, a survey from nothing: no title yet (its box says "Untitled form"), no question.
  const start = template ? (structuredClone(template) as Page) : params.get('start') === 'survey' ? pages['survey'] : params.get('start') === 'big' ? bigSurvey() : blankPage('survey', '', { locale });
  // The app's own kind, an IBAN, and the widget that draws it; and a stand-in for the app's own assistant.
  const assistant = demoAssistant({ delay: Number(params.get('assistant-delay') ?? 1200), locale });
  const opened = timeFirstPaint('designer');
  // No `looks` given: the looks people save are kept in this browser, and offered by both designer demos.
  // The app's own functions, offered in a formula's list after Fieldia's: a district's average price (shared/functions.ts).
  const designer = createDesigner({ page: start, store, lists: arabic ? APP_LISTS_AR : APP_LISTS, functions: demoFunctions, kinds: appKinds(locale as Locale | undefined), assistant, locale });
  const handle = mountSurveyEditor(document.getElementById('app') as HTMLElement, { designer, skin: (params.get('skin') as Skin) ?? 'outlined', dataSource: sampleDataSource(), widgets: APP_WIDGETS });
  opened();
  // The tab names the page being made, not the tool it is made in: “Job application — Fieldia designer”.
  const named = () => (document.title = `${designer.getPage().title || (arabic ? 'صفحة جديدة' : 'A new page')} — Fieldia designer`);
  named();
  designer.subscribe(named);
  Object.assign(window, { fieldiaDesigner: { designer, store, handle } });
});
