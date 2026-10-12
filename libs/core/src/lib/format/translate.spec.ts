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

  it('leaves maps by field name alone, even where a field is called as a word key is', () => {
    // A column, a step's values and a call's params named `description` or `title` are names, not words.
    const named: Page = {
      ...page('customer'),
      layout: {
        type: 'sheet',
        children: [{ type: 'table', field: 'contact_ids', optionalColumns: { description: 'hide', title: 'show' } }],
        buttons: [
          {
            id: 'log',
            label: 'Log',
            steps: [
              { do: 'open', page: 'note', values: { description: 'name' }, into: { title: 'subject' } },
              { do: 'addLine', field: 'contact_ids', values: { label: "'Main'" } },
              { do: 'call', action: 'log', params: { message: 'kept', title: 'kept' } },
              { do: 'say', message: 'Logged' },
            ],
          },
        ],
      } as any,
    };
    const after = translatePage(named, marked).layout as any;
    expect(after.children[0].optionalColumns).toEqual({ description: 'hide', title: 'show' });
    const steps = after.buttons[0].steps;
    expect(steps[0]).toMatchObject({ values: { description: 'name' }, into: { title: 'subject' } });
    expect(steps[1].values).toEqual({ label: "'Main'" });
    expect(steps[2].params).toEqual({ message: 'kept', title: 'kept' });
    expect(steps[3].message).toBe('«Logged»');
    expect(after.buttons[0].label).toBe('«Log»');
  });

  it('translates the words after a map card’s values, each plural form, and leaves its fields alone', () => {
    const homes: Page = {
      ...page('customer'),
      layout: {
        type: 'list',
        id: 'homes',
        columns: ['name'],
        map: {
          point: 'spot',
          pin: { label: 'price', money: { per: [{ period: 'month', when: "offer == 'rent'" }] } },
          card: { title: 'name', fields: ['price', ['district', { field: 'rooms', unit: { one: 'room', other: 'rooms' } }, { field: 'area', unit: 'm²' }]] },
        },
      } as any,
    };
    const map = (translatePage(homes, marked).layout as any).map;
    expect(map.card.fields).toEqual(['price', ['district', { field: 'rooms', unit: { one: '«room»', other: '«rooms»' } }, { field: 'area', unit: '«m²»' }]]);
    expect(map.card.title).toBe('name');
    expect(map.pin).toEqual({ label: 'price', money: { per: [{ period: 'month', when: "offer == 'rent'" }] } });
    // A form's map: a layer's card too.
    const order = { ...page('customer'), layout: { type: 'sheet', children: [{ type: 'map', id: 'm', layers: [{ id: 'stop', label: 'Stop', point: 'spot', card: { fields: [{ field: 'area', unit: 'm²' }] } }] }] } as any };
    const layer = (translatePage(order, marked).layout as any).children[0].layers[0];
    expect(layer).toEqual({ id: 'stop', label: '«Stop»', point: 'spot', card: { fields: [{ field: 'area', unit: '«m²»' }] } });
  });

  it('gives back a new page and leaves the one it was given alone', () => {
    const before = page('signup');
    const copy = JSON.stringify(before);
    translatePage(before, marked);
    expect(JSON.stringify(before)).toBe(copy);
  });
});
