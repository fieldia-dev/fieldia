import { createForm, type Field, type FieldNode, type Form, type Page } from '@fieldia/core';
import { shownOptions } from './shuffle';
import { createWidget } from './widgets';

/**
 * Options shuffled when the page asks: an order of the form's own, the same
 * each time the form draws the question, another for the next form; "Other"
 * always last, and the answer kept as it would be unshuffled.
 */

const OPTIONS = ['Apple', 'Banana', 'Cherry', 'Date', 'Elder', 'Fig', 'Grape', 'Hazel'].map((label) => ({ value: label.toLowerCase(), label }));
const WRITTEN = OPTIONS.map((o) => o.label);

function formWith(field: Record<string, unknown>): Form {
  const page = {
    fieldia: '0.1',
    id: 't',
    data: { kind: 'responses' },
    fields: { x: { type: 'selection', label: 'Fruit', options: OPTIONS, ...field } as Field },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'x' }] },
  } as Page;
  return createForm({ page });
}
function draw(form: Form, widget: string, shuffle = true) {
  const node: FieldNode = { type: 'field', id: 'n', field: 'x', widget, ...(shuffle ? { options: { shuffle: true } } : {}) };
  const made = createWidget({ form, name: 'x', field: form.page.fields['x'], node, id: 'fd-x', document });
  document.body.replaceChildren(made.element);
  const refresh = () => made.update({ value: form.getState().values['x'], values: form.getState().values, readonly: false, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  return made.element;
}
const labelsOf = (el: Element, selector: string) => [...el.querySelectorAll(selector)].map((n) => n.textContent ?? '');
const seeded = (...values: number[]) => {
  const spy = jest.spyOn(Math, 'random');
  for (const value of values) spy.mockReturnValueOnce(value);
};
afterEach(() => jest.restoreAllMocks());

describe('shuffled options', () => {
  it('leaves the options as written unless the page asks', () => {
    expect(labelsOf(draw(formWith({}), 'radio', false), '.fd-choice span')).toEqual(WRITTEN);
  });

  it('shuffles every option, keeping the same order each time the form draws the question', () => {
    seeded(0.25);
    const form = formWith({});
    const first = labelsOf(draw(form, 'radio'), '.fd-choice span');
    expect(first).not.toEqual(WRITTEN);
    expect([...first].sort()).toEqual(WRITTEN);
    expect(labelsOf(draw(form, 'radio'), '.fd-choice span')).toEqual(first);
    // Any widget the question is drawn with, the same order.
    expect(labelsOf(draw(form, 'image-choice'), '.fd-image-card-words')).toEqual(first);
    expect(labelsOf(draw(form, 'dropdown'), 'option').slice(1)).toEqual(first);
  });

  it('shuffles another way for another form', () => {
    seeded(0.25, 0.75);
    const one = labelsOf(draw(formWith({}), 'radio'), '.fd-choice span');
    const two = labelsOf(draw(formWith({}), 'radio'), '.fd-choice span');
    expect(two).not.toEqual(one);
  });

  it('keeps "Other" last', () => {
    seeded(0.5);
    const el = draw(formWith({ other: true }), 'radio');
    const choices = [...el.querySelectorAll('.fd-choice')];
    expect(choices[choices.length - 1].classList.contains('fd-choice-other')).toBe(true);
  });

  it('keeps the answer the options’ own: the one clicked, and several in the order they are written', () => {
    seeded(0.25);
    const form = formWith({});
    const radios = draw(form, 'radio');
    const firstShown = radios.querySelector('.fd-choice') as HTMLLabelElement;
    (firstShown.querySelector('input') as HTMLInputElement).click();
    expect(form.getState().values['x']).toBe(firstShown.textContent?.toLowerCase());

    seeded(0.25);
    const several = formWith({ multiple: true });
    const boxes = draw(several, 'checkboxes');
    const inputs = [...boxes.querySelectorAll<HTMLInputElement>('input[type=checkbox]')];
    const written = (input: HTMLInputElement) => WRITTEN.indexOf(input.closest('label')?.textContent ?? '');
    // Two shown one way round and written the other.
    const [early, late] = [...inputs.entries()].flatMap(([i, a]) => inputs.slice(i + 1).filter((b) => written(a) > written(b)).map((b) => [a, b]))[0];
    early.click();
    late.click();
    expect(several.getState().values['x']).toEqual([late, early].map((input) => OPTIONS[written(input)].value));
  });

  it('picks from a shuffled dropdown the option shown', () => {
    seeded(0.25);
    const form = formWith({});
    const select = draw(form, 'dropdown') as HTMLSelectElement;
    select.selectedIndex = 1;
    select.dispatchEvent(new Event('change'));
    expect(form.getState().values['x']).toBe(select.options[1].textContent?.toLowerCase());
  });

  it('starts a ranking in the shuffled order', () => {
    seeded(0.25);
    const form = formWith({ multiple: true });
    const shown = labelsOf(draw(form, 'ranking'), '.fd-rank-words');
    expect(shown).toEqual(shownOptions(OPTIONS, form, 'x', { options: { shuffle: true } }).map((o) => o.label));
    expect(shown).not.toEqual(WRITTEN);
  });

  it('gives each question of a form its own order', () => {
    seeded(0.25);
    const form = formWith({});
    const draw2 = (name: string) => shownOptions(OPTIONS, form, name, { options: { shuffle: true } }).map((o) => o.label);
    expect(draw2('x')).not.toEqual(draw2('y'));
  });

  it('lets any option come first: two options are shown either way round across forms', () => {
    let n = 0;
    jest.spyOn(Math, 'random').mockImplementation(() => (n++ % 89) / 89);
    const two = OPTIONS.slice(0, 2);
    const firsts = new Set(Array.from({ length: 40 }, () => shownOptions(two, {}, 'x', { options: { shuffle: true } })[0].label));
    expect([...firsts].sort()).toEqual(['Apple', 'Banana']);
  });

  it('keeps several pictures in the options’ own order, however they are shown', () => {
    seeded(0.25);
    const form = formWith({ multiple: true });
    const cards = [...draw(form, 'image-choice').querySelectorAll<HTMLButtonElement>('.fd-image-card')];
    const written = (card: HTMLButtonElement) => WRITTEN.indexOf(card.textContent ?? '');
    const [early, late] = [...cards.entries()].flatMap(([i, a]) => cards.slice(i + 1).filter((b) => written(a) > written(b)).map((b) => [a, b]))[0];
    early.click();
    late.click();
    expect(form.getState().values['x']).toEqual([late, early].map((card) => OPTIONS[written(card)].value));
  });
});
