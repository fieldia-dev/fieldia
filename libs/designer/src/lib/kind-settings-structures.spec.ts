import type { FieldNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';

/**
 * The structures' settings in the picked question, and the same in the side
 * panel: a signature's ink, pen and words and its upload; an address's
 * parts, those that must be filled and its country; a table's least and most
 * lines, its words, totals and the columns people may hide; a link's new
 * records and filter; rich text's toolbar.
 */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function openQuestion(kind: string, before?: (designer: Designer, id: string) => void) {
  const designer = createDesigner({ page: blankPage('survey', 'Move') });
  const id = designer.addQuestion(kind) as string;
  before?.(designer, id);
  designer.select(id);
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountSurveyEditor(host, { designer });
  const card = () => host.querySelector('.fd-q-selected') as HTMLElement;
  const box = (name: string) => card().querySelector(`[aria-label="${name}"]`) as HTMLInputElement & HTMLSelectElement;
  const node = () => (designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode;
  const field = () => designer.getPage().fields[node().field];
  return { designer, id, card, box, node, field };
}
const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const chip = (card: HTMLElement, name: string) => [...card.querySelectorAll<HTMLButtonElement>('.fd-inline-chip')].find((b) => b.textContent === name) as HTMLButtonElement;

describe('a signature’s settings', () => {
  it('sets its ink, its pen, its words on the pad and under it, and lets a picture be uploaded', () => {
    const { card, box, node } = openQuestion('signature');
    expect(chip(card(), 'Blue-black').getAttribute('aria-pressed')).toBe('true');
    chip(card(), 'Blue').click();
    expect(node().options).toEqual({ color: '#1d4ed8' });
    expect(chip(card(), 'Blue').getAttribute('aria-pressed')).toBe('true');
    expect(chip(card(), 'Blue-black').getAttribute('aria-pressed')).toBe('false');
    choose(box('Pen width'), '5');
    type(box('Words on the pad'), 'Sign as in your passport');
    type(box('Words under it'), 'I agree this is my signature');
    box('People can upload a picture of it').click();
    expect(node()).toEqual(expect.objectContaining({ placeholder: 'Sign as in your passport', options: { color: '#1d4ed8', penWidth: 5, footerLabel: 'I agree this is my signature', upload: true } }));
    // The picked question shows them as it will be answered.
    expect(card().querySelector('.fd-q-preview-signature')?.textContent).toBe('Sign as in your passport');
    expect(card().querySelector('.fd-q-preview-under')?.textContent).toBe('I agree this is my signature');
    // Back to the usual: nothing kept.
    chip(card(), 'Blue-black').click();
    choose(box('Pen width'), '3');
    box('People can upload a picture of it').click();
    expect(node().options).toEqual({ footerLabel: 'I agree this is my signature' });
  });
});
