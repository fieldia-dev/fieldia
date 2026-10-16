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
  sales: ['order', 'quick-order', 'rules', 'map-zones', 'map-heat', 'template-quote-request', 'template-product', 'real-sale-order', 'real-sale-invoice-wizard', 'real-product', 'real-sale-contract', 'test-drive'],
  accounting: ['reading', 'vendor-bill', 'template-invoice', 'template-expense-claim', 'real-invoice', 'real-register-payment', 'real-expense', 'invoices'],
  crm: ['customer', 'customers', 'template-contact-us', 'template-support-request', 'template-customer', 'real-contact', 'real-opportunity', 'real-tender', 'contacts'],
  people: ['layout', 'template-job-application', 'template-employee-onboarding', 'template-leave-request', 'real-time-off', 'real-employee'],
  operations: ['backlog', 'work-item', 'template-task', 'template-purchase-order', 'real-task', 'real-transfer', 'real-manufacturing-order', 'real-maintenance-request', 'real-legal-case', 'map-couriers', 'map-round', 'map-order', 'map-kitchen'],
  clinic: ['clinic-calendar', 'template-patient-intake', 'template-appointment-booking', 'real-clinic-appointment'],
  'real-estate': ['map-homes', 'map-embed', 'listing-photos', 'booking-week', 'template-property-enquiry'],
  surveys: ['survey', 'signup', 'kinds', 'template-newsletter', 'template-customer-feedback', 'template-event-registration', 'template-course-evaluation', 'real-survey'],
  'building-blocks': ['fields', 'business', 'code', 'custom', 'contained', 'delivery', 'lists', 'map-delivery', 'map-address', 'map-zone', 'script', 'customer-locked', 'two-tabs', 'viewer-role', 'customers-arabic', 'customer-arabic', 'signup-french', 'signup-keys', 'customer-toast', 'map-homes-arabic', 'booking-week-arabic'],
};

/** The area a demo is in, by its id; undefined for one in none (the browser test says which). */
export const areaOf = (id) => Object.keys(AREA_OF).find((area) => AREA_OF[area].includes(id));
/** Every demo id each area names, as written: for the test that no demo is in two or none. */
export const AREA_IDS = AREA_OF;

/** The flagships, first in the gallery and in the menu. */
export const FEATURED = ['customer', 'order', 'customers', 'fields'];

