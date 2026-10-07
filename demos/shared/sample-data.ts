import { createMemoryDataSource, type FormUser, type Line, type Page, type Values } from '@fieldia/core';
import type { PageRequest } from '@fieldia/viewer';
import address from '../../examples/pages/address.page.json';
import delivery from '../../examples/pages/delivery.page.json';
import customer from '../../examples/pages/customer.page.json';
import fields from '../../examples/pages/fields.page.json';
import kinds from '../../examples/pages/kinds.page.json';
import layout from '../../examples/pages/layout.page.json';
import lists from '../../examples/pages/lists.page.json';
import customers from '../../examples/pages/customers.page.json';
import order from '../../examples/pages/order.page.json';
import quickOrder from '../../examples/pages/quick-order.page.json';
import newCustomer from '../../examples/pages/new-customer.page.json';
import rules from '../../examples/pages/rules.page.json';
import signup from '../../examples/pages/signup.page.json';
import survey from '../../examples/pages/survey.page.json';
import big from '../../examples/pages/big.page.json';
import reading from '../../examples/pages/reading.page.json';
import { customPage } from './custom-page';
import { BILLS, billAttachments, billNavigation, vendorBill } from './vendor-bill';
import { real } from './real';
import { businessData, businessPage } from './business';

/** The example pages every demo can show, by name. */
export const pages: Record<string, Page> = {
  signup: signup as Page,
  survey: survey as Page,
  customer: customer as Page,
  customers: customers as Page,
  fields: fields as Page,
  kinds: kinds as Page,
  // The business widgets on one task: shared/business.ts.
  business: businessPage,
  order: order as Page,
  rules: rules as Page,
  layout: layout as Page,
  lists: lists as Page,
  custom: customPage,
  // Places the saved Address form twice: see `savedForms`.
  delivery: delivery as Page,
  // Its buttons and moments run steps: a page opened by its id (see `openedPages`), the app's answers (shared/order-desk.ts).
  'quick-order': quickOrder as Page,
  // 500 fields, for timing: e2e/perf.spec.ts opens it; no card in the gallery (see e2e/demos-shell.spec.ts).
  big: big as Page,
  // How a dense sheet reads, as Flectra's: values as words, formatted stat buttons, links with pictures, lines, alerts, keys, ribbons.
  reading: reading as Page,
  // What sits around a record: the gear menu, the pager and breadcrumbs, the PDF beside it (shared/vendor-bill.ts).
  'vendor-bill': vendorBill,
  // Sherkety ERP's own screens, rebuilt: one file per lane in shared/real/.
  ...real.pages,
};

/**
 * The page the query string names, with the page-wide choices it may also make:
 * `maxWidth` (narrow, medium, wide, full), `actions` (top, bottom) and `scheme`
 * (light, dark, auto). The viewer shows it in the query's `locale`, in the
 * page's own words when it keeps them in that language.
 */
export function pageFromQuery(params: URLSearchParams): Page {
  const page = pages[params.get('page') ?? 'signup'] ?? pages['signup'];
  const maxWidth = params.get('maxWidth');
  const actions = params.get('actions');
  const scheme = params.get('scheme') as NonNullable<Page['look']>['scheme'] | null;
  // A look for each kind of part, as JSON: `parts={"inputs":{"corners":"round"}}`.
  const parts = params.get('parts');
  return {
    ...page,
    ...(maxWidth ? { maxWidth: maxWidth as Page['maxWidth'] } : {}),
    ...(actions ? { actionsPosition: actions as Page['actionsPosition'] } : {}),
    ...(scheme || parts ? { look: { ...page.look, ...(scheme ? { scheme } : {}), ...(parts ? { parts: JSON.parse(parts) } : {}) } } : {}),
  };
}

/** The record a record's page opens: `record=…`, or the first one. A list shows many, and opens none. */
export function recordFromQuery(params: URLSearchParams, page: Page): number | null {
  if (page.data.kind !== 'record' || page.layout.type === 'list') return null;
  return Number(params.get('record') ?? 1);
}

/** A list's row opens its record on the customer's own page, keeping the skin, language and direction. */
export function openRecord(params: URLSearchParams, id: string | number): void {
  const next = new URLSearchParams(params);
  next.set('page', 'customer');
  next.set('record', String(id));
  location.search = next.toString();
}

