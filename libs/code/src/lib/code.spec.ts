import { EditorView } from '@codemirror/view';
import { createMemoryDataSource, type Page } from '@fieldia/core';
import { mountViewer, type ViewerHandle } from '@fieldia/viewer';
import { codeWidgets } from './code';

const page: Page = {
  fieldia: '0.1',
  id: 'site',
  title: 'Site',
  data: { kind: 'record', model: 'site' },
  fields: { settings: { type: 'json', label: 'Access control settings' } },
  layout: {
    type: 'sections',
    id: 'root',
    children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'f-settings', field: 'settings', widget: 'code' }] }],
  },
};

let handle: ViewerHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

async function mount(readonly = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const dataSource = createMemoryDataSource({ records: { site: { 1: { settings: { badge_readers: 4, zones: ['reception'] } } } } });
  const shown: Page = readonly ? { ...page, fields: { settings: { ...page.fields['settings'], readonly: true } as Page['fields'][string] } } : page;
  handle = mountViewer(host, { page: shown, dataSource, recordId: 1, widgets: codeWidgets });
  await handle.form.settled();
  const box = host.querySelector('[data-node="f-settings"]') as HTMLElement;
  const view = EditorView.findFromDOM(box.querySelector('.cm-editor') as HTMLElement) as EditorView;
  return { host, box, view, form: handle.form };
}
/** Replace the whole text, as typing over a selection would. */
const replaceAll = (view: EditorView, text: string) => view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });

describe('JSON in a code editor', () => {
  it('shows the value as indented JSON, in an editor named by the field’s label', async () => {
    const { box, view } = await mount();
    expect(view.state.doc.toString()).toBe('{\n  "badge_readers": 4,\n  "zones": [\n    "reception"\n  ]\n}');
    const content = box.querySelector('.cm-content') as HTMLElement;
    expect(content.getAttribute('aria-labelledby')).toMatch(/-label$/);
    expect(document.getElementById(content.getAttribute('aria-labelledby') as string)?.textContent).toBe('Access control settings');
  });

  it('writes valid JSON to the form as it is typed', async () => {
    const { view, form } = await mount();
    replaceAll(view, '{ "badge_readers": 6 }');
    expect(form.getState().values['settings']).toEqual({ badge_readers: 6 });
  });

  it('says when the text is not valid JSON, and keeps the last good value', async () => {
    const { box, view, form } = await mount();
    replaceAll(view, '{ "badge_readers": ');
    expect(form.getState().values['settings']).toEqual({ badge_readers: 4, zones: ['reception'] });
    const message = box.querySelector('.fd-code-error') as HTMLElement;
    expect(message.hidden).toBe(false);
    expect(message.textContent).toBe('Not valid JSON');
    expect((box.querySelector('.cm-content') as HTMLElement).getAttribute('aria-invalid')).toBe('true');
    replaceAll(view, '[]');
    expect(message.hidden).toBe(true);
    expect(form.getState().values['settings']).toEqual([]);
  });

  it('cannot be edited when read-only', async () => {
    const { box } = await mount(true);
    expect((box.querySelector('.cm-content') as HTMLElement).getAttribute('contenteditable')).toBe('false');
  });
});
