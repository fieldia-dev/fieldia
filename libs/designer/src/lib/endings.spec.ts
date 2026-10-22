import { validatePage, type Page } from '@fieldia/core';
import { answerButton, withAnswers } from './answer-picker';
import { elementFactory, optionsEditor } from './chrome';
import { createDesigner } from './designer';
import { DESIGNER_WORDS } from './designer-words';
import { endingsEditor } from './endings-editor';
import { pageChanges } from './page-checks';
import { pageProperties } from './panel-page';
import { mountSurveyEditor } from './survey-editor';

/**
 * A form's endings as the designer sets them — each shown by the answers, the last shown otherwise, a new one before
 * it, said as a change and refused in words where the page check refuses it — on the screen's panel and under a
 * survey's pages; and the button beside a box of words that puts an answer in them.
 */

/** A clinic's feedback: a branch, a yes or no, a rating. */
const feedback = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.10',
  id: 'feedback',
  title: 'Feedback',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name' },
    branch: { type: 'selection', label: 'Branch', options: [{ value: 'zamalek', label: 'Zamalek' }, { value: 'maadi', label: 'Maadi' }] },
    again: { type: 'boolean', label: 'Would you come again?' },
    photo: { type: 'image', label: 'A photo' },
  },
  layout: {
    type: 'wizard',
    id: 'steps',
    children: [
      {
        type: 'step',
        id: 'step-1',
        label: 'Your visit',
        children: [
          { type: 'field', id: 'f-name', field: 'name' },
          { type: 'field', id: 'f-branch', field: 'branch' },
          { type: 'field', id: 'f-again', field: 'again' },
          { type: 'field', id: 'f-photo', field: 'photo' },
        ],
      },
    ],
  },
  ...more,
});

afterEach(() => document.body.replaceChildren());

