import { validatePage, type Page } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount, openTab, typeAndLeave } from './test-editor';

/**
 * A payment the answers wait for (`payment`), as the designer sets it: on the screen's Rules tab, taken or not, what it
 * is for, a fixed amount or a number or money field's, its currency and words under it. Listed as Publish lists it;
 * refused on a list of records, and for a currency that is no code nor a field.
 */

afterEach(() => document.body.replaceChildren());

const rowOf = (panel: HTMLElement, name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;

describe('a payment before sending, in the designer', () => {
  it('is set on the Rules tab: what for, how much, its currency and its words', () => {
    const page = blankPage('screen', 'Reserve');
    page.data = { kind: 'responses' };
    const designer = createDesigner({ page });
    designer.updateQuestion(designer.addQuestion('amount') as string, { label: 'Deposit' });
    designer.select(null);
    const before = designer.getPage();
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    expect(rowOf(panel, 'What the payment is for').hidden).toBe(true);
    (rowOf(panel, 'Payment before sending').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().payment).toEqual({ label: 'Payment', amount: 100, currency: 'USD' });
    typeAndLeave(rowOf(panel, 'What the payment is for').querySelector('input') as HTMLInputElement, 'Reservation fee');
    typeAndLeave(rowOf(panel, 'Amount').querySelector('input') as HTMLInputElement, '10000');
    typeAndLeave(rowOf(panel, 'Currency').querySelector('input') as HTMLInputElement, 'egp');
    const words = rowOf(panel, 'Words under the amount').querySelector('textarea') as HTMLTextAreaElement;
    words.value = 'Taken off the price.';
    words.dispatchEvent(new Event('change', { bubbles: true }));
    expect(designer.getPage().payment).toEqual({ label: 'Reservation fee', amount: 10000, currency: 'EGP', description: 'Taken off the price.' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // Its amount from the page's money field, its currency then the field's own.
    const from = rowOf(panel, 'Amount').querySelector('select') as HTMLSelectElement;
    const deposit = Object.keys(designer.getPage().fields).find((name) => designer.getPage().fields[name].label === 'Deposit') as string;
    expect([...from.options].map((option) => option.textContent)).toEqual(['This amount', 'Deposit']);
    from.value = deposit;
    from.dispatchEvent(new Event('change', { bubbles: true }));
    expect(designer.getPage().payment?.amount).toBe(deposit);
    expect((rowOf(panel, 'Amount').querySelector('input') as HTMLInputElement).hidden).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('It takes a payment before the answers go');
    expect(designer.setPayment(null)).toBe(true);
    expect(designer.getPage().payment).toBeUndefined();
  });

  it('refuses a currency that is no code nor a field, and a list of records', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Reserve') });
    expect(designer.setPayment({})).toBe(true);
    expect(designer.setPayment({ currency: 'Pounds' })).toBe(false);
    expect(designer.getState().issues[0]).toBe('“Pounds” is no currency’s code (three capitals: EGP) nor a field of the page');
    expect(designer.setPayment({ amount: 0 })).toBe(false);
    const list = createDesigner({ page: blankPage('list', 'Leads') as Page });
    expect(list.setPayment({})).toBe(false);
    expect(list.getState().issues[0]).toBe('A payment is taken as a form’s answers are sent: a list of records sends none');
  });
});
