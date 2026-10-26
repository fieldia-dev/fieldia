/**
 * The frame around every demo page: a header with the demo's name, its
 * framework and its look, the first thing to try and its source on GitHub;
 * and, for a person visiting, the menu of all demos, the "how to try it"
 * panel, and the code drawer with the page's JSON and how to mount it in each
 * framework. Browser tests (navigator.webdriver) get the header alone, so what
 * they measure is the demo, not the frame around it.
 * `embed=1`: the demo alone, no frame at all, as fieldia.dev's feature pages
 * show it inside their own.
 */
import { CATEGORIES, DEMOS, FEATURED, FRAMEWORKS, GITHUB, demoAt, demoHref, openedAt, sourceOf, stepParts } from './catalog.mjs';
import { highlight } from './highlight.mjs';
import { backlogSnippets, designerSnippets, listMapSnippets, saveSafetySnippets, slotsSnippets, snippets, uploadsSnippets } from './snippets.mjs';

const head = document.getElementById('demo-head');
const app = head?.dataset['app'] ?? 'plain';
const params = new URLSearchParams(location.search);
const demo = demoAt(app, params);
// A page a demo opened — a record from its list's row, pin or calendar — with a name of its own, and the demo it came from.
const opened = demo ? null : openedAt(app, params);
const embedded = params.get('embed') === '1';
const visitor = !navigator.webdriver && !embedded;
const framework = FRAMEWORKS.some((f) => f.id === app) ? app : 'plain';
// Every demo wears one scheme, the frame and the demo in it together: the one the address names, else the reader's own
// as the page opens. A form whose page names its own follows it (demos/shared/sample-data.ts); one whose page names
// none — the script tag's, the embed's, a designer's — wears the frame's (shell.css, `data-dark`): one rule here, so
// no demo stays light in a dark frame.
const scheme = params.get('scheme') ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'auto' : 'light');
document.documentElement.dataset.scheme = scheme;
const systemDark = matchMedia('(prefers-color-scheme: dark)');
const wearDark = () => document.documentElement.toggleAttribute('data-dark', scheme === 'dark' || (scheme === 'auto' && systemDark.matches));
wearDark();
systemDark.addEventListener('change', wearDark);
// The demo's place, still empty half a second after the page began, holds a quiet shape until the demo draws into it
// (shell.css, `data-place-waits`): on a slow network the frame comes before the demo's own script (the walk of 0.35).
setTimeout(() => document.documentElement.toggleAttribute('data-place-waits', true), Math.max(0, 500 - performance.now()));
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
  const schemes = `<nav class="dh-pills dh-schemes" aria-label="Scheme">${[['', 'System'], ['light', 'Light'], ['dark', 'Dark']]
    .map(([id, name]) => `<a href="${esc(withParam('scheme', id))}"${id === (params.get('scheme') ?? '') ? ' aria-current="page"' : ''}>${name}</a>`)
    .join('')}</nav>`;
  // A demo the plain page runs alone still changes its look; one with an app of its own (the script tag) its scheme alone.
  const skins = demo?.app && demo.app !== 'plain'
    ? `<div class="dh-looks">${schemes}</div>`
    : `<div class="dh-looks">${editors}<nav class="dh-pills dh-skins" aria-label="Look">${['underline', 'outlined', 'quiet']
        .map((s) => `<a href="${esc(withParam('skin', s))}"${s === skin ? ' aria-current="page"' : ''}>${s[0].toUpperCase()}${s.slice(1)}</a>`)
        .join('')}</nav>${schemes}<label class="dh-theme">Theme <select id="dh-theme">${[['', 'None'], ...THEMES]
        .map(([id, name]) => `<option value="${id}"${id === theme ? ' selected' : ''}>${name}</option>`)
        .join('')}</select></label></div>`;
  head.innerHTML = `
    <div class="dh-row">
      ${visitor ? '<button type="button" class="dh-menu" aria-label="All demos" aria-controls="demo-nav" aria-expanded="false"><span></span></button>' : ''}
      <a class="dh-brand" href="../"><span class="dh-mark" aria-hidden="true"></span><span class="dh-word">Fieldia</span></a>
      <span class="dh-crumb">demos</span>
      ${visitor && demo ? '<button type="button" class="dh-help" aria-label="About this demo" aria-controls="demo-howto" aria-expanded="false">?</button>' : ''}
      <button type="button" class="dh-options" aria-expanded="false" aria-label="Framework, look and links"><svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 6h8M15 6h2M3 14h2M9 14h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="13" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="14" r="2" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>Options</span></button>
      ${frameworks}
      <nav class="dh-links" aria-label="Links">
        ${visitor ? '<button type="button" class="dh-code" aria-controls="demo-code" aria-expanded="false">‹/› Code</button>' : ''}
        ${startingPoints()}
        <a href="../">← All demos</a>
        <a href="https://github.com/fieldia-dev/fieldia">GitHub</a>
        <a href="https://fieldia.dev">fieldia.dev</a>
      </nav>
    </div>
    <div class="dh-title-row">
      <h1 class="dh-title">${esc(demo?.name ?? opened?.name ?? '')}</h1>
      ${skins}
    </div>
    ${tryThis()}`;
}

