import { createForm, type Field, type FieldNode, type Line, type Page } from '@fieldia/core';
import { createWidget } from './widgets';
import { WIDGET_LABELS } from './labels';
import { press } from './test-kinds';

/**
 * A table of lines' details: as few and as many lines as the page says, its
 * button's words, a sentence while it is empty, lines moved by their grip
 * or Alt+↑/↓ — kept in order by the field's sequence where it has one — and
 * a line with something in it removed only once the person says so.
 */

function mount(options: FieldNode['options'] = {}, extra: { sequence?: boolean; readonly?: boolean } = {}) {
  const page = {
    fieldia: '0.1',
    id: 'p',
    data: { kind: 'responses' },
    fields: {
      steps: {
        type: 'one2many',
        label: 'Milestones',
        relation: 'step',
        ...(extra.sequence ? { sequenceField: 'sequence' } : {}),
        fields: { ...(extra.sequence ? { sequence: { type: 'integer', label: 'Sequence' } } : {}), name: { type: 'char', label: 'Milestone' }, done: { type: 'boolean', label: 'Done' } },
      },
    },
    layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'n', field: 'steps', options }] },
  } as unknown as Page;
  const form = createForm({ page });
  const node = (page.layout as { children: FieldNode[] }).children[0];
  const widget = createWidget({ form, name: 'steps', field: page.fields['steps'] as Field, node, id: 'fd-lines', document, labels: WIDGET_LABELS.en });
  document.body.replaceChildren(widget.element);
  const refresh = () => widget.update({ value: form.getState().values['steps'], values: form.getState().values, readonly: extra.readonly === true, required: false, invalid: false });
  form.subscribe(refresh);
  refresh();
  const el = widget.element;
  const lines = () => (form.getState().values['steps'] as Line[] | null) ?? [];
  const names = () => lines().map((l) => l.values['name']);
  const rows = () => [...el.querySelectorAll<HTMLTableRowElement>('tbody tr')];
  const add = () => el.querySelector('.fd-lines-add') as HTMLButtonElement;
  return { form, el, lines, names, rows, add };
}
const fill = (form: ReturnType<typeof mount>['form'], ...names: string[]) => names.map((name) => form.addLine('steps', { name }));
const button = (el: Element, name: string) => [...el.querySelectorAll('button')].find((b) => b.textContent === name || b.getAttribute('aria-label') === name) as HTMLButtonElement;
const pointer = (target: Element, type: string, y: number) => target.dispatchEvent(new MouseEvent(type, { clientY: y, clientX: 5, button: 0, bubbles: true, cancelable: true }));

describe('a table’s least and most lines, and its words', () => {
  it('starts with its least, keeps them, and offers no more once it has its most', () => {
    const { lines, rows, add } = mount({ min: 2, max: 3 });
    expect(lines()).toHaveLength(2);
    expect(rows().every((row) => (row.querySelector('.fd-line-delete') as HTMLElement).hidden)).toBe(true);
    add().click();
    expect(lines()).toHaveLength(3);
    expect(add().closest('.fd-lines-adds')?.hasAttribute('hidden')).toBe(true);
    expect(rows().every((row) => !(row.querySelector('.fd-line-delete') as HTMLElement).hidden)).toBe(true);
  });

  it('says the page’s words on its button, and a sentence of its own while empty', () => {
    const { add, el, form } = mount({ addLabel: 'Add a milestone', emptyLabel: 'No milestones yet.' });
    expect(add().textContent).toBe('+ Add a milestone');
    const empty = el.querySelector('.fd-lines-empty') as HTMLElement;
    expect(empty.textContent).toBe('No milestones yet.');
    expect(empty.hidden).toBe(false);
    fill(form, 'Survey');
    expect(empty.hidden).toBe(true);
    expect(mount().el.querySelector('.fd-lines-empty')).toBeNull();
  });
});

