import { mountViewer, type Skin } from '@fieldia/viewer';
import { pages, sampleDataSource } from '../shared/sample-data';

/**
 * Fieldia with no framework at all: one script, one call. The page, skin and
 * direction come from the query string, so tests and people see the same thing.
 */
const params = new URLSearchParams(location.search);
const name = params.get('page') ?? 'signup';
const page = pages[name] ?? pages['signup'];
const dataSource = sampleDataSource();
const actions: string[] = [];

const handle = mountViewer(document.getElementById('app') as HTMLElement, {
  page,
  dataSource,
  recordId: page.data.kind === 'record' ? 1 : null,
  skin: (params.get('skin') as Skin) ?? 'underline',
  dir: params.get('dir') === 'rtl' ? 'rtl' : 'ltr',
  onAction: (request) => void actions.push(request.action),
  slots: {
    chatter: (element) => {
      element.innerHTML =
        '<div class="demo-feed"><h3>Activity</h3><p><b>Mona Adel</b> confirmed order SO0018.</p><p><b>You</b> raised the credit limit to 250,000.</p></div>';
    },
  },
});

Object.assign(window, { fieldiaDemo: { handle, dataSource, actions } });
