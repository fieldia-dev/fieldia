# @fieldia/grid

A [Fieldia](https://fieldia.dev) table of lines as a spreadsheet, on
[AG Grid Community](https://www.ag-grid.com/). Each cell is edited with
Fieldia's own field for its type, wired to its line, so every keystroke
reaches the form and computed values follow while a cell is being typed.

```sh
npm install @fieldia/grid ag-grid-community
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { gridWidgets } from '@fieldia/grid';

mountViewer(host, { page, dataSource, widgets: gridWidgets });
```

A one2many node opts in with `"widget": "grid"`; nodes without it keep the
plain table, so pages that do not use the grid never load AG Grid. In React
pass `widgets={gridWidgets}`, in Vue `:widgets="gridWidgets"`, in Angular
`[widgets]="gridWidgets"`.

```json
{ "type": "field", "id": "f-lines", "field": "line_ids", "widget": "grid",
  "totals": ["qty", "subtotal"], "optionalColumns": { "discount": "show" } }
```

- **Keys**: Enter keeps a cell and moves down, Tab moves across (skipping
  cells that cannot be edited), Tab or Enter at the end starts a new line,
  Escape puts a cell back, Space ticks yes/no, Alt+Up/Down moves a line.
- **Sections and notes** (`lineKinds` on the field) run across the row; a
  note grows as it is typed.
- **Moving lines** by a handle, with a `sequenceField` on the field.
- **Totals** under the lines, **columns** people resize, move and choose
  (kept in the viewer's `preferences` store), **long tables** that scroll
  inside, and `"editMode": "row"` to open a whole line at once. A column moves
  by dragging its header, as in a list: Escape puts it back, a drag out of the
  grid never hides it, a finger resting a moment on a header lifts its column
  (a swipe there scrolls the page), and its new place is said to a screen
  reader.
- **A refused save** marks the wrong cells and opens the first one.
- **On a phone** (the grid 520px wide or less) its lines are cards, as where
  the node says `"cards": "narrow"`: each value whole by its column's label,
  a card's title opening the line in its own form (a section's or a note's,
  its words), a line added opening there and going again if let go. Where the
  host gives no dialogs to open a line in, the grid stays a grid;
  `"cards": "never"` keeps it one, `"always"` makes cards at every width.
- **A choice a line's change took out** is said under its cell, the row as
  tall as the words need, and aloud.
- **Most lines** (`"options": { "max": 12 }` on the node), as the plain table
  keeps them: at its most, Add and a line's copy are hidden (never disabled),
  and Enter or Tab at the last line's end adds none.
- **Rows pasted from a spreadsheet** on a chosen cell (Ctrl+V, ⌘V in Safari
  too), or in a cell a click opened for typing, go each on its own line from
  it, as the plain table pastes them: each cell read as its column reads what
  is typed, a link by its exact name through the source's search; a row whose
  name reads as no record is not pasted at all; rows past the last line add
  lines, as many as the node's `options.max` allows; one note says what went in,
  the lines added, and what did not, with why. One value pasted in an open cell
  stays in its box. The readers come in the lines part, asked for the first
  time a block is pasted.

`gridApiOf(element)` returns the AG Grid API behind a grid, for an app that
needs more than the page describes.

MIT. AG Grid Community is MIT too; AG Grid Enterprise is not used.
