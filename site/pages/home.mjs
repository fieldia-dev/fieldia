import { code } from '../layout.mjs';

/**
 * The front page tells one story, top to bottom: a page of JSON is written and
 * drawn as it grows (the hero's stage); it starts as a question people answer;
 * then it runs a business record; it is the same in every framework; it already
 * draws nineteen real ERP screens; it is built in an open designer; and it is
 * small and open. Every moving part is the real viewer, driven by home.js.
 */

/** The real pages, by the thumbnails the demos gallery already draws. */
const REAL = [
  ['real-sale-order', 7101, 'Sales order'],
  ['real-invoice', 4101, 'Invoice'],
  ['real-legal-case', 42, 'Legal case'],
  ['real-task', 5201, 'Project task'],
  ['real-employee', 4122, 'Employee'],
  ['real-manufacturing-order', 5401, 'Manufacturing order'],
  ['real-opportunity', 7701, 'CRM opportunity'],
  ['real-product', 7301, 'Product'],
  ['real-contact', 7001, 'Contact'],
  ['real-transfer', 5301, 'Warehouse receipt'],
  ['real-expense', 4101, 'Expense'],
  ['real-tender', 7801, 'Tender'],
  ['real-clinic-appointment', 4001, 'Clinic appointment'],
  ['real-time-off', 4171, 'Time off'],
  ['real-maintenance-request', 4371, 'Maintenance request'],
  ['real-sale-contract', 7601, 'Sales contract'],
  ['real-register-payment', 4101, 'Register payment'],
  ['real-sale-invoice-wizard', 7701, 'Create invoices'],
  ['real-survey', 7, 'Survey'],
];

const card = ([id, record, name]) =>
  `<a class="reel-card" href="/demos/plain/?page=${id}&amp;record=${record}&amp;skin=underline"><img src="/demos/thumbs/${id}.png" alt="" loading="lazy" width="320" height="200"><span>${name}</span></a>`;
const half = Math.ceil(REAL.length / 2);
/** A row drawn twice, so it drifts by one copy's width and loops without a seam; the copy is for the eye only. */
const row = (items) =>
  `<div class="reel-track"><div class="reel-set">${items.map(card).join('')}</div><div class="reel-set" aria-hidden="true">${items.map(card).join('').replace(/<a /g, '<a tabindex="-1" ')}</div></div>`;

/** The page the hero writes, as it is mounted at its last step; home.js writes it again, line by line. */
const HERO_JSON = `{
  "fieldia": "0.1",
  "id": "project-brief",
  "title": "Start a project",
  "fields": {
    "name": { "type": "char", "label": "Your name", "required": true },
    "builds": {
      "type": "selection", "label": "You build with",
      "options": [
        { "value": "react", "label": "React" },
        { "value": "vue", "label": "Vue" },
        { "value": "other", "label": "Something else" }
      ]
    },
    "other": { "type": "char", "label": "Which one?" },
    "budget": { "type": "monetary", "label": "Budget", "currency": "EGP" }
  },
  "layout": { "type": "sections", "id": "root", "children": [
    { "type": "field", "id": "n", "field": "name" },
    { "type": "field", "id": "b", "field": "builds", "widget": "radio" },
    { "type": "field", "id": "o", "field": "other",
      "invisible": "builds != 'other'", "required": true },
    { "type": "field", "id": "m", "field": "budget" }
  ] }
}`;

