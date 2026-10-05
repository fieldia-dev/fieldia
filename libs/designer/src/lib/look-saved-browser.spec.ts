import { blankPage, createDesigner } from './designer';
import { button, field, mount, openTab, type } from './test-editor';

/**
 * Without a store of the app's, the looks are kept in this browser: saved in
 * one visit, they are offered in the next — a page loaded afresh, every
 * module new — on the Look tab as on the survey's sheet.
 */

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

afterEach(() => window.localStorage.clear());

it('a look saved with no store of the app’s is kept in this browser, and offered after a reload', async () => {
  const designer = createDesigner({ page: blankPage('screen', 'Visit') });
  designer.select(null);
  designer.setLook({ accent: '#c4320a', font: 'serif' });
  const { host, handle } = mount(designer, { mode: 'advanced' });
  openTab(host, 'Look');
  const row = host.querySelector('.fd-properties [data-setting="Look presets"]') as HTMLElement;
  button(row, 'Save this look…')?.click();
  type(field(row, 'Name this look'), 'Brand');
  button(row, 'Save')?.click();
  await flush();
  expect(JSON.parse(window.localStorage.getItem('fieldia.designer.looks') ?? '[]')).toEqual([{ id: expect.any(String), name: 'Brand', look: { accent: '#c4320a', font: 'serif' } }]);
  handle.destroy();
  document.body.replaceChildren();

  // The next visit: every module loaded afresh, as a reload has them.
  await jest.isolateModulesAsync(async () => {
    const fresh = await import('./designer');
    const { mountSurveyEditor } = await import('./survey-editor');
    const survey = fresh.createDesigner({ page: blankPage('survey', 'Feedback') });
    expect(survey.looks()).not.toBe(designer.looks());
    const surveyHost = document.createElement('div');
    document.body.append(surveyHost);
    const editor = mountSurveyEditor(surveyHost, { designer: survey });
    (surveyHost.querySelector('.fd-designer-bar button[aria-label="Look"]') as HTMLButtonElement).click();
    await flush();
    const yours = surveyHost.querySelector('[role="dialog"][aria-label="Look"] [role="group"][aria-label="Your looks"]') as HTMLElement;
    expect([...yours.querySelectorAll('.fd-look-preset-name')].map((n) => n.textContent)).toEqual(['Brand']);
    (yours.querySelector('button[aria-pressed]') as HTMLButtonElement).click();
    expect(survey.getPage().look).toEqual({ accent: '#c4320a', font: 'serif' });
    editor.destroy();
  });
});