/**
 * Viewer choices the query string may make: `enterToNext=1` makes Enter move to
 * the next field, `showValid=1` puts a ✓ by each field filled in right, and
 * `saveStatus=toast` or `bar` moves the save's progress, `readonly=1` locks the
 * whole form, `editSwitch=1` adds Edit and Done, and `translate=fr` shows the
 * sign-up in French through an app's own catalog.
 */
export function optionsFromQuery(params: URLSearchParams): {
  records?: (string | number)[];
  breadcrumbs?: { label: string; href?: string }[];
  keys?: { enterMovesToNext: boolean };
  showValid?: boolean;
  saveStatus?: 'inline' | 'toast' | 'bar';
  readonly?: boolean;
  editSwitch?: boolean;
  translate?: (text: string) => string;
  user?: FormUser;
} {
  const saveStatus = params.get('saveStatus');
  return {
    ...realOptions(params),
    // The vendor bill has the records round it and the trail to it, as an app gives them.
    ...(params.get('page') === 'vendor-bill' ? billNavigation() : {}),
    ...(params.get('translate') === 'fr' ? { translate: (text: string) => APP_CATALOG_FR[text] ?? text } : {}),
    ...(params.get('readonly') === '1' ? { readonly: true } : {}),
    ...(params.get('editSwitch') === '1' ? { editSwitch: true } : {}),
    ...(params.get('enterToNext') === '1' ? { keys: { enterMovesToNext: true } } : {}),
    ...(params.get('showValid') === '1' ? { showValid: true } : {}),
    ...(saveStatus === 'toast' || saveStatus === 'bar' ? { saveStatus } : {}),
  };
}

/**
 * A real page's person and the list round its record, as the app gives them.
 * `roles=` names the roles held instead, comma-separated — empty for none —
 * to see the page as someone without a manager's groups.
 */
function realOptions(params: URLSearchParams): { user?: FormUser; records?: (string | number)[]; breadcrumbs?: { label: string; href?: string }[] } {
  const id = params.get('page') ?? '';
  const user = real.users[id];
  const roles = params.get('roles');
  return {
    ...(user ? { user: roles === null ? user : { ...user, roles: roles.split(',').filter(Boolean) } } : {}),
    ...(real.navigation[id] ?? {}),
  };
}

/** An app's own catalog, as an app keeps it: the sign-up's words in French. */
const APP_CATALOG_FR: Record<string, string> = {
  'Workshop sign-up': 'Inscription à l’atelier',
  'One day on building forms that people finish. Cairo, 14 November.': 'Une journée pour construire des formulaires que l’on termine. Le Caire, 14 novembre.',
  'About you': 'À propos de vous',
  'Full name': 'Nom complet',
  Email: 'E-mail',
  'We send the joining details here.': 'Nous envoyons ici les détails pour nous rejoindre.',
  Company: 'Entreprise',
  'Your role': 'Votre rôle',
  Developer: 'Développeur',
  Designer: 'Designer',
  Manager: 'Manager',
  'Something else': 'Autre chose',
};

/** The pages records of other models open in, in a dialog: a customer from a link to it. */
export const relatedPages: Record<string, Page> = { partner: customer as Page, ...real.related };

/** The app's saved forms, placed in other pages by their id: the Address form, twice in Delivery details. */
export const savedForms: Record<string, Page> = { address: address as Page };

/** The pages a step opens by their id: a new customer in a side panel, and a customer's record in the order's place. */
export const openedPages: Record<string, Page> = { 'new-customer': newCustomer as Page, customer: customer as Page, ...real.opened };

/**
 * The app's pages, as the viewer's `pages` asks for them: a linked record's
 * page at once, by its model; a saved form, or a page a step opens, by its id
 * a moment later, as an app fetching it from its server would — a saved
 * form's place shows a quiet placeholder first. `?pagesDelay=` sets the
 * moment, in ms.
 */
export function appPages(request: PageRequest): Page | null | Promise<Page | null> {
  if ('model' in request) return relatedPages[request.model] ?? null;
  const key = request.version === undefined ? request.id : `${request.id}@${request.version}`;
  const found = savedForms[key] ?? openedPages[key] ?? null;
  const delay = Number(new URLSearchParams(location.search).get('pagesDelay') ?? 150);
  return new Promise((resolve) => setTimeout(() => resolve(found), delay));
}

const PRODUCT_PRICES: Record<number, number> = { 1: 1890, 2: 380, 3: 749, 4: 6425, 5: 215 };
const round = (n: number) => Math.round(n * 100) / 100;

