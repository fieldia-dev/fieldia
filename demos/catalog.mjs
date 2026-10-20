/**
 * Every public demo, once: the gallery on fieldia.dev, the menu and the
 * "how to try it" panel on each demo page, and the thumbnail tool all read
 * this list, so they cannot drift apart. A demo runs in each framework unless
 * it names its own `app`.
 */

import { REAL_DEMOS } from './real/index.mjs';
import TEMPLATE_DEMOS from './templates.mjs';

export const FRAMEWORKS = [
  { id: 'plain', label: 'JavaScript' },
  { id: 'react', label: 'React' },
  { id: 'vue', label: 'Vue' },
  { id: 'angular', label: 'Angular' },
];

export const CATEGORIES = [
  { id: 'records', label: 'Business records', colour: '#0b5cad' },
  { id: 'lists', label: 'Lists and search', colour: '#7c3aed' },
  { id: 'forms', label: 'Forms and surveys', colour: '#0f766e' },
  { id: 'fields', label: 'Fields and widgets', colour: '#b45309' },
  { id: 'behaviour', label: 'Keys, feedback and languages', colour: '#be185d' },
  { id: 'script', label: 'No build step', colour: '#475569' },
  { id: 'templates', label: 'Templates to start from', colour: '#4f46e5' },
  { id: 'real', label: 'Real screens from a working ERP', colour: '#9a3412' },
];

/**
 * The business areas the gallery groups its demos by, as a business owner looks for them, and the one for the demos
 * that show a part of Fieldia rather than a business's screen. Each demo is in exactly one (AREA_OF, below; a browser
 * test holds every demo to one). `blurb`: the area in a line, for the gallery.
 */
export const AREAS = [
  { id: 'sales', label: 'Sales', blurb: 'Quotations, orders and their lines, products and contracts, test drives booked, and where the orders are.' },
  { id: 'accounting', label: 'Accounting', blurb: 'Invoices and bills, payments, expenses, and the records round them.' },
  { id: 'crm', label: 'CRM', blurb: 'Customers and contacts, leads and opportunities, tenders, and what people ask for.' },
  { id: 'people', label: 'People', blurb: 'Hiring, onboarding, employees’ files and time off.' },
  { id: 'operations', label: 'Operations', blurb: 'Tasks and work items, the warehouse, making things, maintenance, deliveries and cases.' },
  { id: 'clinic', label: 'Clinic', blurb: 'A clinic’s day by doctor, appointments, bookings and a patient’s first visit.' },
  { id: 'real-estate', label: 'Real estate', blurb: 'Homes on a map, a listing’s photos, viewings and enquiries.' },
  { id: 'surveys', label: 'Surveys', blurb: 'Surveys, sign-ups and feedback forms, with steps that follow the answers.' },
  { id: 'building-blocks', label: 'Building blocks', blurb: 'One part of Fieldia at a time, for developers: every field, your own parts, languages, keys and the script tag.' },
];

/** Each area's demos, by id: every demo of the catalog in exactly one. */
const AREA_OF = {
  sales: ['order', 'contract-fees', 'quick-order', 'rules', 'map-zones', 'map-heat', 'template-quote-request', 'template-product', 'real-sale-order', 'real-sale-invoice-wizard', 'real-product', 'real-sale-contract', 'test-drive', 'test-drives'],
  accounting: ['reading', 'vendor-bill', 'template-invoice', 'template-expense-claim', 'real-invoice', 'real-register-payment', 'real-expense', 'invoices'],
  crm: ['customer', 'customers', 'template-contact-us', 'template-support-request', 'template-customer', 'real-contact', 'real-opportunity', 'real-tender', 'contacts', 'leads-queue', 'customer-account', 'customer-card'],
  people: ['layout', 'template-job-application', 'template-employee-onboarding', 'template-leave-request', 'real-time-off', 'real-employee'],
  operations: ['backlog', 'work-item', 'agent-tools', 'template-task', 'template-purchase-order', 'real-task', 'real-transfer', 'real-manufacturing-order', 'real-maintenance-request', 'real-legal-case', 'map-couriers', 'map-round', 'map-order', 'map-kitchen'],
  clinic: ['clinic-calendar', 'template-patient-intake', 'template-appointment-booking', 'real-clinic-appointment', 'clinic-consent', 'visit-feedback', 'clinic-intake'],
  'real-estate': ['map-homes', 'homes-gallery', 'homes-search', 'map-embed', 'listing-photos', 'booking-week', 'template-property-enquiry', 'property', 'listing', 'enquiry'],
  surveys: ['survey', 'signup', 'event-signup', 'kinds', 'template-newsletter', 'template-customer-feedback', 'template-event-registration', 'template-course-evaluation', 'real-survey'],
  'building-blocks': ['fields', 'business', 'code', 'custom', 'contained', 'delivery', 'lists', 'map-delivery', 'map-address', 'map-zone', 'script', 'customer-locked', 'two-tabs', 'viewer-role', 'customers-arabic', 'customer-arabic', 'signup-french', 'signup-keys', 'customer-toast', 'map-homes-arabic', 'booking-week-arabic'],
};

/** The area a demo is in, by its id; undefined for one in none (the browser test says which). */
export const areaOf = (id) => Object.keys(AREA_OF).find((area) => AREA_OF[area].includes(id));
/** Every demo id each area names, as written: for the test that no demo is in two or none. */
export const AREA_IDS = AREA_OF;

/**
 * What a person may type to find each demo besides its name and its words: what it does and the common words for it —
 * "booking" for a test drive booked, "mobile" for a phone number, "bill" for an invoice. The gallery's search reads
 * them with the card's name, blurb, area and feature; every demo has some (a browser test holds each to it).
 */
