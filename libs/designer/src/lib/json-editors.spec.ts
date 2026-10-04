import { blankPage, createDesigner } from './designer';
import { mountScreenEditor } from './screen-editor';
import { mountSurveyEditor } from './survey-editor';

/** The JSON view in both editors: beside Design and Try it, in Find anything, and the editor's keys quiet while it shows. */

let destroy: (() => void) | null = null;
afterEach(() => {
  destroy?.();
  destroy = null;
  document.body.replaceChildren();
});

function mount(kind: 'screen' | 'survey') {
  const designer = createDesigner({ page: blankPage(kind, 'Visit') });
  const id = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(id, { label: 'Customer' });
  const host = document.createElement('div');
  document.body.append(host);
  const handle = kind === 'screen' ? mountScreenEditor(host, { designer }) : mountSurveyEditor(host, { designer });
  destroy = () => handle.destroy();
  const mode = (name: string) => host.querySelector(`.fd-designer-bar .fd-mode button[data-mode="${name}"]`) as HTMLButtonElement;
  const body = host.querySelector(kind === 'screen' ? '.fd-screen-body' : '.fd-designer-body') as HTMLElement;
  const json = host.querySelector('.fd-json') as HTMLElement;
  return { designer, id, host, mode, body, json };
}

const press = (key: string, init: KeyboardEventInit = {}, target: Element = document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));

describe.each(['screen', 'survey'] as const)('the %s editor’s JSON view', (kind) => {
  it('sits beside Design and Try it, and shows in place of the editor', () => {
    const { designer, mode, body, json } = mount(kind);
    expect(mode('json').textContent).toBe('JSON');
    mode('json').click();
    expect([body.hidden, json.hidden]).toEqual([true, false]);
    expect(json.querySelector('textarea')?.value).toBe(designer.pageJson());
    mode('design').click();
    expect([body.hidden, json.hidden]).toEqual([false, true]);
  });

  it('is in Find anything', () => {
    const { host, json } = mount(kind);
    press('k', { metaKey: true, ctrlKey: true });
    const option = [...host.querySelectorAll('.fd-find-option')].find((o) => o.textContent?.startsWith('Edit the page as JSON')) as HTMLElement;
    option.click();
    expect(json.hidden).toBe(false);
  });

  it('keeps the editor’s keys away from the page while it shows', () => {
    const { designer, id, mode, json } = mount(kind);
    designer.select(id);
    mode('json').click();
    (json.querySelector('button') as HTMLButtonElement).focus();
    press('Delete', {}, document.activeElement as Element);
    press('Escape', {}, json.querySelector('textarea') as HTMLTextAreaElement);
    expect(Object.keys(designer.getPage().fields)).toHaveLength(1);
    expect(designer.getState().selected).toBe(id);
  });
});