/** What a server's onchange does for a sales order, in a few lines: prices, subtotals, totals. */
export function recalculateOrder(values: Values): Values {
  const lines = ((values['line_ids'] as Line[] | null) ?? []).map((line) => {
    if (line.values['display_type']) return line; // a section or a note has nothing to price
    const v = { ...line.values };
    const product = v['product_id'] as { id: number; label: string } | null;
    if (product && !v['price']) {
      v['price'] = PRODUCT_PRICES[product.id] ?? 0;
      if (!v['name']) v['name'] = product.label;
    }
    if (v['qty'] == null && product) v['qty'] = 1;
    v['subtotal'] = round(Number(v['qty'] ?? 0) * Number(v['price'] ?? 0) * (1 - Number(v['discount'] ?? 0) / 100));
    return { ...line, values: v };
  });
  const untaxed = round(lines.reduce((sum, l) => sum + Number(l.values['subtotal'] ?? 0), 0));
  const tax = round(lines.filter((l) => l.values['taxed']).reduce((sum, l) => sum + Number(l.values['subtotal'] ?? 0) * 0.14, 0));
  return { line_ids: lines, amount_untaxed: untaxed, amount_tax: tax, amount_total: round(untaxed + tax) };
}

const COUNTRIES: Record<number, string> = { 1: 'Egypt', 2: 'Jordan', 3: 'Saudi Arabia' };

/** The app's own lists of choices, as a server keeps them: the countries delivered to, and each one's cities. */
const DELIVERY: Record<string, { label: string; cities: Record<string, string> }> = {
  eg: { label: 'Egypt', cities: { cairo: 'Cairo', giza: 'Giza', alexandria: 'Alexandria', luxor: 'Luxor' } },
  jo: { label: 'Jordan', cities: { amman: 'Amman', irbid: 'Irbid', aqaba: 'Aqaba' } },
  sa: { label: 'Saudi Arabia', cities: { riyadh: 'Riyadh', jeddah: 'Jeddah', dammam: 'Dammam' } },
  ae: { label: 'United Arab Emirates', cities: { dubai: 'Dubai', 'abu-dhabi': 'Abu Dhabi', sharjah: 'Sharjah' } },
};
/** A list answers after a moment, as one from a server does, so its loading shows. */
const LIST_DELAY_MS = 600;
const later = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(value), LIST_DELAY_MS));
const appLists = {
  countries: () => later(Object.entries(DELIVERY).map(([value, { label }]) => ({ value, label }))),
  cities: (values: Values) => later(Object.entries(DELIVERY[values['country'] as string]?.cities ?? {}).map(([value, label]) => ({ value, label }))),
};
/** The app's lists as a designer offers them: the name the data source answers to, and the words a person picks it by. */
export const APP_LISTS = [
  { name: 'countries', label: 'Countries delivered to' },
  { name: 'cities', label: 'Cities of the country' },
];
/** The same lists, named in Arabic, for the designer demos in Arabic (`?locale=ar`). */
export const APP_LISTS_AR = [
  { name: 'countries', label: 'دول التوصيل' },
  { name: 'cities', label: 'مدن الدولة' },
];
const CURRENCIES: Record<number, string> = { 1: 'EGP', 2: 'JOD', 3: 'SAR' };

