import { c, code } from '../layout.mjs';

export default {
  path: '/chatter/',
  title: 'Chatter',
  description: 'A record’s conversation and to-dos beside its form: messages, notes, files, reactions, replies, mentions, activities and followers, through an interface your app implements.',
  body: `
<p class="lead">${c('@fieldia/chatter')} puts a record's conversation beside its form, the way an ERP does: messages to the record's followers, notes for the team, files, reactions, replies and @mentions, what is to be done by whom and when, and who follows the record. Plain DOM, the same in every framework.</p>

${code('sh', `npm install @fieldia/chatter`)}

<h2 id="beside-a-form">Beside a form</h2>
<p>A sheet whose ${c('sidePanel')} is the slot ${c('chatter')} shows it beside the record. ${c('chatterSlot')} fills it, following the form: it waits while the record is new, starts once it is saved, and fetches again after each save — when a backend posts what changed.</p>
${code(
  'ts',
  `
import { mountViewer } from '@fieldia/viewer';
import { chatterSlot } from '@fieldia/chatter';

mountViewer(host, {
  page, dataSource, recordId: 7,
  slots: { chatter: chatterSlot({ source, locale: 'en' }) },
});`
)}
<p>In React, Vue and Angular a slot is a component of your own; it gives ${c('chatterSlot')} an element and the form:</p>
${code(
  'tsx',
  `
function Chatter({ form }: SlotComponentProps) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => chatterSlot({ source })(box.current!, { form }), [form]);
  return <div ref={box} />;
}

<FieldiaForm page={page} dataSource={dataSource} recordId={7} slots={{ chatter: Chatter }} />`
)}
<p>On its own, anywhere: ${c("mountChatter(element, { source, record: { model: 'sale.order', id: 7 } })")}.</p>

<h2 id="source">Your server, through a source</h2>
<p>The chatter reaches your backend only through an object you write, as you write a data source. Two methods are all it needs; each other one adds a part, and a part whose method is missing is not shown.</p>
<table>
  <thead><tr><th>Method</th><th>Adds</th></tr></thead>
  <tbody>
    <tr><td>${c('messages(record)')} · ${c('post(record, message)')}</td><td>The conversation: messages, notes and tracked changes, newest first, and the composer.</td></tr>
    <tr><td>${c('upload(record, file)')}</td><td>Files: chosen or dropped, sent with a message; an image shows as a preview.</td></tr>
    <tr><td>${c('react(record, messageId, emoji)')}</td><td>Reactions, turned on and off with a click.</td></tr>
    <tr><td>${c('people(query)')}</td><td>@mentions, who an activity is for, and followers to add.</td></tr>
    <tr><td>${c('activityTypes()')} · ${c('activities(record)')} · ${c('schedule')} · ${c('markDone')} · ${c('cancel')}</td><td>Activities: overdue, today and planned; scheduled, done with what came of it, or cancelled.</td></tr>
    <tr><td>${c('followers(record)')} · ${c('follow')} · ${c('unfollow')}</td><td>Who follows the record.</td></tr>
  </tbody>
</table>
<p>${c('createMemoryChatter({ me, people, activityTypes, records })')} keeps everything in memory, for demos, tests and prototypes — it is what the <a href="/demos/">demos</a> run on.</p>

<h2 id="details">What it takes care of</h2>
<ul>
  <li><strong>Safe to show.</strong> Message HTML is cleaned before it is shown — no scripts, no event handlers. What people type is posted as escaped text, a paragraph for each block.</li>
  <li><strong>Its own keys.</strong> <kbd>Ctrl</kbd>+<kbd>Enter</kbd> in the composer sends the message; it does not save the record around it. <kbd>Escape</kbd> closes the composer, or the list of people first.</li>
  <li><strong>Nothing in a form submits.</strong> Every button is a plain button, so a reaction inside a form never sends the form.</li>
  <li><strong>Four languages</strong>, as Fieldia's own words are: ${c('locale')} and ${c('labels')}, as the viewer takes them.</li>
</ul>
`,
};
