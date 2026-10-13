import { chatterSlot, historySlot } from '@fieldia/chatter';
import { isRightToLeft, localizePage, type ActionRequest, type ActionResult, type Facet, type JsonValue, type Locale, type Page, type RecordId } from '@fieldia/core';
import { mountViewer, openFormDialog, type FormDialogOptions, type FormDialogResult, type Tokens } from '@fieldia/viewer';
import { memoryPreferences } from '@fieldia/widgets';
import backlogJson from '../../examples/pages/backlog.page.json';
import bugJson from '../../examples/pages/work-item-bug.page.json';
import { backlogChatter, backlogData, me, recentPicks } from './data';

/**
 * A work tracker's backlog, drawn by the app's own HTML and CSS round a
 * Fieldia list; a bug opened from it in a large popup over the backlog, the
 * page dimmed by nothing. The address keeps the bug open (`?workitem=4127`),
 * so a reload opens it again, and closing gives the focus back to its row.
 * `?locale=ar|de|fr` and `?scheme=dark|light` say the language and the scheme.
 * Sample data, all of it invented.
 */

const params = new URLSearchParams(location.search);
const LOCALES = ['en', 'ar', 'de', 'fr'] as const;
type Language = (typeof LOCALES)[number];
const locale: Language = (LOCALES as readonly string[]).includes(params.get('locale') ?? '') ? (params.get('locale') as Language) : 'en';
const dir = isRightToLeft(locale) ? 'rtl' : 'ltr';
const scheme: 'light' | 'dark' = params.get('scheme') === 'dark' || (params.get('scheme') !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';

// ---- the look: the tracker's own colours, light and dark, worn by the list and the popup ---------------------------------

const FONT = '"Segoe UI", -apple-system, BlinkMacSystemFont, Roboto, "Helvetica Neue", Helvetica, Ubuntu, Arial, sans-serif';
/**
 * Measured from the tracker's screens; the dark set worked out from them. Muted words are a shade darker than
 * the screens' #7e7e7e, so they read at 4.5:1 on white and on the band (WCAG AA).
 */
const TOKENS: Record<'light' | 'dark', Tokens> = {
  light: {
    text: '#1a1a1a', muted: '#707070', page: '#ffffff', surface: '#ffffff', fill: '#f2f2f2', border: '#eaeaea', 'border-strong': '#7e7e7e',
    accent: '#0078d4', 'accent-text': '#ffffff', 'accent-soft': '#deecf9', focus: '#0078d4', 'focus-ring': 'none',
    link: '#005a9e', band: '#f8f8f8', help: '#f4f4f4', radius: '4px', 'control-radius': '2px', font: FONT,
  },
  dark: {
    text: '#f3f2f1', muted: '#a19f9d', page: '#252423', surface: '#252423', fill: '#3b3a39', border: '#3b3a39', 'border-strong': '#8a8886',
    accent: '#2899f5', 'accent-text': '#111111', 'accent-soft': '#0e2d4a', focus: '#2899f5', 'focus-ring': 'none',
    link: '#6cb8f6', band: '#2d2c2b', help: '#2d2c2b', radius: '4px', 'control-radius': '2px', font: FONT,
  },
};
/** The backlog's list sits on the page's grey; the popup is white. */
const LIST_PAGE = { light: '#f8f8f8', dark: '#1b1a19' };
const tokens = TOKENS[scheme];
const listTokens: Tokens = { ...tokens, page: LIST_PAGE[scheme] };
/** Each page in the reader's scheme, so the parts no token reaches follow it too. */
const inScheme = (page: Page): Page => ({ ...page, look: { ...page.look, scheme } });
const backlogPage = inScheme(backlogJson as unknown as Page);
const bugPage = inScheme(bugJson as unknown as Page);

// ---- the app's words: its chrome, in the four languages ----------------------------------------------------------------

const WORDS = {
  en: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Boards', backlogs: 'Backlogs', search: 'Search', language: 'Language', path: 'Where you are', menu: 'Project',
    overview: 'Overview', workItems: 'Work items', sprints: 'Sprints', queries: 'Queries', plans: 'Delivery Plans', analyticsViews: 'Analytics views', code: 'Code', builds: 'Builds', tests: 'Tests', packages: 'Packages', settings: 'Project settings', collapse: 'Collapse the menu',
    team: 'Portal Team', teams: 'Other teams', favourite: 'Add to favourites', members: 'Team members', newItem: 'New Work Item', asBoard: 'View as Board', columns: 'Column Options', more: 'More actions',
    backlog: 'Backlog', analytics: 'Analytics', views: 'Backlog views', level: 'Stories', viewOptions: 'View options', filter: 'Filter', backlogSettings: 'Settings', fullScreen: 'Full screen',
    notHere: 'Only the backlog and its bugs are in this demo.', me: 'Salma Nabil', bug: 'Bug',
  },
  ar: {
    org: 'Harbor Supply', project: 'Portal', boards: 'اللوحات', backlogs: 'قوائم الأعمال', search: 'بحث', language: 'اللغة', path: 'موقعك', menu: 'المشروع',
    overview: 'نظرة عامة', workItems: 'بنود العمل', sprints: 'الدورات', queries: 'الاستعلامات', plans: 'خطط التسليم', analyticsViews: 'طرق عرض التحليلات', code: 'الشيفرة', builds: 'البنايات', tests: 'الاختبارات', packages: 'الحزم', settings: 'إعدادات المشروع', collapse: 'طي القائمة',
    team: 'فريق Portal', teams: 'فرق أخرى', favourite: 'إضافة إلى المفضلة', members: 'أعضاء الفريق', newItem: 'بند عمل جديد', asBoard: 'عرض كلوحة', columns: 'خيارات الأعمدة', more: 'إجراءات أخرى',
    backlog: 'قائمة الأعمال', analytics: 'التحليلات', views: 'طرق عرض قائمة الأعمال', level: 'القصص', viewOptions: 'خيارات العرض', filter: 'تصفية', backlogSettings: 'الإعدادات', fullScreen: 'ملء الشاشة',
    notHere: 'لا يضم هذا العرض إلا قائمة الأعمال وأخطاءها.', me: 'سلمى نبيل', bug: 'خلل',
  },
  de: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Boards', backlogs: 'Backlogs', search: 'Suchen', language: 'Sprache', path: 'Wo Sie sind', menu: 'Projekt',
    overview: 'Übersicht', workItems: 'Arbeitselemente', sprints: 'Sprints', queries: 'Abfragen', plans: 'Lieferpläne', analyticsViews: 'Analyseansichten', code: 'Code', builds: 'Builds', tests: 'Tests', packages: 'Pakete', settings: 'Projekteinstellungen', collapse: 'Menü einklappen',
    team: 'Portal-Team', teams: 'Andere Teams', favourite: 'Zu Favoriten hinzufügen', members: 'Teammitglieder', newItem: 'Neues Arbeitselement', asBoard: 'Als Board anzeigen', columns: 'Spaltenoptionen', more: 'Weitere Aktionen',
    backlog: 'Backlog', analytics: 'Analyse', views: 'Backlog-Ansichten', level: 'Storys', viewOptions: 'Ansichtsoptionen', filter: 'Filter', backlogSettings: 'Einstellungen', fullScreen: 'Vollbild',
    notHere: 'In dieser Demo gibt es nur das Backlog und seine Fehler.', me: 'Salma Nabil', bug: 'Fehler',
  },
  fr: {
    org: 'Harbor Supply', project: 'Portal', boards: 'Tableaux', backlogs: 'Backlogs', search: 'Rechercher', language: 'Langue', path: 'Où vous êtes', menu: 'Projet',
    overview: 'Vue d’ensemble', workItems: 'Éléments de travail', sprints: 'Sprints', queries: 'Requêtes', plans: 'Plans de livraison', analyticsViews: 'Vues d’analyse', code: 'Code', builds: 'Builds', tests: 'Tests', packages: 'Packages', settings: 'Paramètres du projet', collapse: 'Replier le menu',
    team: 'Équipe Portal', teams: 'Autres équipes', favourite: 'Ajouter aux favoris', members: 'Membres de l’équipe', newItem: 'Nouvel élément de travail', asBoard: 'Afficher en tableau', columns: 'Options des colonnes', more: 'Autres actions',
    backlog: 'Backlog', analytics: 'Analyse', views: 'Vues du backlog', level: 'Récits', viewOptions: 'Options d’affichage', filter: 'Filtrer', backlogSettings: 'Paramètres', fullScreen: 'Plein écran',
    notHere: 'Cette démo ne contient que le backlog et ses bogues.', me: 'Salma Nabil', bug: 'Bogue',
  },
}[locale];

