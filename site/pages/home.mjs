import { readFileSync } from 'node:fs';
import { code } from '../layout.mjs';

/**
 * The front page tells one story, top to bottom: a page of JSON is written and
 * drawn as it grows (the hero's stage); it starts as a question people answer;
 * then it runs a business record; it is the same in every framework; it already
 * starts from a template in any of eight themes; it already draws nineteen
 * real ERP screens; it is built in an open designer; and it is small and open. Every moving part is the real viewer, driven by home.js.
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

/** The template library, as the Templates page lists it; six of them shown here, forms and records. */
const TEMPLATES = JSON.parse(readFileSync(new URL('../../examples/templates/index.json', import.meta.url), 'utf8'));
const SHOWN = ['contact-us', 'customer-feedback', 'job-application', 'invoice', 'task', 'product'];
const THEMES = [
  ['material', 'Material'],
  ['fluent', 'Fluent'],
  ['apple', 'Apple'],
  ['bootstrap', 'Bootstrap'],
  ['shadcn', 'shadcn'],
  ['ant', 'Ant Design'],
  ['odoo', 'Odoo'],
  ['google-forms', 'Google Forms'],
];
const themeName = (id) => THEMES.find(([t]) => t === id)[1];
const isRecord = (id) => JSON.parse(readFileSync(new URL(`../../examples/templates/${id}.page.json`, import.meta.url), 'utf8')).data.kind === 'record';
const templateCard = (id) => {
  const t = TEMPLATES.find((x) => x.id === id);
  return `<a class="reel-card tpl-card" href="/demos/plain/?page=template-${id}&amp;theme=${t.theme}${isRecord(id) ? '&amp;record=new' : ''}"><img src="/demos/thumbs/template-${id}.png" alt="" loading="lazy" width="320" height="200"><span>${t.name}<small>${themeName(t.theme)}</small></span></a>`;
};

/** The story of chapter 3, one caption a chapter: its heading and its words. site/story.js plays it. */
const STORY = [
  ['A page is a list of fields', 'Write down what the record holds. Fieldia draws each field with its label, and checks what is typed in it.'],
  ['Over 35 widgets', 'Money in its currency, a rating, tags, a date, a switch: each field drawn the way its value reads best.'],
  ['Rules, as people type', 'Turn on the site visit and its date appears, now required, because the page says so, not your code.'],
  ['Buttons that act', 'Confirm runs its steps: the status moves, the record is saved, and your server hears about it.'],
  ['Lines that add up', 'Quantities change and every subtotal and the total follow, as they would in a spreadsheet.'],
  ['The conversation beside it', 'Messages, notes, @mentions, files and to-dos stay with the record, beside the sheet.'],
  ['In a list, with search', 'The record takes its place among the others: filter them, group them, act on several at once.'],
  ['In any of eight themes', 'Material, Fluent, Odoo, Google Forms, Apple and more: the same page, dressed to fit your product.'],
  ['In Arabic, right to left', 'Every part turns, from the labels to the status bar. English, Arabic, German and French are built in.'],
  ['Saved by your backend', 'One small interface loads and saves. Your server fills in fields as they change, and its refusals land on them.'],
  ['One page. Every framework.', 'All of it from one JSON page, in plain JavaScript, React, Vue or Angular. Open source, MIT.'],
];
const storyCaption = ([title, words], i) =>
  `<li class="story-caption${i ? '' : ' is-on'}"><span class="story-count">${String(i + 1).padStart(2, '0')} / ${STORY.length}</span><h3>${title}</h3><p>${words}</p></li>`;

