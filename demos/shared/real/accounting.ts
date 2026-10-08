import type { ActionRequest, ActionResult, Line, Page, RelatedRecord, Values } from '@fieldia/core';
import expense from '../../../examples/pages/real-expense.page.json';
import invoice from '../../../examples/pages/real-invoice.page.json';
import registerPayment from '../../../examples/pages/real-register-payment.page.json';
import type { RealLane } from './lane';

/**
 * Accounting: Sherkety ERP's invoice (account.move), its Register Payment
 * dialog (account.payment.register) and Sherkety's own expense
 * (sherkety.expense). Records are a Cairo office-supplies company's, ids
 * 41xx so no other lane's records are replaced; currencies are keyed by their
 * code. What Flectra works out on the server — line amounts, taxes, journal
 * items, totals, the amount to pay in another currency, the payment
 * difference — is this file's onchange; what its buttons do is `action`.
 */

const link = (id: number | string, label: string): RelatedRecord => ({ id, label });
// The demos' one set of currencies, shared by every lane (as one database has): EGP 7461, USD 7462, EUR 7463.
const EGP = link(7461, 'EGP');
const USD = link(7462, 'USD');
/** EGP for one USD, the day's rate in the samples. */
const USD_RATE = 48.5;
const COMPANY = link(4101, 'Zamalek Office Supplies S.A.E.');
const TODAY = '2026-10-06';

const round = (n: number) => Math.round(n * 100) / 100;
const num = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 0);
const idOf = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? (value as RelatedRecord).id : null);
/** A currency's code: its name, as every lane names it. */
const codeOf = (value: unknown) => (value && typeof value === 'object' && 'label' in value ? (value as RelatedRecord).label : null);
const links = (value: unknown) => (Array.isArray(value) ? (value as RelatedRecord[]) : []);
const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
/** An answer comes after a moment, as a server's does. */
const later = <T>(value: T, ms = 200) => new Promise<T>((resolve) => setTimeout(() => resolve(value), ms));

// ---------------------------------------------------------------------------
// The chart of accounts, taxes, products and the rest an invoice points at.
// ---------------------------------------------------------------------------

const ACCOUNTS: Record<number, [string, string]> = {
  4101: ['411000 Product Sales', 'income'],
  4102: ['412000 Service Revenue', 'income'],
  4103: ['121000 Account Receivable', 'asset_receivable'],
  4104: ['211000 Account Payable', 'liability_payable'],
  4105: ['221400 VAT Payable 14%', 'liability_current'],
  4106: ['131500 VAT Receivable 14%', 'asset_current'],
  4107: ['611000 Purchases — Office Supplies', 'expense'],
  4108: ['621000 Travel', 'expense'],
  4109: ['621100 Accommodation', 'expense'],
  4110: ['622000 Meals and Entertainment', 'expense'],
  4111: ['623000 Fuel and Transport', 'expense'],
  4112: ['641000 Telephone and Internet', 'expense'],
  4113: ['691000 Cash Discount Loss', 'expense'],
  4114: ['442000 Foreign Exchange Gain', 'income'],
  4115: ['642000 Foreign Exchange Loss', 'expense'],
  4116: ['612000 Office Rent', 'expense'],
  4117: ['231000 Accrued Expenses', 'liability_current'],
  4118: ['101401 Outstanding Receipts', 'asset_current'],
  4119: ['221500 Withholding Tax Payable', 'liability_current'],
};
const account = (id: number) => link(id, ACCOUNTS[id][0]);
const RECEIVABLE = account(4103);
const PAYABLE = account(4104);
const FX_ACCOUNTS = [4114, 4115];

interface Tax {
  name: string;
  amount: number;
  use: 'sale' | 'purchase';
  account: number;
  baseTag?: number;
  taxTag?: number;
}
const TAXES: Record<number, Tax> = {
  4101: { name: 'VAT 14%', amount: 14, use: 'sale', account: 4105, baseTag: 4101, taxTag: 4102 },
  4102: { name: 'VAT 14% (Purchases)', amount: 14, use: 'purchase', account: 4106, baseTag: 4103, taxTag: 4104 },
  4103: { name: 'Exempt 0%', amount: 0, use: 'sale', account: 4105 },
  4104: { name: 'WHT 1% (Purchases)', amount: -1, use: 'purchase', account: 4119 },
};
const tax = (id: number) => link(id, TAXES[id].name);
const TAGS: Record<number, string> = { 4101: '+Taxable sales 14% (base)', 4102: '+Output VAT 14%', 4103: '+Taxable purchases 14% (base)', 4104: '+Input VAT 14%' };
const tag = (id: number) => link(id, TAGS[id]);

// The sales lane's units, by their ids: one "Units" in every list, as the taxes are one.
const UOM = { units: link(7401, 'Units'), hours: link(7404, 'Hours'), boxes: link(7402, 'Boxes') };

interface Product {
  name: string;
  price: number;
  cost: number;
  uom: RelatedRecord;
  income: number;
  expense: number;
  expensed?: boolean;
}
const PRODUCTS: Record<number, Product> = {
  4101: { name: 'Laser printer HP LaserJet M404dn', price: 14500, cost: 11200, uom: UOM.units, income: 4101, expense: 4107 },
  4102: { name: 'Toner cartridge HP 59A', price: 3400, cost: 2550, uom: UOM.units, income: 4101, expense: 4107 },
  4103: { name: 'A4 copy paper, box of 5 reams', price: 1250, cost: 980, uom: UOM.boxes, income: 4101, expense: 4107 },
  4104: { name: 'Installation and setup', price: 650, cost: 0, uom: UOM.hours, income: 4102, expense: 4107 },
  4105: { name: 'Annual maintenance contract', price: 18000, cost: 0, uom: UOM.units, income: 4102, expense: 4107 },
  4106: { name: 'Office desk 140 × 70', price: 6200, cost: 4600, uom: UOM.units, income: 4101, expense: 4107 },
  4111: { name: 'Travel', price: 0, cost: 0, uom: UOM.units, income: 4101, expense: 4108, expensed: true },
  4112: { name: 'Accommodation', price: 0, cost: 0, uom: UOM.units, income: 4101, expense: 4109, expensed: true },
  4113: { name: 'Meals', price: 0, cost: 0, uom: UOM.units, income: 4101, expense: 4110, expensed: true },
  4114: { name: 'Fuel and transport', price: 0, cost: 0, uom: UOM.units, income: 4101, expense: 4111, expensed: true },
  4115: { name: 'Communication', price: 0, cost: 0, uom: UOM.units, income: 4101, expense: 4112, expensed: true },
};
const product = (id: number) => link(id, PRODUCTS[id].name);

const JOURNALS: Record<number, { name: string; type: string; code: string; currency?: RelatedRecord }> = {
  4101: { name: 'Customer Invoices', type: 'sale', code: 'INV' },
  4102: { name: 'Vendor Bills', type: 'purchase', code: 'BILL' },
  4103: { name: 'Bank — CIB', type: 'bank', code: 'BNK1' },
  4104: { name: 'Cash', type: 'cash', code: 'CSH1' },
  4105: { name: 'Bank — CIB USD', type: 'bank', code: 'BNK2', currency: USD },
  4106: { name: 'Miscellaneous Operations', type: 'general', code: 'MISC' },
  4107: { name: 'Employee Expenses', type: 'purchase', code: 'EXP' },
};
const journal = (id: number) => link(id, JOURNALS[id].name);

/** Each bank and cash journal's ways to pay, as account.payment.method.line keeps them. */
const METHODS: Record<number, { name: string; journal: number; type: 'inbound' | 'outbound'; code: string }> = {
  4101: { name: 'Manual', journal: 4103, type: 'inbound', code: 'manual' },
  4102: { name: 'Manual', journal: 4103, type: 'outbound', code: 'manual' },
  4103: { name: 'Postdated Check', journal: 4103, type: 'inbound', code: 'pdc' },
  4104: { name: 'Postdated Check', journal: 4103, type: 'outbound', code: 'pdc' },
  4105: { name: 'Manual', journal: 4104, type: 'inbound', code: 'manual' },
  4106: { name: 'Manual', journal: 4104, type: 'outbound', code: 'manual' },
  4107: { name: 'Manual', journal: 4105, type: 'inbound', code: 'manual' },
  4108: { name: 'Manual', journal: 4105, type: 'outbound', code: 'manual' },
};
const method = (id: number) => link(id, METHODS[id].name);

