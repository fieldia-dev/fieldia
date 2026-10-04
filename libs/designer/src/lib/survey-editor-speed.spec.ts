import type { Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/**
 * Typing in one question of a long survey redraws that question, not the
 * others: a card, or a page's head, whose question or page did not change is
 * left as it was drawn — and one that did change is drawn again.
 */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function mount() {
  const host = document.createElement('div');
  document.body.append(host);
  const designer = createDesigner({ page: blankPage('survey', 'Visit') as Page });
  const ids = ['Name', 'Email', 'Phone'].map((words) => {
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: words });
    return id;
  });
  designer.addContainer('Page 2');
  const later = designer.addQuestion('dropdown') as string;
  designer.select(null);
  handle = mountSurveyEditor(host, { designer });
  return { host, designer, ids, later };
}
const card = (host: Element, id: string) => host.querySelector(`.fd-q[data-node="${id}"]`) as HTMLElement;
/** The words of a closed card, as the text drawn: written again, they are a new text. */
const words = (host: Element, id: string) => card(host, id).querySelector('.fd-q-text')?.firstChild;

describe('a long survey, edited', () => {
  it('leaves the cards of questions it did not touch as they were drawn', () => {
    const { host, designer, ids } = mount();
    const [name, email, phone] = ids;
    const drawn = { email: words(host, email), phone: words(host, phone), answer: card(host, phone).querySelector('.fd-q-answer')?.firstChild };
    designer.updateQuestion(name, { label: 'Full name' });
    expect(card(host, name).querySelector('.fd-q-text')?.textContent).toBe('Full name');
    expect(words(host, email)).toBe(drawn.email);
    expect(words(host, phone)).toBe(drawn.phone);
    expect(card(host, phone).querySelector('.fd-q-answer')?.firstChild).toBe(drawn.answer);
  });

  it('draws a card again when its own question changes, as before', () => {
    const { host, designer, ids } = mount();
    const phone = ids[2];
    const drawn = words(host, phone);
    designer.updateQuestion(phone, { label: 'Mobile', required: true });
    expect(words(host, phone)).not.toBe(drawn);
    expect(card(host, phone).querySelector('.fd-q-text')?.textContent).toBe('Mobile');
    expect(card(host, phone).classList.contains('fd-required')).toBe(true);
    designer.setCondition(phone, { field: 'q_1', equals: 'x' });
    expect(card(host, phone).querySelector('.fd-q-when-note')).not.toBeNull();
    designer.setCondition(phone, null);
    expect(card(host, phone).querySelector('.fd-q-when-note')).toBeNull();
  });

  it('leaves a page’s head as it was when nothing about the page changed', () => {
    const { host, designer, ids } = mount();
    const number = host.querySelectorAll('.fd-step-number')[1].firstChild;
    designer.updateQuestion(ids[0], { label: 'Full name' });
    expect(host.querySelectorAll('.fd-step-number')[1].firstChild).toBe(number);
    designer.addContainer('Page 3');
    expect(host.querySelectorAll('.fd-step-number')[1].textContent).toBe('Page 2 of 3');
  });
});
