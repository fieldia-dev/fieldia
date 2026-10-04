import type { Page } from '@fieldia/core';
import type { DesignerAssistant } from './assistant';
import { blankPage, createDesigner, type Designer } from './designer';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { isBlank, SCREEN_TEMPLATES, SURVEY_TEMPLATES } from './templates';

/**
 * The app's assistant in the editors: a box to describe the form in a blank
 * page's empty state, and "Ask the assistant…" in Find anything once the
 * page has parts. Asked, it is busy with a way to cancel; answered, its form
 * is in place and what changed is said with Undo; a failure is said in words.
 * Without an assistant, nothing about one shows.
 */

/** An assistant that answers when told to. */
function later(extra: Partial<DesignerAssistant> = {}) {
  let answer: (page: Page) => void = () => undefined;
  let fail: (error: unknown) => void = () => undefined;
  const asked: string[] = [];
  const assistant: DesignerAssistant = {
    describe(request) {
      asked.push(request.prompt);
      return new Promise<Page>((resolve, reject) => {
        answer = resolve;
        fail = reject;
      });
    },
    ...extra,
  };
  return { assistant, asked, answer: (page: Page) => answer(page), fail: (error: unknown) => fail(error) };
}
const settle = async () => {
  for (let i = 0; i < 3; i++) await new Promise((resolve) => setTimeout(resolve, 0));
};

let surveyHandle: SurveyEditorHandle | null = null;
let screenHandle: ScreenEditorHandle | null = null;
afterEach(() => {
  surveyHandle?.destroy();
  screenHandle?.destroy();
  surveyHandle = screenHandle = null;
  document.body.replaceChildren();
});
function host() {
  const element = document.createElement('div');
  document.body.append(element);
  return element;
}
function survey(assistant?: DesignerAssistant, page: Page = blankPage('survey', 'Course feedback')) {
  const designer = createDesigner({ page });
  const root = host();
  surveyHandle = mountSurveyEditor(root, { designer, assistant });
  return { root, designer };
}

const shown = (element: Element | null | undefined) => !!element && !element.closest('[hidden]');
const box = (root: Element) => root.querySelector<HTMLFormElement>('.fd-start .fd-assist') as HTMLFormElement;
const prompt = (scope: Element) => scope.querySelector<HTMLTextAreaElement>('textarea') as HTMLTextAreaElement;
const button = (scope: Element, name: string) => [...scope.querySelectorAll<HTMLButtonElement>('button')].find((b) => shown(b) && (b.getAttribute('aria-label') ?? b.textContent?.trim()) === name);
function type(area: HTMLTextAreaElement, text: string) {
  area.focus();
  area.value = text;
  area.dispatchEvent(new Event('input', { bubbles: true }));
}
const notice = (root: Element) => root.querySelector<HTMLElement>('.fd-start-done') as HTMLElement;
function find(words: string): HTMLElement | undefined {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
  const found = [...document.querySelectorAll<HTMLElement>('.fd-find-option')].find((o) => o.querySelector('.fd-find-label')?.textContent === words);
  if (!found) document.querySelector('.fd-find-backdrop')?.remove();
  return found;
}
const fieldLabels = (designer: Designer) => Object.values(designer.getPage().fields).map((f) => f.label);