/** A customer to edit, and the records its relations point to. Sample data. */
export function sampleDataSource() {
  return createMemoryDataSource(withReal({
    lists: appLists,
    attachments: billAttachments(),
    // What links show of their records besides their names: an address, a picture, a colour.
    shows: { 'reading.partner': { details: ['street', 'city', 'vat'] }, 'reading.user': { avatar: 'image' }, 'reading.tag': { color: 'color' } },
    records: {
      ...READING,
      'account.move': BILLS,
      partner: {
        1: {
          name: 'Nile Traders',
          is_company: true,
          company_type: 'company',
          state: 'active',
          email: 'orders@niletraders.example',
          phone: '+20 2 2345 6789',
          website: null,
          country_id: { id: 1, label: 'Egypt' },
          tag_ids: [{ id: 10, label: 'Wholesale' }],
          child_ids: [{ key: 'c1', id: 2, values: { name: 'Mona Adel', function: 'Head buyer', email: 'mona@niletraders.example', phone: null } }],
          currency_id: { id: 1, label: 'EGP' },
          credit_limit: 250000,
          over_limit: false,
          sale_order_count: 18,
          invoice_count: 12,
          notes: '<p>Pays within 30 days. Prefers deliveries on Sundays.</p>',
        },
        // More clients than a link's list shows, so "Search more…" has the rest, and the list of customers has two pages.
        ...Object.fromEntries(
          (
            [
              ['Amira Clinics', 'info@amiraclinics.example', '+20 2 2735 1100', 1, 'active', 1, 50000, 4],
              ['Bayt Interiors', 'hello@baytinteriors.example', '+962 6 461 2200', 2, 'active', 2, 18000, 7],
              ['Cairo Coworking', 'desk@cairocowork.example', '+20 2 2794 3300', 1, 'draft', 1, 30000, 0],
              ['Delta Foods', 'orders@deltafoods.example', '+20 40 333 4400', 1, 'active', 1, 420000, 26],
              ['Giza Plaza', 'leasing@gizaplaza.example', '+20 2 3572 5500', 1, 'blocked', 1, 120000, 9],
              ['Heliopolis Dental Care', 'front@heliodental.example', '+20 2 2418 6600', 1, 'active', 1, 65000, 5],
              ['Maadi Labs', 'team@maadilabs.example', null, 1, 'draft', 1, null, 0],
              ['Nour Pharmacies', 'buying@nourpharma.example', '+966 11 464 7700', 3, 'active', 3, 90000, 14],
              ['Sahel Resorts', 'stay@sahelresorts.example', '+20 46 419 8800', 1, 'active', 1, 310000, 11],
              ['Tahrir Books', 'shop@tahrirbooks.example', '+20 2 2392 9900', 1, 'blocked', 1, 15000, 3],
              ['Zamalek Studio', 'studio@zamalek.example', '+20 2 2736 1010', 1, 'active', 1, 40000, 2],
            ] as const
          ).map(([name, email, phone, country, state, currency, credit_limit, sale_order_count], i) => [
            20 + i,
            {
              name,
              is_company: true,
              company_type: 'company',
              state,
              email,
              phone,
              country_id: { id: country, label: COUNTRIES[country] },
              currency_id: { id: currency, label: CURRENCIES[currency] },
              credit_limit,
              sale_order_count,
            },
          ]),
        ),
      },
      country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' }, 3: { name: 'Saudi Arabia' } },
      'country.region': {
        1: { name: 'Cairo', country_id: { id: 1, label: 'Egypt' } },
        2: { name: 'Alexandria', country_id: { id: 1, label: 'Egypt' } },
        3: { name: 'Amman', country_id: { id: 2, label: 'Jordan' } },
        4: { name: 'Riyadh', country_id: { id: 3, label: 'Saudi Arabia' } },
      },
      currency: { 1: { name: 'EGP' }, 2: { name: 'JOD' }, 3: { name: 'SAR' } },
      'partner.tag': { 10: { name: 'Wholesale' }, 11: { name: 'VIP' } },
      carrier: { 1: { name: 'Aramex' }, 2: { name: 'Bosta' }, 3: { name: 'Our own van' } },
      product: {
        1: { name: 'Office chair, ergonomic', price: 1890 },
        2: { name: 'Desk lamp, LED', price: 380 },
        3: { name: 'Monitor arm, dual', price: 749 },
        4: { name: 'Standing desk 160 × 80', price: 6425 },
        5: { name: 'Cable tray, 120 cm', price: 215 },
      },
      'sale.order': {
        1: {
          name: 'S00118',
          state: 'sent',
          partner_id: { id: 1, label: 'Nile Traders' },
          date_order: '2026-10-02',
          validity_date: '2026-11-01',
          payment_term: '30',
          line_ids: [
            { key: 's1', id: 100, values: { sequence: 10, display_type: 'section', name: 'Workstations' } },
            { key: 'l1', id: 101, values: { lead_days: 14, sequence: 20, product_id: { id: 1, label: 'Office chair, ergonomic' }, name: 'Black mesh back', qty: 12, price: 1890, discount: 5, taxed: true, subtotal: 21546 } },
            { key: 'l2', id: 102, values: { lead_days: 21, sequence: 30, product_id: { id: 4, label: 'Standing desk 160 × 80' }, name: 'Oak top, black frame', qty: 6, price: 6425, discount: 0, taxed: true, subtotal: 38550 } },
            { key: 's2', id: 104, values: { sequence: 40, display_type: 'section', name: 'Lighting' } },
            { key: 'n1', id: 105, values: { sequence: 50, display_type: 'note', name: 'Warm white only, to match the reception.\nOur electrician fits them on delivery day.' } },
            { key: 'l3', id: 103, values: { lead_days: 7, sequence: 60, product_id: { id: 2, label: 'Desk lamp, LED' }, name: 'Warm white', qty: 12, price: 380, discount: 0, taxed: false, subtotal: 4560 } },
          ],
          amount_untaxed: 64656,
          amount_tax: 8413.44,
          amount_total: 73069.44,
          note: 'Delivery to the 12th floor by the freight lift, 08:00 to 10:00.',
          delivery_ids: [
            { key: 'd1', id: 201, values: { date: '2026-10-11', place: 'Nile Towers, 12th floor', carrier_id: { id: 3, label: 'Our own van' }, boxes: 14 } },
            { key: 'd2', id: 202, values: { date: '2026-10-13', place: 'Nile Towers, 12th floor', carrier_id: { id: 1, label: 'Aramex' }, boxes: 3 } },
          ],
        },
      },
      'permit.stage': { 1: { name: 'Applied' }, 2: { name: 'Inspected' }, 3: { name: 'Approved' } },
      employee: {
        21: { name: 'Mona Adel', job: 'Head of design' },
        22: { name: 'Karim Fathy', job: 'Site engineer' },
        23: { name: 'Salma Nabil', job: 'Project manager' },
        24: { name: 'Youssef Kamal', job: 'Head of procurement' },
        25: { name: 'Laila Mostafa', job: 'Draughtsperson' },
      },
      service: { 31: { name: 'Design' }, 32: { name: 'Project management' }, 33: { name: 'Furniture supply' }, 34: { name: 'After-care' } },
      // The "Every field" page: one record that fills every widget.
      project: {
        1: {
          name: 'Office fit-out, Nile Towers 12th floor',
          email: 'site@niletraders.example',
          phone: '+20 2 2345 6700',
          portal: 'https://portal.niletraders.example',
          portal_password: 'nile-12th-floor',
          scope: 'Strip-out of the old reception, new open-plan workspace for 48 people, two meeting rooms and a kitchen.',
          brief: '<p>Calm, daylight-first. <strong>Keep the river view</strong> from every desk.</p><ul><li>Acoustic panels in meeting rooms</li><li>Oak and white</li></ul>',
          seats: 48,
          area: 640.5,
          materials: 'oak, glass',
          permit_id: { id: 2, label: 'Inspected' },
          progress: 64,
          spent: 1184000,
          hours_logged: 118,
          warranty_months: 24,
          cable_length: 240,
          cable_unit: 'm',
          deposit: 370000,
          currency_id: { id: 1, label: 'EGP' },
          budget: 1850000,
          client_rating: 4,
          readiness: 3,
          signed: true,
          reminders: false,
          stage: 'design',
          billing: 'milestones',
          deliverables: ['drawings', 'furniture'],
          start_date: '2026-10-11',
          kickoff: '2026-10-12T10:00',
          client_id: { id: 1, label: 'Nile Traders' },
          tag_ids: [{ id: 11, label: 'VIP' }],
          team_ids: [{ id: 21, label: 'Mona Adel' }, { id: 22, label: 'Karim Fathy' }],
          partner_ids: [{ id: 20, label: 'Amira Clinics' }],
          service_ids: [{ id: 31, label: 'Design' }, { id: 32, label: 'Project management' }],
          source: { model: 'partner', id: 1, label: 'Nile Traders' },
          milestone_ids: [
            { key: 'm1', id: 51, values: { name: 'Site survey', due: '2026-10-15', hours: 12, amount: 45000, owner_id: { id: 21, label: 'Mona Adel' }, invoiced: true } },
            { key: 'm2', id: 52, values: { name: 'Design sign-off', due: '2026-11-05', hours: 64, amount: 380000, owner_id: { id: 22, label: 'Karim Fathy' }, invoiced: false } },
          ],
          contract: null,
          // Two photos of the site, shown as cards: each picture over its name.
          photo: [
            { name: 'Reception, before the strip-out.jpg', type: 'image/jpeg', size: 4416, data: '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39Lya1884Mnk3BAgQIECBAgQIECBAgQIECBAgQIECBAmfKDq1E5UrxyteoM4arTwZMb0RL7NvUNWmwtG5j/peqzlo8FPYYxt/V8mtRjo+sMW2aD/2gAMAwEAAgADAAAAEIigAAAAAAAAAAAAAAAAAAG8AsBQAAAAAAAAAAAAAAABs4gggkogQQQQQQQQQQQQQVcAggggglAgk8WwolSgsJ5BXAgggggglAggggvfvviQglgPggggggglAggggvv/AP8ApCCWA+CCCCCCCUCCGOOvNNNuOOWA+CCCCCCCUCCszzzzzzzzw+A+CCCCCCCUCCW99999999pWA+CCCCCCCUCCW99999999pWA+CCCCCCCSOOc/8A/wD/AP8A/wD+5ob8IIIIIIJTrLLLLLLLLLLLLb6cIIIIJL74444444444445774sIIIPz74444444444445776wIII7764IIIIIIIIIIIJb762gIRz7777777777777777777wJz777777777777777777777P8A/8QAHhEAAwACAwEBAQAAAAAAAAAAAAERIEAQMWEwIUH/2gAIAQMBAT8QmrMJpTKEIQhCEIQhCEIT5pwgbvCaRA+E0NriiT7TSw/kN49tJ68e32e14Kokix7a/bX7a/b4JNuIsso8jyPI8jyPI8jyE4sob38JLQk8rPRgx7EiaX9MP6abV/BqOcJXBfmpRXiCutJn/8QAHhEAAwABBQEBAAAAAAAAAAAAAAERMRAgMEBhIUH/2gAIAQIBAT8QT6rcLpYJ3pN7kylKUpSlKUpSlKN3icnx6bsno0+MRo0o9G3kT/dKue4Z7nue4h6bVjmz7M21Y5kU2AGNXtWONEIQhCEIP5qscazw4arHGs8OGqxwNwggSU9j2PY9j2PY9j2IiCBJjgavoNVuaLopx7m6+k/5sf8AOmvgnVo3F1Wj0avrNUf/xAAoEAACAQEGBwEBAQEAAAAAAAAAARFhICExofDxEDBAQVFxsVCBkcH/2gAIAQEAAT8QgZfJ3JA6a/KRIySqOc3C88Js/wDBHH5ARRM+CJo13hWY32HckDpr8REjJKo5zcryNtuW5dubP/BHH4QRRM+CJo13hcuN9h3JA6a65EjJKo5zcryNtuW5fNUdJtXFYVhWFYVhWFVlVlYVhWFYVhWFVldlYVhWFYVhVZVZWFYVhWFYVg0kbcc/E9Wk1OIkkrkiF4F2ECQyXFq5YCVgkQvA3YpCmf8AFhNTiJJK5IheBdhAkMl0lierWCMSV2Z6RFDdhOMBJ7yUEN/eBtty3NjBGJK7M9Iihvg9EUniQ44BW2F7oLE9cvuNA4NBjQY0GNBjQY0GNBhmjbhuIvt50Z1wzjoLE9cv4fvIzu3nRnXDOOgsT1y/h+8jO7edGdcM46CxPXL+H7yM7t50Z1wzjoLE9ctjCRw8BvzN+ZvzN+ZvzN+ZvzL8YFbZ0Z1wzjoLE9Wt4NoG0DaBtA2gbQNoG0DaBtA2gbQNoG0DaBtA2gbQE01KvRnRnXDOOgsT1ZzIqkdxvI3kbyN5G8jeRvI3kbyN5G8jeRvI3kbyN5G8jeQzbXe4/DOjOuGcdBYnqykjYNQM6mSk117KKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKIdcSa4e22gkmdGdcM46CxPVr4vvRZ984Z0Z1wzjoLE9Wvi+9Fn3zhnRnXDOOgsT1a+L70WffOGdGdcM46CxPVr4vvRZ984Z0Z1wzjoLE9Wvi+9Fn3zhnRnXDOOgk9cVsTVQ1UNVDVQ1UFRHiprokRERERERERERbdMApNVBtE7ruwQ3Dbcu8qMfH2qGxeWTEiIfOvUowXljmJbS+uTaaaxQpbfi5rHx4+74oxFQqFQqFQqFQqFQqFQqFQqFQqFQqFQqFQqFQqFQSNdxY83FwghTJTvT5fpEVDF2IIIIIIIIIIIIIIIIIIIIIIIIIsz7bm95XKanCJYx83eueF+Ex+G0jcrk5L0kzG+zRvBwaSNJGkjSRpI0kaSNJGkjSRpI0kaSNJGkjSRpI0kaSNJGkjSRpI0kaSER3ysvmfHPZ8i9SjBeWOYltL/ETaaaxQpbfitsfHj7u0jEVCoVCoVCoVCoVCoVCoVCoVCoVCoVCoVCoVCoVBI11pjzcXCCFMlO9Oz6RFQxduCCCCCCCCCCCCCCCCCCCCCCCCORPtub3lWGpwiWMfN3rnhfkMfhtI3K5OL0kzG/8q+Z8c9nwvUowXljmJbS/wApNpprFClt+IN84iu8tqf+/mJ43AZez//Z' },
            { name: 'River view from the 12th floor.jpg', type: 'image/jpeg', size: 6434, data: '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' },
          ],
          // Files already with the job, one of each kind, to open and go through.
          documents: [
            { name: 'Site survey notes.txt', type: 'text/plain', size: 137, data: 'U2l0ZSBzdXJ2ZXksIE5pbGUgVG93ZXJzIDEydGggZmxvb3IKCi0gRnJlaWdodCBsaWZ0IGJvb2tlZCAwODowMC0xMDowMAotIFNwcmlua2xlcnMgZml0dGVkIG9uIGV2ZXJ5IGZsb29yCi0gTWVldGluZyByb29tcyBmYWNlIHRoZSByaXZlcgo=' },
            { name: 'Floor plan, 12th floor.svg', type: 'image/svg+xml', size: 435, data: 'PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAzMjAgMjAwJz48cmVjdCB3aWR0aD0nMzIwJyBoZWlnaHQ9JzIwMCcgZmlsbD0nI2Y0ZjFlYScvPjxnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzJmNWQ4YScgc3Ryb2tlLXdpZHRoPSc0Jz48cmVjdCB4PScyMCcgeT0nMjAnIHdpZHRoPScyODAnIGhlaWdodD0nMTYwJy8+PHBhdGggZD0nTTE0MCAyMHY5MGgtMTIwTTE0MCAxMTBoNjB2NzBNMjAwIDcwaDEwMCcvPjwvZz48ZyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPScxNCcgZmlsbD0nIzJmNWQ4YSc+PHRleHQgeD0nNDAnIHk9JzYwJz5PcGVuIHBsYW48L3RleHQ+PHRleHQgeD0nMjEyJyB5PSc1MCc+TWVldGluZzwvdGV4dD48dGV4dCB4PScyMTInIHk9JzE0MCc+S2l0Y2hlbjwvdGV4dD48L2c+PC9zdmc+' },
            { name: 'Lift booking, confirmed.pdf', type: 'application/pdf', size: 577, data: 'JVBERi0xLjQKMSAwIG9iago8PC9UeXBlL0NhdGFsb2cvUGFnZXMgMiAwIFI+PgplbmRvYmoKMiAwIG9iago8PC9UeXBlL1BhZ2VzL0tpZHNbMyAwIFJdL0NvdW50IDE+PgplbmRvYmoKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL01lZGlhQm94WzAgMCA1OTUgODQyXS9Db250ZW50cyA0IDAgUi9SZXNvdXJjZXM8PC9Gb250PDwvRjEgNSAwIFI+Pj4+Pj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDcwPj5zdHJlYW0KQlQgL0YxIDIyIFRmIDcyIDc0MCBUZCAoTGlmdCBib29raW5nOiBmcmVpZ2h0IGxpZnQsIDA4OjAwLTEwOjAwKSBUaiBFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDAwOSAwMDAwMCBuIAowMDAwMDAwMDU0IDAwMDAwIG4gCjAwMDAwMDAxMDUgMDAwMDAgbiAKMDAwMDAwMDIxNyAwMDAwMCBuIAowMDAwMDAwMzM0IDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzk3CiUlRU9GCg==' },
            { name: 'Budget, 12th floor.csv', type: 'text/csv', size: 131, data: 'SXRlbSxBbW91bnQgKEVHUCkKU3RyaXAtb3V0LDk1MDAwClBhcnRpdGlvbnMgYW5kIGdsYXNzLDQxMDAwMApGdXJuaXR1cmUsNjIwMDAwCktpdGNoZW4sMTgwMDAwCkFjb3VzdGljIHBhbmVscywxNDUwMDAKVG90YWwsMTQ1MDAwMAo=' },
          ],
          settings: { badge_readers: 4, visitor_hours: '08:00-18:00', zones: ['reception', 'open-plan'] },
          door_schedule: { weekdays: '07:00-20:00', weekends: 'closed', holidays: ['2026-10-06'] },
          extra: { floor: 12, lift_access: 'Freight lift, 08:00-10:00', parking: 6, sprinklers: true, zone: 'b' },
          time_on_site: 6.5,
          margin: 0.18,
        },
      },
    },
    onchange: {
      // Order lines: a picked product brings its name and price; every line gets its subtotal; the order its totals.
      'sale.order': { line_ids: recalculateOrder },
      partner: {
        // Individual or company, as Odoo keeps them: the choice over the name sets is_company.
        company_type: (values) => ({ is_company: values['company_type'] === 'company' }),
        country_id: (values) => {
          const id = (values['country_id'] as { id: number } | null)?.id;
          const currency = id === 2 ? { id: 2, label: 'JOD' } : id === 3 ? { id: 3, label: 'SAR' } : { id: 1, label: 'EGP' };
          return { currency_id: currency, state_id: null };
        },
      },
    },
    warnings: {
      partner: {
        credit_limit: (values) =>
          Number(values['credit_limit']) > 100000 ? 'Above the 100,000 approval limit: a manager has to sign this off.' : null,
      },
    },
  }));
}

