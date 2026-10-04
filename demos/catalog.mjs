/**
 * Every public demo, once: the gallery on fieldia.dev, the menu and the
 * "how to try it" panel on each demo page, and the thumbnail tool all read
 * this list, so they cannot drift apart. A demo runs in each framework unless
 * it names its own `app`.
 */

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
];

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
    ],
  },
  {
    id: 'signup',
    name: 'Workshop sign-up',
    category: 'forms',
    query: 'page=signup&skin=outlined',
    blurb: 'A form in sections, with questions that show only when they apply, checks as you type, and a response sent when it is done.',
    howTo: [
      'Choose "Something else" as your role: a question appears to say what it is.',
      'Choose Manager: a question about your team appears instead.',
      'Turn on “Joining the dinner”: a question about what you eat appears.',
      'Type an email without an @ and leave the field: it says what is wrong.',
      'Submit with a required question empty: the form takes you to it.',
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
    id: 'custom',
    name: 'Your own parts',
    category: 'fields',
    query: 'page=custom&skin=outlined',
    blurb: 'A field drawn by a widget of your own and a slot your app fills: in each framework, written as one of that framework’s own components.',
    howTo: [
      'Type a nickname: the field is drawn by the demo’s own widget, and shows it shouted back.',
      'Press the button in the slot below: its count is the slot’s own state, kept across the form’s changes.',
      'Switch framework at the top: the same parts are written as React, Vue and Angular components.',
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
];

/** A demo's address, from a demo page or from the site's /demos/: its framework's folder and its query. */
export function demoHref(demo, framework = 'plain') {
  const folder = demo.app ?? framework;
  return `${folder}/${demo.query ? `?${demo.query}` : ''}`;
}

/** The demo a page shows: the one whose query the address holds, the most specific first. */
export function demoAt(app, params) {
  const candidates = DEMOS.filter((demo) => (demo.app ? demo.app === app : FRAMEWORKS.some((f) => f.id === app)));
  const holds = (demo) => [...new URLSearchParams(demo.query)].every(([key, value]) => params.get(key) === value);
  const size = (demo) => [...new URLSearchParams(demo.query)].length;
  return candidates.filter(holds).sort((a, b) => size(b) - size(a))[0] ?? null;
}
