import { createMemoryDataSource, localizePage, type Page, type RecordId, type ResolvedFilter, type SelectionField, type Values } from '@fieldia/core';
import { mountListMap, openStreetMap, type MapSearch } from '@fieldia/map';
import homesPage from '../../examples/pages/homes-for-sale.page.json';
import { sampleHomes } from '../shared/homes';

/**
 * A page that is not Fieldia's: homes for sale, with the page's own bar,
 * its own list, its own filter and its own address, and Fieldia's map of the
 * same homes beside the list (`mountListMap`). The map fills its column,
 * takes every gesture, opens where the address says (`?at=lat,lng,zoom`),
 * writes where it stands back into it, and says how many homes a view holds
 * before "Search this area" is pressed. Sample data.
 */

const params = new URLSearchParams(location.search);
const locale = params.get('locale') === 'ar' ? 'ar' : 'en';
const page = homesPage as unknown as Page;
const dataSource = createMemoryDataSource({ records: { home: sampleHomes() } });

// ---- the page's own words -------------------------------------------------------------------------

type Plural = { other: string } & Partial<Record<Intl.LDMLPluralRule, string>>;
const WORDS = {
  en: {
    title: { sale: 'Homes for sale', rent: 'Homes to rent' },
    homes: { one: '# home', other: '# homes' } as Plural,
    bedrooms: { one: '# bedroom', other: '# bedrooms' } as Plural,
    offer: 'Offer',
    sale: 'For sale',
    rent: 'To rent',
    perMonth: 'a month',
    searches: 'Searches',
    remove: 'Take away',
    kinds: { view: 'In this area', drawn: 'In the area drawn', region: 'In an area' },
    other: 'العربية',
    empty: 'No homes here. Move the map, or take a search away.',
  },
  ar: {
    title: { sale: 'منازل للبيع', rent: 'منازل للإيجار' },
    homes: { zero: 'لا منازل', one: 'منزل واحد', two: 'منزلان', few: '# منازل', many: '# منزلًا', other: '# منزل' } as Plural,
    bedrooms: { zero: 'بلا غرف نوم', one: 'غرفة نوم واحدة', two: 'غرفتا نوم', few: '# غرف نوم', many: '# غرفة نوم', other: '# غرفة نوم' } as Plural,
    offer: 'العرض',
    sale: 'للبيع',
    rent: 'للإيجار',
    perMonth: 'شهريًا',
    searches: 'عمليات البحث',
    remove: 'إزالة',
    kinds: { view: 'في هذه المنطقة', drawn: 'في المنطقة المرسومة', region: 'في منطقة' },
    other: 'English',
    empty: 'لا منازل هنا. حرّك الخريطة، أو أزِل بحثًا.',
  },
}[locale];
const rules = new Intl.PluralRules(locale);
const counted = (forms: Plural, n: number) => (forms[rules.select(n)] ?? forms.other).replace('#', String(n));
/** A price in the home's own currency: most in pounds, a few in dollars, as their owners ask. */
const formats = new Map<string, Intl.NumberFormat>();
const money = (amount: number, currency: string) => {
  let format = formats.get(currency);
  if (!format) formats.set(currency, (format = new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en', { style: 'currency', currency, maximumFractionDigits: 0 })));
  // A symbol kept whole on a right-to-left page, in its own first letter's direction: "US$", never "$US".
  return format
    .formatToParts(amount)
    .map((part) => (part.type === 'currency' && locale === 'ar' ? `\u2068${part.value}\u2069` : part.value))
    .join('');
};
/** About fifty pounds to the dollar, as the sample prices its homes: the page's own list, cheapest first, across both. */
const inPounds = (values: Values) => Number(values['price']) * (values['currency'] === 'USD' ? 50 : 1);
// The districts' names in the page's language, as the page keeps them.
const districts = (localizePage(page, locale).fields['district'] as SelectionField).options ?? [];

// ---- what is searched: the page's own offer, and the areas the map asked for ------------------------

let offer: 'sale' | 'rent' = params.get('offer') === 'rent' ? 'rent' : 'sale';
/** One search of each kind at a time, a new one in the last one's place: "In this area", "In the area drawn". */
const searches = new Map<MapSearch['kind'], MapSearch>();
const filter = (): ResolvedFilter[] => [{ field: 'offer', op: '=', value: offer }, ...[...searches.values()].flatMap((search) => search.filter)];
const sort = [{ field: 'price' }];

// ---- the page's address: where the map stands, the offer, and an area searched ---------------------

const at = (params.get('at') ?? '').split(',').map(Number);
const start = at.length === 3 && at.every(Number.isFinite) ? { center: { lat: at[0], lng: at[1] }, zoom: at[2] } : undefined;
const area = (params.get('area') ?? '').split(',').map(Number);
if (area.length === 4 && area.every(Number.isFinite)) {
  const [south, west, north, east] = area;
  searches.set('view', { kind: 'view', label: WORDS.kinds.view, filter: [{ field: 'lat', op: 'between', value: [south, north] }, { field: 'lng', op: 'between', value: [west, east] }] });
}
/** The edges of the area searched, from its conditions, for the address. */
function areaOf(search: MapSearch | undefined): string | null {
  const range = (field: string) => search?.filter.find((item) => 'field' in item && item.field === field && item.op === 'between')?.value as number[] | undefined;
  const [lat, lng] = [range('lat'), range('lng')];
  return lat && lng ? [lat[0], lng[0], lat[1], lng[1]].join(',') : null;
}
/** The address as the page stands, kept in its place: Back leaves the page rather than walking back each move. */
function remember(view?: string) {
  params.set('offer', offer);
  if (view) params.set('at', view);
  const searched = areaOf(searches.get('view'));
  if (searched) params.set('area', searched);
  else params.delete('area');
  history.replaceState(null, '', `?${params}`);
  const other = new URLSearchParams(params);
  if (locale === 'ar') other.delete('locale');
  else other.set('locale', 'ar');
  language.href = `?${other}`;
}

// ---- the page --------------------------------------------------------------------------------------

const app = document.getElementById('app') as HTMLElement;
app.lang = locale;
app.dir = locale === 'ar' ? 'rtl' : 'ltr';
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, ...children: (Node | string)[]) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  element.append(...children);
  return element;
}
const title = el('h2', { class: 'hs-title' });
const count = el('p', { class: 'hs-count', role: 'status' });
const offers = (['sale', 'rent'] as const).map((value) => {
  const button = el('button', { type: 'button', 'data-offer': value }, WORDS[value]);
  button.addEventListener('click', () => {
    offer = value;
    remember();
    void findHomes();
  });
  return button;
});
const chips = el('ul', { class: 'hs-chips', 'aria-label': WORDS.searches });
const language = el('a', { class: 'hs-lang', lang: locale === 'ar' ? 'en' : 'ar' }, WORDS.other);
const list = el('ol', { class: 'hs-list' });
const holder = el('div', { class: 'hs-map' });
app.append(
  el('div', { class: 'hs-bar' }, title, count, el('div', { class: 'hs-offer', role: 'group', 'aria-label': WORDS.offer }, ...offers), chips, language),
  el('div', { class: 'hs-body' }, list, holder)
);
remember();
// The list and the map as tall as the window leaves them, under whatever stands above.
const fitHeight = () => app.style.setProperty('--hs-top', `${Math.round((app.querySelector('.hs-body') as HTMLElement).getBoundingClientRect().top + scrollY)}px`);
addEventListener('resize', fitHeight);
fitHeight();