const SEARCH_WORDS = {
  customer: 'client account contact company blocked block status sales invoices counters conversation messages notes team phone whatsapp',
  order: 'sale sales order quotation quote lines products items spreadsheet totals tax discount',
  customers: 'clients accounts contacts list search filter group favourites sort archive table',
  invoices: 'invoice bill bills billing accounts receivable payments overdue unpaid due totals sum currency dollars pounds month quarter print printout paper pdf phone mobile cards',
  contacts: 'people clients customers export import upload excel csv spreadsheet download bulk mass update edit many select all owner status phone mobile email columns hide show resize reorder drag move rearrange print cards whatsapp',
  'homes-gallery': 'homes houses property properties real estate listings photos pictures gallery grid cards tiles book viewing',
  'homes-search': 'homes houses property properties real estate buy buyer portal search filter filters facets count counts price range from to min max area bedrooms beds 2+ amenities phone mobile sheet show results',
  'leads-queue': 'leads queue sales team crm follow up follow-up late overdue today this week counts count filters saved searches favourites agent pipeline',
  'customer-account': 'customer client account invoices quotations quotes related records sub list child records inside one2many overdue reminder phone cards print tab count badge route router own page',
  property: 'property home house real estate listing viewings visits appointments related records inside agent client',
  enquiry: 'enquiry inquiry request lead buyer property home flat whatsapp email e-mail sms text message messages conversation chat chatter inbox channel channels reply ticks delivered read seen blue failed live arriving follow up follow-up reminder call back hour time clock cairo team note',
  listing: 'listing property home house villa apartment flat studio features garden pool balcony options conditions price per square metre meter district average server function formula handover months age building',
  'visit-feedback': 'feedback survey clinic patient treatments follow up carry forward picked earlier question age birthday options conditions aesthetic botox filler',
  'customer-card': 'duplicate duplicates double twice same customer contact merge dedupe deduplicate already exists',
  'clinic-consent': 'consent form signature sign signed esign e-signature evidence proof audit trail fingerprint hash tamper locked patient clinic treatment contract agreement',
  'event-signup': 'event sign up signup register registration rsvp tickets seats places capacity limit limited full sold out session workshop close closes closing deadline open opens one per person quota gym club membership members class classes',
  'clinic-intake': 'patient intake clinic long form wizard steps save continue later resume draft link phone laptop another device partial answers drop off',
  'test-drives': 'calendar week schedule planner test drives cars showroom time zone berlin diary agenda drag',
  backlog: 'bug bugs issue issues ticket tickets tracker jira azure devops work item sprint popup dialog window backlog',
  'work-item': 'bug issue ticket tracker azure devops work item quiet look state reason locked workflow',
  fields: 'every field kinds inputs text number money currency choice dropdown date calendar file upload attachment picture image rich text tags',
  'listing-photos': 'photos pictures images upload uploads camera phone property real estate listing gallery retry cancel slow',
  kinds: 'survey questionnaire slider tags address picture choice ranking repeat quiz score signature sign moving day time weight hearts nps net promoter recommend scale',
  business: 'fields task project priority stars status timer stopwatch hours timesheet date range tags copy pdf analytic accounts tax payments properties',
  code: 'code editor programming json python sql javascript syntax highlight vs code codemirror developer',
  signup: 'sign up signup register registration form workshop event attendee phone mobile number telephone autofill bot spam captcha honeypot whatsapp membership members club',
  layout: 'employee staff hire hiring hr personnel columns tabs photo bank pay contract',
  survey: 'survey questionnaire feedback poll steps wizard skip branching product',
  delivery: 'address shipping billing reuse saved form twice nested',
  rules: 'order totals calculate calculation discount warning validation checks email postcode rules',
  'contract-fees': 'contract agreement clause clauses legal terms fees prices price list quote quotation table tables paste pasted word excel google docs sheets rich text formatted rows columns header print',
  lists: 'country city cities dropdown choices options delivery address shipping server',
  'agent-tools': 'ai agent assistant bot automation tools integrations connections gmail slack drive hubspot triggers lines dependent choices dropdown follows column',
  'map-delivery': 'map place location address pin gps coordinates delivery openstreetmap where you are',
  'map-address': 'address autocomplete suggestions lookup street search type ahead location',
  'map-zone': 'map area zone shape polygon circle box draw delivery region territory',
  'map-homes': 'homes houses property properties real estate listings flats apartments villas rent rental sale price map pins search area shortlist',
  'map-embed': 'homes houses property real estate listings map website own page embed filter',
  'map-homes-arabic': 'homes houses property real estate map arabic right to left rtl',
  'map-couriers': 'couriers drivers riders fleet delivery map vehicles car scooter bike tracking free busy',
  'map-order': 'order delivery tracking courier driver eta arrival map food kitchen live where is my order',
  'map-round': 'route round stops van delivery driver map order lines numbered',
  'map-zones': 'orders districts areas regions map shaded legend count delivery week cairo',
  'map-heat': 'orders heat map heatmap revenue money where sales',
  'clinic-calendar': 'clinic doctor doctors appointment appointments booking bookings reservation schedule calendar diary agenda patients visits week month',
  'booking-week': 'booking bookings appointment appointments reservation reservations schedule calendar week agent viewings meetings diary hotel room rooms guest guests stay stays check in',
  'booking-week-arabic': 'booking appointment calendar week schedule arabic right to left rtl',
  'test-drive': 'booking book booked appointment appointments reservation reserve schedule slot slots time times calendar car cars dealer showroom drive time zone berlin',
  'map-kitchen': 'kitchen restaurant delivery fee districts map courier zone geofence food',
  custom: 'custom widget component own part badge print react vue angular developer extend',
  contained: 'error errors bug crash failure fails broken part safe developer',
  'quick-order': 'order phone call telephone stock inventory customer new side panel steps confirm',
  'two-tabs': 'conflict conflicts two tabs edited same time collaboration save overwrite lead version',
  'viewer-role': 'read only readonly permissions roles access viewer rights lead',
  'customer-locked': 'read only readonly edit lock locked view mode customer',
  reading: 'invoice bill dense read only accounting counters alerts tags keyboard shortcuts',
  'vendor-bill': 'vendor bill bills supplier purchase invoice pdf next previous archive duplicate delete print debit note',
  'customers-arabic': 'customers clients list arabic right to left rtl',
  'customer-arabic': 'customer client arabic right to left rtl translation',
  'signup-french': 'translation translations french language languages localisation localization i18n',
  'signup-keys': 'keyboard keys enter tab next field fast typing data entry',
  'customer-toast': 'save saving saved toast notification message',
  script: 'script tag html no build plain web page cdn embed call back callback',
  'template-contact-us': 'contact us enquiry inquiry message email phone mobile form website whatsapp',
  'template-newsletter': 'newsletter subscribe subscription mailing list email marketing members membership club',
  'template-customer-feedback': 'feedback review rating stars satisfaction nps recommend survey branch visit thank you ending',
  'template-event-registration': 'event registration register tickets conference attendee sessions sign up gym membership members',
  'template-job-application': 'job application apply career careers hiring recruitment cv resume candidate',
  'template-support-request': 'support help ticket issue bug problem helpdesk screenshot urgent',
  'template-appointment-booking': 'appointment booking book reservation schedule time slot slots free times taken service reminder reference confirmation thank you ending hotel salon spa',
  'template-patient-intake': 'patient intake clinic medical health history allergies consent signature doctor hospital',
  'template-course-evaluation': 'course evaluation training class feedback rating grid teacher school',
  'template-quote-request': 'quote quotation estimate request enquiry services budget brief proposal',
  'template-property-enquiry': 'property real estate home house flat apartment rent buy viewing enquiry agent',
  'template-invoice': 'invoice bill billing customer payment pay paid confirm lines tax totals',
  'template-purchase-order': 'purchase order po buy buying vendor supplier procurement receive received confirm',
  'template-expense-claim': 'expense expenses claim reimbursement receipts travel approve approval',
  'template-leave-request': 'leave time off holiday holidays vacation absence sick days off request approve',
  'template-customer': 'customer client account contact company person address',
  'template-product': 'product item catalogue catalog price cost margin stock inventory service',
  'template-employee-onboarding': 'employee onboarding new hire staff hr equipment first day manager pay',
  'template-task': 'task to do todo project stage priority checklist deadline assign',
  'real-sale-order': 'sales order quotation quote erp lines products delivery invoicing confirm email customer',
  'real-sale-invoice-wizard': 'invoice bill down payment deposit advance order invoicing percentage',
  'real-product': 'product item catalogue price cost stock inventory purchase vendor variants warehouse',
  'real-sale-contract': 'contract agreement sla milestones renew terminate customer',
  'real-invoice': 'invoice bill credit note journal entry accounting payment tax customer vendor',
  'real-register-payment': 'payment pay paid register bank cash cheque check postdated currency',
  'real-expense': 'expense expenses report claim reimbursement vat receipts approve employee',
  'real-contact': 'contact customer supplier vendor client company person address phone mobile number telephone tax bank credit limit whatsapp',
  'real-opportunity': 'opportunity lead deal pipeline crm sales won lost probability revenue',
  'real-tender': 'tender bid bidding government procurement lots compliance competitors',
  'real-clinic-appointment': 'clinic appointment booking patient doctor aesthetic session check in deposit no show',
  'real-time-off': 'time off leave holiday vacation absence sick approve approval hr',
  'real-employee': 'employee staff hr personnel record file manager department org chart skills resume',
  'real-maintenance-request': 'maintenance repair request equipment breakdown preventive service technician',
  'real-task': 'task project timesheet hours sub tasks approval stage',
  'real-transfer': 'warehouse receipt goods received receiving stock inventory transfer delivery backorder',
  'real-manufacturing-order': 'manufacturing production make build bill of materials bom components work order factory',
  'real-legal-case': 'legal case law firm lawyer court hearing matter dispute trust billing',
  'real-survey': 'survey settings questions questionnaire exam quiz certification scoring',
};
/**
 * The words an owner of each business types for it, which none of its demos may say: a dentist's for a clinic, a
 * landlord's for real estate. Every demo of the area is found by them, beside its own.
 */
const AREA_WORDS = {
  sales: 'shop store retail wholesale seller selling sell dealer dealership',
  accounting: 'bookkeeping bookkeeper accountant accountants ledger finance vat',
  crm: 'prospects pipeline deals relationships',
  people: 'payroll salary salaries wages staff workers employees personnel',
  operations: 'jobs field service logistics dispatch',
  clinic: 'dentist dentists dental doctor doctors physio physiotherapy therapist therapy vet veterinary medical health patient patients',
  'real-estate': 'tenant tenants landlord landlords lease leases leasing letting rent rental rentals renting realtor broker brokers apartment apartments flat flats',
  surveys: 'questionnaire questionnaires poll polls',
};
/** A demo's search words, as the gallery reads them: its own, and its business area's. */
export const wordsOf = (id) => [SEARCH_WORDS[id] ?? '', AREA_WORDS[areaOf(id)] ?? ''].filter(Boolean).join(' ');

/** The flagships, first in the gallery and in the menu. */
export const FEATURED = ['customer', 'order', 'customers', 'fields'];