const PARTNERS: Record<number, { name: string; is_company: boolean; email?: string; term?: number; creditLimit?: number; due?: number; bank?: number; street?: string; city?: string; vat?: string }> = {
  4101: { name: 'Heliopolis Medical Center', street: '17 El Merghany Street', city: 'Heliopolis, Cairo', vat: 'EG 318-552-904', is_company: true, email: 'accounts@heliopolis-medical.example', term: 4103, creditLimit: 500000, due: 112400 },
  4102: { name: 'Nile Pharma Egypt', street: '5 Corniche El Nil', city: 'Maadi, Cairo', vat: 'EG 221-470-118', is_company: true, email: 'ap@nilepharma.example', term: 4103 },
  4103: { name: 'Giza Paper Mills', street: 'Industrial Zone, Plot 44', city: '6th of October City', vat: 'EG 405-337-260', is_company: true, email: 'billing@gizapapermills.example', term: 4102, bank: 4102 },
  4104: { name: 'Cairo Telecom Services', is_company: true, email: 'billing@cairotelecom.example', term: 4101 },
  4105: { name: 'Omar Hassan', is_company: false, email: 'omar.hassan@zamalek-office.example', bank: 4103 },
  4106: { name: 'Zamalek Office Supplies S.A.E.', is_company: true, bank: 4101 },
  4107: { name: 'Maadi Tech Hub', is_company: true, email: 'finance@maaditech.example', term: 4102, creditLimit: 60000, due: 58200 },
  4108: { name: 'Mariam Adel', is_company: false, email: 'mariam.adel@zamalek-office.example' },
};
const partner = (id: number) => link(id, PARTNERS[id].name);

const TERMS: Record<number, [string, number]> = {
  4101: ['Immediate Payment', 0],
  4102: ['15 Days', 15],
  4103: ['30 Days', 30],
  4104: ['45 Days', 45],
  4105: ['End of Following Month', -1],
};
const term = (id: number) => link(id, TERMS[id][0]);

const BANKS: Record<number, [string, number]> = {
  4101: ['CIB EG38 0010 0123 0000 0001 2345 6789', 4106],
  4102: ['QNB Alahli 2003 4567 8901', 4103],
  4103: ['Banque Misr 0412 7788 9900', 4105],
};
const bank = (id: number) => link(id, BANKS[id][0]);

// Users from 4151: the people lane's own users are 4101 and on.
const USERS: Record<number, string> = { 4151: 'Nour El-Sayed', 4152: 'Dina Mahmoud', 4153: 'Hany Fawzy' };
const user = (id: number) => link(id, USERS[id]);
const EMPLOYEES: Record<number, { name: string; contact: number; manager: number }> = {
  4101: { name: 'Omar Hassan', contact: 4105, manager: 4152 },
  4102: { name: 'Mariam Adel', contact: 4108, manager: 4152 },
};
const employee = (id: number) => link(id, EMPLOYEES[id].name);
const ANALYTIC: Record<number, string> = { 4101: 'Heliopolis rollout', 4102: 'Sales department', 4103: 'Operations', 4104: 'Riyadh trade fair 2026' };

const rows = <T>(table: Record<number, T>, values: (row: T, id: number) => Values) =>
  Object.fromEntries(Object.entries(table).map(([id, row]) => [id, values(row, Number(id))]));

// ---------------------------------------------------------------------------
// An invoice's lines, taxes, journal items and totals, as Flectra's computes do.
// ---------------------------------------------------------------------------

const OUT_TYPES = ['out_invoice', 'out_refund', 'out_receipt'];
const IN_TYPES = ['in_invoice', 'in_refund', 'in_receipt'];
const INVOICE_TYPES = [...OUT_TYPES, ...IN_TYPES];
/** Money comes in (a debit on the receivable) for these. */
const isInbound = (type: string) => ['out_invoice', 'in_refund', 'out_receipt'].includes(type);
const isAccountLine = (line: Line) => !['line_section', 'line_note'].includes(String(line.values['display_type'] ?? 'product'));

/** EGP for one unit of the move's currency: its manual rate, else the day's. */
function rateOf(values: Values): number {
  if (codeOf(values['currency_id']) !== 'USD') return 1;
  return num(values['manual_currency_rate']) || USD_RATE;
}

/** A line's amounts: the cascade of four discounts (account_distribution_extras), then its taxes. */
function priceLine(values: Values): Values {
  const v = { ...values };
  let running = num(v['quantity']) * num(v['price_unit']) * (1 - num(v['discount']) / 100);
  for (const level of [2, 3, 4]) {
    if (v[`discount_${level}_overridden`]) {
      const amount = Math.min(Math.max(num(v[`discount_${level}_amount`]), 0), running);
      v[`discount_${level}_pct`] = running ? round((amount / running) * 100) : 0;
      running -= amount;
    } else {
      const amount = (running * num(v[`discount_${level}_pct`])) / 100;
      v[`discount_${level}_amount`] = round(amount);
      running -= amount;
    }
  }
  const subtotal = round(running);
  const rate = links(v['tax_ids']).reduce((sum, t) => sum + (TAXES[Number(t.id)]?.amount ?? 0), 0);
  v['price_subtotal_after_discounts'] = subtotal;
  v['price_subtotal'] = subtotal;
  v['price_total'] = round(subtotal * (1 + rate / 100));
  return v;
}

/**
 * The product each line had when last seen, by record and line: a line whose
 * product changed is filled from the new one, as Flectra's computes on
 * product_id do; one seen for the first time only has its gaps filled.
 */
const productSeen = new Map<string, unknown>();

/** A picked product brings its label, account, unit, price (in the move's currency) and taxes. */
function fillFromProduct(key: string, line: Values, move: Values): Values {
  const id = idOf(line['product_id']);
  const seenKey = `${String(move['id'] ?? 'new')}:${key}`;
  const first = !productSeen.has(seenKey);
  const changed = !first && productSeen.get(seenKey) !== id;
  productSeen.set(seenKey, id);
  const found = PRODUCTS[Number(id)];
  if (!found || (!first && !changed)) return line;
  const sale = OUT_TYPES.includes(String(move['move_type']));
  const v = { ...line };
  const fill = (field: string, value: Values[string]) => {
    if (changed || v[field] === null || v[field] === undefined || v[field] === '' || (Array.isArray(v[field]) && !(v[field] as unknown[]).length)) v[field] = value;
  };
  fill('name', found.name);
  fill('account_id', account(sale ? found.income : found.expense));
  fill('product_uom_id', found.uom);
  fill('price_unit', round((sale ? found.price : found.cost) / rateOf(move)));
  fill('tax_ids', [tax(sale ? 4101 : 4102)]);
  if (v['quantity'] === null || v['quantity'] === undefined) v['quantity'] = 1;
  return v;
}

let journalItemIds = 940000;

/** The journal items an invoice makes: one per line, one per tax, and the receivable or payable. */
function journalItems(move: Values, lines: Line[], previous: Line[]): Line[] {
  const type = String(move['move_type']);
  const rate = rateOf(move);
  const sign = isInbound(type) ? -1 : 1; // a sale credits its income; a purchase debits its expense
  const currency = move['currency_id'] as RelatedRecord;
  const company = (move['company_currency_id'] as RelatedRecord) ?? EGP;
  const kept = new Map(previous.map((line) => [line.key, line.id]));
  const item = (key: string, values: Values): Line => {
    const balance = round(num(values['amount_currency']) * rate);
    return {
      key,
      ...(kept.get(key) !== undefined ? { id: kept.get(key) } : { id: ++journalItemIds }),
      values: {
        partner_id: move['commercial_partner_id'] ?? move['partner_id'] ?? null,
        currency_id: currency,
        company_currency_id: company,
        debit: balance > 0 ? balance : 0,
        credit: balance < 0 ? -balance : 0,
        tax_tag_invert: false,
        ...values,
      },
    };
  };
  const result: Line[] = [];
  const taxes = new Map<number, number>();
  let total = 0;
  for (const line of lines.filter(isAccountLine)) {
    const v = line.values;
    const subtotal = num(v['price_subtotal']);
    total += subtotal;
    const lineTaxes = links(v['tax_ids']);
    for (const t of lineTaxes) taxes.set(Number(t.id), (taxes.get(Number(t.id)) ?? 0) + (subtotal * (TAXES[Number(t.id)]?.amount ?? 0)) / 100);
    const tags = lineTaxes.map((t) => TAXES[Number(t.id)]?.baseTag).filter((id): id is number => id !== undefined).map(tag);
    result.push(
      item(`j-${line.key}`, {
        display_type: 'product',
        account_id: v['account_id'] ?? null,
        name: v['name'] ?? null,
        analytic_distribution: v['analytic_distribution'] ?? null,
        amount_currency: round(sign * subtotal),
        tax_ids: lineTaxes,
        tax_tag_ids: tags,
      })
    );
  }
  for (const [id, amount] of taxes) {
    const found = TAXES[id];
    if (!found || !amount) continue;
    total += amount;
    result.push(
      item(`j-tax-${id}`, {
        display_type: 'tax',
        account_id: account(found.account),
        name: found.name,
        amount_currency: round(sign * amount),
        tax_ids: [],
        tax_tag_ids: found.taxTag ? [tag(found.taxTag)] : [],
      })
    );
  }
  if (result.length) {
    result.push(
      item('j-term', {
        display_type: 'payment_term',
        account_id: isInbound(type) ? RECEIVABLE : PAYABLE,
        name: move['payment_reference'] ?? move['name'] ?? '',
        date_maturity: move['invoice_date_due'] ?? null,
        amount_currency: round(-sign * total),
        tax_ids: [],
        tax_tag_ids: [],
      })
    );
  }
  return result;
}

