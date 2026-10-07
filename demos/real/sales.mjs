/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-sale-order',
    name: 'Sales order (Sherkety ERP)',
    category: 'real',
    query: 'page=real-sale-order&record=7101&skin=underline',
    blurb: 'Flectra’s sales order with its Sales Management and Inventory additions: the header’s buttons by status, a grid of lines with sections and notes priced by the server, optional products, other information in four groups, and the conversation.',
    howTo: [
      'Press Send by Email: the quotation is emailed and moves to Quotation Sent; press Confirm and it becomes a sales order, the Delivery stat button appears and Expiration gives way to Order Date.',
      'In the grid, change the patient monitors’ Quantity from 4 to 5: the line’s Tax excl. and the totals under the grid follow.',
      'Add a product and pick the Defibrillator AED-3: its description, unit, VAT 14% and the hospital price come with it.',
      'Change the Customer to Delta Care Clinics: the addresses, pricelist and terms follow, and the credit-limit warning shows over the sheet.',
      'Open S00068 (record=7102) and press Create Invoice: the Create invoices dialog opens over the order.',
    ],
  },
  {
    id: 'real-sale-invoice-wizard',
    name: 'Create invoices dialog (Sherkety ERP)',
    category: 'real',
    query: 'page=real-sale-invoice-wizard&record=7701&skin=outlined',
    blurb: 'The dialog a confirmed order opens to invoice it: a regular invoice or a down payment by percentage or a fixed amount, its fields shown and required by the choice, a warning when the down payment is more than is left to invoice.',
    howTo: [
      'Choose Down payment (percentage): Down Payment Amount appears with % beside it, and is required.',
      'Type 95: a warning says the down payment is more than is left to invoice.',
      'Choose Down payment (fixed amount): the amount in Egyptian pounds takes its place.',
      'Open it for three orders at once (record=7702): Order Count and Consolidated Billing show instead of the choice.',
    ],
  },
  {
    id: 'real-product',
    name: 'Product (Sherkety ERP)',
    category: 'real',
    query: 'page=real-product&record=7301&skin=underline',
    blurb: 'Flectra’s product with what Sales, Purchase, Inventory, Accounting and Sherkety’s own price currencies add: twelve stat buttons by condition, a tab per department, vendors, attributes, properties and routes.',
    howTo: [
      'Change Product Type to Service: the Inventory tab, the stock stat buttons, Update Quantity and Replenish go, and the tooltip under the type changes.',
      'Untick Can be Purchased: the Purchase tab and the Purchased stat button go.',
      'Change the Cost’s currency from USD to EGP with the box beside it.',
      'In the Sales tab, set the warning to Blocking Message: Message becomes required.',
    ],
  },
  {
    id: 'real-sale-contract',
    name: 'Sales contract (Sherkety ERP)',
    category: 'real',
    query: 'page=real-sale-contract&record=7601&skin=underline',
    blurb: 'Sherkety’s own B2B contract: a statusbar with Activate, Terminate and Renew, milestones whose completion bar follows them, tabs shown by contract type, amendments, scope and terms; Terminate and Renew open their own dialogs.',
    howTo: [
      'Change Contract Type to Service Level Agreement: the Price Escalation tab gives way to SLA Performance.',
      'In Milestones, press Complete on the first milestone, in progress: the completion bar moves to 25%, and Invoice takes Complete’s place.',
      'Press Activate: the contract is active, and Terminate and Renew appear.',
      'Press Terminate, give a reason and press Terminate Contract: the contract is terminated and its Termination Details show under the terms.',
    ],
  },
];