/**
 * A designer's other starting points, on fieldia.dev's Designer page: there only, where that page is (the demos served
 * on their own have none).
 */
function startingPoints() {
  if (!demo?.startingPoints || !location.pathname.startsWith('/demos/')) return '';
  return `<a href="${esc(demo.startingPoints)}">All starting points</a>`;
}

/**
 * Under the demo's name, for everyone: the first thing to try, all its steps a press away (the how-to panel, for a
 * person visiting), and the file it is written in on GitHub — its page's JSON, or its app's code.
 */
function tryThis() {
  if (!demo) return KEEPS.has(app) ? `<p class="dh-try">${keptLine()}</p>` : '';
  const steps = demo.howTo ?? [];
  const all = visitor && steps.length > 1 ? ` <button type="button" class="dh-try-all" aria-controls="demo-howto">All ${steps.length} steps</button>` : '';
  const source = `<a class="dh-source" href="${GITHUB}/blob/main/${esc(sourceOf(demo))}" target="_blank" rel="noopener">Its source on GitHub<span aria-hidden="true"> ↗</span></a>`;
  return `<p class="dh-try">${steps.length ? `<span class="dh-try-word">Try this:</span> <span class="dh-try-step">${stepHtml(steps[0])}</span>${all}` : ''} ${source}${KEEPS.has(app) ? ` ${keptLine()}` : ''}</p>`;
}

/** The apps whose demos keep what is saved while the tab is open (demos/shared/kept.ts): the demos' shared source's. */
const KEEPS = new Set(['plain', 'react', 'vue', 'angular', 'backlog', 'save-safety', 'csp']);
/**
 * That what is saved stays while the tab is open, and Start over once something is: said from the start, at the end of
 * the try line, so saving moves nothing (Start over holds its place until there is something to start over from).
 */
function keptLine() {
  return `<span class="dh-kept">What you save here stays while this tab is open. <button type="button" class="dh-start-over" data-none>Start over</button></span>`;
}

/**
 * A how-to step as the header and the panel show it: its words, each link in it a link (catalog.mjs's `stepParts`) — a
 * file to try the demo with, downloaded from beside the demos; or this demo with a setting in its address, the others
 * kept, so no step sends a person to the address bar.
 */
function stepHtml(step) {
  return stepParts(step)
    .map((part) => {
      if (!part.href) return esc(part.text);
      if (part.href.startsWith('?')) {
        const next = new URLSearchParams(params);
        for (const [key, value] of new URLSearchParams(part.href.slice(1))) next.set(key, value);
        return `<a class="dh-step-link" href="?${esc(next.toString())}">${esc(part.text)}</a>`;
      }
      // A page to look at (the codes to scan, on another screen) opens in a tab of its own; a file to try the demo with
      // is downloaded.
      const href = esc(new URL(part.href, new URL('..', location.href)).href);
      if (/\.html$/.test(part.href)) return `<a class="dh-step-link" href="${href}" target="_blank" rel="noopener">${esc(part.text)}</a>`;
      return `<a class="dh-step-link" href="${href}" download>${esc(part.text)}</a>`;
    })
    .join('');
}

// ---- the menu of every demo ----------------------------------------------------------------