/** What every page can use: a tile each, with what it holds and where to read or see more. */
const POWERS = [
  ['Fields', '19 types, over 35 widgets', 'Money in its currency, signatures, ratings, matrices, tags, files and pictures, rich text, a code editor.', '/fields/'],
  ['Rules', 'As people type', 'Show, hide, require or lock a field by a condition; values worked out with sum, count and days; answers checked.', '/pages/'],
  ['Buttons that act', '16 kinds of step', 'Save, ask first, call your server, open a page as a dialog or side panel, post to the chatter, archive.', '/actions/'],
  ['Business records', 'Status to totals', 'Status bars, stat buttons, lines that add up in a spreadsheet grid, a PDF beside the sheet, a pager.', '/features/records/'],
  ['The chatter', 'On every record', 'Messages, notes and @mentions, scheduled activities, followers and files, beside the sheet.', '/chatter/'],
  ['Lists and search', 'Find, group, act', 'Filters, grouping, favourites, sorting and pages; buttons for the records chosen; rows that open.', '/lists/'],
  ['Surveys in steps', 'Branching', 'Pages that follow the answers, a progress bar, optional steps, and a Google Forms look.', '/demos/plain/?page=survey&skin=outlined'],
  ['Looks', '2 skins, 8 themes', 'Material, Fluent, Apple, Bootstrap, shadcn, Ant Design, Odoo and Google Forms, light and dark, in your colours.', '/look/'],
  ['Languages and access', '4 languages, AA', 'English, Arabic, German and French, right to left in full, WCAG 2.2 AA, and every part by keyboard.', '/accessibility/'],
  ['Your backend', 'One small interface', 'Load and save through a data source; your server fills in fields as they change and puts its refusals on them.', '/data/'],
];
const power = ([name, figure, words, href]) =>
  `<li><a class="power" href="${href}"><span class="power-figure">${figure}</span><b>${name}</b><span class="power-words">${words}</span><span class="power-go" aria-hidden="true">→</span></a></li>`;

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
  description: 'Write a form or an app screen once, as JSON, and Fieldia runs it in plain JavaScript, React, Vue or Angular: from a survey to a full ERP record, with an open designer. MIT.',
  head: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/story.css">
`,
  body: `
<div class="story">

<section class="opening" aria-labelledby="opening-h">
  <div class="opening-copy">
    <p class="kicker">Open source · MIT · 0.12</p>
    <h1 id="opening-h">Write the screen once.<br><span>Fieldia runs it everywhere.</span></h1>
    <p class="lede">A page is a short piece of JSON: its fields, its layout, its rules and its buttons. Fieldia runs it in plain JavaScript, React, Vue or Angular: it draws the form, checks what people type, works out the totals, follows the page’s rules, runs its buttons, and hands the record to your backend.</p>
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
  <p class="chapter-more"><a href="/features/records/">Everything a business record has →</a></p>
</section>

<section class="story-chapter" id="story" aria-labelledby="story-h">
  <div class="chapter-copy story-intro">
    <p class="chapter-no">3 · Everything in it</p>
    <h2 id="story-h">Watch one record grow into everything a business screen needs</h2>
    <p>Keep scrolling. Every change below happens to the same page of JSON, in the real viewer.</p>
  </div>
  <div class="story-scroll" style="--steps: ${STORY.length}">
    <div class="story-sticky">
      <ol class="story-captions">
        ${STORY.map(storyCaption).join('\n        ')}
      </ol>
      <div class="story-stage" data-step="0" inert>
        <div class="story-screen">
          <div class="story-window">
            <div class="story-chrome"><span></span><span></span><span></span><b>app.example.com/quotes/0142</b></div>
            <div class="story-app">
              <div id="story-form" class="story-form"></div>
              <div class="story-chatter">
                <p class="story-chatter-bar"><b>Send message</b><span>Log note</span><span>Activity</span></p>
                <p class="story-activity"><i>Today</i> Call Nadia about the delivery day</p>
                <p class="story-message"><b>Nadia Farouk</b> The meeting rooms first, please. Can you start on the 2nd?</p>
                <p class="story-message story-mine"><b>You</b> @Nadia yes, the 2nd. The plan is attached.</p>
                <p class="story-file">fit-out-plan.pdf</p>
              </div>
            </div>
          </div>
          <div class="story-list">
            <p class="story-search"><span class="story-chip">Status: Confirmed ×</span> Search quotes…</p>
            <table>
              <thead><tr><th>Quote</th><th>Customer</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                <tr class="story-dim"><td>Q-2026-0139</td><td>Nile Traders</td><td>$8,120.00</td><td>Quotation</td></tr>
                <tr class="story-ours"><td>Q-2026-0142</td><td>Delta Foods</td><td>$13,360.00</td><td>Confirmed</td></tr>
                <tr><td>Q-2026-0144</td><td>Amira Clinics</td><td>$5,400.00</td><td>Confirmed</td></tr>
                <tr class="story-dim"><td>Q-2026-0147</td><td>Sahel Resorts</td><td>$21,900.00</td><td>Sent</td></tr>
              </tbody>
            </table>
          </div>
          <p class="story-toast">✓ Quote confirmed</p>
          <code class="story-rule">"invisible": "not site_visit"</code>
          <p class="story-theme"></p>
          <div class="story-server">
            <svg viewBox="0 0 200 60" aria-hidden="true"><path d="M4 30 C 60 0, 140 60, 196 30" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="5 6"/><circle class="story-packet" r="6" fill="currentColor"><animateMotion dur="1.4s" repeatCount="indefinite" path="M4 30 C 60 0, 140 60, 196 30"/></circle></svg>
            <div class="story-db"><b>Your server</b><code>PUT /quotes/142</code><span>✓ Saved</span></div>
          </div>
          <ul class="story-frameworks"><li>JavaScript</li><li>React</li><li>Vue</li><li>Angular</li></ul>
        </div>
      </div>
      <nav class="story-rail" aria-label="The story's chapters">
        ${STORY.map((s, i) => `<button type="button" aria-label="${s[0]}" aria-current="${i ? 'false' : 'step'}"></button>`).join('')}
      </nav>
    </div>
  </div>
