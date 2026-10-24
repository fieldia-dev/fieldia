import { c, code } from '../layout.mjs';
import { COUNTS, SIZES } from '../facts.mjs';
import { RELEASED_VERSION, tag } from '../script-tags.mjs';

export default {
  path: '/start/',
  title: 'Get started',
  description: 'Install Fieldia, write a first page, and show it in plain JavaScript, React, Vue, Angular or a script tag.',
  body: `
<p class="lead">A Fieldia page is a JSON document. You show it with the viewer, or with the binding for your framework, and you give it a data source that loads and saves records.</p>

<h2 id="install">Install</h2>
<p>Pick the package for your framework. Each one brings the core, the fields and the viewer with it.</p>
${code(
  'sh',
  `
npm install @fieldia/viewer     # plain JavaScript
npm install @fieldia/react      # React 18 or 19
npm install @fieldia/vue        # Vue 3
npm install @fieldia/angular    # Angular 21 or 22`
)}
<p>Tables of lines that should edit like a spreadsheet add ${c('@fieldia/grid')} — see <a href="/fields/#grid">the grid</a>; code in any of ${COUNTS.codeLanguages} languages adds ${c('@fieldia/code')}, or ${c('@fieldia/monaco')} for VS Code's editor — see <a href="/fields/#code">the code editors</a>; a place or an area on a map, a list's records on one, or a map of a record's places, its live courier and its route, adds ${c('@fieldia/map')} — see <a href="/maps/">maps</a>; a list's records on a calendar add ${c('@fieldia/calendar')}, and as bars on a Gantt timeline ${c('@fieldia/gantt')} — see <a href="/lists/#calendar">on a calendar</a> and <a href="/lists/#gantt">on a timeline</a>; a record's conversation and to-dos beside it add ${c('@fieldia/chatter')} — see <a href="/chatter/">the chatter</a>.</p>
<p>No bundler? Load the script bundle instead — it sets the global ${c('Fieldia')}. See <a href="#script">a script tag</a> below.</p>

<h2 id="first-page">A first page</h2>
<p>A page names its fields once, then lays them out. This one collects sign-ups, so its data is <em>responses</em> rather than a record:</p>
${code(
  'json',
  `
{
  "fieldia": "0.12",
  "id": "signup",
  "title": "Workshop sign-up",
  "data": { "kind": "responses" },
  "fields": {
    "name":  { "type": "char", "label": "Full name", "required": true },
    "email": { "type": "char", "label": "Email", "required": true },
    "role":  {
      "type": "selection", "label": "Your role",
      "options": [
        { "value": "developer", "label": "Developer" },
        { "value": "other", "label": "Something else" }
      ]
    },
    "other_role": { "type": "char", "label": "Which role?" }
  },
  "layout": {
    "type": "sections", "id": "sections",
    "children": [{
      "type": "section", "id": "you", "columns": 2,
      "children": [
        { "type": "field", "id": "name", "field": "name" },
        { "type": "field", "id": "email", "field": "email" },
        { "type": "field", "id": "role", "field": "role", "widget": "radio" },
        { "type": "field", "id": "other_role", "field": "other_role",
          "invisible": "role != 'other'", "required": true }
      ]
    }]
  }
}`
)}
<p>${c('Which role?')} shows only when someone picks <em>Something else</em>, and it is required only then. <a href="/pages/">The page format</a> describes every part.</p>

<h2 id="plain">Plain JavaScript</h2>
${code(
  'ts',
  `
import { mountViewer } from '@fieldia/viewer';
import { createMemoryDataSource } from '@fieldia/core';
import page from './signup.page.json';

const viewer = mountViewer(document.getElementById('app'), {
  page,
  dataSource: createMemoryDataSource(),
  skin: 'outlined',
});`
)}
<p>${c('mountViewer')} returns a handle: ${c('viewer.form')} is the live form (values, errors, ${c('setValue')}, ${c('subscribe')}), and ${c('viewer.destroy()')} removes it.</p>

<h2 id="react">React</h2>
${code(
  'tsx',
  `
import { FieldiaForm } from '@fieldia/react';

export function Signup() {
  return <FieldiaForm page={page} dataSource={dataSource} skin="outlined" />;
}`
)}

<h2 id="vue">Vue</h2>
${code(
  'vue',
  `
<script setup lang="ts">
import { FieldiaForm } from '@fieldia/vue';
</script>

<template>
  <FieldiaForm :page="page" :data-source="dataSource" skin="outlined" />
</template>`
)}