function drawMenu() {
  const item = (d) =>
    `<a class="dn-item" href="../${esc(demoHref(d, framework))}" data-name="${esc(d.name.toLowerCase())}"${d === (demo ?? opened?.from) ? ' aria-current="page"' : ''}>${esc(d.name)}</a>`;
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
    // Folded, it is only slid off the window: out of the keys' way and a screen reader's too, never Tab stops unseen.
    nav.inert = !open;
    if (keep) remember('fieldia-demos-menu', open ? '1' : '0');
  };
  // Open by itself only where it takes room of its own beside the demo (1,100 px, shell.css) and leaves the demo the room
  // its own layout needs (a designer's toolbox and panel beside its page: DEMO_ROOM); a person's choice, either way, is
  // kept. A window narrowed past where the menu takes room of its own folds it, never leaving it over the demo, and one
  // widened again gives back what the person chose.
  const kept = remember('fieldia-demos-menu');
  const wide = matchMedia('(min-width: 1100px)');
  const byItself = () => innerWidth >= Math.max(1100, NAV + (DEMO_ROOM[app] ?? 0));
  const chosen = () => {
    const now = remember('fieldia-demos-menu');
    return now === null ? byItself() : now === '1';
  };
  setOpen(wide.matches && (kept === null ? byItself() : kept === '1'), false);
  wide.addEventListener('change', () => setOpen(wide.matches && chosen(), false));
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

/** The menu's width and the how-to panel's, as shell.css gives them (--dh-nav, --dh-howto). */
const NAV = 264;
const HOWTO = 300;
/**
 * The window the widest demo's record needs to be whole, with no panel open, as measured at 0.26: the sales order's
 * lines (its cells cut below it), and the real order's, task's, transfer's and employee's; the contacts' columns and
 * the homes on a map need 1,120, the property 1,060, the customers 1,000. Not counted: a calendar's event titles and
 * the dense grids of a few ERP replicas (the real invoice's, the expense's), which cut their long cells at any width,
 * as their ERP does. The menu, the panel and the record all fit side by side from this plus both panels: 1,744px.
 */
const RECORD_WHOLE = 1180;
/**
 * The room a demo's app needs beside the menu for its own layout, by app: the designers keep their toolbox and their
 * panel beside the page from about 1,100 px (narrower, the toolbox is a sheet and the panel goes under the page), so
 * the menu opens by itself beside them only where that is left.
 */
const DEMO_ROOM = { screen: 1120, designer: 1120, 'designer-react': 1120, 'designer-vue': 1120, 'designer-angular': 1120 };

function drawHowTo() {
  if (!demo) return;
  const panel = document.createElement('aside');
  panel.id = 'demo-howto';
  panel.setAttribute('aria-label', 'About this demo');
  panel.innerHTML = `
    <div class="ht-head"><span>About &amp; how to try it</span><button type="button" class="ht-close" aria-label="Close the panel">×</button></div>
    <p class="ht-about">${esc(demo.blurb)}</p>
    <div class="ht-steps">How to try it</div>
    <ol>${demo.howTo.map((step) => `<li>${stepHtml(step)}</li>`).join('')}</ol>
    <p class="ht-tested">Every demo here is driven by Fieldia’s browser tests on every change, in every framework.</p>`;
  document.body.append(panel);
  // Its button is in the header, beside Options on a phone: nothing floats over the demo.
  const opener = head?.querySelector('.dh-help');
  const setOpen = (open, keep = true) => {
    document.body.classList.toggle('ht-open', open);
    opener?.setAttribute('aria-expanded', String(open));
    if (keep) remember('fieldia-demos-howto', open ? '1' : '0');
  };
  // Open by itself only where it, the menu if open, and the record all fit whole; else folded to its first step, which
  // the header says. A person's own choice, either way, is kept.
  // Where it would lie over the demo (under 1,280 px, shell.css), only a press opens it: never by itself as a page opens
  // — a step's link followed from it on a phone opens the next page on the demo, not on the panel — and a window
  // narrowed past that folds it.
  const kept = remember('fieldia-demos-howto');
  const room = innerWidth - (document.body.classList.contains('dn-open') ? NAV : 0) - HOWTO;
  const beside = matchMedia('(min-width: 1280px)');
  setOpen(beside.matches && (kept === null ? room >= RECORD_WHOLE : kept === '1'), false);
  beside.addEventListener('change', () => {
    if (!beside.matches) setOpen(false, false);
  });
  panel.querySelector('.ht-close').addEventListener('click', () => {
    setOpen(false);
    opener?.focus();
  });
  opener?.addEventListener('click', () => {
    const open = !document.body.classList.contains('ht-open');
    setOpen(open);
    if (open) panel.querySelector('.ht-close')?.focus();
  });
  // The header's "All the steps": the panel, open, its steps in view.
  head?.querySelector('.dh-try-all')?.addEventListener('click', () => {
    setOpen(true);
    panel.querySelector('.ht-close')?.focus();
  });
}

