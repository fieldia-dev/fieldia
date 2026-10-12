/**
 * The frame around every demo page: a header with the demo's name, its
 * framework and its look; and, for a person visiting, the menu of all demos,
 * the "how to try it" panel, and the code drawer with the page's JSON and how
 * to mount it in each framework. Browser tests (navigator.webdriver) get the
 * header alone, so what they measure is the demo, not the frame around it.
 * `embed=1`: the demo alone, no frame at all, as fieldia.dev's feature pages
 * show it inside their own.
 */
import { CATEGORIES, DEMOS, FEATURED, FRAMEWORKS, demoAt, demoHref } from './catalog.mjs';
import { highlight } from './highlight.mjs';
import { snippets } from './snippets.mjs';

const head = document.getElementById('demo-head');
const app = head?.dataset['app'] ?? 'plain';
const params = new URLSearchParams(location.search);
const demo = demoAt(app, params);
const embedded = params.get('embed') === '1';
const visitor = !navigator.webdriver && !embedded;
const framework = FRAMEWORKS.some((f) => f.id === app) ? app : 'plain';
// The frame wears its form's scheme (shell.css): the one the address names, else the reader's own as the
// page opens, which the form follows too (demos/shared/sample-data.ts). The script tag demo's form takes
// nothing from the address and is drawn light, so its frame is too.
const scheme = !FRAMEWORKS.some((f) => f.id === app)
  ? 'light'
  : (params.get('scheme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'auto' : 'light'));
document.documentElement.dataset.scheme = scheme;
const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const remember = (key, value) => {
  try {
    if (value === undefined) return localStorage.getItem(key);
    localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage forget; the frame still works.
  }
  return null;
};

// ---- the header ------------------------------------------------------------------------

/** This page with one setting changed, keeping the others. */
/** The themes, as a page's look names them, with the names people know them by. */
const THEMES = [['material', 'Material'], ['fluent', 'Fluent'], ['apple', 'Apple'], ['bootstrap', 'Bootstrap'], ['shadcn', 'shadcn'], ['ant', 'Ant Design'], ['odoo', 'Odoo'], ['google-forms', 'Google Forms']];

function withParam(key, value) {
  const next = new URLSearchParams(params);
  if (value) next.set(key, value);
  else next.delete(key);
  return `?${next}`;
}

function drawHeader() {
  if (!head) return;
  const frameworks = demo?.app
    ? ''
    : `<nav class="dh-pills" aria-label="Framework">${FRAMEWORKS.map(
        (f) => `<a href="../${f.id}/${esc(location.search)}"${f.id === app ? ' aria-current="page"' : ''}>${f.label}</a>`
      ).join('')}</nav>`;
  const theme = params.get('theme') ?? '';
  // A theme brings its own skin: the skin's pills show which, and picking one keeps the theme over it.
  const skin = params.get('skin') ?? (theme === 'odoo' || !theme ? 'underline' : 'outlined');
  // The code demo's fields in either editor, or each where it fits: the same fields, to compare (demos/shared/code-page.ts).
  const editor = params.get('editor') ?? 'both';
  const editors =
    demo?.id === 'code'
      ? `<div class="dh-editor"><span aria-hidden="true">Editor</span><nav class="dh-pills" aria-label="Editor">${[['both', 'Both'], ['codemirror', 'CodeMirror'], ['monaco', 'VS Code']]
          .map(([id, name]) => `<a href="${esc(withParam('editor', id))}"${id === editor ? ' aria-current="page"' : ''}>${name}</a>`)
          .join('')}</nav></div>`
      : '';
  // A demo the plain page runs alone still changes its look; one with an app of its own (the script tag) does not.
  const skins = demo?.app && demo.app !== 'plain'
    ? ''
    : `<div class="dh-looks">${editors}<nav class="dh-pills dh-skins" aria-label="Look">${['underline', 'outlined']
        .map((s) => `<a href="${esc(withParam('skin', s))}"${s === skin ? ' aria-current="page"' : ''}>${s[0].toUpperCase()}${s.slice(1)}</a>`)
        .join('')}</nav><nav class="dh-pills dh-schemes" aria-label="Scheme">${[['', 'System'], ['light', 'Light'], ['dark', 'Dark']]
        .map(([id, name]) => `<a href="${esc(withParam('scheme', id))}"${id === (params.get('scheme') ?? '') ? ' aria-current="page"' : ''}>${name}</a>`)
        .join('')}</nav><label class="dh-theme">Theme <select id="dh-theme">${[['', 'None'], ...THEMES]
        .map(([id, name]) => `<option value="${id}"${id === theme ? ' selected' : ''}>${name}</option>`)
        .join('')}</select></label></div>`;
  head.innerHTML = `
    <div class="dh-row">
      ${visitor ? '<button type="button" class="dh-menu" aria-label="All demos" aria-controls="demo-nav" aria-expanded="false"><span></span></button>' : ''}
      <a class="dh-brand" href="../"><span class="dh-mark" aria-hidden="true"></span>Fieldia</a>
      <span class="dh-crumb">demos</span>
      ${frameworks}
      <nav class="dh-links" aria-label="Links">
        ${visitor ? '<button type="button" class="dh-code" aria-controls="demo-code" aria-expanded="false">‹/› Code</button>' : ''}
        <a href="../">← All demos</a>
        <a href="https://github.com/fieldia-dev/fieldia">GitHub</a>
        <a href="https://fieldia.dev">fieldia.dev</a>
      </nav>
    </div>
    <div class="dh-title-row">
      <h1 class="dh-title">${esc(demo?.name ?? document.title.replace(/^Fieldia — /, ''))}</h1>
      ${skins}
    </div>`;
}

// ---- the menu of every demo ----------------------------------------------------------------

function drawMenu() {
  const item = (d) =>
    `<a class="dn-item" href="../${esc(demoHref(d, framework))}" data-name="${esc(d.name.toLowerCase())}"${d === demo ? ' aria-current="page"' : ''}>${esc(d.name)}</a>`;
  const featured = FEATURED.map((id) => DEMOS.find((d) => d.id === id)).filter(Boolean);
  const groups = [
    `<div class="dn-group"><div class="dn-cat">★ Featured</div>${featured.map(item).join('')}</div>`,
    ...CATEGORIES.map((c) => {
      const items = DEMOS.filter((d) => d.category === c.id);
      return items.length ? `<div class="dn-group"><div class="dn-cat">${esc(c.label)}</div>${items.map(item).join('')}</div>` : '';
    }),
  ];
  const nav = document.createElement('aside');
  nav.id = 'demo-nav';
  nav.setAttribute('aria-label', 'All demos');
  nav.innerHTML = `
    <div class="dn-head"><span>Fieldia demos</span><button type="button" class="dn-close" aria-label="Close the menu">‹</button></div>
    <input type="search" class="dn-filter" placeholder="Filter demos…  ( / )" aria-label="Filter demos">
    <div class="dn-list">${groups.join('')}</div>
    <div class="dn-foot">${DEMOS.length} demos · every one MIT · <a href="https://fieldia.dev">fieldia.dev</a></div>`;
  document.body.append(nav);

  const toggle = head?.querySelector('.dh-menu');
  const filter = nav.querySelector('.dn-filter');
  const setOpen = (open, keep = true) => {
    document.body.classList.toggle('dn-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (keep) remember('fieldia-demos-menu', open ? '1' : '0');
  };
  const kept = remember('fieldia-demos-menu');
  setOpen(kept === null ? innerWidth >= 1100 : kept === '1', false);
  toggle?.addEventListener('click', () => setOpen(!document.body.classList.contains('dn-open')));
  nav.querySelector('.dn-close').addEventListener('click', () => setOpen(false));
  filter.addEventListener('input', () => {
    const words = filter.value.trim().toLowerCase();
    for (const link of nav.querySelectorAll('.dn-item')) link.hidden = !!words && !link.dataset.name.includes(words);
    for (const group of nav.querySelectorAll('.dn-group')) group.hidden = ![...group.querySelectorAll('.dn-item')].some((a) => !a.hidden);
  });
  // "/" finds a demo from anywhere outside a box being typed in.
  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (event.key !== '/' || target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    event.preventDefault();
    setOpen(true);
    filter.focus();
  });
}

// ---- about and how to try it -------------------------------------------------------------------

function drawHowTo() {
  if (!demo) return;
  const panel = document.createElement('aside');
  panel.id = 'demo-howto';
  panel.setAttribute('aria-label', 'About this demo');
  panel.innerHTML = `
    <div class="ht-head"><span>About &amp; how to try it</span><button type="button" class="ht-close" aria-label="Close the panel">×</button></div>
    <p class="ht-about">${esc(demo.blurb)}</p>
    <div class="ht-steps">How to try it</div>
    <ol>${demo.howTo.map((step) => `<li>${esc(step)}</li>`).join('')}</ol>
    <p class="ht-tested">Every demo here is driven by Fieldia’s browser tests on every change, in every framework.</p>`;
  const opener = document.createElement('button');
  opener.type = 'button';
  opener.id = 'demo-howto-open';
  opener.setAttribute('aria-label', 'About this demo');
  opener.textContent = '?';
  document.body.append(panel, opener);
  const setOpen = (open, keep = true) => {
    document.body.classList.toggle('ht-open', open);
    if (keep) remember('fieldia-demos-howto', open ? '1' : '0');
  };
  const kept = remember('fieldia-demos-howto');
  setOpen(kept === null ? innerWidth >= 1280 : kept === '1', false);
  panel.querySelector('.ht-close').addEventListener('click', () => {
    setOpen(false);
    opener.focus();
  });
  opener.addEventListener('click', () => setOpen(true));
}

// ---- the code drawer ------------------------------------------------------------------------------

function drawCode() {
  const tabs = [
    ['json', 'Page JSON', 'The page this demo shows: plain JSON, the same the browser tests drive.'],
    ['js', 'JavaScript', 'One call, no framework.'],
    ['react', 'React', 'The same page in React.'],
    ['vue', 'Vue', 'The same page in Vue.'],
    ['angular', 'Angular', 'The same page in Angular.'],
  ];
  const drawer = document.createElement('section');
  drawer.id = 'demo-code';
  drawer.hidden = true;
  drawer.setAttribute('aria-label', 'Code');
  drawer.innerHTML = `
    <div class="dc-bar">
      <div class="dc-tabs" role="tablist">${tabs.map(([id, label]) => `<button type="button" role="tab" data-tab="${id}" aria-selected="false">${label}</button>`).join('')}</div>
      <span class="dc-note"></span>
      <button type="button" class="dc-copy">Copy</button>
      <button type="button" class="dc-close" aria-label="Close the code">×</button>
    </div>
    <pre class="dc-code" tabindex="0"><code></code></pre>`;
  document.body.append(drawer);
  const toggle = head?.querySelector('.dh-code');
  const code = drawer.querySelector('code');
  const note = drawer.querySelector('.dc-note');
  const copy = drawer.querySelector('.dc-copy');
  let current = 'json';
  const show = (tab) => {
    current = tab;
    const page = window.fieldiaDemo?.handle?.form?.page ?? null;
    // Coloured as its language reads: the page's JSON, the frameworks' own code.
    code.innerHTML = highlight({ json: 'json', js: 'ts', react: 'tsx', vue: 'vue', angular: 'ts' }[tab], snippets(page, params)[tab]);
    note.textContent = tabs.find(([id]) => id === tab)[2];
    for (const button of drawer.querySelectorAll('[role="tab"]')) button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  };
  const setOpen = (open) => {
    drawer.hidden = !open;
    document.body.classList.toggle('dc-open', open);
    toggle?.setAttribute('aria-expanded', String(open));
    if (open) show(current);
  };
  toggle?.addEventListener('click', () => setOpen(drawer.hidden));
  drawer.querySelector('.dc-close').addEventListener('click', () => setOpen(false));
  for (const button of drawer.querySelectorAll('[role="tab"]')) button.addEventListener('click', () => show(button.dataset.tab));
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code.textContent);
      copy.textContent = 'Copied';
    } catch {
      // No clipboard here: select the code, for Ctrl+C.
      getSelection()?.selectAllChildren(code);
      copy.textContent = 'Selected';
    }
    setTimeout(() => (copy.textContent = 'Copy'), 1500);
  });
}

if (embedded) head?.remove();
else drawHeader();
// A theme picked: the page again in it, on the theme's own skin.
document.getElementById('dh-theme')?.addEventListener('change', (event) => {
  const next = new URLSearchParams(params);
  next.delete('skin');
  if (event.target.value) next.set('theme', event.target.value);
  else next.delete('theme');
  location.search = next.toString();
});
// The tab names the demo, as a page of the gallery.
if (demo) document.title = `${demo.name} — Fieldia demos`;
if (visitor) {
  drawMenu();
  drawHowTo();
  drawCode();
}