// ---- the app's chrome -------------------------------------------------------------------------------------------------------

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | undefined> = {}, ...children: (Node | string)[]) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) if (value !== undefined) element.setAttribute(key, value);
  element.append(...children);
  return element;
}
/** The app's own icons: lines in the words' colour, 16px. */
const ICON: Record<string, string> = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>',
  board: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M9 4v16M15 4v16"/>',
  items: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  backlog: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  sprint: '<path d="M4 17a8 8 0 0 1 16 0"/><path d="M12 17l4-5"/>',
  query: '<path d="M4 6h10M4 12h7M4 18h10"/><circle cx="17" cy="14" r="3"/><path d="M19.2 16.2L21 18"/>',
  plan: '<rect x="3" y="5" width="18" height="15" rx="1.5"/><path d="M3 10h18M8 14h4M10 17h6"/>',
  chart: '<path d="M4 20h16M7 20v-7M12 20V6M17 20v-10"/>',
  code: '<path d="M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5"/>',
  build: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3"/>',
  test: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3"/>',
  box: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  chevron: '<path d="M6 9l6 6 6-6"/>',
  collapse: '<path d="M11 6l-6 6 6 6M19 6l-6 6 6 6"/>',
  star: '<path d="M12 3l2.8 6 6.2.6-4.7 4.2 1.4 6.2L12 16.8 6.3 20l1.4-6.2L3 9.6 9.2 9z"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14.5c3 0 5.5 1.6 5.5 4.5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<circle cx="12" cy="12" r="9"/><path d="M10 8l4 4-4 4"/>',
  wrench: '<path d="M14.5 6.5a4 4 0 0 0 5 5L12 19a2.1 2.1 0 0 1-3-3z"/><path d="M14.5 6.5L17 4"/>',
  more: '<circle cx="12" cy="5" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="12" cy="19" r="1.3"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
  expand: '<path d="M14 4h6v6M20 4l-7 7M10 20H4v-6M4 20l7-7"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l5 5"/>',
  levels: '<path d="M4 6h16M8 12h12M12 18h8"/>',
};
const icon = (name: string) => {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', `bl-icon bl-icon-${name}`);
  svg.innerHTML = ICON[name] ?? '';
  return svg;
};

