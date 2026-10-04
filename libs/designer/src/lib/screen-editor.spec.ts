import type { Field, FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { button, choose, field, mount, openTab, press, tile, type } from './test-editor';

const sectionsOf = (page: Page) => (page.layout as { children: SectionNode[] }).children;
const fieldsOf = (page: Page, section: number) => sectionsOf(page)[section].children as FieldNode[];
const defOf = (page: Page, node: FieldNode) => page.fields[node.field] as Field & { help?: string; required?: boolean };

/** A visit report: Customer, Date and Notes in one section, Next step in another. */
function visitReport(model?: Record<string, Field>) {
  const designer = createDesigner({ page: blankPage('screen', 'Visit report'), model });
  const ids: Record<string, string> = {};
  const add = (key: string, kind: string, label: string, parent: string) => {
    ids[key] = designer.addQuestion(kind, { parent }) as string;
    designer.updateQuestion(ids[key], { label });
  };
  add('customer', 'short-answer', 'Customer', 'section-1');
  add('date', 'date', 'Date', 'section-1');
  add('notes', 'paragraph', 'Notes', 'section-1');
  const second = designer.addContainer('Follow-up') as string;
  add('next', 'dropdown', 'Next step', second);
  designer.select(null);
  return { designer, ids, sections: ['section-1', second] };
}
const card = (host: Element, id: string) => host.querySelector(`.fd-canvas-field[data-node="${id}"]`) as HTMLElement;

describe('screen editor — adding from the toolbox', () => {
  it('adds after the field picked, with its name selected on the canvas to be typed over', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['customer']);
    tile(host, 'kind:email').click();
    const added = designer.getState().selected as string;
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['customer'], added, ids['date'], ids['notes']]);
    const label = card(host, added).querySelector('[data-inline="label"]') as HTMLInputElement;
    expect(document.activeElement).toBe(label);
    expect([label.selectionStart, label.selectionEnd]).toEqual([0, label.value.length]);
    // A run of them can be typed: the next goes after this one, its name ready too.
    type(label, 'Email');
    tile(host, 'kind:phone').click();
    const next = designer.getState().selected as string;
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['customer'], added, next, ids['date'], ids['notes']]);
    expect(defOf(designer.getPage(), fieldsOf(designer.getPage(), 0)[1]).label).toBe('Email');
    expect(document.activeElement).toBe(card(host, next).querySelector('[data-inline="label"]'));
  });

  it('adds at the end of the section picked, or of the last one on show', () => {
    const { designer, sections } = visitReport();
    const { host } = mount(designer);
    tile(host, 'kind:date').click();
    expect(fieldsOf(designer.getPage(), 1)).toHaveLength(2);
    designer.select(sections[0]);
    tile(host, 'kind:yes-no').click();
    expect(fieldsOf(designer.getPage(), 0)).toHaveLength(4);
  });

  it('adds the model’s fields as they are, and lists only those not on the page', () => {
    const { designer } = visitReport({ vat: { type: 'char', label: 'VAT number' }, credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' } });
    const { host } = mount(designer);
    expect([...host.querySelectorAll('.fd-tool-group-model [data-tool]')].map((t) => t.getAttribute('data-tool'))).toEqual(['model:vat', 'model:credit_limit']);
    tile(host, 'model:credit_limit').click();
    expect(designer.getPage().fields['credit_limit']).toEqual({ type: 'monetary', label: 'Credit limit', currency: 'EGP' });
    expect([...host.querySelectorAll('.fd-tool-group-model [data-tool]')].map((t) => t.getAttribute('data-tool'))).toEqual(['model:vat']);
  });

  it('adds a section from the layout tiles', () => {
    const { designer } = visitReport();
    const { host } = mount(designer);
    tile(host, 'layout:section').click();
    expect(sectionsOf(designer.getPage())).toHaveLength(3);
    const created = sectionsOf(designer.getPage())[2].id;
    expect(designer.getState().selected).toBe(created);
    // Its title on the canvas takes the cursor, every word selected, to be typed over.
    const title = host.querySelector(`[data-node="${created}"] .fd-canvas-section-title-input`) as HTMLInputElement;
    expect(document.activeElement).toBe(title);
    expect([title.selectionStart, title.selectionEnd]).toEqual([0, title.value.length]);
  });
});