/** Everything an invoice's lines decide: each line's amounts, the totals, the journal items, the company-currency amounts. */
function recomputeMove(values: Values): Values {
  const type = String(values['move_type'] ?? 'entry');
  if (!INVOICE_TYPES.includes(type)) return { line_ids: values['line_ids'] ?? [] };
  const currency = values['currency_id'] ?? EGP;
  const lines = ((values['invoice_line_ids'] as Line[] | null) ?? []).map((line) => {
    if (!isAccountLine(line)) return line;
    return { ...line, values: { ...priceLine(fillFromProduct(line.key, line.values, values)), currency_id: currency } };
  });
  const untaxed = round(lines.filter(isAccountLine).reduce((sum, l) => sum + num(l.values['price_subtotal']), 0));
  const tax = round(lines.filter(isAccountLine).reduce((sum, l) => sum + num(l.values['price_total']) - num(l.values['price_subtotal']), 0));
  const total = round(untaxed + tax);
  const rate = rateOf(values);
  const draft = values['state'] === 'draft';
  return {
    invoice_line_ids: lines,
    line_ids: journalItems(values, lines, (values['line_ids'] as Line[] | null) ?? []),
    amount_untaxed: untaxed,
    amount_tax: tax,
    amount_total: total,
    tax_totals: taxTotals(lines.filter(isAccountLine), untaxed, total),
    invoice_payments_widget: paymentsWidget(values['invoice_payment_ids']),
    ...(draft ? { amount_residual: total } : {}),
    exchange_rate_used: rate,
    exchange_rate_date: values['exchange_rate_date'] ?? values['date'] ?? TODAY,
    amount_untaxed_base: round(untaxed * rate),
    amount_tax_base: round(tax * rate),
    amount_total_base: round(total * rate),
    quick_edit_total_amount: values['quick_edit_mode'] ? total : values['quick_edit_total_amount'] ?? null,
  };
}

/** The due date the payment terms give from the invoice date. */
function dueDate(values: Values): Values {
  const day = (values['invoice_date'] as string | null) ?? TODAY;
  const terms = TERMS[Number(idOf(values['invoice_payment_term_id']))];
  if (!terms) return {};
  const [, days] = terms;
  if (days >= 0) return { invoice_date_due: addDays(day, days) };
  const date = new Date(`${day}T00:00:00Z`);
  return { invoice_date_due: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0)).toISOString().slice(0, 10) };
}

function creditWarning(values: Values): string {
  const found = PARTNERS[Number(idOf(values['partner_id']))];
  if (!found?.creditLimit || !OUT_TYPES.includes(String(values['move_type']))) return '';
  const total = (found.due ?? 0) + num(values['amount_total_base'] ?? values['amount_total']);
  if (total <= found.creditLimit) return '';
  return `${found.name} has reached its credit limit of: ${money(found.creditLimit, 'EGP')}\nTotal amount due (including this document): ${money(total, 'EGP')}`;
}

/** A partner picked: their payment terms, fiscal position, bank, the credit warning, then everything again. */
function partnerChanged(values: Values): Values {
  const id = Number(idOf(values['partner_id']));
  const found = PARTNERS[id];
  const type = String(values['move_type']);
  const changes: Values = {
    commercial_partner_id: values['partner_id'] ?? null,
    bank_partner_id: OUT_TYPES.includes(type) ? partner(4106) : (values['partner_id'] ?? null),
    partner_bank_id: OUT_TYPES.includes(type) ? bank(4101) : found?.bank ? bank(found.bank) : null,
    fiscal_position_id: found ? link(4101, 'Local Customers (Egypt)') : null,
  };
  if (found?.term) changes['invoice_payment_term_id'] = term(found.term);
  const next = { ...values, ...changes };
  const moved = { ...next, ...dueDate(next) };
  const computed = { ...moved, ...recomputeMove(moved) };
  return { ...changes, ...dueDate(next), ...recomputeMove(moved), partner_credit_warning: creditWarning(computed) || null };
}

/** The purchase order picked in Auto-Complete brings its lines, and the box empties. */
function autoComplete(values: Values): Values {
  const picked = Number(idOf(values['purchase_vendor_bill_id']));
  if (picked !== 4101) return { purchase_vendor_bill_id: null };
  const added: Line[] = [
    {
      key: `po-${Date.now()}`,
      values: {
        display_type: 'product',
        product_id: product(4103),
        name: 'P00027: A4 copy paper, box of 5 reams',
        quantity: 40,
        price_unit: 980,
        product_uom_id: UOM.boxes,
        account_id: account(4107),
        tax_ids: [tax(4102)],
        purchase_order_id: link(4101, 'P00027'),
      },
    },
  ];
  const next = { ...values, invoice_line_ids: [...((values['invoice_line_ids'] as Line[] | null) ?? []), ...added] };
  return { purchase_vendor_bill_id: null, purchase_id: link(4101, 'P00027'), purchase_order_count: 1, ...recomputeMove(next) };
}

/** A tax amount typed on a bill (to match the vendor's rounding): the total and the tax item follow. */
function taxTyped(values: Values): Values {
  const tax = num(values['amount_tax']);
  const total = round(num(values['amount_untaxed']) + tax);
  const items = ((values['line_ids'] as Line[] | null) ?? []).map((line) => {
    const rate = rateOf(values);
    if (line.values['display_type'] === 'payment_term') return { ...line, values: { ...line.values, amount_currency: -total, debit: 0, credit: round(total * rate) } };
    return line;
  });
  const shown = (values['tax_totals'] ?? {}) as Values;
  return { amount_total: total, amount_residual: total, amount_total_base: round(total * rateOf(values)), line_ids: items, tax_totals: { ...shown, total } };
}

// ---------------------------------------------------------------------------
// The sample moves.
// ---------------------------------------------------------------------------

const invoiceLine = (key: string, id: number, values: Values): Line => ({ key, id, values: { display_type: 'product', analytic_distribution: null, discount: 0, ...values } });
const sectionLine = (key: string, id: number, name: string, sequence: number): Line => ({ key, id, values: { display_type: 'line_section', name, sequence } });
const noteLine = (key: string, id: number, name: string, sequence: number): Line => ({ key, id, values: { display_type: 'line_note', name, sequence } });

/** What every move starts with: no warnings, nothing being sent, nothing to check. */
const MOVE_DEFAULTS: Values = {
  company_id: COMPANY,
  company_currency_id: EGP,
  currency_id: EGP,
  posted_before: false,
  show_name_warning: false,
  restrict_mode_hash_table: false,
  inalterable_hash: null,
  need_cancel_request: false,
  is_being_sent: false,
  invoice_pdf_report_id: null,
  duplicated_ref_ids: [],
  tax_lock_date_message: null,
  partner_credit_warning: null,
  display_inactive_currency_warning: false,
  invoice_has_outstanding: false,
  show_update_fpos: false,
  quick_edit_mode: false,
  show_delivery_date: false,
  display_qr_code: false,
  has_reconciled_entries: false,
  payment_id: null,
  tax_cash_basis_created_move_ids: [],
  authorized_transaction_ids: [],
  transaction_ids: [],
  debit_note_count: 0,
  sale_order_count: 0,
  purchase_order_count: 0,
  edi_state: null,
  edi_show_cancel_button: false,
  edi_show_abandon_cancel_button: false,
  edi_show_force_cancel_button: false,
  edi_error_count: 0,
  edi_web_services_to_process: null,
  tax_calculation_rounding_method: 'round_per_line',
  auto_post: 'no',
  auto_post_until: null,
  to_check: false,
  manual_currency_rate: 0,
  invoice_payment_ids: [],
  outstanding_ids: [],
  narration: null,
  edi_document_ids: [],
  edi_error_message: null,
  invoice_pdf: null,
  partner_shipping_id: null,
  invoice_cash_rounding_id: null,
  campaign_id: null,
  medium_id: null,
  source_id: null,
};

/**
 * Flectra's tax_totals as the tax-totals widget reads it: the untaxed amount, a
 * row per tax (VAT 14%, WHT 1%), the total.
 */
function taxTotals(lines: Line[], untaxed: number, total: number): Values {
  const byTax = new Map<string, number>();
  for (const line of lines) {
    for (const t of links(line.values['tax_ids'])) {
      const found = TAXES[Number(t.id)];
      if (!found) continue;
      byTax.set(found.name, round((byTax.get(found.name) ?? 0) + (num(line.values['price_subtotal']) * found.amount) / 100));
    }
  }
  return { untaxed, groups: [...byTax].map(([name, amount]) => ({ name, amount })), total };
}

/** The payments made, as Flectra's invoice_payments_widget gives them to the payments widget. */
function paymentsWidget(lines: unknown): Values {
  return {
    content: ((lines as Line[] | null) ?? []).map((line) => ({
      date: line.values['date'] ?? null,
      amount: num(line.values['amount']),
      name: line.values['ref'] ?? null,
      journal_name: line.values['journal_name'] ?? null,
      ref: line.values['ref'] ?? null,
      account_payment_id: line.id ?? null,
    })),
  };
}

