import { c, code } from '../layout.mjs';

export default {
  path: '/behaviour/',
  title: 'Behaviour',
  description: 'Keys, the ✓ of a field filled in right, where a save’s progress shows, a save the server refuses, a locked record, and a page in your app’s own words.',
  body: `
<p class="lead">What happens around the fields: the keys people press, what a save says, what a refused save shows, and how a record is locked and unlocked. Each is a viewer option, the same in plain JavaScript, React, Vue and Angular.</p>

<h2 id="keys">Keys</h2>
<p><kbd>Ctrl</kbd>+<kbd>Enter</kbd> (<kbd>Cmd</kbd>+<kbd>Enter</kbd> on a Mac) saves from wherever the cursor is — in a text box too, where a plain <kbd>Enter</kbd> starts a new line — and takes what is still being typed: a tag typed but not yet added is added first. In a dialog it is Save &amp; Close. Inside the lines grid, <kbd>Ctrl</kbd>+<kbd>Enter</kbd> stays the grid's: it finishes a note.</p>
<p>With ${c('enterMovesToNext')}, <kbd>Enter</kbd> moves to the next field instead of sending the form, for screens typed through from top to bottom. A field that uses <kbd>Enter</kbd> itself keeps it: an open list picks its choice. The arrow keys always stay the text box's.</p>
${code(
  'ts',
  `
mountViewer(host, {
  page, dataSource,
  keys: { enterMovesToNext: true },     // saveWithCtrlEnter: false turns Ctrl+Enter off
});`
)}

<h2 id="valid">A ✓ on a field filled in right</h2>
<p>${c('showValid: true')} puts a ✓ by a field's label once someone has filled it in and it would pass its checks — a required name typed, an email that is an email. It goes again when the field goes wrong. A yes/no box gets none: it is never wrong.</p>

<h2 id="status">Where a save's progress shows</h2>
<p>“Saving…”, “Saved”, or why not, beside Save — or, with ${c("saveStatus: 'toast'")}, in a corner, where “Saved” goes again after a moment; or with ${c("saveStatus: 'bar'")}, across the top of the page.</p>

<h2 id="refused">A save the server refuses</h2>
<p>A data source tells why it refused a save by throwing ${c('saveRefused')}, and each kind shows where it belongs:</p>
${code(
  'ts',
  `
import { saveRefused } from '@fieldia/core';

async save(request) {
  // A fetch that fails outright is told as the network by itself.
  const response = await fetch('/api/partners', {
    method: 'POST',
    body: JSON.stringify(request.values),
  });
  if (response.status === 422) {
    // { "errors": { "email": "This email is taken" } }
    const { errors } = await response.json();
    throw saveRefused({ kind: 'fields', message: 'Check the fields', fields: errors });
  }
  if (response.status === 409) {
    const { message } = await response.json();
    throw saveRefused({ kind: 'rule', message });
  }
  return response.json();
}`
)}
<table>
  <thead><tr><th>Kind</th><th>Shown</th></tr></thead>
  <tbody>
    <tr><td>${c('fields')}</td><td>Under each field, kept until that field changes; beside Save, “Not saved. Check: Email, Phone”; the focus on the first.</td></tr>
    <tr><td>${c('rule')}</td><td>A business rule, in a dialog.</td></tr>
    <tr><td>${c('network')}</td><td>A banner over the page — “Could not reach the server. Your changes are still here.” — with Retry. A ${c('fetch')} that fails is told as this by itself.</td></tr>
    <tr><td>anything else</td><td>Its message beside Save, with Retry.</td></tr>
  </tbody>
</table>
<p>A screen reader hears it at once, once: “Not saved. Check: Email” — the same when the page's own checks stop a save or a send. The fields keep their messages for when the focus reaches them.</p>

<h2 id="locked">A locked record</h2>
<p>${c('readonly: true')} shows the whole record locked: values as plain text, no Save, no prompts to type. Buttons still run, as in Odoo. ${c('editSwitch: true')} adds Edit, and Done, which saves what changed and locks the record again — or stays open on a refused save. ${c('viewer.setReadonly(false)')} unlocks it from your code; in React, Vue and Angular, changing ${c('readonly')} does.</p>

<h2 id="translate">In your app's own words</h2>
<p>Fieldia's own words come in four languages. A page's words — labels, help, choices, titles, buttons, messages — can go through your app's translator, for apps that keep translations by text or by key. Record data never does.</p>
${code(
  'ts',
  `
mountViewer(host, { page, dataSource, translate: (text) => i18n.t(text) });

// or translate a page once, where you load it:
import { translatePage } from '@fieldia/core';
const french = translatePage(page, (text) => catalog[text] ?? text);`
)}
<p>In Angular the input is ${c('[translator]')}: a ${c('[translate]')} binding goes to the element's own HTML attribute.</p>
`,
};