describe('screen editor — the panel', () => {
  it('shows the field picked, and changes it: label, kind, required, help', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    card(host, ids['next']).click();
    expect(host.querySelector('.fd-properties .fd-panel-title')?.textContent).toBe('Dropdown');
    type(field(host, 'Label'), 'Next steps');
    expect(defOf(designer.getPage(), fieldsOf(designer.getPage(), 1)[0]).label).toBe('Next steps');
    // The canvas follows the panel.
    expect((card(host, ids['next']).querySelector('[data-inline="label"]') as HTMLInputElement).value).toBe('Next steps');
    choose(field(host, 'Shown as'), 'multiple-choice');
    expect(fieldsOf(designer.getPage(), 1)[0].widget).toBe('radio');
    type(field(host, 'Help text'), 'What happens next');
    openTab(host, 'Rules');
    field(host, 'Required')?.click();
    expect(defOf(designer.getPage(), fieldsOf(designer.getPage(), 1)[0])).toMatchObject({ required: true, help: 'What happens next' });
  });

  it('offers a model field only the kinds that fit it, and says why', () => {
    const { designer } = visitReport({ credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' } });
    const { host } = mount(designer);
    tile(host, 'model:credit_limit').click();
    const kind = field(host, 'Shown as') as HTMLSelectElement;
    expect([...kind.options].map((o) => o.value)).toEqual(['amount']);
    expect(kind.disabled).toBe(true);
    expect(host.querySelector('.fd-kind-note')?.textContent).toBe('Credit limit is stored as an amount in the model, so this is the one way to show it.');
    // Its currency is the model's.
    expect(field(host, 'Currency')).toBeUndefined();
  });

  it('sets the width, and moves a field to another section', () => {
    const { designer, ids, sections } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['customer']);
    openTab(host, 'Layout');
    const width = host.querySelector('.fd-properties [role="group"][aria-label="Width"]') as HTMLElement;
    expect([...width.querySelectorAll('button')].map((b) => b.getAttribute('aria-label'))).toEqual(['1 column', 'All 2 columns']);
    button(width, 'All 2 columns')?.click();
    expect(fieldsOf(designer.getPage(), 0)[0].colspan).toBe(2);
    expect(card(host, ids['customer']).style.getPropertyValue('--fd-span')).toBe('2');
    choose(field(host, 'Section'), sections[1]);
    expect(fieldsOf(designer.getPage(), 1).map((n) => n.id)).toEqual([ids['next'], ids['customer']]);
    expect([...host.querySelectorAll(`[data-node="${sections[1]}"] .fd-canvas-field`)].map((c) => c.getAttribute('data-node'))).toEqual([ids['next'], ids['customer']]);
  });

  it('shows a field only for some answers, set from the bar on the field', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    const call = designer.addQuestion('yes-no', { parent: 'section-1' }) as string;
    designer.updateQuestion(call, { label: 'Call back?' });
    card(host, ids['notes']).click();
    button(card(host, ids['notes']), 'Show only when…')?.click();
    // The panel's rules open, on the fields that hold one of a list or yes or no.
    const rule = host.querySelector('.fd-properties .fd-when-rule') as HTMLElement;
    expect(rule).not.toBeNull();
    const [which] = [...rule.querySelectorAll('select')] as HTMLSelectElement[];
    expect([...which.options].map((o) => o.textContent)).toContain('Call back?');
    expect(fieldsOf(designer.getPage(), 0).find((n) => n.id === ids['notes'])?.invisible).toBeDefined();
    expect(button(card(host, ids['notes']), 'Show only when…')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('duplicates and deletes the field picked', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['date']);
    button(host.querySelector('.fd-properties') as Element, 'Duplicate')?.click();
    expect(fieldsOf(designer.getPage(), 0)).toHaveLength(4);
    button(host.querySelector('.fd-properties') as Element, 'Delete field')?.click();
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['customer'], ids['date'], ids['notes']]);
  });

  it('renames a section, changes its columns, and deletes one', () => {
    const { designer, sections } = visitReport();
    const { host } = mount(designer);
    designer.select(sections[1]);
    type(field(host.querySelector('.fd-properties') as Element, 'Section title'), 'Next steps');
    openTab(host, 'Layout');
    button(host.querySelector('.fd-properties [role="group"][aria-label="Columns on a desktop"]') as Element, '3 columns')?.click();
    expect(sectionsOf(designer.getPage())[1]).toMatchObject({ title: 'Next steps', columns: 3 });
    const shown = host.querySelector(`[data-node="${sections[1]}"]`) as HTMLElement;
    expect((shown.querySelector('.fd-grid') as HTMLElement).style.getPropertyValue('--fd-columns')).toBe('3');
    openTab(host, 'Content');
    button(host.querySelector('.fd-properties') as Element, 'Delete section')?.click();
    expect(sectionsOf(designer.getPage()).map((s) => s.id)).not.toContain(sections[1]);
    expect(host.querySelector(`[data-node="${sections[1]}"]`)).toBeNull();
  });
});

