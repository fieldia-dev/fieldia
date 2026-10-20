import { validatePage, type Field, type ListNode } from '@fieldia/core';
import { elementFactory } from './chrome';
import { blankPage, createDesigner } from './designer';
import { listProperties } from './list-properties';

/**
 * A list's filters as a buyer and a sales team expect them, as the designer edits them (w4-filters): a number's or a
 * date's range on the filter bar, with a press for each least value; how many each filter finds; and on a phone, the
 * filter bar's fields in a sheet.
 */

const model: Record<string, Field> = {
  name: { type: 'char', label: 'Home' },
  kind: { type: 'selection', label: 'Type', options: [{ value: 'flat', label: 'Flat' }, { value: 'villa', label: 'Villa' }] },
  price: { type: 'monetary', label: 'Price', currency: 'EGP' },
  bedrooms: { type: 'integer', label: 'Bedrooms' },
  listed_on: { type: 'date', label: 'Listed on' },
  notes: { type: 'html', label: 'Notes' },
};
const list = (d: ReturnType<typeof createDesigner>) => d.getPage().layout as ListNode;
const homes = () => {
  const designer = createDesigner({ page: blankPage('list', 'Homes'), model });
  designer.addColumn('name');
  designer.addColumn('price');
  return designer;
};

describe('a list’s filters, by the designer', () => {
  it('offers a number’s and a date’s range on the filter bar; a whole number by its values unless it goes by its range', () => {
    const designer = homes();
    expect(designer.setListOptions({ search: 'fields', filterFields: ['kind', 'price', 'bedrooms', 'listed_on'] })).toBe(true);
    expect(list(designer).filterRanges).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ filterRange: { field: 'bedrooms', range: {} } })).toBe(true);
    expect(list(designer).filterRanges).toEqual({ bedrooms: {} });
    // Its least values from the smallest, each once.
    expect(designer.setListOptions({ filterRange: { field: 'bedrooms', range: { atLeast: [3, 1, 2, 2] } } })).toBe(true);
    expect(list(designer).filterRanges).toEqual({ bedrooms: { atLeast: [1, 2, 3] } });
    // An amount's range is there whatever is named: only its presses are kept.
    expect(designer.setListOptions({ filterRange: { field: 'price', range: { atLeast: [1_000_000] } } })).toBe(true);
    expect(designer.setListOptions({ filterRange: { field: 'price', range: {} } })).toBe(true);
    expect(list(designer).filterRanges).toEqual({ bedrooms: { atLeast: [1, 2, 3] } });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Back to its values; a field no longer offered takes its range with it.
    expect(designer.setListOptions({ filterRange: { field: 'bedrooms', range: { atLeast: [2] } } })).toBe(true);
    expect(designer.setListOptions({ filterFields: ['kind', 'price'] })).toBe(true);
    expect(list(designer).filterRanges).toBeUndefined();
    expect(designer.setListOptions({ filterFields: ['kind', 'bedrooms'], filterRange: { field: 'bedrooms', range: {} } })).toBe(true);
    expect(designer.setListOptions({ filterRange: { field: 'bedrooms', range: null } })).toBe(true);
    expect(list(designer).filterRanges).toBeUndefined();
  });

  it('refuses a range of a field not offered or with none, presses on a date, and least values that are no whole numbers', () => {
    const designer = homes();
    designer.setListOptions({ search: 'fields', filterFields: ['kind', 'bedrooms', 'listed_on'] });
    const refused = (patch: Parameters<typeof designer.setListOptions>[0]) => {
      expect(designer.setListOptions(patch)).toBe(false);
      return designer.getState().issues[0];
    };
    expect(refused({ filterRange: { field: 'price', range: {} } })).toBe('The filter bar does not offer Price: tick it first');
    expect(refused({ filterRange: { field: 'kind', range: {} } })).toBe('The filter bar takes the range of a number or a date; Type is neither');
    expect(refused({ filterRange: { field: 'listed_on', range: { atLeast: [1] } } })).toBe('A press for a least value is a number’s; Listed on holds dates');
    expect(refused({ filterRange: { field: 'bedrooms', range: { atLeast: [1.5] } } })).toBe('Bedrooms holds whole numbers: each least value is one');
    expect(refused({ filterRange: { field: 'bedrooms', range: { atLeast: [Number.NaN] } } })).toBe('Bedrooms’s least values are numbers, parted by commas: 1, 2, 3');
    expect(refused({ filterFields: ['notes'] })).toBe('The filter bar cannot list the values of Notes, nor take its range');
  });

  it('counts each filter on either bar, and folds the filter bar into a sheet on a phone', () => {
    const designer = homes();
    expect(designer.setListOptions({ filterCounts: true })).toBe(true);
    expect(list(designer).filterCounts).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(designer.setListOptions({ filterSheet: true })).toBe(false);
    expect(designer.getState().issues).toEqual(['The sheet on a phone is the filter bar’s: choose “A keyword and each field’s values” first']);
    expect(designer.setListOptions({ search: 'fields', filterFields: ['kind'], filterSheet: true })).toBe(true);
    expect(list(designer)).toMatchObject({ filterSheet: true, filterCounts: true });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // The search bar back: the sheet goes with the filter bar; the counts are the search bar's too.
    expect(designer.setListOptions({ search: 'bar' })).toBe(true);
    expect(list(designer).filterSheet).toBeUndefined();
    expect(list(designer).filterCounts).toBe(true);
    expect(designer.setListOptions({ filterCounts: false })).toBe(true);
    expect(list(designer).filterCounts).toBeUndefined();
  });
});

