import { blankPage, createDesigner, createMemoryPageStore, mountSurveyEditor } from '@fieldia/designer';
import { pages } from '../shared/sample-data';
import type { Skin } from '@fieldia/viewer';

/** The survey editor on its own page. `?start=survey` opens the example survey to edit. */
const params = new URLSearchParams(location.search);
const store = createMemoryPageStore();
const start = params.get('start') === 'survey' ? pages['survey'] : blankPage('survey', 'Event feedback');
const designer = createDesigner({ page: start, store });
const handle = mountSurveyEditor(document.getElementById('app') as HTMLElement, { designer, skin: (params.get('skin') as Skin) ?? 'outlined' });
Object.assign(window, { fieldiaDesigner: { designer, store, handle } });
