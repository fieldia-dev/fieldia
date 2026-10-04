import type { Field } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor } from '@fieldia/designer';
import type { Skin } from '@fieldia/viewer';
import { APP_LISTS, sampleDataSource } from '../shared/sample-data';

/**
 * The screen editor on its own page, opened on a small site-visit screen.
 * `?start=blank` opens an empty one, `?start=sheet` an empty customer sheet
 * with the customer's model behind it, its fields first in the toolbox, and
 * `?start=list` the customers' list, on the same model.
 */
const customer: Record<string, Field> = {
  name: { type: 'char', label: 'Name', required: true },
  email: { type: 'char', label: 'Email' },
  phone: { type: 'char', label: 'Phone' },
  website: { type: 'char', label: 'Website' },
  vat: { type: 'char', label: 'VAT number' },
  country_id: { type: 'many2one', label: 'Country', relation: 'country' },
  tag_ids: { type: 'many2many', label: 'Tags', relation: 'customer.tag' },
  credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
  payment_terms: { type: 'selection', label: 'Payment terms', options: [{ value: 'now', label: 'Immediate' }, { value: '30', label: '30 days' }, { value: '60', label: '60 days' }] },
  visits: { type: 'integer', label: 'Visits a year' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }] },
  invoice_count: { type: 'integer', label: 'Invoices' },
};
function siteVisit() {
  const draft = createDesigner({ page: blankPage('screen', 'Site visit') });
  const visit = 'section-1';
  draft.renameContainer(visit, 'Visit');
  const add = (kind: string, label: string, parent: string) => {
    const id = draft.addQuestion(kind, { parent }) as string;
    draft.updateQuestion(id, { label });
    return id;
  };
  add('short-answer', 'Customer', visit);
  add('date', 'Visit date', visit);
  draft.setColspan(add('paragraph', 'Notes', visit), 2);
  const followUp = draft.addContainer('Follow-up') as string;
  draft.setOptions(add('dropdown', 'Next step', followUp), ['Send a quote', 'Book a second visit', 'Close']);
  add('date', 'Due by', followUp);
  add('yes-no', 'Manager to call?', followUp);
  return draft.getPage();
}

function customers() {
  const draft = createDesigner({ page: blankPage('list', 'Customers'), model: customer });
  for (const name of ['email', 'country_id', 'state', 'credit_limit']) draft.addColumn(name);
  const active = draft.addListFilter('Active', [{ field: 'state', op: '=', value: 'active' }]) as string;
  draft.updateListFilter(active, { on: true });
  draft.addListFilter('Blocked', [{ field: 'state', op: '=', value: 'blocked' }]);
  draft.setListOptions({ sort: [{ field: 'name' }], groupBy: ['country_id', 'state'] });
  draft.addListAction('Archive');
  return draft.getPage();
}

const params = new URLSearchParams(location.search);
const store = createMemoryPageStore();
const start = params.get('start');
const model = start === 'sheet' || start === 'list' ? customer : undefined;
const first = start === 'blank' ? blankPage('screen', 'New screen') : start === 'sheet' ? blankPage('sheet', 'Customer') : start === 'list' ? customers() : siteVisit();
const designer = createDesigner({ page: first, store, model, lists: APP_LISTS });
// The app's lists' choices, for Try it.
const dataSource = sampleDataSource();
const skin = (params.get('skin') as Skin) ?? 'outlined';
const app = document.getElementById('app') as HTMLElement;
const demo = { designer, store, handle: mountScreenEditor(app, { designer, skin, dataSource }), reopen };
/** Close the editor and open the page again from the store, as an app does the next day. */
async function reopen() {
  demo.handle.destroy();
  demo.designer = await createDesigner.open(demo.designer.getPage().id, store, { model, lists: APP_LISTS });
  demo.handle = mountScreenEditor(app, { designer: demo.designer, skin, dataSource });
}
Object.assign(window, { fieldiaDesigner: demo });