export const DEMOS = [
  {
    id: 'customer',
    name: 'Customer record',
    category: 'records',
    query: 'page=customer&skin=underline',
    blurb: 'A customer on one page: where they stand — draft, active or blocked — their sales and invoices counted at the top, a key-account badge and a warning, tabs, their contacts in a table, links to other records, and the conversation with your team beside it.',
    howTo: [
      'Press Block and answer OK: the customer is blocked and saved, and a Blocked banner crosses their page. Activate brings them back.',
      'Press Ctrl+Enter (⌘+Enter on a Mac) to save from wherever the cursor is.',
      'Open the Contacts tab and add a contact in the table.',
      'Type in Country and pick one from the list: a link to another record.',
      'In the conversation on the right, write a message and mention someone with @.',
    ],
  },
  {
    id: 'order',
    name: 'Sales order',
    category: 'records',
    query: 'page=order&skin=underline',
    blurb: 'A sales order: the customer and its terms, then its lines like a spreadsheet — keys that move from cell to cell, sections and notes between lines, lines dragged into order — and totals that follow every change.',
    howTo: [
      'Click a Quantity cell and type: the subtotal and the totals under the grid follow as you type.',
      'Press Enter to go down, Tab to go across; Tab past the last cell adds a line.',
      'Drag a line by its handle to put it elsewhere, sections and notes too.',
      'Open the columns menu at the end of the header row to show or hide columns; the choice is remembered.',
      'Open a line in its dialog with the arrow at its end, to see all of its fields at once.',
    ],
  },
  {
    id: 'customers',
    name: 'Customer list',
    category: 'lists',
    query: 'page=customers&skin=underline',
    blurb: 'Your customers in a list: a search that suggests as you type, filters, grouping and saved searches; columns that sort, pages to turn, actions for the customers ticked, and a click to open one.',
    howTo: [
      'Type "egy" in the search box and pick "Search Country for: egy" with the arrow keys and Enter.',
      'Open the menu at the end of the box: turn on Active, then group by Country and Status, and open the groups.',
      'Click the Credit limit header, twice: the list goes one way, then the other.',
      'Tick two customers and press Archive: you are asked first, then the app is given those two, and a note says so.',
      'Save the search as a favourite used by default, and reload: it opens that way.',
      'Click a row to open that customer on its own page.',
    ],
  },
  {
    id: 'invoices',
    name: 'Invoices that add up',
    category: 'lists',
    query: 'page=invoices&skin=underline',
    blurb: 'Invoices that add up: a total under the list, a sum on each group and for the invoices ticked, each currency added up on its own; this month, overdue and other periods counted from today; invoices grouped by month, quarter or week; and every one that matches printed, grouped and totalled.',
    howTo: [
      'The list opens on This year: the total of this year’s invoices is under the Amount column.',
      'Tick three invoices: a row over the total says “3 selected” and adds up those three.',
      'Open the menu at the end of the search box and turn on Overdue: the invoices sent and not paid by their due date, counted from today.',
      'Under Group By, press Month beside Invoice date: a heading for each month, its count and its sum — “October 2026 (4) · EGP 812.5K”.',
      'Take This year away, then group by City: Dubai’s invoices are in dollars, summed in dollars; the list’s total has none, as no honest sum of pounds and dollars exists.',
      'Add a custom filter: Invoice date, in the period, Last 7 days. Save it as a favourite: it is the last seven days whenever it is used.',
      'Group by Customer and press Print: every invoice the search finds — not just this page — under its customer with its sum, the total under them, and over them the filters in words and the day.',
    ],
  },
  {
    id: 'contacts',
    name: 'Contacts to bring in, take away, change in bulk and shape',
    category: 'lists',
    query: 'page=contacts&skin=underline',
    blurb: 'A list of 1,284 contacts: import more from an Excel or CSV file — its columns matched to the fields, every row checked before anything is saved, the rows refused named with why, and Undo — select every one that matches, export the rows ticked or all of them, and set one field on many at once, each record’s permissions kept. Show, hide, order — by dragging a header too — and size its columns, kept for you; on a phone, each contact is a card.',
    howTo: [
      'Download [the sample workbook](samples/contacts-to-import.xlsx), press Import and drop it on the box: its columns are matched to the fields, and Full name and Notes are left out.',
      'Pick Name for Full name, then Check 17 rows: 10 can be imported, and 7 cannot — an owner two users are called, a name missing, a status, a country and an owner nobody is called, a 31 February, a newsletter of “maybe” — each said by its row.',
      'Press “Download the rows to fix” for a workbook of those seven, with why in a last column; then Import 10 contacts, and Undo the import under the list.',
      'Import [the sample CSV file](samples/contacts-to-import.csv): its semicolons and its Arabic names are read as they are, its days day first.',
      'Tick the box in the header, then press “Select all 1,284 contacts that match”: turn a page, and its rows are ticked too.',
      'Press Export and pick Excel: the workbook has the columns as the list shows them, money with its currency and days as days.',
      'Search for a company, tick a few rows, press Edit, pick Owner and a person, then Update: say Yes to the question.',
      '[Try it with a server that hands over at most 1,000 at once](?allIds=1000), then tick the header’s box and press Select all: “1,000 of 1,284 could be selected”, never “all”.',
      'Press Columns at the header’s end: tick Phone, move it up beside Name, and untick Country. Reload: the list is as you left it. Reset puts back the page’s.',
      'Search for a company, then press Print: the contacts it finds on paper, in the columns you show, in their order — as Export writes them.',
      'Drag the Company header sideways past Status and let go: the column follows, the others slide aside, and it stays there after a reload. Press Escape mid-drag to put it back; on a phone or tablet, rest a finger on a header to lift its column.',
      'Drag the edge of a header to make its column wider; scroll the list sideways: the names stay in view, the header over the rows.',
      'Narrow the window, or open the page on a phone: each contact is a card — a photo or their initials, their status as a pill, a phone with Call and WhatsApp.',
    ],
  },
  {
    id: 'leads-queue',
    name: 'A sales team’s queue, its filters counted',
    category: 'lists',
    query: 'page=leads-queue&skin=underline',
    blurb: 'Buyer leads to follow up: the search menu says how many each filter finds — Late 5, Today 3, No agent yet — counted with the rest of the search as it changes, and so does each search a person keeps. A follow-up that is late is in red.',
    howTo: [
      'Press the arrow at the search box’s end: Late says 5, Today 3. Press Late: the five late follow-ups.',
      'Type “Mona” in the search and pick Search Agent for: Mona: every filter counts Mona’s leads alone.',
      'Save the search as “Mona’s” under Favourites: it says how many it finds too.',
      'Add a custom filter: Budget, is between, 5,000,000 and 15,000,000 — one chip, “Budget: E£ 5,000,000 – E£ 15,000,000”.',
    ],
  },
  {
    id: 'homes-gallery',
    name: 'Homes for sale, as a gallery',
    category: 'lists',
    query: 'page=homes-gallery&skin=underline',
    blurb: 'Homes for sale and to rent as a gallery: a card each, its photo large, its price leading, where it is and how big, its offer as a pill and a button to book a viewing. A list a press away; one card to a line on a phone.',
    howTo: [
      'Press Book a viewing on a card: the app is given that home alone, and a note says so, as no app stands behind the demo.',
      'Tick two cards by the box on their photos, then press Share with a buyer: the app is given both.',
      'Group By District: a heading over each district’s cards, its count beside it.',
      'Press List over the cards: the same homes as rows, each with a small photo; press Gallery to go back.',
      'Use the arrow keys on a card: left and right along the line, up and down to the card above or below.',
    ],
  },
  {
    id: 'homes-search',
    name: 'Homes to buy, filtered as a buyer filters them',
    category: 'lists',
    query: 'page=homes-search&skin=underline',
    blurb: 'A portal’s homes for sale: beside each type, district and amenity how many homes it finds among the rest of the search; the price and the area from and to, bedrooms 2+ and the day listed — each one chip; and on a phone every filter in one sheet whose button says how many homes it will show before it shows them.',
    howTo: [
      'Open Type: each type says how many homes it finds. Tick Villa, then open Amenities: the counts are the villas’ now.',
      'Open Bedrooms and press 2+: the button says “Bedrooms: 2+”, and only homes with two bedrooms or more are left.',
      'Open Price and type 5,000,000 in From and 15,000,000 in To, then press Enter: one filter, “Price: E£ 5M – E£ 15M”.',
      'Type 300 in Area’s From and 100 in its To: it says “From is more than To” and keeps what you typed; nothing is filtered by it until you mend it.',
      'Narrow the window, or open the page on a phone: one Filters button opens every filter in a sheet. Tick Villa: “Show 5 homes” counts them as you go, and only Show filters the list; × lets what you ticked go.',
      'Press × at the bar’s end: every filter is cleared.',
    ],
  },
  {
    id: 'customer-account',
    name: 'A customer with its invoices and quotations',
    category: 'records',
    query: 'page=customer-account&record=1&skin=underline',
    blurb: 'Another kind of record listed inside this one: the customer’s invoices under its details, its quotations in a tab that counts them, each opened on its own page by the app’s own route — a page at a time, searched, sorted and counted, their total under them, New making one for this customer, and View all opening the invoices list kept to this customer.',
    howTo: [
      'Under the details, Invoices says how many this customer has, and lists the latest five, their total under them.',
      'An invoice sent and past its due date is in red, a draft in bold; one sent has Send a reminder on its row: the app is given that invoice alone, and a note says so, as no app stands behind the demo.',
      'Press › beside the pager for the next five, or type “paid” in the search and pick Search Status for: paid.',
      'Click Amount’s header: the invoices in their amount’s order.',
      'Press New invoice: a new invoice opens in a dialog, its customer filled in. Give it a number and an amount and save: it is in the list, and the count is one more.',
      'Press View all invoices: the invoices list opens, kept to this customer’s.',
      'The Quotations tab says how many quotations this customer has before it is opened. Open it: its own list, the lost ones left out. Press › on the pager over the record: the next customer’s invoices and quotations, and their count on the tab, never the last one’s.',
      'In the Quotations tab, click a quotation: it opens on its own page, by the app’s own route, not in a dialog. Back, then New quotation: a new quotation’s page, this customer filled in.',
      '[Start a new customer](?record=new): the lists say nothing points at it until it is saved.',
    ],
  },
  {
    id: 'property',
    name: 'A property and its viewings',
    category: 'records',
    query: 'page=property&record=1&skin=underline',
    blurb: 'A home with the viewings booked for it, listed inside the record: when, the client and their phone as people read it, the agent and how it went — the latest first, New booking one for this home, View all opening every viewing of it in a dialog.',
    howTo: [
      'Viewings lists this home’s, the latest first, five at a time, and says how many there are.',
      'Press New viewing: a viewing opens in a dialog, its home filled in. Pick a time and a client and save: it joins the list.',
      'Click a viewing: it opens in a dialog to change; saved, the list shows it changed.',
      'Press View all viewings: every viewing of this home, in a dialog, to search, group and page through.',
      'Press › on the pager over the record, twice: the third home has had no viewings, and says “No viewings yet.”',
    ],
  },
  {
    id: 'listing',
    name: 'A listing by its type',
    category: 'records',
    query: 'page=listing&record=new&skin=underline',
    blurb: 'A home put up for sale whose features follow its type — a garden and a pool only for a villa, a roof terrace only for an apartment — its price per m², handover and building’s age worked out as you type, and the district’s average asked of the app’s own server, the comparison waiting for its answer.',
    howTo: [
      'Pick Villa: Garden, Private pool and Garage are offered, Balcony and Lift are not. Tick Garden, then pick Apartment: Garden is taken out, and the form says so under Features.',
      'Type an area of 123 and a price of 6,000,000: the price per m² is EGP 48,780.49, rounded to the piastre as the pound keeps it.',
      'Pick a district: its average per m² shows “…” while the app’s server is asked, then the listing against it in per cent.',
      'Type 18 in Handover in (months): Handed over by is a year and a half after today; a built-on date gives the building’s age in whole years.',
      'Save while the district’s average is still asked: the save waits for it.',
    ],
  },
  {
    id: 'enquiry',
    name: 'A buyer’s enquiry and the conversation with them',
    category: 'records',
    query: 'page=enquiry&skin=underline',
    blurb: 'The request page of a buyer’s enquiry about a home, the conversation beside it as an agency has it: WhatsApp, e-mail, a text message and the team’s notes mixed, each saying its channel, ticks on what went out — sent, delivered, read, or why it failed —, a reply by the buyer’s own channel, messages arriving while you read, and follow-ups at an hour on the office’s clock.',
    howTo: [
      'Press Send message: the reply goes by WhatsApp, the channel Yasmin last wrote on, to her number. Type a few words and press Send by WhatsApp: one tick, then two as her phone gets it.',
      'Press Yasmin reads your WhatsApp messages over the page: the grey ticks on what you sent her turn blue.',
      'Start a reply, then press Yasmin writes on WhatsApp: her message arrives at the top of the conversation, and what you are typing stays as it is.',
      'Look at the conversation: her first e-mail, your answer with the floor plan (read), a text message that failed and why, Karim’s team note — each says its channel.',
      'Look at Activities: Call Yasmin to confirm Thursday is due at 15:30 today on the office’s clock in Cairo, wherever you look from; Schedule activity takes a time as well as a day.',
      '[Open Omar Said’s enquiry](?record=2): he has no e-mail, so a reply goes by WhatsApp or SMS, and E-mail is not offered.',
    ],
  },
  {
    id: 'customer-card',
    name: 'A customer typed twice',
    category: 'records',
    query: 'page=customer-card&record=new&skin=underline',
    blurb: 'A new customer typed with a phone or an email you have already: the customers like it are named under the box a moment after you stop typing — to open instead, to say it is a new customer, or, once saved, to merge, the two side by side and a value picked for each field. Save is never in the way.',
    howTo: [
      'Type 02 2345 6789 in Phone and leave it: “A customer with this phone already exists: Nile Traders”, under the box.',
      'Press Open it: you are asked before what you typed goes, and Nile Traders opens in its place.',
      'Start a new customer, type orders@niletraders.example in Email: two customers have it. Press It’s a new customer on one: it goes, and stays gone for this customer.',
      'Press Open it on Nile Traders Co.: it opens, said to be like Nile Traders. Press Merge…: the two side by side, Nile Traders kept, its empty Tax ID and Website taking Nile Traders Co.’s.',
      'Pick a value of your own in a row, then Merge: Nile Traders Co. is gone, and Nile Traders opens with the values picked.',
    ],
  },
  {
    id: 'clinic-consent',
    name: 'A consent signed, with its evidence',
    category: 'records',
    query: 'page=clinic-consent&record=new&skin=outlined',
    blurb: 'A clinic’s consent to treatment the patient signs on the page: who signed and when kept with the signature, and a fingerprint of the answers signed. Signed, the answers are locked; changing one takes the signature away to sign again, and a consent whose answer was changed after signing says so.',
    howTo: [
      'Type a patient’s name, a date of birth, a treatment and an area, tick that you read the risks, then sign on the pad: “Signed by” the patient, today and now, and “The answers are as they were signed.”',
      'Try to change the treatment: it is locked. Point at its lock: it says how to change it.',
      'Press Change answers, then Change answers again: the signature is taken away, the answers open. Change one, and sign again.',
      'Sign before the answers are all given: it says which to put right first, and keeps what you drew.',
      'Save, then [open Mona Adel’s consent](?record=1): signed on 14 October, its answers as signed.',
      '[Open Hana Fouad’s](?record=2): Cheeks was added in the clinic’s system after she signed — “An answer has changed since it was signed.”',
    ],
  },
  {
    id: 'event-signup',
    name: 'An event’s sign-up, with places and a closing date',
    category: 'forms',
    query: 'page=event-signup&skin=outlined',
    blurb: 'A sign-up that knows its limits: when it opens and closes on Cairo’s clock, the most it takes, one from each person, and the places left in each session — Full shown, never hidden, and refused when picked. A closed form says so before anything is typed; a place someone else took meanwhile is said as the answers go, and nothing is sent.',
    howTo: [
      'Look at the sessions: the morning workshop has 2 places left, the afternoon one is Full, and so is the parking.',
      'Pick the afternoon workshop: “… is full”, under the question, and your choice stays as it was.',
      'Pick the morning workshop, press “Two people sign up for the morning workshop” over the form, then fill in your name and email and press Submit: the morning is “full now: choose another”, and nothing is sent.',
      'Pick the evening talk and Submit: the page says your place and the email your ticket goes to — with no second response offered, as the page takes one from each person. Reload to start again.',
      '[Open it before sign-ups open](?now=2020-01-01T08:00:00Z): it says when it opens, in place of its questions.',
      '[Open it after they close](?now=2099-01-01T08:00:00Z): it says when it closed, and who to write to.',
    ],
  },
  {
    id: 'clinic-intake',
    name: 'A long intake, continued on another device',
    category: 'forms',
    query: 'page=clinic-intake&skin=outlined',
    blurb: 'Six steps before a first visit, started on a phone and finished on a laptop: Continue later keeps the answers on the clinic’s server — the step reached, and anything typed that does not read yet — with a link to carry on from. The answers are kept as they are typed too, so the clinic sees where people stopped.',
    howTo: [
      'Fill in About you, press Next, and start on Your visit.',
      'Press Continue later: your answers are saved, with a link to continue from. Press Copy link.',
      'Open the link in a new tab, as you would on your laptop: the form opens at Your visit, your answers in place.',
      '[Continue Mona Adel’s intake](?resume=mona-adel), started on her phone: it opens at Medical history, her answers before it filled in.',
      '[Open a link to an intake that was sent already](?resume=sent-long-ago): the form says it could not find those answers, and starts empty.',
    ],
  },
  {
    id: 'backlog',
    name: 'Work item in a popup',
    category: 'records',
    // A tracker's page of its own round Fieldia's list, a bug opened over it in Fieldia's popup: no framework, no look to switch.
    app: 'backlog',
    query: '',
    // Its code is the app's own: the list mounted in its page, a row's bug opened in the popup. It follows the reader's scheme.
    code: 'backlog',
    schemes: true,
    blurb: 'A team’s list of bugs, and one opened in a large window over it, as a work tracker shows it: its type’s colour, a quiet top with its state, reason, area and sprint, three columns of details, a discussion, links, and its history.',
    howTo: [
      'Click a bug in the backlog: it opens in a large popup over the list.',
      'Open Area and Iteration: Suggestions first, then the tree with each sprint’s dates.',
      'Click into System Info: the toolbar appears inside the box.',
      'Write a comment and Save it: the count in the head follows.',
      'Open the History tab: the State Graph, then each change with its before and after.',
    ],
  },
  {
    id: 'work-item',
    name: 'Work item, quiet',
    category: 'records',
    query: 'page=work-item&skin=quiet',
    blurb: 'A bug in the quiet look, as Azure DevOps shows a work item: each value plain words until you point at it, then a light box, then its editor once clicked; a field the workflow locks says why. Switch to Underline or Outlined above the form to see the same bug in boxes.',
    howTo: [
      'Point at Area: a light box and its chevron appear, and nothing moves. Click it: its options open.',
      'Click State and pick Active from its dots: Reason, locked while the bug was resolved, opens to change.',
      'Point at the lock by Reason while the bug is Resolved: it says why it is locked.',
      'Press Tab through the header: each field shows its editor with a ring; Escape puts back what it held.',
      'Pick Underline or Outlined above the form: every field is a box again, the header too. Quiet brings the words back.',
    ],
  },
  {
    id: 'fields',
    name: 'Every field',
    category: 'fields',
    query: 'page=fields&skin=outlined',
    blurb: 'One record with every kind of field: text, numbers and money, choices, dates, links to other records, lines, files and pictures, formatted text and structured data, in sections that fold.',
    howTo: [
      'Fold a section by its title, and open it again.',
      'Type a number into Budget: it is grouped as you type, and its currency can be picked beside it.',
      'Open the calendar of the start date: it shows the weeks’ numbers.',
      'Add tags to a field of tags, and a new one by its name.',
      'Format text in the rich text box with its toolbar.',
      'Add files to Documents: each shows as a card, its name under its picture. Switch them to a list with the buttons over them.',
    ],
  },
  {
    id: 'listing-photos',
    name: 'Photos stored as they are picked',
    category: 'fields',
    // Its bar takes ten photos as a phone does: the plain page alone, its code the store's own (demos/snippets.mjs).
    app: 'plain',
    query: 'page=listing-photos&skin=outlined',
    code: 'uploads',
    blurb: 'A home’s listing whose photos go to the app’s store as each is picked: made smaller on the phone first, a bar for each as it goes over a slow connection, × to cancel one, Retry for one that fails. The record keeps only the links, and Save waits for photos still on their way, saying how many.',
    howTo: [
      'Press Add 10 phone photos over the listing: ten photos of 12 megapixels, as a phone takes them, each made smaller to 1600 pixels before it goes.',
      'Watch three go at once over the slow connection, each with its bar and how far it has got; the rest wait their turn.',
      'Balcony view fails on its first try: press Retry on it.',
      'Press Save while photos are still going: it waits, and says how many are left. Press × on one still going to cancel it.',
      'Pick photos of your own with Add photos, or take one with a phone’s camera.',
      'Open the Code drawer: this store is the memory source slowed down; your app gives upload(), with uploadTo({ url }) for a plain endpoint or a signed address for Azure Blob.',
    ],
  },
  {
    id: 'kinds',
    name: 'Office move',
    category: 'fields',
    query: 'page=kinds&skin=outlined',
    blurb: 'Newer kinds of question in one survey: sliders, tags, an address, choices with pictures, a ranking, a group that repeats, a quiz question with points and a signature — and a moving day that keeps its limits, a time, a weight in kilograms, hearts and a 0 to 10 “would you recommend us” scale.',
    howTo: [
      'Drag a slider, or move it with the arrow keys: its value shows beside it.',
      'On Moving day, pick a Friday, or a day three months away: each is refused, saying why.',
      'Type a phone number with too few digits and leave it: it says how to write one.',
      'Pick a desk by its picture, then put what matters most in order by dragging, or with Alt and the arrow keys.',
      'Add a person who moves with you: each one is a small card of its own.',
      'Sign with the mouse or a finger, or type your name instead.',
    ],
  },
  {
    id: 'business',
    name: 'Business fields',
    category: 'fields',
    query: 'page=business&skin=underline',
    blurb: 'The fields business screens lean on, on one fit-out task: priority stars and a status dot by the title, a running timer, hours as HH:MM, a range of dates, coloured tags, values to copy, a PDF shown in the page, costs split across accounts, tax totals, payments, and the extra details each project adds.',
    howTo: [
      'Click the third star by the title: the priority goes up; click it again and it goes back to none.',
      'Open the dot after the title and pick Blocked: it turns red.',
      'Press Start timer: the time logged starts running; Stop timer and log adds the minutes it ran.',
      'Pick a range of dates on the calendar: the first day, then the last.',
      'Change the project: its own properties take the task’s, and Add a property adds one of your own.',
      'In Invoicing, type a share for an account, and correct a tax amount: the total follows.',
    ],
  },
  {
    id: 'code',
    name: 'Code in many languages',
    category: 'fields',
    // VS Code's editor is in the plain demo alone: the code page is shown there.
    app: 'plain',
    query: 'page=code&skin=outlined',
    blurb: 'Code fields coloured in their own language, in either of two editors: CodeMirror, light and quick, or VS Code’s own. The Editor switch at the top shows every field in one or the other, or each where it fits; each language loads only when a field shows it.',
    howTo: [
      'Press VS Code at the top: every field is drawn in VS Code’s editor. Press CodeMirror: the same fields in CodeMirror, to compare.',
      'Type in the cleanup script: Python’s keywords take their colour as you type.',
      'Press Tab in any editor: the focus moves on to the next field, as it does from any box.',
      'Break the sample payload’s JSON: it says so, and keeps the last good value.',
      'Click in the webhook handler and press Ctrl+F: VS Code’s find opens over the code.',
    ],
  },
  {
    id: 'signup',
    name: 'Workshop sign-up',
    category: 'forms',
    query: 'page=signup&skin=outlined',
    blurb: 'A sign-up in sections: questions that appear only when they apply, checks as you type, a phone number from any country, your browser filling in what it knows, a check for bots, and the response sent when it is done.',
    howTo: [
      'Choose "Something else" as your role: a question appears to say what it is.',
      'Choose Manager: a question about your team appears instead.',
      'Turn on “Joining the dinner”: a question about what you eat appears.',
      'Type an email without an @ and leave the field: it says what is wrong.',
      'Click in Full name and pick one of your browser’s saved addresses: your name, email, company and phone are filled in, each box saying what it holds.',
      'Submit with a required question empty: the form takes you to it.',
      'Send it within three seconds, or without ticking “I am a person”: it is still sent, and under the form you see what the app was told.',
    ],
  },
  {
    id: 'layout',
    name: 'New employee',
    category: 'forms',
    query: 'page=layout&skin=outlined',
    blurb: 'A form laid out on columns: a photo beside a block of fields, two groups side by side, tabs with a framed group whose labels sit beside their boxes, and the page’s own accent, room and corners.',
    howTo: [
      'Narrow the window: Personal details keeps its three columns on a tablet and goes to one on a phone, its fields always on the same columns as the photo.',
      'Open the Pay tab: the bank’s labels sit beside their boxes, and go above them once a box gets narrow.',
      'Choose a fixed-term contract on the Job tab: Contract ends takes its place on the columns. Give it a day before the start date: it is refused.',
      'See the page [in Arabic, right to left](?locale=ar&dir=rtl), or [in its dark scheme](?scheme=dark).',
    ],
  },
  {
    id: 'survey',
    name: 'Product survey',
    category: 'forms',
    query: 'page=survey&skin=outlined',
    blurb: 'A survey in steps that skips what does not apply: one path for people who use the product, another for those who do not, steps to click back to, and a step that can be skipped.',
    howTo: [
      'Answer that you use the product: "Your experience" comes next; answer that you do not, and "Why not" comes instead.',
      'Click a step in the list to go back to it.',
      'Press Skip on the optional step: its answers are left out.',
      'Send the answers on the last step.',
    ],
  },
  {
    id: 'delivery',
    name: 'A saved form, placed twice',
    category: 'forms',
    query: 'page=delivery&skin=outlined',
    blurb: 'One Address form, made once and saved, placed twice in a delivery form: each copy answers apart, under a name of its own, and asks for its own required fields in its own words.',
    howTo: [
      'Press Submit with the address empty: Street and number and City refuse, in their own words, inside the Delivery address.',
      'Tick “Send the invoice to another address”: the same Address form comes again, for the billing address.',
      'Fill both and send: the app gets the answers nested, { "delivery_address": { … }, "billing_address": { … } }.',
    ],
  },
  {
    id: 'visit-feedback',
    name: 'After your visit',
    category: 'forms',
    query: 'page=visit-feedback&skin=outlined',
    blurb: 'A clinic’s feedback whose later questions offer what was ticked in the first: the treatments you had again, those you did not to try, an age worked out from a birth date, and options shown only when the answers allow them.',
    howTo: [
      'Tick Botox and Chemical peel: “Which would you have again?” offers those two and None of them; “Which would you like to try next time?” the three you did not tick.',
      'Pick Chemical peel to have again, then untick it above: it is taken out below, and the form says so.',
      'Type a date of birth: your age shows, worked out on the page’s clock; under 18, “Laser packages for adults” is not offered.',
      'Tick None of these: the follow-up questions go, and so does “Offers on what you had”.',
    ],
  },
  {
    id: 'rules',
    name: 'Totals and answer rules',
    category: 'forms',
    query: 'page=rules&skin=outlined',
    blurb: 'An order whose subtotals, total and amount to pay work themselves out as you type, a discount that sets itself past a threshold, and checks on the answers: one that only warns, and ones that stop the form.',
    howTo: [
      'Change a quantity or a price: the line’s subtotal, the total and the amount to pay follow.',
      'Add a line that takes the total past EGP 1,000: the discount sets itself to 10%. Change it if you like: it stays as you set it.',
      'Type an email outside @niletraders.example and leave the field: a warning shows under it, and the form still sends.',
      'Type a postcode of four digits, tick one delivery day, and send: the form stops, saying what is wrong under each.',
    ],
  },
  {
    id: 'lists',
    name: 'Delivery address',
    category: 'forms',
    query: 'page=lists&skin=outlined',
    blurb: 'Choices from your own lists: the countries you deliver to and each one’s cities, asked for again when the country changes.',
    howTo: [
      'Watch the countries load as the form opens: the app answers after a moment, as a server does.',
      'Pick Egypt: its cities load. Pick Alexandria.',
      'Change the country to Jordan: Jordan’s cities load, and Alexandria, which Jordan does not have, is taken out and said under the cities until you pick again.',
    ],
  },
  {
    id: 'agent-tools',
    name: 'An AI agent’s tools',
    category: 'records',
    query: 'page=agent-tools&skin=underline',
    blurb: 'An assistant’s tools in a table of lines, each from one of the company’s connections: a line’s Tool offers only its own connection’s, asked for again when the connection changes — in the plain table and in the grid alike.',
    howTo: [
      'Open Tool on the first line, then on the Slack line: each offers its own connection’s tools.',
      'Change the first line’s connection to Slack: its tools load again, and Send an email, which Slack does not have, is taken out and said under the cell. The second line’s Search, changed to Slack too, stays: Slack searches as well.',
      'In When it starts, change a start’s connection: its event is said again in the new connection’s words, or taken out and said aloud.',
    ],
  },
  {
    id: 'map-delivery',
    name: 'A place on a map',
    category: 'fields',
    query: 'page=map-delivery&skin=outlined',
    blurb: 'A delivery address with its place on a map: found by searching, by a press on the map, from where you are, or typed as coordinates. Any map provider; OpenStreetMap here.',
    howTo: [
      'Type an address in the search box and press Enter, then pick a place from the list: the pin drops there and Address fills in.',
      'Press the map anywhere: the pin moves there. Drag it to the door.',
      'Tab to the map and press Enter: the place goes to the cross at its centre. The arrow keys move the map, plus and minus zoom.',
      'Type a latitude and a longitude under the map: the pin follows.',
    ],
  },
  {
    id: 'map-address',
    name: 'An address as you type',
    category: 'fields',
    query: 'page=map-address&skin=outlined',
    blurb: 'An address on one line, with the map service’s suggestions under it as you type and no map of its own. Pick one: the address’s parts and its place on the map fill in. Or keep what you typed.',
    howTo: [
      'Type a street in Egypt, such as Tahrir: the suggestions come as the typing pauses.',
      'Press the down arrow to move through them and Enter to pick one: Address in parts and the map fill in.',
      'Type an address of your own and press Escape: the list closes and your words stay.',
    ],
  },
  {
    id: 'map-zone',
    name: 'An area on a map',
    category: 'fields',
    query: 'page=map-zone&skin=outlined',
    blurb: 'A delivery zone drawn on a map — a shape of your own, a box or a circle — or picked from named ones. Drag its corners and edges to change it.',
    howTo: [
      'Press Polygon and click points on the map; click the first point again, double-click, or press Enter to close it.',
      'Press Box and drag across the map, or Circle and drag out from its centre.',
      'Drag a point or a corner to reshape the area, the small point between two to add one, or the area itself to move it.',
      'Choose “Within 2 km of Tahrir Square” from the list instead of drawing.',
      'Without a mouse: Tab to the map, press Space to put points at the cross, and Enter to finish.',
    ],
  },
  {
    id: 'map-homes',
    name: 'Homes on a map',
    category: 'lists',
    query: 'page=map-homes&skin=outlined',
    blurb: 'A list of homes beside a map of them: each price short on its pin, the pound left unsaid and dollars named, rentals in blue and by the month, crowded pins as one bubble with their count. A pin lights its row and a row its pin; the search and the homes chosen are the same in both.',
    howTo: [
      'Point at a row: its pin lights up on the map. Point at a pin: its row lights up.',
      'Click a pin: its card opens with the picture, the price in bold, and the district, bedrooms and size on one line under it. Tick Choose: its row is chosen too, and Add to shortlist appears.',
      'The home’s name on its card is a link to its page: open it in a new tab, or copy it.',
      'Search Zamalek: a villa whose owner asks in dollars says “$ 4.6K/month” on its pin, a flat in pounds “10.8M”.',
      'Click a bubble: the map zooms in until its pins part.',
      'Move the map over Maadi and press Search this area: the list keeps only the homes there, and “In this area” joins the search bar.',
      'Press the box at the map’s corner and drag across the middle of the city: the list keeps the homes inside, “In the area drawn”. Take its chip away and the area goes too.',
      'Pick For rent from the search menu: the map keeps only the rentals.',
      'Press Map or List over the records to see one alone.',
    ],
  },
  {
    id: 'map-embed',
    name: 'A map in a page of your own',
    category: 'lists',
    // A page that is not Fieldia's, with its own list beside the map: no framework, no look of Fieldia's to switch.
    app: 'map-embed',
    query: '',
    // Its code is the page's own script, mountListMap and the page round it; it follows the reader's scheme.
    code: 'list-map',
    schemes: true,
    blurb: 'Homes for sale on a page that is not Fieldia’s: its own list, its own filter and its own address, with Fieldia’s map filling the column beside them. The map takes every gesture, opens where the address says, writes where it stands back into it, and says how many homes are in view before you search there.',
    howTo: [
      'Drag the map, and turn the wheel over it: it moves and zooms with no key held. On a phone, one finger moves it.',
      'Move the map: Search this area says how many homes are in view. Press it: the page’s own list keeps those, and the map stays where it is.',
      'Move the map again, then reload the page: the map opens where you left it, which the page keeps in its own address.',
      'Point at a home in the list: its pin lights up. Point at a pin: its home lights up in the list.',
      'Press To rent at the top: the page’s own filter, and the map follows it.',
      'Press a pin, then Open on its card: the page marks that home in its list.',
    ],
  },
  {
    id: 'map-homes-arabic',
    name: 'Homes on a map, right to left',
    category: 'lists',
    query: 'page=map-homes&skin=outlined&locale=ar&dir=rtl',
    blurb: 'The homes and their map right to left: each price short in Arabic words with Latin digits, cards written right to left, and each home’s English name still reading as it was typed.',
    howTo: [
      'Look at the pins: “10.8 مليون” for a flat in pounds, “/شهر” after a rent, dollars named.',
      'Click a pin: its card reads right to left, while the home’s English name and its “175 م²” keep their own order.',
      'Point at a row: its pin lights up, as on the English page.',
    ],
  },
  {
    id: 'map-couriers',
    name: 'Couriers on a map',
    category: 'lists',
    query: 'page=map-couriers&skin=outlined',
    blurb: 'Couriers on a map: a car, a scooter or a bike for each, facing the way it goes, green when free and amber when delivering — all set by the page itself.',
    howTo: [
      'Tab to the map, then on through the couriers: each is read out by name. Enter opens their card; Escape closes it.',
      'Ctrl-click (⌘-click) a courier: they are chosen, a tick on their icon.',
      'Press the circle at the map’s corner and drag out from a spot: only the couriers within it stay.',
      'Press List to see the same couriers as a table, and Map to come back.',
    ],
  },
  {
    id: 'map-order',
    name: 'An order on its way',
    category: 'records',
    query: 'page=map-order&skin=outlined&readonly=1',
    blurb: 'A map on an order’s page: the kitchen, your door, and the courier with the minutes left under their photo, gliding along the road as their place comes in, the road behind them fading.',
    howTo: [
      'Watch the courier: a new place every two seconds, the pin gliding along the road, Arrives in counting down.',
      'Drag the map away: it stops following the courier, and Follow brings it back.',
      'Press My location at the map’s corner: once you allow it, a dot shows where you are.',
      'Tab to the courier’s pin and press Enter: their card says how far they are.',
    ],
  },
  {
    id: 'map-round',
    name: 'A delivery round',
    category: 'records',
    query: 'page=map-round&skin=outlined',
    blurb: 'A van’s delivery round on a map: its stops numbered in their order and greyed once delivered, and the way from the van through them.',
    howTo: [
      'Tick Delivered on the third stop in the table: its number greys on the map.',
      'Delete the fourth stop from the table: it leaves the map, and the way is found again without it.',
      'Tab through the stops on the map and press Enter for one’s card.',
    ],
  },
  {
    id: 'map-zones',
    name: 'Orders by district',
    category: 'lists',
    query: 'page=map-zones&skin=outlined',
    blurb: 'The week’s orders beside a map of Cairo’s districts, each district shaded by how many orders it has, with a legend that says how many each shade means; a numbered bubble counts the orders close together, whichever district they are in. The borders are the app’s own: rough ones drawn for this demo.',
    howTo: [
      'Point at a district: it lights up and says its name and its orders.',
      'Click Zamalek: the list keeps its orders alone, and “In Zamalek” joins the search bar. Take the chip away to see them all again.',
      'Pick Not delivered from the search menu: the shades change to the orders still out.',
      'Tab to the districts on the map, move between them with the arrow keys, and press Enter for one.',
      'Press Nearest first under the zoom and allow your location (or not: the middle of the map is used): the orders nearest come first in the table.',
      'Press the ruler and click points along the river: the way’s length is said as it grows. Double-click to finish.',
    ],
  },
  {
    id: 'map-heat',
    name: 'Orders as a heat map',
    category: 'lists',
    query: 'page=map-heat&skin=outlined',
    blurb: 'The same orders as a heat map, each weighing what it came to: the city glows where the money is. Close in, at the streets, each order’s pin comes back with its total.',
    howTo: [
      'Zoom in on Mohandessin until the streets show: the glow gives way to each order’s pin.',
      'Pick Over EGP 800 from the search menu: the heat map keeps the big orders alone.',
      'Press Full screen under the zoom; Escape brings it back.',
    ],
  },
  {
    id: 'clinic-calendar',
    name: 'A clinic’s appointments',
    category: 'lists',
    query: 'page=clinic-calendar&skin=outlined',
    blurb: 'A clinic’s day on a calendar, a column for each doctor, each visit coloured by its service. Drag a visit to another time or doctor, stretch it by its lower edge, or press an empty time for a new one; Undo puts a move back. The week, the month and an agenda are a press away, and the search and filters work on the calendar too.',
    howTo: [
      'Drag a visit to another doctor’s column, or to later in the day: it is saved at once, and Undo puts it back.',
      'Drag a visit’s lower edge down: it takes longer.',
      'Press an empty slot, or drag down across a few: a new appointment opens with its doctor, its start and its end filled in.',
      'Without a mouse: Tab to a visit and press M for Move to…, which takes a day, a time and a doctor. The arrow keys move between the slots; Enter on one makes a new appointment there.',
      'Pick Scans from the search menu: the calendar keeps the scans alone.',
      'Press Week, Month or Agenda over the calendar; on a phone it opens on the agenda.',
    ],
  },
  {
    id: 'booking-week',
    name: 'The booking desk’s week',
    category: 'lists',
    query: 'page=booking-week&skin=outlined',
    blurb: 'A booking desk’s week from Saturday: viewings, consultations and signings, each in its day at its time with the agent it is with. Drag one to another day, press a day’s name for that day by agent, or step back and on a week at a time.',
    howTo: [
      'Drag a booking to another day: it keeps its length, and the line under the bar says where it went, with Undo.',
      'Press a day’s name over its column: that day, a column for each agent.',
      'Press the arrows beside Today to step a week back or on; Page Up and Page Down do the same from the keyboard.',
      'Drag down across an empty afternoon: a booking opens for just that time.',
    ],
  },
  {
    id: 'booking-week-arabic',
    name: 'The booking desk, right to left',
    category: 'lists',
    query: 'page=booking-week&skin=outlined&locale=ar&dir=rtl',
    blurb: 'The same week in Arabic: Saturday at the right, the days running to the left, the times and the dates in Arabic words with Latin digits, and each customer’s name as it was typed.',
    howTo: [
      'Press the left arrow by Today: the next week, as the page reads.',
      'Tab to a booking and press M: Move to… in Arabic.',
    ],
  },
  {
    id: 'test-drive',
    name: 'A test drive, booked from the times free',
    category: 'fields',
    query: 'page=test-drive&skin=outlined&record=new',
    code: 'slots',
    blurb: 'A showroom in Berlin takes test drives: pick a car, then a day on the month — shaded by how it is booked, full days hatched, closed days faint, a staff day marked — and one of its free times. Every time is on Berlin’s clock, named beside it, wherever you book from; a time someone else books meanwhile is said, never booked twice.',
    howTo: [
      'Pick a car, then a day: its free times show beside the month. Another car has times of its own.',
      'Without a mouse: Tab to the month, move with the arrows (Page Up and Page Down by month), and its times follow; Enter goes to them, the arrows move among them, Enter books one.',
      'The next Wednesday is fully booked for the hatchback: hatched, with no times.',
      'Press Someone else books 10:00 over the form: on another screen, Tom books that time first. Now press 10:00 yourself: the page says it was just booked, and books nothing.',
      'Type a time in Call back at: it is on Berlin’s clock, CEST or CET beside it. Try 25/10/2026 02:30: it comes twice that night, and the box asks which.',
      'Open the Code drawer: the demo’s schedule, and the slots() your server gives.',
    ],
  },
  {
    id: 'test-drives',
    name: 'The showroom’s week of test drives, on a calendar',
    category: 'lists',
    query: 'page=test-drives&skin=outlined',
    blurb: 'The Berlin showroom’s week of test drives on a calendar, coloured by car. Every time is on Berlin’s clock, its name beside the week, wherever you look from: the week, today and the red line for now are Berlin’s, and a drive dragged to another time, or made from an empty slot, is set for that time in Berlin.',
    howTo: [
      'Look from another time zone (your own, if you are not in Berlin): each drive is at its Berlin time, and CEST or CET stands beside the week.',
      'Drag a drive to another time or day: it keeps its 45 minutes, and the line under the bar says where it went, with Undo.',
      'Press a day’s name: that day, a column for each car. Press an empty slot: a test drive opens at that time in Berlin, the car filled in.',
    ],
  },
  {
    id: 'map-kitchen',
    name: 'A kitchen’s map',
    category: 'records',
    query: 'page=map-kitchen&skin=outlined',
    blurb: 'A kitchen’s evening on one map: the districts shaded by their delivery fee, the area within fifteen minutes’ drive, and the courier on the way. As the courier reaches the drop-off zone, the page notices by itself and ticks it.',
    howTo: [
      'Click Mohandessin on the map: Tonight’s offer goes to Mohandessin, and its border is drawn strong.',
      'Watch the courier ride to Zamalek: as they cross into the drop-off zone, the page says so and In the drop-off zone is ticked.',
      'Draw a new drop-off zone under the map, round the courier’s way: the step runs when they reach it.',
      'Tab to the districts and press Enter on one to choose it without a mouse.',
    ],
  },
  {
    id: 'custom',
    name: 'Your own parts',
    category: 'fields',
    query: 'page=custom&skin=outlined',
    blurb: 'A conference badge: the name goes into a field your app draws itself, which shows the badge as it will be printed, and the printing desk under it is a panel your app fills, with a count of its own. In React, Vue and Angular, each is that framework’s own component.',
    howTo: [
      'Type a name: the app’s own field shows the badge as it will be printed, as you type.',
      'Press Print the badge in the desk below: its count is the desk’s own, and it keeps it as the form changes; its words follow the name.',
      'Clear the name and press Submit: the app’s own field is checked like any other, and says what it needs.',
      'Switch framework at the top: the same parts are written as React, Vue and Angular components.',
    ],
  },
  {
    id: 'contained',
    name: 'A part that fails',
    category: 'fields',
    // Its parts fail on purpose, and the console is told so: what it shows, not a fault (e2e/demos-shell.spec.ts).
    failsOnPurpose: true,
    query: 'page=contained&skin=outlined',
    blurb: 'Your own parts can have bugs. Here the app’s price tag fails for four-digit prices, and its delivery planner fails as it loads. Each shows a small box that names it, your app is told, and the rest of the form works and saves.',
    howTo: [
      'Look under Quote: the delivery planner failed as it loaded, and a box says so in its place.',
      'Type 1200 in Price: the price tag fails, and a box naming Price takes its place.',
      'Change the customer and the notes, then press Save: the rest of the form works, and the quote is saved.',
      'Read the log under the form: what your app was told of each failure, through the viewer’s onError, in words; open What onError was handed for what a developer would log.',
      'Switch framework at the top: the same two parts are React, Vue and Angular components, each kept to its place.',
    ],
  },
  {
    id: 'quick-order',
    name: 'Order by phone, in steps',
    category: 'behaviour',
    query: 'page=quick-order&skin=outlined',
    blurb: 'An order taken by phone, its buttons doing the work: a new customer made in a side panel and set on the order, the stock checked as a product is picked, the customer’s page opened in the order’s place, a question before the order is sent, and a word after.',
    howTo: [
      'Type a name under “Who is calling” and press New customer: a side panel opens with the name in it. Save it: the customer is set on the order, and “Customer added” shows at the foot of the screen.',
      'Pick a product: the app checks the stock, says how many are left, and gives the price; the total follows the quantity.',
      'Pick the standing desk: the app says it is out of stock, and the price stays empty.',
      'Press Customer’s page: the customer’s record takes the order’s place. Back brings the order back as it was.',
      'Press Submit with a field empty: the form shows what is missing. Fill it in, submit again, and answer OK to “Send the order?”: “Order sent”.',
    ],
  },
  {
    id: 'two-tabs',
    name: 'One record in two tabs',
    category: 'records',
    // Two forms on one data source, in a page of its own: no framework, no look of Fieldia's to switch.
    app: 'save-safety',
    query: '',
    // Its code is the page's own script, and a data source of your own that tells versions and rights.
    code: 'save-safety',
    schemes: true,
    blurb: 'A lead open in two tabs at once. Mona saves first; when you save, the form says who changed it and when, what each of you changed, and lets you Reload — your changes listed to put back — or Keep mine. Nothing is lost without a word.',
    howTo: [
      'Change the phone in your tab, then press Someone else edits this: Mona moves the lead on a stage and raises its budget in her tab, and saves.',
      'Press Save in your tab: Mona changed this record at the time she saved, what she changed, and Reload or Keep mine.',
      'Press Keep mine: your phone is saved, and Mona’s stage and budget stay.',
      'Or press Reload: Mona’s version shows, and your changes are listed, each with Put back.',
      'Point at the lock by Commission: only a manager sets it. Open the gear: Delete is not there, and it says why.',
    ],
  },
  {
    id: 'viewer-role',
    name: 'A record only to read',
    category: 'records',
    app: 'save-safety',
    query: 'role=viewer',
    code: 'save-safety',
    schemes: true,
    blurb: 'The same lead opened by Omar, a viewer: the app says he may only read it, so there is no Save and no Archive, Duplicate or Delete — hidden, not greyed out — the commission is not shown at all, and the record says why.',
    howTo: [
      'Read the line over the lead: why Omar may only read it, from the data source.',
      'Click a field: nothing can be typed. Ctrl+Enter saves nothing.',
      'Open the gear: Brochure alone, as nothing else is Omar’s to do.',
      'Press Agent at the top: the same lead as Sara sees it, open to change.',
    ],
  },
  {
    id: 'customer-locked',
    name: 'Read-only, then Edit',
    category: 'records',
    query: 'page=customer&skin=underline&readonly=1&editSwitch=1',
    blurb: 'A record shown read-only, as plain values, until Edit unlocks it; Done saves and locks it again.',
    howTo: [
      'Notice the values read as text: nothing can be typed in.',
      'Press Edit: the fields become editable.',
      'Change a field and press Done: the record is saved and locked again.',
    ],
  },
  {
    id: 'contract-fees',
    name: 'A contract’s fees, pasted as a table',
    category: 'records',
    query: 'page=contract-fees&skin=underline',
    blurb: 'A service agreement whose fees are a price table pasted from Word, Excel or Google Docs: kept as a plain table in the field’s own look — no widths, borders or fonts carried over — its rows and columns added and taken away where the cursor is, a header row, Tab from cell to cell, and on paper the table whole.',
    howTo: [
      'Copy a table from Word, Excel or Google Docs — or from [the sample price list](samples/price-list.html) — and paste it into 5. Payment schedule: it stays a table, in the page’s own look.',
      'Click a cell in 4. Fees and press Tab: the next cell’s words are selected. Tab in the last cell adds a row; Escape leaves the table.',
      'With the cursor in the table, press Table in the toolbar: insert a row or a column beside the cell, delete one, or turn the header row off.',
      'Press Ctrl+Z (⌘Z on a Mac): the last change to the table is taken back, as any typing is.',
      'With the cursor outside a table, press Table and pick 3 rows by 4 columns on its grid: a new table, its header row on, the cursor in its first cell.',
      'Press Print in the menu at the top: the agreement on paper, each table whole on a sheet where it fits.',
    ],
  },
  {
    id: 'reading',
    name: 'A dense record that reads at a glance',
    category: 'records',
    query: 'page=reading&skin=underline&editSwitch=1',
    blurb: 'A busy invoice that still reads at a glance: values as plain words, counters at the top with money, hours and two figures, the customer with the address under it, coloured tags, several details on one line, warnings that hold a date, keyboard keys on its buttons, and banners such as Paid when they apply.',
    howTo: [
      'Hold Alt: each header button shows its key. Alt+Shift+G sets the invoice back to Draft, Alt+V confirms it.',
      'Read the alerts: the lock date and the customer sit inside their words, and the duplicate alert has a button inside.',
      'Press Done: the parts for editing only — Add Credit Note, the note under the tags — go, and every field reads as words.',
      'Click Draft on the stages along the top: the time spent in each step shows on it, and Confirm takes the place of Send & Print.',
      'Open the Trust tab: an alert sits among its fields, with the amount inside its sentence.',
    ],
  },
  {
    id: 'vendor-bill',
    name: 'Around a record',
    category: 'records',
    query: 'page=vendor-bill&record=3&skin=underline',
    blurb: 'A vendor bill with what sits around it: the way back to the list and arrows to step through the bills, a menu with Print, Debit Note, Archive, Duplicate and Delete, the vendor’s PDF beside it, and the conversation with your team beside that on any screen it fits.',
    howTo: [
      'Press › beside “3 / 4” at the top (or Alt+N): the next bill comes, “4 / 4” after it, and round to the first; the PDF beside it follows.',
      'Open the gear menu with the arrow keys: Print, then Debit Note, Archive, Duplicate and Delete. Press Debit Note: the note is said and posted in the conversation.',
      'Press Duplicate: the copy shows as “… (copy)”, a draft, and the count beside the arrows is five.',
      'On BILL/2026/10/0002, press Archive and say yes: an Archived banner crosses it and the menu offers Unarchive.',
      'Make the window narrow: the PDF goes under the sheet, the conversation stays beside it until a phone’s width.',
    ],
  },
  {
    id: 'customers-arabic',
    name: 'Customer list, right to left',
    category: 'lists',
    query: 'page=customers&skin=underline&locale=ar&dir=rtl',
    blurb: 'The list in Arabic: its words, its pages and its search menu laid out right to left, with phone numbers and amounts still reading left to right.',
    howTo: [
      'Look at the phone numbers: they read left to right on a right-to-left page.',
      'Open the search menu: its groups run right to left.',
      'Page through the list: the arrows point the way the page reads.',
    ],
  },
  {
    id: 'customer-arabic',
    name: 'Customer record in Arabic',
    category: 'behaviour',
    query: 'page=customer&skin=underline&locale=ar&dir=rtl',
    blurb: 'The customer’s page laid out right to left, with Fieldia’s own words, messages and dates in Arabic.',
    howTo: [
      'Notice the page mirrored: the title, the stages and the tabs start on the right.',
      'Empty a required field and save: the message comes in Arabic.',
    ],
  },
  {
    id: 'signup-french',
    name: 'Your app’s own translations',
    category: 'behaviour',
    query: 'page=signup&skin=outlined&translate=fr',
    blurb: 'The sign-up in French through your app’s own list of translations: every word of the page goes through it, and nothing typed does.',
    howTo: [
      'Read the page: its title, sections and questions come from the app’s French catalog.',
      'Type in a field: what you type is left as it is.',
    ],
  },
  {
    id: 'signup-keys',
    name: 'Enter to the next field',
    category: 'behaviour',
    query: 'page=signup&skin=outlined&enterToNext=1&showValid=1',
    blurb: 'Enter moves to the next field instead of sending the form, and a ✓ appears by each field once it is filled in right.',
    howTo: [
      'Type your name and press Enter: the cursor goes to the next field.',
      'Fill in an email correctly: a ✓ appears by its label.',
      'Press Ctrl+Enter (⌘+Enter on a Mac) to send from anywhere.',
    ],
  },
  {
    id: 'customer-toast',
    name: 'Saving, as a toast',
    category: 'behaviour',
    query: 'page=customer&skin=underline&saveStatus=toast',
    blurb: 'The save’s progress in a corner instead of beside Save: “Saving…”, then “Saved”, which goes after a moment.',
    howTo: ['Change a field and press Save: watch the corner of the page.'],
  },
  {
    id: 'script',
    name: 'One script tag',
    category: 'script',
    app: 'script',
    query: '',
    blurb: 'A call-back form on a plain web page, nothing to install: one line brings Fieldia in, the form is written as data, and one more line shows it.',
    howTo: [
      'Fill in the form and send it.',
      'Read the page’s source: one script tag, a page as JSON, and one call.',
    ],
  },
  // The template library, each in its theme: templates.mjs.
  ...TEMPLATE_DEMOS,
  // A working ERP's own screens, rebuilt in Fieldia: one file per lane in real/.
  ...REAL_DEMOS,
];

