import type { Field, FieldNode, SectionNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { mount as mountScreen, type } from './test-editor';

/**
 * The choice kinds' settings in the picked question: options moved by their
 * grip or Alt+↑/↓, "None of these", the layout, options kept in place, a
 * dropdown that searches, tags of one's own, pictures' words, size and fit,
 * an upload made small or refused, a ranking's top few, a matrix's answers
 * per row, shuffled rows and columns taken once, a yes or no's look and
 * words, and steps that can be picked.
 */

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
  const box = (name: string) => card().querySelector(`[aria-label="${name}"]`) as HTMLInputElement & HTMLSelectElement;
  const node = () => (designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode;
  const field = () => designer.getPage().fields[node().field];
  return { designer, id, card, box, node, field };
}
const options = (field: Field) => (field as Extract<Field, { type: 'selection' }>).options;
const choose = (select: HTMLSelectElement, value: string) => {
  select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const change = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const press = (target: Element, key: string, extra: KeyboardEventInit = {}) => target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...extra }));

describe('the option list', () => {
  it('moves an option with Alt and the arrows, its value, picture and points with it, the cursor too', () => {
    const { designer, id, box, field } = open('multiple-choice');
    designer.setOptions(id, ['Cairo', 'Giza', 'Luxor']);
    designer.setOptionDetails(id, 0, { score: 2 });
    const before = options(field()).map((o) => o.value);
    box('Option 1').focus();
    press(box('Option 1'), 'ArrowDown', { altKey: true });
    expect(options(field()).map((o) => o.label)).toEqual(['Giza', 'Cairo', 'Luxor']);
    expect(options(field()).map((o) => o.value)).toEqual([before[1], before[0], before[2]]);
    expect(options(field())[1].score).toBe(2);
    expect(document.activeElement).toBe(box('Option 2'));
    expect(box('Option 2').value).toBe('Cairo');
    // Not past the top.
    press(box('Option 1'), 'ArrowUp', { altKey: true });
    expect(options(field()).map((o) => o.label)).toEqual(['Giza', 'Cairo', 'Luxor']);
    designer.undo();
    expect(options(field()).map((o) => o.label)).toEqual(['Cairo', 'Giza', 'Luxor']);
  });

  it('gives each option a grip to drag it by, for the pointer only', () => {
    const { designer, id, card } = open('checkboxes');
    designer.setOptions(id, ['A', 'B']);
    const grips = card().querySelectorAll('.fd-q-option-grip');
    expect(grips).toHaveLength(2);
    expect(grips[0].getAttribute('aria-hidden')).toBe('true');
  });

  it('adds “None of these” to checkboxes, once, marked as going alone, and keeps the flags as words change', () => {
    const { designer, id, card, field } = open('checkboxes');
    const add = () => card().querySelector('.fd-q-add-none') as HTMLButtonElement;
    expect(card().querySelector('.fd-q-add-row')?.textContent).toBe('Add optionoradd “Other”oradd “None of these”');
    add().click();
    expect(options(field()).at(-1)).toEqual({ value: 'none', label: 'None of these', exclusive: true });
    expect(add()).toBeNull();
    const alone = [...card().querySelectorAll<HTMLElement>('.fd-q-alone')];
    expect(alone.map((a) => a.hidden)).toEqual([true, false]);
    designer.setOptions(id, ['Option 1', 'Nothing']);
    expect(options(field())[1]).toMatchObject({ label: 'Nothing', exclusive: true });
    expect(designer.addNoneOption(id)).toBe(false);
  });

  it('offers no “None of these” to one answer', () => {
    const { card } = open('multiple-choice');
    expect(card().querySelector('.fd-q-add-none')).toBeNull();
  });
});

