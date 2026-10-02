# @fieldia/designer

Build [Fieldia](https://fieldia.dev) pages without writing JSON: an editing model
with undo and published versions, a survey editor (questions as cards, pages
shown or questions asked only for some answers, a live preview), and a screen
editor (a canvas with one [Grafloria](https://grafloria.com) board per section:
sections or a record sheet with a title and tabs; links, tables of lines and
business fields in its palette; fields dragged within and between sections).

Not published to npm yet.

```ts
import * as grafloria from '@grafloria/element';
import { blankPage, createDesigner, createMemoryPageStore, mountScreenEditor, mountSurveyEditor } from '@fieldia/designer';

const store = createMemoryPageStore();   // or your own PageStore
const survey = createDesigner({ page: blankPage('survey', 'Event feedback'), store });
mountSurveyEditor(document.getElementById('survey')!, { designer: survey });

const screen = createDesigner({ page: blankPage('screen', 'Site visit'), store });
mountScreenEditor(document.getElementById('screen')!, { designer: screen, grafloria });
```

The editors are components too: `@fieldia/designer/react`, `@fieldia/designer/vue`
and `@fieldia/designer/angular` each give a survey editor and a screen editor.

```tsx
import { ScreenEditor, SurveyEditor } from '@fieldia/designer/react';

<SurveyEditor designer={survey} />
<ScreenEditor designer={screen} grafloria={grafloria} />
```

In Vue they are `SurveyEditor` and `ScreenEditor` too; in Angular,
`<fieldia-survey-editor [designer]>` and `<fieldia-screen-editor [designer] [grafloria]>`.

MIT licensed.
