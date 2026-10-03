import { createRoot } from 'react-dom/client';
import { blankPage, createDesigner, createMemoryPageStore } from '@fieldia/designer';
import { ScreenEditor, SurveyEditor } from '@fieldia/designer/react';

/** The designer's editors as React components. `?editor=screen` shows the screen editor. */
const params = new URLSearchParams(location.search);
const screen = params.get('editor') === 'screen';
const store = createMemoryPageStore();
const designer = createDesigner({ page: screen ? blankPage('screen', 'New screen') : blankPage('survey', 'Event feedback'), store });
createRoot(document.getElementById('app') as HTMLElement).render(
  screen ? <ScreenEditor designer={designer} skin="outlined" /> : <SurveyEditor designer={designer} skin="outlined" />
);
Object.assign(window, { fieldiaDesigner: { designer, store } });
