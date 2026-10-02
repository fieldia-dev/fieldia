import { CATEGORIES, DEMOS, FEATURED, FRAMEWORKS, demoHref } from '../../demos/catalog.mjs';

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** One demo as a card: its thumbnail, its name, the first lines of what it shows, and where it runs. */
function card(demo) {
  const colour = CATEGORIES.find((c) => c.id === demo.category)?.colour ?? '#0b5cad';
  const where = demo.app ? 'One HTML file' : FRAMEWORKS.map((f) => f.label).join(' · ');
  return `<a class="demo-card" href="/demos/${esc(demoHref(demo))}" style="--cat: ${colour}">
    <span class="demo-thumb"><img src="/demos/thumbs/${demo.id}.png" alt="" width="600" height="360" loading="lazy"></span>
    <span class="demo-name">${esc(demo.name)}<span class="demo-go" aria-hidden="true">→</span></span>
    <span class="demo-blurb">${esc(demo.blurb)}</span>
    <span class="demo-where">${where}</span>
  </a>`;
}

const featured = FEATURED.map((id) => DEMOS.find((d) => d.id === id)).filter(Boolean);
const sections = CATEGORIES.map((category) => {
  const demos = DEMOS.filter((d) => d.category === category.id);
  if (!demos.length) return '';
  return `<section class="gallery-section" id="${category.id}" aria-labelledby="${category.id}-h">
    <h2 id="${category.id}-h">${esc(category.label)} <span class="count">${demos.length}</span></h2>
    <div class="gallery">${demos.map(card).join('')}</div>
  </section>`;
}).join('');

export default {
  path: '/demos/',
  title: 'Demos',
  description: `${DEMOS.length} live Fieldia demos, each driven by the browser tests on every change, in plain JavaScript, React, Vue and Angular: business records, lists and search, forms and surveys, every field.`,
  body: `
<header class="gallery-hero">
  <h1>Demo gallery</h1>
  <p class="lead"><b>Every demo here is a test.</b> Fieldia’s browser tests drive each of these pages on every change, in plain JavaScript, React, Vue and Angular: if it is here, it works. A demo opens in plain JavaScript; switch framework or look at its top, read how to try it, and open its code.</p>
  <div class="chips">
    <span class="chip"><b>${DEMOS.length}</b> demos</span>
    <span class="chip"><b>${FRAMEWORKS.length}</b> frameworks</span>
    <span class="chip"><b>MIT</b> — every one of them</span>
    <a class="chip chip-link" href="/start/">Get started →</a>
  </div>
</header>
<div class="gallery-body">
  <section class="gallery-section featured" id="featured" aria-labelledby="featured-h">
    <h2 id="featured-h">★ Featured <span class="count">start here</span></h2>
    <div class="gallery">${featured.map(card).join('')}</div>
  </section>
  ${sections}
</div>`,
};