// ---- the code drawer ------------------------------------------------------------------------------

function drawCode() {
  // A list's map in a page of its own: the page that describes its records, and the page's own script.
  const ownPage = demo?.code === 'list-map';
  // A tracker's backlog of its own: the list's page, the bug's page, and the app's script.
  const backlog = demo?.code === 'backlog';
  // Photos stored as they are picked: the page, the demo's script with its slow store, and the store an app gives.
  const uploads = demo?.code === 'uploads';
  // One record in two tabs: the page, the demo's own script, and a data source of your own that tells versions and rights.
  const safety = demo?.code === 'save-safety';
  // A test drive booked from the times free: the page, the demo's script with its schedule, and the slots() an app gives.
  const slots = demo?.code === 'slots';
  // A designer: the page being made, as it stands, and the designer mounted with no framework and in each.
  const designing = demo?.code === 'designer';
  const tabs = designing
    ? [
        ['json', 'Page JSON', 'The page you are making, as it stands now: plain JSON, what the viewer draws and the designer publishes.'],
        ['js', 'JavaScript', 'The designer on a page of your own, with no framework.'],
        ['react', 'React', 'The same designer in React.'],
        ['vue', 'Vue', 'The same designer in Vue.'],
        ['angular', 'Angular', 'The same designer in Angular.'],
      ]
    : slots
    ? [
        ['json', 'Page JSON', 'The test drive this demo books: plain JSON, its time zone and its slots, the same the browser tests drive.'],
        ['js', 'JavaScript', 'The demo’s script: the memory source answering from the showroom’s schedule.'],
        ['source', 'Your source', 'slots() for your own server: the free times of the days asked.'],
      ]
    : uploads
    ? [
        ['json', 'Page JSON', 'The listing this demo shows: plain JSON, the same the browser tests drive.'],
        ['js', 'JavaScript', 'The demo’s script: the memory source as a slow store, one photo failing once.'],
        ['store', 'Your store', 'upload() for your own endpoint, or Azure Blob through an address your server signs.'],
      ]
    : safety
    ? [
        ['json', 'Page JSON', 'The lead both tabs show: plain JSON, the same the browser tests drive.'],
        ['js', 'JavaScript', 'The demo’s own script: one data source with versions and rights, the lead in two tabs.'],
        ['server', 'Your server', 'A data source of your own: the version and the rights from your server, a conflict thrown back.'],
      ]
    : backlog
    ? [
        ['json', 'Backlog JSON', 'The list the backlog shows: plain JSON, the same the browser tests drive.'],
        ['bug', 'Bug JSON', 'The bug the popup shows: its head, its three columns of groups, its tabs.'],
        ['js', 'JavaScript', 'The app’s own script: the list in its page, a row’s bug in the popup.'],
      ]
    : ownPage
    ? [
        ['json', 'Page JSON', 'What the map shows of each home: plain JSON, the same the browser tests drive.'],
        ['js', 'JavaScript', 'The page’s own script: its list, its address, and one call for the map.'],
      ]
    : [
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
    const page = designing ? (window.fieldiaDesigner?.designer?.getPage() ?? null) : (window.fieldiaDemo?.handle?.form?.page ?? window.fieldiaDemo?.page ?? null);
    // Coloured as its language reads: the page's JSON, the frameworks' own code.
    const written = designing ? designerSnippets(page, demo.app === 'screen' ? 'screen' : 'survey') : slots ? slotsSnippets(page, params) : uploads ? uploadsSnippets(page, params) : safety ? saveSafetySnippets(page, params) : backlog ? backlogSnippets(page, window.fieldiaDemo?.bugPage ?? null) : ownPage ? listMapSnippets(page) : snippets(page, params, { nonce: demo?.app === 'csp' });
    code.innerHTML = highlight({ json: 'json', bug: 'json', js: 'ts', store: 'ts', server: 'ts', source: 'ts', react: 'tsx', vue: 'vue', angular: 'ts' }[tab], written[tab]);
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
// A phone's header is one row — the demo's name and Options — the pickers and links folded under Options (shell.css).
const options = head?.querySelector('.dh-options');
const fold = (open) => {
  head?.classList.toggle('dh-open', open);
  options?.setAttribute('aria-expanded', String(open));
};
options?.addEventListener('click', () => fold(!head.classList.contains('dh-open')));
// Escape folds them from anywhere: Safari leaves the keys on the page, not on a button pressed.
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !head?.classList.contains('dh-open')) return;
  fold(false);
  options?.focus();
});
// A theme picked: the page again in it, on the theme's own skin.
document.getElementById('dh-theme')?.addEventListener('change', (event) => {
  const next = new URLSearchParams(params);
  next.delete('skin');
  if (event.target.value) next.set('theme', event.target.value);
  else next.delete('theme');
  location.search = next.toString();
});
// The heading and the tab name what is shown: the demo, as a page of the gallery; a page it opened, by its own name;
// else the page's own title, once the demo has it — never the framework that draws it.
function named(name) {
  // A designer names its tab after the page being made, as it is changed: the heading alone is the demo's.
  if (!demo?.ownTab) document.title = `${name} — Fieldia demos`;
  const title = head?.querySelector('.dh-title');
  if (title && !title.textContent) title.textContent = name;
}
if (demo || opened) named(demo?.name ?? opened.name);
else {
  let tries = 0;
  const look = () => {
    const page = window.fieldiaDemo?.handle?.form?.page ?? window.fieldiaDemo?.page;
    if (page?.title) named(page.title);
    else if (++tries < 100) setTimeout(look, 100);
    else named('A Fieldia page');
  };
  look();
}
if (visitor) {
  drawMenu();
  drawHowTo();
  drawCode();
}

