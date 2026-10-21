import { validatePage } from '../../index';
import { checkPage } from './check-page';

/** Where a related list's rows and New open (`open`): a dialog, the default, or the app's own way; nothing else. */

const customer = (open: unknown) => ({
  fieldia: '0.9',
  id: 'customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name' },
    children: [{ type: 'related', id: 'quotations', model: 'quotation', field: 'partner_id', fields: { name: { type: 'char', label: 'Number' } }, columns: ['name'], ...(open === undefined ? {} : { open }) }],
  },
});

const issues = (input: unknown) => {
  const shape = validatePage(input);
  if (!shape.ok) return shape.issues.map((i) => `${i.path}: ${i.message}`);
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('where a related list’s rows and New open', () => {
  it('takes a dialog, the app’s own way, or nothing said', () => {
    for (const open of [undefined, 'dialog', 'app']) expect(issues(customer(open))).toEqual([]);
  });

  it('refuses any other way', () => {
    for (const open of ['page', 'route', true]) expect(issues(customer(open))).toEqual([expect.stringMatching(/^layout\.children\[0\]\.open/)]);
  });
});