/** Where the code of the demos that are not one page of JSON lives in the repository: an app of its own, or a page made in code. */
const SOURCES = {
  backlog: 'demos/backlog/main.ts',
  'map-embed': 'demos/map-embed/main.ts',
  'two-tabs': 'demos/save-safety/main.ts',
  'viewer-role': 'demos/save-safety/main.ts',
  script: 'demos/script/index.html',
  code: 'demos/shared/code-page.ts',
  custom: 'demos/shared/custom-page.ts',
  contained: 'demos/shared/contained.ts',
};
/** The repository on GitHub, at its main line. */
export const GITHUB = 'https://github.com/fieldia-dev/fieldia';

/**
 * The file a demo is written in, in the repository: its page's JSON (examples/pages, or examples/templates for a
 * template), or the code of an app of its own. A browser test holds each to a file that is there.
 */
export function sourceOf(demo) {
  if (SOURCES[demo.id]) return SOURCES[demo.id];
  const page = new URLSearchParams(demo.query ?? '').get('page') ?? 'signup';
  return page.startsWith('template-') ? `examples/templates/${page.slice('template-'.length)}.page.json` : `examples/pages/${page}.page.json`;
}

/**
 * A how-to step's words and its links, each written as Markdown writes one: `[the sample workbook](samples/x.xlsx)` for
 * a file to try the demo with, served beside the demos (demos/samples), and `[Start a new customer](?record=new)` for
 * this demo with those settings in its address — so no step sends a person to the address bar, and a file a step names
 * is a press away in the step itself. `stepText` is a step's words alone, as the header and the tests read them.
 */
