import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor } from './survey-editor';
import { mount } from './test-editor';

/**
 * Design, Try it, Translations and JSON take turns in one place: whichever
 * is picked shows, and the rest stay out of sight, however one goes to the
 * next — and the bar says which it is.
 */

afterEach(() => document.body.replaceChildren());

type Shown = 'design' | 'try' | 'translations' | 'json';

function views(host: HTMLElement) {
  const at = (selector: string) => host.querySelector(selector) as HTMLElement;
  const parts: Record<Shown, () => HTMLElement> = {
    design: () => at('.fd-screen-body, .fd-survey-body'),
    try: () => at('.fd-try'),
    translations: () => at('.fd-words'),
    json: () => at('.fd-json'),
  };
  const go = (name: Shown) => (host.querySelector(`.fd-mode [data-mode="${name}"]`) as HTMLButtonElement).click();
  const showing = () => (Object.keys(parts) as Shown[]).filter((name) => !parts[name]().hidden);
  // The ways to look at the page; Simple or Advanced is a switch of its own.
  const pressed = () => [...host.querySelectorAll('.fd-mode:not(.fd-mode-switch) [data-mode]')].filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-mode'));
  return { go, showing, pressed };
}

const ROUTE: Shown[] = ['translations', 'json', 'translations', 'try', 'json', 'design', 'json', 'try', 'translations', 'design'];

describe('the editor’s views take turns', () => {
  it('shows only the one picked in the screen editor, whatever came before', () => {
    const { host } = mount(createDesigner({ page: blankPage('screen', 'Visit') }));
    const { go, showing, pressed } = views(host);
    for (const next of ROUTE) {
      go(next);
      expect([next, showing()]).toEqual([next, [next]]);
      expect([next, pressed()]).toEqual([next, [next]]);
    }
  });

  it('shows only the one picked in the survey designer, whatever came before', () => {
    const host = document.createElement('div');
    document.body.append(host);
    mountSurveyEditor(host, { designer: createDesigner({ page: blankPage('survey', 'Feedback') }) });
    const { go, showing, pressed } = views(host);
    for (const next of ROUTE) {
      go(next);
      expect([next, showing()]).toEqual([next, [next]]);
      expect([next, pressed()]).toEqual([next, [next]]);
    }
  });
});
