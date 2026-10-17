import { AREAS, CATEGORIES, DEMOS, FEATURED, FRAMEWORKS, areaOf, demoHref, wordsOf } from '../../demos/catalog.mjs';

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Each area's colour, the thin edge of its cards: the feature grouping keeps the categories' own. */
const AREA_COLOURS = { sales: '#0b5cad', accounting: '#0f766e', crm: '#7c3aed', people: '#be185d', operations: '#b45309', clinic: '#0e7490', 'real-estate': '#4d7c0f', surveys: '#4f46e5', 'building-blocks': '#475569' };

/**
 * One demo as a card: its thumbnail, its name, the first lines of what it shows, and where it runs. What the search
 * reads is kept on it — its name, its blurb, its own search words (catalog.mjs), its area and its feature — and both
 * its groupings, for the switch.
 */
function card(demo) {
  const area = AREAS.find((a) => a.id === areaOf(demo.id));
  const category = CATEGORIES.find((c) => c.id === demo.category);
  const where = demo.app ? 'One HTML file' : FRAMEWORKS.map((f) => f.label).join(' · ');
  const words = [demo.name, demo.blurb, wordsOf(demo.id), area?.label, category?.label].join(' ').toLowerCase();
  return `<a class="demo-card" href="/demos/${esc(demoHref(demo))}" data-at="${DEMOS.indexOf(demo)}" data-area="${esc(area?.id ?? '')}" data-category="${esc(demo.category)}" data-words="${esc(words)}" style="--cat-area: ${AREA_COLOURS[area?.id] ?? '#0b5cad'}; --cat-feature: ${category?.colour ?? '#0b5cad'}">
    <span class="demo-thumb"><img src="/demos/thumbs/${demo.id}.png" alt="" width="600" height="360" loading="lazy"></span>
    <span class="demo-name">${esc(demo.name)}<span class="demo-go" aria-hidden="true">→</span></span>
    <span class="demo-blurb">${esc(demo.blurb)}</span>
    <span class="demo-where">${where}</span>
  </a>`;
}

const featured = FEATURED.map((id) => DEMOS.find((d) => d.id === id)).filter(Boolean);
/** By business area, as the page opens: every demo in its one area, its cards drawn here. */
const byArea = AREAS.map((area) => {
  const demos = DEMOS.filter((d) => areaOf(d.id) === area.id);
  return `<section class="gallery-section" id="${area.id}" data-group="area" aria-labelledby="${area.id}-h">
    <h2 id="${area.id}-h">${esc(area.label)} <span class="count" data-of="${demos.length}">${demos.length}</span></h2>
    <p class="gallery-about">${esc(area.blurb)}</p>
    <div class="gallery">${demos.map(card).join('')}</div>
  </section>`;
}).join('');
/** By feature, for developers: the same cards, moved into these by the switch (gallery.js). */
const byFeature = CATEGORIES.map((category) => {
  const count = DEMOS.filter((d) => d.category === category.id).length;
  if (!count) return '';
  return `<section class="gallery-section" id="${category.id}" data-group="feature" aria-labelledby="${category.id}-h" hidden>
    <h2 id="${category.id}-h">${esc(category.label)} <span class="count" data-of="${count}">${count}</span></h2>
    <div class="gallery"></div>
  </section>`;
}).join('');

export default {
  path: '/demos/',
  title: 'Demos',
  description: `${DEMOS.length} working screens a business uses — quotes and orders, invoices, customers, time off, a clinic’s diary, homes on a map, surveys — each one to open and try, grouped by business area.`,
  body: `
<header class="gallery-hero">
  <h1>Demo gallery</h1>
  <p class="lead">The screens a business works in every day — quotes and orders, invoices and payments, customers, time off, a clinic’s diary, homes on a map, surveys — each one working, to open, type in and try. Find one by what you need, or look through your business area below. Each says at its top what to try first.</p>
  <div class="chips">
    <span class="chip"><b>${DEMOS.length}</b> demos</span>
    <span class="chip"><b>${AREAS.length - 1}</b> business areas</span>
    <a class="chip chip-link" href="/start/">Get started →</a>
  </div>
  <div class="gallery-tools" role="search">
    <label class="gallery-find"><span class="gallery-find-words">Find a demo</span>
      <input type="search" id="gallery-find" placeholder="An invoice, a map, Arabic…  ( / )" autocomplete="off" aria-describedby="gallery-said">
    </label>
    <div class="gallery-by" role="group" aria-label="Group the demos">
      <button type="button" data-by="area" aria-pressed="true">By business area</button>
      <button type="button" data-by="feature" aria-pressed="false">By feature</button>
    </div>
    <p class="gallery-said" id="gallery-said" role="status" aria-live="polite"></p>
  </div>
  <p class="gallery-dev"><b>For developers:</b> Fieldia’s browser tests drive every demo here on every change, in plain JavaScript, React, Vue and Angular: if it is here, it works, and every one is MIT. A demo opens in plain JavaScript: switch its framework or its look at its top, read what to try, and open its source on GitHub. <b>By feature</b> groups them as developers look for them.</p>
</header>
<div class="gallery-body">
  <section class="gallery-section featured" id="featured" aria-labelledby="featured-h">
    <h2 id="featured-h">★ Featured <span class="count">start here</span></h2>
    <div class="gallery">${featured.map(card).join('')}</div>
  </section>
  ${byArea}
  ${byFeature}
  <p class="gallery-none" hidden>No demo matches. Try fewer words, or <button type="button" class="gallery-clear">show them all</button>.</p>
</div>
<script src="/gallery.js"></script>`,
};