describe('moving a table’s lines', () => {
  it('moves the line with the focus by Alt+↑/↓, the focus going with it, and says where', () => {
    const { form, names, rows, el } = mount();
    fill(form, 'Survey', 'Design', 'Build');
    const design = rows()[1].querySelector('input') as HTMLInputElement;
    design.focus();
    press(design, 'ArrowUp', { altKey: true });
    expect(names()).toEqual(['Design', 'Survey', 'Build']);
    expect(document.activeElement).toBe(design);
    expect(el.querySelector('[role=status]')?.textContent).toBe('Design moved to place 1 of 3');
    // Not past the top; nor without Alt.
    press(design, 'ArrowUp', { altKey: true });
    press(design, 'ArrowDown');
    expect(names()).toEqual(['Design', 'Survey', 'Build']);
    press(design, 'ArrowDown', { altKey: true });
    press(design, 'ArrowDown', { altKey: true });
    expect(names()).toEqual(['Survey', 'Build', 'Design']);
  });

  it('numbers the lines again where the field keeps their order', () => {
    const { form, lines, rows } = mount({}, { sequence: true });
    fill(form, 'Survey', 'Design');
    press(rows()[1].querySelector('input') as HTMLInputElement, 'ArrowUp', { altKey: true });
    expect(lines().map((l) => [l.values['name'], l.values['sequence']])).toEqual([['Design', 1], ['Survey', 2]]);
  });

  it('moves a line dragged by its grip, the grip there for the pointer only', () => {
    const { form, names, rows } = mount();
    fill(form, 'Survey', 'Design', 'Build');
    rows().forEach((row, i) => jest.spyOn(row, 'getBoundingClientRect').mockReturnValue({ top: i * 40, bottom: i * 40 + 40, height: 40, left: 0, right: 300, width: 300, x: 0, y: i * 40, toJSON: () => ({}) }));
    const grip = rows()[0].querySelector('.fd-line-grip') as HTMLElement;
    expect(grip.getAttribute('aria-hidden')).toBe('true');
    pointer(grip, 'pointerdown', 20);
    pointer(grip, 'pointermove', 70);
    expect(names()).toEqual(['Design', 'Survey', 'Build']);
    pointer(grip, 'pointermove', 115);
    pointer(grip, 'pointerup', 115);
    expect(names()).toEqual(['Design', 'Build', 'Survey']);
    pointer(grip, 'pointermove', 5);
    expect(names()).toEqual(['Design', 'Build', 'Survey']);
  });

  it('has no grips and moves nothing when read-only', () => {
    const { form, names, rows } = mount({}, { readonly: true });
    fill(form, 'Survey', 'Design');
    expect((rows()[0].querySelector('.fd-line-grip') as HTMLElement).hidden).toBe(true);
    press(rows()[1].querySelector('input') as HTMLInputElement, 'ArrowUp', { altKey: true });
    expect(names()).toEqual(['Survey', 'Design']);
  });
});

describe('removing a line', () => {
  it('asks first for a line with something in it, where the page says to; Keep keeps it', () => {
    const { form, lines, rows, el } = mount({ confirmDelete: true });
    fill(form, 'Survey');
    form.addLine('steps');
    // An empty line goes at once.
    (rows()[1].querySelector('.fd-line-delete') as HTMLButtonElement).click();
    expect(lines()).toHaveLength(1);
    const remove = rows()[0].querySelector('.fd-line-delete') as HTMLButtonElement;
    remove.click();
    expect(lines()).toHaveLength(1);
    const ask = el.querySelector('.fd-file-confirm') as HTMLElement;
    expect(ask.hidden).toBe(false);
    expect(ask.textContent).toContain('Remove line 1?');
    expect(document.activeElement).toBe(button(el, 'Keep'));
    button(el, 'Keep').click();
    expect(ask.hidden).toBe(true);
    expect(lines()).toHaveLength(1);
    expect(document.activeElement).toBe(remove);
    remove.click();
    button(ask, 'Remove').click();
    expect(lines()).toHaveLength(0);
  });

  it('removes at once where the page does not ask', () => {
    const { form, lines, rows } = mount();
    fill(form, 'Survey');
    (rows()[0].querySelector('.fd-line-delete') as HTMLButtonElement).click();
    expect(lines()).toHaveLength(0);
  });
});