/** A tax amount typed in the totals of a draft bill (the vendor's rounding): the tax, the total and the tax item follow. */
function taxTotalsTyped(values: Values): Values {
  const totals = (values['tax_totals'] ?? {}) as { groups?: { amount: number }[] };
  const tax = round((totals.groups ?? []).reduce((sum, group) => sum + num(group.amount), 0));
  return { amount_tax: tax, ...taxTyped({ ...values, amount_tax: tax }) };
}

/** A move as stored: its lines priced and its journal items made, as the server keeps them. */
function stored(id: number, values: Values): Values {
  const move = { ...MOVE_DEFAULTS, id, ...values };
  return { ...move, ...recomputeMove(move) };
}

/** The vendor's bill, as the PDF it sent: a page of its words. */
const BILL_PDF =
  'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDM1Nz4+c3RyZWFtCkJUIC9GMSAxMiBUZiA2MCA3ODAgVGQgMTYgVEwgKEdpemEgUGFwZXIgTWlsbHMgLSBJbmR1c3RyaWFsIFpvbmUsIFBsb3QgNDQsIDZ0aCBvZiBPY3RvYmVyIENpdHkpICcgKFRBWCBJTlZPSUNFICBHUE0vMjAyNi8wOTEyKSAnIChCaWxsIHRvOiBaYW1hbGVrIE9mZmljZSBTdXBwbGllcyBTLkEuRS4pICcgKDQwIHggQTQgY29weSBwYXBlciwgYm94IG9mIDUgcmVhbXMgICA5ODAuMDAgICAzOSwyMDAuMDApICcgKFZBVCAxNCUgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDUsNDg4LjAwKSAnIChUT1RBTCBFR1AgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDQ0LDY4OC4wMCkgJyBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU0IDAwMDAwIG4gCjAwMDAwMDAxMDUgMDAwMDAgbiAKMDAwMDAwMDIxNyAwMDAwMCBuIAowMDAwMDAwNjIyIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKNjg1CiUlRU9GCg==';

const MOVES: Record<number, Values> = {
  // A customer invoice in draft, in EGP: add a line, confirm it, register its payment.
  4101: stored(4101, {
    name: null,
    move_type: 'out_invoice',
    state: 'draft',
    payment_state: 'not_paid',
    partner_id: partner(4101),
    commercial_partner_id: partner(4101),
    bank_partner_id: partner(4106),
    partner_bank_id: bank(4101),
    ref: 'PO-HMC-2026-118',
    invoice_origin: 'S00412',
    invoice_date: '2026-10-06',
    date: '2026-10-06',
    invoice_payment_term_id: term(4103),
    invoice_date_due: '2026-11-05',
    payment_reference: null,
    journal_id: journal(4101),
    invoice_user_id: user(4151),
    team_id: link(4102, 'Key Accounts'),
    fiscal_position_id: link(4101, 'Local Customers (Egypt)'),
    sale_order_count: 1,
    narration: '<p>Payment by bank transfer to CIB within 30 days. Prices include delivery inside Greater Cairo.</p>',
    invoice_line_ids: [
      sectionLine('s1', 41001, 'Equipment', 10),
      invoiceLine('l1', 41002, { sequence: 20, product_id: product(4101), name: 'Laser printer HP LaserJet M404dn', account_id: account(4101), quantity: 2, product_uom_id: UOM.units, price_unit: 14500, tax_ids: [tax(4101)], analytic_distribution: { 4101: 100 } }),
      invoiceLine('l2', 41003, { sequence: 30, product_id: product(4102), name: 'Toner cartridge HP 59A', account_id: account(4101), quantity: 6, product_uom_id: UOM.units, price_unit: 3400, discount: 5, tax_ids: [tax(4101)], analytic_distribution: { 4101: 100 } }),
      sectionLine('s2', 41004, 'Services', 40),
      invoiceLine('l3', 41005, { sequence: 50, product_id: product(4104), name: 'Installation and setup, on site', account_id: account(4102), quantity: 4, product_uom_id: UOM.hours, price_unit: 650, tax_ids: [tax(4101)], analytic_distribution: { 4101: 100 } }),
      noteLine('n1', 41006, 'Installed at the Heliopolis campus, Building B, 2nd floor.', 60),
    ],
    line_ids: [],
  }),
  // A customer invoice in USD, posted and partly paid.
  4102: stored(4102, {
    name: 'INV/2026/00038',
    posted_before: true,
    move_type: 'out_invoice',
    state: 'posted',
    payment_state: 'partial',
    partner_id: partner(4102),
    commercial_partner_id: partner(4102),
    bank_partner_id: partner(4106),
    partner_bank_id: bank(4101),
    ref: 'NPE-CTR-2026-07',
    invoice_date: '2026-09-20',
    date: '2026-09-20',
    exchange_rate_date: '2026-09-20',
    invoice_payment_term_id: term(4103),
    invoice_date_due: '2026-10-20',
    payment_reference: 'INV/2026/00038',
    journal_id: journal(4101),
    currency_id: USD,
    invoice_user_id: user(4151),
    team_id: link(4102, 'Key Accounts'),
    fiscal_position_id: link(4101, 'Local Customers (Egypt)'),
    invoice_incoterm_id: link(4104, 'DAP Delivered at Place'),
    incoterm_location: '6th of October City, Nile Pharma plant',
    amount_residual: 3498,
    invoice_payment_ids: [{ key: 'p1', id: 41101, values: { date: '2026-10-01', journal_name: 'Bank — CIB USD', ref: 'INV/2026/00038', amount: 3000, currency_id: USD } }],
    invoice_line_ids: [
      invoiceLine('l1', 41011, { sequence: 10, product_id: product(4105), name: 'Annual maintenance contract, 12 printers, Oct 2026 – Sep 2027', account_id: account(4102), quantity: 1, product_uom_id: UOM.units, price_unit: 4800, tax_ids: [tax(4101)] }),
      invoiceLine('l2', 41012, { sequence: 20, product_id: product(4101), name: 'Laser printer HP LaserJet M404dn', account_id: account(4101), quantity: 3, product_uom_id: UOM.units, price_unit: 300, tax_ids: [tax(4101)] }),
    ],
    line_ids: [],
  }),
  // A vendor bill in draft that may repeat one already entered.
  4103: stored(4103, {
    // The vendor's own PDF, beside the bill as Flectra's attachment preview shows it.
    invoice_pdf: { name: 'GPM-2026-0912.pdf', type: 'application/pdf', size: 865, data: BILL_PDF },
    name: null,
    move_type: 'in_invoice',
    state: 'draft',
    payment_state: 'not_paid',
    partner_id: partner(4103),
    commercial_partner_id: partner(4103),
    bank_partner_id: partner(4103),
    partner_bank_id: bank(4102),
    ref: 'GPM-7781',
    invoice_date: '2026-10-04',
    date: '2026-10-04',
    invoice_payment_term_id: term(4102),
    invoice_date_due: '2026-10-19',
    journal_id: journal(4102),
    duplicated_ref_ids: [link(4106, 'BILL/2026/09/0031')],
    invoice_source_email: 'billing@gizapapermills.example',
    to_check: true,
    invoice_line_ids: [
      invoiceLine('l1', 41021, { sequence: 10, product_id: product(4103), name: 'A4 copy paper, box of 5 reams', account_id: account(4107), quantity: 40, product_uom_id: UOM.boxes, price_unit: 980, tax_ids: [tax(4102)], analytic_distribution: { 4103: 100 } }),
    ],
    line_ids: [],
  }),
  // A journal entry in draft: the month's rent accrued.
  4104: stored(4104, {
    name: null,
    move_type: 'entry',
    state: 'draft',
    payment_state: 'not_paid',
    ref: 'Rent accrual, October 2026',
    date: '2026-10-06',
    journal_id: journal(4106),
    narration: '<p>Reversed on 1 November when the landlord’s invoice arrives.</p>',
    invoice_line_ids: [],
    line_ids: [
      { key: 'e1', id: 41031, values: { display_type: 'product', account_id: account(4116), partner_id: null, name: 'Office rent, Zamalek, October 2026', analytic_distribution: { 4103: 100 }, debit: 85000, credit: 0, amount_currency: 85000, currency_id: EGP, company_currency_id: EGP, tax_ids: [], tax_tag_ids: [] } },
      { key: 'e2', id: 41032, values: { display_type: 'product', account_id: account(4117), partner_id: null, name: 'Office rent, Zamalek, October 2026', analytic_distribution: null, debit: 0, credit: 85000, amount_currency: -85000, currency_id: EGP, company_currency_id: EGP, tax_ids: [], tax_tag_ids: [] } },
    ],
  }),
  // A customer credit note, posted and paid back.
  4105: stored(4105, {
    name: 'RINV/2026/00007',
    posted_before: true,
    move_type: 'out_refund',
    state: 'posted',
    payment_state: 'paid',
    partner_id: partner(4107),
    commercial_partner_id: partner(4107),
    bank_partner_id: partner(4106),
    partner_bank_id: bank(4101),
    ref: 'Reversal of: INV/2026/00031, two damaged cartridges',
    invoice_date: '2026-09-24',
    date: '2026-09-24',
    invoice_date_due: '2026-09-24',
    invoice_payment_term_id: term(4101),
    payment_reference: 'RINV/2026/00007',
    journal_id: journal(4101),
    reversed_entry_id: link(4107, 'INV/2026/00031'),
    invoice_user_id: user(4151),
    amount_residual: 0,
    invoice_payment_ids: [{ key: 'p1', id: 41102, values: { date: '2026-09-28', journal_name: 'Bank — CIB', ref: 'RINV/2026/00007', amount: 7752, currency_id: EGP } }],
    invoice_line_ids: [
      invoiceLine('l1', 41041, { sequence: 10, product_id: product(4102), name: 'Toner cartridge HP 59A, damaged in delivery', account_id: account(4101), quantity: 2, product_uom_id: UOM.units, price_unit: 3400, tax_ids: [tax(4101)] }),
    ],
    line_ids: [],
  }),
  // The bill the draft one may repeat: same vendor, same reference.
  4106: stored(4106, {
    name: 'BILL/2026/09/0031',
    posted_before: true,
    move_type: 'in_invoice',
    state: 'posted',
    payment_state: 'paid',
    partner_id: partner(4103),
    commercial_partner_id: partner(4103),
    bank_partner_id: partner(4103),
    partner_bank_id: bank(4102),
    ref: 'GPM-7781',
    invoice_date: '2026-09-29',
    date: '2026-09-29',
    invoice_date_due: '2026-10-14',
    invoice_payment_term_id: term(4102),
    journal_id: journal(4102),
    amount_residual: 0,
    invoice_line_ids: [invoiceLine('l1', 41051, { sequence: 10, product_id: product(4103), name: 'A4 copy paper, box of 5 reams', account_id: account(4107), quantity: 40, product_uom_id: UOM.boxes, price_unit: 980, tax_ids: [tax(4102)] })],
    line_ids: [],
  }),
};
MOVES[4107] = stored(4107, { ...MOVES[4105], id: 4107, name: 'INV/2026/00031', move_type: 'out_invoice', reversed_entry_id: null, invoice_payment_ids: [], payment_state: 'reversed' });