describe('the layout and the shuffle', () => {
  it('lays radios out in columns, or back in a row', () => {
    const { box, node } = open('multiple-choice');
    expect(box('Lay out').value).toBe('');
    choose(box('Lay out'), '2');
    expect(node().options).toEqual({ columns: 2 });
    choose(box('Lay out'), '');
    expect(node().options).toBeUndefined();
  });

  it('lays pictures out automatically, in columns or all in a row', () => {
    const { box, node } = open('image-choice');
    expect([...box('Lay out').options].map((o) => o.textContent)).toEqual(['Automatic', 'One column', 'Two columns', 'Three columns', 'Four columns', 'All in a row']);
    choose(box('Lay out'), 'row');
    expect(node().options).toEqual({ columns: 'row' });
  });

  it('keeps chosen options in place once shuffled', () => {
    const { designer, id, box, card, field } = open('checkboxes');
    designer.setOptions(id, ['Red', 'Green', 'Blue']);
    const keep = card().querySelector('.fd-kind-keep') as HTMLElement;
    expect(keep.hidden).toBe(true);
    box('Shuffle option order').click();
    expect(keep.hidden).toBe(false);
    const chip = [...keep.querySelectorAll<HTMLButtonElement>('.fd-inline-chip')].find((c) => c.textContent === 'Blue') as HTMLButtonElement;
    chip.click();
    expect(options(field())[2]).toMatchObject({ label: 'Blue', fixed: true });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    chip.click();
    expect(options(field())[2]).not.toHaveProperty('fixed');
  });
});

describe('a dropdown that searches', () => {
  it('searches its list when asked, and on its own past fifteen options unless told not to', () => {
    const { designer, id, box, node } = open('dropdown');
    expect(box('Search the list').getAttribute('aria-checked')).toBe('false');
    box('Search the list').click();
    expect(node().options).toEqual({ search: true });
    box('Search the list').click();
    expect(node().options).toBeUndefined();
    designer.setOptions(id, Array.from({ length: 16 }, (_, i) => `Floor ${i + 1}`));
    expect(box('Search the list').getAttribute('aria-checked')).toBe('true');
    box('Search the list').click();
    expect(node().options).toEqual({ search: false });
  });
});

describe('tags of one’s own', () => {
  it('lets people add their own tags', () => {
    const { box, field } = open('tags');
    box('Let people add their own').click();
    expect(field()).toMatchObject({ ownAnswers: true });
    box('Let people add their own').click();
    expect(field()).not.toHaveProperty('ownAnswers');
  });
});

describe('pictures', () => {
  it('describes each picture, hides the words under them, and sets their size and fit', () => {
    const { designer, id, box, field, node } = open('image-choice');
    designer.setOptions(id, ['Standing desk']);
    expect(box('What the picture for Standing desk shows').hidden).toBe(true);
    designer.setOptionDetails(id, 0, { image: 'desk.png' });
    expect(box('What the picture for Standing desk shows').hidden).toBe(false);
    type(box('What the picture for Standing desk shows'), 'A tall desk by a window');
    expect(options(field())[0]).toMatchObject({ image: 'desk.png', alt: 'A tall desk by a window' });
    box('Show labels').click();
    choose(box('Picture size'), 'large');
    choose(box('Fit'), 'whole');
    expect(node().options).toEqual({ showLabels: false, imageSize: 'large', imageFit: 'whole' });
    expect(box('Show labels').getAttribute('aria-checked')).toBe('false');
  });

  it('refuses a picture over 5 MB, saying how big it is', () => {
    const { designer, id, card, field } = open('image-choice');
    const file = card().querySelector('.fd-kind-picture input[type=file]') as HTMLInputElement;
    const big = new File([new Uint8Array(6 * 1024 * 1024)], 'huge.jpg', { type: 'image/jpeg' });
    Object.defineProperty(file, 'files', { value: [big], configurable: true });
    file.dispatchEvent(new Event('change'));
    expect(designer.getState().issues).toEqual(['A picture is 5 MB at most: this one is 6 MB']);
    expect(options(field())[0]).not.toHaveProperty('image');
    expect(designer.setOptionPicture(id, 0, { src: 'data:text/plain,hi', bytes: 2 })).toBe(false);
  });

  it('keeps a drawing uploaded as it is', async () => {
    const { card, field } = open('image-choice');
    const file = card().querySelector('.fd-kind-picture input[type=file]') as HTMLInputElement;
    const svg = new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], 'desk.svg', { type: 'image/svg+xml' });
    Object.defineProperty(file, 'files', { value: [svg], configurable: true });
    file.dispatchEvent(new Event('change'));
    // The file is read in its own time: wait for the picture to arrive, not for a guess at how long it takes.
    for (let waited = 0; options(field())[0].image === undefined && waited < 3000; waited += 10) await new Promise((done) => setTimeout(done, 10));
    expect(options(field())[0].image).toMatch(/^data:image\/svg\+xml;base64,/);
  });
});

