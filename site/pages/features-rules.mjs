import { demoHref as demo, featurePage } from '../feature-page.mjs';

/** A feature page: Rules and actions. What a page decides for itself, and what its buttons do. */
export default featurePage({
  path: '/features/rules/',
  folder: 'rules',
  title: 'Rules and actions',
  description: 'Rules and actions with Fieldia: fields shown, required and locked by conditions, values worked out as people type, answer checks, and buttons that run steps, all written in the page.',
  kicker: 'Rules and actions',
  headline: ['The page decides.', 'Your code does not have to.'],
  lede: 'When a field shows, when it is required, what a total comes to, what a button does: written once in the page, as short expressions and steps, and run the same in every framework. This order is live. Add a chair.',
  opening: { frame: 'page=rules&skin=outlined', title: 'A live order whose totals and discount work themselves out' },
  parts: [
    {
      id: 'conditions',
      no: 'Show, hide, require, lock',
      title: 'Fields that appear when the answer calls for them',
      body: 'Each field can be shown, required or locked by a condition on the others, such as role == ’other’. The page says it once; the form follows it on every keystroke.',
      ticks: ['invisible, required and readonly as conditions, on fields, groups, tabs and steps', 'Conditions on who is looking, and on values your app passes in', 'A hidden field’s answer is never sent', 'Checked when the page loads: a misspelt field name is caught at once'],
      shot: 'shows.png', alt: 'A sign-up where Your role is Something else, and a required Which role? box has appeared under it', width: 1000, height: 520,
      tryIt: ['Try the sign-up', demo('page=signup&skin=outlined')], docs: ['Rules, in the docs', '/pages/'],
    },
    {
      id: 'computed',
      no: 'Worked out as people type',
      title: 'Totals, discounts and dates that keep themselves right',
      body: 'A value can be worked out from others: a line’s subtotal, an order’s total, a discount past a threshold, days between two dates. People may still change what the page set.',
      ticks: ['compute: sum, count, round, days and if, over fields and lines', 'setWhen: a value set by a condition, and left to the person after', 'Answer rules: an error that stops a send, or a warning that does not', 'Lines, totals and taxes, as a spreadsheet would'],
      shot: 'totals.png', alt: 'An office supplies order: two lines, a total of 2,370.00, a discount set to 10 because the total passed 1,000, and a warning under a personal email address', width: 1000, height: 720,
      tryIt: ['Try the order', demo('page=rules&skin=outlined')], docs: ['Values and answer rules, in the docs', '/pages/'],
    },
    {
      id: 'buttons',
      no: 'Buttons that run steps',
      title: 'A button says what it does, step by step',
      body: 'Buttons run steps written in the page: set a value, save, open another page as a dialog or a side panel and take its answer back, post to the chatter, archive, duplicate.',
      ticks: ['Sixteen kinds of step: set, save, open, call, ask, check, say, post and more', 'Open a page in a dialog or a side panel, from any side, and bring its answer back', 'A button busy while its steps run, never pressed twice', 'Buttons shown by condition, as a record’s header shows them'],
      shot: 'panel.png', alt: 'Order by phone: a New customer side panel open over the order, its name already filled in with the caller’s', width: 1280, height: 720,
      tryIt: ['Try the phone order', demo('page=quick-order&skin=outlined')], docs: ['Actions, in the docs', '/actions/'],
    },
    {
      id: 'ask',
      no: 'Ask first, then your server',
      title: 'The questions and checks before anything is sent',
      body: 'Before a save or a send, a page can check its fields, ask the person, and call your server, which answers with values, words, another page or a stop.',
      ticks: ['beforeSave and afterSave moments, on the page', 'ask: a question with OK and Cancel, Cancel keeping everything', 'call: your app’s own action, answered with values or a stop', 'say: words to the person, in a toast, by tone'],
      shot: 'ask.png', alt: 'An order with a Send the order? question and Cancel and OK buttons over it, and In stock: 12 said in a toast below', width: 1000, height: 640,
      tryIt: ['Try the phone order', demo('page=quick-order&skin=outlined')], docs: ['Actions, in the docs', '/actions/'],
    },
  ],
  facts: {
    no: 'Kept right',
    title: 'Rules you can trust',
    items: [
      ['Checked early', 'Every name and condition in a page is checked when it loads, with the path to anything wrong.'],
      ['Only data', 'Rules are expressions, not code: a page from a database or a designer cannot run anything.'],
      ['The same everywhere', 'One engine runs the rules in plain JavaScript, React, Vue and Angular.'],
      ['Seen in plain words', 'The designer shows each rule as a sentence, and what it changes.'],
    ],
  },
  factLinks: [['Actions, in the docs', '/actions/'], ['The designer', '/designer/']],
  finale: { title: 'Write the rules once, in the page', words: 'Conditions, values and steps live in the JSON beside the fields they are about.' },
});
