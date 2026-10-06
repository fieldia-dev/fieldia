import { c, code } from '../layout.mjs';

export default {
  path: '/actions/',
  title: 'Actions and events',
  description: 'What a button press or a moment of the form does, written as steps: pages opened in a dialog, a side panel or in place, values set, checks, questions, words said, your app’s own actions — and the events your app hears.',
  body: `
<p class="lead">A button — in the page, a record's header, a stat button or a list — and the form's moments run <em>steps</em>: plain data, in order, never code. What only your app can do is a ${c('call')} of one of its own actions, by name. The viewer draws what the steps ask of the screen; your app hears what happened as events.</p>

<p>The <a href="/demos/plain/?page=quick-order&amp;skin=outlined">Order by phone</a> demo, in each framework, is the example below.</p>

<h2 id="order">An order, in steps</h2>
${code(
  'json',
  `
{ "type": "button", "id": "new-customer", "label": "New customer", "steps": [
  { "do": "open", "page": "new-customer", "as": "panel",
    "values": { "name": "caller" },
    "into": { "customer_id": "id" },
    "then": [{ "do": "say", "message": "Customer added", "tone": "success" }] }
] }

"on": {
  "change": { "product": [{ "do": "call", "action": "check_stock" }] },
  "beforeSave": [{ "do": "check" }, { "do": "ask", "message": "Send the order?" }],
  "afterSave": [{ "do": "say", "message": "Order sent", "tone": "success" }]
}`
)}
<p><strong>New customer</strong> opens the page ${c('new-customer')} in a side panel, its name started from what was typed under “Who is calling”. Saved, the order's ${c('customer_id')} is set to the record it saved, named by that page's name field, and “Customer added” is said. Picking a product asks your app's ${c('check_stock')}; sending checks the form, then asks; once sent, it says so.</p>

<h2 id="steps">The steps</h2>
<table>
  <thead><tr><th>Step</th><th>What it does</th></tr></thead>
  <tbody>
    <tr><td>${c('open')}</td><td>Another page by its id, from your ${c('pages')}: in a ${c('dialog')} (the default), a ${c('panel')} beside the form — from its ${c('side')}: the end of the line unless it says ${c('start')}, ${c('left')}, ${c('right')}, ${c('top')} or ${c('bottom')} — or in its ${c('page')}, this form's place, with Back. On a ${c('record')} or a new one with ${c('values')}; once saved, ${c('into')} sets this form's fields from its answers (${c('id')} is the record it saved) and ${c('then')} runs here. Closed without saving, the steps after it do not run. A list page shows only what its ${c('filter')} lets through, each ${c('valueFrom')} read from this form — this order's invoices, as a smart button opens them.</td></tr>
    <tr><td>${c('set')} · ${c('clear')} · ${c('addLine')}</td><td>A field from an expression, a field emptied, a line added to a table of lines.</td></tr>
    <tr><td>${c('check')} · ${c('save')} · ${c('reset')}</td><td>The form checked, or some fields of it; saved (a page of responses sends); put back as it was loaded.</td></tr>
    <tr><td>${c('goTo')}</td><td>A tab or a wizard's step, by its id.</td></tr>
    <tr><td>${c('say')} · ${c('ask')}</td><td>Words in a tone (${c('info')}, ${c('success')}, ${c('warning')}, ${c('danger')}, ${c('muted')}); a question, No stopping the steps after it.</td></tr>
    <tr><td>${c('call')}</td><td>One of your app's actions, by name, with ${c('params')}.</td></tr>
    <tr><td>${c('close')}</td><td>The dialog or panel this form was opened in, without saving it.</td></tr>
    <tr><td>${c('openUrl')}</td><td>A web address, from an expression — ${c(`"'https://portal.example/orders/' + name"`)} — in a new tab, or this one with ${c('"newTab": false')}.</td></tr>
    <tr><td>${c('reload')}</td><td>The record loaded again, as your data source now has it: after your app changed it on its server. Your app's answer can ask for it too, with ${c('reload: true')}.</td></tr>
  </tbody>
</table>
<p>Any step may run only ${c('when')} a condition holds. One that fails or is refused stops the rest: a check with problems, No to a question, a save refused, your app saying stop, a page closed unsaved. A button's ${c('confirm')} is asked first, once; its ${c('action')}, when it names one, runs last as a ${c('call')}.</p>
<p>The moments under the page's ${c('on')}: ${c('open')} (it has its values), ${c('change')} by field — a person's change only, never a step's or your app's, so steps never chase each other round; a saved form placed in the page is named by its answers' name — ${c('beforeSave')} (a stop keeps it unsaved), ${c('afterSave')}, and ${c('show')} by tab or wizard step.</p>

<h2 id="answers">Your app's answers</h2>
${code(
  'ts',
  `
mountViewer(host, {
  page, dataSource, pages,
  onAction: async ({ action, values }) => {
    if (action !== 'check_stock') return;
    const { left, price } = await stockOf(values.product);
    // Said as a warning; the steps after it stop.
    if (!left) return { stop: 'Out of stock until November.' };
    return { values: { price }, say: { message: \`In stock: \${left}\`, tone: 'info' } };
  },
});`
)}
<p>Return nothing to go on. ${c('values')} are set as a ${c('set')} step sets them; ${c('say')} is said; ${c('open')} opens a page as an ${c('open')} step does; ${c('reload: true')} loads the record again first, as your server now has it; ${c('stop')} stops, its words said.</p>

<h2 id="host">What the viewer draws</h2>
<ul>
  <li><strong>A page opened</strong> comes from ${c('pages')} by ${c('{ id, version }')} — in a dialog or a side panel with the same data source, pages, language, skin and look; or in this form's place, with Back over it: saved, the form comes back and the steps go on; Back brings it back as it was, and they stop. A page your app has none of stops them, saying so. A page opened gets a host of its own, so its own steps run there, and a ${c('close')} step closes it.</li>
  <li><strong>Words</strong> are toasts at the foot of the screen, each in its tone, read out politely, one over another, going after a moment — not while the pointer or the focus is on one — or with their ×.</li>
  <li><strong>A question</strong> is the viewer's own box, Cancel and OK, or your ${c('confirm')}. Escape answers No there and closes nothing under it.</li>
  <li><strong>A tab</strong> a step goes to is shown, and its ${c('show')} steps run, as for a tab a person picks.</li>
  <li><strong>A button</strong> is busy while its steps run — marked so, a ring turning beside its words — and is not run twice. A check that stops it takes the focus to the first problem.</li>
</ul>
${code(
  'ts',
  `
mountViewer(host, {
  page, dataSource, pages,
  // Any part of it your own way; the rest stays the viewer's.
  host: { say: (message, tone) => myToasts.show(message, tone) },
  // A page a step opens: your router, or undefined to let the viewer open it.
  onOpen: (request) => (request.as === 'page' ? router.open(request) : undefined),
});`
)}

<h2 id="events">Events</h2>
${code(
  'ts',
  `
const viewer = mountViewer(host, { page, dataSource });
// by: 'person' | 'step' | 'app'
const off = viewer.on('change', ({ field, value, by }) => {});
viewer.on('save', ({ recordId, values }) => {});
viewer.on('send', ({ values }) => {});      // a page of responses
viewer.on('run', ({ id, result }) => {});   // steps ended, and how
viewer.on('step', ({ step }) => {});        // a wizard's step entered
viewer.setValues({ price: 380 });           // no change steps run
await viewer.run([{ do: 'check' }, { do: 'save' }]);`
)}
<p>In React, ${c('onChange')}, ${c('onSave')}, ${c('onSend')}, ${c('onStep')} and ${c('onRun')}, beside ${c('onAction')}, which may answer. In Vue, ${c('@change')}, ${c('@save')}, ${c('@send')}, ${c('@step')} and ${c('@run')}; ${c('@action')}'s handler may answer too. In Angular, ${c('(fieldChange)')} — ${c('(change)')} would hear the boxes' own change events — ${c('(save)')}, ${c('(send)')}, ${c('(step)')} and ${c('(run)')}; an output cannot answer, so the answer is the ${c('[answer]')} input, and ${c('(action)')} still tells every call.</p>
`,
};
