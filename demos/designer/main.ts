import type { Page } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, mountSurveyEditor } from '@fieldia/designer';
import { APP_LISTS, APP_LISTS_AR, pages, sampleDataSource } from '../shared/sample-data';
import type { Skin } from '@fieldia/viewer';
import { APP_KINDS, APP_WIDGETS } from '../shared/app-kinds';
import { demoAssistant } from '../shared/assistant';
import { bigSurvey } from '../shared/big-page';
import { timeFirstPaint } from '../shared/timing';

/**
 * The survey editor on its own page. `?start=survey` opens the example survey
 * to edit, `?start=big` a survey of 500 questions, for timing,
 * `?start=template-<id>` a survey of the template library, in steps, to change;
 * `?assistant-delay=` sets how long the demo assistant takes, in ms.
 * `?locale=ar` shows the designer in Arabic, and `?dir=rtl` puts it on a
 * page written right to left, in Arabic: the form and its canvas run that way.
 */
const params = new URLSearchParams(location.search);
const locale = params.get('locale') ?? undefined;
const arabic = !!locale?.startsWith('ar');
// The page the designer sits on: right to left, and in Arabic, as an Arabic app's page is.
if (params.get('dir') === 'rtl') Object.assign(document.documentElement, { dir: 'rtl', lang: 'ar' });
const store = createMemoryPageStore();
// `?start=template-<id>`: a survey of the template library, in steps, to change. Screens are the screen editor's (screen/).
const asked = params.get('start') ?? '';
const template = asked.startsWith('template-') && pages[asked]?.layout.type === 'wizard' ? pages[asked] : undefined;
const start = template ? (structuredClone(template) as Page) : params.get('start') === 'survey' ? pages['survey'] : params.get('start') === 'big' ? bigSurvey() : blankPage('survey', arabic ? 'رأي الحضور' : 'Event feedback', { locale });
// The app's own kind, an IBAN, and the widget that draws it; and a stand-in for the app's own assistant.
const assistant = demoAssistant({ delay: Number(params.get('assistant-delay') ?? 1200), locale });
const opened = timeFirstPaint('designer');
// No `looks` given: the looks people save are kept in this browser, and offered by both designer demos.
const designer = createDesigner({ page: start, store, lists: arabic ? APP_LISTS_AR : APP_LISTS, kinds: APP_KINDS, assistant, locale });
const handle = mountSurveyEditor(document.getElementById('app') as HTMLElement, { designer, skin: (params.get('skin') as Skin) ?? 'outlined', dataSource: sampleDataSource(), widgets: APP_WIDGETS });
opened();
Object.assign(window, { fieldiaDesigner: { designer, store, handle } });