// ---- the map ------------------------------------------------------------------------------------------

const map = mountListMap(holder, {
  page,
  provider: openStreetMap(),
  dataSource,
  locale,
  filter,
  sort,
  ...(start ? { start } : {}),
  // When the homes on hand cannot say how many a view holds, the source counts them: "Search this area (24)".
  countArea: true,
  onSearch(asked) {
    searches.set(asked.kind, asked);
    remember();
    void findHomes();
  },
  onViewChange: ({ center, zoom }) => remember(`${center.lat.toFixed(5)},${center.lng.toFixed(5)},${zoom}`),
  onHighlight: (id) => light(id),
  onOpenRecord: (id) => openHome(id),
});

// ---- the page's own list, from the same source and the same search -------------------------------

/** The homes the search finds, in the page's list; then the map, again, unless it is the first time (it loads itself). */
async function findHomes(first = false) {
  for (const button of offers) button.setAttribute('aria-pressed', String(button.dataset['offer'] === offer));
  title.textContent = WORDS.title[offer];
  drawChips();
  const found = await dataSource.list({ model: 'home', fields: ['name', 'offer', 'price', 'currency', 'bedrooms', 'area_m2', 'district', 'photo'], filter: filter(), sort, offset: 0, limit: 200 });
  const records = [...found.records].sort((a, b) => inPounds(a.values) - inPounds(b.values));
  count.textContent = counted(WORDS.homes, found.total);
  list.replaceChildren(...records.map(({ id, values }) => row(id, values)));
  if (!records.length) list.append(el('li', { class: 'hs-empty' }, WORDS.empty));
  if (!first) await map.reload();
}

