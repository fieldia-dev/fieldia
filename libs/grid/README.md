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
  inside, and `"editMode": "row"` to open a whole line at once.
- **A refused save** marks the wrong cells and opens the first one.
- **Rows pasted from a spreadsheet** on a chosen cell (Ctrl+V, ⌘V in Safari
  too) fill across and down from it, each cell read as its column reads what
  is typed; rows past the last line add lines, as many as the node's
  `options.max` allows; one note says what went in, the lines added, and what
  did not, with why. The readers come in the lines part, asked for the first
  time a block is pasted.

`gridApiOf(element)` returns the AG Grid API behind a grid, for an app that
needs more than the page describes.

MIT. AG Grid Community is MIT too; AG Grid Enterprise is not used.
