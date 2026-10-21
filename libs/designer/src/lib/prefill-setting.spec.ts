import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges, type Designer } from './designer';
import { mount, openTab, typeAndLeave } from './test-editor';

/**
 * The fields a page's link fills (`prefill.fromUrl`), as the designer sets them: on the screen's Rules tab, a row for
 * each of the link's parameters and the field it fills — one of the page's, or its own hidden field, made placed
 * nowhere — taken away with ×, the hidden field it made going with it. Kept when a part of the page is removed. Listed
 * as Publish lists it; refused on a list of records, and for a parameter no link writes.
 */

afterEach(() => document.body.replaceChildren());

/** An enquiry about a unit: the person's name and the unit, as the screen editor shows it. */
function enquiry(): Designer {
  const page = blankPage('screen', 'Enquiry');
  page.data = { kind: 'responses' };
  const designer = createDesigner({ page });
  designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: 'Your name' });
  designer.updateQuestion(designer.addQuestion('short-answer') as string, { label: 'Unit' });
  designer.select(null);
  return designer;
}
const rowOf = (panel: HTMLElement, name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;

describe('the fields a link fills, in the designer', () => {
  it('names a parameter and its own hidden field, or a field of the page, on the Rules tab', () => {
    const designer = enquiry();
    const before = designer.getPage();
    const unit = Object.keys(before.fields).find((name) => before.fields[name].label === 'Unit') as string;
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    const row = rowOf(panel, 'Filled from the link');
    expect(row.hidden).toBe(false);
    (row.querySelector('.fd-prefill-add') as HTMLButtonElement).click();
    typeAndLeave(row.querySelector('.fd-prefill-row:last-child input') as HTMLInputElement, 'utm_source');
    expect(designer.getPage().prefill).toEqual({ fromUrl: ['utm_source'] });
    expect(designer.getPage().fields['utm_source']).toEqual({ type: 'char', label: 'utm_source' });
    (row.querySelector('.fd-prefill-add') as HTMLButtonElement).click();
    typeAndLeave(row.querySelector('.fd-prefill-row:last-child input') as HTMLInputElement, 'unit-id');
    const into = row.querySelector('.fd-prefill-row:last-child select') as HTMLSelectElement;
    // The page's own fields a link fills are offered, with its own hidden field first.
    expect([...into.options].map((option) => option.textContent)).toEqual(['Its own hidden field', 'Your name', 'Unit']);
    into.value = unit;
    into.dispatchEvent(new Event('change', { bubbles: true }));
    expect(designer.getPage().prefill).toEqual({ fromUrl: ['utm_source', { param: 'unit-id', field: unit }] });
    // The hidden field made for "unit-id" before it was pointed at Unit went with it.
    expect(designer.getPage().fields['unit_id']).toBeUndefined();
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('The link it is opened with fills 2 fields');
  });

  it('keeps a hidden field when a part of the page goes, and takes it away with its parameter', () => {
    const designer = enquiry();
    expect(designer.setPrefill([{ param: 'agent', field: null }])).toBe(true);
    const name = Object.keys(designer.getPage().fields).find((key) => designer.getPage().fields[key].label === 'Your name') as string;
    const node = JSON.stringify(designer.getPage().layout).match(new RegExp(`"id":"([^"]+)","field":"${name}"`))?.[1] as string;
    designer.removeNode(node);
    expect(designer.getPage().fields['agent']).toBeDefined();
    expect(designer.setPrefill([])).toBe(true);
    expect(designer.getPage().prefill).toBeUndefined();
    expect(designer.getPage().fields['agent']).toBeUndefined();
  });

  it('refuses a parameter no link writes, and a list of records', () => {
    const designer = enquiry();
    expect(designer.setPrefill([{ param: 'utm source', field: null }])).toBe(false);
    expect(designer.getState().issues[0]).toBe('“utm source” is no link’s parameter: letters, digits and _ . ~ - only, at most 100');
    const list = createDesigner({ page: blankPage('list', 'Leads') });
    expect(list.setPrefill([{ param: 'agent', field: null }])).toBe(false);
    expect(list.getState().issues[0]).toBe('A link fills the answers of a record or a response as it starts: a list of records has none');
  });
});
