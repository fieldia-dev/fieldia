import { readFileSync } from 'node:fs';
import { DEMOS, demoHref } from '../../demos/catalog.mjs';

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const LIBRARY = new URL('../../examples/templates/', import.meta.url);
const TEMPLATES = JSON.parse(readFileSync(new URL('index.json', LIBRARY), 'utf8'));
const pageOf = (id) => JSON.parse(readFileSync(new URL(`${id}.page.json`, LIBRARY), 'utf8'));

/** The themes by the names people know them by, as the demos' menu says them. */
const THEME_NAMES = { material: 'Material', fluent: 'Fluent', apple: 'Apple', bootstrap: 'Bootstrap', shadcn: 'shadcn', ant: 'Ant Design', odoo: 'Odoo', 'google-forms': 'Google Forms' };
const GROUPS = [
  { id: 'forms', label: 'Forms and surveys', colour: '#0f766e' },
  { id: 'records', label: 'Business records', colour: '#0b5cad' },
];

/** One template as a card: its picture, its name and theme, what it is for, and three ways to use it. */
function card(template, colour) {
  const demo = DEMOS.find((d) => d.id === `template-${template.id}`);
  const page = pageOf(template.id);
  // A survey's steps are changed in the survey editor; a screen or a record's sheet in the screen editor.
  const editor = page.layout.type === 'wizard' ? 'designer' : 'screen';
  const name = esc(template.name);
  const tried = `/demos/${esc(demoHref(demo))}`;
  return `<article class="template-card" style="--cat: ${colour}" aria-labelledby="t-${template.id}">
    <a class="demo-thumb" href="${tried}" tabindex="-1" aria-hidden="true"><img src="/demos/thumbs/template-${template.id}.png" alt="" width="600" height="360" loading="lazy"></a>
    <h3 class="demo-name" id="t-${template.id}">${name}<span class="template-theme">${esc(THEME_NAMES[template.theme])}</span></h3>
    <p class="demo-blurb">${esc(template.blurb)}</p>
    <p class="template-uses">
      <a href="${tried}">Try it<span class="hidden-words"> — ${name}</span></a>
      <a href="/demos/${editor}/?start=template-${template.id}">Change it<span class="hidden-words"> — ${name}</span></a>
      <a href="/templates/${template.id}.page.json" download>JSON<span class="hidden-words"> — ${name}</span></a>
    </p>
  </article>`;
}

const sections = GROUPS.map((group) => {
  const list = TEMPLATES.filter((t) => t.group === group.id);
  return `<section class="gallery-section" id="${group.id}" aria-labelledby="${group.id}-h">
    <h2 id="${group.id}-h">${esc(group.label)} <span class="count">${list.length}</span></h2>
    <div class="gallery">${list.map((t) => card(t, group.colour)).join('')}</div>
  </section>`;
}).join('');

export default {
  path: '/templates/',
  title: 'Templates',
  description: `${TEMPLATES.length} ready Fieldia pages to start from — contact forms, surveys, bookings, invoices, orders, tasks — each in one of the eight themes, as JSON you can copy.`,
  body: `
<header class="gallery-hero">
  <h1>Templates</h1>
  <p class="lead"><b>${TEMPLATES.length} ready pages to start from</b>: forms and surveys for the people you serve, and the business records your team works in. Each is one JSON file, in one of the eight themes. Try it, change it in the designer, or take the file and show it with one call.</p>
  <div class="chips">
    <span class="chip"><b>${TEMPLATES.filter((t) => t.group === 'forms').length}</b> forms and surveys</span>
    <span class="chip"><b>${TEMPLATES.filter((t) => t.group === 'records').length}</b> business records</span>
    <span class="chip"><b>8</b> themes</span>
    <a class="chip chip-link" href="/look/#themes">The themes →</a>
  </div>
</header>
<div class="gallery-body">
  ${sections}
  <section class="gallery-section template-howto" aria-labelledby="use-h">
    <h2 id="use-h">Using one</h2>
    <pre class="code" tabindex="0"><code>const page = await (await fetch('https://fieldia.dev/templates/invoice.page.json')).json();
Fieldia.mountViewer(document.querySelector('#form'), { page, dataSource });</code></pre>
    <p>Every template passes the format's full check and every browser test the demos do: axe in light and dark, a phone's width, and what its card says to try. Its theme is in its own <code>look</code>; change it there, or give the viewer another.</p>
  </section>
</div>`,
};