/** The samples' data source options with the real lanes' beside them: a model's records, rules and lists added to, never replaced. */
function withReal(options: Parameters<typeof createMemoryDataSource>[0] & object): Parameters<typeof createMemoryDataSource>[0] {
  const merge = <T>(mine: Record<string, Record<string, T>> = {}, theirs: Record<string, Record<string, T>> = {}) => {
    const all = { ...mine };
    for (const [model, rows] of Object.entries(theirs)) all[model] = { ...all[model], ...rows };
    return all;
  };
  return {
    ...options,
    records: merge(merge(options.records, real.records), businessData.records),
    onchange: merge(options.onchange, real.onchange),
    warnings: merge(options.warnings, real.warnings),
    lists: { ...options.lists, ...real.lists },
    labelField: { ...options.labelField, ...real.labelField },
    shows: { ...options.shows, ...real.shows },
    definitions: { ...options.definitions, ...businessData.definitions, ...real.definitions },
    attachments: { ...options.attachments, ...real.attachments },
  };
}

/** A face, drawn: a salesperson's picture for the reading sheet. */
const FACE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="#c7a17a"/><circle cx="20" cy="15" r="8" fill="#6b4f3a"/><rect x="8" y="26" width="24" height="14" rx="7" fill="#6b4f3a"/></svg>');

