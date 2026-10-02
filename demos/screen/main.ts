import * as grafloria from '@grafloria/element';
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor } from '@fieldia/designer';
import type { Skin } from '@fieldia/viewer';

/** The screen editor on its own page, opened on a small site-visit screen. `?start=blank` opens an empty one. */
function siteVisit() {
  const draft = createDesigner({ page: blankPage('screen', 'Site visit') });
  const visit = 'section-1';
  draft.renameContainer(visit, 'Visit');
  const add = (kind: string, label: string, parent: string) => {
    const id = draft.addQuestion(kind, { parent }) as string;
    draft.updateQuestion(id, { label });
    return id;
  };
  add('short-answer', 'Customer', visit);
  add('date', 'Visit date', visit);
  draft.setColspan(add('paragraph', 'Notes', visit), 2);
  const followUp = draft.addContainer('Follow-up') as string;
  draft.setOptions(add('dropdown', 'Next step', followUp), ['Send a quote', 'Book a second visit', 'Close']);
  add('date', 'Due by', followUp);
  add('yes-no', 'Manager to call?', followUp);
  return draft.getPage();
}

const params = new URLSearchParams(location.search);
const store = createMemoryPageStore();
const designer = createDesigner({ page: params.get('start') === 'blank' ? blankPage('screen', 'New screen') : siteVisit(), store });
const handle = mountScreenEditor(document.getElementById('app') as HTMLElement, {
  designer,
  grafloria,
  skin: (params.get('skin') as Skin) ?? 'outlined',
});
Object.assign(window, { fieldiaDesigner: { designer, store, handle } });