/** A press on a part of the tracker this demo does not have says so, in a note that goes by itself. */
const note = el('p', { class: 'bl-note', role: 'status' });
let noteTimer = 0;
function notHere() {
  note.textContent = WORDS.notHere;
  note.classList.add('bl-note-on');
  clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => note.classList.remove('bl-note-on'), 3200);
}
/** A button of the chrome: its icon and words, or its icon alone with its name and tooltip. */
function button(iconName: string | null, words: string, options: { iconOnly?: boolean; className?: string; onClick?: () => void } = {}) {
  const made = el('button', { type: 'button', class: options.className ?? 'bl-button', 'aria-label': options.iconOnly ? words : undefined, title: options.iconOnly ? words : undefined }, ...(iconName ? [icon(iconName)] : []), ...(options.iconOnly ? [] : [el('span', {}, words)]));
  made.addEventListener('click', options.onClick ?? notHere);
  return made;
}

const app = document.getElementById('app') as HTMLElement;
app.lang = locale;
app.dir = dir;
app.dataset['scheme'] = scheme;

// The bar across the top: where you are, a search box, the language and the person.
const languages = el('select', { class: 'bl-language', 'aria-label': WORDS.language }, ...[['en', 'English'], ['ar', 'العربية'], ['de', 'Deutsch'], ['fr', 'Français']].map(([value, name]) => el('option', { value, lang: value }, name)));
languages.value = locale;
languages.addEventListener('change', () => {
  const next = new URLSearchParams(location.search);
  if (languages.value === 'en') next.delete('locale');
  else next.set('locale', languages.value);
  location.search = next.toString();
});
const crumbs = [WORDS.org, WORDS.project, WORDS.boards, WORDS.backlogs];
const top = el(
  'div',
  { class: 'bl-top' },
  el('span', { class: 'bl-mark', 'aria-hidden': 'true' }),
  el('nav', { class: 'bl-crumbs', 'aria-label': WORDS.path }, el('ol', {}, ...crumbs.map((words, at) => el('li', {}, at === crumbs.length - 1 ? el('a', { href: '#', 'aria-current': 'page' }, words) : el('a', { href: '#' }, words))))),
  el('label', { class: 'bl-search' }, icon('search'), el('input', { type: 'search', placeholder: WORDS.search, 'aria-label': WORDS.search })),
  languages,
  el('span', { class: 'bl-me', role: 'img', 'aria-label': WORDS.me }, 'SN')
);
for (const a of top.querySelectorAll('.bl-crumbs a')) a.addEventListener('click', (event) => (event.preventDefault(), notHere()));

