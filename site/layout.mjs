/** The shell every page of fieldia.dev shares: head, top bar, the docs menu, footer. */

export const DOCS = [
  { path: '/start/', title: 'Get started' },
  { path: '/pages/', title: 'The page format' },
  { path: '/fields/', title: 'Fields' },
  { path: '/data/', title: 'Data sources' },
  { path: '/behaviour/', title: 'Behaviour' },
  { path: '/actions/', title: 'Actions and events' },
  { path: '/record/', title: 'Around a record' },
  { path: '/lists/', title: 'Lists and search' },
  { path: '/chatter/', title: 'Chatter' },
  { path: '/look/', title: 'Skins and languages' },
];

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A code block. `text` is written as is and escaped here, so samples read naturally in the source. In the Tab order, so a long line scrolls by keyboard. */
export function code(lang, text) {
  const body = text.replace(/^\n/, '').replace(/\n\s*$/, '');
  return `<pre class="code" data-lang="${lang}" tabindex="0"><code>${escape(body)}</code></pre>`;
}

/** Inline code. */
export const c = (text) => `<code>${escape(text)}</code>`;

export function layout({ path, title, description, body, wide = false, head = '' }) {
  const docs = DOCS.some((d) => d.path === path);
  const nav = DOCS.map((d) => `<a href="${d.path}"${d.path === path ? ' aria-current="page"' : ''}>${d.title}</a>`).join('');
  const fullTitle = path === '/' ? 'Fieldia — forms and app screens as JSON, for every framework' : `${title} · Fieldia`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://fieldia.dev${path}">
<meta property="og:title" content="${fullTitle}">
<meta property="og:description" content="${description}">
<meta property="og:url" content="https://fieldia.dev${path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/site.css">
${head}</head>
<body>
<a class="skip" href="#main">Skip to the content</a>
<header class="top">
  <a class="brand" href="/"><span class="mark" aria-hidden="true"></span><span class="brand-word">Fieldia</span></a>
  <nav class="top-nav" aria-label="Site">
    <a href="/start/"${docs ? ' aria-current="true"' : ''}>Docs</a>
    <a href="/demos/"${path === '/demos/' ? ' aria-current="page"' : ''}>Demos</a>
    <a href="/designer/"${path === '/designer/' ? ' aria-current="page"' : ''}>Designer</a>
    <a href="https://github.com/fieldia-dev/fieldia">GitHub</a>
    <a href="https://www.npmjs.com/org/fieldia">npm</a>
  </nav>
</header>
${
  docs
    ? `<div class="docs${wide ? ' docs-wide' : ''}">
  <nav class="side" aria-label="Docs">${nav}</nav>
  <main id="main" class="prose">
    <h1>${title}</h1>
    ${body}
  </main>
</div>`
    : `<main id="main">${body}</main>`
}
<footer class="foot">
  <p>Fieldia is MIT licensed. Its sister project is <a href="https://grafloria.com">Grafloria</a>, the diagram and dashboard engine.</p>
  <p><a href="https://github.com/fieldia-dev/fieldia">Source on GitHub</a> · <a href="https://www.npmjs.com/org/fieldia">npm</a> · <a href="/accessibility/"${path === '/accessibility/' ? ' aria-current="page"' : ''}>Accessibility</a></p>
</footer>
</body>
</html>
`;
}