/** The reading sheet's invoice and the records its links point to. Sample data. */
const READING = {
  'reading.invoice': {
    1: {
      name: 'INV/2026/00042',
      state: 'posted',
      state_times: { draft: 3 * 86400, posted: 5 * 3600 },
      active: true,
      partner_id: { id: 1, label: 'Nile Traders' },
      user_id: { id: 5, label: 'Mona Adel' },
      tag_ids: [
        { id: 1, label: 'Wholesale' },
        { id: 2, label: 'Late payer' },
        { id: 3, label: 'Export' },
      ],
      invoice_date: '2026-10-02',
      invoice_date_due: null,
      payment_term: '30',
      payment_state: 'paid',
      risk: 'high',
      currency_id: { id: 1, label: 'EGP' },
      pricelist_id: { id: 1, label: 'Public pricelist (EGP)' },
      amount_total: 73069.44,
      amount_paid: 25000,
      hours: 24.8,
      incoming: 3,
      outgoing: 5,
      days_left: 12.5,
      days_allowed: 21,
      next_meeting: '2026-10-13',
      meeting_label: 'Next Meeting',
      lock_date: '2026-09-30',
      credit_warning: 'Nile Traders owes 48,069.44 EGP past its due date, above its 40,000 EGP limit.',
      duplicate: true,
      outcome: null,
      legacy: false,
      trust_minimum: 12500,
      narration: 'Payment within 30 days of the invoice date, by bank transfer.\nLate payments carry 1.5% a month.',
    },
  },
  'reading.partner': { 1: { name: 'Nile Traders', street: '12 Nile St, Garden City', city: 'Cairo, Egypt', vat: 'Tax ID 123-456-789' } },
  'reading.user': { 5: { name: 'Mona Adel', image: FACE }, 6: { name: 'Karim Fathy' } },
  'reading.tag': { 1: { name: 'Wholesale', color: 10 }, 2: { name: 'Late payer', color: 1 }, 3: { name: 'Export', color: 4 }, 4: { name: 'VIP', color: 3 } },
  'reading.pricelist': { 1: { name: 'Public pricelist (EGP)' }, 2: { name: 'Wholesale (EGP)' } },
};