// The project's menu: its tile, then its parts, Boards open with Backlogs the page shown.
const navItem = (iconName: string, words: string, current = false, sub = false) => {
  const link = el('a', { href: '#', class: `bl-nav-item${sub ? ' bl-nav-sub' : ''}`, 'aria-current': current ? 'page' : undefined }, icon(iconName), el('span', {}, words));
  if (!current) link.addEventListener('click', (event) => (event.preventDefault(), notHere()));
  else link.addEventListener('click', (event) => event.preventDefault());
  return el('li', {}, link);
};
const nav = el(
  'nav',
  { class: 'bl-nav', 'aria-label': WORDS.menu },
  el('div', { class: 'bl-project' }, el('span', { class: 'bl-tile', 'aria-hidden': 'true' }, 'P'), el('span', {}, WORDS.project)),
  el(
    'ul',
    {},
    navItem('home', WORDS.overview),
    el('li', { class: 'bl-nav-group' }, el('a', { href: '#', class: 'bl-nav-item bl-nav-open' }, icon('board'), el('span', {}, WORDS.boards))),
    navItem('items', WORDS.workItems, false, true),
    navItem('board', WORDS.boards, false, true),
    navItem('backlog', WORDS.backlogs, true, true),
    navItem('sprint', WORDS.sprints, false, true),
    navItem('query', WORDS.queries, false, true),
    navItem('plan', WORDS.plans, false, true),
    navItem('chart', WORDS.analyticsViews, false, true),
    navItem('code', WORDS.code),
    navItem('build', WORDS.builds),
    navItem('test', WORDS.tests),
    navItem('box', WORDS.packages)
  ),
  el('div', { class: 'bl-nav-foot' }, el('a', { href: '#', class: 'bl-nav-item' }, icon('gear'), el('span', {}, WORDS.settings)), button('collapse', WORDS.collapse, { iconOnly: true, className: 'bl-tool' }))
);
nav.querySelector('.bl-nav-open')?.addEventListener('click', (event) => (event.preventDefault(), notHere()));
nav.querySelector('.bl-nav-foot a')?.addEventListener('click', (event) => (event.preventDefault(), notHere()));

