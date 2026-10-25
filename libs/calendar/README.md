# @fieldia/calendar

[Fieldia](https://fieldia.dev)'s calendar: a **list's records on a calendar**,
by day, week or month, or as an agenda, with a column for each person or room.
People drag a record to move it, drag its end to stretch it, press an empty
slot to make one, and move one from the keyboard with **Move to…**. A move is
written through the data source's `save`, with **Undo**. It shares the list's
search, filters and favourites, reads right to left, speaks English, Arabic,
French and German — and Turkish, Persian, Urdu and Spanish, machine-assisted,
not yet reviewed by a native speaker — and its code, and its words in each
language but English, load only when a calendar is first shown.

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
| `firstDay` | The week's first day, `0` Sunday to `6` Saturday: where CLDR starts it for the region unless said (`firstWeekday`): the page's own, else the reader's where their browser asks for the page's language with one (an `en` page read in `en-EG`: Saturday, `en-GB`: Monday), else where the language is most spoken: Saturday in Arabic and Persian, Sunday in English (`en`) and Urdu, Monday in German, French, Turkish and Spanish. |
| `hours` | The hours the day and week show, `0` to `24`: 8 to 20 unless said. A record outside them stretches them. |
| `slot` | The minutes a drag moves by and a slot holds: `15`, `30` (unless said) or `60`. |

**On a zone's clock.** A calendar is on the clock of the zone its start
field names (`timeZone` on a date and time field), else its page's
(`"timeZone": "Europe/Berlin"`), else the reader's own. Its week, today, the
hours each record sits at and the line for now are that zone's wherever it is
looked at from, its short name ("CEST") beside the span where it is not the
reader's own; a slot pressed, a drag, a stretch and Move to… write the instant
that time is there, and a record moved keeps the time it really lasts across a
change of the clocks. In the hour the clocks repeat, a time is the first of the
two; in the hour they skip, it is as far past the change (02:30 is 03:30).

The page check refuses a field the page lacks or one of the wrong kind, an end
of another kind than its start, a `view` that is not among `views`, and hours
that end before they start.

On a page that names its records (`"records": { "one": "appointment",
"other": "appointments" }`), New says "New appointment", a slot "1
appointment", and Enter "makes a new appointment there".

## What a person can do

- **See** the week (days across, the hours down), the day (a column for each
  person or room when the page names a `resource`, and one for records with
  no one), the month in whole weeks (with "+2 more" where a day is crowded)
  and the agenda (each day that has something, in order). Records that meet
  sit side by side, as many as the column's width can show the start of a
  name for; past that, "+N more" opens a list of them all. A whole day's
  records sit in the row over the hours. A red line marks now.
- **Move** a record by dragging it to another time, day or person, and
  **stretch** it by dragging its lower edge. Escape while dragging or
  stretching puts it back, and Escape while dragging across empty slots makes
  nothing. The move is saved at once; **Undo** puts it back.
- **Make** a record by pressing an empty slot — one gone by too: the person
  chose it — or dragging down across the slots it should take, or with
  **New**: at the slot the keys stand on, else the next free time from now on
  the calendar's clock, rounded up to its `slot`, within its `hours`, where none
  of its records is (in the span shown where that is still to come). The app's
  `onNewRecord` gets the values (start, end, person). Without it, the viewer opens the record's page
  from `pages` in a dialog; with neither, nothing offers to make one.
- **Open** a record by pressing it, or Enter: the app's `onOpenRecord`, as a
  row of the table opens it.
- **Keys**: the arrow keys move between days and slots (flipped right to
  left), Page Up and Page Down change the week; Enter on an empty slot makes a
  record there; on a record, Enter opens it and M (or Shift+F10) opens
  **Move to…**, a small form for its day, its time and its person. It refuses
  a day more than ten years from the record's own (a year typed as 26 or
  2062), and the words after a move name the year when it changes. When the
  record leaves the days shown, the keys stand on the step toward its day.
  Each slot and each record says what it is to a screen reader.

What cannot be done is hidden, never greyed: with no `save` on the data source,
or a page whose start, end or person field is `readonly`, nothing moves; a
record whose list row says `can: { edit: false }`, or puts its start, end or
person in `can.readonlyFields` or `can.hiddenFields`, stays where it is and
says why (`can.reason`).

## The data source

The calendar asks `list` for the records of the span it shows, with the list's
own search:

```ts
filter: [...search, { field: 'start', op: '<', value: spanEnd }, { any: [{ field: 'stop', op: '>', value: spanStart }, { field: 'start', op: '>=', value: spanStart }] }]
```

A `date` is compared as `"2026-10-14"`, a `datetime` as an ISO instant
(`toISOString()`), as the date widgets write them. Times are the reader's own;
time zones of their own come later. A move calls `save` with the changed
fields alone, in `changes.values` and in `values`, `fields` naming those alone
and `partial: true` (and the row's `version`, when the list gave one), so a
source that saves whole records keeps every other field; Undo saves what those
fields held before, the same way. A refused save puts the record
back and says why. In the day view, the columns of a link are the related
records `search` finds (up to 40), with any the records hold besides.

## Settings

`calendarListViews({ labels, now, limit })`:

- `labels`: words over the calendar's own, by language (`CalendarLabels` names them all).
- `now`: the moment it is now, for a demo or a test pinned to a day.
- `limit`: how many records a span asks for at most, 500 unless said. Past
  it, the calendar says how many it leaves out.

MIT licensed.
