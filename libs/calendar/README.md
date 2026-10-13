# @fieldia/calendar

[Fieldia](https://fieldia.dev)'s calendar: a **list's records on a calendar**,
by day, week or month, or as an agenda, with a column for each person or room.
People drag a record to move it, drag its end to stretch it, press an empty
slot to make one, and move one from the keyboard with **Move to…**. A move is
written through the data source's `save`, with **Undo**. It shares the list's
search, filters and favourites, reads right to left, speaks English, Arabic,
French and German, and its code loads only when a calendar is first shown.

```sh
npm install @fieldia/calendar
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { calendarListViews } from '@fieldia/calendar';

mountViewer(host, {
  page,
  dataSource,
  listViews: calendarListViews(),
  // A slot pressed: the app opens a new record with its start and end filled in.
  onNewRecord: (values) => openNewAppointment(values),
});
```

With a map as well, register both: `listViews: { ...mapListViews({ provider }), ...calendarListViews() }`.

## The page

A list page with `calendar` offers **Calendar** beside its table:

```json
"layout": {
  "type": "list", "id": "appointments", "columns": ["patient", "start", "doctor"],
  "calendar": {
    "start": "start", "end": "stop", "title": "patient",
    "colour": "service", "resource": "doctor",
    "views": ["day", "week", "month", "agenda"], "view": "day", "opens": "calendar",
    "firstDay": 6, "hours": { "start": 8, "end": 20 }, "slot": 15
  }
}
```

| Option | What it does |
|---|---|
| `start` | When each record starts: a `date` (it takes the whole day) or a `datetime`. Required. |
| `end` | When it ends, a field of the same kind. Without it a record lasts an hour (a day, for a date) and cannot be stretched. |
| `title` | The words on each record. Required. |
| `colour` | A field whose value colours each record: the same value, the same colour. A value that is a colour itself (`#0f766e`) is used as it is. |
| `resource` | Who or what each record is with, a link, a choice, text or a whole number: the day view has a column for each, and a record dragged to another column changes it. |
| `views` | The views offered, in order: `day`, `week`, `month`, `agenda`. All four unless said. |
| `view` | The view it shows first: the first of `views` unless said. On a phone it opens on the agenda. |
| `opens` | `calendar` opens the list on its calendar; `list` (unless said) on its table. |
| `firstDay` | The week's first day, `0` Sunday to `6` Saturday: Saturday in Arabic, Monday in English, French and German unless said. |
| `hours` | The hours the day and week show, `0` to `24`: 8 to 20 unless said. A record outside them stretches them. |
| `slot` | The minutes a drag moves by and a slot holds: `15`, `30` (unless said) or `60`. |

The page check refuses a field the page lacks or one of the wrong kind, an end
of another kind than its start, a `view` that is not among `views`, and hours
that end before they start.

## What a person can do

- **See** the week (days across, the hours down), the day (a column for each
  person or room when the page names a `resource`, and one for records with
  no one), the month in whole weeks (with "+2 more" where a day is crowded)
  and the agenda (each day that has something, in order). Records that meet
  sit side by side. A whole day's records sit in the row over the hours. A
  red line marks now.
- **Move** a record by dragging it to another time, day or person, and
  **stretch** it by dragging its lower edge. Escape while dragging puts it
  back. The move is saved at once; **Undo** puts it back.
- **Make** a record by pressing an empty slot, or dragging down across the
  slots it should take, or with **New**. The app's `onNewRecord` gets the
  values (start, end, person). Without it, the viewer opens the record's page
  from `pages` in a dialog; with neither, nothing offers to make one.
- **Open** a record by pressing it, or Enter: the app's `onOpenRecord`, as a
  row of the table opens it.
- **Keys**: the arrow keys move between days and slots (flipped right to
  left), Page Up and Page Down change the week; Enter on an empty slot makes a
  record there; on a record, Enter opens it and M (or Shift+F10) opens
  **Move to…**, a small form for its day, its time and its person. Each slot
  and each record says what it is to a screen reader.

What cannot be done is hidden, never greyed: with no `save` on the data source
nothing moves; a record whose list row says `can: { edit: false }` stays where
it is and says why (`can.reason`).

## The data source

The calendar asks `list` for the records of the span it shows, with the list's
own search:

```ts
filter: [...search, { field: 'start', op: '<', value: spanEnd }, { any: [{ field: 'stop', op: '>', value: spanStart }, { field: 'start', op: '>=', value: spanStart }] }]
```

A `date` is compared as `"2026-10-14"`, a `datetime` as an ISO instant
(`toISOString()`), as the date widgets write them. Times are the reader's own;
time zones of their own come later. A move calls `save` with the changed
fields alone in `changes.values` (and the row's `version`, when the list gave
one), and Undo saves what they held before. A refused save puts the record
back and says why. In the day view, the columns of a link are the related
records `search` finds (up to 40), with any the records hold besides.

## Settings

`calendarListViews({ labels, now, limit })`:

- `labels`: words over the calendar's own, by language (`CalendarLabels` names them all).
- `now`: the moment it is now, for a demo or a test pinned to a day.
- `limit`: how many records a span asks for at most, 500 unless said. Past
  it, the calendar says how many it leaves out.

MIT licensed.
