import { createApp, h } from 'vue';
import { blankPage, createDesigner, createMemoryPageStore } from '@fieldia/designer';
import { ScreenEditor, SurveyEditor } from '@fieldia/designer/vue';

/** The designer's editors as Vue components. `?editor=screen` shows the screen editor. */
const params = new URLSearchParams(location.search);
const screen = params.get('editor') === 'screen';
const store = createMemoryPageStore();
const designer = createDesigner({ page: screen ? blankPage('screen', 'New screen') : blankPage('survey', 'Event feedback'), store });
createApp({
  render: () => (screen ? h(ScreenEditor, { designer, skin: 'outlined' }) : h(SurveyEditor, { designer, skin: 'outlined' })),
}).mount('#app');
Object.assign(window, { fieldiaDesigner: { designer, store } });
