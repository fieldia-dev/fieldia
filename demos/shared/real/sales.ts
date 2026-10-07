import type { ActionRequest, ActionResult, Line, Page, PropertyDefinition, RelatedRecord, Values } from '@fieldia/core';
import contractRenewal from '../../../examples/pages/real-contract-renewal.page.json';
import contractTermination from '../../../examples/pages/real-contract-termination.page.json';
import product from '../../../examples/pages/real-product.page.json';
import saleContract from '../../../examples/pages/real-sale-contract.page.json';
import invoiceWizard from '../../../examples/pages/real-sale-invoice-wizard.page.json';
import contractAmendment from '../../../examples/pages/real-contract-amendment.page.json';
import saleOrder from '../../../examples/pages/real-sale-order.page.json';
import type { RealLane } from './lane';

/**
 * The sales lane: Sherkety ERP's Create invoices dialog, Sales order, Product
 * and Sales contract, rebuilt as Fieldia pages (see demos/real/README.md). The
 * records are a Cairo distributor of hospital equipment, Nile Medical
 * Equipment Co., selling to hospitals in Cairo, Alexandria and Tanta.
 *
 * Every id is in the 7000s, so this lane's records never take the place of
 * another lane's or of the samples' own (the samples' sales order is id 1).
 */

// ---------------------------------------------------------------------------
// The records the links point to, by model.
// ---------------------------------------------------------------------------

const NAMES: Record<string, Record<number, string>> = {
  'res.company': { 7001: 'Nile Medical Equipment Co.' },
  'res.currency': { 7461: 'EGP', 7462: 'USD', 7463: 'EUR' },
  'res.users': { 7121: 'Salma Nabil', 7122: 'Omar Khaled', 7123: 'Youssef Kamal', 7124: 'Mariam Adel' },
  'crm.team': { 7131: 'Cairo Corporate Sales', 7132: 'Alexandria Branch', 7133: 'Delta Region' },
  'account.payment.term': { 7141: 'Immediate Payment', 7142: '30 Days', 7143: '45 Days End of Month', 7144: '50% Advance, 50% on Delivery' },
  'product.pricelist': { 7151: 'Public Pricelist (EGP)', 7152: 'Hospitals 2026 (EGP)' },
  'account.fiscal.position': { 7161: 'Domestic (Egypt)', 7162: 'Free Zone (VAT exempt)' },
  'crm.tag': { 7171: 'Hospitals', 7172: 'Tender', 7173: 'Repeat customer', 7174: 'Private clinics' },
  'account.incoterms': { 7191: 'EXW Ex Works', 7192: 'FOB Free On Board', 7193: 'CIF Cost, Insurance and Freight', 7194: 'DAP Delivered At Place' },
  'utm.campaign': { 7201: 'Q4 hospital push', 7202: 'ICU upgrade 2026' },
  'utm.medium': { 7211: 'Email', 7212: 'Phone', 7213: 'Trade show' },
  'utm.source': { 7221: 'Cairo Health Expo 2026', 7222: 'Ministry of Health tenders portal', 7223: 'Referral' },
  'sale.order.template': { 7231: 'ICU starter pack', 7232: 'Ward beds, 10 or more' },
  'uom.uom': { 7401: 'Units', 7402: 'Boxes', 7403: 'Days', 7404: 'Hours' },
  'account.tax': { 7411: 'VAT 14%', 7412: 'VAT 0% (exempt)', 7413: 'VAT 14% (purchases)' },
  'product.category': { 7421: 'All / Medical devices', 7422: 'All / Consumables', 7423: 'All / Services' },
  'product.tag': { 7431: 'Best seller', 7432: 'Imported', 7433: 'Needs installation' },
  'account.account': { 7441: '400100 Product Sales', 7442: '400200 Service Revenue', 7443: '500100 Cost of Goods Sold', 7444: '212000 Customer Deposits' },
  'stock.route': { 7451: 'Buy', 7452: 'Replenish on Order (MTO)', 7453: 'Dropship' },
  'product.attribute': { 7471: 'Voltage', 7472: 'Mounting' },
  'product.attribute.value': { 7481: '220 V', 7482: '110 V', 7483: 'Wall mount', 7484: 'Rolling stand' },
  'crm.lead': { 7501: 'Dar El Shifa — ICU monitors renewal', 7502: 'Alexandria Medical Center — maintenance' },
  'tender.opportunity': { 7511: 'Tender 2026/114 — Ministry of Health, ICU equipment' },
  'res.country': { 7491: 'Egypt' },
  'stock.warehouse': { 7495: 'Cairo Main Warehouse' },
};

/** What each attribute value belongs to, and its colour: the values a line's attribute offers. */
const ATTRIBUTE_VALUES: Record<number, { attribute: number; color: number }> = { 7481: { attribute: 7471, color: 1 }, 7482: { attribute: 7471, color: 3 }, 7483: { attribute: 7472, color: 5 }, 7484: { attribute: 7472, color: 7 } };

/** The properties a product's category defines (product_properties_definition): the medical devices', and the services'. */
const DEVICE_PROPERTIES = [{"name": "mdd_class", "label": "Medical device class", "type": "selection", "options": [{"value": "I", "label": "Class I"}, {"value": "IIa", "label": "Class IIa"}, {"value": "IIb", "label": "Class IIb"}, {"value": "III", "label": "Class III"}]}, {"name": "eda_registration", "label": "EDA registration no.", "type": "char"}, {"name": "warranty_months", "label": "Warranty (months)", "type": "integer"}, {"name": "needs_biomedical_signoff", "label": "Biomedical engineer signs the handover", "type": "boolean"}] as PropertyDefinition[];
const CATEGORY_PROPERTIES: Record<number, PropertyDefinition[]> = {
  7421: DEVICE_PROPERTIES,
  7422: DEVICE_PROPERTIES.filter((definition) => definition.name === 'eda_registration'),
  7423: DEVICE_PROPERTIES.filter((definition) => definition.name === 'warranty_months'),
};

/** The tags' colours, Flectra's 1 to 11. */
const TAG_COLORS: Record<number, number> = { 7171: 4, 7172: 2, 7173: 10, 7174: 9 };

/** A link to a record of a model, by its id: what a many2one holds. */
function link(model: string, id: number): RelatedRecord {
  const label =
    NAMES[model]?.[id] ??
    (model === 'res.partner' ? PARTNERS[id]?.name : model.startsWith('product.') ? PRODUCTS[id]?.name : model === 'sale.order' ? (SALE_ORDERS[id]?.['name'] as string | undefined) : undefined);
  if (label === undefined) throw new Error(`sales lane: no ${model} ${id}`);
  return { id, label };
}
const links = (model: string, ...ids: number[]) => ids.map((id) => link(model, id));

const EGP = () => link('res.currency', 7461);
const COMPANY = () => link('res.company', 7001);

interface Partner {
  name: string;
  street?: string;
  vat?: string;
  parent?: number;
  type?: 'contact' | 'invoice' | 'delivery';
  city: string;
  email?: string;
  phone?: string;
  /** Credit limit in EGP, and what is owed already, when the company checks credit. */
  creditLimit?: number;
  owed?: number;
  pricelist?: number;
  term?: number;
  fiscal?: number;
  user?: number;
  team?: number;
}

