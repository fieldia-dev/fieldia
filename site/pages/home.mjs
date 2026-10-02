import { code } from '../layout.mjs';

export default {
  path: '/',
  title: 'Fieldia',
  description: 'Describe a form or an app screen once, as JSON, and show it in plain JavaScript, React, Vue or Angular. Validation, conditions, records and surveys included.',
  body: `
<section class="hero">
  <div class="hero-text">
    <h1>Forms and app screens, written once as JSON</h1>
    <p class="lead">Describe a page — its fields, its layout, when a field shows or is required — and Fieldia draws it in plain JavaScript, React, Vue or Angular, checks what people enter, and hands the record to your backend.</p>
    <p class="cta"><a class="button primary" href="/start/">Get started</a> <a class="button" href="/demos/">See the demos</a></p>
  </div>
  <div class="hero-live" aria-label="A live Fieldia form">
    <div class="live-bar">
      <label>Skin <select id="live-skin"><option value="outlined">outlined</option><option value="underline">underline</option></select></label>
      <label>Language <select id="live-locale"><option value="en">English</option><option value="ar">العربية</option><option value="de">Deutsch</option><option value="fr">Français</option></select></label>
    </div>
    <div id="live-form" class="live-form"></div>
    <p class="live-note" id="live-note" role="status"></p>
  </div>
</section>

<section class="band">
  <h2>One page, every framework</h2>
  <p>The page is plain JSON: you can store it, generate it from your backend's own field definitions, or build it in a designer. The same page renders the same way everywhere, because every framework binding is a thin shell around one plain-DOM viewer.</p>
  <div class="cols">
${code(
  'html',
  `
<!-- No build step: one script tag -->
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script>
  Fieldia.mountViewer(document.getElementById('app'), {
    page, dataSource: Fieldia.createMemoryDataSource(),
  });
</script>`
)}
${code(
  'tsx',
  `
// React, Vue and Angular: the same page, the same look
import { FieldiaForm } from '@fieldia/react';

<FieldiaForm page={page} dataSource={api} recordId={42} />`
)}
  </div>
</section>

<section class="band">
  <h2>What a page can do</h2>
  <ul class="features">
    <li><strong>Eighteen field types</strong> text, numbers, money, dates, choices, ratings, links to other records with search, tags, tables of lines, files, images, formatted text.</li>
    <li><strong>Rules in the page</strong> <code>invisible</code>, <code>readonly</code> and <code>required</code> take a condition such as <code>role != 'other'</code>, checked as people type.</li>
    <li><strong>Records and surveys</strong> a record page loads, edits and saves one record; a responses page collects answers, and a wizard skips the steps that do not apply.</li>
    <li><strong>Business sheets</strong> a statusbar, stat buttons, a ribbon, alerts, tabs and a side panel, for the screens of an ERP.</li>
    <li><strong>Two skins, four languages</strong> <code>underline</code> and <code>outlined</code>; English, Arabic, German and French, with Arabic right to left.</li>
    <li><strong>No backend of its own</strong> records load and save through a small interface your app implements, so Fieldia fits whatever you already have.</li>
  </ul>
</section>

<section class="band">
  <h2>Four rules</h2>
  <ol class="rules">
    <li><strong>The core never touches the DOM.</strong> Page format, conditions, validation and record state run in a browser, in Node, or on the server that generates pages.</li>
    <li><strong>Fieldia knows no backend.</strong> Pages arrive as JSON; records travel through an interface your app implements.</li>
    <li><strong>Render once, bind thinly.</strong> Fields render in plain DOM, once. A framework binding adds nothing a framework would not need.</li>
    <li><strong>A page is data.</strong> No functions or components inside a page: buttons name actions, and your app decides what they do.</li>
  </ol>
</section>

<script src="/fieldia.js"></script>
<script src="/live.js"></script>
`,
};
