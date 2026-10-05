import { checkValue, validatePage, type Field, type FieldNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { findNode } from './page-tree';
import { pageChanges } from './page-checks';
import { choose, mount, type } from './test-editor';

/** The text, number and date kinds' settings, as commands and in the picked field itself. */

const nodeOf = (designer: Designer, id: string) => findNode(designer.getPage(), id)?.node as FieldNode;
const fieldOf = (designer: Designer, id: string) => designer.getPage().fields[nodeOf(designer, id).field];
/** A setting in the picked field on the canvas — the side panel has the same, so the canvas is named. */
const inline = (host: Element, name: string) => host.querySelector(`.fd-canvas-field.fd-editing [aria-label="${name}"]`) as (HTMLInputElement & HTMLSelectElement) | null;
/** A number typed and left, as a person types one: saved on change. */
function enter(input: HTMLInputElement | null, text: string) {
  type(input ?? undefined, text);
  input?.dispatchEvent(new Event('change', { bubbles: true }));
}

function screenWith(kind: string, model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  const { host } = mount(designer);
  return { designer, id, host };
}

describe('a slider’s step', () => {
  it('makes the field a decimal for a step with decimals, as many as the step has, and whole again for a whole step', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Move') });
    const id = designer.addQuestion('slider') as string;
    expect(designer.setStep(id, 0.5)).toBe(true);
    expect(fieldOf(designer, id)).toEqual({ type: 'float', label: expect.any(String), min: 0, max: 10, digits: [16, 1] });
    expect(nodeOf(designer, id).options).toEqual({ step: 0.5 });
    // Every value the step reaches is one the field takes.
    expect(checkValue(fieldOf(designer, id), 2.5, false)).toBeUndefined();
    designer.setStep(id, 0.25);
    expect(fieldOf(designer, id)).toMatchObject({ type: 'float', digits: [16, 2] });
    designer.setStep(id, 2);
    expect(fieldOf(designer, id)).toEqual({ type: 'integer', label: expect.any(String), min: 0, max: 10 });
    expect(nodeOf(designer, id).options).toEqual({ step: 2 });
    designer.setStep(id, null);
    expect(nodeOf(designer, id).options).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('steps a model’s field of whole numbers by whole numbers', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Move'), model: { days: { type: 'integer', label: 'Days', min: 0, max: 5 } } });
    const id = designer.addModelField('days') as string;
    designer.changeKind(id, 'slider');
    expect(designer.setStep(id, 0.5)).toBe(false);
    expect(designer.getState().issues).toEqual(['Days holds whole numbers in the model, so it steps by whole numbers']);
    expect(designer.setStep(id, 2)).toBe(true);
    expect(fieldOf(designer, id)).toEqual({ type: 'integer', label: 'Days', min: 0, max: 5 });
  });

  it('is set in the slider itself: 0.5 typed in Step makes it a decimal', () => {
    const { designer, id, host } = screenWith('slider');
    enter(inline(host, 'Step'), '0.5');
    expect(fieldOf(designer, id)).toMatchObject({ type: 'float', digits: [16, 1] });
    expect(nodeOf(designer, id).options).toEqual({ step: 0.5 });
    expect(designer.getState().issues).toEqual([]);
  });
});

describe('the most characters, and a paragraph’s rows', () => {
  it('sets a short answer’s most characters, its count under the box, and takes it away', () => {
    const { designer, id, host } = screenWith('short-answer');
    enter(inline(host, 'Most characters'), '80');
    expect(fieldOf(designer, id)).toMatchObject({ type: 'char', size: 80 });
    expect(host.querySelector('.fd-canvas-field.fd-editing .fd-count')?.textContent).toBe('0 / 80');
    enter(inline(host, 'Most characters'), '');
    expect(fieldOf(designer, id)).not.toHaveProperty('size');
    enter(inline(host, 'Most characters'), '0');
    expect(designer.getState().issues).toEqual(['The most characters is a whole number, 1 or more']);
  });

  it('sets a paragraph’s most characters, rows, and whether it grows as people type', () => {
    const { designer, id, host } = screenWith('paragraph');
    enter(inline(host, 'Most characters'), '500');
    expect(fieldOf(designer, id)).toMatchObject({ type: 'text', size: 500 });
    expect(inline(host, 'Rows')?.value).toBe('3');
    choose(inline(host, 'Rows') ?? undefined, '6');
    expect(nodeOf(designer, id).options).toEqual({ rows: 6 });
    expect((host.querySelector('.fd-canvas-field.fd-editing textarea') as HTMLTextAreaElement).rows).toBe(6);
    const grows = inline(host, 'Grows as people type') as unknown as HTMLButtonElement;
    expect(grows.getAttribute('aria-checked')).toBe('true');
    grows.click();
    expect(nodeOf(designer, id).options).toEqual({ rows: 6, autoGrow: false });
    expect((inline(host, 'Grows as people type') as unknown as HTMLButtonElement).getAttribute('aria-checked')).toBe('false');
    choose(inline(host, 'Rows') ?? undefined, '3');
    (inline(host, 'Grows as people type') as unknown as HTMLButtonElement).click();
    expect(nodeOf(designer, id).options).toBeUndefined();
  });

  it('leaves a model’s field as the model has it', () => {
    const { host } = screenWith('short-answer', {});
    expect(inline(host, 'Most characters')).not.toBeNull();
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), model: { name: { type: 'char', label: 'Name', size: 20 } } });
    designer.addModelField('name');
    const { host: modelHost } = mount(designer);
    expect(inline(modelHost, 'Most characters')).toBeNull();
  });
});