describe('a ranking of the top few', () => {
  it('ranks only the top few, fewer than its options', () => {
    const { box, node } = open('ranking');
    change(box('Rank only the top'), '2');
    expect(node().options).toEqual({ top: 2 });
    change(box('Rank only the top'), '3');
    expect(node().options).toBeUndefined();
    change(box('Rank only the top'), '');
    expect(node().options).toBeUndefined();
  });
});

describe('a matrix', () => {
  it('takes several answers per row, shuffles its rows, and takes each column once', () => {
    const { box, field, node } = open('matrix');
    box('Several answers per row').click();
    expect(field()).toMatchObject({ multiple: true });
    box('Shuffle rows').click();
    expect(node().options).toEqual({ shuffle: true });
    box('One answer per column').click();
    expect(field()).toMatchObject({ onePerColumn: true });
    expect(box('One answer per column').getAttribute('aria-checked')).toBe('true');
    box('Several answers per row').click();
    expect(field()).not.toHaveProperty('multiple');
  });
});

describe('a yes or no', () => {
  it('starts as two buttons, neither picked, and takes words of its own', () => {
    const { box, card, field, node } = open('yes-no');
    expect(node().widget).toBe('buttons');
    expect(field()).toMatchObject({ type: 'boolean', default: null });
    expect([...card().querySelectorAll('.fd-q-answer [role=radio]')].map((r) => r.textContent)).toEqual(['Yes', 'No']);
    type(box('Words for yes'), 'Of course');
    expect(node().options).toEqual({ yesLabel: 'Of course' });
    expect([...card().querySelectorAll('.fd-q-answer [role=radio]')].map((r) => r.textContent)).toEqual(['Of course', 'No']);
  });

  it('shows as a switch, its words put away, and as buttons again', () => {
    const { box, node, card } = open('yes-no');
    type(box('Words for yes'), 'Sure');
    choose(box('Show as'), 'switch');
    expect(node().widget).toBe('toggle');
    expect(node().options).toBeUndefined();
    expect(box('Words for yes').closest('[hidden]')).not.toBeNull();
    expect(card().querySelector('.fd-q-answer [role=switch]')).not.toBeNull();
    choose(box('Show as'), 'buttons');
    expect(node().widget).toBe('buttons');
  });

  it('has no look to choose for a tick box', () => {
    const { card } = open('tick');
    expect(card().querySelector('[aria-label="Show as"]')).toBeNull();
  });
});

describe('status steps', () => {
  it('lets people pick a step', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = designer.addQuestion('status', { parent: 'section-1' }) as string;
    const { host } = mountScreen(designer, { mode: 'simple' });
    designer.select(id);
    const toggle = host.querySelector('.fd-canvas-field.fd-editing [aria-label="People can pick a step"]') as HTMLButtonElement;
    toggle.click();
    const node = ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.id === id);
    expect(node?.options).toEqual({ clickable: true });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    // The side panel has the same.
    expect(host.querySelector('.fd-properties [aria-label="People can pick a step"]')?.getAttribute('aria-checked')).toBe('true');
  });
});