describe('a form’s endings, as the designer sets them', () => {
  it('adds the one shown otherwise first, then others before it shown by the first question it can test', () => {
    const designer = createDesigner({ page: feedback() });
    const before = designer.getPage();
    expect(designer.setEnding(0, { title: 'Thank you, {name}' })).toBe(true);
    expect(designer.getPage().endings).toEqual([{ title: 'Thank you, {name}' }]);
    expect(designer.setEnding(1, { title: 'See you in Zamalek', when: "branch == 'zamalek'" })).toBe(true);
    expect(designer.getPage().endings).toEqual([{ title: 'See you in Zamalek', when: "branch == 'zamalek'" }, { title: 'Thank you, {name}' }]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toEqual(['What it says once sent changed: 2 endings']);
    expect(DESIGNER_WORDS.ar.endings.changed(2)).toBe('تغيّر ما يقوله بعد الإرسال: نهايتان');
  });

  it('changes an ending’s words and button, empties taking them away, and false for no button', () => {
    const designer = createDesigner({ page: feedback({ endings: [{ title: 'Thanks' }] }) });
    expect(designer.setEnding(0, { text: 'Your reference is {id}.', again: 'Send another' })).toBe(true);
    expect(designer.getPage().endings).toEqual([{ title: 'Thanks', text: 'Your reference is {id}.', again: 'Send another' }]);
    expect(designer.setEnding(0, { again: false, text: ' ' })).toBe(true);
    expect(designer.getPage().endings).toEqual([{ title: 'Thanks', again: false }]);
    expect(designer.setEnding(0, { again: null })).toBe(true);
    expect(designer.getPage().endings).toEqual([{ title: 'Thanks' }]);
  });

  it('typing in one box is one undo step', () => {
    const designer = createDesigner({ page: feedback({ endings: [{ title: 'T' }] }) });
    designer.setEnding(0, { title: 'Th' }, { typing: true });
    designer.setEnding(0, { title: 'Thanks' }, { typing: true });
    designer.undo();
    expect(designer.getPage().endings).toEqual([{ title: 'T' }]);
  });

  it('moves one among them and takes one away, the setting with the last', () => {
    const designer = createDesigner({ page: feedback({ endings: [{ when: 'again', title: 'A' }, { when: 'not again', title: 'B' }, { title: 'C' }] }) });
    expect(designer.moveEnding(0, 1)).toBe(true);
    expect(designer.getPage().endings?.map((e) => e.title)).toEqual(['B', 'A', 'C']);
    expect(designer.setEnding(1, null)).toBe(true);
    expect(designer.setEnding(0, null)).toBe(true);
    expect(designer.setEnding(0, null)).toBe(true);
    expect(designer.getPage().endings).toBeUndefined();
  });

  it('refuses in words what the page check refuses: a name that is no field, one moved past the default, a record’s page', () => {
    const designer = createDesigner({ page: feedback({ endings: [{ when: 'again', title: 'A' }, { title: 'B' }] }) });
    expect(designer.setEnding(1, { title: 'Thanks {nam}' })).toBe(false);
    expect(designer.getState().issues.join()).toContain('no field "nam"');
    expect(designer.moveEnding(1, 0)).toBe(false);
    expect(designer.getState().issues.join()).toContain('never shown');
    expect(designer.getPage().endings?.map((e) => e.title)).toEqual(['A', 'B']);
    const record = createDesigner({ page: { ...feedback(), data: { kind: 'record', model: 'feedback' } } });
    expect(record.setEnding(0, { title: 'Thanks' })).toBe(false);
    expect(record.getState().issues).toEqual(['Endings are for a form that collects responses: a record’s screen stays on its record after a save']);
  });
});

describe('the endings’ editor', () => {
  const el = elementFactory(document);
  const type = (box: HTMLInputElement | HTMLTextAreaElement, words: string) => {
    box.focus();
    box.value = words;
    box.dispatchEvent(new Event('input'));
  };

  it('lists each ending with when it shows, its title, words and button, and adds one before the default', () => {
    const designer = createDesigner({ page: feedback() });
    const view = endingsEditor(el, designer);
    document.body.append(view.element);
    const update = () => view.update(designer.getPage());
    update();
    const add = view.element.querySelector('.fd-endings-add') as HTMLButtonElement;
    expect(view.element.textContent).toContain('Without one, people see “Thank you. Your answers were sent.”');
    add.click();
    update();
    expect(designer.getPage().endings).toEqual([{ title: 'Thank you' }]);
    const card = (n: number) => view.element.querySelector(`[data-ending="${n}"]`) as HTMLElement;
    expect(card(0).querySelector('.fd-ending-otherwise')?.hasAttribute('hidden')).toBe(false);
    add.click();
    update();
    // Before the default, shown by the first question it can test: the branch, its first answer.
    expect(designer.getPage().endings).toEqual([{ title: 'Thank you', when: "branch == 'zamalek'" }, { title: 'Thank you' }]);
    expect((card(0).querySelector('.fd-when-field') as HTMLSelectElement).value).toBe('branch');
    expect(card(0).querySelector('.fd-ending-otherwise')?.hasAttribute('hidden')).toBe(true);
    type(card(0).querySelector('.fd-ending-title') as HTMLInputElement, 'See you in {branch}');
    type(card(0).querySelector('.fd-ending-text') as HTMLTextAreaElement, 'Your reference is {id}.');
    const none = card(0).querySelector('.fd-ending-none input') as HTMLInputElement;
    none.checked = true;
    none.dispatchEvent(new Event('change'));
    update();
    expect(designer.getPage().endings?.[0]).toEqual({ title: 'See you in {branch}', text: 'Your reference is {id}.', when: "branch == 'zamalek'", again: false });
    expect((card(0).querySelector('.fd-ending-again') as HTMLInputElement).hidden).toBe(true);
    // The default stays last: it moves nowhere; the one before it moves up only.
    expect([...card(1).querySelectorAll<HTMLElement>('.fd-ending-head .fd-icon-button')].map((b) => b.hidden)).toEqual([true, true, false]);
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('says why no more can be added where no question can choose one', () => {
    const page = feedback({ endings: [{ title: 'Thanks' }] });
    const designer = createDesigner({ page: { ...page, fields: { name: page.fields['name'] }, layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }] } } });
    const view = endingsEditor(el, designer);
    view.update(designer.getPage());
    expect((view.element.querySelector('.fd-endings-add') as HTMLElement).hidden).toBe(true);
    expect(view.element.textContent).toContain('Another ending needs a question to choose it by');
  });

  it('is on the screen’s panel for a form of responses, and not for a record’s', () => {
    const designer = createDesigner({ page: feedback({ layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }] } }) });
    const view = pageProperties(el, designer);
    view.update(designer.getPage());
    expect((view.element.querySelector('[data-setting="Once it is sent"]') as HTMLElement).hidden).toBe(false);
    const record = createDesigner({ page: { ...designer.getPage(), data: { kind: 'record', model: 'feedback' } } });
    const other = pageProperties(el, record);
    other.update(record.getPage());
    expect((other.element.querySelector('[data-setting="Once it is sent"]') as HTMLElement).hidden).toBe(true);
  });

  it('is under a survey’s pages, in its editor', () => {
    const designer = createDesigner({ page: feedback({ endings: [{ title: 'Thanks' }] }) });
    const host = document.createElement('div');
    document.body.append(host);
    const editor = mountSurveyEditor(host, { designer });
    expect(host.querySelector('.fd-survey-endings .fd-ending-title')).not.toBeNull();
    expect((host.querySelector('.fd-survey-endings .fd-ending-title') as HTMLInputElement).value).toBe('Thanks');
    // A page's title and a question's words have the button that puts an answer in.
    expect(host.querySelector('.fd-step-head-row .fd-answer-picker')).not.toBeNull();
    editor.destroy();
  });
});

