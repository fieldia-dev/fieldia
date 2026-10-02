# @fieldia/code

A [Fieldia](https://fieldia.dev) JSON field in a code editor: CodeMirror 6,
bundled with the package, so it works offline and loads only on pages that
use it.

```sh
npm install @fieldia/code
```

```ts
import { mountViewer } from '@fieldia/viewer';
import { codeWidgets } from '@fieldia/code';

mountViewer(host, { page, dataSource, widgets: codeWidgets });
```

A json node opts in with `"widget": "code"`; others keep the plain JSON box.
In React pass `widgets={codeWidgets}`, in Vue `:widgets="codeWidgets"`, in
Angular `[widgets]="codeWidgets"` (spread it beside `gridWidgets` to use both).

- JSON highlighting, line numbers, bracket matching, undo.
- Valid JSON reaches the form as it is typed; text that is not valid is said
  so, and the last good value stays.
- Tab still moves to the next field.

MIT. CodeMirror is MIT too.