// ---- what this tab saved, kept across the demo's own pages; and Start over ----------------------------------------
/** The prefix a demo keeps a model's records under in this tab (demos/shared/kept.ts: KEPT, and KEPT_EVENT below). */
const KEPT = 'fieldia-demo-records:';
const keptKeys = () => {
  try {
    return Object.keys(sessionStorage).filter((key) => key.startsWith(KEPT));
  } catch {
    return [];
  }
};
/** Start over, once something is saved: in its place in the try line, which the line held for it from the start. */
const showKept = () => head?.querySelector('.dh-start-over')?.toggleAttribute('data-none', keptKeys().length === 0);
showKept();
addEventListener('fieldia-demo-kept', showKept);
// The samples back, and the demo's own first page in the look it is worn in, on its clock: a record saved since is gone.
head?.querySelector('.dh-start-over')?.addEventListener('click', () => {
  for (const key of keptKeys()) {
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing kept can be taken away where nothing could be kept.
    }
  }
  const next = new URLSearchParams((demo ?? opened?.from)?.query ?? location.search.slice(1));
  for (const key of ['skin', 'theme', 'scheme', 'locale', 'dir', 'now']) if (params.get(key)) next.set(key, params.get(key));
  location.search = next.toString();
});

// ---- a theme's ground, the whole window's ---------------------------------------------------------------------------
/**
 * A theme paints its form on a ground of its own (its `--fd-page`): drawn as a box in the frame's page, a short page's
 * would stop mid-window over the frame's own, darker one. So the page round the form wears the theme's ground instead,
 * edge to edge, as an app in that theme is drawn; the header keeps its own. Read from the form as the theme comes
 * (its part loads as it is first worn), and again as the reader's scheme changes.
 */
