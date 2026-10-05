import { c, code } from '../layout.mjs';

export default {
  path: '/look/',
  title: 'Skins and languages',
  description: 'Fieldia’s two skins, the CSS custom properties that restyle them, and the four languages with right-to-left Arabic.',
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

<h2 id="languages">Four languages</h2>
<p>Fieldia's own words — Save, Next, validation messages, “Step 2 of 3”, the upload and search prompts — come in English, Arabic, German and French:</p>
${code('ts', `mountViewer(host, { page, dataSource, locale: 'ar' });   // 'en' | 'ar' | 'de' | 'fr'`)}
<p>The packages carry all four. The script tag carries English, and each other language in a small script of its own to add after it — ${c('fieldia.ar.js')}, ${c('fieldia.de.js')}, ${c('fieldia.fr.js')}; see <a href="/start/#script">A script tag</a>.</p>
<p>Arabic lays the whole form out right to left. Pass ${c("dir: 'rtl'")} or ${c("dir: 'ltr'")} to choose the direction yourself. Any word can be replaced with ${c('labels')}:</p>
${code('ts', `mountViewer(host, { page, dataSource, labels: { submit: 'Send my answers' } });`)}
<p>The page's own text — titles, labels, help, options — is the page author's. To offer a page in several languages, keep one page per language, or generate the page in the reader's language on your server.</p>
`,
};
