import type { Field, FieldNode, SectionNode, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { choose, mount, type } from './test-editor';
import { mountSurveyEditor } from './survey-editor';

/** What a kind has beyond its words, set in the picked field itself: a rating's levels, a scale's ends, an amount's currency, what a link points to, a table's columns. */

const nodes = (designer: ReturnType<typeof createDesigner>) => ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]);
const fieldOf = (designer: ReturnType<typeof createDesigner>, id: string) => designer.getPage().fields[nodes(designer).find((n) => n.id === id)?.field as string];
const inline = (host: Element, name: string) => host.querySelector(`.fd-canvas-field.fd-editing [aria-label="${name}"]`) as (HTMLInputElement & HTMLSelectElement) | null;

function screenWith(kind: string, model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Visit'), model });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  const { host } = mount(designer);
  return { designer, id, host };
}

describe('settings in the picked field itself', () => {
  it('sets a rating’s levels, its stars following', () => {
    const { designer, id, host } = screenWith('rating');
    expect(inline(host, 'Levels')?.value).toBe('5');
    choose(inline(host, 'Levels') ?? undefined, '7');
    expect(fieldOf(designer, id)).toMatchObject({ min: 1, max: 7 });
    expect(host.querySelectorAll('.fd-canvas-field.fd-editing .fd-canvas-widget [data-value]')).toHaveLength(7);
  });

  it('sets where a linear scale starts and ends', () => {
    const { designer, id, host } = screenWith('scale');
    expect([inline(host, 'From')?.value, inline(host, 'To')?.value]).toEqual(['0', '10']);
    choose(inline(host, 'From') ?? undefined, '1');
    choose(inline(host, 'To') ?? undefined, '5');
    expect(fieldOf(designer, id)).toMatchObject({ min: 1, max: 5 });
  });

  it('sets an amount’s currency, refusing what is not one', () => {
    const { designer, id, host } = screenWith('amount');
    type(inline(host, 'Currency') ?? undefined, 'EUR');
    expect(fieldOf(designer, id)).toMatchObject({ currency: 'EUR' });
    type(inline(host, 'Currency') ?? undefined, 'EU');
    expect(fieldOf(designer, id)).toMatchObject({ currency: 'EUR' });
    // Half typed is not wrong yet: nothing is said.
    expect(designer.getState().issues).toEqual([]);
  });

  it('sets what a link points to', () => {
    const { designer, id, host } = screenWith('link');
    expect(inline(host, 'Links to')?.value).toBe('contact');
    type(inline(host, 'Links to') ?? undefined, 'company');
    expect(fieldOf(designer, id)).toMatchObject({ relation: 'company' });
  });

  it('names a table’s columns, and adds one', () => {
    const { designer, id, host } = screenWith('lines');
    expect(inline(host, 'Column 1')?.value).toBe('Description');
    // The columns typed in stand in for the table while it is picked.
    expect((host.querySelector('.fd-canvas-field.fd-editing .fd-canvas-widget') as HTMLElement).hidden).toBe(true);
    (host.querySelector('.fd-canvas-field.fd-editing .fd-inline-settings [data-add-column], .fd-canvas-field.fd-editing .fd-inline-settings button.fd-button-link') as HTMLButtonElement).click();
    const field = fieldOf(designer, id);
    expect(field.type === 'one2many' && Object.keys(field.fields)).toHaveLength(3);
  });

  it('leaves what the model keeps to the model', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit'), model: { price: { type: 'monetary', label: 'Price', currency: 'EGP' } } });
    designer.addModelField('price', { parent: 'section-1' });
    const { host } = mount(designer);
    expect(host.querySelector('.fd-canvas-field.fd-editing')).not.toBeNull();
    expect(inline(host, 'Currency')).toBeNull();
  });

  it('sets a rating’s levels in a survey’s open card too', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const designer = createDesigner({ page: blankPage('survey', 'Feedback') });
    const id = designer.addQuestion('rating') as string;
    const handle = mountSurveyEditor(host, { designer });
    const levels = host.querySelector('.fd-q-selected [aria-label="Levels"]') as HTMLSelectElement;
    choose(levels, '10');
    const node = (designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode;
    expect(designer.getPage().fields[node.field]).toMatchObject({ max: 10 });
    handle.destroy();
  });
});

describe('a range', () => {
  it('runs from a smaller whole number to a bigger one', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const id = designer.addQuestion('scale', { parent: 'section-1' }) as string;
    expect(designer.setRange(id, { min: 5, max: 5 })).toBe(false);
    expect(designer.getState().issues).toEqual(['A range runs from a smaller whole number to a bigger one']);
    const text = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    expect(designer.setRange(text, { min: 1, max: 5 })).toBe(false);
    expect(designer.getState().issues).toEqual(['Only a rating, a scale or a progress has a range']);
  });
});
