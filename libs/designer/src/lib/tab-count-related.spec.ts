import { validatePage, type Field, type Page, type SheetNode, type TabsNode } from '@fieldia/core';
import { createDesigner, type Designer } from './designer';
import { choose, field, mount, openTab } from './test-editor';

/**
 * A tab's count of a related list in it, in the designer: its panel's Count from offers the related lists the tab
 * holds beside the fields it may count, and keeps `{ "related": id }`; a list the tab does not hold is refused.
 */

function customer(): Page {
  return {
    fieldia: '0.5',
    id: 'customer',
    title: 'Customer',
    data: { kind: 'record', model: 'partner' },
    fields: { name: { type: 'char', label: 'Name' }, notes: { type: 'text', label: 'Notes' } },
    layout: {
      type: 'sheet',
      id: 'sheet',
      title: { field: 'name' },
      children: [
        {
          type: 'tabs',
          id: 'tabs-1',
          children: [
            {
              type: 'tab',
              id: 'tab-quotations',
              label: 'Quotations',
              children: [
                {
                  type: 'section',
                  id: 'inside',
                  children: [{ type: 'related', id: 'quotations', title: 'Open quotations', model: 'quotation', field: 'partner_id', fields: { name: { type: 'char', label: 'Number' } }, columns: ['name'] }],
                },
              ],
            },
            { type: 'tab', id: 'tab-notes', label: 'Notes', children: [{ type: 'field', id: 'f-notes', field: 'notes' }] },
          ],
        },
      ],
    },
  } as Page;
}

/** The backend's customers: a number a tab may count besides what the page shows. */
const MODEL: Record<string, Field> = { visits: { type: 'integer', label: 'Visits' } };
const designer = () => createDesigner({ page: customer(), model: MODEL });
const tabsOf = (d: Designer) => (d.getPage().layout as SheetNode).children[0] as TabsNode;
const valid = (d: Designer) => {
  const checked = validatePage(d.getPage());
  expect(checked.ok ? [] : checked.issues.map((i) => `${i.path}: ${i.message}`)).toEqual([]);
};

describe('a tab’s count of a related list in it, in the designer', () => {
  it('counts a related list the tab holds, refuses one it does not, and still counts a field', () => {
    const d = designer();
    expect(d.setTabParts('tab-quotations', { count: { related: 'quotations' } })).toBe(true);
    expect(tabsOf(d).children[0].count).toEqual({ related: 'quotations' });
    valid(d);
    expect(d.setTabParts('tab-notes', { count: { related: 'quotations' } })).toBe(false);
    expect(d.getState().issues).toEqual(['There is no related list "quotations" in this tab: a tab counts the records of one it holds']);
    expect(tabsOf(d).children[1].count).toBeUndefined();
    expect(d.setTabParts('tab-quotations', { count: 'visits' })).toBe(true);
    expect(tabsOf(d).children[0].count).toBe('visits');
    expect(d.setTabParts('tab-quotations', { count: null })).toBe(true);
    expect(tabsOf(d).children[0]).not.toHaveProperty('count');
    valid(d);
  });

  it('leaves the tab without a count once its related list is taken away', () => {
    const d = designer();
    expect(d.setTabParts('tab-quotations', { count: { related: 'quotations' } })).toBe(true);
    expect(d.removeNode('quotations')).toBe(true);
    expect(tabsOf(d).children[0]).not.toHaveProperty('count');
    valid(d);
    d.undo();
    expect(tabsOf(d).children[0].count).toEqual({ related: 'quotations' });
  });

  it('offers the tab’s related lists in its panel’s Count from, beside the fields, and shows the one it counts', () => {
    const d = designer();
    const { host } = mount(d, { mode: 'advanced' });
    d.select('tab-quotations');
    openTab(host, 'Content');
    const count = field(host, 'Count from') as HTMLSelectElement;
    expect([...count.options].map((option) => [option.value, option.textContent])).toEqual([
      ['', 'No count'],
      ['visits', 'Visits'],
      ['related:quotations', 'Related list: Open quotations'],
    ]);
    choose(count, 'related:quotations');
    expect(tabsOf(d).children[0].count).toEqual({ related: 'quotations' });
    expect((field(host, 'Count from') as HTMLSelectElement).value).toBe('related:quotations');
    // The notes' tab holds none: its fields alone.
    d.select('tab-notes');
    openTab(host, 'Content');
    expect([...(field(host, 'Count from') as HTMLSelectElement).options].map((option) => option.value)).toEqual(['', 'visits']);
    valid(d);
  });
});
