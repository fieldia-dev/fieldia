# @fieldia/designer

Build [Fieldia](https://fieldia.dev) pages without writing JSON: an editing model
with undo and published versions, a survey editor (questions as cards, pages
shown or questions asked only for some answers, a live preview), and a screen
editor (the page drawn as the viewer draws it and edited where it stands:
sections or a record sheet with a title and tabs; a toolbox of icons with the
backend model's fields first; a field's label, help and options typed in place
and the rest set from a bar on it; fields dragged within and between sections
and into tabs).

Not published to npm yet.

```ts
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor, mountSurveyEditor } from '@fieldia/designer';

const store = createMemoryPageStore();   // or your own PageStore
const survey = createDesigner({ page: blankPage('survey', 'Event feedback'), store });
mountSurveyEditor(document.getElementById('survey')!, { designer: survey });

// The backend's fields, offered first; each keeps what it holds.
const model = { email: { type: 'char', label: 'Email' } } as const;
const screen = createDesigner({ page: blankPage('screen', 'Site visit'), store, model });
mountScreenEditor(document.getElementById('screen')!, { designer: screen });
```

The editors are components too: `@fieldia/designer/react`, `@fieldia/designer/vue`
and `@fieldia/designer/angular` each give a survey editor and a screen editor.

```tsx
import { ScreenEditor, SurveyEditor } from '@fieldia/designer/react';

<SurveyEditor designer={survey} />
<ScreenEditor designer={screen} />
```

In Vue they are `SurveyEditor` and `ScreenEditor` too; in Angular,
`<fieldia-survey-editor [designer]>` and `<fieldia-screen-editor [designer]>`.

MIT licensed.
