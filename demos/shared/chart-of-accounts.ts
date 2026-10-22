import type { Page, Values } from '@fieldia/core';

/**
 * A trading company's chart of accounts (chart-of-accounts): five classes, their groups, and some 240 accounts under
 * them — a group of 60 bank accounts among them, more than a page — each with a balance, the same on every visit.
 */
const CLASSES: [code: string, name: string, type: string, groups: [code: string, name: string, accounts: string[] | number][]][] = [
  ['1', 'Assets', 'asset', [
    ['11', 'Cash and banks', 60],
    ['12', 'Customers', ['Customers, local', 'Customers, export', 'Cheques under collection', 'Doubtful customers']],
    ['13', 'Stock', ['Goods for sale', 'Goods in transit', 'Packing materials']],
    ['14', 'Fixed assets', ['Buildings', 'Vehicles', 'Furniture', 'Computers', 'Depreciation of buildings', 'Depreciation of vehicles']],
  ]],
  ['2', 'Liabilities', 'liability', [
    ['21', 'Suppliers', 40],
    ['22', 'Taxes due', ['VAT due', 'Withholding tax', 'Payroll tax']],
    ['23', 'Loans', ['Bank loan, short term', 'Bank loan, long term']],
  ]],
  ['3', 'Equity', 'equity', [['31', 'Capital and reserves', ['Paid-up capital', 'Legal reserve', 'Retained earnings']]]],
  ['4', 'Income', 'income', [
    ['41', 'Sales', ['Sales, local', 'Sales, export', 'Returns', 'Discounts given']],
    ['42', 'Other income', ['Interest received', 'Exchange gains', 'Rent received']],
  ]],
  ['5', 'Expenses', 'expense', [
    ['51', 'Cost of sales', ['Purchases', 'Freight in', 'Customs']],
    ['52', 'Staff', 80],
    ['53', 'Running costs', ['Rent', 'Electricity', 'Water', 'Internet', 'Phones', 'Stationery', 'Cleaning', 'Security', 'Repairs', 'Insurance']],
  ]],
];
const BANKS = ['National Bank', 'Banque Misr', 'CIB', 'QNB', 'HSBC', 'Alex Bank'];
const SUPPLIERS = ['Delta Steel', 'Nile Paper', 'Cairo Packaging', 'Giza Plastics', 'Sinai Cement'];

/** The same numbers every time: a demo that looks the same on each visit. */
function seeded(seed: number) {
  let n = seed;
  return () => {
    n = (n * 1103515245 + 12345) % 2147483648;
    return n / 2147483648;
  };
}

export function chartAccounts(): Record<number, Values> {
  const random = seeded(31);
  const records: Record<number, Values> = {};
  let id = 0;
  for (const [code, name, type, groups] of CLASSES) {
    const classId = ++id;
    records[classId] = { code, name, parent_id: null, type, balance: null };
    for (const [groupCode, groupName, accounts] of groups) {
      const groupId = ++id;
      records[groupId] = { code: groupCode, name: groupName, parent_id: { id: classId, label: name }, type, balance: null };
      // A group of many: a bank's accounts, a supplier's, a member of staff's — more than a page.
      const names =
        typeof accounts === 'number'
          ? Array.from({ length: accounts }, (_, i) => (code === '1' ? `${BANKS[i % BANKS.length]}, account ${Math.floor(i / BANKS.length) + 1}` : code === '2' ? `${SUPPLIERS[i % SUPPLIERS.length]} ${Math.floor(i / SUPPLIERS.length) + 1}` : `Salary, employee ${i + 1}`))
          : accounts;
      names.forEach((accountName, i) => {
        records[++id] = { code: `${groupCode}${String(i + 1).padStart(3, '0')}`, name: accountName, parent_id: { id: groupId, label: groupName }, type, balance: Math.round(random() * 900_000) + 1_000 };
      });
    }
  }
  return records;
}

/** An account's own page, as a row of the chart opens it. */
export const accountPage: Page = {
  fieldia: '0.7',
  id: 'account',
  title: 'An account',
  data: { kind: 'record', model: 'coa.account' },
  fields: {
    code: { type: 'char', label: 'Code', required: true },
    name: { type: 'char', label: 'Account', required: true },
    parent_id: { type: 'many2one', label: 'Under', relation: 'coa.account' },
    type: { type: 'selection', label: 'Type', options: [{ value: 'asset', label: 'Asset' }, { value: 'liability', label: 'Liability' }, { value: 'equity', label: 'Equity' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }] },
    balance: { type: 'monetary', label: 'Balance', currency: 'EGP', readonly: true },
  },
  layout: {
    type: 'sheet',
    id: 'account',
    title: { field: 'name' },
    children: [{ type: 'section', id: 'where', children: [{ type: 'field', id: 'code', field: 'code' }, { type: 'field', id: 'parent_id', field: 'parent_id' }, { type: 'field', id: 'type', field: 'type' }, { type: 'field', id: 'balance', field: 'balance' }] }],
  },
};