// ---------------------------------------------------------------------------
// Register Payment: what default_get and the computes give, and what the buttons do.
// ---------------------------------------------------------------------------

/** An amount in one currency, in another, through EGP. */
function convert(amount: number, from: unknown, to: unknown, manualRate = 0): number {
  const egpPer = (code: unknown) => (code === 'USD' ? manualRate || USD_RATE : 1);
  return round((amount * egpPer(codeOf(from))) / egpPer(codeOf(to)));
}

/** The whole amount due, in the wizard's currency, and what is left once `amount` is paid. */
function difference(values: Values): Values {
  const full = convert(num(values['source_amount_currency']), values['source_currency_id'], values['currency_id'], num(values['manual_currency_rate']));
  return { payment_difference: round(full - num(values['amount'])) };
}

/** What a journal and its first way of paying decide: currency, method, bank account, the full amount again. */
function journalPicked(values: Values, keepAmount = false): Values {
  const journalId = Number(idOf(values['journal_id']));
  const found = JOURNALS[journalId];
  const type = values['payment_type'] === 'outbound' ? 'outbound' : 'inbound';
  const methodId = Number(Object.entries(METHODS).find(([, m]) => m.journal === journalId && m.type === type)?.[0]) || null;
  const currency = found?.currency ?? values['source_currency_id'] ?? EGP;
  const full = convert(num(values['source_amount_currency']), values['source_currency_id'], currency);
  const amount = keepAmount ? num(values['amount']) : full;
  const partnerBank = type === 'inbound' ? bank(4101) : (() => {
    const owner = PARTNERS[Number(idOf(values['partner_id']))];
    return owner?.bank ? bank(owner.bank) : null;
  })();
  return {
    currency_id: currency,
    payment_method_line_id: methodId ? method(methodId) : null,
    payment_method_code: methodId ? METHODS[methodId].code : null,
    is_postdated_check: methodId ? METHODS[methodId].code === 'pdc' : false,
    show_partner_bank_account: found?.type === 'bank',
    require_partner_bank_account: false,
    partner_bank_id: found?.type === 'bank' ? partnerBank : null,
    amount,
    payment_difference: round(full - amount),
    manual_currency_rate: 0,
  };
}

function methodPicked(values: Values): Values {
  const found = METHODS[Number(idOf(values['payment_method_line_id']))];
  return { payment_method_code: found?.code ?? null, is_postdated_check: found?.code === 'pdc' };
}

function currencyPicked(values: Values): Values {
  const amount = convert(num(values['source_amount_currency']), values['source_currency_id'], values['currency_id']);
  return { amount, payment_difference: 0, manual_currency_rate: 0 };
}

function writeoffPicked(values: Values): Values {
  return {
    writeoff_is_exchange_account:
      Boolean(values['can_edit_wizard']) && idOf(values['currency_id']) !== idOf(values['source_currency_id']) && FX_ACCOUNTS.includes(Number(idOf(values['writeoff_account_id']))),
  };
}

/** default_get: the journal to pay through (the bank in the invoice's currency), its first method, the amount due. */
/** What the wizard may pick from, as Flectra's computes say: bank and cash journals, the banks of whoever receives the money. */
function paymentChoices(values: Values): Values {
  // Money received goes to the company's own banks (its partner, 4106); money sent, to the partner's.
  const owner = values['payment_type'] === 'outbound' ? Number(idOf(values['partner_id'])) : 4106;
  return {
    available_journal_ids: Object.entries(JOURNALS).filter(([, j]) => ['bank', 'cash'].includes(j.type)).map(([id]) => journal(Number(id))),
    available_partner_bank_ids: Object.entries(BANKS).filter(([, [, holder]]) => holder === owner).map(([id]) => bank(Number(id))),
    suitable_payment_token_ids: [],
  };
}

function paymentDefaults(values: Values): ActionResult | undefined {
  if (values['journal_id']) return undefined; // a stored wizard keeps its own
  const usd = codeOf(values['source_currency_id']) === 'USD';
  const journalId = usd ? 4105 : 4103;
  const next = { ...values, journal_id: journal(journalId) };
  return {
    values: {
      journal_id: journal(journalId),
      ...journalPicked(next),
      payment_difference_handling: 'open',
      writeoff_label: 'Write-Off',
      hide_writeoff_section: false,
      early_payment_discount_mode: false,
      writeoff_is_exchange_account: false,
      use_electronic_payment_method: false,
      untrusted_payments_count: 0,
      total_payments_amount: 1,
      country_code: 'EG',
      ...paymentChoices(values),
    },
  };
}

let paymentNumber = 31;

function createPayments(values: Values): ActionResult {
  const found = JOURNALS[Number(idOf(values['journal_id']))];
  const name = `P${found?.code ?? 'BNK1'}/2026/${String(paymentNumber++).padStart(5, '0')}`;
  const amount = money(num(values['amount']), String(codeOf(values['currency_id']) ?? 'EGP'));
  const check = values['is_postdated_check'] ? `, check ${values['bill_no']} due ${values['due_date']}` : '';
  return { say: { message: `Payment ${name} of ${amount} posted${check}`, tone: 'success' } };
}

/** The payment just made, reconciled with the invoice: what is left to pay, its status, its line in the payments. */
function reconcilePayment(values: Values): ActionResult {
  const paid = convert(num(values['payment_amount']), values['payment_currency_id'], values['currency_id'], num(values['manual_currency_rate']));
  const residual = values['payment_handling'] === 'reconcile' ? 0 : Math.max(0, round(num(values['amount_residual']) - paid));
  const lines = (values['invoice_payment_ids'] as Line[] | null) ?? [];
  const found = JOURNALS[Number(idOf(values['payment_journal_id']))];
  const code = String(codeOf(values['currency_id']) ?? 'EGP');
  const left = residual > 0 ? `: ${money(residual, code)} left to pay` : ': paid in full';
  const payments: Line[] = [
    ...lines,
    { key: `pay-${Date.now()}`, values: { date: values['payment_paid_on'] ?? TODAY, journal_name: found?.name ?? '', ref: values['payment_memo'] ?? null, amount: paid, currency_id: values['currency_id'] ?? EGP } },
  ];
  return {
    // Said here, by the invoice: words the dialog said as it closed would be lost with it.
    say: { message: `Payment of ${money(paid, code)} registered${left}`, tone: 'success' },
    values: {
      amount_residual: residual,
      // A real Flectra 17 says In Payment until the bank statement is matched; the sample marks it paid.
      payment_state: residual <= 0 ? 'paid' : 'partial',
      invoice_payment_ids: payments,
      invoice_payments_widget: paymentsWidget(payments),
      // Outstanding credits are offered only while something is left to pay.
      ...(residual <= 0 ? { invoice_has_outstanding: false, outstanding_ids: [] } : {}),
      payment_amount: null,
      payment_currency_id: null,
      payment_handling: null,
      payment_paid_on: null,
      payment_journal_id: null,
      payment_memo: null,
    },
  };
}

