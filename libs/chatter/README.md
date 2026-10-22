# @fieldia/chatter

A record's conversation and to-dos beside its [Fieldia](https://fieldia.dev)
form: messages to its followers, notes for the team, files, reactions,
replies, @mentions, activities and followers. Plain DOM, so it works the same
in plain JavaScript, React, Vue and Angular.

```sh
npm install @fieldia/chatter
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { chatterSlot } from '@fieldia/chatter';

mountViewer(host, { page, dataSource, recordId: 7, slots: { chatter: chatterSlot({ source }) } });
```

A sheet whose `sidePanel` is the slot `chatter` shows it beside the record. It
waits while the record is new, starts once it is saved, and fetches again
after each save. On its own: `mountChatter(element, { source, record: { model, id } })`.

The chatter reaches your server only through a `source` you write for your
backend, as you write a data source. `messages` and `post` are all it needs;
each other method adds a part — `upload` (each file stored as it is chosen, with a bar, Cancel and Retry; Send waits for them), `react`, `people` (mentions,
assignees, followers), `activityTypes` / `activities` / `schedule` / `markDone`
/ `cancel`, `followers` / `follow` / `unfollow`, `replyChannels`, `subscribe`, `resend` —
and a part whose method is missing is not shown. `createMemoryChatter` keeps everything in memory, for
demos and tests.

## A conversation that knows its channels

Give the chatter your app's channels and each message says the one it came
or went by — WhatsApp, e-mail, SMS, the team's notes, each with your icon and
words — with ticks on what went out: a clock on its way, one tick sent, two
delivered, two in the accent read, and a failed one says why under it. A
reply chooses its channel: the customer's last by default (the newest message
`direction: 'in'`), the channel of the message answered with ↩, a channel
this record cannot be written to by hidden, and who it goes to beside it.

```ts
chatterSlot({
  source,
  channels: [
    { id: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp' },
    { id: 'email', label: 'E-mail', icon: 'mail' },
    { id: 'note', label: 'Team note', icon: 'note', note: true },
  ],
  icons: { whatsapp: '<path d="…"/>' },
});
```

A message carries `channel`, `direction` (`in` from the customer, `out` from
here), `delivery` (`pending`, `sent`, `delivered`, `read`, `failed`) and
`failure`; a post carries the `channel` picked and `to`. The source's
`replyChannels(record)` gives the channels a record can be written to by,
`[{ id: 'whatsapp', to: '+20 10 0482 1937' }]` — none, and Send message is
hidden; without it, every channel is offered. With `resend(record,
messageId)`, a failed message offers Retry under its failure: it goes back on
its way at once, its ticks follow what the channel tells next, and a second
failure is said again (without the member, no Retry).

**Live.** `subscribe(record, push)` pushes new messages and delivery changes
as they happen (`{ type: 'message', message }`, `{ type: 'delivery', id,
delivery, failure }`) and returns what stops it; without it, a chatter with
channels asks `messages` again every 15 seconds while something changes, up
to four times less often while nothing does, never while the page is out of
sight or offline. `live: false` turns it off, `live: { every }` sets the pace
(or turns it on for a chatter without channels). Nothing is fetched again
whole: what changed is laid in place, a delivery never goes back, what
arrives is said politely, and a reply being typed is never disturbed. What is
pushed or answered for a record the form no longer shows is laid nowhere.

**Follow-ups at an hour.** An activity's `due` is a day (`2026-10-20`) or an
hour — an instant (`2026-10-20T12:30:00Z`) or a time on the page's clock
(`2026-10-20T15:30`) — shown on the page's clock (`timeZone`, the slot gives
the page's): "Today at 15:30", "Overdue since 11:00", "Due 22 Oct 2026,
09:00", the zone's short name beside it where the reader's clock is another.
Scheduling takes a time beside the day; one given is posted as its instant.

Channels, ticks and live messages come in a part of their own, loaded the
first time a chatter has channels, is live, or shows a message that came by
a channel. `createMemoryChatter({ live: true, deliverAfter, replyChannels, refuse })`
pushes, delivers and answers them for demos and tests, with `receive` and
`deliver` to play the customer's side.

A record's history, as a work item's History tab shows it, fills a slot of
its own from the same source: `historySlot({ source, stateField: 'state',
reasonField: 'reason', kind: 'work item' })`. The State Graph shows how the
state moved and why; under it, each change grouped by age, the one chosen
beside the list with its new values and those they replaced.

On a page that names its records (`"records": { "one": "customer", … }`), the
chatter waits "once the customer is saved" and the history tells "Mona created
the customer" where you give no `kind`; standing alone, they take the page's
words as `records`. An app's own `notSaved` or `created`, given without its
`…Noun` sentence, is said instead.

On a page with `approval`, the record's approval history is told among its
messages by when each happened — "Asked for approval", "Approved (Finance)",
"Rejected (Finance)" with why, "No approval needed" — as events, kept up as
decisions are taken and never posted to the source. `chatterSlot({ source, approvals: false })`
tells none, where your server posts each decision in the conversation itself;
`approvalEntries(approval, labels)` gives the events for a chatter of your own.

Message HTML is cleaned before it is shown; what people type is posted as
escaped text. MIT.
