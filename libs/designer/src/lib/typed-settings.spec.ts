import { validatePage, type FieldNode, type SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { kindOfField, QUESTION_KINDS } from './kinds';
import { mount } from './test-editor';

/**
 * A short answer typed to a mask and a one-time code, as the designer makes them: the mask typed in the field's own
 * settings, its letters in capitals; the kind One-time code in the Text group, its digits and whether letters are in it.
 */

afterEach(() => document.body.replaceChildren());

const nodeOf = (designer: ReturnType<typeof createDesigner>, id: string) => (designer.getPage().layout as { children: SectionNode[] }).children[0].children.find((n) => n.id === id) as FieldNode;

describe('masks and one-time codes in the designer', () => {
  it('types a short answer to a mask, its letters in capitals; emptied, no mask', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Lease') });
    const id = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    designer.select(id);
    const { host } = mount(designer, { mode: 'simple' });
    const card = host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
    const mask = card.querySelector('[aria-label="Mask"]') as HTMLInputElement;
    const capitals = card.querySelector('[role="switch"][aria-label="Letters in capitals"]') as HTMLButtonElement;
    expect((capitals.closest('.fd-inline-toggle') as HTMLElement).hidden).toBe(true);
    mask.value = '9999 aaa';
    mask.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nodeOf(designer, id).options).toEqual({ mask: '9999 aaa' });
    expect((capitals.closest('.fd-inline-toggle') as HTMLElement).hidden).toBe(false);
    capitals.click();
    expect(nodeOf(designer, id).options).toEqual({ mask: '9999 aaa', upper: true });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    mask.value = '';
    mask.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nodeOf(designer, id).options).toBeUndefined();
  });

  it('refuses a mask that names nothing to type, as the format does', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Lease') });
    const id = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    expect(designer.setWidgetOptions(id, { mask: '---' })).toBe(false);
    expect(designer.setWidgetOptions(id, { mask: '99 [99] 99' })).toBe(false);
    expect(designer.setWidgetOptions(id, { mask: '99 [99]' })).toBe(true);
  });

  it('makes a one-time code of the Text group, its digits and letters set in its own settings', () => {
    expect(QUESTION_KINDS.find((kind) => kind.id === 'one-time-code')?.widget).toBe('one-time-code');
    const designer = createDesigner({ page: blankPage('screen', 'Sign in') });
    const id = designer.addQuestion('one-time-code', { parent: 'section-1' }) as string;
    const field = Object.values(designer.getPage().fields)[0];
    expect(field.type).toBe('char');
    expect(kindOfField(field, nodeOf(designer, id))).toBe('one-time-code');
    designer.select(id);
    const { host } = mount(designer, { mode: 'simple' });
    const card = host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
    const digits = card.querySelector('[aria-label="Digits"]') as HTMLSelectElement;
    expect(digits.value).toBe('6');
    digits.value = '4';
    digits.dispatchEvent(new Event('change', { bubbles: true }));
    (card.querySelector('[role="switch"][aria-label="Letters too"]') as HTMLButtonElement).click();
    expect(nodeOf(designer, id).options).toEqual({ length: 4, letters: true });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});
