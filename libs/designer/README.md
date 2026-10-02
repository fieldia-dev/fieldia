# @fieldia/designer

Build [Fieldia](https://fieldia.dev) pages without writing JSON: an editing model
with undo and published versions, a survey editor (questions as cards, pages
shown for one answer, a live preview), and a screen editor (a canvas with one
[Grafloria](https://grafloria.com) board per section).

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

MIT licensed.
