import { c, code } from '../layout.mjs';

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
<p>Tables of lines that should edit like a spreadsheet add ${c('@fieldia/grid')} — see <a href="/fields/#grid">the grid</a>; JSON in a code editor adds ${c('@fieldia/code')} — see <a href="/fields/#code">the code editor</a>; a record's conversation and to-dos beside it add ${c('@fieldia/chatter')} — see <a href="/chatter/">the chatter</a>.</p>
<p>No bundler? Load the script bundle instead — it sets the global ${c('Fieldia')}. See <a href="#script">a script tag</a> below.</p>

<h2 id="first-page">A first page</h2>
<p>A page names its fields once, then lays them out. This one collects sign-ups, so its data is <em>responses</em> rather than a record:</p>
${code(
  'json',
  `
{
  "fieldia": "0.1",
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
<p>For a page with no build step at all. The bundle holds what runs a form — the core, the fields and the viewer — in about 81 KB gzipped, with its own words in English. It checks a page with ${c('Fieldia.checkPage')} as it shows it; the full ${c('validatePage')} is in ${c('@fieldia/core')}, for where pages are made.</p>
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
<p>Arabic, German and French come as small scripts of their own, 3 to 4 KB gzipped each: add the language's script after the main one, from the same version, and pass ${c('locale')}. A page whose language script is missing shows Fieldia's words in English and names the script to add in the console. Installed from npm, the packages have all four languages with no extra import.</p>
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

<h2 id="next">Next</h2>
<p>The memory data source keeps everything in the browser — right for trying things, not for keeping them. <a href="/data/">Data sources</a> shows how to connect your own backend; <a href="/fields/">Fields</a> lists every field type and how it can be shown.</p>
`,
};
