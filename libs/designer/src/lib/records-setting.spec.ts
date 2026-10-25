import { validatePage, type Field } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { wordsIn } from './designer-words';
import { pageChanges } from './page-checks';
import { listProperties } from './list-properties';
import { pageProperties } from './panel-page';

/**
 * What a screen's records are called, as the designer sets it: the words for one and for more, one with its article,
 * and field labels written small inside Fieldia's sentences — on the screen's panel beside its other settings, both
 * words or neither, said as a change.
 */

const model: Record<string, Field> = { name: { type: 'char', label: 'Name' }, phone: { type: 'char', label: 'Phone' } };

afterEach(() => document.body.replaceChildren());

describe('what the screen’s records are called', () => {
  it('sets both words and one with its article, each kept trimmed; both emptied, takes the setting away', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
    expect(designer.setRecords({ one: ' customer ', other: 'customers', a: 'a customer' })).toBe(true);
    expect(designer.getPage().records).toEqual({ one: 'customer', other: 'customers', a: 'a customer' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setRecords({ one: 'invoice', other: 'invoices', a: ' ' })).toBe(true);
    expect(designer.getPage().records).toEqual({ one: 'invoice', other: 'invoices' });
    expect(designer.setRecords({ one: '', other: '' })).toBe(true);
    expect(designer.getPage().records).toBeUndefined();
    designer.setRecords({ one: 'customer', other: 'customers' });
    expect(designer.setRecords(null)).toBe(true);
    expect(designer.getPage().records).toBeUndefined();
  });

  it('sets labels small as the page’s own setting, beside its records’ names, said as a change of its own', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
    const before = designer.getPage();
    expect(designer.setLowerLabels(true)).toBe(true);
    expect(designer.getPage().lowerLabels).toBe(true);
    expect(designer.getPage().records).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toEqual(['Field names are written small inside Fieldia’s sentences']);
    // Naming the records leaves it be.
    designer.setRecords({ one: 'customer', other: 'customers' });
    expect(designer.getPage().lowerLabels).toBe(true);
    expect(designer.setLowerLabels(false)).toBe(true);
    expect(designer.getPage().lowerLabels).toBeUndefined();
  });

  it('refuses one word without the other, in words, keeping what it held', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
    designer.setRecords({ one: 'customer', other: 'customers' });
    expect(designer.setRecords({ one: 'customer', other: '' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Records are named by two words: one for one record and one for more, such as customer and customers']);
    expect(designer.getPage().records).toEqual({ one: 'customer', other: 'customers' });
  });

  it('is offered on the screen’s panel: both words first, the article once named, small labels beside them', () => {
    const designer = createDesigner({ page: blankPage('sheet', 'Customer'), model });
    const before = designer.getPage();
    const view = pageProperties(elementFactory(document), designer);
    document.body.append(view.element);
    view.update(designer.getPage());
    const box = (name: string) => view.element.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement;
    const row = (name: string) => view.element.querySelector(`[data-setting="${name}"]`) as HTMLElement;
    const type = (name: string, words: string) => {
      box(name).focus();
      box(name).value = words;
      box(name).dispatchEvent(new Event('input'));
      view.update(designer.getPage());
    };
    expect(row('Records are called').hidden).toBe(false);
    // Small labels, named records or not; the article once both words are given.
    expect([row('One with its article').hidden, row('Field names small inside them').hidden]).toEqual([true, false]);
    // One word alone: kept in its box, nothing written, the boxes saying what is missing.
    type('One record is called', 'customer');
    expect(designer.getPage().records).toBeUndefined();
    expect((view.element.querySelector('.fd-records-half') as HTMLElement).hidden).toBe(false);
    box('More are called').focus();
    view.update(designer.getPage());
    expect(box('One record is called').value).toBe('customer');
    type('More are called', 'customers');
    expect(designer.getPage().records).toEqual({ one: 'customer', other: 'customers' });
    expect((view.element.querySelector('.fd-records-half') as HTMLElement).hidden).toBe(true);
    expect([row('One with its article').hidden, row('Field names small inside them').hidden]).toEqual([false, false]);
    type('One with its article', 'a customer');
    (view.element.querySelector('input[aria-label="Field names small inside them"]') as HTMLInputElement).click();
    expect(designer.getPage().records).toEqual({ one: 'customer', other: 'customers', a: 'a customer' });
    expect(designer.getPage().lowerLabels).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('Its records are called “customers” in Fieldia’s sentences');
    expect(pageChanges(designer.getPage(), before)).toContain('Its records are called records again');
  });

  it('is offered first on a list’s panel, the screen a list is', () => {
    const designer = createDesigner({ page: blankPage('list', 'Customers'), model });
    designer.addColumn('name');
    const view = listProperties(elementFactory(document), designer);
    document.body.append(view.element);
    view.update(designer.getPage());
    const first = view.element.querySelector('.fd-prop') as HTMLElement;
    expect(first.getAttribute('data-setting')).toBe('Records are called');
    const box = (name: string) => view.element.querySelector(`input[aria-label="${name}"]`) as HTMLInputElement;
    box('One record is called').value = 'customer';
    box('More are called').value = 'customers';
    box('More are called').dispatchEvent(new Event('input'));
    expect(designer.getPage().records).toEqual({ one: 'customer', other: 'customers' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });

  it('names no records on a page of responses, whose labels may still be small', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Survey'), model });
    const view = pageProperties(elementFactory(document), designer);
    document.body.append(view.element);
    view.update(designer.getPage());
    expect((view.element.querySelector('[data-setting="Records are called"]') as HTMLElement).hidden).toBe(true);
    const small = view.element.querySelector('[data-setting="Field names small inside them"]') as HTMLElement;
    expect(small.hidden).toBe(false);
    (small.querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().lowerLabels).toBe(true);
  });

  it('speaks Arabic in the designer’s Arabic', () => {
    expect(wordsIn('ar').panel.settingName('Records are called')).toBe('اسم السجلات');
    expect(wordsIn('ar').changes.records('عملاء')).toBe('تُسمّى سجلاتها «عملاء» في جمل Fieldia');
  });
});
