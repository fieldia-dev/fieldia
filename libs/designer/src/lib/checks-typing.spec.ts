import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/**
 * The bar's count of checks, while someone types: it waits for a pause, as
 * working the checks out at each key would slow typing on a big page; an
 * edit made any other way counts at once, as before.
 */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  jest.useRealTimers();
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const count = (host: Element) => (host.querySelector('.fd-designer-bar [data-checks]') as HTMLElement).getAttribute('aria-label');

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const designer = createDesigner({ page: blankPage('survey', 'Visit') });
  const q = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(q, { label: 'Your name' });
  handle = mountSurveyEditor(host, { designer });
  return { host, designer, q };
}

describe('the count of checks, while typing', () => {
  it('waits for a pause in the typing, then counts', () => {
    const { host, q } = mount();
    expect(count(host)).toBe('Checks: all clear');
    jest.useFakeTimers();
    const label = host.querySelector(`.fd-q[data-node="${q}"] .fd-q-label`) as HTMLInputElement;
    label.focus();
    label.value = '';
    label.dispatchEvent(new Event('input', { bubbles: true }));
    expect(count(host)).toBe('Checks: all clear');
    jest.advanceTimersByTime(200);
    expect(count(host)).toBe('Checks: all clear');
    jest.advanceTimersByTime(300);
    expect(count(host)).toBe('Checks: 1 to look at');
  });

  it('counts at once an edit made without typing', () => {
    const { host, designer, q } = mount();
    designer.updateQuestion(q, { label: '' });
    expect(count(host)).toBe('Checks: 1 to look at');
  });
});
