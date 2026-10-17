/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-sale-order',
    name: 'A sales order, in full',
    category: 'real',
    query: 'page=real-sale-order&record=7101&skin=underline',
    blurb: 'A full sales order from a working business system, from quotation to confirmed order: the buttons each stage needs, lines with sections and notes priced by the business’s own rules, optional products, delivery and invoicing details in four groups, and the conversation with your team beside it.',
    howTo: [
      'Press Send by Email: the quotation is emailed and moves to Quotation Sent; press Confirm and it becomes a sales order, the Delivery counter appears and Expiration gives way to Order Date.',
      'In the grid, change the patient monitors’ Quantity from 4 to 5: the line’s Tax excl. and the totals under the grid follow.',
      'Add a product and pick the Defibrillator AED-3: its description, unit, VAT 14% and the hospital price come with it.',
      'Show Analytic Distribution from the grid’s column chooser (⋮): each line’s accounts with their shares; click a cell to change them. [Opened as someone without the analytic accounting role](?roles=base.group_user), the column is not there.',
      'Change the Customer to Delta Care Clinics: the addresses, pricelist and terms follow, and the credit-limit warning shows over the sheet.',
      '[Open S00068](?record=7102) and press Create Invoice: the Create invoices dialog opens over the order.',
    ],
  },
  {
    id: 'real-sale-invoice-wizard',
    name: 'Invoice an order',
    category: 'real',
    query: 'page=real-sale-invoice-wizard&record=7701&skin=outlined',
    // What the frame says once it is done here on its own (shell.mjs), where an app closes it over its order.
    done: { saved: 'In your app this window closes, and the order shows its new invoice.', cancelled: 'In your app this window closes, and the order stays as it was.' },
    blurb: 'The dialog a confirmed order opens to invoice it: a regular invoice or a down payment by percentage or a fixed amount, its fields shown and required by the choice, a warning when the down payment is more than is left to invoice.',
    howTo: [
      'Choose Down payment (percentage): Down Payment Amount appears with % beside it, and is required.',
      'Type 95: a warning says the down payment is more than is left to invoice.',
      'Choose Down payment (fixed amount): the amount in Egyptian pounds takes its place.',
      '[Open it for three orders at once](?record=7702): Order Count and Consolidated Billing show instead of the choice.',
    ],
  },
  {
    id: 'real-product',
    name: 'A product, in full',
    category: 'real',
    query: 'page=real-product&record=7301&skin=underline',
    blurb: 'A product as sales, purchasing, the warehouse and accounting all keep it, its prices in their own currencies: twelve counters at the top, each shown when it applies, a tab per department, vendors, variants, extra details and routes.',
    howTo: [
      'Change Product Type to Service: the Inventory tab, the stock counters, Update Quantity and Replenish go, and the tooltip under the type changes.',
      'Untick Can be Purchased: the Purchase tab and the Purchased counter go.',
      'Change the Cost’s currency from USD to EGP with the box beside it.',
      'In the Sales tab, set the warning to Blocking Message: Message becomes required.',
    ],
  },
  {
    id: 'real-sale-contract',
    name: 'A sales contract',
    category: 'real',
    query: 'page=real-sale-contract&record=7601&skin=underline',
    blurb: 'A contract with a business customer: its stages along the top with Activate, Terminate and Renew, milestones whose completion bar follows them, tabs shown by contract type, amendments, scope and terms; Terminate and Renew open their own windows.',
    howTo: [
      'Change Contract Type to Service Level Agreement: the Price Escalation tab gives way to SLA Performance.',
      'In Milestones, press Complete on the first milestone, in progress: the completion bar moves to 25%, and Invoice takes Complete’s place.',
      'Press Activate: the contract is active, and Terminate and Renew appear.',
      'Press Terminate, give a reason and press Terminate Contract: the contract is terminated and its Termination Details show under the terms.',
    ],
  },
];
