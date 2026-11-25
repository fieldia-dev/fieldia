import { searchViewFilters } from './search-view';
import { validatePage } from './validate';
import { FORMAT_VERSION } from './version';
import type { Page } from './page';

/**
 * An Odoo (or Flectra) search view read as a list's search: its filters, each `<separator/>` starting a new group of
 * them (`ListFilter.group`: "or" within, "and" between, as Odoo's menu has them), its Group By and the fields its box
 * searches. What Fieldia has no way to say is left out and said, never dropped quietly.
 */

/** Odoo's vendor bills' search view, as account's `view_account_invoice_filter` writes it (shortened). */
const BILLS = `<?xml version="1.0"?>
<search string="Search Invoice">
  <field name="name" string="Invoice" filter_domain="['|', ('name', 'ilike', self), ('ref', 'ilike', self)]"/>
  <field name="partner_id" operator="child_of"/>
  <!-- what a bill is in -->
  <filter name="draft" string="Draft" domain="[('state', '=', 'draft')]"/>
  <filter name="posted" string="Posted" domain="[('state', '=', 'posted')]"/>
  <filter name="cancel" string="Cancelled" domain="[('state', '=', 'cancel')]"/>
  <separator/>
  <filter name="to_pay" string="To pay" domain="[('payment_state', 'in', ('not_paid', 'partial')), ('amount_residual', '&gt;', 0)]"/>
  <filter name="late" string="Overdue" domain="[('invoice_date_due', '&lt;', time.strftime('%Y-%m-%d')), ('state', '=', 'posted')]"/>
  <separator/>
  <filter name="no_ref" string="No reference" domain="['|', ('ref', '=', False), ('ref', '=', '')]"/>
  <filter name="mine" string="My bills" domain="[('invoice_user_id', '=', uid)]"/>
  <group expand="0" string="Group By">
    <filter string="Vendor" name="by_partner" context="{'group_by': 'partner_id'}"/>
    <filter string="Status" name="by_state" context="{'group_by':'state'}"/>
    <filter string="Bill date" name="by_date" context="{'group_by': 'invoice_date:month'}"/>
  </group>
</search>`;

