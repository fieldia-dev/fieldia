import { checkValue, validatePage, type Field, type FieldNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { findNode } from './page-tree';
import { mount, type } from './test-editor';

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
