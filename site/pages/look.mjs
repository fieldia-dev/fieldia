import { c, code } from '../layout.mjs';

export default {
  path: '/look/',
  title: 'Skins and languages',
  description: 'Fieldia’s two skins, the CSS custom properties that restyle them, a look for each kind of part, and the four languages with right-to-left Arabic.',
  body: `
<p class="lead">How a form looks is set per form, not per page: the same page can be a quiet business sheet in one place and a friendly survey in another.</p>

<h2 id="skins">Two skins</h2>
<ul>
  <li>${c('underline')} — labels beside the values, inputs as a single underline, square corners. The look of a business record sheet, for screens people fill all day.</li>
  <li>${c('outlined')} — labels above boxed inputs, rounded corners, a blue accent. Ant Design style, for surveys and sign-ups.</li>
</ul>
${code('ts', `mountViewer(host, { page, dataSource, skin: 'outlined' });   // viewer.setSkin('underline') switches it live`)}
<p>A skin applies only inside its own form (${c('.fd-form[data-fd-skin="…"]')}), so two forms with different skins can share a page, and Fieldia's styles never leak into yours.</p>

<h2 id="tokens">Restyle with custom properties</h2>
<p>Both skins are built from CSS custom properties on ${c('.fd-form')}. Override them to match your product:</p>
${code(
  'css',
  `
.fd-form[data-fd-skin="outlined"] {
  --fd-accent: #0f766e;          /* buttons, focus, the chosen option */
  --fd-accent-soft: #ccfbf1;
  --fd-radius: 12px;             /* cards and sections */
  --fd-control-radius: 8px;      /* inputs and buttons */
  --fd-font: "Inter", system-ui, sans-serif;
}`
)}
<p>The others: ${c('--fd-text')}, ${c('--fd-muted')}, ${c('--fd-page')}, ${c('--fd-surface')}, ${c('--fd-border')}, ${c('--fd-border-strong')}, ${c('--fd-focus')}, ${c('--fd-focus-ring')}, ${c('--fd-error')}, ${c('--fd-success')}, ${c('--fd-warning')}, ${c('--fd-info')} (each with a ${c('-soft')} partner), ${c('--fd-pad-x')}, ${c('--fd-pad-y')}, ${c('--fd-gap-x')}, ${c('--fd-gap-y')}, ${c('--fd-label-weight')} and ${c('--fd-label-width')}.</p>

<h2 id="parts">A look for each kind of part</h2>
<p>A page can say how each kind of part looks, over its own look, as SurveyJS and Vueform theme each kind of component: text boxes, choices, groups, buttons and tables, each with the few things both skins draw on it. The designer sets them on its Look tab; in the page they are ${c('look.parts')}, any setting left out drawn as the page draws it:</p>
${code(
  'json',
  `
"look": {
  "parts": {
    "inputs":  { "background": "#fff7e6", "corners": "round", "textSize": "large" },
    "choices": { "accent": "#1f7a4d", "border": "#1677ff" },
    "groups":  { "background": "#fbfaf7", "border": "#d6cfc2" },
    "buttons": { "accent": "#6941c6", "corners": "round" },
    "tables":  { "background": "#eef2f7", "textSize": "small" }
  }
}`
)}
<ul>
  <li>${c('inputs')} — text, number and date boxes and dropdowns; their accent is the edge of the box being typed in and the day picked.</li>
  <li>${c('choices')} — rings and ticks take the accent; a scale’s points, Yes and No, pictures and a ranking’s lines take the ground, border and corners too.</li>
  <li>${c('groups')} — sections, a record’s card and a repeating group’s cards. The underline skin draws no card round a section; given a background or a border, it does.</li>
  <li>${c('buttons')} — Send, Next, Save, Add another: their colour, corners and size of words.</li>
  <li>${c('tables')} — tables of lines and a matrix’s grid: the heading row’s ground, the lines, the words.</li>
</ul>
<p>Corners are ${c('square')}, ${c('soft')} or ${c('round')}, as the page’s; text is ${c('small')} (13px) or ${c('large')} (16px). Words always stay readable: a colour they could not be read on is drawn lighter or darker, only as far as it has to be — a ground stays light on a light page and dark on a dark one, and an accent reads at 4.5:1 on the page and on every ground given. A border is drawn as given. Each kind’s settings reach the stylesheet as its own custom properties (${c('--fd-inputs-bg')}, ${c('--fd-buttons-accent')}, …), named on the form (${c('data-inputs="bg radius"')}), so your own CSS can follow them too.</p>

<h2 id="help">Where help shows</h2>
<p>A field's ${c('help')} shows as words under it, or behind a (?) beside its label, as Flectra shows it — shorter on a busy sheet — or both. The page sets its way in ${c('look.helpShown')}, and any field may have its own ${c('helpShown')}: ${c('below')} (the default), ${c('tooltip')} or ${c('both')}. The (?) opens on hover, on focus or with a tap, and Escape closes it; the box stays described by the help, so a screen reader still says it. In the designer it is Help, on the Look tab for the page and under a field's Layout.</p>
${code('json', `{ "look": { "helpShown": "tooltip" } }`)}

<h2 id="languages">Four languages</h2>
<p>Fieldia's own words — Save, Next, validation messages, “Step 2 of 3”, the upload and search prompts — come in English, Arabic, German and French:</p>
${code('ts', `mountViewer(host, { page, dataSource, locale: 'ar' });   // 'en' | 'ar' | 'de' | 'fr'`)}
<p>The packages carry all four. The script tag carries English, and each other language in a small script of its own to add after it — ${c('fieldia.ar.js')}, ${c('fieldia.de.js')}, ${c('fieldia.fr.js')}; see <a href="/start/#script">A script tag</a>.</p>
<p>Arabic lays the whole form out right to left. Pass ${c("dir: 'rtl'")} or ${c("dir: 'ltr'")} to choose the direction yourself. Any word can be replaced with ${c('labels')}:</p>
${code('ts', `mountViewer(host, { page, dataSource, labels: { submit: 'Send my answers' } });`)}
<p>The page's own text — titles, labels, help, options — is the page author's. To offer a page in several languages, keep one page per language, or generate the page in the reader's language on your server.</p>
`,
};