describe('a number’s range, decimals and unit', () => {
  it('sets From, To and Decimals, refusing a range the wrong way round', () => {
    const { designer, id, host } = screenWith('number');
    enter(inline(host, 'From'), '0');
    enter(inline(host, 'To'), '300');
    expect(fieldOf(designer, id)).toMatchObject({ type: 'float', min: 0, max: 300 });
    choose(inline(host, 'Decimals') ?? undefined, '1');
    expect(fieldOf(designer, id)).toMatchObject({ digits: [16, 1] });
    choose(inline(host, 'Decimals') ?? undefined, '');
    expect(fieldOf(designer, id)).not.toHaveProperty('digits');
    enter(inline(host, 'To'), '-5');
    expect(designer.getState().issues).toEqual(['From is not less than To']);
    expect(fieldOf(designer, id)).toMatchObject({ max: 300 });
    enter(inline(host, 'From'), '');
    expect(fieldOf(designer, id)).not.toHaveProperty('min');
  });

  it('puts a unit before or after the number, inside its box', () => {
    const { designer, id, host } = screenWith('number');
    type(inline(host, 'Unit after') ?? undefined, 'kg');
    expect(nodeOf(designer, id).options).toEqual({ suffix: 'kg' });
    type(inline(host, 'Unit before') ?? undefined, '≈');
    expect(nodeOf(designer, id).options).toEqual({ suffix: 'kg', prefix: '≈' });
    expect([...host.querySelectorAll('.fd-canvas-field.fd-editing .fd-unit')].map((u) => u.textContent)).toEqual(['≈', 'kg']);
    type(inline(host, 'Unit after') ?? undefined, '');
    expect(nodeOf(designer, id).options).toEqual({ prefix: '≈' });
  });

  it('sets an amount’s From, To and Decimals beside its currency, whose symbol shows in its box', () => {
    const { designer, id, host } = screenWith('amount');
    enter(inline(host, 'From'), '10');
    enter(inline(host, 'To'), '1000');
    choose(inline(host, 'Decimals') ?? undefined, '0');
    expect(fieldOf(designer, id)).toMatchObject({ type: 'monetary', currency: 'USD', min: 10, max: 1000, digits: [16, 0] });
    expect(host.querySelector('.fd-canvas-field.fd-editing .fd-currency')?.textContent).toBe('$');
    expect(inline(host, 'Unit after')).toBeNull();
  });
});