// ---------------------------------------------------------------------------
// An invoice's buttons.
// ---------------------------------------------------------------------------

const sequences: Record<string, number> = { out_invoice: 42, out_refund: 8, in_invoice: 12, in_refund: 3, entry: 4, out_receipt: 2, in_receipt: 2 };
function nextName(type: string, day: string): string {
  const n = sequences[type]++;
  const [year, month] = day.split('-');
  switch (type) {
    case 'out_invoice':
      return `INV/${year}/${String(n).padStart(5, '0')}`;
    case 'out_refund':
      return `RINV/${year}/${String(n).padStart(5, '0')}`;
    case 'in_invoice':
      return `BILL/${year}/${month}/${String(n).padStart(4, '0')}`;
    case 'in_refund':
      return `RBILL/${year}/${month}/${String(n).padStart(4, '0')}`;
    default:
      return `MISC/${year}/${month}/${String(n).padStart(4, '0')}`;
  }
}

const TYPE_NAMES: Record<string, string> = {
  out_invoice: 'Customer Invoice',
  out_refund: 'Customer Credit Note',
  in_invoice: 'Vendor Bill',
  in_refund: 'Vendor Credit Note',
  out_receipt: 'Sales Receipt',
  in_receipt: 'Purchase Receipt',
};

function postMove(values: Values): ActionResult {
  const type = String(values['move_type']);
  const invoiceLines = ((values['invoice_line_ids'] as Line[] | null) ?? []).filter(isAccountLine);
  if (INVOICE_TYPES.includes(type)) {
    if (!values['partner_id']) {
      const who = OUT_TYPES.includes(type) ? 'Customer' : 'Vendor';
      return { stop: `The field '${who}' is required, please complete it to validate the ${TYPE_NAMES[type]}.` };
    }
    if (!invoiceLines.length) return { stop: 'You need to add a line before posting.' };
  } else {
    const items = (values['line_ids'] as Line[] | null) ?? [];
    const debit = round(items.reduce((sum, l) => sum + num(l.values['debit']), 0));
    const credit = round(items.reduce((sum, l) => sum + num(l.values['credit']), 0));
    if (!items.length) return { stop: 'You need to add a line before posting.' };
    if (debit !== credit) return { stop: `The entry is not balanced. The total of debits equals ${money(debit, 'EGP')} and the total of credits equals ${money(credit, 'EGP')}.` };
  }
  const day = (values['invoice_date'] as string | null) ?? TODAY;
  const name = values['name'] && values['name'] !== '/' ? String(values['name']) : nextName(type, (values['date'] as string | null) ?? day);
  const posted: Values = {
    state: 'posted',
    posted_before: true,
    name,
    payment_state: 'not_paid',
    amount_residual: num(values['amount_total']),
    ...(INVOICE_TYPES.includes(type) && !values['invoice_date'] ? { invoice_date: day, date: day } : {}),
    ...(INVOICE_TYPES.includes(type) && !values['payment_reference'] ? { payment_reference: name } : {}),
  };
  // Heliopolis Medical Center paid an advance in September: an outstanding credit to allocate.
  if (type === 'out_invoice' && idOf(values['partner_id']) === 4101) {
    posted['invoice_has_outstanding'] = true;
    posted['outstanding_ids'] = [{ key: 'o1', values: { ref: 'PBNK1/2026/00027 (advance)', date: '2026-09-15', amount: 10000, currency_id: EGP } }];
  }
  if (INVOICE_TYPES.includes(type)) {
    const items = journalItems({ ...values, ...posted }, (values['invoice_line_ids'] as Line[] | null) ?? [], (values['line_ids'] as Line[] | null) ?? []);
    posted['line_ids'] = items;
  }
  return { values: posted };
}