const PARTNERS: Record<number, Partner> = {
  7101: { name: 'Dar El Shifa Hospital', street: '27 Ramses Street', vat: 'EG 205-118-332', city: 'Abbassia, Cairo', email: 'procurement@darelshifa.example', phone: '+20 2 2683 1100', pricelist: 7152, term: 7142, fiscal: 7161, user: 7121, team: 7131 },
  7102: { name: 'Alexandria Medical Center', street: '14 Victor Emmanuel Square', vat: 'EG 310-442-907', city: 'Smouha, Alexandria', email: 'supply@alexmedcenter.example', phone: '+20 3 425 7700', pricelist: 7152, term: 7143, fiscal: 7161, user: 7122, team: 7132 },
  7103: { name: 'Delta Care Clinics', street: '8 El Bahr Street', vat: 'EG 412-090-516', city: 'Tanta', email: 'admin@deltacare.example', phone: '+20 40 334 2200', pricelist: 7151, term: 7141, fiscal: 7161, user: 7123, team: 7133, creditLimit: 150000, owed: 128400 },
  7104: { name: 'Suez Canal Free Zone Hospital', street: 'Free Zone, Gate 2', city: 'Port Said', email: 'buying@scfzh.example', phone: '+20 66 332 9000', pricelist: 7151, term: 7144, fiscal: 7162, user: 7122, team: 7132 },
  7105: { name: 'Mindray Medical International', city: 'Shenzhen', email: 'export@mindray.example' },
  7106: { name: 'Siemens Healthineers Egypt', city: 'New Cairo', email: 'orders.eg@siemens-healthineers.example' },
  7111: { name: 'Dr. Hany Saleh', parent: 7101, type: 'contact', city: 'Abbassia, Cairo', email: 'hany.saleh@darelshifa.example' },
  7112: { name: 'Dar El Shifa Hospital, Accounts Payable', parent: 7101, type: 'invoice', city: 'Abbassia, Cairo' },
  7113: { name: 'Dar El Shifa Hospital, Central Stores', parent: 7101, type: 'delivery', city: 'Abbassia, Cairo' },
  7114: { name: 'Eng. Rania Mansour', parent: 7102, type: 'contact', city: 'Smouha, Alexandria', email: 'rania.mansour@alexmedcenter.example' },
  7115: { name: 'Dr. Karim Ezzat', parent: 7103, type: 'contact', city: 'Tanta' },
};

interface Product {
  name: string;
  price: number;
  type: 'consu' | 'service' | 'product';
  uom: number;
  taxes: number[];
  description?: string;
  lead?: number;
  saleOk?: boolean;
}

const PRODUCTS: Record<number, Product> = {
  7301: { name: '[PM-12] Patient monitor PM-12', price: 42750, type: 'product', uom: 7401, taxes: [7411], lead: 14, description: '12.1" touch screen: ECG, SpO2, NIBP and temperature. 220 V.' },
  7302: { name: '[IP-200] Infusion pump IP-200', price: 18500, type: 'product', uom: 7401, taxes: [7411], lead: 10, description: 'Volumetric pump, drug library, 8-hour battery.' },
  7303: { name: '[HB-3E] Electric hospital bed, 3 functions', price: 27900, type: 'product', uom: 7401, taxes: [7411], lead: 21, description: 'Back, knee and height by the remote; side rails and castors.' },
  7304: { name: '[GL-100] Nitrile examination gloves, box of 100', price: 185, type: 'product', uom: 7402, taxes: [7411], lead: 2, description: 'Powder free, size M.' },
  7305: { name: 'Installation and training', price: 6500, type: 'service', uom: 7403, taxes: [7411], description: 'On-site installation, and a day of training for the nurses and the biomedical engineers.' },
  7306: { name: 'Annual preventive maintenance', price: 12000, type: 'service', uom: 7401, taxes: [7411], description: 'Two visits a year, parts extra.' },
  7307: { name: 'Down payment', price: 0, type: 'service', uom: 7401, taxes: [7411], saleOk: false },
  7308: { name: '[AED-3] Defibrillator AED-3', price: 64000, type: 'product', uom: 7401, taxes: [7411], lead: 30, description: 'Automated external defibrillator, adult and child pads.' },
};

const TAX_RATES: Record<number, number> = { 7411: 14, 7412: 0, 7413: 14 };
/** What a pricelist takes off the list price, in a hundred. */
const PRICELIST_DISCOUNT: Record<number, number> = { 7151: 0, 7152: 8 };

const round = (n: number) => Math.round(n * 100) / 100;
const num = (value: unknown) => (typeof value === 'number' ? value : Number(value ?? 0) || 0);
const idOf = (value: unknown) => (value && typeof value === 'object' && 'id' in value ? Number((value as RelatedRecord).id) : null);

/** A sales line: an item, priced and taxed as Flectra's compute does. */
function item(key: string, id: number, sequence: number, productId: number, qty: number, options: { discount?: number; price?: number; delivered?: number; invoiced?: number; status?: string; analytic?: Record<string, number> } = {}): Line {
  const p = PRODUCTS[productId];
  const price = options.price ?? p.price;
  return {
    key,
    id,
    values: priced({
      sequence,
      display_type: null,
      product_id: link('product.product', productId),
      name: p.description ? `${p.name}\n${p.description}` : p.name,
      product_uom_qty: qty,
      qty_delivered: options.delivered ?? 0,
      qty_invoiced: options.invoiced ?? 0,
      product_uom: link('uom.uom', p.uom),
      customer_lead: p.lead ?? 0,
      price_unit: price,
      tax_id: links('account.tax', ...p.taxes),
      discount: options.discount ?? 0,
      is_downpayment: false,
      qty_delivered_method: p.type === 'service' ? 'manual' : 'stock_move',
      invoice_status: options.status ?? 'no',
      // Shares by analytic account id, as Flectra's analytic_distribution (the accounting lane's accounts).
      analytic_distribution: options.analytic ?? null,
    }),
  };
}
const section = (key: string, id: number, sequence: number, name: string): Line => ({ key, id, values: { sequence, display_type: 'line_section', name } });
const note = (key: string, id: number, sequence: number, name: string): Line => ({ key, id, values: { sequence, display_type: 'line_note', name } });

/** A line's subtotal, tax and total from its quantity, price, discount and taxes. */
function priced(values: Values): Values {
  const subtotal = round(num(values['product_uom_qty']) * num(values['price_unit']) * (1 - num(values['discount']) / 100));
  const rate = ((values['tax_id'] as RelatedRecord[] | null) ?? []).reduce((sum, tax) => sum + (TAX_RATES[Number(tax.id)] ?? 0), 0);
  const tax = round((subtotal * rate) / 100);
  return { ...values, price_subtotal: subtotal, price_tax: tax, price_total: round(subtotal + tax) };
}

/** An order's totals from its lines. */
function totals(lines: Line[], amountInvoiced = 0): Values {
  const items = lines.filter((line) => !line.values['display_type']);
  const untaxed = round(items.reduce((sum, line) => sum + num(line.values['price_subtotal']), 0));
  const tax = round(items.reduce((sum, line) => sum + num(line.values['price_tax']), 0));
  const total = round(untaxed + tax);
  return { amount_untaxed: untaxed, amount_tax: tax, amount_total: total, amount_to_invoice: round(Math.max(0, total - amountInvoiced)), tax_totals: taxTotals(items, untaxed, total) };
}

/** Flectra's tax_totals, as the tax-totals widget reads it: the untaxed amount, a row per tax group, the total. */
function taxTotals(items: Line[], untaxed: number, total: number): Values {
  const byGroup = new Map<string, number>();
  for (const line of items) {
    const taxes = (line.values['tax_id'] as RelatedRecord[] | null) ?? [];
    const base = num(line.values['price_subtotal']);
    for (const tax of taxes) byGroup.set(tax.label, round((byGroup.get(tax.label) ?? 0) + (base * (TAX_RATES[Number(tax.id)] ?? 0)) / 100));
  }
  return { untaxed, groups: [...byGroup].map(([name, amount]) => ({ name, amount })), total };
}

const QUOTATION_LINES: Line[] = [
  section('q1', 710101, 10, 'ICU monitoring'),
  item('q2', 710102, 20, 7301, 4, { analytic: { '4101': 70, '4102': 30 } }),
  item('q3', 710103, 30, 7302, 6, { discount: 5, analytic: { '4101': 100 } }),
  section('q4', 710104, 40, 'Services'),
  item('q5', 710105, 50, 7305, 2),
  note('q6', 710106, 60, 'Delivered to the 3rd-floor ICU by the service lift.\nThe hospital’s biomedical engineer signs the handover.'),
];

const CONFIRMED_LINES: Line[] = [
  item('c1', 710201, 10, 7303, 10, { delivered: 6, status: 'to invoice' }),
  item('c2', 710202, 20, 7304, 200, { delivered: 200, status: 'to invoice' }),
  item('c3', 710203, 30, 7305, 1, { status: 'to invoice' }),
];

const option = (key: string, id: number, sequence: number, productId: number, quantity: number): Line => ({
  key,
  id,
  values: {
    sequence,
    product_id: link('product.product', productId),
    name: PRODUCTS[productId].name,
    quantity,
    uom_id: link('uom.uom', PRODUCTS[productId].uom),
    price_unit: PRODUCTS[productId].price,
    discount: 0,
    is_present: false,
  },
});

