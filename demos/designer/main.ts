import { blankPage, createDesigner, createMemoryPageStore, mountSurveyEditor } from '@fieldia/designer';
import { APP_LISTS, pages, sampleDataSource } from '../shared/sample-data';
import type { Skin } from '@fieldia/viewer';
import { APP_KINDS, APP_WIDGETS } from '../shared/app-kinds';
import { demoAssistant } from '../shared/assistant';

/**
 * The survey editor on its own page. `?start=survey` opens the example survey
 * to edit; `?assistant-delay=` sets how long the demo assistant takes, in ms.
 */
const params = new URLSearchParams(location.search);
const store = createMemoryPageStore();
const start = params.get('start') === 'survey' ? pages['survey'] : blankPage('survey', 'Event feedback');
// The app's own kind, an IBAN, and the widget that draws it; and a stand-in for the app's own assistant.
const assistant = demoAssistant({ delay: Number(params.get('assistant-delay') ?? 1200) });
const designer = createDesigner({ page: start, store, lists: APP_LISTS, kinds: APP_KINDS, assistant });
const handle = mountSurveyEditor(document.getElementById('app') as HTMLElement, { designer, skin: (params.get('skin') as Skin) ?? 'outlined', dataSource: sampleDataSource(), widgets: APP_WIDGETS });
Object.assign(window, { fieldiaDesigner: { designer, store, handle } });
