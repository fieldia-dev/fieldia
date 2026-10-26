/**
 * The template library in the gallery: examples/templates, ready pages to start
 * from, each in the theme it names (category 'templates'). Its names and blurbs
 * are the library's own, examples/templates/index.json: e2e/templates.spec.ts
 * keeps the two the same.
 */
export default [
  {
    id: 'template-contact-us',
    name: 'Contact us',
    category: 'templates',
    query: 'page=template-contact-us&theme=apple',
    blurb: "A short contact form: who is writing, what about, and their message, with the topic steering where it goes.",
    howTo: [
      "Choose Help with something under What is it about?: Order or account number appears, with a hint under it.",
      "Press Submit with nothing filled in: each required field says what it needs, and the cursor goes to the first.",
    ],
  },
  {
    id: 'template-newsletter',
    name: 'Newsletter sign-up',
    category: 'templates',
    query: 'page=template-newsletter&theme=shadcn',
    blurb: "An email and a name, the topics wanted and how often: the smallest form, done in seconds.",
    howTo: [
      "Type an email without an @ and leave the box: it says the email is not valid.",
      "Tick two topics and pick how often: the smallest form, done in seconds.",
    ],
  },
  {
    id: 'template-customer-feedback',
    name: 'Customer feedback',
    category: 'templates',
    query: 'page=template-customer-feedback&theme=google-forms',
    blurb: "The branch they visited, then how it went there by its name, how likely they are to recommend you, what they liked and what to do better, a reply only if they want one, and an ending that answers what they said.",
    howTo: [
      "Before a branch is picked, the next question asks how your visit to us was. Pick a branch: it asks of that one by its name, and follows another.",
      "Give it four stars and pick a number on the scale.",
      "Turn on You may contact me: Email appears, and is now required.",
      "Give it one star, fill in your email and send: the page says sorry, names who at that branch reads it and will write to you, and offers no second response.",
    ],
  },
  {
    id: 'template-event-registration',
    name: 'Event registration',
    category: 'templates',
    query: 'page=template-event-registration&theme=material',
    blurb: "Who is coming, which ticket and sessions, food and access needs, with the ticket's price worked out as they choose, and an ending naming the ticket and where it goes.",
    howTo: [
      "Choose VIP: the price changes to $250. Choose Student: Student card number appears, required.",
      "Tick two workshops, then pick a food need.",
      "Fill in your name, email and student card number and press Submit: the page names your ticket, its price and your workshops, and the email the ticket goes to.",
    ],
  },
  {
    id: 'template-job-application',
    name: 'Job application',
    category: 'templates',
    query: 'page=template-job-application&theme=fluent',
    blurb: "Three steps: the role and when they can start, who they are, and their experience with a CV, each step checked before the next.",
    howTo: [
      "Press Next with the role empty: the step says what it needs before it lets you on.",
      "Fill in the three steps and send: Send my application finishes it.",
    ],
  },
  {
    id: 'template-support-request',
    name: 'Support request',
    category: 'templates',
    query: 'page=template-support-request&theme=bootstrap',
    blurb: "What is wrong and how urgent, with the steps to reproduce asked only for a fault, and a screenshot attached.",
    howTo: [
      "Choose Something is broken: Steps to make it happen again appears.",
      "Set how urgent it is with the stars, and attach a screenshot.",
    ],
  },
  {
    id: 'template-appointment-booking',
    name: 'Book an appointment',
    category: 'templates',
    query: 'page=template-appointment-booking&theme=apple',
    blurb: "A service, a day and a free time, then who is coming and a reminder: a booking in one screen, ending with its reference.",
    howTo: [
      "Pick a service, then a day and one of its free times, then who is coming: a day gone by is never offered, nor a time already booked.",
      "Turn the reminder off and on: a switch, not a box to tick.",
      "Book it: the page says your booking's reference, B-1043, with the service, the day and the time you chose. Choose a video call first: it says the link comes by email.",
      "Press Book another and pick the same service and day: the time you just booked is gone from its times.",
    ],
  },
  {
    id: 'template-patient-intake',
    name: 'Patient intake',
    category: 'templates',
    query: 'page=template-patient-intake&theme=material',
    blurb: "A clinic's first-visit form in three steps: the patient, their medical history with details asked only where they apply, and consent with a signature.",
    howTo: [
      "On Your health, turn on I have allergies: a box for them appears, required.",
      "On Consent, sign with the mouse or a finger in the signature box.",
    ],
  },
  {
    id: 'template-course-evaluation',
    name: 'Course evaluation',
    category: 'templates',
    query: 'page=template-course-evaluation&theme=google-forms',
    blurb: "Each part of a course rated on one grid, an overall score and two open questions: what worked and what to change.",
    howTo: [
      "Rate each part of the course on the grid, one answer a row.",
      "Give the course an overall rating, then answer the two open questions.",
    ],
  },
  {
    id: 'template-quote-request',
    name: 'Request a quote',
    category: 'templates',
    query: 'page=template-quote-request&theme=ant',
    blurb: "A business enquiry: the company, the services wanted, the budget and the deadline, and a brief to attach.",
    howTo: [
      "Tick what you need, pick a budget and a date it is needed by.",
      "Attach a brief: a file next to the form's answers.",
    ],
  },
  {
    id: 'template-property-enquiry',
    name: 'Property enquiry',
    category: 'templates',
    query: 'page=template-property-enquiry&theme=material',
    blurb: "For an estate agent: buy or rent, the kind of home, bedrooms and budget, and a viewing asked for on a day that suits.",
    howTo: [
      "Choose Rent: Budget gives way to Monthly rent up to.",
      "Slide Bedrooms, then turn on I would like to arrange a viewing: a day for it appears.",
    ],
  },
  {
    id: 'template-invoice',
    name: 'Invoice',
    category: 'templates',
    query: 'page=template-invoice&theme=odoo&record=new',
    blurb: "A customer invoice: its status, the customer and terms, lines whose subtotals and totals work themselves out, then Confirm — once it has lines to bill — and Register payment.",
    howTo: [
      "Pick a customer and press Confirm: with no lines yet, it says why it cannot.",
      "Add a line: pick a product, type a quantity and a price, and the subtotal and the totals under it follow.",
      "Type a discount on a line: its subtotal drops by that much.",
      "Press Confirm: the invoice gets its number, moves to Posted, and Register payment takes its place.",
    ],
  },
  {
    id: 'template-purchase-order',
    name: 'Purchase order',
    category: 'templates',
    query: 'page=template-purchase-order&theme=ant&record=new',
    blurb: "An order to a vendor: the vendor and dates, products with quantities and prices, totals, and its steps in their order — Send by email, Confirm order, Receive products — each once the order is ready for it.",
    howTo: [
      "Pick a vendor and add products: the totals follow the lines.",
      "Press Confirm order on an empty order: it says what is missing. Add products, then Send by email and Confirm order: the stages along the top follow, and Receive products comes once it is confirmed.",
    ],
  },
  {
    id: 'template-expense-claim',
    name: 'Expense claim',
    category: 'templates',
    query: 'page=template-expense-claim&theme=fluent&record=new',
    blurb: "An employee's expenses, one line each with its date, kind and amount, totalled, then submitted and approved.",
    howTo: [
      "Add two expenses with their dates, kinds and amounts: the total adds them up.",
      "Write what it was for in the title and pick an Employee, then press Submit: Approve and Send back take its place, as the approver sees them.",
    ],
  },
  {
    id: 'template-leave-request',
    name: 'Time-off request',
    category: 'templates',
    query: 'page=template-leave-request&theme=bootstrap&record=new',
    blurb: "Leave asked for: its kind, the dates with the days counted, half a day if so, and a reason, approved or refused.",
    howTo: [
      "Pick a first and a last day: Days counts them. Turn on Half a day: 0.5.",
      "Choose Sick leave: Medical certificate appears.",
    ],
  },
  {
    id: 'template-customer',
    name: 'Customer',
    category: 'templates',
    query: 'page=template-customer&theme=odoo&record=new',
    blurb: "A customer record: person or company, how to reach them, tags, an address, contacts in a table, sales terms and notes in tabs.",
    howTo: [
      "Choose Person or Company above the name, and fill in how to reach them.",
      "Add a contact in the Contacts tab, and the credit limit in Sales and payment.",
    ],
  },
  {
    id: 'template-product',
    name: 'Product',
    category: 'templates',
    query: 'page=template-product&theme=shadcn&record=new',
    blurb: "A product card: picture, prices with the margin worked out, sold or bought, stock details and a description in tabs.",
    howTo: [
      "Type a sales price and a cost: the margin works itself out.",
      "Choose Service: the Inventory tab goes, as a service has no stock.",
    ],
  },
  {
    id: 'template-employee-onboarding',
    name: 'Employee onboarding',
    category: 'templates',
    query: 'page=template-employee-onboarding&theme=fluent&record=new',
    blurb: "A new hire set up in four steps: who they are, their job and manager, pay details, and the equipment to have ready on day one.",
    howTo: [
      "Choose Fixed term on The job: Contract ends appears, required.",
      "Pay is optional: skip it and go on to Day one.",
    ],
  },
  {
    id: 'template-task',
    name: 'Task',
    category: 'templates',
    query: 'page=template-task&theme=apple&record=new',
    blurb: "A project task: its stage along the top, moved with a click, priority stars, who it is assigned to, a deadline, a checklist whose progress counts itself, and a description.",
    howTo: [
      "Click a stage along the top, and a star for the priority.",
      "Add three checklist items and tick one: Progress shows 33%.",
    ],
  },
];
