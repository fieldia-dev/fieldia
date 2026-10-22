# @fieldia/gantt

[Fieldia](https://fieldia.dev)'s Gantt timeline: a **list's records as bars
on a time axis**, by days, weeks or months, in groups (a project, a person, a
phase), each joined by an arrow to the records it waits for. People drag a
bar to move it, drag its ends to stretch it, and move it a day at a time from
the keyboard. A move is written through the data source's `save`, with
**Undo**. It shares the list's search, filters and favourites, is on the
page's clock, reads right to left, prints the whole plan on the page's width,
speaks English, Arabic, French and German, and its code loads only when a
timeline is first shown. It draws with plain DOM and SVG: no chart library.

```sh
npm install @fieldia/gantt
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { ganttListViews } from '@fieldia/gantt';

mountViewer(host, {
  page,
  dataSource,
  listViews: ganttListViews(),
  // A bar pressed, or Enter on it: the app opens the record.
  onOpenRecord: (id) => openTask(id),
});
```

With a calendar or a map as well, register them all: `listViews: { ...mapListViews({ provider }), ...calendarListViews(), ...ganttListViews() }`.

## The page

A list page with `gantt` offers **Timeline** beside its table:

```json
"layout": {
  "type": "list", "id": "tasks", "columns": ["name", "phase", "start", "days"],
  "gantt": {
    "start": "start", "duration": "days", "title": "name",
    "group": "phase", "colour": "trade", "dependsOn": "after",
    "zooms": ["day", "week", "month"], "zoom": "day", "opens": "gantt"
  }
}
```

| Option | What it does |
|---|---|
| `start` | When each record starts: a `date` or a `datetime`. Required. A record with none has a row saying so, and no bar. |
| `end` | When it ends, a field of the same kind: its last day, for a date. |
| `duration` | Or how many days it lasts, an `integer` or `float` field, where it has no `end` (one or the other). `0` makes a milestone, drawn as a diamond. With neither, a bar lasts a day. |
| `title` | The words on each bar and its row. Required. |
| `group` | A link, a choice, text or a whole number whose value draws the bars in groups, each under its heading with the span its bars take; a heading folds its group away. A choice's groups are in its options' order, others by their first start; records with none last. |
| `colour` | A field whose value colours each bar: the same value, the same colour. A value that is a colour itself (`#0f766e`) is used as it is. |
| `dependsOn` | A `many2many` to the list's own records: the records each waits for. An arrow runs from the end of each to the start of the one waiting (finish to start); where it starts before that one ends, the arrow is red and dashed, and the bar says so. |
| `zooms` | The scales offered, in order: `day`, `week`, `month`. All three unless said. |
| `zoom` | The scale it shows first: `week` unless said (the first offered, where week is not). |
| `opens` | `gantt` opens the list on its timeline; `list` (unless said) on its table. |
| `firstDay` | The week's first day, `0` Sunday to `6` Saturday, for the weeks' heads: Saturday in Arabic, Monday in English, French and German unless said. |

The page check refuses a field the page lacks or one of the wrong kind, an end
of another kind than its start, an end and a duration both, a `dependsOn` that
links to another model's records, a `zoom` that is not among `zooms`, and a list
that opens on its timeline and on its map, calendar or gallery.

**On a zone's clock.** A timeline is on the clock of the zone its start field
names (`timeZone` on a date and time field), else its page's
(`"timeZone": "Europe/Berlin"`), else the reader's own: its days, today's line
and every bar's times are that zone's wherever it is looked at from, its short
name beside the plan where its times are not the reader's own. A bar moved by
a day keeps its time of day there, across a change of the clocks too.

On a page that names its records (`"records": { "one": "task", "other": "tasks" }`),
a group says "4 tasks".

## What a person can do

- **See** the plan: the axis of months over days, months over weeks or years
  over months; each record's row, its name kept in sight as the days scroll;
  its bar, coloured; the groups under their headings; the arrows; a red line
  for today. **Today** brings it into view; **Days**, **Weeks** and **Months**
  change the scale.
- **Move** a bar by dragging it to other days, and **stretch** it by dragging
  its start or its end, by whole days (a time of day is kept). Escape while
  dragging puts it back. The move is saved at once; **Undo** puts it back.
- **Open** a record by pressing its bar or its name, or Enter: the app's
  `onOpenRecord`, as a row of the table opens it.
- **Keys**: one stop for the whole timeline. Up and down reach the bar above
  or below (Home and End the first and last); left and right move the bar a
  day (as the page reads: flipped right to left), and with Shift its end; the
  move is written once the keys rest, as one move with one Undo, or when the
  bar is left; Escape before then puts it back. Each bar says to a screen
  reader its days, how long it lasts, what it waits for and whether it starts
  too soon.
- **Print**: on paper the whole plan fits the timeline's width, its colours
  kept, the buttons left off.

What cannot be done is hidden, never greyed: with no `save` on the data source,
or a page whose start, end or duration field is `readonly`, nothing moves; a
record whose list row says `can: { edit: false }`, or puts one of those fields
in `can.readonlyFields` or `can.hiddenFields`, stays where it is and says why
(`can.reason`).

## The data source

The timeline asks `list` for the list's records with its own search, in the
order of their start, up to its `limit`. A move calls `save` with the changed
fields alone — the start and the end (a date's last day as `"2026-10-16"`, a
date and time as an ISO instant), or the duration — in `changes.values` and in
`values`, `fields` naming those alone and `partial: true` (and the row's
`version`, when the list gave one), so a source that saves whole records keeps
every other field; Undo saves what those fields held before, the same way. A
refused save puts the bar back and says why. Moves wait for each other: a
second one is saved once the first has its answer.

## Settings

`ganttListViews({ labels, now, limit })`:

- `labels`: words over the timeline's own, by language (`GanttLabels` names them all).
- `now`: the moment it is now, for a demo or a test pinned to a day.
- `limit`: how many records it asks for at most, 500 unless said. Past it,
  the timeline says how many it leaves out.

MIT licensed.