describe('screen editor — the keyboard', () => {
  it('moves the field picked with Alt and an arrow, and deletes it with Delete', () => {
    const { designer, ids } = visitReport();
    mount(designer);
    designer.select(ids['customer']);
    press('ArrowDown', { altKey: true }, document.body);
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['date'], ids['customer'], ids['notes']]);
    press('ArrowUp', { altKey: true }, document.body);
    expect(fieldsOf(designer.getPage(), 0)[0].id).toBe(ids['customer']);
    press('Delete', {}, document.body);
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['date'], ids['notes']]);
  });

  it('leaves Delete to the box being typed in, and puts the field down on Escape', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    card(host, ids['date']).click();
    const label = card(host, ids['date']).querySelector('[data-inline="label"]') as HTMLInputElement;
    label.focus();
    press('Backspace', {}, label);
    expect(fieldsOf(designer.getPage(), 0)).toHaveLength(3);
    press('Escape', {}, label);
    expect(designer.getState().selected).toBeNull();
    expect(host.querySelector('.fd-editing')).toBeNull();
  });
});

describe('screen editor — try it', () => {
  it('shows the screen working as people will use it, in place of the editor, and back', () => {
    const { designer } = visitReport();
    const { host } = mount(designer);
    const mode = (name: string) => host.querySelector(`.fd-designer-bar button[data-mode="${name}"]`) as HTMLButtonElement;
    mode('try').click();
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(true);
    const trying = host.querySelector('.fd-try') as HTMLElement;
    expect(trying.hidden).toBe(false);
    expect([...trying.querySelectorAll('.fd-label')].map((l) => l.textContent)).toEqual(['Customer', 'Date', 'Notes', 'Next step']);
    // The editor's keys rest while the page is tried.
    designer.select(fieldsOf(designer.getPage(), 0)[0].id);
    press('Delete', {}, document.body);
    expect(fieldsOf(designer.getPage(), 0)).toHaveLength(3);
    mode('design').click();
    expect(trying.hidden).toBe(true);
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(false);
  });
});

describe('screen editor — putting a field down', () => {
  /** A click as a person makes one, on an element: it bubbles, as a real one does. */
  const click = (target: Element) => target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

  it('puts the field picked down at a click on the canvas’s empty room, a section’s, or outside the editor', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    const canvas = host.querySelector('.fd-canvas') as HTMLElement;
    for (const target of [canvas, host.querySelector('.fd-canvas-section') as HTMLElement, host.querySelector('.fd-screen-body') as HTMLElement, document.body]) {
      designer.select(ids['customer']);
      expect(card(host, ids['customer']).classList.contains('fd-editing')).toBe(true);
      click(target);
      expect(designer.getState().selected).toBeNull();
      expect(card(host, ids['customer']).classList.contains('fd-editing')).toBe(false);
    }
  });

  it('keeps it picked at a click on itself, its bar, the panel, the toolbox or the bar at the top', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['customer']);
    for (const target of [
      // Its own tinted room, and its widget, there to be looked at.
      card(host, ids['customer']),
      card(host, ids['customer']).querySelector('.fd-canvas-widget') as HTMLElement,
      card(host, ids['customer']).querySelector('[data-inline="label"]') as HTMLElement,
      card(host, ids['customer']).querySelector('.fd-field-bar') as HTMLElement,
      host.querySelector('.fd-properties') as HTMLElement,
      field(host.querySelector('.fd-properties') as HTMLElement, 'Label') as HTMLElement,
      host.querySelector('.fd-rail-tabs') as HTMLElement,
      host.querySelector('.fd-designer-bar') as HTMLElement,
    ]) {
      click(target);
      expect(designer.getState().selected).toBe(ids['customer']);
    }
  });

  it('picks another field at a click on it, rather than putting both down', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['customer']);
    (card(host, ids['date']).querySelector('.fd-label') as HTMLElement).click();
    expect(designer.getState().selected).toBe(ids['date']);
  });
});
