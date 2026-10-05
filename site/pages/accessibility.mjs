import { c } from '../layout.mjs';

/**
 * The accessibility statement: what Fieldia aims for, how it was checked,
 * what was not, and how to tell us. Plain words; every claim here has a
 * browser test behind it (e2e/a11y.spec.ts, e2e/a11y-keyboard.spec.ts).
 */
const ISSUES = 'https://github.com/fieldia-dev/fieldia/issues';

export default {
  path: '/accessibility/',
  title: 'Accessibility',
  description: 'How accessible Fieldia’s forms and designer are: the standard aimed for (WCAG 2.2 AA), how it was tested, what was not tested, and how to report a problem.',
  body: `
<div class="page-prose">
<h1>Accessibility</h1>
<p class="lead">Fieldia aims to meet the <a href="https://www.w3.org/TR/WCAG22/">Web Content Accessibility Guidelines (WCAG) 2.2</a> at level AA, in the forms people fill in and in the designer people build them with. This page says how we checked that, what we did not check, and how to tell us when something is wrong.</p>
<p class="statement-date">Last checked: 4 October 2026, on Fieldia’s main branch.</p>

<h2 id="scope">What it covers</h2>
<ul>
  <li><strong>The viewer</strong> (${c('@fieldia/viewer')} and its React, Vue and Angular bindings): forms, record sheets, lists with their search, wizards and dialogs.</li>
  <li><strong>The widgets</strong> (${c('@fieldia/widgets')}): every field Fieldia draws, in both skins, light and dark, left to right and right to left.</li>
  <li><strong>The designer</strong> (${c('@fieldia/designer')}): the survey designer and the screen editor, in Simple and Advanced, with their views (Try it, JSON, Translations, Rules), dialogs and sheets.</li>
</ul>
<p>Your app decides much of what people meet: the words on a page, its own colours and widgets, and the page round the form. Those are yours to check. A page’s own colours are the one exception we handle for you: Fieldia darkens its accent on a light page, or lightens it on a dark one, just enough for words in it and on it to read; and the colours a page gives each kind of part — a text box’s or a card’s ground, a button’s colour — are moved just as far as they have to be for the page’s words to read on them.</p>

<h2 id="how">How it was tested</h2>
<p>Every check below is a browser test in Fieldia’s repository. CI runs them on every change, in Chromium, through Playwright; a change that breaks one fails the build.</p>
<ul>
  <li><strong>Automated rules.</strong> <a href="https://github.com/dequelabs/axe-core">axe-core</a> 4.13, with the rules tagged ${c('wcag2a')}, ${c('wcag2aa')}, ${c('wcag21a')}, ${c('wcag21aa')} and ${c('wcag22aa')}, must find nothing on: every demo in the <a href="/demos/">gallery</a>, in both skins, in the dark scheme and in Arabic right to left; a form showing its errors after a failed send; a record that will not save; a dialog open; a list with its search open; the designers — the survey designer, and the screen editor in Simple and in Advanced, each view (Try it, JSON, Translations, Rules), each dialog and sheet, a part picked with each tab of its panel, and a blank page with its templates — at a desktop’s width and a phone’s; and the pages of this site.</li>
  <li><strong>The keyboard.</strong> On a form, a record, a list and the designers, Tab reaches every control, in the order of the page, and always comes back round: no traps. The JSON view’s box keeps Tab for indenting; Escape, then Tab, leaves it, as its hint says. On the designer’s canvas, a field or a question is reached by Tab and picked with Enter.</li>
  <li><strong>Focus you can see</strong> (2.4.7). On those pages, every stop Tab makes shows a ring, a changed border or a line under it, measured in the browser, not by eye. A date box’s calendar button wears the browser’s own ring.</li>
  <li><strong>Focus not hidden</strong> (2.4.11). The designer’s bar stays at the top as the page scrolls; whatever takes focus is scrolled to below it, never under it, at a desktop’s width and a phone’s.</li>
  <li><strong>Targets</strong> (2.5.8). Buttons are at least 24 by 24 pixels, or have that much room round them — checked by axe, and measured again on the designers and on forms at a phone’s width.</li>
  <li><strong>No drag needed</strong> (2.5.7). Everything dragged has a way without dragging: a toolbox tile is pressed to add its field; a field, a question, a list’s column, an outline’s row, a ranking’s line and an order’s line move with Alt and the arrows (a question also with Ctrl+Shift+J and K); a width changes with Alt+Shift and the arrows or the panel’s Width; the gutter between two parts is in the Tab order and moves with the arrows.</li>
  <li><strong>Dialogs.</strong> Find anything, Checks, Publish, the keyboard shortcuts, the versions, the Look sheet, the assistant, a record opened over a page, Search more… and a notice that a save was refused: each takes focus, a modal one keeps it while it is open, Escape closes it, and focus goes back to what opened it.</li>
  <li><strong>Said once.</strong> A refused save, a send stopped by the form’s checks, a part or an outline row moved by its keys, and a ranking’s line moved are each said once to a screen reader, not twice.</li>
</ul>

<h2 id="not-tested">What was not tested</h2>
<p>Automated checks find many problems, not all of them. We have not yet:</p>
<ul>
  <li>run sessions with people who use screen readers (NVDA, JAWS, VoiceOver, TalkBack), switch access or voice control — the checks above read what a screen reader would be given, not what one says;</li>
  <li>tested in Firefox or Safari, or on phones’ own browsers — the checks run in Chromium only, at a phone’s width, not on a phone;</li>
  <li>run the sweep on the React, Vue and Angular demos: they draw the same forms through the same viewer, but the sweep reads the plain JavaScript ones;</li>
  <li>checked text spacing changed by a reader (1.4.12), zoom past a phone’s width, or Windows’ contrast themes;</li>
  <li>checked the app round a form: its own pages, words and widgets.</li>
</ul>
<p>Until we have, read “meets WCAG 2.2 AA” as “passes every check above”, not as a promise about every reader’s experience.</p>

<h2 id="limits">Known limitations</h2>
<ul>
  <li>On the designer’s canvas, a field, a question, a section’s title and the parts over a record are reached by Tab. A block — a heading, a note, a picture, a divider — or parts set side by side are picked from the <strong>Outline</strong> (a tree, worked with the arrow keys) or from <strong>Find anything</strong> (⌘K or Ctrl+K).</li>
  <li>Drawing a signature needs a pointer; typing your name in its place is offered beside it.</li>
  <li>A light accent colour is drawn darker than it was picked, so words in it can be read, and a dark ground for a kind of part lighter (on a dark page, the other way round); the designer’s Look sheet shows each as picked.</li>
  <li>After a save, the Save button hides until something changes again, and focus goes with it; Tab carries on from where it was.</li>
</ul>

<h2 id="report">Tell us about a problem</h2>
<p>If something in Fieldia is hard or impossible to use with your keyboard, screen reader, zoom or any other way you work, please <a href="${ISSUES}">open an issue on GitHub</a>. Say what you were doing, what you expected, and what you use (browser, assistive technology). We treat these as bugs, not as wishes.</p>
</div>`,
};
