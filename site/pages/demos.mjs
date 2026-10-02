import { c } from '../layout.mjs';

const FRAMEWORKS = [
  ['plain', 'Plain JavaScript', 'One call to mountViewer, no framework.'],
  ['react', 'React', 'FieldiaForm, with a custom field and a slot written as React components.'],
  ['vue', 'Vue', 'FieldiaForm, with a custom field and a slot as Vue components.'],
  ['angular', 'Angular', 'fieldia-form, with a custom field and a slot as Angular components.'],
];
const PAGES = [
  ['signup', 'Workshop sign-up', 'sections, conditions, validation, a response'],
  ['survey', 'Survey', 'a wizard that skips the steps that do not apply'],
  ['customer', 'Customer record', 'a business sheet: statusbar, stat buttons, tabs, lines, links'],
  ['fields', 'Every field', 'one record using every widget, with foldable sections'],
  ['order', 'Sales order', 'the lines grid: spreadsheet keys, sections and notes, moving lines, totals, columns'],
];

export default {
  path: '/demos/',
  title: 'Demos',
  description: 'The same five Fieldia pages running in plain JavaScript, React, Vue, Angular and a script tag.',
  body: `
<p class="lead">The same five pages in every framework. They are the pages the browser tests drive, so what you see here is what is tested on every change.</p>

<div class="demo-grid">
${FRAMEWORKS.map(
  ([id, name, about]) => `  <article class="demo-card">
    <h2>${name}</h2>
    <p>${about}</p>
    <ul>
${PAGES.map(([page, title, shows]) => `      <li><a href="/demos/${id}/?page=${page}&amp;skin=${page === 'customer' || page === 'order' ? 'underline' : 'outlined'}">${title}</a> — ${shows}</li>`).join('\n')}
    </ul>
  </article>`
).join('\n')}
  <article class="demo-card">
    <h2>A script tag</h2>
    <p>No build step: the page loads ${c('fieldia.js')} and calls ${c('Fieldia.mountViewer')}.</p>
    <ul><li><a href="/demos/script/">Ask for a call back</a> — view the page source to see all of it</li></ul>
  </article>
</div>
<p>Add ${c('&dir=rtl')} or ${c('&locale=ar')} to any demo's address to see it right to left.</p>
`,
};
