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
each other method adds a part — `upload`, `react`, `people` (mentions,
assignees, followers), `activityTypes` / `activities` / `schedule` / `markDone`
/ `cancel`, `followers` / `follow` / `unfollow` — and a part whose method is
missing is not shown. `createMemoryChatter` keeps everything in memory, for
demos and tests.

Message HTML is cleaned before it is shown; what people type is posted as
escaped text. MIT.