export const DEMOS = [
  {
    id: 'customer',
    name: 'Customer record',
    category: 'records',
    query: 'page=customer&skin=underline',
    blurb: 'A business record on a sheet: a statusbar, stat buttons, badges and an alert, tabs, a table of contacts, links to other records, and the conversation beside it.',
    howTo: [
      'Click Blocked on the statusbar at the top: the Blocked ribbon appears on the sheet, and the record has changes to save.',
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
    blurb: 'Header groups, then a grid of lines that works like a spreadsheet: keys that move cell to cell, sections and notes, lines moved by hand, and totals that follow.',
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
    blurb: 'A list of records with the search bar: suggestions as you type, filters, group by and favourites; headers that sort, pages, buttons for the records chosen, and rows that open.',
    howTo: [
      'Type "egy" in the search box and pick "Search Country for: egy" with the arrow keys and Enter.',
      'Open the menu at the end of the box: turn on Active, then group by Country and Status, and open the groups.',
      'Click the Credit limit header, twice: the list goes one way, then the other.',
      'Tick two customers and press Archive: the app is asked first, then given their ids.',
      'Save the search as a favourite used by default, and reload: it opens that way.',
      'Click a row to open that customer on its own page.',
    ],
  },
  {
    id: 'invoices',
    name: 'Invoices that add up',
    category: 'lists',
    query: 'page=invoices&skin=underline',
    blurb: 'A list that adds up and filters by time: a total under it, sums on each Group By heading and for the rows ticked, each amount totalled in its own currency; filters of a period — this month, overdue — right every day; and invoices grouped by their month, quarter or week.',
    howTo: [
      'The list opens on This year: the total of this year’s invoices is under the Amount column.',
      'Tick three invoices: a row over the total says “3 selected” and adds up those three.',
      'Open the menu at the end of the search box and turn on Overdue: the invoices sent and not paid by their due date, counted from today.',
      'Under Group By, press Month beside Invoice date: a heading for each month, its count and its sum — “October 2026 (4) · EGP 812.5K”.',
      'Take This year away, then group by City: Dubai’s invoices are in dollars, summed in dollars; the list’s total has none, as no honest sum of pounds and dollars exists.',
      'Add a custom filter: Invoice date, in the period, Last 7 days. Save it as a favourite: it is the last seven days whenever it is used.',
    ],
  },
  {
    id: 'contacts',
    name: 'Contacts to take away and change in bulk',
    category: 'lists',
    query: 'page=contacts&skin=underline',
    blurb: 'A list of 1,284 contacts: select every one that matches, export the rows ticked or all of them to Excel or CSV, and set one field on many at once — each record’s permissions kept, and what could not be changed named with why.',
    howTo: [
      'Tick the box in the header, then press “Select all 1,284 that match”: turn a page, and its rows are ticked too.',
      'Press Export and pick Excel: the workbook has the columns as the list shows them, money with its currency and days as days.',
      'Search for a company, tick a few rows, press Edit, pick Owner and a person, then Update: say Yes to the question.',
      'Choose Status for contacts that include one of Karim Nasser’s: the list says which it could not change, and why.',
      'Add &allIds=1000 to the address: “1,000 of 1,284 could be selected”, never “all”.',
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
    blurb: 'A backlog of bugs and one opened in a large popup over it, as a work tracker draws it: its kind’s strip and badge, a quiet head with State, Reason, Area and Iteration, three columns of groups, a discussion, links, and its history.',
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
    blurb: 'A bug in the quiet look, as Azure DevOps draws a work item: each value plain words until pointed at, then a light box, then its editor once clicked; a field locked by the workflow says why. Switch to Underline or Outlined above the form to see the same bug in boxes.',
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
    blurb: 'One record using every widget Fieldia has: text, numbers and money, choices, dates, links to other records, lines, files and images, rich text and structured data, in sections that fold.',
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
    blurb: 'The newer kinds of question in one survey: sliders, a tag box, an address, choices with pictures, a ranking, a group that repeats, a quiz question with points, and a signature — and a moving day with a day that keeps its limits, a time, a weight in kilograms, hearts and an NPS scale.',
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
    name: 'Business widgets',
    category: 'fields',
    query: 'page=business&skin=underline',
    blurb: 'The widgets an ERP’s screens lean on, on one fit-out task: priority stars and a state’s dot on the title’s line, a live timer, hours as HH:MM, a range of dates, tag colours, values to copy, a PDF shown inline, an analytic distribution, tax totals, payments, and properties the task’s project defines.',
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
    blurb: 'Code fields coloured in their own language, in either editor Fieldia supports: CodeMirror, light and quick, or VS Code’s own editor. The Editor switch at the top shows every field in one or the other, or each where it fits. Each language’s grammar loads only when a field shows it.',
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
    blurb: 'A form in sections, with questions that show only when they apply, checks as you type, your browser’s autofill, a check for bots, and a response sent when it is done.',
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
      'Add &locale=ar&dir=rtl to the address for the page in Arabic, right to left, or &scheme=dark for its dark scheme.',
    ],
  },
  {
    id: 'survey',
    name: 'Product survey',
    category: 'forms',
    query: 'page=survey&skin=outlined',
    blurb: 'A wizard that skips the steps that do not apply: one path for people who use the product, another for those who do not, a list of steps to click, and a step that can be skipped.',
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
    id: 'rules',
    name: 'Totals and answer rules',
    category: 'forms',
    query: 'page=rules&skin=outlined',
    blurb: 'An order whose subtotals, total and amount to pay work themselves out as you type, a discount that sets itself past a threshold, and answer rules: one that only warns, and ones that stop the form.',
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
    blurb: 'Choices that come from the app’s own lists, as a server keeps them: the countries delivered to, and each one’s cities, loaded again when the country changes.',
    howTo: [
      'Watch the countries load as the form opens: the app answers after a moment, as a server does.',
      'Pick Egypt: its cities load. Pick Alexandria.',
      'Change the country to Jordan: Jordan’s cities load, and Alexandria stays, marked as no longer offered, until you pick again.',
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
    blurb: 'A delivery zone drawn as a polygon, a box or a circle, or chosen from named ones, kept as GeoJSON. Its points, corners and edge drag to change it.',
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
      'Move the map again: the address bar’s at= keeps where it stands. Reload the page: the map opens there.',
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
    blurb: 'Couriers as icons: a car, a scooter or a bike by each record, facing the way it goes, green when free and amber when delivering. The page says it all, with no code for the pins.',
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
    blurb: 'A map on an order’s page, its layers named by the page: the kitchen, your door, and the courier with the minutes left under their photo, gliding along the road as their place comes in, the road behind them fading.',
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
    blurb: 'A map with a place for each line of the record: a van’s stops, numbered on the map in their order and greyed once delivered, and the way from the van through them.',
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
    blurb: 'A clinic’s day on a calendar, a column for each doctor, each visit coloured by its service. Drag a visit to another time or doctor, stretch it by its lower edge, or press an empty slot for a new one; Undo puts a move back. The week, the month and an agenda are a press away, and the list’s own search and filters keep to the calendar.',
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
    blurb: 'A showroom in Berlin takes test drives: pick a car, then a day on the month — shaded by how it is booked, full days hatched, closed days faint, a staff day marked — and one of its free times. Every time is on Berlin’s clock, named beside it, wherever you book from; a time someone booked meanwhile is said, never booked over.',
    howTo: [
      'Pick a car, then a day: its free times show beside the month. Another car has times of its own.',
      'Without a mouse: Tab to the month, move with the arrows (Page Up and Page Down by month), and its times follow; Enter goes to them, the arrows move among them, Enter books one.',
      'The next Wednesday is fully booked for the hatchback: hatched, with no times.',
      'Type a time in Call back at: it is on Berlin’s clock, CEST or CET beside it. Try 25/10/2026 02:30: it comes twice that night, and the box asks which.',
      'Open the Code drawer: the demo’s schedule, and the slots() your server gives.',
    ],
  },
  {
    id: 'map-kitchen',
    name: 'A kitchen’s map',
    category: 'records',
    query: 'page=map-kitchen&skin=outlined',
    blurb: 'A kitchen’s evening on one map: the districts shaded by their delivery fee, the area within fifteen minutes’ drive, and the courier on the way. As the courier reaches the drop-off zone, the page’s own steps run: a fence.',
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
    blurb: 'A conference badge: the name goes into a field your app draws itself, which shows the badge as it will be printed, and the printing desk under it is a panel your app fills, with a count of its own. In each framework, each is written as one of that framework’s own components.',
    howTo: [
      'Type a name: the app’s own widget shows the badge as it will be printed, as you type.',
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
    blurb: 'Your own parts can have bugs. Here the app’s price tag fails for four-digit prices, and its delivery planner fails as it loads. Each shows a small box that names it, the error goes to the console and to onError, and the rest of the form works and saves.',
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
    blurb: 'What the buttons and moments of a page do, written as steps: a new customer made in a side panel and set on the order, the stock checked by the app as a product is picked, a customer’s record opened in the order’s place, a question before the order is sent, and words after.',
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
    blurb: 'The same lead opened by Omar, a viewer: its source says he may only read it, so there is no Save and no Archive, Duplicate or Delete — hidden, not greyed out — the commission is not shown at all, and the record says why.',
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
    id: 'reading',
    name: 'A dense record that reads at a glance',
    category: 'records',
    query: 'page=reading&skin=underline&editSwitch=1',
    blurb: 'A dense invoice as an ERP draws it: read-only values as words, stat buttons with money, hours and two values, a customer with the address under it, coloured tags, parts on one line, alerts holding a date, keys on buttons and ribbons by condition.',
    howTo: [
      'Hold Alt: each header button shows its key. Alt+Shift+G sets the invoice back to Draft, Alt+V confirms it.',
      'Read the alerts: the lock date and the customer sit inside their words, and the duplicate alert has a button inside.',
      'Press Done: the parts for editing only — Add Credit Note, the note under the tags — go, and every field reads as words.',
      'Click Draft on the statusbar: the time spent in each step shows on it, and Confirm takes the place of Send & Print.',
      'Open the Trust tab: an alert sits among its fields, with the amount inside its sentence.',
    ],
  },
  {
    id: 'vendor-bill',
    name: 'Around a record',
    category: 'records',
    query: 'page=vendor-bill&record=3&skin=underline',
    blurb: 'A vendor bill with what sits around it: the breadcrumbs and the pager over the bills the app gives, a gear menu with Print, Debit Note, Archive, Duplicate and Delete, the vendor’s PDF beside the sheet, and the conversation beside it on any screen it fits.',
    howTo: [
      'Press the pager’s › (or Alt+N): the next bill comes, “4 / 4” after it, and round to the first; the PDF beside it follows.',
      'Open the gear menu with the arrow keys: Print, then Debit Note, Archive, Duplicate and Delete. Press Debit Note: the note is said and posted in the conversation.',
      'Press Duplicate: the copy shows as “… (copy)”, a draft, and the pager counts five.',
      'On BILL/2026/10/0002, press Archive and say yes: the Archived ribbon shows and the menu offers Unarchive.',
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
    blurb: 'The record sheet laid out right to left, with Fieldia’s own words, messages and dates in Arabic.',
    howTo: [
      'Notice the sheet mirrored: the title, the statusbar and the tabs start on the right.',
      'Empty a required field and save: the message comes in Arabic.',
    ],
  },
  {
    id: 'signup-french',
    name: 'Your app’s own translations',
    category: 'behaviour',
    query: 'page=signup&skin=outlined&translate=fr',
    blurb: 'The sign-up in French through a catalog the app keeps itself: every word of the page goes through it, and nothing typed does.',
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
    blurb: 'Fieldia with no build step: one script tag, a page as JSON and one call to Fieldia.mountViewer, on a call-back form.',
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