// The page's head: the team, its buttons, and the backlog's pivots with its tools at the end.
const newItem = button('plus', WORDS.newItem, { onClick: () => void openBug(null) });
const head = el(
  'div',
  { class: 'bl-head' },
  el(
    'div',
    { class: 'bl-head-row' },
    el('span', { class: 'bl-head-icon', 'aria-hidden': 'true' }, icon('levels')),
    el('h1', { class: 'bl-team' }, WORDS.team),
    button('chevron', WORDS.teams, { iconOnly: true, className: 'bl-tool' }),
    button('star', WORDS.favourite, { iconOnly: true, className: 'bl-tool bl-star' }),
    button('people', WORDS.members, { iconOnly: true, className: 'bl-tool' }),
    el('div', { class: 'bl-actions' }, newItem, button('arrow', WORDS.asBoard), button('wrench', WORDS.columns), button('more', WORDS.more, { iconOnly: true, className: 'bl-tool' }))
  ),
  el(
    'div',
    { class: 'bl-pivots-row' },
    el('nav', { class: 'bl-pivots', 'aria-label': WORDS.views }, el('a', { href: '#', 'aria-current': 'page' }, WORDS.backlog), el('a', { href: '#' }, WORDS.analytics)),
    el(
      'div',
      { class: 'bl-tools' },
      el('button', { type: 'button', class: 'bl-level' }, icon('levels'), el('span', {}, WORDS.level), icon('chevron')),
      button('sliders', WORDS.viewOptions, { iconOnly: true, className: 'bl-tool' }),
      button('filter', WORDS.filter, { iconOnly: true, className: 'bl-tool' }),
      button('gear', WORDS.backlogSettings, { iconOnly: true, className: 'bl-tool' }),
      button('expand', WORDS.fullScreen, { iconOnly: true, className: 'bl-tool' })
    )
  )
);
head.querySelector('.bl-level')?.addEventListener('click', notHere);
for (const a of head.querySelectorAll('.bl-pivots a')) a.addEventListener('click', (event) => (event.preventDefault(), a.getAttribute('aria-current') ? undefined : notHere()));

const listHost = el('div', { class: 'bl-list' });
app.append(top, el('div', { class: 'bl-frame' }, nav, el('main', { class: 'bl-page' }, head, listHost)), note);

// ---- what the person keeps: the backlog's default filter, and their latest Area and Iteration picks ----------------------

const preferences = memoryPreferences();
/** A choice of the backlog picked in its filter bar, in the reader's language. */
const shownBacklog = localizePage(backlogPage, locale);
const picked = (field: string, value: string): Facet => {
  const def = shownBacklog.fields[field];
  const label = def.type === 'selection' ? (def.options.find((option) => option.value === value)?.label ?? value) : value;
  return { kind: 'field', field, label: def.label, values: [{ op: '=', value, label }] };
};
// The backlog opens on the active bugs, as the team keeps it: the person's default search.
preferences.set('favourites:backlog', [{ name: 'Active bugs', isDefault: true, facets: [picked('work_type', 'bug'), picked('state', 'active')] }] as unknown as JsonValue);
for (const [key, picks] of Object.entries(recentPicks)) preferences.set(key, picks as unknown as JsonValue);

// ---- the list --------------------------------------------------------------------------------------------------------------

const dataSource = backlogData();
const chatter = backlogChatter();
const list = mountViewer(listHost, {
  page: backlogPage,
  dataSource,
  locale: locale as Locale,
  dir,
  tokens: listTokens,
  preferences,
  // A row opens its bug in the popup; the list asks again once it closes, and its row takes the focus back.
  onOpenRecord: (id) => openBug(id),
});

// ---- the bug, in a large popup over the backlog --------------------------------------------------------------------------

/** The person following each bug, as the server keeps it. */
const following = new Set<RecordId>();

/** The app's answers to the bug's buttons: Follow and its notification settings, Copy link. */
async function answer(request: ActionRequest): Promise<ActionResult | void> {
  const id = request.recordId;
  if (id === null) return;
  if (request.action === 'follow' || request.action === 'follow-all' || request.action === 'follow-state') {
    // Follow toggles; a notification setting follows the bug. Kept by the server, so the record has no change to save.
    if (request.action === 'follow' && following.has(id)) following.delete(id);
    else following.add(id);
    return { stored: { following: following.has(id) } };
  }
  if (request.action === 'copy-link') {
    const address = new URL(location.href);
    address.searchParams.set('workitem', String(id));
    await navigator.clipboard?.writeText(address.href).catch(() => undefined);
    return { say: address.href };
  }
}