export default {
  path: '/',
  title: 'Fieldia',
  description: 'Write a form or an app screen once, as JSON, and Fieldia draws it in plain JavaScript, React, Vue or Angular: from a survey to a full ERP record, with an open designer. MIT.',
  head: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/home.css">
`,
  body: `
<div class="story">

<section class="opening" aria-labelledby="opening-h">
  <div class="opening-copy">
    <p class="kicker">Open source · MIT · 0.12</p>
    <h1 id="opening-h">Write the screen once.<br><span>Fieldia draws it everywhere.</span></h1>
    <p class="lede">A page is a short piece of JSON: its fields, its layout, when a field shows or is required. Fieldia draws it in plain JavaScript, React, Vue or Angular, checks what people type, and hands the record to your backend.</p>
    <div class="opening-actions">
      <a class="btn btn-solid" href="/start/">Get started</a>
      <button class="btn btn-copy" type="button" id="copy-install" data-copy="npm install @fieldia/viewer"><code>npm install @fieldia/viewer</code><span class="copy-word" aria-hidden="true">Copy</span></button>
    </div>
  </div>

  <div class="stage" role="region" aria-label="A page of JSON, and the form Fieldia draws from it">
    <div class="stage-bar">
      <span class="stage-file">project-brief.page.json</span>
      <span class="stage-step" id="stage-step" aria-live="polite">The finished page</span>
      <span class="stage-controls"><button type="button" id="stage-replay">Replay</button><button type="button" id="stage-skip" hidden>Skip</button></span>
    </div>
    <div class="stage-panes">
      <pre class="stage-json" id="stage-json" tabindex="0" aria-label="The page’s JSON"><code>${HERO_JSON.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</code></pre>
      <div class="stage-form" id="stage-form"></div>
    </div>
  </div>
</section>

<section class="chapter" id="question" aria-labelledby="question-h">
  <div class="chapter-copy">
    <p class="chapter-no">1 · A question</p>
    <h2 id="question-h">It starts as a form someone answers</h2>
    <p>Fill it in. Leave your name out and send it: Fieldia says what is missing, in the reader’s language. Pick “Something else” and the page asks which one, because the page says so, not your code. Switch the skin or the language: Arabic turns the whole form right to left.</p>
    <ul class="ticks">
      <li>Conditions such as <code>framework != 'other'</code>, checked as people type</li>
      <li>Two looks, <code>underline</code> and <code>outlined</code>, scoped to the form</li>
      <li>English, Arabic, German and French, each a small add-on script</li>
    </ul>
  </div>
  <div class="chapter-live hero-live" role="region" aria-label="A live Fieldia form">
    <div class="live-bar">
      <label>Skin <select id="live-skin"><option value="outlined">outlined</option><option value="underline">underline</option></select></label>
      <label>Language <select id="live-locale"><option value="en">English</option><option value="ar">العربية</option><option value="de">Deutsch</option><option value="fr">Français</option></select></label>
    </div>
    <div id="live-form" class="live-form"></div>
    <p class="live-note" id="live-note" role="status"></p>
  </div>
</section>

<section class="chapter chapter-stack" id="business" aria-labelledby="business-h">
  <div class="chapter-copy">
    <p class="chapter-no">2 · A record</p>
    <h2 id="business-h">Then the same engine runs the business</h2>
    <p>The page grows into a record: a status bar that moves, counters that open related records, lines that add up, totals in the record’s currency. Watch the quotation get sent, a line change, the totals follow and the order confirm. It is the same viewer as the form above, given a bigger page.</p>
    <ul class="ticks">
      <li>Status bar, stat buttons, badges, ribbons, alerts and tabs</li>
      <li>Lines as a table or a spreadsheet grid, with sections and notes</li>
      <li>Values worked out as you type: <code>sum(order_line, 'subtotal')</code></li>
    </ul>
  </div>
  <div class="chapter-live sheet-live">
    <div class="sheet-host" id="sheet-form" role="region" aria-label="A live sales order"></div>
    <p class="sheet-caption" id="sheet-caption" aria-live="polite">S00071 · a quotation for Dar El Shifa Hospital</p>
  </div>
</section>

<section class="chapter chapter-center" id="frameworks" aria-labelledby="frameworks-h">
  <div class="chapter-copy">
    <p class="chapter-no">3 · Any framework</p>
    <h2 id="frameworks-h">One page, written once, in every framework</h2>
    <p>Every binding is a thin shell around one plain-DOM viewer, so the same page draws the same form, to the pixel, wherever you mount it.</p>
  </div>
  <div class="tabs" role="tablist" aria-label="Frameworks">
    <button role="tab" id="tab-plain" aria-controls="code-plain" aria-selected="true">Plain JavaScript</button>
    <button role="tab" id="tab-react" aria-controls="code-react" aria-selected="false" tabindex="-1">React</button>
    <button role="tab" id="tab-vue" aria-controls="code-vue" aria-selected="false" tabindex="-1">Vue</button>
    <button role="tab" id="tab-angular" aria-controls="code-angular" aria-selected="false" tabindex="-1">Angular</button>
  </div>
  <div class="tab-panels">
    <div role="tabpanel" id="code-plain" aria-labelledby="tab-plain">${code(
      'html',
      `
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script>
  Fieldia.mountViewer(document.getElementById('app'), {
    page, dataSource: Fieldia.createMemoryDataSource(),
  });
</script>`
    )}</div>
    <div role="tabpanel" id="code-react" aria-labelledby="tab-react" hidden>${code(
      'tsx',
      `
import { FieldiaForm } from '@fieldia/react';

export function Order({ id }) {
  return <FieldiaForm page={page} dataSource={api} recordId={id} />;
}`
    )}</div>
    <div role="tabpanel" id="code-vue" aria-labelledby="tab-vue" hidden>${code(
      'vue',
      `
<script setup>
import { FieldiaForm } from '@fieldia/vue';
</script>

<template>
  <FieldiaForm :page="page" :data-source="api" :record-id="id" />
</template>`
    )}</div>
    <div role="tabpanel" id="code-angular" aria-labelledby="tab-angular" hidden>${code(
      'ts',
      `
import { FieldiaFormComponent } from '@fieldia/angular';

@Component({
  imports: [FieldiaFormComponent],
  template: '<fieldia-form [page]="page" [dataSource]="api" [recordId]="id" />',
})
export class OrderComponent {}`
    )}</div>
  </div>
</section>

<section class="chapter chapter-wide" id="real" aria-labelledby="real-h">
  <div class="chapter-copy">
    <p class="chapter-no">4 · Proven</p>
    <h2 id="real-h">Nineteen real ERP screens, already drawn by it</h2>
    <p>We rebuilt nineteen screens of a working ERP, from a two-field dialog to a legal case with fifteen tabs and twelve tables, each with its own records, buttons and rules. Open any of them: each works in all four frameworks.</p>
  </div>
  <div class="reel" role="region" aria-label="The nineteen real pages">
    ${row(REAL.slice(0, half))}
    ${row(REAL.slice(half))}
  </div>
</section>

<section class="chapter chapter-flip" id="designer" aria-labelledby="designer-h">
  <div class="chapter-copy">
    <p class="chapter-no">5 · No code needed</p>
    <h2 id="designer-h">Build it in a designer that is open too</h2>
    <p>Drag fields in, type labels where they stand, set when a field shows in plain sentences, try it at a phone’s width in Arabic, and publish a version. The designer writes the same JSON. It is MIT like the rest, where other form libraries sell their builder.</p>
    <p class="chapter-cta"><a class="btn btn-solid" href="/designer/">Open the designer</a></p>
  </div>
  <a class="chapter-live shot" href="/designer/">
    <img src="/demos/thumbs/designer-sheet.png" alt="The Fieldia designer editing a customer record: the toolbox, the sheet on its canvas and the settings panel" loading="lazy" width="640" height="400">
  </a>
</section>

<section class="chapter chapter-center" id="numbers" aria-labelledby="numbers-h">
  <div class="chapter-copy">
    <p class="chapter-no">6 · Small and open</p>
    <h2 id="numbers-h">Everything, in a small package</h2>
  </div>
  <ul class="figures">
    <li><b class="count" data-to="131">131</b><span>KB gzipped: the whole engine in one script tag, no build step</span></li>
    <li><b class="count" data-to="4">4</b><span>frameworks from one viewer: plain JavaScript, React, Vue, Angular</span></li>
    <li><b class="count" data-to="10">10</b><span>packages on npm, the designer included, all MIT</span></li>
    <li><b>AA</b><span>WCAG 2.2, checked with axe on every demo, by keyboard and in Arabic</span></li>
  </ul>
</section>

<section class="finale" aria-labelledby="finale-h">
  <h2 id="finale-h">Draw your first page in five minutes</h2>
  <p>One script tag, or a package for your framework. Fieldia has no backend of its own: your app loads and saves records through a small interface.</p>
  <div class="opening-actions">
    <a class="btn btn-solid" href="/start/">Read Get started</a>
    <a class="btn btn-ghost" href="/demos/">Browse the demos</a>
    <a class="btn btn-ghost" href="https://github.com/fieldia-dev/fieldia">GitHub</a>
  </div>
</section>

</div>

<script src="/fieldia.js"></script>
<script src="/live.js"></script>
<script src="/home.js"></script>
`,
};