function row(id: RecordId, values: Values) {
  const photo = values['photo'] as { url?: string } | null;
  const price = money(Number(values['price']), String(values['currency'] ?? 'EGP')) + (values['offer'] === 'rent' ? ` ${WORDS.perMonth}` : '');
  const district = districts.find((option) => option.value === values['district'])?.label ?? '';
  // A home's name in its own direction, as it was written: an English name reads as typed on an Arabic page.
  const name = el('a', { href: `#home-${id}`, dir: 'auto' }, String(values['name']));
  // An area left to right inside a line right to left: "126 m²", never "m² 126".
  const details = [counted(WORDS.bedrooms, Number(values['bedrooms'])), `\u2066${values['area_m2']} m²\u2069`, district].join(' · ');
  const home = el(
    'li',
    { class: 'hs-home', id: `home-${id}`, 'data-id': String(id), tabindex: '-1' },
    el('img', { src: photo?.url ?? '', alt: '', loading: 'lazy' }),
    el('div', {}, el('p', { class: 'hs-price' }, price), el('p', { class: 'hs-name' }, name), el('p', { class: 'hs-details' }, details))
  );
  // A home pointed at, or its name focused, lights its pin on the map.
  home.addEventListener('mouseenter', () => map.highlight(id));
  home.addEventListener('mouseleave', () => map.highlight(null));
  name.addEventListener('focus', () => map.highlight(id));
  name.addEventListener('blur', () => map.highlight(null));
  name.addEventListener('click', (event) => {
    event.preventDefault();
    openHome(id);
  });
  return home;
}

/** The areas the map asked for, each with a button to take it away. */
function drawChips() {
  chips.replaceChildren(
    ...[...searches.values()].map((search) => {
      const label = search.label || WORDS.kinds[search.kind];
      const remove = el('button', { type: 'button', 'aria-label': `${WORDS.remove}: ${label}` }, '×');
      remove.addEventListener('click', () => {
        searches.delete(search.kind);
        remember();
        void findHomes();
      });
      return el('li', { class: 'hs-chip' }, label, remove);
    })
  );
}

/**
 * Whether the pointer on the map presses: a finger's, or a mouse's held down. A pin a finger taps is lit by the tap (a
 * finger has no hover: the browser sends its mouseover with the tap, before its click), and a pin a mouse presses by
 * its focus; were its home scrolled into view then, the page would move under the press and its click land on what
 * came there — a home's name, opening that home. So a press's light lights the home where it is.
 */
let pressing = false;
const track = (event: PointerEvent) => {
  pressing = event.pointerType === 'touch' || event.type === 'pointerdown' || (event.type === 'pointerover' && event.buttons !== 0);
};
for (const type of ['pointerover', 'pointerdown', 'pointerup'] as const) holder.addEventListener(type, track);

/** A pin under the pointer: its home lit in the list — scrolled into view by a mouse resting on it, or the keys. */
function light(id: RecordId | null) {
  for (const home of list.querySelectorAll<HTMLElement>('.hs-home')) {
    const lit = id !== null && home.dataset['id'] === String(id);
    home.classList.toggle('is-lit', lit);
    if (lit && !pressing) home.scrollIntoView({ block: 'nearest' });
  }
}

/** A card's Open, or a home's name: the page shows that home (here, marked in its list). */
function openHome(id: RecordId) {
  for (const home of list.querySelectorAll<HTMLElement>('.hs-home')) {
    if (home.dataset['id'] !== String(id)) {
      home.removeAttribute('aria-current');
      continue;
    }
    home.setAttribute('aria-current', 'true');
    home.scrollIntoView({ block: 'nearest' });
    home.focus({ preventScroll: true });
  }
}

void findHomes(true);
(window as unknown as { fieldiaDemo: unknown }).fieldiaDemo = { page, map, dataSource, searches };