/** The words in the empty comment box, and what # and ! link, in the reader's language. */
const COMMENTING = {
  en: { hint: 'Add a comment. Use # to link a work item, @ to mention a person, or ! to link a pull request.', item: 'work item', pull: 'pull request' },
  ar: { hint: 'أضف تعليقًا. استخدم # لربط عنصر عمل، و@ للإشارة إلى شخص، و! لربط طلب سحب.', item: 'عنصر عمل', pull: 'طلب سحب' },
  de: { hint: 'Kommentar hinzufügen. Mit # verknüpfen Sie ein Arbeitselement, mit @ erwähnen Sie eine Person, mit ! verknüpfen Sie einen Pull Request.', item: 'Arbeitselement', pull: 'Pull Request' },
  fr: { hint: 'Ajoutez un commentaire. Utilisez # pour lier un élément de travail, @ pour mentionner une personne ou ! pour lier une demande de tirage.', item: 'un élément de travail', pull: 'une demande de tirage' },
}[locale];

/** Records a comment links by their key, found in the demo's data. */
const find = (model: string) => async (query: string) => (await dataSource.search?.({ model, query, limit: 8 })) ?? [];

/** The popup's slots: the bug's discussion, and its history. */
function slots() {
  return {
    discussion: chatterSlot({
      look: 'discussion',
      source: chatter,
      me,
      placeholder: COMMENTING.hint,
      references: [
        { key: '#', model: 'work.item', label: COMMENTING.item, icon: 'hash', search: find('work.item') },
        { key: '!', model: 'pull.request', label: COMMENTING.pull, icon: 'pull-request', search: find('pull.request') },
      ],
      locale: locale as Locale,
      dir,
      // The comment count in the head follows the comments, kept as the server has it: no change to save.
      onCount: (count, form) => form.setValues({ comment_count: count }, { stored: true }),
    }),
    history: historySlot({ source: chatter, stateField: 'state', reasonField: 'reason', kind: 'work item', locale: locale as Locale, dir }),
  };
}

/** The popup's shape: a large window over the backlog, nothing dimmed, that can fill the window and be resized. */
const POPUP: Pick<FormDialogOptions, 'size' | 'backdrop' | 'maximise' | 'resizable'> = { size: 'inset', backdrop: 'clear', maximise: true, resizable: true };

/** The bug in the address while it is open, so a reload opens it again. */
function remember(id: RecordId | null) {
  const next = new URLSearchParams(location.search);
  if (id === null) next.delete('workitem');
  else next.set('workitem', String(id));
  const query = next.toString();
  history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`);
}

let opened: Promise<FormDialogResult> | null = null;
/** Open a bug in the popup, or a new one for null; the list asks again once a new one is saved. */
async function openBug(id: RecordId | null): Promise<FormDialogResult | null> {
  if (opened) return null;
  remember(id);
  const title = localizePage(bugPage, locale).title ?? WORDS.bug;
  opened = openFormDialog({
    ...POPUP,
    page: bugPage,
    recordId: id,
    title: id === null ? title : `${title} ${id}`,
    dataSource,
    locale: locale as Locale,
    dir,
    tokens,
    preferences,
    slots: slots(),
    onAction: answer,
  });
  try {
    const result = await opened;
    if (id === null && result.saved) await list.reload();
    return result;
  } finally {
    opened = null;
    remember(null);
  }
}

// A bug in the address opens as the page does; closed, its row has the focus.
const asked = Number(params.get('workitem'));
if (Number.isInteger(asked) && asked > 0) {
  void openBug(asked).then(async () => {
    await list.reload();
    document.querySelector<HTMLElement>(`.fd-list-row[data-id="${asked}"]`)?.focus();
  });
}

Object.assign(window, { fieldiaDemo: { handle: list, page: backlogPage, bugPage, dataSource, chatter, preferences, following } });