<h2 id="angular">Angular</h2>
${code(
  'ts',
  `
import { Component } from '@angular/core';
import { FieldiaFormComponent } from '@fieldia/angular';

@Component({
  selector: 'app-signup',
  imports: [FieldiaFormComponent],
  template: \`<fieldia-form [page]="page" [dataSource]="dataSource" skin="outlined" />\`,
})
export class SignupComponent {
  readonly page = page;
  readonly dataSource = dataSource;
}`
)}

<h2 id="script">A script tag</h2>
<p>For a page with no build step at all. The bundle holds what runs a form — the core, the fields and the viewer — in ${SIZES.script} KB gzipped, with its own words in English. Its larger parts — a list's screen, lines, files, a survey's steps, the themes and ${SIZES.parts - 5} more — are scripts of their own beside it, which it fetches the first time a page uses one. It checks a page with ${c('Fieldia.checkPage')} as it shows it; the full ${c('validatePage')} is in ${c('@fieldia/core')}, for where pages are made.</p>
<p>Each tag names a version — ${RELEASED_VERSION}, the latest — and carries the hash of its file (${c('integrity')}, with ${c('crossorigin="anonymous"')}): the browser runs that file and no other, so a page takes no release until you move it to one, and never a copy changed on the way. Copy the tags as they are here. To move to a newer release, take every tag from that release's README (on npm, its version's page), fieldia.js and the scripts beside it alike. The parts fieldia.js fetches are checked the same way: it carries the hash of each one it was built with, and a part that is not that file is refused — what needed it says it could not be loaded. Served from your own site instead, the scripts keep their folder together; from another origin than the page's, that origin sends ${c('Access-Control-Allow-Origin')}, as a CDN does.</p>
${code(
  'html',
  `
<div id="app"></div>
${tag('fieldia.js')}
<script>
  fetch('/signup.page.json')
    .then((response) => response.json())
    .then((page) => Fieldia.mountViewer(document.getElementById('app'), {
      page,
      dataSource: Fieldia.createMemoryDataSource(),
    }));
</script>`
)}
<p>Arabic, German and French come as small scripts of their own, ${SIZES.languages[0]} to ${SIZES.languages[1]} KB gzipped each, and so do Turkish, Persian, Urdu and Spanish (${c('fieldia.tr.js')}, ${c('fieldia.fa.js')}, ${c('fieldia.ur.js')}, ${c('fieldia.es.js')}) — machine-assisted, not yet reviewed by a native speaker: add the language's script after the main one, from the same version, with its own integrity (every language's tag is below), and pass ${c('locale')}. The words only a part shows come with that part, in English, and the language's script has them all, whichever comes first. A page whose language script is missing shows Fieldia's words in English and names the script to add in the console. Installed from npm, the packages have English, Arabic, German and French with no extra import, and fetch Turkish, Persian, Urdu and Spanish each in a chunk of its own where it is spoken: the viewer waits for them before it draws, so a page's first paint is in its language.</p>
${code(
  'html',
  `
${tag('fieldia.js')}
${tag('fieldia.ar.js')}
<script>
  Fieldia.mountViewer(document.getElementById('app'), { page, dataSource, locale: 'ar' });
</script>`
)}
<details class="tags">
<summary>Every language's tag</summary>
${code(
  'html',
  `
${[['ar', 'Arabic'], ['de', 'German'], ['fr', 'French'], ['tr', 'Turkish'], ['fa', 'Persian'], ['ur', 'Urdu'], ['es', 'Spanish']].map(([locale, name]) => `<!-- ${name} -->\n${tag(`fieldia.${locale}.js`)}`).join('\n')}`
)}
</details>