describe('the button that puts an answer in words', () => {
  const el = elementFactory(document);

  it('offers the page’s questions whose answers read as words, and an ending the reference; puts {name} at the caret', () => {
    const designer = createDesigner({ page: feedback() });
    const box = el('input', { 'aria-label': 'Title' }) as HTMLInputElement;
    const typed: string[] = [];
    box.addEventListener('input', () => typed.push(box.value));
    const wrap = withAnswers(el, designer, box, { sent: true });
    document.body.append(wrap);
    box.value = 'Thanks,  see you';
    box.setSelectionRange(8, 8);
    const button = wrap.querySelector('.fd-answer-picker') as HTMLButtonElement;
    expect(button.getAttribute('aria-label')).toBe('Put an answer in: Title');
    button.click();
    const items = [...document.querySelectorAll('.fd-menu .fd-menu-item')];
    // A photo has no words to put in.
    expect(items.map((item) => item.textContent)).toEqual(['The reference your app gives it', 'Your name', 'Branch', 'Would you come again?']);
    (items[1] as HTMLButtonElement).click();
    expect(box.value).toBe('Thanks, {name} see you');
    expect(typed).toEqual(['Thanks, {name} see you']);
    expect(document.activeElement).toBe(box);
    expect(box.selectionStart).toBe(14);
  });

  it('puts in what to say while the answer is empty, from When empty; keys move, Escape gives the focus back', () => {
    const designer = createDesigner({ page: feedback() });
    const box = el('input', { 'aria-label': 'Label' }) as HTMLInputElement;
    const wrap = withAnswers(el, designer, box);
    document.body.append(wrap);
    box.value = 'How was your visit to ?';
    box.setSelectionRange(22, 22);
    const button = wrap.querySelector('.fd-answer-picker') as HTMLButtonElement;
    button.click();
    const dialog = document.querySelector('[role="dialog"].fd-answer-menu') as HTMLElement;
    expect(button.getAttribute('aria-expanded')).toBe('true');
    // The first answer takes the focus; the arrows move on.
    expect((document.activeElement as HTMLElement).textContent).toBe('Your name');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect((document.activeElement as HTMLElement).textContent).toBe('Branch');
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.fd-answer-menu')).toBeNull();
    expect(document.activeElement).toBe(button);
    button.click();
    const empty = document.querySelector('.fd-answer-empty') as HTMLInputElement;
    expect(empty.getAttribute('aria-label')).toBe('When empty');
    // Braces in it would end the name early: they are left out.
    empty.value = ' this {branch} ';
    (document.querySelector('[data-answer="branch"]') as HTMLButtonElement).click();
    expect(box.value).toBe('How was your visit to {branch|this branch}?');
    expect(DESIGNER_WORDS.ar.endings.whenEmpty).toBe('عندما تكون فارغة');
  });

  it('is on each option’s row, putting the answer in its words', () => {
    const page = feedback();
    const designer = createDesigner({ page: { ...page, fields: { ...page.fields, reach: { type: 'selection', label: 'Reach me', options: [{ value: 'call', label: 'Call me' }, { value: 'mail', label: 'Email' }] } }, layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-branch', field: 'branch' }, { type: 'field', id: 'f-reach', field: 'reach' }] } } });
    const view = optionsEditor(el, designer, 'f-reach');
    document.body.append(view.element);
    const update = () => view.update(designer.getPage().fields['reach'], { type: 'field', id: 'f-reach', field: 'reach' });
    update();
    const rows = [...view.element.querySelectorAll('.fd-q-option')];
    expect(rows.map((row) => row.querySelector('.fd-answer-picker')?.getAttribute('aria-label'))).toEqual(['Put an answer in: Option 1', 'Put an answer in: Option 2']);
    const input = rows[0].querySelector('input') as HTMLInputElement;
    input.focus();
    input.setSelectionRange(7, 7);
    (rows[0].querySelector('.fd-answer-picker') as HTMLButtonElement).click();
    (document.querySelector('[data-answer="branch"]') as HTMLButtonElement).click();
    expect((designer.getPage().fields['reach'] as { options: { label: string }[] }).options[0].label).toBe('Call me{branch}');
    update();
    // Its × is still the row's own.
    expect(rows[0].querySelector('.fd-icon-button')?.getAttribute('aria-label')).toBe('Remove option Call me{branch}');
  });

  it('offers no reference outside an ending', () => {
    const designer = createDesigner({ page: feedback() });
    const box = el('input', { 'aria-label': 'Label' }) as HTMLInputElement;
    document.body.append(box);
    const button = answerButton(el, designer, box);
    document.body.append(button);
    button.click();
    expect([...document.querySelectorAll('.fd-menu .fd-menu-item')].map((item) => item.textContent)).toEqual(['Your name', 'Branch', 'Would you come again?']);
  });
});