describe('a rating’s look, and its words at each end', () => {
  const card = (host: Element) => host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;

  it('shows hearts, thumbs up or numbers instead of stars, on the card too', () => {
    const { designer, id, host } = screenWith('rating');
    expect(inline(host, 'Icon')?.value).toBe('');
    choose(inline(host, 'Icon') ?? undefined, 'heart');
    expect(nodeOf(designer, id).options).toEqual({ icon: 'heart' });
    expect(card(host).querySelector('.fd-rating-heart')).not.toBeNull();
    choose(inline(host, 'Icon') ?? undefined, 'number');
    expect(card(host).querySelectorAll('.fd-scale [role=radio]')).toHaveLength(5);
    choose(inline(host, 'Icon') ?? undefined, '');
    expect(nodeOf(designer, id).options).toBeUndefined();
  });

  it('has words at each end, as a scale has', () => {
    const { designer, id, host } = screenWith('rating');
    type(inline(host, 'Words at the start') ?? undefined, 'Poor');
    type(inline(host, 'Words at the end') ?? undefined, 'Great');
    expect(nodeOf(designer, id).options).toEqual({ startLabel: 'Poor', endLabel: 'Great' });
    expect([...card(host).querySelectorAll('.fd-scale-ends span')].map((s) => s.textContent)).toEqual(['Poor', 'Great']);
  });
});

describe('a slider’s words at each end', () => {
  it('are typed beside its range, and shown under its ends', () => {
    const { designer, id, host } = screenWith('slider');
    type(inline(host, 'Words at the start') ?? undefined, 'Never');
    type(inline(host, 'Words at the end') ?? undefined, 'Every day');
    expect(nodeOf(designer, id).options).toEqual({ startLabel: 'Never', endLabel: 'Every day' });
    expect([...host.querySelectorAll('.fd-canvas-field.fd-editing .fd-slider-word')].map((s) => s.textContent)).toEqual(['Never', 'Every day']);
  });
});

describe('the words for what changed, when published', () => {
  it('says a text’s most characters, a paragraph’s rows and whether it grows', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const q = designer.addQuestion('paragraph') as string;
    designer.updateQuestion(q, { label: 'Bio' });
    const before = designer.getPage();
    designer.setLimits(q, { size: 200 });
    designer.setWidgetOptions(q, { rows: 6, autoGrow: false });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Bio”: takes at most 200 characters', '“Bio”: starts 6 rows high', '“Bio”: keeps its height as people type']);
    const later = designer.getPage();
    designer.setLimits(q, { size: null });
    designer.setWidgetOptions(q, { rows: null, autoGrow: null, other: 'x' });
    expect(pageChanges(later, designer.getPage())).toEqual(['“Bio”: takes any number of characters', '“Bio”: starts 3 rows high', '“Bio”: grows as people type', '“Bio”: how it shows changed']);
  });

  it('says a number’s range, decimals and unit', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Move') });
    const q = designer.addQuestion('number') as string;
    designer.updateQuestion(q, { label: 'Weight' });
    const before = designer.getPage();
    designer.setLimits(q, { min: 0, max: 300, decimals: 1 });
    designer.setWidgetOptions(q, { suffix: 'kg' });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Weight”: from 0 to 300', '“Weight”: 1 decimal', '“Weight”: shows “kg” after the number']);
    const later = designer.getPage();
    designer.setLimits(q, { min: null, decimals: 3 });
    designer.setWidgetOptions(q, { suffix: null, prefix: '≈' });
    expect(pageChanges(later, designer.getPage())).toEqual(['“Weight”: at most 300', '“Weight”: 3 decimals', '“Weight”: no unit after the number', '“Weight”: shows “≈” before the number']);
  });

  it('says a rating’s look', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Move') });
    const q = designer.addQuestion('rating') as string;
    designer.updateQuestion(q, { label: 'Lunch' });
    const before = designer.getPage();
    designer.setWidgetOptions(q, { icon: 'thumb' });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Lunch”: shown as thumbs up']);
    const later = designer.getPage();
    designer.setWidgetOptions(q, { icon: null });
    expect(pageChanges(later, designer.getPage())).toEqual(['“Lunch”: shown as stars']);
  });
});
