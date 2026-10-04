import type { Page } from '@fieldia/core';
import { askAssistant, type DesignerAssistant } from './assistant';
import { blankPage, createDesigner } from './designer';
import { SCREEN_TEMPLATES, SURVEY_TEMPLATES } from './templates';

/** An assistant that answers when told to, as an app's would after a while. */
function later() {
  let answer: (page: Page) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const asked: { prompt: string; page: Page; signal?: AbortSignal }[] = [];
  const assistant: DesignerAssistant = {
    describe(request) {
      asked.push(request);
      return new Promise<Page>((resolve, reject) => {
        answer = resolve;
        fail = reject;
      });
    },
  };
  return { assistant, asked, answer: (page: Page) => answer(page), fail: (error: unknown) => fail(error) };
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the app’s assistant', () => {
  it('is asked with the words and a copy of the page as it is', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'Course feedback') });
    const app = later();
    askAssistant(designer, app.assistant, '  A feedback form for a course  ');
    expect(app.asked).toHaveLength(1);
    expect(app.asked[0].prompt).toBe('A feedback form for a course');
    expect(app.asked[0].page).toEqual(designer.getPage());
    expect(app.asked[0].page).not.toBe(designer.getPage());
    expect(app.asked[0].signal?.aborted).toBe(false);
  });

  it('puts its form in place as one edit, and says what changed', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'Course feedback') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'A feedback form');
    app.answer(SURVEY_TEMPLATES[0].page);
    const result = await run.done;
    expect(result.status).toBe('applied');
    expect(result.status === 'applied' && result.changes).toContain('Added “How was it overall?”');
    expect(designer.getPage().id).toBe('course-feedback');
    designer.undo();
    expect(designer.getPage()).toEqual(blankPage('survey', 'Course feedback'));
    expect(designer.getState().canUndo).toBe(false);
  });

  it('changes a page that has parts, saying only what it changed', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    designer.replacePage(SURVEY_TEMPLATES[0].page);
    const before = designer.getPage();
    const app = later();
    const run = askAssistant(designer, app.assistant, 'Make the email required');
    const next = JSON.parse(JSON.stringify(before)) as Page;
    (next.fields['email'] as { required?: boolean }).required = true;
    app.answer(next);
    const result = await run.done;
    expect(result).toEqual({ status: 'applied', changes: ['“Your email, for a reply” is now required'] });
  });

  it('refuses a form the designer cannot open, in words, and changes nothing', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'Anything');
    app.answer({ ...SURVEY_TEMPLATES[0].page, fields: {} });
    const result = await run.done;
    expect(result.status).toBe('refused');
    expect(result.status === 'refused' && result.problem).toMatch(/^The assistant’s form cannot be used: /);
    expect(designer.getState().canUndo).toBe(false);
    // Said here, not in the editor's bar.
    expect(designer.getState().issues).toEqual([]);
  });

  it('refuses a screen for a survey, in words', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'Anything');
    app.answer(SCREEN_TEMPLATES[0].page);
    expect(await run.done).toEqual({ status: 'refused', problem: 'The assistant’s form cannot be used: A survey is made of pages of questions: this is a screen of sections' });
    expect(designer.getState().canUndo).toBe(false);
  });

  it('refuses an answer that is not a page at all', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'Anything');
    app.answer('a form' as unknown as Page);
    const result = await run.done;
    expect(result.status === 'refused' && result.problem).toMatch(/^The assistant’s form cannot be used: /);
  });

  it('says when its form is the same as the page, and makes no edit', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'Nothing');
    app.answer(designer.getPage());
    expect(await run.done).toEqual({ status: 'unchanged' });
    expect(designer.getState().canUndo).toBe(false);
  });

  it('says what went wrong when the assistant fails', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'Anything');
    app.fail(new Error('The service is busy, try again in a minute'));
    expect(await run.done).toEqual({ status: 'failed', problem: 'The assistant could not do it: The service is busy, try again in a minute' });
    const quiet = later();
    const second = askAssistant(designer, quiet.assistant, 'Anything');
    quiet.fail('no reason');
    expect(await second.done).toEqual({ status: 'failed', problem: 'The assistant could not do it.' });
  });

  it('is cancelled: told to stop, and its late answer is let go', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'A feedback form');
    run.cancel();
    expect(app.asked[0].signal?.aborted).toBe(true);
    expect(await run.done).toEqual({ status: 'cancelled' });
    app.answer(SURVEY_TEMPLATES[0].page);
    await tick();
    expect(designer.getState().canUndo).toBe(false);
    expect(Object.keys(designer.getPage().fields)).toEqual([]);
  });

  it('lets go of a failure that comes after it was cancelled', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, 'A feedback form');
    run.cancel();
    app.fail(new Error('aborted'));
    expect(await run.done).toEqual({ status: 'cancelled' });
  });

  it('asks for words before it asks the assistant', async () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const app = later();
    const run = askAssistant(designer, app.assistant, '   ');
    expect(app.asked).toEqual([]);
    expect(await run.done).toEqual({ status: 'refused', problem: 'Say what the form is for, and what it should ask.' });
  });

  it('is the designer’s, when the app gives one to the designer', () => {
    const app = later();
    expect(createDesigner({ page: blankPage('survey', 'S'), assistant: app.assistant }).assistant()).toBe(app.assistant);
    expect(createDesigner({ page: blankPage('survey', 'S') }).assistant()).toBeNull();
  });
});