function invoiceAction(request: ActionRequest): ActionResult | undefined {
  const v = request.values;
  const name = String(v['name'] ?? '');
  const customer = PARTNERS[Number(idOf(v['partner_id']))];
  switch (request.action) {
    case 'action_post':
      return postMove(v);
    case 'action_invoice_sent':
      return {
        values: { invoice_pdf_report_id: link(4101 + Number(v['id'] ?? 0), `${name.replaceAll('/', '_')}.pdf`) },
        say: { message: `${name} sent to ${customer?.email ?? 'the customer'}, with its PDF`, tone: 'success' },
      };
    case 'print_invoice':
      return { say: { message: `${name || 'The draft'}: the invoice PDF opens to print`, tone: 'info' } };
    case 'js_assign_outstanding_line': {
      // The outstanding credit on this line, set against what is left to pay.
      const line = request.line;
      if (!line) return undefined;
      const residual = Math.max(0, round(num(v['amount_residual']) - num(line.values['amount'])));
      const payments: Line[] = [
        ...((v['invoice_payment_ids'] as Line[] | null) ?? []),
        { key: `out-${line.key}`, values: { date: line.values['date'] ?? TODAY, journal_name: 'Bank — CIB', ref: line.values['ref'] ?? null, amount: num(line.values['amount']), currency_id: v['currency_id'] ?? EGP } },
      ];
      const left = ((v['outstanding_ids'] as Line[] | null) ?? []).filter((other) => other.key !== line.key);
      return {
        values: {
          amount_residual: residual,
          payment_state: residual <= 0 ? 'paid' : 'partial',
          invoice_payment_ids: payments,
          invoice_payments_widget: paymentsWidget(payments),
          outstanding_ids: residual <= 0 ? [] : left,
          invoice_has_outstanding: residual > 0 && left.length > 0,
        },
        say: { message: `${line.values['ref']} added to ${name}`, tone: 'success' },
      };
    }
    case 'action_automatic_entry':
      return { say: { message: `The Cut-Off dialog opens here in Flectra, for “${request.line?.values['name'] ?? ''}”: the dates to spread it over`, tone: 'info' } };
    case 'action_export_xml':
    case 'action_process_edi_web_services':
    case 'action_retry_edi_documents_error':
      return { say: { message: `${request.action}: the e-invoicing service is asked again`, tone: 'info' } };
    case 'preview_invoice':
      return { say: { message: `The customer's own page for ${name} opens: /my/invoices/${v['id']}`, tone: 'info' } };
    case 'reconcile_payment':
      return reconcilePayment(v);
    case 'button_cancel':
      return { values: { state: 'cancel' } };
    case 'button_draft':
      return { values: { state: 'draft', payment_state: 'not_paid', amount_residual: num(v['amount_total']), invoice_payment_ids: [], invoice_payments_widget: paymentsWidget([]), outstanding_ids: [], invoice_has_outstanding: false, invoice_pdf_report_id: null } };
    case 'action_reverse':
      return { say: { message: `A credit note for ${name} is made in draft from the Reverse wizard (account.move.reversal)`, tone: 'info' } };
    case 'action_reverse_entry':
      return { values: { payment_state: 'reversed' }, say: { message: `${name} reversed by ${nextName('entry', TODAY)}`, tone: 'success' } };
    case 'action_update_fpos_values':
      return { values: { show_update_fpos: false }, say: { message: 'Taxes and accounts updated from the fiscal position', tone: 'success' } };
    case 'action_activate_currency':
      return { values: { display_inactive_currency_warning: false }, say: { message: 'Currency activated', tone: 'success' } };
    case 'open_duplicated_ref_bill_view':
      return { say: { message: `Possible duplicates: ${links(v['duplicated_ref_ids']).map((m) => m.label).join(', ')}`, tone: 'warning' } };
    case 'action_view_source_sale_orders':
      return { say: { message: `Source sales order: ${v['invoice_origin'] ?? '—'}`, tone: 'info' } };
    case 'action_view_source_purchase_orders':
      return { say: { message: 'Source purchase order: P00027', tone: 'info' } };
    case 'action_refresh_exchange_rate':
      return { values: { exchange_rate_used: USD_RATE, exchange_rate_date: TODAY }, say: { message: `Rate refreshed: 1 USD = ${USD_RATE} EGP`, tone: 'info' } };
    case 'action_open_business_doc':
    case 'open_reconcile_view':
    case 'open_created_caba_entries':
    case 'action_view_debit_notes':
    case 'action_view_payment_transactions':
    case 'payment_action_capture':
    case 'payment_action_void':
    case 'button_cancel_posted_moves':
    case 'button_abandon_cancel_posted_posted_moves':
    case 'button_request_cancel':
      return { say: { message: `${request.action}: the app opens its own screen here`, tone: 'info' } };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// The expense: its lines' amounts (prices include their taxes), the header cascade, its workflow.
// ---------------------------------------------------------------------------

/** A line's amounts: the typed price is the receipt's, taxes included; the tax is taken out of it. */
function expenseAmounts(line: Values, currency: Values[string] | undefined): Values {
  const total = round(num(line['quantity']) * num(line['price_unit']));
  const rate = links(line['tax_ids']).reduce((sum, t) => sum + (TAXES[Number(t.id)]?.amount ?? 0), 0);
  const untaxed = round(total / (1 + rate / 100));
  return { ...line, total_amount: total, untaxed_amount: untaxed, tax_amount: round(total - untaxed), currency_id: currency ?? EGP };
}

/** New lines take the header's vendor, date, taxes, account and analytic; a category brings its account and taxes. */
function recomputeExpense(values: Values, cascade: Partial<Record<'vendor' | 'date' | 'taxes' | 'account' | 'analytic', boolean>> = {}): Values {
  const headerTaxes = links(values['header_tax_ids']);
  // The header's distribution ({ "4104": 100 }, shares by account): each line takes its accounts.
  const shares = (values['header_analytic_distribution'] ?? {}) as Record<string, number>;
  const headerAnalytic = Object.fromEntries(Object.entries(shares).filter(([id]) => ANALYTIC[Number(id)]));
  const lines = ((values['line_ids'] as Line[] | null) ?? []).map((line) => {
    const v = { ...line.values };
    const fresh = line.id === undefined;
    if ((fresh && values['header_vendor'] && !v['vendor']) || cascade.vendor) v['vendor'] = values['header_vendor'] ?? null;
    if ((fresh && values['expense_date'] && !v['date']) || (cascade.date && values['expense_date'])) v['date'] = values['expense_date'];
    if ((fresh && headerTaxes.length && !links(v['tax_ids']).length) || cascade.taxes) v['tax_ids'] = headerTaxes;
    if ((fresh && values['header_account_id'] && !v['account_id']) || (cascade.account && values['header_account_id'])) v['account_id'] = values['header_account_id'];
    const own = v['analytic_distribution'] as Record<string, number> | null | undefined;
    if ((fresh && Object.keys(headerAnalytic).length && !Object.keys(own ?? {}).length) || cascade.analytic) v['analytic_distribution'] = Object.keys(headerAnalytic).length ? { ...headerAnalytic } : null;
    // A category picked or changed brings its expense account and taxes, unless the header sets them.
    const seenKey = `expense:${String(values['name'] ?? 'new')}:${line.key}`;
    const categoryId = idOf(v['product_id']);
    const changed = productSeen.has(seenKey) && productSeen.get(seenKey) !== categoryId;
    productSeen.set(seenKey, categoryId);
    const category = PRODUCTS[Number(categoryId)];
    if (category && (changed || !v['account_id']) && !values['header_account_id']) v['account_id'] = account(category.expense);
    if (category && changed && !headerTaxes.length) v['tax_ids'] = category.expense === 4111 ? [] : [tax(4102)];
    return { ...line, values: expenseAmounts(v, values['currency_id']) };
  });
  const sum = (field: string) => round(lines.reduce((total, l) => total + num(l.values[field]), 0));
  return { line_ids: lines, untaxed_amount: sum('untaxed_amount'), tax_amount: sum('tax_amount'), total_amount: sum('total_amount') };
}

let billNumber = 14;

function expenseAction(request: ActionRequest): ActionResult | undefined {
  const v = request.values;
  const lines = (v['line_ids'] as Line[] | null) ?? [];
  switch (request.action) {
    case 'action_submit':
      if (!lines.length) return { stop: 'Add at least one expense line before submitting.' };
      return { values: { approval_state: 'submit', state: 'submit' }, say: { message: `Submitted to ${(v['user_id'] as RelatedRecord | null)?.label ?? 'the approver'}`, tone: 'success' } };
    case 'action_post': {
      if (!lines.length) return { stop: 'No expense lines to post.' };
      const total = num(v['total_amount']);
      const day = (v['expense_date'] as string | null) ?? TODAY;
      if (v['payment_mode'] === 'company_account') {
        // Option B: lines sharing a date and currency are one payment.
        const entries = new Set(lines.map((l) => `${l.values['date'] ?? day}`)).size;
        return {
          values: { move_count: entries, payment_state: 'paid', amount_residual: 0, accounting_date: day, state: 'done' },
          say: { message: `${entries} paid ${entries === 1 ? 'entry' : 'entries'} posted from ${(v['payment_method_line_id'] as RelatedRecord | null)?.label ?? 'the payment method'}`, tone: 'success' },
        };
      }
      const bill = `BILL/2026/10/${String(billNumber++).padStart(4, '0')}`;
      return {
        values: { move_count: 1, payment_state: 'not_paid', amount_residual: total, accounting_date: day, state: 'post' },
        say: { message: `${bill} posted: ${money(total, String(codeOf(v['currency_id']) ?? 'EGP'))} to reimburse to ${(v['employee_id'] as RelatedRecord | null)?.label ?? 'the employee'}`, tone: 'success' },
      };
    }
    case 'expense_payment_registered': {
      const residual = v['payment_handling'] === 'reconcile' ? 0 : Math.max(0, round(num(v['amount_residual']) - num(v['payment_amount'])));
      // A real Flectra 17 says In Payment until the bank statement is matched; the sample marks it paid.
      const paid = residual <= 0;
      return {
        values: { amount_residual: residual, payment_state: paid ? 'paid' : 'partial', state: paid ? 'done' : 'post', payment_amount: null, payment_handling: null },
        say: { message: paid ? `${(v['employee_id'] as RelatedRecord | null)?.label ?? 'The employee'} is reimbursed in full` : `${money(residual, String(codeOf(v['currency_id']) ?? 'EGP'))} left to reimburse`, tone: 'success' },
      };
    }
    case 'action_draft':
      return { values: { approval_state: null, state: 'draft', move_count: 0, payment_state: null, amount_residual: 0, accounting_date: null } };
    case 'action_open_moves':
      return { say: { message: `The expense's journal entries: ${num(v['move_count'])} — the app opens their list here`, tone: 'info' } };
    default:
      return undefined;
  }
}

// ---------------------------------------------------------------------------
// The lane.
// ---------------------------------------------------------------------------

const EXPENSE_DEFAULTS: Values = { company_id: COMPANY, currency_id: EGP, analytic_precision: 2, approval_state: null, move_count: 0, payment_state: null, amount_residual: 0, accounting_date: null };
const expenseLine = (key: string, id: number, values: Values): Line => ({ key, id, values: { sequence: 10, quantity: 1, analytic_distribution: null, ...values } });
const storedExpense = (values: Values): Values => {
  const expense = { ...EXPENSE_DEFAULTS, ...values };
  return { ...expense, ...recomputeExpense(expense) };
};

const EXPENSES: Record<number, Values> = {
  4101: storedExpense({
    name: 'EXP/2026/0057',
    title: 'Riyadh trade fair, October 2026',
    employee_id: employee(4101),
    commercial_partner_id: partner(4105),
    user_id: user(4152),
    expense_date: '2026-10-05',
    payment_mode: 'own_account',
    employee_journal_id: journal(4107),
    payment_method_line_id: null,
    state: 'draft',
    header_vendor: null,
    header_tax_ids: [tax(4102)],
    header_account_id: null,
    header_analytic_distribution: { 4104: 100 },
    line_ids: [
      expenseLine('x1', 41201, { sequence: 10, name: 'Flight Cairo – Riyadh, return', product_id: product(4111), vendor: 'EgyptAir', date: '2026-10-01', price_unit: 18400, tax_ids: [tax(4102)], account_id: account(4108), analytic_distribution: { 4104: 100 } }),
      expenseLine('x2', 41202, { sequence: 20, name: 'Hotel, 3 nights', product_id: product(4112), vendor: 'Hilton Riyadh', date: '2026-10-04', quantity: 3, price_unit: 4200, tax_ids: [tax(4102)], account_id: account(4109), analytic_distribution: { 4104: 100 } }),
      expenseLine('x3', 41203, { sequence: 30, name: 'Client dinner, Gulf Medical Supplies', product_id: product(4113), vendor: 'Najd Village', date: '2026-10-03', price_unit: 2850, tax_ids: [tax(4102)], account_id: account(4110), analytic_distribution: { 4104: 100 } }),
      expenseLine('x4', 41204, { sequence: 40, name: 'Taxi to and from the venue', product_id: product(4114), vendor: 'Uber', date: '2026-10-04', quantity: 6, price_unit: 180, tax_ids: [], account_id: account(4111), analytic_distribution: { 4104: 100 } }),
    ],
  }),
  4102: storedExpense({
    name: 'EXP/2026/0058',
    title: 'Office internet, October 2026',
    employee_id: employee(4102),
    commercial_partner_id: partner(4108),
    user_id: user(4152),
    expense_date: '2026-10-02',
    payment_mode: 'company_account',
    employee_journal_id: null,
    payment_method_line_id: method(4102),
    state: 'approve',
    approval_state: 'approve',
    header_vendor: 'Cairo Telecom Services',
    header_tax_ids: [tax(4102)],
    header_account_id: account(4112),
    header_analytic_distribution: { 4103: 100 },
    line_ids: [
      expenseLine('x1', 41211, { name: 'Fibre 100 Mbps, October', product_id: product(4115), vendor: 'Cairo Telecom Services', date: '2026-10-02', price_unit: 2280, tax_ids: [tax(4102)], account_id: account(4112), analytic_distribution: { 4103: 100 } }),
    ],
  }),
};

/** The sample Register Payment, as opened from the USD invoice with part of it paid: the difference shows. */
const WIZARD: Values = {
  line_ids: [],
  can_edit_wizard: true,
  can_group_payments: false,
  early_payment_discount_mode: false,
  payment_type: 'inbound',
  partner_type: 'customer',
  source_amount: round(3498 * USD_RATE),
  source_amount_currency: 3498,
  source_currency_id: USD,
  company_id: COMPANY,
  partner_id: partner(4102),
  country_code: 'EG',
  currency_id: USD,
  show_partner_bank_account: true,
  require_partner_bank_account: false,
  company_currency_id: EGP,
  hide_writeoff_section: false,
  writeoff_is_exchange_account: false,
  untrusted_payments_count: 0,
  total_payments_amount: 1,
  journal_id: journal(4105),
  payment_method_line_id: method(4107),
  payment_method_code: 'manual',
  is_postdated_check: false,
  use_electronic_payment_method: false,
  partner_bank_id: bank(4101),
  group_payment: false,
  amount: 3000,
  manual_currency_rate: 0,
  payment_date: TODAY,
  communication: 'INV/2026/00038',
  payment_difference: 498,
  payment_difference_handling: 'open',
  writeoff_account_id: null,
  writeoff_label: 'Write-Off',
  qr_code: null,
  ...paymentChoices({ payment_type: 'inbound', partner_id: partner(4102) }),
};

/**
 * The person the accounting pages are shown to: the company's accountant, who
 * also approves expenses — with the groups Flectra gives one in a company of
 * one country that keeps EGP and USD. Developer mode, several companies and
 * cash rounding stay off, as in Sherkety's own setup.
 */
const ACCOUNTANT = {
  id: 4151,
  name: 'Nour El-Sayed',
  roles: [
    'base.group_user',
    'base.group_multi_currency',
    'account.group_account_invoice',
    'account.group_account_readonly',
    'account.group_account_user',
    'account.group_account_manager',
    'analytic.group_analytic_accounting',
    'uom.group_uom',
    'hr_expense.group_hr_expense_user',
    'hr_expense.group_hr_expense_team_approver',
    'hr_expense.group_hr_expense_manager',
    'sales_team.group_sale_salesman',
    'purchase.group_purchase_user',
  ],
};

export const lane: RealLane = {
  around: {
    'real-invoice': { user: ACCOUNTANT, records: [4101, 4102, 4103, 4104, 4105, 4106], breadcrumbs: [{ label: 'Invoices', href: '#invoices' }] },
    'real-register-payment': { user: ACCOUNTANT },
    'real-expense': { user: ACCOUNTANT, records: [4101, 4102], breadcrumbs: [{ label: 'Expenses', href: '#expenses' }] },
  },
  pages: {
    'real-invoice': invoice as Page,
    'real-register-payment': registerPayment as Page,
    'real-expense': expense as Page,
  },
  opened: { 'real-register-payment': registerPayment as Page },
  related: { 'account.move': invoice as Page, 'sherkety.expense': expense as Page },
  records: {
    'account.move': MOVES,
    'account.payment.register': { 4101: WIZARD },
    'sherkety.expense': EXPENSES,
    'res.currency': { 7461: { name: 'EGP' }, 7462: { name: 'USD' } },
    'res.company': { 4101: { name: COMPANY.label, currency_id: EGP } },
    'res.partner': rows(PARTNERS, (p) => ({ name: p.name, is_company: p.is_company, email: p.email ?? null, street: p.street ?? null, city: p.city ?? null, vat: p.vat ?? null })),
    'res.partner.bank': rows(BANKS, ([name, owner]) => ({ name, partner_id: partner(owner) })),
    'res.users': rows(USERS, (name) => ({ name, share: false })),
    'hr.employee': rows(EMPLOYEES, (e) => ({ name: e.name, work_contact_id: partner(e.contact), parent_user_id: user(e.manager) })),
    'account.journal': rows(JOURNALS, (j) => ({ name: j.name, type: j.type, code: j.code, currency_id: j.currency ?? null })),
    'account.payment.method.line': rows(METHODS, (m) => ({ name: m.name, journal_id: journal(m.journal), payment_type: m.type, code: m.code })),
    'account.account': rows(ACCOUNTS, ([name, type]) => ({ name, account_type: type, deprecated: false })),
    'account.tax': rows(TAXES, (t) => ({ name: t.name, amount: t.amount, type_tax_use: t.use })),
    'account.account.tag': rows(TAGS, (name) => ({ name })),
    'account.analytic.account': rows(ANALYTIC, (name) => ({ name })),
    'account.payment.term': rows(TERMS, ([name]) => ({ name })),
    'account.fiscal.position': { 4101: { name: 'Local Customers (Egypt)' }, 4102: { name: 'Free Zone and Export' } },
    'account.incoterms': { 4101: { name: 'EXW Ex Works' }, 4102: { name: 'FCA Free Carrier' }, 4103: { name: 'CIF Cost, Insurance and Freight' }, 4104: { name: 'DAP Delivered at Place' } },
    // Direct Sales is the CRM lane's team; the units, the sales lane's.
    'crm.team': { 4102: { name: 'Key Accounts' } },
    'product.product': rows(PRODUCTS, (p) => ({ name: p.name, list_price: p.price, standard_price: p.cost, can_be_expensed: p.expensed ?? false, sale_ok: !p.expensed, purchase_ok: true })),
    'purchase.order': { 4101: { name: 'P00027', partner_id: partner(4103) } },
    'purchase.bill.union': { 4101: { name: 'P00027', partner_id: partner(4103) }, 4102: { name: 'BILL/2026/09/0031', partner_id: partner(4103) } },
  },
  onchange: {
    'account.move': {
      invoice_line_ids: recomputeMove,
      partner_id: partnerChanged,
      invoice_date: (values) => {
        const next = { ...values, ...dueDate(values) };
        return { ...dueDate(values), ...(values['state'] === 'draft' && INVOICE_TYPES.includes(String(values['move_type'])) ? { date: values['invoice_date'] } : {}), ...recomputeMove(next) };
      },
      invoice_payment_term_id: (values) => {
        const next = { ...values, ...dueDate(values) };
        return { ...dueDate(values), ...recomputeMove(next) };
      },
      invoice_date_due: recomputeMove,
      currency_id: recomputeMove,
      manual_currency_rate: recomputeMove,
      payment_reference: recomputeMove,
      fiscal_position_id: (values) => ({ show_update_fpos: values['state'] === 'draft' }),
      purchase_vendor_bill_id: autoComplete,
      amount_tax: taxTyped,
      tax_totals: taxTotalsTyped,
    },
    'account.payment.register': {
      journal_id: (values) => journalPicked(values),
      payment_method_line_id: methodPicked,
      currency_id: currencyPicked,
      amount: difference,
      payment_date: difference,
      manual_currency_rate: difference,
      writeoff_account_id: writeoffPicked,
    },
    'sherkety.expense': {
      line_ids: (values) => recomputeExpense(values),
      header_vendor: (values) => recomputeExpense(values, { vendor: true }),
      expense_date: (values) => recomputeExpense(values, { date: true }),
      header_tax_ids: (values) => recomputeExpense(values, { taxes: true }),
      header_account_id: (values) => recomputeExpense(values, { account: true }),
      header_analytic_distribution: (values) => recomputeExpense(values, { analytic: true }),
      currency_id: (values) => recomputeExpense(values),
      employee_id: (values) => {
        const found = EMPLOYEES[Number(idOf(values['employee_id']))];
        return found ? { user_id: user(found.manager), commercial_partner_id: partner(found.contact) } : { user_id: null, commercial_partner_id: null };
      },
    },
  },
  warnings: {
    'account.move': { partner_id: (values) => creditWarning({ ...values, ...recomputeMove(values) }) || null },
  },
  action(request) {
    const v = request.values;
    // An invoice's own pair: a transfer has a move_type too (its shipping policy).
    if ('move_type' in v && 'invoice_line_ids' in v) return later(invoiceAction(request));
    if ('payment_difference_handling' in v && 'source_amount_currency' in v) {
      if (request.action === 'payment_register_defaults') return later(paymentDefaults(v), 50);
      if (request.action === 'action_create_payments') return later(createPayments(v));
      if (request.action === 'action_open_untrusted_bank_accounts') return later({ say: { message: 'No untrusted bank accounts', tone: 'info' } });
      return undefined;
    }
    if ('payment_mode' in v && 'line_ids' in v) return later(expenseAction(request));
    return undefined;
  },
};
