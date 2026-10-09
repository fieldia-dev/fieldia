import { code } from './layout.mjs';

/**
 * fieldia.dev's feature pages, one area each: an opening that shows the area
 * working (a live demo in a frame, or code), its parts (each a real picture
 * taken from a demo by tools/feature-shots.mjs, what it has, a way to try it
 * and to read how), what keeps it right, and a way on. The home page tours;
 * these pages show everything in one area. Every page reads its words from its
 * own module in site/pages/; this module draws them all the same way.
 */

/** The six areas, in the order the Features page and the top bar's menu list them. */
export const FEATURES = [
  { path: '/features/forms/', name: 'Forms and surveys', blurb: 'Every field a form needs, steps that follow the answers, checks as people type, and a Google Forms look.' },
  { path: '/features/records/', name: 'Business records', blurb: 'Status bars, stat buttons, lines that add up, tabs, the chatter, the PDF beside the sheet and a pager.' },
  { path: '/features/rules/', name: 'Rules and actions', blurb: 'Fields shown, required and locked by conditions, values worked out, and buttons that run steps.' },
  { path: '/features/lists/', name: 'Lists and search', blurb: 'Suggestions as people type, filters, grouping and favourites, and buttons for the records chosen.' },
  { path: '/features/looks/', name: 'Looks and languages', blurb: 'Eight themes, two skins, light and dark, four languages right to left, and your app’s own words.' },
  { path: '/features/backend/', name: 'Your backend', blurb: 'One small interface to load and save; your server fills in fields and puts its refusals on them.' },
];

export const demoHref = (query) => `/demos/plain/?${query}`;

const HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@400;600&display=swap">
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/features.css">
`;

/** One part: words beside its picture or its code, what it has, and where to try it and read how. */
function part({ id, no, title, body, ticks, shot, alt, width, height, source, lang, tryIt, docs, flip }, folder) {
  // A picture of a whole screen spans the page, its words above it; a narrow one, or code, sits beside them.
  const wide = !!shot && width >= 900;
  const live = shot
    ? `<a class="chapter-live shot" href="${tryIt ? tryIt[1] : docs[1]}" tabindex="-1" aria-hidden="true"><img src="/img/${folder}/${shot}" alt="${alt}" loading="lazy" width="${width}" height="${height}" style="max-width: min(100%, ${width}px)"></a>`
    : `<div class="feature-code">${code(lang ?? 'js', source)}</div>`;
  const links = [tryIt ? `<a class="btn btn-solid" href="${tryIt[1]}">${tryIt[0]}</a>` : '', docs ? `<a href="${docs[1]}">${docs[0]} →</a>` : ''].join('');
  return `<section class="chapter${wide ? ' chapter-stack' : flip ? ' chapter-flip' : ''}" id="${id}" aria-labelledby="${id}-h">
  <div class="chapter-copy">
    <p class="chapter-no">${no}</p>
    <h2 id="${id}-h">${title}</h2>
    <p>${body}</p>
    <ul class="ticks">${ticks.map((t) => `<li>${t}</li>`).join('')}</ul>
    <p class="feature-links">${links}</p>
  </div>
  ${live}
</section>`;
}

/**
 * A feature page from its words: `opening` is either `{ frame, title }` (a live
 * demo, embedded) or `{ source, lang }` (code); `parts` alternate sides on their
 * own; `facts` close it with what keeps the area right.
 */
export function featurePage({ path, folder, title, description, kicker, headline, lede, opening, parts, facts, factLinks, start, finale }) {
  const stage = opening.frame
    ? `<div class="stage feature-frame"><iframe src="${demoHref(`${opening.frame}&embed=1`)}" title="${opening.title}" loading="eager"></iframe></div>`
    : `<div class="stage feature-stage-code">${code(opening.lang ?? 'js', opening.source)}</div>`;
  return {
    path,
    title,
    description,
    head: HEAD,
    body: `
<div class="story feature-page">

<section class="opening feature-opening" aria-labelledby="opening-h">
  <div class="opening-copy">
    <p class="kicker">Features · ${kicker}</p>
    <h1 id="opening-h">${headline[0]}<br><span>${headline[1]}</span></h1>
    <p class="lede">${lede}</p>
  </div>
  ${stage}
</section>

${parts.map((p, i) => part({ flip: i % 2 === 1, ...p }, folder)).join('\n\n')}

<section class="chapter chapter-center" id="kept-right" aria-labelledby="kept-right-h">
  <div class="chapter-copy">
    <p class="chapter-no">${facts.no}</p>
    <h2 id="kept-right-h">${facts.title}</h2>
  </div>
  <ul class="figures feature-facts">
    ${facts.items.map(([name, words]) => `<li><b>${name}</b><span>${words}</span></li>`).join('\n    ')}
  </ul>
  ${factLinks ? `<p class="feature-links">${factLinks.map(([words, href]) => `<a href="${href}">${words} →</a>`).join('')}</p>` : ''}
</section>
${start ?? ''}
<section class="finale" aria-labelledby="finale-h">
  <h2 id="finale-h">${finale.title}</h2>
  <p>${finale.words}</p>
  <div class="opening-actions">
    <a class="btn btn-solid" href="/start/">Read Get started</a>
    <a class="btn btn-ghost" href="/features/">All the features</a>
  </div>
</section>

</div>
`,
  };
}
