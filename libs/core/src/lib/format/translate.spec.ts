import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from './page';
import { translatePage } from './translate';
import { validatePage } from './validate';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');
const page = (name: string): Page => JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
const marked = (text: string) => `«${text}»`;

describe('translatePage', () => {
  it('passes every word a person reads through the app’s translator', () => {
    const customer = translatePage(page('customer'), marked);
    expect(customer.title).toBe('«Customer»');
    expect(customer.fields['name'].label).toBe('«Name»');
    expect((customer.fields['state'] as { options: { label: string }[] }).options.map((o) => o.label)).toEqual(['«Draft»', '«Active»', '«Blocked»']);
    const layout = customer.layout as any;
    expect(layout.buttons[1].label).toBe('«Block»');
    expect(layout.buttons[1].confirm).toBe('«Block this customer? New orders will be refused.»');
    expect(layout.statButtons[0].label).toBe('«Sales»');
    expect(layout.ribbon.label).toBe('«Blocked»');
    expect(layout.alerts[0].message).toBe('«This customer is over their credit limit.»');
    expect(layout.badges[0].label).toBe('«Key account»');
    expect(layout.children[1].children[0].label).toBe('«Contacts»');
    const survey = translatePage(page('survey'), marked).layout as any;
    expect(survey.finishLabel).toBe('«Send my answers»');
    expect(survey.children[0].label).toBe('«About you»');
    expect(survey.children[0].children[0].text).toMatch(/^«Thanks/);
  });

  it('leaves ids, field names, values, conditions and data as they are, and the page still checks', () => {
    for (const name of readdirSync(EXAMPLES).filter((f) => f.endsWith('.page.json')).map((f) => f.replace('.page.json', ''))) {
      const before = page(name);
      const after = translatePage(before, marked);
      expect(validatePage(after).ok).toBe(true);
      expect(after.id).toBe(before.id);
      expect(Object.keys(after.fields)).toEqual(Object.keys(before.fields));
    }
    const order = translatePage(page('order'), marked);
    const lines = order.fields['line_ids'] as any;
    expect(lines.lineKinds).toEqual((page('order').fields['line_ids'] as any).lineKinds);
    expect(lines.fields['product_id'].label).toBe('«Product»');
    expect((order.fields['state'] as { options: { value: string }[] }).options.map((o) => o.value)).toEqual(['draft', 'sent', 'sale']);
    const customer = translatePage(page('customer'), marked).layout as any;
    expect(customer.badges[0].invisible).toBe('sale_order_count < 10');
    const fields = translatePage(page('fields'), marked);
    expect((fields.fields['approver_id'] as any).filter).toEqual((page('fields').fields['approver_id'] as any).filter);
  });

  it('gives back a new page and leaves the one it was given alone', () => {
    const before = page('signup');
    const copy = JSON.stringify(before);
    translatePage(before, marked);
    expect(JSON.stringify(before)).toBe(copy);
  });
});
