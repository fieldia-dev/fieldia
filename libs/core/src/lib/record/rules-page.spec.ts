import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage, localizePage, validatePage, type Page } from '../../index';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES } from './messages';
import type { Line } from './values';

/** The rules demo page, driven headless the way the browser test drives it. */
const page = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages', 'rules.page.json'), 'utf8')) as Page;

describe('the rules demo page', () => {
  it('passes both checks', () => {
    expect(validatePage(page)).toMatchObject({ ok: true });
    expect(checkPage(page)).toMatchObject({ ok: true });
  });

  it('works out subtotals, the total, the discount past EGP 1,000 and back, and what is left to pay', () => {
    const form = createForm({ page, dataSource: createMemoryDataSource() });
    const values = () => form.getState().values;
    expect(values()).toMatchObject({ total: 480, discount: 0, to_pay: 480 });
    const chair = form.addLine('lines', { item: 'Desk chair' });
    form.updateLine('lines', chair, 'qty', 1);
    form.updateLine('lines', chair, 'price', 1890);
    expect((values()['lines'] as Line[]).map((l) => l.values['subtotal'])).toEqual([480, 1890]);
    expect(values()).toMatchObject({ total: 2370, discount: 10, to_pay: 2133 });
    form.setValue('discount', 15);
    expect(values()).toMatchObject({ discount: 15, to_pay: 2014.5 });
    form.removeLine('lines', chair);
    expect(values()).toMatchObject({ total: 480, discount: 0, to_pay: 480 });
  });

  it('warns about a personal email without stopping, and stops on a short postcode and one day', async () => {
    const source = createMemoryDataSource();
    const form = createForm({ page, dataSource: source });
    form.setValue('email', 'sara@gmail.com');
    form.setValue('postcode', '1151');
    form.setValue('days', ['sun']);
    expect(form.getState().warnings['email']).toMatch(/niletraders/);
    expect(await form.save()).toBe(false);
    expect(form.getState().errors).toEqual({ postcode: 'A postcode has five digits, such as 11511.', days: 'Choose at least 2 for Delivery days' });
    form.setValue('postcode', '11511');
    form.setValue('days', ['sun', 'tue']);
    expect(await form.save()).toBe(true);
    expect(source.responses[0].values).toMatchObject({ email: 'sara@gmail.com', total: 480, to_pay: 480 });
  });

  it('speaks Arabic, its own words and the default ones', async () => {
    const ar = localizePage(page, 'ar');
    const form = createForm({ page: ar, dataSource: createMemoryDataSource(), messages: MESSAGES.ar });
    form.setValue('postcode', '1');
    form.setValue('days', ['sun']);
    await form.save();
    expect(form.getState().errors).toMatchObject({ postcode: 'الرمز البريدي خمسة أرقام، مثل 11511.', days: 'اختر 2 على الأقل في أيام التوصيل' });
  });
});
