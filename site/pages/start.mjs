import { c, code } from '../layout.mjs';
import { COUNTS, SIZES } from '../facts.mjs';

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
<p>Tables of lines that should edit like a spreadsheet add ${c('@fieldia/grid')} — see <a href="/fields/#grid">the grid</a>; code in any of ${COUNTS.codeLanguages} languages adds ${c('@fieldia/code')}, or ${c('@fieldia/monaco')} for VS Code's editor — see <a href="/fields/#code">the code editors</a>; a place or an area on a map, a list's records on one, or a map of a record's places, its live courier and its route, adds ${c('@fieldia/map')} — see <a href="/maps/">maps</a>; a record's conversation and to-dos beside it add ${c('@fieldia/chatter')} — see <a href="/chatter/">the chatter</a>.</p>
<p>No bundler? Load the script bundle instead — it sets the global ${c('Fieldia')}. See <a href="#script">a script tag</a> below.</p>

<h2 id="first-page">A first page</h2>
<p>A page names its fields once, then lays them out. This one collects sign-ups, so its data is <em>responses</em> rather than a record:</p>
${code(
  'json',
  `
{
  "fieldia": "0.7",
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
${code(
  'html',
  `
<div id="app"></div>
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script>
  fetch('/signup.page.json')
    .then((response) => response.json())
    .then((page) => Fieldia.mountViewer(document.getElementById('app'), {
      page,
      dataSource: Fieldia.createMemoryDataSource(),
    }));
</script>`
)}
<p>Arabic, German and French come as small scripts of their own, ${SIZES.languages[0]} to ${SIZES.languages[1]} KB gzipped each: add the language's script after the main one, from the same version, and pass ${c('locale')}. The words only a part shows come with that part, in English, and the language's script has them all, whichever comes first. A page whose language script is missing shows Fieldia's words in English and names the script to add in the console. Installed from npm, the packages have all four languages with no extra import.</p>
${code(
  'html',
  `
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@fieldia/viewer/bundle/fieldia.ar.js"></script>
<!-- or fieldia.de.js, fieldia.fr.js -->
<script>
  Fieldia.mountViewer(document.getElementById('app'), { page, dataSource, locale: 'ar' });
</script>`
)}

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

<h2 id="next">Next</h2>
<p>The memory data source keeps everything in the browser — right for trying things, not for keeping them. <a href="/data/">Data sources</a> shows how to connect your own backend; <a href="/fields/">Fields</a> lists every field type and how it can be shown.</p>
<p>Moving to a newer Fieldia? The <a href="https://github.com/fieldia-dev/fieldia/blob/main/CHANGELOG.md">changelog</a> says what changed in each release, in plain words, with what to change in your app under <strong>Upgrading</strong>; pages your app keeps are brought up to date as they are read (<a href="/pages/#versions">versions</a>).</p>
`,
};