</section>

<section class="chapter chapter-center" id="everything" aria-labelledby="everything-h">
  <div class="chapter-copy">
    <h2 id="everything-h" class="everything-h">Each part, in more depth</h2>
  </div>
  <ul class="powers">
    ${POWERS.map(power).join('\n    ')}
  </ul>
</section>

<section class="chapter chapter-center" id="frameworks" aria-labelledby="frameworks-h">
  <div class="chapter-copy">
    <p class="chapter-no">4 · Any framework</p>
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

<section class="chapter" id="templates" aria-labelledby="templates-h">
  <div class="chapter-copy">
    <p class="chapter-no">5 · Ready to start</p>
    <h2 id="templates-h">Start from a template, in the look you know</h2>
    <p>${TEMPLATES.length} ready pages — contact forms, surveys, bookings, invoices, orders, tasks — each one JSON file. Eight themes dress any of them as Material, Fluent, Apple, Bootstrap, shadcn, Ant Design, Odoo or Google Forms, light or dark. This one changes as you watch; pick a theme to keep it.</p>
    <div class="theme-picks" role="group" aria-label="Theme">
      ${THEMES.map(([id, name]) => `<button type="button" data-theme="${id}" aria-pressed="false">${name}</button>`).join('\n      ')}
    </div>
    <pre class="tpl-code" tabindex="0" aria-label="Showing a template"><code>const page = await fetch('/templates/newsletter.page.json')
  .then((r) => r.json());
Fieldia.mountViewer(host, { page, theme: 'fluent' });</code></pre>
  </div>
  <div class="chapter-live tpl-live">
    <div class="tpl-host" id="tpl-form" role="region" aria-label="A template, in each theme"></div>
    <p class="sheet-caption" id="tpl-caption" aria-live="polite">The newsletter template</p>
  </div>
  <div class="tpl-strip">
    ${SHOWN.map(templateCard).join('\n    ')}
  </div>
  <p class="tpl-more"><a class="btn btn-solid" href="/templates/">See all ${TEMPLATES.length} templates</a></p>
</section>

<section class="chapter chapter-wide" id="real" aria-labelledby="real-h">
  <div class="chapter-copy">
    <p class="chapter-no">6 · Proven</p>
    <h2 id="real-h">Nineteen real ERP screens, already running on it</h2>
    <p>We rebuilt nineteen screens of a working ERP, from a two-field dialog to a legal case with fifteen tabs and twelve tables, each with its own records, buttons and rules. Open any of them: each works in all four frameworks.</p>
  </div>
  <div class="reel" role="region" aria-label="The nineteen real pages">
    ${row(REAL.slice(0, half))}
    ${row(REAL.slice(half))}
  </div>
</section>

<section class="chapter chapter-flip" id="designer" aria-labelledby="designer-h">
  <div class="chapter-copy">
    <p class="chapter-no">7 · No code needed</p>
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
    <p class="chapter-no">8 · Tested and open</p>
    <h2 id="numbers-h">Tested on every change, and small enough for a script tag</h2>
  </div>
  <ul class="figures">
    <li><b class="count" data-to="1586">1,586</b><span>browser tests, driving the demos by mouse and keyboard in every framework</span></li>
    <li><b class="count" data-to="3605">3,605</b><span>unit tests across the ten packages</span></li>
    <li><b class="count" data-to="135">135</b><span>KB gzipped: the whole engine in one script tag, no build step</span></li>
    <li><b>AA</b><span>WCAG 2.2, checked with axe on every demo, light and dark, and in Arabic</span></li>
  </ul>
</section>

<section class="finale" aria-labelledby="finale-h">
  <h2 id="finale-h">Build your first page in five minutes</h2>
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
<script src="/story.js"></script>
`,
};
