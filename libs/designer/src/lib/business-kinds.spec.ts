import { validatePage, type Field, type FieldNode } from '@fieldia/core';
import { blankPage, createDesigner, kindOfField, type Designer } from './designer';
import { findNode } from './page-tree';
import { inputChanges } from './input-changes';
import { DESIGNER_WORDS } from './designer-words';
import { choose, mount } from './test-editor';

/** The business widgets as kinds: offered where they suit what a field holds, with their own settings, in English and Arabic. */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Title' },
  allocated_hours: { type: 'float', label: 'Allocated hours' },
  priority: { type: 'selection', label: 'Priority', options: [{ value: '0', label: 'Normal' }, { value: '1', label: 'High' }] },
  request_date_from: { type: 'date', label: 'From' },
  request_date_to: { type: 'date', label: 'To' },
  timer_start: { type: 'datetime', label: 'Timer started' },
  tax_totals: { type: 'json', label: 'Totals' },
  currency_id: { type: 'many2one', label: 'Currency', relation: 'res.currency' },
};

const nodeOf = (designer: Designer, id: string) => findNode(designer.getPage(), id)?.node as FieldNode;
const screen = (locale?: 'ar') => createDesigner({ page: blankPage('screen', 'Task'), model, ...(locale ? { locale } : {}) });

describe('the business kinds', () => {
  it('are offered only on the fields they suit', () => {
    const designer = screen();
    const kinds = (name: string) => designer.kindsFor(designer.addModelField(name) as string).map((k) => k.id);
    expect(kinds('allocated_hours')).toEqual(expect.arrayContaining(['duration', 'percentage', 'timer']));
    expect(kinds('allocated_hours')).not.toContain('priority');
    expect(kinds('priority')).toEqual(expect.arrayContaining(['priority', 'state-dot']));
    expect(kinds('request_date_from')).toEqual(['date', 'date-range']);
    expect(kinds('timer_start')).toEqual(['date-time', 'timer', 'date-range']);
    expect(kinds('tax_totals')).toEqual(['address', 'distribution', 'tax-totals', 'payments']);
  });

  it('show a model’s field as one, keeping what it holds, as one undo step', () => {
    const designer = screen();
    const id = designer.addModelField('allocated_hours') as string;
    expect(designer.changeKind(id, 'duration')).toBe(true);
    expect(nodeOf(designer, id).widget).toBe('duration');
    expect(designer.getPage().fields['allocated_hours']).toEqual(model['allocated_hours']);
    expect(kindOfField(model['allocated_hours'], nodeOf(designer, id))).toBe('duration');
    designer.undo();
    expect(nodeOf(designer, id).widget).toBeUndefined();
  });

  it('refuse a field they do not suit, saying why in Arabic', () => {
    const designer = screen('ar');
    const id = designer.addModelField('name') as string;
    expect(designer.changeKind(id, 'tax-totals')).toBe(false);
    expect(designer.getState().issues[0]).toContain('لا يُعرض إلا على هيئة');
    expect(designer.getState().issues[0]).toContain('لون');
  });

  it('are each a kind a new field can be made as, the page staying valid', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Task') });
    for (const kind of ['priority', 'state-dot', 'duration', 'percentage', 'timer', 'date-range', 'colour', 'copy', 'pdf', 'embed', 'distribution', 'tax-totals', 'payments', 'properties']) {
      const id = designer.addQuestion(kind) as string;
      expect(kindOfField(designer.getPage().fields[nodeOf(designer, id).field], nodeOf(designer, id))).toBe(kind);
    }
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});

describe('their own settings', () => {
  it('pick the date a range ends on among the page’s dates, for a field of the model too', () => {
    const designer = screen();
    designer.addModelField('request_date_to');
    const id = designer.addModelField('request_date_from') as string;
    designer.changeKind(id, 'date-range');
    designer.select(id);
    const { host } = mount(designer);
    const ends = host.querySelector('.fd-canvas-field.fd-editing select[aria-label="Ends on"]') as HTMLSelectElement;
    expect([...ends.options].map((o) => o.textContent)).toEqual(['None', 'To']);
    choose(ends, 'request_date_to');
    expect(nodeOf(designer, id).options).toEqual({ endField: 'request_date_to' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('pick the start a timer runs from, and tax totals’ currency, in Arabic', () => {
    const designer = screen('ar');
    designer.addModelField('timer_start');
    designer.addModelField('currency_id');
    const hours = designer.addModelField('allocated_hours') as string;
    designer.changeKind(hours, 'timer');
    designer.select(hours);
    const { host } = mount(designer);
    const runs = host.querySelector('.fd-canvas-field.fd-editing select[aria-label="يعمل منذ"]') as HTMLSelectElement;
    choose(runs, 'timer_start');
    expect(nodeOf(designer, hours).options).toEqual({ startField: 'timer_start' });
    const totals = designer.addModelField('tax_totals') as string;
    designer.changeKind(totals, 'tax-totals');
    designer.select(totals);
    const currency = host.querySelector('.fd-canvas-field.fd-editing select[aria-label="العملة من"]') as HTMLSelectElement;
    choose(currency, 'currency_id');
    expect(nodeOf(designer, totals).options).toEqual({ currencyField: 'currency_id' });
  });

  it('are said in words when they change, in English and Arabic', () => {
    const field = model['request_date_from'];
    const was = { field, node: { type: 'field', id: 'f', field: 'request_date_from', widget: 'daterange' } as FieldNode };
    const now = { field, node: { ...was.node, options: { endField: 'request_date_to' } } };
    expect(inputChanges('From', was, now).lines).toEqual(['“From”: ends on “request_date_to”']);
    expect(inputChanges('From', was, now, DESIGNER_WORDS.ar).lines[0]).toContain('ينتهي في');
  });
});