<h2 id="element">One tag: &lt;fieldia-form&gt;</h2>
<p>The script defines an element as it starts, so a page needs no code of its own: ${c('<fieldia-form>')} fetches its page (${c('src')}), draws its form in itself and sends the answers to its ${c('action')} as JSON — ${c('{ pageId, values, … }')}, answered with ${c('{ id }')}, or refused with ${c('{ message, fields }')}. ${c('locale')}, ${c('theme')}, ${c('skin')}, ${c('record')} and ${c('resume')} say the rest; changing one draws it again (a theme or a skin in place). What it does comes in a part of its own, fetched the first time one is on a page: until then the element is a stub, made what it is in place as it comes. ${c('action')} takes a page of responses' answers; a record's page saves through your own ${c('source')}.</p>
${code(
  'html',
  `
${tag('fieldia.js')}
<fieldia-form src="/forms/enquiry.page.json" action="/api/enquiries" locale="ar" skin="outlined"></fieldia-form>`
)}
<p>It tells what happens as events that bubble: ${c('fieldia-ready')} once drawn, ${c('fieldia-send')} (the reference your server gave, and the answers), ${c('fieldia-save')}, ${c('fieldia-step')} and ${c('fieldia-error')} when its page, or its part, cannot be had. With a little code, its properties take the rest of the viewer: ${c('page')} (given whole), ${c('source')} (your own data source, for a record's page, codes, payments) and ${c('options')} — set before its part came, they are kept; ${c('handle')} is the viewer once drawn. An app built with a bundler calls ${c('defineFieldiaForm()')} from ${c('@fieldia/viewer')} once.</p>
${code(
  'js',
  `
const form = document.querySelector('fieldia-form');
form.source = myDataSource;            // sendCode, checkCode, pay, submit… your app's own
form.addEventListener('fieldia-send', (event) => analytics.track('enquiry', { id: event.detail.id }));`
)}

<h2 id="embed">On another site: an iframe that grows with its form</h2>
<p>For a form your app serves on a site that is not yours — a partner's, a WordPress page, a broker's listing — one script tag places an iframe of your form's page where it stands: ${c('fieldia-embed.js')}, ${SIZES.embed} KB gzipped, with nothing else of Fieldia's in it. Your page holds ${c('<fieldia-form frame>')}, which tells the page round it its height as it changes — the frame grows and shrinks with the form, never a scrollbar inside — and what happens: ${c('fieldia-ready')}, ${c('fieldia-step')} and ${c('fieldia-send')} (its reference, never the answers) as events on the iframe, from your page's origin only.</p>
${code(
  'html',
  `
<!-- On the partner's page -->
${tag('fieldia-embed.js', '\n  data-src="https://forms.example.com/enquiry" data-locale="ar" data-theme="material" async')}

<!-- Your form's page, https://forms.example.com/enquiry -->
${tag('fieldia.js')}
<fieldia-form src="/forms/enquiry.page.json" action="/api/enquiries" frame></fieldia-form>`
)}
<p>${c('data-locale')}, ${c('data-theme')} and ${c('data-skin')} reach the form through its frame's address; ${c('data-title')} names the frame for a screen reader; ${c('data-height')} is its height before the form tells its own (600). The partner page's campaign parameters — ${c('utm_source')}, ${c('utm_medium')}, ${c('utm_campaign')}, ${c('utm_term')}, ${c('utm_content')}, or those ${c('data-params')} names — are passed on, so a page that fills hidden fields from its link (<a href="/data/#prefill">${c('prefill')}</a>) knows which campaign brought the person to the partner. The <a href="/demos/embed/">embed demo</a> shows both.</p>

<h2 id="csp">Under a strict Content-Security-Policy</h2>
<p>A bank's, a government's or an enterprise's site often runs under a policy with no ${c("'unsafe-inline'")} and no ${c("'unsafe-eval'")}. Fieldia works under it: nothing it runs is code made from text, nothing it draws writes a style attribute (what is worked out as it is drawn — a width, a colour — is set through the element's style object, which a policy lets be), and every ${c('<style>')} it adds — its own sheet, each part's as it comes, the calendar's, the chatter's, a map's, the designer's, CodeMirror's and AG Grid's — carries your page's nonce. Give it as ${c('nonce')}, the nonce your server wrote into this response's policy:</p>
${code(
  'js',
  `
// Content-Security-Policy: script-src 'nonce-r4nd0m'; style-src 'nonce-r4nd0m'; img-src 'self' data: blob:
mountViewer(element, { page, dataSource, nonce: 'r4nd0m' });  // <FieldiaForm nonce="…">, :nonce, [nonce] alike
mountScreenEditor(element, { designer, nonce: 'r4nd0m' });     // and the survey editor`
)}
<p>Left out, Fieldia takes the page's ${c('<meta property="csp-nonce" nonce="…">')}, as Vite writes it, and the one-tag script takes its own tag's: give ${c('<script nonce="…" src="…/fieldia.js">')} the nonce and it carries it to every part's tag it adds and every sheet. A formatted text keeps its own looks — a line centred, a word's colour, highlight and size — in its value as style attributes, the HTML you store and e-mail; Fieldia never has the browser read one as HTML (a policy would refuse it), and puts each on through the element's style object, so the text looks the same under the policy as without it. Pictures and files shown in place need ${c('img-src data: blob:')} (and ${c('frame-src blob:')} for a PDF's preview). Two add-ons bring code of their own that a policy may refuse: VS Code's editor (${c('@fieldia/monaco')}) adds sheets Monaco makes with no nonce — under a strict policy use ${c('@fieldia/code')}, which carries it — and a map draws Leaflet and your map provider's tiles, which ${c('img-src')} must allow.</p>
<p>See it working: <a href="/demos/csp/">a sign-up, a customer, an order and every field under a strict policy</a>, and <a href="/demos/csp/script.html">the one-tag script under it</a> — each says what the policy refused: nothing. fieldia.dev is a static site with no server of its own, so there the policy is a meta tag in the page and its nonce was written once, when the site was built, the same for every visitor. Your server does what a static site cannot: it sends the policy as a header and makes a new nonce for every response — a nonce that never changes is one an attacker can read and reuse.</p>