describe('the list’s panel', () => {
  const change = (input: HTMLInputElement | HTMLSelectElement, value?: string) => {
    if (value !== undefined) input.value = value;
    else if (input instanceof HTMLInputElement) input.checked = !input.checked;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  function mount() {
    const designer = homes();
    const panel = listProperties(elementFactory(document), designer);
    document.body.replaceChildren(panel.element);
    const update = () => panel.update(designer.getPage());
    designer.subscribe(update);
    update();
    const control = <T extends HTMLElement>(name: string) => panel.element.querySelector<T>(`[aria-label="${name}"]`)!;
    const shown = (element: Element | null) => !!element && !element.closest('[hidden]');
    return { designer, control, shown };
  }

  it('offers a whole number by its range and its least values, an amount’s least values, counts and the sheet', () => {
    const { designer, control, shown } = mount();
    const counts = control<HTMLInputElement>('Say how many each filter finds');
    expect(shown(counts)).toBe(true);
    change(counts);
    expect(list(designer).filterCounts).toBe(true);
    const sheet = () => control<HTMLInputElement>('On a phone, the filters in a sheet');
    expect(shown(sheet())).toBe(false);
    change(control<HTMLSelectElement>('Search'), 'fields');
    expect(shown(sheet())).toBe(true);
    change(sheet());
    expect(list(designer).filterSheet).toBe(true);
    change(control<HTMLInputElement>('Offer Bedrooms’s values'));
    change(control<HTMLInputElement>('Offer Price’s values'));
    expect(list(designer).filterFields).toEqual(['bedrooms', 'price']);
    // A whole number goes by its values until it is told to go by its range; then its least values, a press each.
    expect(control('Bedrooms’s least values, a press each')).toBeNull();
    change(control<HTMLInputElement>('Bedrooms by its range, From and To'));
    expect(list(designer).filterRanges).toEqual({ bedrooms: {} });
    const least = control<HTMLInputElement>('Bedrooms’s least values, a press each');
    expect(least.placeholder).toBe('1, 2, 3, 4');
    change(least, '١، 2, 3 4');
    expect(list(designer).filterRanges).toEqual({ bedrooms: { atLeast: [1, 2, 3, 4] } });
    // An amount always goes by its range: no switch, its least values at once.
    expect(control('Price by its range, From and To')).toBeNull();
    change(control<HTMLInputElement>('Price’s least values, a press each'), '1000000, 5000000');
    expect(list(designer).filterRanges).toEqual({ bedrooms: { atLeast: [1, 2, 3, 4] }, price: { atLeast: [1_000_000, 5_000_000] } });
    expect(validatePage(designer.getPage()).ok).toBe(true);
  });
});