const header = (partnerId: number, invoiceId: number, shippingId: number): Values => {
  const partner = PARTNERS[partnerId];
  return {
    partner_id: link('res.partner', partnerId),
    partner_invoice_id: link('res.partner', invoiceId),
    partner_shipping_id: link('res.partner', shippingId),
    pricelist_id: partner.pricelist ? link('product.pricelist', partner.pricelist) : null,
    payment_term_id: partner.term ? link('account.payment.term', partner.term) : null,
    fiscal_position_id: partner.fiscal ? link('account.fiscal.position', partner.fiscal) : null,
    user_id: partner.user ? link('res.users', partner.user) : null,
    team_id: partner.team ? link('crm.team', partner.team) : null,
    currency_id: EGP(),
    company_id: COMPANY(),
    has_active_pricelist: true,
    show_update_pricelist: false,
    show_update_fpos: false,
    tax_calculation_rounding_method: 'round_per_line',
    tax_country_id: link('res.country', 7491),
    warehouse_id: link('stock.warehouse', 7495),
    analytic_account_id: null,
    journal_id: null,
    authorized_transaction_ids: [],
    locked: false,
  };
};

const SALE_ORDERS: Record<number, Values> = {
  // A quotation, not sent yet: Send by Email and Confirm move it along.
  7101: {
    name: 'S00071',
    state: 'draft',
    ...header(7101, 7112, 7113),
    sale_order_template_id: null,
    validity_date: '2026-11-05',
    date_order: '2026-10-06T09:30',
    order_line: QUOTATION_LINES,
    sale_order_option_ids: [option('o1', 710111, 10, 7308, 1), option('o2', 710112, 20, 7306, 1)],
    note: '<p>Prices include delivery inside Greater Cairo. Warranty: 24 months on devices, parts and labour.</p>',
    ...totals(QUOTATION_LINES),
    amount_invoiced: 0,
    invoice_status: 'no',
    invoice_count: 0,
    delivery_count: 0,
    partner_credit_warning: '',
    require_signature: true,
    require_payment: true,
    prepayment_percent: 0.3,
    reference: null,
    client_order_ref: 'DSH-PO-2026-0412',
    tag_ids: links('crm.tag', 7171, 7172),
    incoterm: link('account.incoterms', 7194),
    incoterm_location: 'Abbassia, Cairo',
    picking_policy: 'one',
    commitment_date: null,
    expected_date: '2026-10-27T09:30',
    effective_date: null,
    delivery_status: null,
    origin: 'Tender 2026/114',
    campaign_id: link('utm.campaign', 7202),
    medium_id: link('utm.medium', 7211),
    source_id: link('utm.source', 7222),
  },
  // A confirmed order, partly delivered, with a down payment invoiced: Create Invoice opens the dialog.
  7102: {
    name: 'S00068',
    state: 'sale',
    ...header(7102, 7102, 7102),
    validity_date: '2026-10-15',
    date_order: '2026-09-21T11:05',
    order_line: CONFIRMED_LINES,
    sale_order_option_ids: [],
    note: '<p>Beds delivered in two lots. Gloves from stock.</p>',
    ...totals(CONFIRMED_LINES, 30000),
    amount_invoiced: 30000,
    invoice_status: 'to invoice',
    invoice_count: 1,
    delivery_count: 1,
    partner_credit_warning: '',
    require_signature: false,
    require_payment: false,
    prepayment_percent: 1,
    // Signed on the portal before it was confirmed: the Customer Signature tab, in developer mode.
    signed_by: 'Eng. Rania Mansour',
    signed_on: '2026-09-21T10:48',
    signature: null,
    reference: 'S00068',
    client_order_ref: 'AMC/SUP/2026/337',
    tag_ids: links('crm.tag', 7171, 7173),
    incoterm: link('account.incoterms', 7194),
    incoterm_location: 'Smouha, Alexandria',
    picking_policy: 'direct',
    commitment_date: '2026-10-10T10:00',
    expected_date: '2026-10-12T11:05',
    effective_date: '2026-10-01T14:20',
    delivery_status: 'partial',
    origin: null,
    campaign_id: link('utm.campaign', 7201),
    medium_id: link('utm.medium', 7212),
    source_id: link('utm.source', 7223),
  },
};

/** The lines and options a quotation template brings. */
const TEMPLATES: Record<number, { lines: () => Line[]; options: () => Line[]; note: string }> = {
  7231: {
    lines: () => [section('t1', 0, 10, 'ICU monitoring'), item('t2', 0, 20, 7301, 2), item('t3', 0, 30, 7302, 4), section('t4', 0, 40, 'Services'), item('t5', 0, 50, 7305, 1)],
    options: () => [option('t6', 0, 10, 7308, 1), option('t7', 0, 20, 7306, 1)],
    note: '<p>ICU starter pack: two bedside monitors, four pumps, installation and a day of training.</p>',
  },
  7232: {
    lines: () => [item('t1', 0, 10, 7303, 10), item('t2', 0, 20, 7305, 1)],
    options: () => [option('t3', 0, 10, 7306, 1)],
    note: '<p>Ward beds, ten or more: 8% off the list price from ten beds.</p>',
  },
};
// Lines a template brings are new: no id, and keys of their own each time.
let templateRun = 0;
const fresh = (lines: Line[]) => {
  templateRun += 1;
  return lines.map(({ id: _id, ...line }) => ({ ...line, key: `${line.key}-${templateRun}` }));
};

// ---------------------------------------------------------------------------
// The server's rules for a sales order: what Flectra's onchange and compute do.
// ---------------------------------------------------------------------------

/** The product each line had when last seen, by line key: a new product reprices the line, an edit of the price keeps it. */
const lineProducts = new Map<string, number | null>();

function pricedFor(productId: number, pricelist: number | null) {
  const off = pricelist ? (PRICELIST_DISCOUNT[pricelist] ?? 0) : 0;
  return round(PRODUCTS[productId].price * (1 - off / 100));
}

/** Free Zone: VAT 14% becomes VAT 0%, as the fiscal position maps it. */
function mappedTaxes(taxes: number[], fiscal: number | null) {
  return fiscal === 7162 ? taxes.map((tax) => (tax === 7411 ? 7412 : tax)) : taxes;
}

/** Order lines: a product picked brings its description, unit, taxes, lead time and price; every line is priced; the order gets its totals. */
function recalculateLines(values: Values): Values {
  const pricelist = idOf(values['pricelist_id']);
  const fiscal = idOf(values['fiscal_position_id']);
  const lines = ((values['order_line'] as Line[] | null) ?? []).map((line) => {
    if (line.values['display_type']) return line;
    const v = { ...line.values };
    const productId = idOf(v['product_id']);
    const before = lineProducts.has(line.key) ? lineProducts.get(line.key) : line.id !== undefined ? productId : null;
    lineProducts.set(line.key, productId);
    if (productId && productId !== before && PRODUCTS[productId]) {
      const p = PRODUCTS[productId];
      v['name'] = p.description ? `${p.name}\n${p.description}` : p.name;
      v['price_unit'] = pricedFor(productId, pricelist);
      v['product_uom'] = link('uom.uom', p.uom);
      v['tax_id'] = links('account.tax', ...mappedTaxes(p.taxes, fiscal));
      v['customer_lead'] = p.lead ?? 0;
      v['qty_delivered_method'] = p.type === 'service' ? 'manual' : 'stock_move';
      if (v['product_uom_qty'] == null || v['product_uom_qty'] === 0) v['product_uom_qty'] = 1;
    }
    return { ...line, values: priced(v) };
  });
  return { order_line: lines, ...totals(lines, num(values['amount_invoiced'])) };
}

