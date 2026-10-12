import { blankPage, createDesigner } from './designer';
import { mount, openTab } from './test-editor';
import { employeeDesigner, expectValid, nodeOf } from './test-layout';

/**
 * The quiet look in the designer: the page's skin, a group quiet on its own or
 * in boxes inside a quiet page, and one field's own word — each set, taken
 * back, kept valid, and worn by the canvas as the form will wear it.
 */

describe('the quiet look’s settings', () => {
  it('makes a group quiet, or boxed inside a quiet page, and takes it back', () => {
    const d = employeeDesigner();
    expect(d.setSectionLook('personal', { quiet: true })).toBe(true);
    expect(nodeOf(d.getPage(), 'personal')?.['quiet']).toBe(true);
    d.setSectionLook('personal', { quiet: false });
    expect(nodeOf(d.getPage(), 'personal')?.['quiet']).toBe(false);
    expectValid(d.getPage());
    d.setSectionLook('personal', { quiet: null });
    expect(nodeOf(d.getPage(), 'personal')).not.toHaveProperty('quiet');
  });

  it('makes one field quiet, or keeps it in its box, and refuses a part that is no field', () => {
    const d = employeeDesigner();
    expect(d.setFieldQuiet('f-email', true)).toBe(true);
    expect(nodeOf(d.getPage(), 'f-email')?.['quiet']).toBe(true);
    expect(d.setFieldQuiet('f-email', false)).toBe(true);
    expect(nodeOf(d.getPage(), 'f-email')?.['quiet']).toBe(false);
    expectValid(d.getPage());
    d.setFieldQuiet('f-email', null);
    expect(nodeOf(d.getPage(), 'f-email')).not.toHaveProperty('quiet');
    expect(d.setFieldQuiet('personal', true)).toBe(false);
    expect(d.getState().issues).toEqual(['There is no field “personal”']);
  });

  it('sets the page’s skin, and takes it back', () => {
    const d = employeeDesigner();
    expect(d.setLook({ skin: 'quiet' })).toBe(true);
    expect(d.getPage().look?.skin).toBe('quiet');
    expectValid(d.getPage());
    d.setLook({ skin: null });
    expect(d.getPage().look?.skin).toBeUndefined();
  });
});

describe('the Layout tab’s Quiet, for a group and a field', () => {
  function screenEditor() {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    const field = designer.addQuestion('short-answer', { parent: 'section-1' }) as string;
    const { host } = mount(designer, { mode: 'advanced' });
    const canvas = host.querySelector('.fd-canvas') as HTMLElement;
    const quietRow = () => host.querySelector('.fd-properties [role="tabpanel"]:not([hidden]) [data-setting="Quiet"]') as HTMLElement;
    const press = (words: string) => [...quietRow().querySelectorAll('button')].find((b) => b.textContent === words)?.click();
    const card = () => canvas.querySelector(`.fd-canvas-field[data-node="${field}"]`) as HTMLElement;
    return { designer, host, field, canvas, quietRow, press, card };
  }

  it('makes the picked field quiet on the canvas, then boxed in a quiet page, then as its group draws it', () => {
    const { designer, host, field, press, card, quietRow } = screenEditor();
    openTab(host, 'Layout');
    expect([...quietRow().querySelectorAll('button')].map((b) => b.textContent)).toEqual(['As group', 'Quiet', 'In boxes']);
    press('Quiet');
    expect(nodeOf(designer.getPage(), field)?.['quiet']).toBe(true);
    expect(card().hasAttribute('data-quiet')).toBe(true);
    designer.setLook({ skin: 'quiet' });
    press('In boxes');
    expect(card().hasAttribute('data-quiet')).toBe(false);
    press('As group');
    expect(nodeOf(designer.getPage(), field)).not.toHaveProperty('quiet');
    expect(card().hasAttribute('data-quiet')).toBe(true);
  });

  it('makes a picked group quiet, its fields with it', () => {
    const { designer, host, press, card } = screenEditor();
    designer.select('section-1');
    openTab(host, 'Layout');
    press('Quiet');
    expect(nodeOf(designer.getPage(), 'section-1')?.['quiet']).toBe(true);
    expect(card().hasAttribute('data-quiet')).toBe(true);
  });
});
