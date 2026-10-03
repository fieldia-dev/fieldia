import { DESIGNER_DEMOS } from '../../demos/designer-catalog.mjs';

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** A starting point as a card: its picture, its name, what to try, and the designer it opens. */
function card(demo) {
  return `<a class="demo-card" href="/demos/${esc(demo.href)}" style="--cat: #0b5cad" data-designer="${esc(demo.id)}">
    <span class="demo-thumb"><img src="/demos/thumbs/${demo.id}.png" alt="" width="600" height="360" loading="lazy"></span>
    <span class="demo-name">${esc(demo.name)}<span class="demo-go" aria-hidden="true">→</span></span>
    <span class="demo-blurb">${esc(demo.blurb)}</span>
    <span class="demo-where">Opens the designer</span>
  </a>`;
}

export default {
  path: '/designer/',
  title: 'Designer',
  description: 'Fieldia’s designer, to try: build surveys the Google Forms way, record pages and lists of records, without writing a page by hand. A preview — not on npm yet.',
  body: `
<header class="gallery-hero">
  <h1>The designer</h1>
  <p class="lead"><b>Build a page by pointing at it.</b> Questions as cards, the Google Forms way; a record’s page in the viewer’s own grid, fields dropped where a gap opens; a list of records by its columns. Pick anything to type its words where it stands; check it, publish it, and open an earlier version again. Nothing you do here is saved.</p>
  <div class="chips">
    <span class="chip"><b>Preview</b> — not on npm yet</span>
    <span class="chip">⌘K finds anything</span>
    <a class="chip chip-link" href="/demos/">The demos →</a>
  </div>
</header>
<div class="gallery-body">
  <section class="gallery-section featured" id="designer" aria-labelledby="designer-h">
    <h2 id="designer-h">Start from <span class="count">${DESIGNER_DEMOS.length}</span></h2>
    <div class="gallery">${DESIGNER_DEMOS.map(card).join('')}</div>
  </section>
</div>`,
};
