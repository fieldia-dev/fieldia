import { FEATURES } from '../feature-page.mjs';

/** The Features page: the six areas, each a page of its own. */
export default {
  path: '/features/',
  title: 'Features',
  description: 'Everything Fieldia does, by area: forms and surveys, business records, rules and actions, lists and search, looks and languages, and your backend.',
  body: `
<header class="gallery-hero">
  <h1>Features</h1>
  <p class="lead"><b>Everything a page can do, by area.</b> Each area has a page of its own, every part shown from a real demo you can open and try, and a link to the docs that say how.</p>
</header>
<div class="gallery-body">
  <ul class="feature-areas">
    ${FEATURES.map((f) => `<li><a class="feature-area" href="${f.path}"><b>${f.name}</b><span>${f.blurb}</span><span class="feature-area-go" aria-hidden="true">→</span></a></li>`).join('\n    ')}
  </ul>
</div>`,
};