describe('an Odoo search view read as a list’s search', () => {
  it('turns each run of filters between separators into a group, named by its first filter, their domains into conditions', () => {
    const read = searchViewFilters(BILLS);
    expect(read.filters).toEqual([
      { id: 'draft', label: 'Draft', filter: [{ field: 'state', op: '=', value: 'draft' }], group: 'draft' },
      { id: 'posted', label: 'Posted', filter: [{ field: 'state', op: '=', value: 'posted' }], group: 'draft' },
      { id: 'cancel', label: 'Cancelled', filter: [{ field: 'state', op: '=', value: 'cancel' }], group: 'draft' },
      { id: 'to_pay', label: 'To pay', filter: [{ field: 'payment_state', op: 'in', value: ['not_paid', 'partial'] }, { field: 'amount_residual', op: '>', value: 0 }], group: 'to_pay' },
      { id: 'no_ref', label: 'No reference', filter: [{ any: [{ field: 'ref', op: 'notset' }, { field: 'ref', op: '=', value: '' }] }], group: 'no_ref' },
    ]);
    expect(read.groupBy).toEqual(['partner_id', 'state', 'invoice_date']);
    expect(read.searchFields).toEqual(['name', 'partner_id']);
    // What has no way to be said is left out, and said.
    expect(read.notes).toEqual([
      { at: 'late', words: 'Overdue is left out: its domain reads time.strftime(…), worked out on the server (write it as a period: { "field": "invoice_date_due", "is": "overdue" })' },
      { at: 'mine', words: 'My bills is left out: its domain reads uid, worked out on the server' },
    ]);
  });

  it('names no group where the view has no separator, so its filters are any of them, as Odoo reads them', () => {
    const read = searchViewFilters('<search><filter name="a" string="A" domain="[(\'x\',\'=\',1)]"/><filter name="b" string="B" domain="[(\'x\',\'=\',2)]"/></search>');
    expect(read.filters.map((filter) => filter.group)).toEqual([undefined, undefined]);
    // Nor where every run but one is left out.
    const one = searchViewFilters('<search><filter name="a" string="A" domain="[(\'x\',\'=\',1)]"/><separator/><filter name="b" string="B" domain="[(\'x\',\'=\',uid)]"/></search>');
    expect(one.filters).toEqual([{ id: 'a', label: 'A', filter: [{ field: 'x', op: '=', value: 1 }] }]);
  });

  it('reads Odoo’s domains as they are written: | and & before their two, a list or a tuple, True, False and None, entities', () => {
    const view = (domain: string) => searchViewFilters(`<search><filter name="f" string="F" domain="${domain}"/></search>`).filters[0]?.filter;
    expect(view("['|', '|', ('a', '=', 1), ('b', '!=', 2), ('c', '&gt;=', 3.5)]")).toEqual([{ any: [{ field: 'a', op: '=', value: 1 }, { field: 'b', op: '!=', value: 2 }, { field: 'c', op: '>=', value: 3.5 }] }]);
    expect(view("['&amp;', ('a', '=', True), '|', ('b', 'in', [1, 2]), ('c', '!=', False)]")).toEqual([{ all: [{ field: 'a', op: '=', value: true }, { any: [{ field: 'b', op: 'in', value: [1, 2] }, { field: 'c', op: 'set' }] }] }]);
    expect(view('[(&quot;name&quot;, &quot;ilike&quot;, &quot;nile&quot;), (&apos;user_id&apos;, &apos;=&apos;, None)]')).toEqual([{ field: 'name', op: 'ilike', value: 'nile' }, { field: 'user_id', op: 'notset' }]);
    expect(view("[('a', 'not in', (1,)), ('b', '=?', 'x')]")).toEqual([{ field: 'a', op: 'not in', value: [1] }, { field: 'b', op: '=?', value: 'x' }]);
  });

  it('leaves out, and says, what Fieldia’s filters cannot say: a not, an operator of its own, a filter of a date’s own periods', () => {
    const read = searchViewFilters(`<search>
      <filter name="not_draft" string="Not draft" domain="['!', ('state', '=', 'draft')]"/>
      <filter name="sub" string="Under Cairo" domain="[('zone_id', 'child_of', 3)]"/>
      <filter name="bill_date" string="Bill date" date="invoice_date"/>
      <filter name="hidden" string="Hidden" domain="[('x', '=', 1)]" invisible="1"/>
      <filter name="broken" string="Broken" domain="[('x', '=']"/>
    </search>`);
    expect(read.filters).toEqual([]);
    expect(read.notes.map((note) => note.words)).toEqual([
      'Not draft is left out: a filter of Fieldia’s has no “not” (!): write the opposite condition',
      'Under Cairo is left out: its domain compares with child_of, which a filter of Fieldia’s does not',
      'Bill date is left out: a date’s own periods (date="invoice_date") are named filters of their own: write each as a period, { "field": "invoice_date", "is": "thisMonth" }',
      'Hidden is left out: it is not shown in the menu (invisible)',
      'Broken is left out: its domain cannot be read',
    ]);
  });

  it('gives filters a list page takes, stamped 0.14 where they are in groups', () => {
    const read = searchViewFilters(BILLS);
    const fields = Object.fromEntries(['name', 'ref', 'partner_id', 'state', 'payment_state', 'amount_residual', 'invoice_date'].map((name) => [name, { type: 'char', label: name }]));
    const page = { fieldia: FORMAT_VERSION, id: 'bills', data: { kind: 'record', model: 'account.move' }, fields, layout: { type: 'list', id: 'list', columns: ['name'], filters: read.filters, groupBy: read.groupBy, searchFields: read.searchFields } } as unknown as Page;
    expect(validatePage(page)).toMatchObject({ ok: true });
  });

  it('refuses what is no search view', () => {
    expect(() => searchViewFilters('<form><field name="x"/></form>')).toThrow('a search view is a <search> element');
  });
});
