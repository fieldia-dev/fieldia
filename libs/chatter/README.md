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
/ `cancel`, `followers` / `follow` / `unfollow` — and a part whose method is
missing is not shown. `createMemoryChatter` keeps everything in memory, for
demos and tests.

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
messages by when each happened — "Asked for approval", "Approved for Finance",
"Rejected for Finance" with why — as events, kept up as decisions are taken
and never posted to the source. `chatterSlot({ source, approvals: false })`
tells none, where your server posts each decision in the conversation itself;
`approvalEntries(approval, labels)` gives the events for a chatter of your own.

Message HTML is cleaned before it is shown; what people type is posted as
escaped text. MIT.
