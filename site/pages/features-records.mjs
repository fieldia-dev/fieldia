import { readFileSync } from 'node:fs';

/**
 * A feature page: Business records. What a record screen built with Fieldia
 * has, each part shown from a real demo with a way to try it and to read how;
 * the home page tours, this page shows everything in one area.
 */

const TEMPLATES = JSON.parse(readFileSync(new URL('../../examples/templates/index.json', import.meta.url), 'utf8'));
const RECORD_TEMPLATES = TEMPLATES.filter((t) => t.group === 'records');
const demo = (query) => `/demos/plain/?${query}`;

/** One part of a record: words beside its picture, what it has, and where to try it and read how. */
function part({ id, no, title, body, ticks, shot, alt, width, height, tryIt, docs, flip }) {
  // A picture of a whole screen spans the page, its words above it; a narrow one sits beside them.
  const wide = width >= 900;
  return `<section class="chapter${wide ? ' chapter-stack' : flip ? ' chapter-flip' : ''}" id="${id}" aria-labelledby="${id}-h">
  <div class="chapter-copy">
    <p class="chapter-no">${no}</p>
    <h2 id="${id}-h">${title}</h2>
    <p>${body}</p>
    <ul class="ticks">${ticks.map((t) => `<li>${t}</li>`).join('')}</ul>
    <p class="feature-links"><a class="btn btn-solid" href="${tryIt[1]}">${tryIt[0]}</a><a href="${docs[1]}">${docs[0]} →</a></p>
  </div>
  <a class="chapter-live shot" href="${tryIt[1]}" tabindex="-1" aria-hidden="true"><img src="/img/records/${shot}" alt="${alt}" loading="lazy" width="${width}" height="${height}" style="max-width: min(100%, ${width}px)"></a>
</section>`;
}

const PARTS = [
  {
    id: 'sheet',
    no: 'Around the sheet',
    title: 'The status, the buttons and the counts, where people look first',
    body: 'A record says where it stands before anyone reads a field. The status bar moves as the record does, the buttons are the ones that make sense now, and the counters open what belongs to it.',
    ticks: [
      'A status bar, clickable where the page allows, folding its later stages on a phone',
      'Buttons shown and hidden by the record’s state, each running its steps',
      'Stat buttons that count and open related records: sales, invoices, hours, money',
      'Badges, ribbons such as Archived or Paid, and alerts with their own buttons',
    ],
    shot: 'sheet-head.png',
    alt: 'A customer record: Block beside a status bar at Active, stat buttons for 18 sales and 12 invoices, a Key account badge, and the name over its fields',
    width: 1280,
    height: 560,
    tryIt: ['Try the customer record', demo('page=customer&skin=underline')],
    docs: ['The sheet, in the docs', '/pages/'],
  },
  {
    id: 'lines',
    no: 'Lines that add up',
    title: 'Order lines that work like a spreadsheet',
    body: 'Quantities, prices, discounts and taxes on lines, with subtotals and totals worked out as people type. Lines move by hand, group under sections, and carry notes.',
    ticks: [
      'A spreadsheet grid, or a plain table where the app has no grid: Enter goes down, Tab goes across',
      'Sections and notes between the lines, and lines dragged into order',
      'Columns shown or hidden from a menu, remembered for the next visit',
      'Each line opens in a dialog with all of its fields; totals follow every keystroke',
    ],
    shot: 'grid.png',
    alt: 'Order lines in a grid: sections Workstations and Lighting, a note, quantities, prices in Egyptian pounds, VAT ticks and a total of 64,656.00',
    width: 1090,
    height: 408,
    tryIt: ['Try the sales order', demo('page=order&skin=underline')],
    docs: ['Tables of lines, in the docs', '/fields/'],
    flip: true,
  },
  {
    id: 'layout',
    no: 'A real form’s layout',
    title: 'As much as the record holds, still easy to read',
    body: 'A legal case, rebuilt from a working ERP: thirteen counters, two columns of groups, labels beside their values, fifteen tabs and twelve tables. The same JSON format that draws a three-question survey.',
    ticks: [
      'Groups side by side on a twelve-column grid, stacking on a phone',
      'Labels beside their values, or above, as the page asks',
      'Tabs, folding sections, and fields above and below the title',
      'Properties: fields a person adds to one record without changing the page',
    ],
    shot: 'tabs.png',
    alt: 'A legal case: breadcrumbs, a pager, case buttons, a status bar at Open, thirteen stat buttons, and two columns of case information and parties',
    width: 1280,
    height: 760,
    tryIt: ['Try the legal case', demo('page=real-legal-case&record=42&skin=underline')],
    docs: ['Layout, in the docs', '/pages/'],
  },
  {
    id: 'chatter',
    no: 'The conversation beside it',
    title: 'Messages, notes and to-dos on the record itself',
    body: 'Everything said about a record stays with it: who wrote what, what is due and who follows it. It sits beside the sheet on a wide screen and under it on a narrower one.',
    ticks: [
      'Messages and internal notes, with @mentions, files, replies and reactions',
      'Scheduled activities, marked overdue, today or upcoming, done from the list',
      'Followers, and changes to the record written into its history',
      'Your server behind it, through a small source of its own',
    ],
    shot: 'chatter.png',
    alt: 'The chatter beside a customer: three scheduled activities, one overdue, a note and a message with a floor plan attached',
    width: 360,
    height: 734,
    tryIt: ['Try it on the customer record', demo('page=customer&skin=underline')],
    docs: ['The chatter, in the docs', '/chatter/'],
    flip: true,
  },
  {
    id: 'around',
    no: 'Its place among the others',
    title: 'The record’s file beside it, and the way to the next one',
    body: 'A vendor bill with the bill itself beside it, the trail back to the list, and a pager to the next one. The gear menu prints it, archives it, duplicates it or deletes it, each kept to the records it suits.',
    ticks: [
      'A PDF or a picture beside the sheet, from the record’s files',
      'Breadcrumbs back to where the person came from, and a pager through the list',
      'A gear menu: print, archive, duplicate, delete and your own actions',
      'Each shown only where it applies: no Delete on a posted bill',
    ],
    shot: 'pdf.png',
    alt: 'A posted vendor bill: breadcrumbs, a pager at 1 of 4, the bill’s fields and amounts, and its PDF beside the sheet',
    width: 1440,
    height: 820,
    tryIt: ['Try the vendor bill', demo('page=vendor-bill&skin=underline')],
    docs: ['Around a record, in the docs', '/record/'],
  },
];

