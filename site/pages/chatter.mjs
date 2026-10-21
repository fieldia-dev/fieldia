import { c, code } from '../layout.mjs';

export default {
  path: '/chatter/',
  title: 'Chatter',
  description: 'A record’s conversation and to-dos beside its form: messages, notes, files, reactions, replies, mentions, activities and followers — WhatsApp, e-mail and SMS with their ticks, messages arriving live — through an interface your app implements.',
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
<p>As a work item's Discussion: ${c("chatterSlot({ look: 'discussion', source, me, placeholder, references, onCount })")} draws a card to write a comment in — the person's picture, then the formatted text's own editor, its toolbar inside the box while it is worked in, Cancel and Save under it — and a card for each comment, newest first, “commented Jun 14” on each. Tracked changes are left to the record's history. <kbd>Ctrl</kbd>+<kbd>Enter</kbd> saves; Save with nothing typed says why; <kbd>Escape</kbd> asks before typed words go. ${c('onCount(count, form)')} is told how many comments there are after each load and each one saved, for a count in the record's head.</p>
<p>It fetches again once the record is loaded again — after your server action changed it — and posts what a ${c('post')} step or your app's answer posts. ${c('chatterAttachments(source)')} hands its files to a sheet's attachment preview; ${c('"sidePanelBeside": "always"')} keeps it beside the sheet on any screen it fits. See <a href="/record/">Around a record</a>.</p>

<h2 id="source">Your server, through a source</h2>
<p>The chatter reaches your backend only through an object you write, as you write a data source. Two methods are all it needs; each other one adds a part, and a part whose method is missing is not shown.</p>
<table>
  <thead><tr><th>Method</th><th>Adds</th></tr></thead>
  <tbody>
    <tr><td>${c('messages(record)')} · ${c('post(record, message)')}</td><td>The conversation: messages, notes and tracked changes, newest first, and the composer.</td></tr>
    <tr><td>${c('upload(record, file, { signal, onProgress })')}</td><td>Files: chosen or dropped, stored at once and sent with a message; an image shows as a preview. Each shows on its way with a bar — call ${c('onProgress(sent, total)')} for its number — × to cancel it (stop when ${c('signal')} aborts) and Retry when it failed. Send waits for files still going, saying so, and will not send while one did not get there. The chatter's ${c('shrink')} — ${c('{ maxSide, quality }')} — makes photos smaller first.</td></tr>
    <tr><td>${c('react(record, messageId, emoji)')}</td><td>Reactions, turned on and off with a click.</td></tr>
    <tr><td>${c('people(query)')}</td><td>@mentions, who an activity is for, and followers to add.</td></tr>
    <tr><td>${c('activityTypes()')} · ${c('activities(record)')} · ${c('schedule')} · ${c('markDone')} · ${c('cancel')}</td><td>Activities: overdue, today and planned; scheduled, done with what came of it, or cancelled.</td></tr>
    <tr><td>${c('followers(record)')} · ${c('follow')} · ${c('unfollow')}</td><td>Who follows the record.</td></tr>
    <tr><td>${c('replyChannels(record)')}</td><td>The channels this record can be written to by, and to whom — a channel left out is not offered for it.</td></tr>
    <tr><td>${c('subscribe(record, push)')}</td><td>New messages and their delivery pushed as they happen, over your socket; it returns what stops it.</td></tr>
    <tr><td>${c('resend(record, messageId)')}</td><td>Retry under a failed message: it goes again, its ticks following, a second failure said again.</td></tr>
  </tbody>
</table>
<p>${c('createMemoryChatter({ me, people, activityTypes, records })')} keeps everything in memory, for demos, tests and prototypes — it is what the <a href="/demos/">demos</a> run on.</p>

<h2 id="channels">WhatsApp, e-mail, SMS and the team's notes</h2>
<p>Give the chatter your app's ${c('channels')} — each with your icon and words — and each message says the one it came or went by, with ticks on what went out: a clock on its way, one tick sent, two delivered, two in the accent read; a failed one says why under it, with Retry where your source can send it again (${c('resend')}): it goes back on its way at once, and a second failure is said again. A reply chooses its channel: the customer's last by default, the channel of the message answered, and who it goes to beside it; a channel the record cannot be written to by is not offered, and the team's note is always there. What is typed is kept as another channel is picked.</p>
${code(
  'ts',
  `
chatterSlot({
  source,
  channels: [
    { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
    { id: 'email', label: 'E-mail', icon: 'mail' },
    { id: 'sms', label: 'SMS', icon: 'phone' },
    { id: 'note', label: 'Team note', icon: 'note', note: true },
  ],
  icons: { whatsapp: '<path d="…"/>', note: '<path d="…"/>' },
});

// A message, as your source gives it:
{ id: 306, kind: 'message', author, date, body,
  channel: 'whatsapp', direction: 'out', delivery: 'read' }
{ id: 303, kind: 'message', author, date, body,
  channel: 'sms', direction: 'out', delivery: 'failed', failure: 'This number does not take text messages' }

// What a reply posts: { kind: 'message', body, channel: 'whatsapp', to: '+20 10 0482 1937' }`
)}
<p><strong>Live.</strong> With ${c('subscribe')}, what your server pushes is laid as it comes — ${c("{ type: 'message', message }")} for a new or changed message, ${c("{ type: 'delivery', id, delivery, failure }")} for its ticks. Without it, a chatter with channels asks ${c('messages')} again every 15 seconds while something changes, up to four times less often while nothing does, never while the page is out of sight or offline; ${c('live: false')} turns it off, ${c('live: { every }')} sets its pace. Nothing is fetched again whole: what changed is laid in place, a delivery never goes back, a message arriving is marked a moment and said politely, and a reply being typed is never disturbed. What arrives for a record the form no longer shows is laid nowhere.</p>
<p><strong>Follow-ups at an hour.</strong> An activity is due on a day (${c("'2026-10-20'")}) or at an hour (${c("'2026-10-20T12:30:00Z'")}), shown on the page's clock (${c('timeZone')}): “Today at 15:30”, “Overdue since 11:00”, “Due 22 Oct 2026, 09:00” — the zone's short name beside it where the reader's clock is another. Schedule activity takes a time beside the day. The channels, ticks and live messages come in a part of their own, loaded only by a chatter that has channels, is live, or shows a message that came by one. <a href="/demos/">The enquiry demo</a> shows them all.</p>

<h2 id="history">Its history, as a tab</h2>
<p>${c('historySlot')} fills a slot — a History tab — with the record's history, read from the same ${c('messages')}: events with ${c('tracking')} are its changes, messages its comments. On top, the <strong>State Graph</strong>: how the field ${c('stateField')} moved, in time order, each arrow with why above it (the new value of ${c('reasonField')}) and who and when under it, then the state it came to, its dot the colour the page's own ${c('dot')} gives it (its ${c('colours')}, else its ${c('tones')}). Under it, each change grouped by age — today, yesterday, this week, last week, this month, older — the one chosen beside the list with each field's new value and the one it replaced, struck through.</p>
${code(
  'ts',
  `
import { historySlot } from '@fieldia/chatter';

mountViewer(host, {
  page, dataSource, recordId: 7,
  slots: { history: historySlot({ source, stateField: 'state', reasonField: 'reason', kind: 'work item' }) },
});`
)}
<p>The page places ${c('{ "type": "slot", "id": "s-history", "name": "history" }')} in its History tab. The list is worked by keyboard: <kbd>↑</kbd> and <kbd>↓</kbd> move through the groups' headings and rows and choose, the change shown following; <kbd>Home</kbd> and <kbd>End</kbd>; <kbd>Enter</kbd> or <kbd>Space</kbd> on a heading folds its group. A filter at the list's heading shows field changes, comments or both. Under 760px the change goes under the list. On its own: ${c("mountHistory(element, { source, record: { model: 'work.item', id: 7 } })")}.</p>

<h2 id="details">What it takes care of</h2>
<ul>
  <li><strong>Safe to show.</strong> Message HTML is cleaned before it is shown — no scripts, no event handlers. What people type is posted as escaped text, a paragraph for each block.</li>
  <li><strong>Its own keys.</strong> <kbd>Ctrl</kbd>+<kbd>Enter</kbd> in the composer sends the message; it does not save the record around it. <kbd>Escape</kbd> closes the composer, or the list of people first.</li>
  <li><strong>Nothing in a form submits.</strong> Every button is a plain button, so a reaction inside a form never sends the form.</li>
  <li><strong>Four languages</strong>, as Fieldia's own words are: ${c('locale')} and ${c('labels')}, as the viewer takes them.</li>
</ul>
`,
};
