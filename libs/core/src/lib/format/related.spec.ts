import { RelatedNodeSchema, validatePage } from '../../index';
import { checkPage } from './check-page';
import { pageWords, translatePage } from './translate';
import type { Page } from './page';
import type { LayoutNode, RelatedNode } from './layout';

/**
 * A related list: another model's records that point at this one — a customer's invoices — listed inside the record.
 * Its columns are its own records' fields, never this page's; its filter compares their fields with values read from
 * this record; it belongs on a record's page.
 */

const invoices = {
  type: 'related',
  id: 'invoices',
  title: 'Invoices',
  model: 'invoice',
  field: 'partner_id',
  fields: {
    name: { type: 'char', label: 'Number' },
    date: { type: 'date', label: 'Date' },
    amount: { type: 'monetary', label: 'Total', currencyField: 'currency_id' },
    currency_id: { type: 'many2one', label: 'Currency', relation: 'currency' },
    state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }] },
    partner_id: { type: 'many2one', label: 'Customer', relation: 'partner' },
  },
  columns: ['name', 'date', 'amount', 'state'],
};

const customer = (related: Record<string, unknown> = {}, more: Record<string, unknown> = {}) => ({
  fieldia: '0.12',
  id: 'customer',
  title: 'Customer',
  data: { kind: 'record', model: 'partner' },
  fields: {
    name: { type: 'char', label: 'Name' },
    company_id: { type: 'many2one', label: 'Company', relation: 'company' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [
      { type: 'section', id: 'main', children: [{ type: 'field', id: 'f-company', field: 'company_id' }] },
      { type: 'tabs', id: 'tabs', children: [{ type: 'tab', id: 'tab-invoices', label: 'Invoices', children: [{ ...invoices, ...related }] }] },
    ],
  },
  ...more,
});

const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const quick = (input: unknown) => {
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const at = 'layout.children[1].children[0].children[0]';

describe('a related list', () => {
  it('takes its records’ model, link, fields and columns, and what else it says, in a tab or a section', () => {
    const full = {
      icon: 'file',
      cells: { state: { widget: 'dot', options: { tones: { posted: 'success' } } }, amount: { total: 'sum' } },
      filter: [{ field: 'state', op: '!=', value: 'cancel' }, { field: 'company_id', op: '=', valueFrom: 'company_id' }],
      sort: [{ field: 'date', desc: true }],
      limit: 5,
      searchFields: ['name'],
      viewAll: { page: 'invoices', as: 'page' },
      create: false,
      colspan: 12,
      invisible: 'not name',
      roles: ['account.group_invoice'],
      hideOn: ['narrow'],
    };
    expect(problems(customer(full))).toEqual([]);
    expect(quick(customer(full))).toEqual([]);
    // Placed straight in the sheet, or in a page of sections.
    const sections = { fieldia: '0.12', id: 'p', data: { kind: 'record', model: 'partner' }, fields: { name: { type: 'char', label: 'Name' } }, layout: { type: 'sections', id: 's', children: [invoices] } };
    expect(problems(sections)).toEqual([]);
    for (const as of ['dialog', 'panel', 'page']) expect(RelatedNodeSchema.safeParse({ ...invoices, viewAll: { page: 'x', as } }).success).toBe(true);
  });

  it('refuses one without its model, link, fields or columns, a page size out of 1 to 100, and a View all that names no page', () => {
    for (const key of ['model', 'field', 'fields', 'columns']) {
      const shorn: Record<string, unknown> = { ...invoices };
      delete shorn[key];
      expect(RelatedNodeSchema.safeParse(shorn).success).toBe(false);
    }
    expect(RelatedNodeSchema.safeParse({ ...invoices, columns: [] }).success).toBe(false);
    expect(RelatedNodeSchema.safeParse({ ...invoices, limit: 0 }).success).toBe(false);
    expect(RelatedNodeSchema.safeParse({ ...invoices, limit: 101 }).success).toBe(false);
    expect(RelatedNodeSchema.safeParse({ ...invoices, viewAll: {} }).success).toBe(false);
    expect(RelatedNodeSchema.safeParse({ ...invoices, viewAll: { page: 'x', as: 'tab' } }).success).toBe(false);
    // A field of a kind a list cannot draw from a source's row: lines of lines.
    expect(RelatedNodeSchema.safeParse({ ...invoices, fields: { ...invoices.fields, lines: { type: 'one2many', label: 'Lines', relation: 'l', fields: {} } } }).success).toBe(false);
    // The quick check, which reads no shapes, says so too, rather than failing to read it.
    expect(quick(customer({ fields: undefined })).join('\n')).toMatch(/needs the model of its records, their link to this record \(field\), their fields and its columns/);
  });

  it('names its columns, order, search and cells from its own records’ fields, never this page’s', () => {
    const found = problems(
      customer({
        columns: ['name', 'company_id'],
        sort: [{ field: 'due' }],
        searchFields: ['ref'],
        cells: { partner_id: { widget: 'dot' }, name: { total: 'sum', lead: { field: 'kind', looks: {} } } },
      })
    ).join('\n');
    expect(found).toContain(`${at}.columns[1]: no field "company_id"`);
    expect(found).toContain(`${at}.sort[0].field: no field "due"`);
    expect(found).toContain(`${at}.searchFields[0]: no field "ref"`);
    expect(found).toContain(`${at}.cells.partner_id: "partner_id" is no column of this list`);
    expect(found).toMatch(/cells\.name\.total: "name" is a char; its total "sum" is of numbers/);
    expect(found).toContain(`${at}.cells.name.lead.field: no field "kind"`);
  });

  it('takes a card for a phone, as a list does, of its own records’ fields: a picture one that can hold one', () => {
    const card = { title: 'name', subtitle: 'partner_id', status: 'state', lead: true, fields: ['amount', ['date', { field: 'name', unit: 'ref' }]] };
    expect(problems(customer({ card }))).toEqual([]);
    expect(RelatedNodeSchema.safeParse({ ...invoices, card: {} }).success).toBe(true);
    expect(RelatedNodeSchema.safeParse({ ...invoices, card: { size: 'large' } }).success).toBe(false);
    const found = problems(customer({ card: { title: 'company_id', image: 'amount', fields: ['due'] } })).join('\n');
    expect(found).toContain(`${at}.card.title: no field "company_id"`);
    expect(found).toContain(`${at}.card.image: "amount" is a monetary; a card's picture is an image or binary field`);
    expect(found).toContain(`${at}.card.fields[0]: no field "due"`);
  });

  it('takes its rows’ tones, bold and buttons, as a list does, read on its own records: their fields, their id, the person', () => {
    const rules = {
      rowTones: [{ tone: 'danger', when: "state == 'posted' and date < today()" }],
      rowBold: 'user.id == 7',
      rowButtons: [{ type: 'button', id: 'remind', label: 'Remind', action: 'remind', invisible: "state != 'posted' or id == 0" }],
    };
    expect(problems(customer(rules))).toEqual([]);
    expect(RelatedNodeSchema.safeParse({ ...invoices, ...rules }).success).toBe(true);
    // This page's fields are not its records': a condition reading one is refused, as one reading no field is.
    const found = problems(customer({ rowTones: [{ tone: 'danger', when: 'company_id' }], rowBold: 'due', rowButtons: [{ type: 'button', id: 'remind', label: 'Remind', invisible: 'kind' }] })).join('\n');
    expect(found).toMatch(/rowTones\[0\]\.when: .*"company_id"/);
    expect(found).toMatch(/\.rowBold: .*"due"/);
    expect(found).toMatch(/rowButtons\[0\]\.invisible: .*"kind"/);
    expect(found).toContain(`${at}.rowButtons[0]: a button needs steps, an action, or both`);
    // Its buttons' ids are the page's, once.
    expect(problems(customer({ rowButtons: [{ type: 'button', id: 'f-company', label: 'Remind', action: 'remind' }] })).join('\n')).toMatch(/rowButtons\[0\].*f-company/);
  });

  it('points at this record by a link of its records to this model, where its fields name the link', () => {
    expect(problems(customer({ fields: { ...invoices.fields, partner_id: { type: 'many2one', label: 'Vendor', relation: 'supplier' } } })).join('\n')).toContain(
      `${at}.field: "partner_id" links to supplier; the records listed point at this one by a many2one to partner`
    );
    expect(problems(customer({ fields: { ...invoices.fields, partner_id: { type: 'char', label: 'Customer' } } })).join('\n')).toContain(`${at}.field: "partner_id" is a char`);
    // Its fields need not name the link: it is not shown.
    const { partner_id: _link, ...shown } = invoices.fields;
    expect(problems(customer({ fields: shown }))).toEqual([]);
  });

  it('reads the values its filter compares with from this record, and its money’s currency from its own fields', () => {
    const found = problems(
      customer({
        filter: [{ field: 'company_id', op: '=', valueFrom: 'branch_id' }, { any: [{ field: 'x', op: '=', valueFrom: 'user.email' }] }],
        fields: { ...invoices.fields, amount: { type: 'monetary', label: 'Total', currencyField: 'parent.currency_id' } },
      })
    ).join('\n');
    expect(found).toContain(`${at}.filter[0].valueFrom: no field "branch_id"`);
    expect(found).toContain(`${at}.filter[1].any[0].valueFrom: "user.email": the person has an id, name or roles`);
    expect(found).toContain(`${at}.fields.amount.currencyField: "parent.currency_id": only a line’s money reads parent`);
    // A zone the browser does not know, which the format refuses first, the quick check as a page is shown.
    expect(quick(customer({ fields: { ...invoices.fields, sent: { type: 'datetime', label: 'Sent', timeZone: 'Mars/Olympus' } } })).join('\n')).toMatch(/fields\.sent\.timeZone: "Mars\/Olympus" is not a time zone/);
    // This record's id, the person's, and a value the app passes in.
    expect(problems(customer({ filter: [{ field: 'a', op: '!=', valueFrom: 'id' }, { field: 'b', op: '=', valueFrom: 'user.id' }, { field: 'c', op: '=', valueFrom: 'context.branch' }] }))).toEqual([]);
  });

  it('belongs on a record’s page, and its View all is a list of its records, not this page', () => {
    expect(problems(customer({}, { data: { kind: 'responses' } })).join('\n')).toContain(`${at}: a related list shows the records that point at a record: it belongs on a record’s page`);
    expect(problems(customer({ viewAll: { page: 'customer' } })).join('\n')).toContain(`${at}.viewAll.page: View all opens a list of the records related`);
    expect(problems(customer({ id: 'main' })).join('\n')).toMatch(/duplicate id "main"/);
    expect(problems(customer({ invisible: 'not nme' })).join('\n')).toMatch(/invisible/);
  });

  it('is translated as the page is: its title and its fields’ words, never its model, link or pages', () => {
    const page = validatePage(customer({ viewAll: { page: 'invoices' } }));
    if (!page.ok) throw new Error('the page should pass');
    const words = pageWords(page.page);
    expect(words).toEqual(expect.arrayContaining(['Invoices', 'Number', 'Total', 'Status', 'Posted']));
    expect(words).not.toContain('invoice');
    expect(words).not.toContain('partner_id');
    const loud = translatePage(page.page, (text) => text.toUpperCase());
    const tabs = (loud.layout as Extract<Page['layout'], { type: 'sheet' }>).children[1] as Extract<LayoutNode, { type: 'tabs' }>;
    const related = tabs.children[0].children[0] as RelatedNode;
    expect(related.title).toBe('INVOICES');
    expect(related.fields['name'].label).toBe('NUMBER');
    expect(related.model).toBe('invoice');
    expect(related.field).toBe('partner_id');
    expect(related.viewAll?.page).toBe('invoices');
  });
});
