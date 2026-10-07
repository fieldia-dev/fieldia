/** This lane's real pages in the gallery, as demos/catalog.mjs takes them (category 'real'). */
export default [
  {
    id: 'real-contact',
    name: 'Contact (res.partner)',
    category: 'real',
    query: 'page=real-contact&record=7001&skin=underline',
    blurb:
      "Sherkety ERP's contact form as Sales, Purchase, Invoicing and CRM users see it: Individual or Company reshapes the page, contacts and addresses as cards, Sales & Purchase, Invoicing with bank accounts and the credit limit, Egyptian tax numbers, warnings, smart buttons and the chatter.",
    howTo: [
      'Pick Individual over the name: Job Position, Title and the address type appear, Industry goes, and the address block loses its heading.',
      'Open Contacts & Addresses: the people and addresses of Nile Crest are cards; add one with Add, or press ↗ on a card for its own form — pick Invoice Address there and the address takes the job’s place.',
      'Open Invoicing and untick Partner Limit: the credit limit goes away.',
      'In Internal Notes, set the invoice warning to Warning: a message box appears and must be filled in before saving.',
      'Open Hany Saber (record=7002): his address is the company’s and locked, and Invoicing is managed on the parent company.',
    ],
  },
  {
    id: 'real-opportunity',
    name: 'CRM opportunity (crm.lead)',
    category: 'real',
    query: 'page=real-opportunity&record=7701&skin=underline',
    blurb:
      "Sherkety ERP's lead and opportunity form: the pipeline's stages with the probability that follows them, expected revenue, priority stars, the customer's details, Won and Lost with the lost-reason dialog, Restore, and the lead's own groups and Convert to Opportunity.",
    howTo: [
      'Click Qualified on the stages at the top: the probability follows the stage, to 30 %.',
      'Press Lost, pick a reason and Mark as Lost: the Lost ribbon, the reason, and Restore appear, and the reason is posted in the conversation.',
      'Press Restore to bring it back, then Won: it moves to the Won stage at 100 %.',
      'Change the email under Customer: a note says the customer’s email will be updated too.',
      'Open the lead (record=7702): its own groups and tab, and Convert to Opportunity in a dialog.',
    ],
  },
  {
    id: 'real-tender',
    name: 'Tender opportunity (crm_tender)',
    category: 'real',
    query: 'page=real-tender&record=7801&skin=underline',
    blurb:
      "Sherkety's own tender form: a government bid in lots priced by quotations, a compliance checklist whose percentage follows its ticks, the bid team, bond and margin, competitors, results, documents and the timeline, in eight tabs.",
    howTo: [
      'Open Requirements and tick Compliant on “Three similar projects”: the compliance bar follows.',
      'Add a requirement with Add a line: the bar counts it too.',
      'In Lots, untick We Are Bidding on Lot 2: Our Bid Amount under Financial drops by its quotation.',
      'Press Submit Bid: the tender moves to Submitted, and Mark Won and Mark Lost appear.',
      'Press Mark Lost, fill in the loss analysis and Confirm Loss: the Results tab shows why.',
    ],
  },
];