<h2 id="server">On a server: Next and Nuxt</h2>
<p>A site whose pages a server renders shows the form before any script has run. ${c('firstPaint(page, { values })')}, from ${c('@fieldia/viewer/server')}, draws the form's first paint as plain HTML — its title, its sections, each field's label and its box with its value — in Fieldia's look, the page's own rules run (what is hidden, read-only, worked out), in Node with no DOM. The viewer then mounts <em>over</em> it: the live form is drawn out of sight and takes the first paint's place in one step once it is drawn and its record in — never a blank — and what a person typed in the first paint meanwhile is carried over, the caret where it was. In React and Vue, the component does it given ${c('firstPaint')}, on the server as Next and Nuxt render it, and hydrates it as it is:</p>
${code(
  'js',
  `
<FieldiaForm page={page} dataSource={dataSource} recordId={record.id} firstPaint={{ values: record }} />   // Next
<FieldiaForm :page="page" :data-source="dataSource" :record-id="record.id" :first-paint="{ values: record }" />  // Nuxt

// Any other server: the HTML into the element the viewer is mounted in.
const html = \`<div id="app">\${firstPaint(page, { values: record })}</div>\`;`
)}
<p>It is a first paint, not the whole form rendered on the server: what needs a script — a date's calendar, a choice's own list, a table of lines' tools, a map — comes with the live form. The first paint holds no style attribute, so under a <a href="#csp">strict policy</a> it needs only the ${c('nonce')}.</p>

<h2 id="testing">Testing your forms</h2>
<p>${c('@fieldia/testing')} tests the forms in your app as people use them: a field found by the words of its label, typed in and left, picked from, ticked; a button pressed by its words; then what a person sees read back — a field's problems, what its box shows. The same helpers for Testing Library (any DOM, under Jest or Vitest) and for Playwright:</p>
${code(
  'js',
  `
import { fieldia } from '@fieldia/testing';            // Testing Library, jsdom, a browser
// import { fieldia } from '@fieldia/testing/playwright'; // Playwright: fieldia(page)

const form = fieldia(host);
await form.fill('Email', 'mona@');
expect(form.errorsOf('Email')).toEqual(['Enter an email address, like name@example.com']);
await form.fill('Email', 'mona@example.com');
await form.pick('Country', 'Egypt');
await form.check('I agree to the terms');
await form.press('Submit');
expect(form.valueOf('Email')).toBe('mona@example.com');`
)}
<p>Each step sends the events a person's would — a key at a time, so a box that refuses a letter refuses it in your test too — and leaves the box, where Fieldia says a problem. And one line of CI keeps the pages your app stores valid after an upgrade: ${c('npx fieldia-check pages/')} checks each as Fieldia reads it, says what is wrong with each, and fails the build when one is refused. See the package's README for every helper.</p>

<h2 id="next">Next</h2>
<p>The memory data source keeps everything in the browser — right for trying things, not for keeping them. <a href="/data/">Data sources</a> shows how to connect your own backend; <a href="/fields/">Fields</a> lists every field type and how it can be shown.</p>
<p>Moving to a newer Fieldia? The <a href="https://github.com/fieldia-dev/fieldia/blob/main/CHANGELOG.md">changelog</a> says what changed in each release, in plain words, with what to change in your app under <strong>Upgrading</strong>; pages your app keeps are brought up to date as they are read (<a href="/pages/#versions">versions</a>).</p>
`,
};
