import type { Field, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** Beside the toolbox: the page as a tree to pick from, and the data behind it, a made-up record on the canvas. */

let handle: SurveyEditorHandle | ScreenEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

const tab = (host: Element, name: string) => host.querySelector(`.fd-rail [role="tab"][data-rail="${name}"]`) as HTMLButtonElement;
const rows = (host: Element) => [...host.querySelectorAll('.fd-outline [data-pick]')].map((b) => `${'  '.repeat(Number((b as HTMLElement).dataset['level']))}${b.querySelector('.fd-outline-label')?.textContent}`);
const pick = (host: Element, words: string) => ([...host.querySelectorAll<HTMLElement>('.fd-outline [data-pick]')].find((b) => b.querySelector('.fd-outline-label')?.textContent === words) as HTMLElement).click();
const shown = (element: Element | null) => !!element && !element.closest('[hidden]');

describe('the rail: Add, Outline and Data', () => {
  it('shows the toolbox first, and the other two a tab away', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountSurveyEditor(host, { designer: createDesigner({ page: blankPage('survey', 'Feedback') }) });
    expect(tab(host, 'add').getAttribute('aria-selected')).toBe('true');
    expect(shown(host.querySelector('.fd-toolbox'))).toBe(true);
    tab(host, 'outline').click();
    expect(tab(host, 'outline').getAttribute('aria-selected')).toBe('true');
    expect(shown(host.querySelector('.fd-toolbox'))).toBe(false);
    expect(shown(host.querySelector('.fd-outline'))).toBe(true);
  });

  it('outlines a survey: its pages and their questions, marking what shows only for some answers; a pick opens it', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const coming = designer.addQuestion('yes-no') as string;
    designer.updateQuestion(coming, { label: 'Coming?' });
    const why = designer.addQuestion('paragraph') as string;
    designer.updateQuestion(why, { label: 'Why not?' });
    designer.setCondition(why, { field: ((designer.getPage().layout as WizardNode).children[0].children[0] as { field: string }).field, equals: false });
    designer.select(null);
    handle = mountSurveyEditor(host, { designer });
    tab(host, 'outline').click();
    expect(rows(host)).toEqual(['Page 1', '  Coming?', '  Why not?']);
    expect(host.querySelector(`.fd-outline [data-pick="${why}"] .fd-outline-when`)).not.toBeNull();
    expect(host.querySelector(`.fd-outline [data-pick="${coming}"] .fd-outline-when`)).toBeNull();
    pick(host, 'Why not?');
    expect(designer.getState().selected).toBe(why);
    expect(host.querySelector(`.fd-outline [data-pick="${why}"]`)?.getAttribute('aria-selected')).toBe('true');
    // Outline still on show, following what is picked.
    expect(tab(host, 'outline').getAttribute('aria-selected')).toBe('true');
  });

  it('says where a survey’s answers go', () => {
    const host = document.createElement('div');
    document.body.append(host);
    handle = mountSurveyEditor(host, { designer: createDesigner({ page: blankPage('survey', 'Feedback') }) });
    tab(host, 'data').click();
    expect(host.querySelector('.fd-data')?.textContent).toContain('one record per person, one field per question');
  });
});

describe('the rail on a record’s screen', () => {
  const model: Record<string, Field> = {
    name: { type: 'char', label: 'Name' },
    email: { type: 'char', label: 'Email' },
    credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
  };
  function sheet() {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
    designer.addModelField('email', { parent: 'section-1' });
    designer.select(null);
    handle = mountScreenEditor(host, { designer });
    // The email field's own id on the page.
    const email = (designer.getPage().layout as unknown as { children: { children: { id: string; field: string }[] }[] }).children[0].children.find((n) => n.field === 'email')?.id as string;
    return { host, designer, email };
  }

  it('outlines the sheet: its sections and their fields', () => {
    const { host, designer, email } = sheet();
    tab(host, 'outline').click();
    expect(rows(host)).toEqual(['Untitled section', '  Email']);
    pick(host, 'Email');
    expect(designer.getState().selected).toBe(email);
  });

  it('lists the model’s fields, on the page or not, and adds one not used', () => {
    const { host, designer } = sheet();
    tab(host, 'data').click();
    const data = host.querySelector('.fd-data') as HTMLElement;
    expect(data.querySelector('.fd-data-model')?.textContent).toContain('customer');
    expect(data.querySelector('.fd-data-count')?.textContent).toBe('3 fields · 2 on this page');
    const row = (name: string) => data.querySelector(`[data-field="${name}"]`) as HTMLElement;
    expect(row('email').querySelector('.fd-data-used')?.textContent).toBe('On the page');
    expect(row('credit_limit').querySelector('.fd-data-used')?.textContent).toBe('Not used');
    (row('credit_limit').querySelector('button') as HTMLButtonElement).click();
    expect(designer.getPage().fields['credit_limit']).toEqual(model['credit_limit']);
    expect((host.querySelector('.fd-data [data-field="credit_limit"] .fd-data-used') as HTMLElement).textContent).toBe('On the page');
  });

  it('fills the canvas with a made-up record, so it reads like the real thing, and empties it again', () => {
    const { host, email: id } = sheet();
    tab(host, 'data').click();
    const email = () => host.querySelector(`.fd-canvas-field[data-node="${id}"] input`) as HTMLInputElement;
    expect(email().value).toBe('');
    const title = host.querySelector('.fd-canvas-title') as HTMLElement;
    expect(title.textContent).toBe('Name');
    (host.querySelector('.fd-data [data-sample="0"]') as HTMLButtonElement).click();
    expect(email().value).toBe('hello@acme.example');
    // The record names itself in the title.
    expect(title.textContent).toBe('Acme Trading');
    (host.querySelector('.fd-data [data-sample="1"]') as HTMLButtonElement).click();
    expect(email().value).toBe('hello@blue.example');
    (host.querySelector('.fd-data [data-sample="none"]') as HTMLButtonElement).click();
    expect(email().value).toBe('');
  });

  it('outlines a list by its columns, a pick picking the column', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: blankPage('list', 'Customers'), model });
    designer.addColumn('email');
    handle = mountScreenEditor(host, { designer });
    tab(host, 'outline').click();
    expect(rows(host)).toEqual(['Name', 'Email']);
    pick(host, 'Email');
    expect(designer.getState().selected).toBe('column:email');
  });
});