function themeGround() {
  const app = document.getElementById('app');
  if (!app) return;
  const root = document.documentElement;
  /** Whether a colour, as rgb(), is a dark one: what a light scheme's words could not be read on. */
  const dark = (colour) => {
    const [r, g, b] = (colour.match(/[\d.]+/g) ?? []).map(Number);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128;
  };
  /** The frame's own page, in its scheme: what the words round the form (a log under it, a bar over it) are drawn for. */
  const framePage = () => {
    const probe = document.createElement('i');
    probe.style.background = 'var(--dh-page)';
    document.body.append(probe);
    const colour = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return colour;
  };
  const paint = () => {
    const form = app.querySelector('.fd-form[data-fd-theme]');
    const ground = form ? getComputedStyle(form).backgroundColor : '';
    // Only a ground of the frame's own kind, light on light or dark on dark: the words round the form stay readable
    // when a page asks its form for a scheme of its own.
    const on = !!ground && ground !== 'transparent' && !/^rgba\(.*,\s*0\)$/.test(ground) && dark(ground) === dark(framePage());
    root.classList.toggle('demo-themed', on);
    if (on) root.style.setProperty('--demo-ground', ground);
    else root.style.removeProperty('--demo-ground');
  };
  // Only these two names, of any element in the demo: what a theme and a scheme are worn by, never the typing.
  new MutationObserver(paint).observe(app, { subtree: true, attributes: true, attributeFilter: ['data-fd-theme', 'data-scheme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', paint);
  // And once the form is there, which may have worn its theme before it was put in the page.
  let tries = 0;
  const look = () => (app.querySelector('.fd-form') ? paint() : ++tries < 150 && setTimeout(look, 100));
  look();
}
if (FRAMEWORKS.some((f) => f.id === app)) themeGround();

// ---- a dialog's page, shown on its own ------------------------------------------------------------------------------
/**
 * A page made to open as a dialog — its own footer of buttons, as "Register a payment" — closes once its button's
 * steps have saved, handing what it made to the record it was opened from. Shown on its own here, nothing closes it:
 * a second press would make a second payment. So once its steps have saved, or its Cancel has asked to close, the
 * page gives way to what was done and a Start over; inside a dialog the page is never touched by this.
 */
function standingAlone(handle) {
  const page = handle?.form?.page;
  const app = document.getElementById('app');
  if (!page?.layout?.footer || !app) return;
  const said = [];
  let saved = false;
  let finishing = false;
  // What the app says as it answers: the payment it posted, the invoice it made.
  handle.on('action', ({ result }) => {
    const words = typeof result?.say === 'string' ? result.say : result?.say?.message;
    if (words) said.push(words);
  });
  handle.on('save', () => (saved = true));
  handle.on('send', () => (saved = true));
  handle.on('run', ({ steps, result }) => {
    if (finishing) return;
    const closes = steps.some((step) => step.do === 'close');
    if (result.done && saved) {
      finishing = true;
      // What runs once it is saved (the page's afterSave: the payment made) is waited for, and what it says kept.
      void handle.form.settled().then(() => finish(true, said));
    } else if (closes && !result.done && result.reason === 'cannot') {
      finishing = true;
      finish(false, []);
    } else said.length = 0;
    saved = false;
  });
  function finish(done, words) {
    const panel = document.createElement('section');
    panel.className = 'demo-done';
    panel.setAttribute('aria-labelledby', 'demo-done-h');
    panel.innerHTML = `
      <h2 id="demo-done-h" tabindex="-1">${done ? 'Done' : 'Cancelled'}</h2>
      ${(done ? (words.length ? words : ['Saved.']) : ['Nothing was made.']).map((w) => `<p class="demo-done-said">${esc(w)}</p>`).join('')}
      <p class="demo-done-note">${esc(done ? (demo?.done?.saved ?? 'In your app this window closes, and the record it was opened from shows what was done.') : (demo?.done?.cancelled ?? 'In your app this window closes, and the record it was opened from stays as it was.'))}</p>
      <button type="button" class="demo-done-again">Start over</button>`;
    app.hidden = true;
    app.after(panel);
    panel.querySelector('.demo-done-again').addEventListener('click', () => location.reload());
    panel.querySelector('h2').focus();
  }
}
// Taken the moment the demo hands over its handle (window.fieldiaDemo, set as the page is mounted): a poll left a tenth
// of a second in which the page's own Cancel ran with nothing to say what it did — a quick press after Start over did.
if (FRAMEWORKS.some((f) => f.id === app)) {
  let given = window.fieldiaDemo;
  const taken = new WeakSet();
  const take = (demo) => {
    if (!demo?.handle?.form || taken.has(demo.handle)) return;
    taken.add(demo.handle);
    standingAlone(demo.handle);
  };
  Object.defineProperty(window, 'fieldiaDemo', {
    configurable: true,
    enumerable: true,
    get: () => given,
    set(demo) {
      given = demo;
      take(demo);
    },
  });
  take(given);
}