describe('the assistant in a blank page’s empty state', () => {
  it('is a box to describe the form, named and explained as the app says', () => {
    const app = later({ name: 'Demo assistant', note: 'A stand-in for your app’s own.' });
    const { root } = survey(app.assistant);
    const form = box(root);
    expect(shown(form)).toBe(true);
    const area = prompt(form);
    expect(form.querySelector(`label[for="${area.id}"]`)?.textContent).toBe('Describe the form you need');
    expect(form.querySelector('.fd-assist-name')?.textContent).toBe('Demo assistant');
    expect(form.querySelector('.fd-assist-note')?.textContent).toBe('A stand-in for your app’s own.');
    expect(button(form, 'Build it')).toBeDefined();
    expect(button(form, 'Cancel')).toBeUndefined();
  });

  it('is busy while it is asked, with Cancel; then its form is in place, what changed said, with Undo', async () => {
    const app = later();
    const { root, designer } = survey(app.assistant);
    const form = box(root);
    type(prompt(form), 'A feedback form');
    button(form, 'Build it')?.click();
    expect(app.asked).toEqual(['A feedback form']);
    expect(form.getAttribute('aria-busy')).toBe('true');
    expect(shown(form.querySelector('.fd-assist-busy'))).toBe(true);
    expect(form.querySelector('.fd-assist-busy')?.textContent).toBe('Building your form…');
    expect(button(form, 'Build it')).toBeUndefined();
    expect(document.activeElement).toBe(button(form, 'Cancel'));
    expect(prompt(form).readOnly).toBe(true);

    app.answer(SURVEY_TEMPLATES[0].page);
    await settle();
    expect(fieldLabels(designer)).toContain('How was it overall?');
    const said = notice(root);
    expect(shown(said)).toBe(true);
    expect(said.querySelector('.fd-start-done-words')?.textContent).toBe('The assistant built the form:');
    expect([...said.querySelectorAll('li')].map((li) => li.textContent)).toContain('Added “How was it overall?”');
    expect(document.activeElement).toBe(said);
    button(said, 'Undo')?.click();
    expect(isBlank(designer.getPage())).toBe(true);
    // The box is back as it was, ready for other words.
    expect(shown(box(root))).toBe(true);
    expect(box(root).getAttribute('aria-busy')).toBe('false');
    expect(button(box(root), 'Build it')).toBeDefined();
  });

  it('asks with Ctrl+Enter too, and not with Enter alone', () => {
    const app = later();
    const { root } = survey(app.assistant);
    const area = prompt(box(root));
    type(area, 'A feedback form');
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    expect(app.asked).toEqual([]);
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(app.asked).toEqual(['A feedback form']);
  });

  it('is cancelled: back to the words, and its late answer changes nothing', async () => {
    const app = later();
    const { root, designer } = survey(app.assistant);
    const form = box(root);
    type(prompt(form), 'A feedback form');
    button(form, 'Build it')?.click();
    button(form, 'Cancel')?.click();
    expect(form.getAttribute('aria-busy')).toBe('false');
    expect(form.querySelector('.fd-assist-said')?.textContent).toBe('Cancelled. Nothing was changed.');
    expect(document.activeElement).toBe(prompt(form));
    expect(prompt(form).value).toBe('A feedback form');
    app.answer(SURVEY_TEMPLATES[0].page);
    await settle();
    expect(isBlank(designer.getPage())).toBe(true);
    expect(shown(notice(root))).toBe(false);
  });

  it('says in words why it could not, keeping the words to try again', async () => {
    const app = later();
    const { root, designer } = survey(app.assistant);
    const form = box(root);
    type(prompt(form), 'A feedback form');
    button(form, 'Build it')?.click();
    app.fail(new Error('The service is busy, try again in a minute'));
    await settle();
    const problem = form.querySelector('.fd-assist-problem') as HTMLElement;
    expect(shown(problem)).toBe(true);
    expect(problem.getAttribute('role')).toBe('alert');
    expect(problem.textContent).toBe('The assistant could not do it: The service is busy, try again in a minute');
    expect(button(form, 'Build it')).toBeDefined();
    expect(prompt(form).value).toBe('A feedback form');
    expect(isBlank(designer.getPage())).toBe(true);
    // A form it cannot use is said too; a new try clears the last problem.
    button(form, 'Build it')?.click();
    expect(shown(problem)).toBe(false);
    app.answer(SCREEN_TEMPLATES[0].page);
    await settle();
    expect(problem.textContent).toBe('The assistant’s form cannot be used: A survey is made of pages of questions: this is a screen of sections');
  });

  it('asks for words before asking', () => {
    const app = later();
    const { root } = survey(app.assistant);
    button(box(root), 'Build it')?.click();
    expect(app.asked).toEqual([]);
    expect(box(root).querySelector('.fd-assist-problem')?.textContent).toBe('Say what the form is for, and what it should ask.');
    expect(document.activeElement).toBe(prompt(box(root)));
  });

  it('is in a blank screen’s empty state too, from the designer’s own assistant', () => {
    const app = later();
    const designer = createDesigner({ page: blankPage('screen', 'Supplier'), assistant: app.assistant });
    screenHandle = mountScreenEditor(host(), { designer });
    expect(shown(document.querySelector('.fd-start .fd-assist'))).toBe(true);
  });
});

describe('the assistant from Find anything', () => {
  it('is “Ask the assistant…” once the page has parts, in a dialog that closes with its form in place', async () => {
    const app = later({ name: 'Demo assistant' });
    const { root, designer } = survey(app.assistant, SURVEY_TEMPLATES[0].page);
    const item = find('Ask the assistant…');
    expect(item?.querySelector('.fd-find-hint')?.textContent).toBe('Demo assistant');
    item?.click();
    const dialog = document.querySelector<HTMLElement>('[role="dialog"].fd-assist-dialog') as HTMLElement;
    expect(dialog).not.toBeNull();
    expect(document.getElementById(dialog.getAttribute('aria-labelledby') ?? '')?.textContent).toBe('Ask the assistant');
    const area = prompt(dialog);
    expect(document.activeElement).toBe(area);
    expect(dialog.querySelector(`label[for="${area.id}"]`)?.textContent).toBe('What should change?');
    type(area, 'Make the email required');
    button(dialog, 'Ask')?.click();
    expect(dialog.querySelector('.fd-assist-busy')?.textContent).toBe('Changing your form…');
    const next = JSON.parse(JSON.stringify(designer.getPage())) as Page;
    (next.fields['email'] as { required?: boolean }).required = true;
    app.answer(next);
    await settle();
    expect(dialog.isConnected).toBe(false);
    const said = notice(root);
    expect(said.querySelector('.fd-start-done-words')?.textContent).toBe('The assistant changed the form:');
    expect([...said.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['“Your email, for a reply” is now required']);
    expect(document.activeElement).toBe(said);
  });

  it('cancels with Escape and closes, letting a late answer go', async () => {
    const app = later();
    const { designer } = survey(app.assistant, SURVEY_TEMPLATES[0].page);
    find('Ask the assistant…')?.click();
    const dialog = document.querySelector<HTMLElement>('.fd-assist-dialog') as HTMLElement;
    type(prompt(dialog), 'Add a date');
    button(dialog, 'Ask')?.click();
    const before = designer.getPage();
    button(dialog, 'Cancel')?.focus();
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    expect(dialog.isConnected).toBe(false);
    app.answer(SURVEY_TEMPLATES[1].page);
    await settle();
    expect(designer.getPage()).toBe(before);
  });

  it('is not in Find anything while the empty state has its box', () => {
    const app = later();
    survey(app.assistant);
    expect(find('Ask the assistant…')).toBeUndefined();
  });
});

describe('without an assistant', () => {
  it('shows nothing about one: no box, no item to find', () => {
    const { root } = survey();
    expect(root.querySelector('.fd-assist')).toBeNull();
    expect(root.textContent?.toLowerCase()).not.toContain('assistant');
    expect(find('Ask the assistant…')).toBeUndefined();
    surveyHandle?.destroy();
    const full = survey(undefined, SURVEY_TEMPLATES[0].page);
    expect(find('Ask the assistant…')).toBeUndefined();
    expect(full.root.textContent?.toLowerCase()).not.toContain('assistant');
  });
});
