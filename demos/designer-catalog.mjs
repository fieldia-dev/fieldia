/**
 * The designer's starting points, for fieldia.dev's Designer page and its
 * thumbnails: each opens the designer itself, on a page to build. Kept apart
 * from the demo gallery's catalog: the designer is a preview, not on npm.
 */
export const DESIGNER_DEMOS = [
  {
    id: 'designer-survey',
    name: 'A survey, the Google Forms way',
    blurb: 'Questions as cards: open one to type its words and options where it stands, switch its kind, see where each answer leads, and try it.',
    href: 'designer/?start=survey',
  },
  {
    id: 'designer-sheet',
    name: 'A customer record',
    blurb: 'The customer model’s fields first in the toolbox; status steps, buttons, counters and badges over the card; a made-up customer to fill it.',
    href: 'screen/?start=sheet',
  },
  {
    id: 'designer-list',
    name: 'A list of customers',
    blurb: 'Columns dragged along the row or dropped in from the toolbox; filters, groupings and buttons for the rows chosen.',
    href: 'screen/?start=list',
  },
  {
    id: 'designer-screen',
    name: 'An app screen',
    blurb: 'Sections in the viewer’s own grid: drag a field and a gap opens where it lands; pick one to type its words and set its kind in place.',
    href: 'screen/',
  },
  {
    id: 'designer-blank-survey',
    name: 'A survey from nothing',
    blurb: 'An empty survey: add questions from the toolbox, the bar beside the card, or ⌘K.',
    href: 'designer/',
  },
  {
    id: 'designer-blank-screen',
    name: 'A screen from nothing',
    blurb: 'An empty screen: drop fields in from the toolbox, then check it and publish it.',
    href: 'screen/?start=blank',
  },
];
