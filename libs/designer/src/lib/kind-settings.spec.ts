import type { Field, FieldNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { type } from './test-editor';

/** The newer kinds' settings in the picked question: a slider's range, pictures, a matrix's rows and columns, an address's parts, a repeating group's cards, Shuffle and points. */

let handle: SurveyEditorHandle | null = null;
afterEach(() => {
  handle?.destroy();
  handle = null;
  document.body.replaceChildren();
});

function open(kind: string, before?: (designer: Designer, id: string) => void) {
  const designer = createDesigner({ page: blankPage('survey', 'Move') });
  const id = designer.addQuestion(kind) as string;
  before?.(designer, id);
  designer.select(id);
  const host = document.createElement('div');
  document.body.append(host);
  handle = mountSurveyEditor(host, { designer });
  const card = () => host.querySelector('.fd-q-selected') as HTMLElement;
  const box = (name: string) => card().querySelector(`[aria-label="${name}"]`) as HTMLInputElement & HTMLButtonElement;
  const node = () => (designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode;
  const field = () => designer.getPage().fields[node().field];
  return { designer, id, card, box, node, field };
}
const change = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const settings = (card: HTMLElement) => card.querySelector('.fd-inline-settings') as HTMLElement;

describe('a slider’s settings', () => {
  it('sets where it starts and ends, and its step', () => {
    const { box, field, node } = open('slider');
    expect([box('From').value, box('To').value, box('Step').value]).toEqual(['0', '10', '1']);
    change(box('To'), '20');
    expect(field()).toMatchObject({ min: 0, max: 20 });
    change(box('Step'), '5');
    expect(node().options).toEqual({ step: 5 });
    change(box('Step'), '1');
    expect(node().options).toBeUndefined();
  });
});

describe('pictures to choose from', () => {
  it('takes a picture for each option, shown beside it, and one answer or several', () => {
    const { designer, id, box, card, field } = open('image-choice');
    designer.setOptions(id, ['Standing desk', 'Bench']);
    change(box('Picture for Bench'), 'data:image/svg+xml,%3Csvg%2F%3E');
    expect((field() as Extract<Field, { type: 'selection' }>).options[1]).toMatchObject({ label: 'Bench', image: 'data:image/svg+xml,%3Csvg%2F%3E' });
    expect(card().querySelectorAll('.fd-kind-thumb img')).toHaveLength(1);
    // A long data: address is not shown in the box.
    expect(box('Picture for Bench').value).toBe('');
    expect(box('Picture for Bench').placeholder).toBe('Uploaded picture');
    box('Several answers').click();
    expect(field()).toMatchObject({ multiple: true });
    expect(box('Several answers').getAttribute('aria-checked')).toBe('true');
  });
});

describe('a matrix’s rows and columns', () => {
  it('names, adds and takes away rows and columns, standing in for the grid while picked', () => {
    const { box, card, field } = open('matrix');
    expect((card().querySelector('.fd-q-answer') as HTMLElement).hidden).toBe(true);
    type(box('Row 1'), 'Food');
    (card().querySelector('[data-add-columns]') as HTMLButtonElement).click();
    expect(document.activeElement).toBe(box('Column 3'));
    type(box('Column 3'), 'Great');
    box('Remove row Row 2').click();
    const grid = field() as Extract<Field, { type: 'matrix' }>;
    expect(grid.rows.map((r) => r.label)).toEqual(['Food']);
    expect(grid.columns.map((c) => c.label)).toEqual(['Column 1', 'Column 2', 'Great']);
    // The only row left cannot go.
    expect(box('Remove row Food').hidden).toBe(true);
  });
});

describe('an address’s parts', () => {
  it('asks for the parts left on', () => {
    const { card, node } = open('address');
    const chip = (part: string) => card().querySelector(`.fd-inline-chip[data-part="${part}"]`) as HTMLButtonElement;
    expect(chip('country').getAttribute('aria-pressed')).toBe('true');
    chip('country').click();
    expect(node().options).toEqual({ parts: ['street', 'city', 'postcode'] });
    expect(chip('country').getAttribute('aria-pressed')).toBe('false');
    chip('country').click();
    expect(node().options).toBeUndefined();
  });
});

describe('a repeating group’s settings', () => {
  it('sets its cards’ fields, the least and most cards, and its words', () => {
    const { box, card, node, field } = open('repeating');
    expect(settings(card()).querySelector('.fd-prop-name')?.textContent).toBe('Fields in each card');
    (settings(card()).querySelector('[data-add-column]') as HTMLButtonElement).click();
    expect(Object.keys((field() as Extract<Field, { type: 'one2many' }>).fields)).toHaveLength(2);
    change(box('At least'), '1');
    change(box('At most'), '4');
    type(box('Card title'), 'Person');
    type(box('Button words'), 'Add a person');
    expect(node().options).toEqual({ min: 1, max: 4, itemLabel: 'Person', addLabel: 'Add a person' });
    change(box('At least'), '0');
    expect(node().options).not.toHaveProperty('min');
  });
});

describe('the choices’ Shuffle and points', () => {
  it('shuffles a choice’s options for each form, and stops', () => {
    const { box, node } = open('multiple-choice');
    box('Shuffle option order').click();
    expect(node().options).toEqual({ shuffle: true });
    box('Shuffle option order').click();
    expect(node().options).toBeUndefined();
  });

  it('makes the page a quiz, then takes points for each option', () => {
    const { designer, id, box, card, field } = open('dropdown');
    designer.setOptions(id, ['Cairo', 'Giza']);
    const give = card().querySelector('.fd-kind-give-points') as HTMLButtonElement;
    expect(give.hidden).toBe(false);
    expect(box('Points for Cairo').closest('[hidden]')).not.toBeNull();
    give.click();
    expect(box('Points for Cairo').closest('[hidden]')).toBeNull();
    expect(give.hidden).toBe(true);
    type(box('Points for Cairo'), '2');
    type(box('Points for Giza'), '0.5');
    expect((field() as Extract<Field, { type: 'selection' }>).options.map((o) => o.score)).toEqual([2, 0.5]);
    type(box('Points for Giza'), '');
    expect((field() as Extract<Field, { type: 'selection' }>).options[1]).not.toHaveProperty('score');
  });

  it('takes points for each column of a matrix once the page is a quiz', () => {
    const { box, card, field } = open('matrix', (designer, id) => designer.setMatrixItems(id, 'columns', ['Poor', 'Great']));
    (card().querySelector('.fd-kind-give-points') as HTMLButtonElement).click();
    type(box('Points for Great'), '3');
    expect((field() as Extract<Field, { type: 'matrix' }>).columns.map((c) => c.score)).toEqual([0, 3]);
  });

  it('offers no points for a ranking, nor Shuffle or points for a signature', () => {
    const ranking = open('ranking');
    expect(ranking.box('Shuffle option order')).not.toBeNull();
    expect(ranking.box('Points for Option 1')).toBeNull();
    handle?.destroy();
    // A signature has its pen and words (kind-settings-structures), and nothing of a choice's.
    const signature = open('signature');
    expect(signature.box('Shuffle option order')).toBeNull();
    expect(signature.card().querySelector('.fd-kind-give-points')).toBeNull();
    expect(settings(signature.card()).hidden).toBe(false);
  });
});