export function stepParts(step) {
  const parts = [];
  let at = 0;
  for (const link of step.matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)) {
    if (link.index > at) parts.push({ text: step.slice(at, link.index) });
    parts.push({ text: link[1], href: link[2] });
    at = link.index + link[0].length;
  }
  if (at < step.length) parts.push({ text: step.slice(at) });
  return parts;
}
export const stepText = (step) => stepParts(step).map((part) => part.text).join('');

/** A demo's address, from a demo page or from the site's /demos/: its framework's folder and its query. */
export function demoHref(demo, framework = 'plain') {
  const folder = demo.app ?? framework;
  return `${folder}/${demo.query ? `?${demo.query}` : ''}`;
}

/**
 * The pages a demo opens that are no demo of their own — a record opened from its list's row, a map's pin or a
 * calendar's booking — each with its own name, for the frame's heading and the browser's tab, and the demo it is
 * opened from. A page opened this way is never named after the framework that draws it.
 */
export const OPENED = [
  { page: 'map-home', name: 'A home for sale', from: 'map-homes' },
  { page: 'map-courier', name: 'A courier', from: 'map-couriers' },
  { page: 'map-week-order', name: 'An order of the week', from: 'map-zones' },
  { page: 'clinic-appointment', name: 'An appointment', from: 'clinic-calendar' },
  { page: 'booking', name: 'A booking', from: 'booking-week' },
  { page: 'contact', name: 'A contact', from: 'contacts' },
  { page: 'invoice', name: 'An invoice', from: 'customer-account' },
  { page: 'quotation', name: 'A quotation', from: 'customer-account' },
  { page: 'viewing', name: 'A viewing', from: 'property' },
  { page: 'lead', name: 'A lead', from: 'leads-queue' },
];

/** What a reader may change about a demo without it becoming another: how it looks, the record it shows, its clock. */
const SAME = new Set(['skin', 'theme', 'record', 'now']);

/** The demo a page shows: the one whose query the address holds, the most specific first. */
export function demoAt(app, params) {
  const candidates = DEMOS.filter((demo) => (demo.app ? demo.app === app : FRAMEWORKS.some((f) => f.id === app)));
  // The look (skin, theme) is the reader's to change, and so is the record shown: it is the same demo.
  const holds = (demo) => [...new URLSearchParams(demo.query)].every(([key, value]) => SAME.has(key) || params.get(key) === value);
  const size = (demo) => [...new URLSearchParams(demo.query)].length;
  return candidates.filter(holds).sort((a, b) => size(b) - size(a))[0] ?? null;
}

/** A page a demo opened (OPENED), in a framework's demo: its name, and the demo it came from. */
export function openedAt(app, params) {
  if (!FRAMEWORKS.some((f) => f.id === app)) return null;
  const found = OPENED.find((opened) => opened.page === params.get('page'));
  return found ? { ...found, from: DEMOS.find((demo) => demo.id === found.from) ?? null } : null;
}
