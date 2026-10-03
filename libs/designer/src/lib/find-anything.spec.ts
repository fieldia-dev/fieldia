import type { Field, FieldNode, ListNode, Page, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountScreenEditor, type ScreenEditorHandle } from './screen-editor';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/** Find anything: ⌘K, or / when not typing, to add a field or a kind, go to one, or run an action. */

let handle: SurveyEditorHandle | ScreenEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function survey() {
  const host = document.createElement('div');
  document.body.append(host);
  const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
  const name = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(name, { label: 'Your name' });
  const email = designer.addQuestion('email') as string;
  designer.updateQuestion(email, { label: 'Email' });
  designer.select(null);
  handle = mountSurveyEditor(host, { designer });
  return { host, designer, name, email };
}
const key = (k: string, options: KeyboardEventInit = {}, target: Element = document.activeElement ?? document.body) =>
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...options }));
const box = () => document.querySelector('.fd-find input') as HTMLInputElement | null;
const options = () => [...document.querySelectorAll('.fd-find [role="option"]')].map((o) => o.querySelector('.fd-find-label')?.textContent);
const active = () => document.querySelector('.fd-find [role="option"][aria-selected="true"] .fd-find-label')?.textContent;
function find(words: string) {
  const input = box() as HTMLInputElement;
  input.value = words;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
const nodes = (page: Page) => (page.layout as WizardNode).children.flatMap((s) => s.children as FieldNode[]);

describe('find anything', () => {
  it('opens with ⌘K or Ctrl+K, the cursor in its box, and closes with Escape', () => {
    survey();
    key('k', { metaKey: true }, document.body);
    expect(document.activeElement).toBe(box());
    expect(box()?.getAttribute('aria-label')).toBe('Find anything');
    key('Escape', {}, box() as HTMLInputElement);
    expect(box()).toBeNull();
    key('k', { ctrlKey: true }, document.body);
    expect(box()).not.toBeNull();
  });

  it('opens with / when not typing, and leaves / to a box being typed in', () => {
    const { host, designer, name } = survey();
    key('/', {}, document.body);
    expect(box()).not.toBeNull();
    key('Escape', {}, box() as HTMLInputElement);
    designer.select(name);
    const words = host.querySelector('.fd-q-selected .fd-q-label') as HTMLInputElement;
    const typed = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
    words.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(false);
    expect(box()).toBeNull();
  });

  it('adds a question of the kind found, after the one picked, its words ready to type', () => {
    const { host, designer, name } = survey();
    designer.select(name);
    key('k', { metaKey: true }, document.body);
    find('rating');
    expect(options()).toEqual(['Add a question: Rating']);
    key('Enter', {}, box() as HTMLInputElement);
    expect(box()).toBeNull();
    expect(nodes(designer.getPage()).map((n) => n.widget ?? '')).toEqual(['', 'rating', 'email']);
    expect(document.activeElement).toBe(host.querySelector('.fd-q-selected .fd-q-label'));
  });

  it('goes to a question by its words, every word counting, wherever they are', () => {
    const { host, designer, email } = survey();
    key('k', { metaKey: true }, document.body);
    find('go mail');
    expect(options()).toEqual(['Go to “Email”']);
    key('Enter', {}, box() as HTMLInputElement);
    expect(designer.getState().selected).toBe(email);
    expect(document.activeElement).toBe(host.querySelector('.fd-q-selected .fd-q-label'));
  });

  it('moves through what it found with the arrows, and runs what is clicked', () => {
    const { host } = survey();
    key('k', { metaKey: true }, document.body);
    find('publish');
    expect(options()).toEqual(['Publish']);
    find('try');
    expect(active()).toBe(options()[0]);
    key('ArrowDown', {}, box() as HTMLInputElement);
    expect(active()).toBe(options()[1]);
    expect(box()?.getAttribute('aria-activedescendant')).toBe(document.querySelector('.fd-find [role="option"][aria-selected="true"]')?.id);
    find('checks');
    (document.querySelector('.fd-find [role="option"]') as HTMLElement).click();
    expect(host.ownerDocument.querySelector('.fd-checks')).not.toBeNull();
  });

  it('says when nothing is found', () => {
    survey();
    key('k', { metaKey: true }, document.body);
    find('zebra');
    expect(options()).toEqual([]);
    expect(document.querySelector('.fd-find-none')?.textContent).toBe('Nothing by that name.');
  });
});

describe('find anything — a screen with a model, and a list', () => {
  const model: Record<string, Field> = { name: { type: 'char', label: 'Name' }, email: { type: 'char', label: 'Email' }, state: { type: 'selection', label: 'Status', options: [{ value: 'a', label: 'Active' }] } };
  function screen(kind: 'screen' | 'list') {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: blankPage(kind, 'Customers'), model });
    handle = mountScreenEditor(host, { designer });
    return { host, designer };
  }

  it('adds a field the model has, as the model has it', () => {
    const { designer } = screen('screen');
    key('k', { metaKey: true }, document.body);
    find('email');
    expect(options()).toEqual(['Add “Email”', 'Add a field: Email']);
    key('Enter', {}, box() as HTMLInputElement);
    expect(designer.getPage().fields['email']).toEqual(model['email']);
  });

  it('adds a column to a list', () => {
    const { designer } = screen('list');
    key('k', { metaKey: true }, document.body);
    find('status');
    expect(options()).toEqual(['Add the column “Status”']);
    key('Enter', {}, box() as HTMLInputElement);
    expect((designer.getPage().layout as ListNode).columns).toEqual(['name', 'state']);
  });
});
