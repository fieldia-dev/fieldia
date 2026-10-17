/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-invoice',
    name: 'Invoice, bill or journal entry',
    category: 'real',
    query: 'page=real-invoice&record=4101&skin=underline',
    blurb:
      'One page that is an invoice, a bill, a credit note or a journal entry, by its type. Lines with sections and notes, taxes and totals the server works out, journal items, the payment dialog, alerts and the conversation; printed with the firm’s logo, or as the app’s own PDF.',
    howTo: [
      'Add a line: pick a product and watch its price, taxes, the totals and the Journal Items tab follow.',
      'Press Confirm: the invoice gets its number, INV/2026/00042, and the Register Payment button.',
      'Register Payment opens its dialog: pay part of it and choose to keep the rest open or mark it fully paid.',
      'Under the gear, Print › This record: the invoice on paper — the firm’s logo and address over it, every tab one after another, the lines whole, no buttons — or press Ctrl+P.',
      'Print › Invoice: the app’s own PDF of it, shown over the record, with Download.',
      'Open another record: record=4102 is a USD invoice partly paid, 4103 a vendor bill (a possible duplicate), 4104 a journal entry, 4105 a paid credit note.',
    ],
  },
  {
    id: 'real-register-payment',
    name: 'Register a payment',
    category: 'real',
    query: 'page=real-register-payment&record=4101&skin=underline',
    blurb:
      'The dialog an invoice opens to record a payment, here on its own: the bank or cash journal and the method, the amount in any currency, a postdated check’s number and date, and what to do with a payment that is short.',
    howTo: [
      'The amount is less than what is due: the payment difference shows, with Keep open or Mark as fully paid.',
      'Choose Mark as fully paid: the account to post the difference in, and its label, are asked for.',
      'Change the currency beside the amount to EGP: the amount is worked out again at the day’s rate, and the manual rate goes.',
      'Pick the Bank — CIB journal and the Postdated Check method: the check’s number and due date are asked for.',
    ],
  },
  {
    id: 'real-expense',
    name: 'Expense report',
    category: 'real',
    query: 'page=real-expense&record=4101&skin=underline',
    blurb:
      'An employee’s expenses of several items: a shared header that cascades to every line, prices that include their VAT, and its own approval — submit, approve, post a bill to reimburse, pay it.',
    howTo: [
      'Type a vendor in Vendor Name: every line takes it.',
      'Add a line with a price: its VAT is taken out of it, and the totals follow.',
      'Press Submit, Approve, then Post: the status bar moves along and the Entries button appears.',
      'Register Payment pays the employee in a dialog; paid in full, the Paid ribbon shows.',
    ],
  },
];