function creditWarning(partnerId: number | null, amountTotal: number): string {
  const partner = partnerId ? PARTNERS[partnerId] : undefined;
  if (!partner?.creditLimit) return '';
  const due = (partner.owed ?? 0) + amountTotal;
  if (due <= partner.creditLimit) return '';
  const egp = (n: number) => `E£ ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return `${partner.name} has reached its credit limit of: ${egp(partner.creditLimit)}\nTotal amount due (including this document): ${egp(due)}`;
}

/** A customer picked: their invoice and delivery addresses, pricelist, payment terms, fiscal position, salesperson and team; and the credit check. */
function partnerChanged(values: Values): Values {
  const partnerId = idOf(values['partner_id']);
  if (!partnerId) return { partner_invoice_id: null, partner_shipping_id: null, partner_credit_warning: '' };
  const partner = PARTNERS[partnerId] ?? { name: '', city: '' };
  const childOfType = (type: Partner['type']) => Object.entries(PARTNERS).find(([, p]) => p.parent === partnerId && p.type === type)?.[0];
  const invoice = Number(childOfType('invoice') ?? partnerId);
  const shipping = Number(childOfType('delivery') ?? partnerId);
  return {
    partner_invoice_id: link('res.partner', invoice),
    partner_shipping_id: link('res.partner', shipping),
    ...(partner.pricelist ? { pricelist_id: link('product.pricelist', partner.pricelist), show_update_pricelist: idOf(values['pricelist_id']) !== partner.pricelist && hasItems(values) } : {}),
    ...(partner.term ? { payment_term_id: link('account.payment.term', partner.term) } : {}),
    ...(partner.fiscal ? { fiscal_position_id: link('account.fiscal.position', partner.fiscal), show_update_fpos: idOf(values['fiscal_position_id']) !== partner.fiscal && hasItems(values) } : {}),
    ...(partner.user ? { user_id: link('res.users', partner.user) } : {}),
    ...(partner.team ? { team_id: link('crm.team', partner.team) } : {}),
    partner_credit_warning: ['draft', 'sent'].includes(String(values['state'])) ? creditWarning(partnerId, num(values['amount_total'])) : '',
  };
}

const hasItems = (values: Values) => ((values['order_line'] as Line[] | null) ?? []).some((line) => !line.values['display_type']);

/** A quotation template picked: its lines, its optional products and its terms, the lines priced. */
function templateChanged(values: Values): Values {
  const template = TEMPLATES[idOf(values['sale_order_template_id']) ?? 0];
  if (!template) return {};
  const lines = fresh(template.lines());
  return { ...recalculateLines({ ...values, order_line: lines }), sale_order_option_ids: fresh(template.options()), note: template.note };
}

// ---------------------------------------------------------------------------
// Products.
// ---------------------------------------------------------------------------

/** A monitor, drawn: the product's picture. */
const MONITOR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><rect width="256" height="256" rx="24" fill="#eef4f8"/><rect x="40" y="52" width="176" height="124" rx="10" fill="#1f2d3d"/><rect x="52" y="64" width="152" height="100" rx="4" fill="#0d1620"/><polyline points="58,118 84,118 92,96 102,140 112,82 122,118 150,118 158,104 166,118 198,118" fill="none" stroke="#3ddc84" stroke-width="3"/><text x="64" y="84" font-family="sans-serif" font-size="13" fill="#59c3ff">HR 72</text><text x="150" y="152" font-family="sans-serif" font-size="12" fill="#ffd166">SpO2 98</text><rect x="112" y="176" width="32" height="22" fill="#90a4b4"/><rect x="80" y="196" width="96" height="10" rx="5" fill="#90a4b4"/></svg>';

function picture(svg: string, name: string) {
  return { name, type: 'image/svg+xml', size: svg.length, data: btoa(svg) };
}

function taxString(values: Values): string {
  const rate = ((values['taxes_id'] as RelatedRecord[] | null) ?? []).reduce((sum, tax) => sum + (TAX_RATES[Number(tax.id)] ?? 0), 0);
  if (!rate) return '';
  const total = num(values['list_price']) * (1 + rate / 100);
  const currency = (values['currency_id'] as RelatedRecord | null)?.label ?? 'EGP';
  return `(= ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency} Incl. Taxes)`;
}

const PRODUCT_TEMPLATES: Record<number, Values> = {
  7301: {
    name: 'Patient monitor PM-12',
    priority: '1',
    image_1920: picture(MONITOR_SVG, 'pm-12.svg'),
    active: true,
    sale_ok: true,
    purchase_ok: true,
    product_variant_count: 1,
    is_product_variant: false,
    valid_product_template_attribute_line_ids: [],
    company_id: null,
    variant_seller_ids: [],
    packaging_ids: [],
    weight_uom_name: 'kg',
    volume_uom_name: 'm³',
    property_stock_production: null,
    property_stock_inventory: null,
    description_picking: null,
    nbr_putaway_rules: 0,
    storage_category_capacity_count: 0,
    detailed_type: 'product',
    invoice_policy: 'delivery',
    visible_expense_policy: false,
    expense_policy: 'no',
    uom_id: link('uom.uom', 7401),
    uom_po_id: link('uom.uom', 7401),
    uom_name: 'Units',
    currency_id: EGP(),
    cost_currency_id: link('res.currency', 7462),
    list_price: 42750,
    taxes_id: links('account.tax', 7411),
    tax_string: '(= 48,735.00 EGP Incl. Taxes)',
    standard_price: 1890,
    categ_id: link('product.category', 7421),
    default_code: 'PM-12',
    barcode: '6224007301012',
    product_tag_ids: links('product.tag', 7431, 7432, 7433),
    product_properties: { mdd_class: 'IIb', eda_registration: 'EDA-MD-2025-11873', warranty_months: 24, needs_biomedical_signoff: true },
    description: '<p>Imported from Shenzhen in lots of 40. Keep two in Cairo stock for demonstrations.</p>',
    attribute_line_ids: [
      { key: 'a1', id: 730101, values: { sequence: 10, attribute_id: link('product.attribute', 7471), value_ids: [{ ...link('product.attribute.value', 7481), color: ATTRIBUTE_VALUES[7481].color }], value_count: 1 } },
      { key: 'a2', id: 730102, values: { sequence: 20, attribute_id: link('product.attribute', 7472), value_ids: [{ ...link('product.attribute.value', 7484), color: ATTRIBUTE_VALUES[7484].color }], value_count: 1 } },
    ],
    description_sale: '12.1" touch screen: ECG, SpO2, NIBP and temperature. 220 V.',
    sale_line_warn: 'warning',
    sale_line_warn_msg: 'Confirm the ward’s 220 V outlets before quoting a wall mount.',
    seller_ids: [
      { key: 's1', id: 730111, values: { sequence: 1, partner_id: link('res.partner', 7105), product_code: 'MR-PM12-EU', min_qty: 10, price: 1890, currency_id: link('res.currency', 7462), delay: 45 } },
      { key: 's2', id: 730112, values: { sequence: 2, partner_id: link('res.partner', 7106), product_code: null, min_qty: 1, price: 2240, currency_id: link('res.currency', 7463), delay: 14 } },
    ],
    supplier_taxes_id: links('account.tax', 7413),
    purchase_method: 'receive',
    description_purchase: 'EU plug kit and the English/Arabic quick guide in every box.',
    purchase_line_warn: 'no-message',
    purchase_line_warn_msg: null,
    has_available_route_ids: true,
    route_ids: links('stock.route', 7451),
    route_from_categ_ids: [],
    responsible_id: link('res.users', 7124),
    weight: 6.4,
    volume: 0.042,
    sale_delay: 14,
    tracking: 'serial',
    description_pickingin: 'Shelf B-3. Check every serial number against the packing list.',
    description_pickingout: 'Fragile: ship upright, in the original box.',
    property_account_income_id: link('account.account', 7441),
    property_account_expense_id: link('account.account', 7443),
    pricelist_item_count: 2,
    product_document_count: 3,
    sales_count: 38,
    purchased_product_qty: 40,
    qty_available: 12,
    virtual_available: 8,
    nbr_moves_in: 5,
    nbr_moves_out: 9,
    nbr_reordering_rules: 1,
    reordering_min_qty: 4,
    reordering_max_qty: 15,
  },
  7305: {
    name: 'Installation and training',
    priority: '0',
    image_1920: null,
    active: true,
    sale_ok: true,
    purchase_ok: false,
    product_variant_count: 1,
    is_product_variant: false,
    valid_product_template_attribute_line_ids: [],
    company_id: null,
    variant_seller_ids: [],
    packaging_ids: [],
    weight_uom_name: 'kg',
    volume_uom_name: 'm³',
    nbr_putaway_rules: 0,
    storage_category_capacity_count: 0,
    detailed_type: 'service',
    invoice_policy: 'order',
    visible_expense_policy: false,
    expense_policy: 'no',
    uom_id: link('uom.uom', 7403),
    uom_po_id: link('uom.uom', 7403),
    uom_name: 'Days',
    currency_id: EGP(),
    cost_currency_id: EGP(),
    list_price: 6500,
    taxes_id: links('account.tax', 7411),
    tax_string: '(= 7,410.00 EGP Incl. Taxes)',
    standard_price: 2800,
    categ_id: link('product.category', 7423),
    default_code: 'SRV-INST',
    barcode: null,
    product_tag_ids: links('product.tag', 7433),
    product_properties: { warranty_months: 0 },
    description: null,
    attribute_line_ids: [],
    description_sale: 'On-site installation, and a day of training for the nurses and the biomedical engineers.',
    sale_line_warn: 'no-message',
    seller_ids: [],
    supplier_taxes_id: [],
    purchase_method: 'purchase',
    purchase_line_warn: 'no-message',
    has_available_route_ids: true,
    route_ids: [],
    route_from_categ_ids: [],
    tracking: 'none',
    property_account_income_id: link('account.account', 7442),
    property_account_expense_id: null,
    pricelist_item_count: 0,
    product_document_count: 1,
    sales_count: 61,
    purchased_product_qty: 0,
    qty_available: 0,
    virtual_available: 0,
    nbr_moves_in: 0,
    nbr_moves_out: 0,
    nbr_reordering_rules: 0,
  },
};

// ---------------------------------------------------------------------------
// The Create invoices dialog, and the contracts.
// ---------------------------------------------------------------------------

const INVOICE_WIZARDS: Record<number, Values> = {
  // From S00068: one order, a draft invoice already there, a down payment already invoiced.
  7701: {
    sale_order_ids: links('sale.order', 7102),
    count: 1,
    consolidated_billing: true,
    advance_payment_method: 'delivered',
    company_id: COMPANY(),
    product_id: link('product.product', 7307),
    currency_id: EGP(),
    orders_amount_total: 367650,
    fixed_amount: 0,
    amount: 0,
    deposit_account_id: null,
    amount_invoiced: 30000,
    amount_to_invoice: 337650,
    display_draft_invoice_warning: true,
    has_down_payments: true,
  },
  // From the list of orders, three chosen: one invoice for each customer, or one for all.
  7702: {
    sale_order_ids: links('sale.order', 7101, 7102),
    count: 3,
    consolidated_billing: true,
    advance_payment_method: 'delivered',
    company_id: null,
    product_id: null,
    currency_id: null,
    display_draft_invoice_warning: false,
    has_down_payments: false,
  },
};

const milestone = (key: string, id: number, sequence: number, name: string, due: string, amount: number, responsible: number, state: string, daysUntilDue = 0): Line => ({
  key,
  id,
  values: { sequence, name, due_date: due, days_until_due: daysUntilDue, amount, responsible_id: link('res.users', responsible), state },
});

const CONTRACTS: Record<number, Values> = {
  // A framework agreement still in draft: Activate makes it active; its Price Escalation tab shows.
  7601: {
    name: 'Patient monitor supply framework 2026–2028',
    contract_number: 'CON/2026/0007',
    state: 'draft',
    company_id: COMPANY(),
    currency_id: EGP(),
    partner_id: link('res.partner', 7101),
    partner_contact_id: link('res.partner', 7111),
    contract_type: 'framework',
    user_id: link('res.users', 7122),
    start_date: '2026-11-01',
    end_date: '2028-10-31',
    duration_months: 24,
    days_until_expiry: 0,
    contract_value: 2400000,
    notice_period_days: 60,
    tender_id: link('tender.opportunity', 7511),
    opportunity_id: link('crm.lead', 7501),
    invoice_count: 0,
    document_count: 2,
    milestone_ids: [
      milestone('m1', 760101, 10, 'Lot 1: 20 monitors delivered and installed', '2026-12-15', 600000, 7123, 'in_progress', 70),
      milestone('m2', 760102, 20, 'Lot 2: 20 monitors', '2027-04-15', 600000, 7123, 'pending', 191),
      milestone('m3', 760103, 30, 'Lot 3: 20 monitors', '2027-10-15', 600000, 7123, 'pending', 374),
      milestone('m4', 760104, 40, 'Lot 4: 20 monitors and the central station', '2028-04-15', 600000, 7123, 'pending', 557),
    ],
    has_escalation: true,
    escalation_type: 'fixed',
    escalation_rate: 7.5,
    escalation_formula: null,
    next_escalation_date: '2027-11-01',
    sla_target: 0,
    sla_actual: 0,
    penalty_amount: 0,
    amendment_ids: [],
    contract_scope: '<p>Supply of 80 PM-12 patient monitors in four lots, with a central monitoring station for the ICU, installation and training.</p><ul><li>Lots delivered to Central Stores, Abbassia</li><li>Training for every ICU shift</li></ul>',
    contract_terms: '<p>Prices fixed for the first twelve months, then escalated by 7.5% a year. Payment 30 days from each lot’s handover.</p>',
    termination_date: null,
    termination_reason: null,
  },
  // A service level agreement, active, expiring at the year's end: Terminate and Renew open their dialogs.
  7602: {
    name: 'ICU equipment maintenance SLA — Alexandria Medical Center',
    contract_number: 'CON/2026/0004',
    state: 'active',
    company_id: COMPANY(),
    currency_id: EGP(),
    partner_id: link('res.partner', 7102),
    partner_contact_id: link('res.partner', 7114),
    contract_type: 'sla',
    user_id: link('res.users', 7121),
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    duration_months: 12,
    days_until_expiry: 86,
    contract_value: 480000,
    notice_period_days: 30,
    tender_id: null,
    opportunity_id: link('crm.lead', 7502),
    invoice_count: 2,
    document_count: 3,
    milestone_ids: [
      milestone('n1', 760201, 10, 'Q1 preventive maintenance visit', '2026-03-31', 120000, 7123, 'paid'),
      milestone('n2', 760202, 20, 'Q2 preventive maintenance visit', '2026-06-30', 120000, 7123, 'invoiced'),
      milestone('n3', 760203, 30, 'Q3 preventive maintenance visit', '2026-09-30', 120000, 7123, 'completed'),
      milestone('n4', 760204, 40, 'Q4 preventive maintenance visit', '2026-12-20', 120000, 7124, 'in_progress', 75),
    ],
    has_escalation: false,
    escalation_type: 'fixed',
    escalation_rate: 0,
    next_escalation_date: null,
    sla_target: 98,
    sla_actual: 96.5,
    penalty_amount: 15000,
    amendment_ids: [
      { key: 'd1', id: 760211, values: { amendment_number: 'AMD/2026/0001', name: 'Two dialysis units added to the scope', amendment_type: 'scope_change', amendment_date: '2026-05-12', value_change: 60000, state: 'approved' } },
      { key: 'd2', id: 760212, values: { amendment_number: 'AMD/2026/0003', name: 'Response time to 4 hours on weekends', amendment_type: 'terms_modification', amendment_date: '2026-09-02', value_change: 0, state: 'pending_approval' } },
    ],
    contract_scope: '<p>Preventive maintenance of 46 ICU devices four times a year, and corrective visits within 8 working hours.</p>',
    contract_terms: '<p>A penalty of EGP 7,500 for each breach of the response time. Either party may end it with 30 days’ notice.</p>',
    termination_date: null,
    termination_reason: null,
  },
};

/** Whole months between two days, as Flectra's contracts count them: the days over 30. */
function monthsBetween(start: unknown, end: unknown): number {
  if (typeof start !== 'string' || typeof end !== 'string' || !start || !end) return 0;
  const days = Math.round((Date.parse(end) - Date.parse(start)) / 86400000);
  return Math.floor(days / 30);
}
/** Days from today to a day. */
function daysFromToday(day: unknown): number {
  if (typeof day !== 'string' || !day) return 0;
  const today = new Date();
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.parse(day) - start) / 86400000);
}
const addDays = (day: string, days: number) => new Date(Date.parse(day) + days * 86400000).toISOString().slice(0, 10);
function addMonths(day: string, months: number) {
  const d = new Date(Date.parse(day));
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Renewed with escalation: the current value raised by the rate, as the renewal dialog's onchange does. */
function escalated(values: Values): Values {
  if (!values['apply_escalation'] || !num(values['escalation_rate'])) return {};
  return { new_value: round(num(values['contract_value']) * (1 + num(values['escalation_rate']) / 100)) };
}

function contractDates(values: Values): Values {
  return {
    duration_months: monthsBetween(values['start_date'], values['end_date']),
    days_until_expiry: values['state'] === 'active' && values['end_date'] ? daysFromToday(values['end_date']) : 0,
  };
}

// ---------------------------------------------------------------------------
// The app's answers to the pages' actions.
// ---------------------------------------------------------------------------

/** The invoice the Create invoices dialog made last, as the server would know it. */
let lastInvoice: { method: string; amount: number; number: string } | null = null;
let invoiceNumber = 117;
const egp = (n: number) => `E£${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const nowStamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/** Which of this lane's pages a call comes from, by the values only that page has. */
function pageOf(values: Values): 'order' | 'wizard' | 'product' | 'contract' | 'termination' | 'renewal' | null {
  if ('order_line' in values) return 'order';
  if ('advance_payment_method' in values) return 'wizard';
  if ('detailed_type' in values) return 'product';
  if ('contract_type' in values) return 'contract';
  if ('notify_customer' in values) return 'termination';
  if ('keep_terms' in values) return 'renewal';
  return null;
}

function saleOrderAction(request: ActionRequest): ActionResult | undefined {
  const { action, values } = request;
  const name = String(values['name'] ?? '');
  const customer = (values['partner_id'] as RelatedRecord | null)?.label ?? 'the customer';
  switch (action) {
    case 'action_confirm': {
      if (values['state'] === 'cancel') return { stop: `The following orders are not in a state requiring confirmation: ${name}` };
      const lines = (values['order_line'] as Line[] | null) ?? [];
      const services = lines.some((line) => PRODUCTS[idOf(line.values['product_id']) ?? 0]?.type === 'service');
      const goods = lines.some((line) => ['product', 'consu'].includes(PRODUCTS[idOf(line.values['product_id']) ?? 0]?.type ?? ''));
      return {
        values: {
          state: 'sale',
          date_order: nowStamp(),
          invoice_status: services ? 'to invoice' : 'no',
          delivery_count: goods ? 1 : 0,
          delivery_status: goods ? 'pending' : null,
          partner_credit_warning: '',
        },
        say: { message: `${name} confirmed: a sales order now${goods ? ', and its delivery order is ready' : ''}.`, tone: 'success' },
      };
    }
    case 'action_quotation_send':
      return {
        values: values['state'] === 'draft' ? { state: 'sent' } : {},
        say: { message: `${values['state'] === 'sale' ? 'Order confirmation' : 'Quotation'} ${name} emailed to ${customer}.`, tone: 'success' },
      };
    case 'action_quotation_send_proforma':
      return { say: { message: `PRO-FORMA invoice for ${name} emailed to ${customer}.`, tone: 'success' } };
    case 'button_add_to_order': {
      // The optional product becomes an order line, at its own price and discount; the option is then on the quotation.
      const line = request.line;
      if (!line) return undefined;
      const productId = idOf(line.values['product_id']);
      const p = productId ? PRODUCTS[productId] : undefined;
      if (!p || !productId) return { stop: 'Pick a product first.' };
      const lines = (values['order_line'] as Line[] | null) ?? [];
      const last = Math.max(0, ...lines.map((l) => num(l.values['sequence'])));
      lineProducts.set(`opt-${line.key}`, productId);
      const added: Line = {
        key: `opt-${line.key}`,
        values: priced({
          sequence: last + 10,
          display_type: null,
          product_id: link('product.product', productId),
          name: String(line.values['name'] ?? p.name),
          product_uom_qty: num(line.values['quantity']) || 1,
          qty_delivered: 0,
          qty_invoiced: 0,
          product_uom: link('uom.uom', p.uom),
          customer_lead: p.lead ?? 0,
          price_unit: num(line.values['price_unit']),
          tax_id: links('account.tax', ...mappedTaxes(p.taxes, idOf(values['fiscal_position_id']))),
          discount: num(line.values['discount']),
          is_downpayment: false,
          qty_delivered_method: p.type === 'service' ? 'manual' : 'stock_move',
          invoice_status: 'no',
        }),
      };
      const orderLines = [...lines, added];
      const options = ((values['sale_order_option_ids'] as Line[] | null) ?? []).map((o) => (o.key === line.key ? { ...o, values: { ...o.values, is_present: true } } : o));
      return { values: { order_line: orderLines, sale_order_option_ids: options, ...totals(orderLines, num(values['amount_invoiced'])) } };
    }
    case 'payment_action_capture':
      return { values: { authorized_transaction_ids: [] }, say: { message: 'Transaction captured.', tone: 'success' } };
    case 'payment_action_void':
      return { values: { authorized_transaction_ids: [] }, say: { message: 'Transaction voided.', tone: 'info' } };
    case 'action_preview_sale_order':
      return { say: { message: `The customer’s page for ${name} opens on the portal: /my/orders/${name}`, tone: 'info' } };
    case 'action_view_invoice':
      return { say: { message: `${values['invoice_count']} invoice(s) of ${name}: Invoicing › Customers › Invoices.`, tone: 'info' } };
    case 'action_view_delivery':
      return { say: { message: `${values['delivery_count']} delivery order(s) of ${name}: Inventory › Transfers.`, tone: 'info' } };
    case 'action_add_from_catalog':
      return { say: { message: 'The product catalogue opens here in Flectra: a grid of products to add with + and −.', tone: 'info' } };
    case 'action_open_discount_wizard':
      return { say: { message: 'The Discount dialog opens here in Flectra: a discount on every line, a global discount, or a fixed amount.', tone: 'info' } };
    case 'action_update_prices': {
      const pricelist = idOf(values['pricelist_id']);
      const lines = ((values['order_line'] as Line[] | null) ?? []).map((line) => {
        const productId = idOf(line.values['product_id']);
        if (line.values['display_type'] || !productId || !PRODUCTS[productId]) return line;
        return { ...line, values: priced({ ...line.values, price_unit: pricedFor(productId, pricelist) }) };
      });
      return { values: { order_line: lines, ...totals(lines, num(values['amount_invoiced'])), show_update_pricelist: false }, say: { message: 'Product prices have been recomputed according to the pricelist.', tone: 'success' } };
    }
    case 'action_update_taxes': {
      const fiscal = idOf(values['fiscal_position_id']);
      const lines = ((values['order_line'] as Line[] | null) ?? []).map((line) => {
        const productId = idOf(line.values['product_id']);
        if (line.values['display_type'] || !productId || !PRODUCTS[productId]) return line;
        return { ...line, values: priced({ ...line.values, tax_id: links('account.tax', ...mappedTaxes(PRODUCTS[productId].taxes, fiscal)) }) };
      });
      return { values: { order_line: lines, ...totals(lines, num(values['amount_invoiced'])), show_update_fpos: false }, say: { message: 'Product taxes have been recomputed according to the fiscal position.', tone: 'success' } };
    }
    case 'sale_invoice_created': {
      if (!lastInvoice) return {};
      const made = lastInvoice;
      lastInvoice = null;
      const invoiced = made.method === 'delivered' ? num(values['amount_total']) : num(values['amount_invoiced']) + made.amount;
      return {
        values: {
          invoice_count: num(values['invoice_count']) + 1,
          amount_invoiced: round(invoiced),
          amount_to_invoice: round(Math.max(0, num(values['amount_total']) - invoiced)),
          ...(made.method === 'delivered' ? { invoice_status: 'invoiced' } : { order_line: withDownPayment((values['order_line'] as Line[] | null) ?? [], made) }),
        },
      };
    }
  }
  return undefined;
}

/**
 * A down payment invoiced: the order gets a Down Payments section and a line
 * for it, as Flectra's _prepare_down_payment_section_line does — nothing
 * ordered, the amount as its price. Saved lines, so the onchange never
 * prices them again.
 */
let downPaymentId = 719000;
function withDownPayment(lines: Line[], made: { amount: number; number: string }): Line[] {
  const last = Math.max(0, ...lines.map((line) => num(line.values['sequence'])));
  const hasSection = lines.some((line) => line.values['display_type'] === 'line_section' && line.values['name'] === 'Down Payments');
  const added: Line[] = [];
  if (!hasSection) added.push(section(`dp-section-${++downPaymentId}`, downPaymentId, last + 10, 'Down Payments'));
  downPaymentId += 1;
  added.push({
    key: `dp-${downPaymentId}`,
    id: downPaymentId,
    values: priced({
      sequence: last + 20,
      display_type: null,
      product_id: link('product.product', 7307),
      name: `Down Payment (Draft) ${made.number}`,
      product_uom_qty: 0,
      qty_delivered: 0,
      qty_invoiced: 1,
      product_uom: link('uom.uom', 7401),
      customer_lead: 0,
      price_unit: made.amount,
      tax_id: [],
      discount: 0,
      is_downpayment: true,
      qty_delivered_method: 'manual',
      invoice_status: 'no',
    }),
  });
  return [...lines, ...added];
}

function invoiceWizardAction({ action, values }: ActionRequest): ActionResult | undefined {
  switch (action) {
    case 'sale_advance_defaults':
      // The company's down payment product, as Flectra's compute finds it once one order is invoiced.
      return values['count'] === 1 ? { values: { product_id: link('product.product', 7307), company_id: COMPANY() } } : {};
    case 'view_draft_invoices':
      return { say: { message: 'Draft invoices of this order: Invoicing › Customers › Invoices, filtered on Draft.', tone: 'info' } };
    case 'create_invoices': {
      const method = String(values['advance_payment_method']);
      const amount = method === 'percentage' ? round((num(values['amount']) / 100) * num(values['orders_amount_total'])) : method === 'fixed' ? num(values['fixed_amount']) : num(values['amount_to_invoice']);
      if (method !== 'delivered' && amount <= 0) return { stop: 'The value of the down payment amount must be positive.' };
      // Said from the dialog: its words outlive it, over the order.
      invoiceNumber += 1;
      lastInvoice = { method, amount, number: `INV/2026/00${invoiceNumber}` };
      const what = method === 'delivered' ? 'Draft invoice' : 'Draft down payment invoice';
      return { say: { message: `${what} ${lastInvoice.number} created${amount ? ` for ${egp(amount)}` : ''}.`, tone: 'success' } };
    }
  }
  return undefined;
}

function productAction({ action, values }: ActionRequest): ActionResult | undefined {
  const name = String(values['name'] ?? 'this product');
  const said: Record<string, string> = {
    action_update_quantity_on_hand: `The stock of ${name} opens here in Flectra, to count it again: ${num(values['qty_available'])} on hand.`,
    action_product_replenish: `The Replenish dialog opens here in Flectra: how many of ${name}, by when, and by which route.`,
    action_open_label_layout: `The label dialog opens here in Flectra: how many labels of ${name}, and their format.`,
    open_pricelist_rules: `${num(values['pricelist_item_count'])} price rule(s) for ${name}: Sales › Products › Pricelists.`,
    action_open_documents: `${num(values['product_document_count'])} document(s) of ${name}: datasheets and certificates.`,
    product_variant_action: `The variants of ${name}.`,
    action_view_sales: `${num(values['sales_count'])} sold in the last 365 days: the sales analysis opens here in Flectra.`,
    action_view_po: `${num(values['purchased_product_qty'])} purchased in the last 365 days: the purchase analysis opens here in Flectra.`,
    action_product_tmpl_forecast_report: `Forecast of ${name}: ${num(values['virtual_available'])} once every order is delivered and received.`,
    action_view_stock_move_lines: `In: ${num(values['nbr_moves_in'])}, out: ${num(values['nbr_moves_out'])} moves of ${name} in the last year.`,
    action_view_orderpoints: `Reordering: buy more of ${name} under ${num(values['reordering_min_qty'])}, up to ${num(values['reordering_max_qty'])}.`,
    action_open_product_lot: `The serial numbers of ${name}.`,
    product_tag_action: 'Product tags: Sales › Configuration › Product Tags.',
    action_open_routes: 'The routes diagram: how this product reaches the stock and leaves it.',
    action_open_attribute_values: 'The attribute’s values open here in Flectra, to set each one’s extra price.',
    action_view_related_putaway_rules: `The putaway rules of ${name}: where it is stored as it is received.`,
    action_view_storage_category_capacity: `The storage capacities of ${name}.`,
  };
  return said[action] ? { say: { message: said[action], tone: 'info' } } : undefined;
}

/** A milestone's line moved to another state by its own button, and what the contract says of it. */
function milestoneTo(request: ActionRequest, state: string): Values {
  const lines = ((request.values['milestone_ids'] as Line[] | null) ?? []).map((line) => (line.key === request.line?.key ? { ...line, values: { ...line.values, state } } : line));
  return { milestone_ids: lines };
}

function contractAction(request: ActionRequest): ActionResult | undefined {
  const { action, values } = request;
  const name = String(values['name'] ?? '');
  switch (action) {
    case 'action_milestone_complete':
      return { values: milestoneTo(request, 'completed'), say: { message: `Milestone “${request.line?.values['name']}” completed.`, tone: 'success' } };
    case 'action_milestone_invoice':
      return {
        values: { ...milestoneTo(request, 'invoiced'), invoice_count: num(values['invoice_count']) + 1 },
        say: { message: `A draft invoice for “${request.line?.values['name']}”: ${egp(num(request.line?.values['amount']))}.`, tone: 'success' },
      };
    case 'action_activate': {
      const lines = (values['milestone_ids'] as Line[] | null) ?? [];
      const first = [...lines].sort((a, b) => String(a.values['due_date']).localeCompare(String(b.values['due_date'])))[0];
      const escalates = values['contract_type'] === 'framework' && values['has_escalation'] && !values['next_escalation_date'] && typeof values['start_date'] === 'string';
      return {
        values: {
          state: 'active',
          days_until_expiry: daysFromToday(values['end_date']),
          ...(escalates ? { next_escalation_date: addMonths(String(values['start_date']), 12) } : {}),
        },
        say: { message: first ? `Contract active. A to-do for ${(values['user_id'] as RelatedRecord | null)?.label ?? 'the manager'}: milestone due “${first.values['name']}”.` : 'Contract active.', tone: 'success' },
      };
    }
    case 'action_renew': {
      // Flectra's action_renew opens the renewal dialog, its onchange starting it the day after this one ends, as long again.
      const end = typeof values['end_date'] === 'string' ? values['end_date'] : null;
      const start = end ? addDays(end, 1) : null;
      const months = num(values['duration_months']);
      const quote = (day: string | null) => (day ? `'${day}'` : 'None');
      return {
        open: {
          page: 'real-contract-renewal',
          as: 'dialog',
          title: 'Renew Contract',
          values: {
            new_start_date: quote(start),
            new_end_date: quote(start && months ? addDays(addMonths(start, months), -1) : null),
            contract_value: 'contract_value',
            new_value: 'contract_value',
            apply_escalation: 'has_escalation',
            escalation_rate: 'escalation_rate',
            currency_id: 'currency_id',
          },
          then: [{ do: 'call', action: 'contract_renewed' }, { do: 'save' }],
        },
      };
    }
    case 'contract_renewed':
      return { values: { state: 'completed' }, say: { message: `${name} completed; its renewal is a new draft contract.`, tone: 'success' } };
    case 'action_view_invoices':
      return { say: { message: `${num(values['invoice_count'])} invoice(s) of this contract: Invoicing › Customers › Invoices.`, tone: 'info' } };
    case 'action_view_documents':
      return { say: { message: `${num(values['document_count'])} contract document(s): the signed contract and its annexes.`, tone: 'info' } };
  }
  return undefined;
}

function contractWizardAction({ action, values }: ActionRequest): ActionResult | undefined {
  // Flectra emails the customer when Notify Customer is ticked; nothing to answer here.
  if (action === 'contract_termination_confirm') return {};
  if (action === 'contract_renewal_confirm') {
    if (String(values['new_start_date']) >= String(values['new_end_date'])) return { stop: 'End date must be after start date.' };
    return {};
  }
  return undefined;
}

/** New lines already warned about their product, by key: Flectra warns once, as the product is picked. */
const warnedLines = new Set<string>();

/** An answer comes after a moment, as one from a server does. */
const later = (answer: ActionResult | undefined) => (answer === undefined ? undefined : new Promise<ActionResult>((resolve) => setTimeout(() => resolve(answer), 150)));

/**
 * The person the sales pages are shown to: a sales manager of a one-company,
 * one-warehouse firm, with the groups Flectra gives one — so the parts for
 * several companies, warehouses or locations, and developer mode
 * (base.group_no_one), stay hidden, as they do in Sherkety's own setup.
 */
const SALES_MANAGER = {
  id: 7121,
  name: 'Salma Nabil',
  roles: [
    'base.group_user',
    'sales_team.group_sale_salesman',
    'sales_team.group_sale_salesman_all_leads',
    'sales_team.group_sale_manager',
    'sale.group_proforma_sales',
    'sale.group_auto_done_setting',
    'sale.group_warning_sale',
    'product.group_discount_per_so_line',
    'product.group_product_pricelist',
    'product.group_product_variant',
    'uom.group_uom',
    'analytic.group_analytic_accounting',
    'stock.group_stock_user',
    'stock.group_stock_manager',
    'stock.group_production_lot',
    'purchase.group_purchase_user',
    'purchase.group_purchase_manager',
    'purchase.group_warning_purchase',
    'account.group_account_invoice',
    'account.group_account_readonly',
    'account.group_account_manager',
    'sale_contract.group_contract_user',
    'sale_contract.group_contract_manager',
  ],
};

/** The real pages of this lane: see demos/real/README.md. */
export const lane: RealLane = {
  around: {
    'real-sale-invoice-wizard': { user: SALES_MANAGER },
    'real-sale-order': { user: SALES_MANAGER, records: [7101, 7102], breadcrumbs: [{ label: 'Quotations', href: '#quotations' }] },
    'real-product': { user: SALES_MANAGER, records: [7301, 7305], breadcrumbs: [{ label: 'Products', href: '#products' }] },
    'real-sale-contract': { user: SALES_MANAGER, records: [7601, 7602], breadcrumbs: [{ label: 'Contracts', href: '#contracts' }] },
  },
  pages: {
    'real-sale-invoice-wizard': invoiceWizard as Page,
    'real-sale-order': saleOrder as Page,
    'real-product': product as Page,
    'real-sale-contract': saleContract as Page,
  },
  opened: {
    'real-sale-invoice-wizard': invoiceWizard as Page,
    'real-contract-termination': contractTermination as Page,
    'real-contract-renewal': contractRenewal as Page,
  },
  related: {
    'sale.contract': saleContract as Page,
    // An amendment's own page, which a line of the contract's Amendments opens.
    'contract.amendment': contractAmendment as Page,
  },
  // A customer's address and tax number under its link (show_address, show_vat), a tag's colour.
  shows: { 'res.partner': { details: ['street', 'city', 'vat'] }, 'crm.tag': { color: 'color' }, 'product.attribute.value': { color: 'color' } },
  // A product's properties are its category's.
  definitions: { product_properties: (values) => CATEGORY_PROPERTIES[idOf(values['categ_id']) ?? 0] ?? [] },
  records: {
    'sale.order': SALE_ORDERS,
    'sale.advance.payment.inv': INVOICE_WIZARDS,
    'product.template': PRODUCT_TEMPLATES,
    'sale.contract': CONTRACTS,
    'contract.amendment': Object.fromEntries(
      Object.values(CONTRACTS).flatMap((contract) =>
        ((contract['amendment_ids'] as Line[] | undefined) ?? []).map((line) => [
          String(line.id),
          { ...line.values, currency_id: contract['currency_id'], description: `<p>${line.values['name']}.</p>` },
        ]),
      ),
    ),
    'res.partner': Object.fromEntries(
      Object.entries(PARTNERS).map(([id, p]) => [
        id,
        { name: p.name, parent_id: p.parent ? link('res.partner', p.parent) : null, type: p.type ?? 'contact', street: p.street ?? null, city: p.city, vat: p.vat ?? null, email: p.email ?? null, phone: p.phone ?? null, is_company: !p.parent },
      ]),
    ),
    'product.product': Object.fromEntries(
      Object.entries(PRODUCTS).map(([id, p]) => [id, { name: p.name, type: p.type, sale_ok: p.saleOk ?? true, lst_price: p.price }]),
    ),
    'account.tax': {
      7411: { name: 'VAT 14%', type_tax_use: 'sale', amount: 14, company_id: COMPANY(), country_id: link('res.country', 7491) },
      7412: { name: 'VAT 0% (exempt)', type_tax_use: 'sale', amount: 0, company_id: COMPANY(), country_id: link('res.country', 7491) },
      7413: { name: 'VAT 14% (purchases)', type_tax_use: 'purchase', amount: 14, company_id: COMPANY(), country_id: link('res.country', 7491) },
    },
    'product.attribute.value': Object.fromEntries(
      Object.entries(ATTRIBUTE_VALUES).map(([id, v]) => [id, { name: NAMES['product.attribute.value'][Number(id)], attribute_id: link('product.attribute', v.attribute), color: v.color }]),
    ),
    'crm.tag': Object.fromEntries(Object.entries(NAMES['crm.tag']).map(([id, name]) => [id, { name, color: TAG_COLORS[Number(id)] ?? 0 }])),
    'account.account': Object.fromEntries(Object.entries(NAMES['account.account']).map(([id, name]) => [id, { name, deprecated: false }])),
    ...Object.fromEntries(
      Object.entries(NAMES)
        .filter(([model]) => !['account.tax', 'account.account', 'crm.tag', 'product.attribute.value'].includes(model))
        .map(([model, rows]) => [model, Object.fromEntries(Object.entries(rows).map(([id, name]) => [id, { name }]))]),
    ),
  },
  onchange: {
    'sale.order': {
      order_line: recalculateLines,
      partner_id: partnerChanged,
      pricelist_id: (values) => ({ show_update_pricelist: hasItems(values) }),
      fiscal_position_id: (values) => ({ show_update_fpos: hasItems(values) }),
      sale_order_template_id: templateChanged,
    },
    'product.template': {
      list_price: (values) => ({ tax_string: taxString(values) }),
      taxes_id: (values) => ({ tax_string: taxString(values) }),
      currency_id: (values) => ({ tax_string: taxString(values) }),
      detailed_type: (values) => ({ ...(values['detailed_type'] !== 'product' ? { tracking: 'none' } : {}), ...(values['detailed_type'] === 'service' ? { invoice_policy: 'order' } : {}) }),
    },
    'sale.contract': {
      start_date: contractDates,
      end_date: contractDates,
      partner_id: () => ({ partner_contact_id: null }),
    },
    'contract.renewal.wizard': {
      new_start_date: (values) => ({ duration_months: monthsBetween(values['new_start_date'], values['new_end_date']) }),
      new_end_date: (values) => ({ duration_months: monthsBetween(values['new_start_date'], values['new_end_date']) }),
      apply_escalation: escalated,
      escalation_rate: escalated,
    },
  },
  warnings: {
    'sale.order': {
      // Flectra's product warning on a sales line: the product's own message when it has one.
      order_line: (values) => {
        const lines = (values['order_line'] as Line[] | null) ?? [];
        const fresh = lines.find((line) => idOf(line.values['product_id']) === 7301 && line.id === undefined && !warnedLines.has(line.key));
        if (!fresh) return null;
        warnedLines.add(fresh.key);
        return 'Warning for Patient monitor PM-12: Confirm the ward’s 220 V outlets before quoting a wall mount.';
      },
    },
  },
  action(request) {
    switch (pageOf(request.values)) {
      case 'order':
        return later(saleOrderAction(request));
      case 'wizard':
        return later(invoiceWizardAction(request));
      case 'product':
        return later(productAction(request));
      case 'contract':
        return later(contractAction(request));
      case 'termination':
      case 'renewal':
        return later(contractWizardAction(request));
    }
    return undefined;
  },
};