export default {
  path: '/features/records/',
  title: 'Business records',
  description: 'Business records with Fieldia: status bars, stat buttons, lines that add up, tabs, a chatter, the PDF beside the sheet, a pager and a gear menu, all from one JSON page.',
  head: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/features.css">
`,
  body: `
<div class="story feature-page">

<section class="opening feature-opening" aria-labelledby="opening-h">
  <div class="opening-copy">
    <p class="kicker">Features · Business records</p>
    <h1 id="opening-h">The screens a business runs on.<br><span>Each one a page of JSON.</span></h1>
    <p class="lede">A quotation, an invoice, a legal case, an employee: the record screens an ERP is made of, with their status, their buttons, their lines and their conversation. This one is live. Send it, change a quantity, confirm it.</p>
  </div>
  <div class="stage feature-frame">
    <iframe src="${demo('page=real-sale-order&record=7101&skin=underline&embed=1')}" title="A live sales order, from a working ERP" loading="eager"></iframe>
  </div>
</section>

${PARTS.map(part).join('\n\n')}

<section class="chapter chapter-center" id="kept-right" aria-labelledby="kept-right-h">
  <div class="chapter-copy">
    <p class="chapter-no">Kept right</p>
    <h2 id="kept-right-h">What a record needs to be trusted</h2>
  </div>
  <ul class="figures feature-facts">
    <li><b>Server checks</b><span>Your server’s answer to a changed field fills in the others; a save it refuses puts each problem on its field.</span></li>
    <li><b>Nothing lost</b><span>Unsaved changes are kept when the person leaves, and Ctrl+Enter saves from anywhere.</span></li>
    <li><b>By role</b><span>Fields, buttons and tabs shown, hidden or locked by who is looking, and whole records locked once done.</span></li>
    <li><b>Said clearly</b><span>Saving, saved and failed are said where the person looks, and to screen readers.</span></li>
  </ul>
  <p class="feature-links"><a href="/behaviour/">Behaviour, in the docs →</a><a href="/data/">Your backend, in the docs →</a></p>
</section>

<section class="chapter chapter-center" id="start" aria-labelledby="start-h">
  <div class="chapter-copy">
    <p class="chapter-no">Start from one</p>
    <h2 id="start-h">${RECORD_TEMPLATES.length} record templates, and nineteen real ERP screens</h2>
    <p>Take a template as JSON and change it, or open one of the nineteen screens rebuilt from a working ERP to see how far a page goes.</p>
  </div>
  <ul class="feature-templates">
    ${RECORD_TEMPLATES.map((t) => `<li><a href="/demos/plain/?page=template-${t.id}&amp;theme=${t.theme}&amp;record=new">${t.name}</a></li>`).join('\n    ')}
  </ul>
  <p class="feature-links"><a class="btn btn-solid" href="/templates/">All templates</a><a href="/demos/#real">The nineteen real screens →</a></p>
</section>

<section class="finale" aria-labelledby="finale-h">
  <h2 id="finale-h">Build your first record in an afternoon</h2>
  <p>Write the page, give Fieldia a data source for your backend, and mount it in plain JavaScript, React, Vue or Angular.</p>
  <div class="opening-actions">
    <a class="btn btn-solid" href="/start/">Read Get started</a>
    <a class="btn btn-ghost" href="/designer/">Open the designer</a>
  </div>
</section>

</div>
`,
};
