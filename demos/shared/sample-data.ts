import { createMemoryDataSource, type Line, type Page, type Values } from '@fieldia/core';
import customer from '../../examples/pages/customer.page.json';
import fields from '../../examples/pages/fields.page.json';
import kinds from '../../examples/pages/kinds.page.json';
import layout from '../../examples/pages/layout.page.json';
import lists from '../../examples/pages/lists.page.json';
import customers from '../../examples/pages/customers.page.json';
import order from '../../examples/pages/order.page.json';
import rules from '../../examples/pages/rules.page.json';
import signup from '../../examples/pages/signup.page.json';
import survey from '../../examples/pages/survey.page.json';
import big from '../../examples/pages/big.page.json';
import { customPage } from './custom-page';

/** The example pages every demo can show, by name. */
export const pages: Record<string, Page> = {
  signup: signup as Page,
  survey: survey as Page,
  customer: customer as Page,
  customers: customers as Page,
  fields: fields as Page,
  kinds: kinds as Page,
  order: order as Page,
  rules: rules as Page,
  layout: layout as Page,
  lists: lists as Page,
  custom: customPage,
  // 500 fields, for timing: e2e/perf.spec.ts opens it; no card in the gallery (see e2e/demos-shell.spec.ts).
  big: big as Page,
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
  return {
    ...page,
    ...(maxWidth ? { maxWidth: maxWidth as Page['maxWidth'] } : {}),
    ...(actions ? { actionsPosition: actions as Page['actionsPosition'] } : {}),
    ...(scheme ? { look: { ...page.look, scheme } } : {}),
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
  keys?: { enterMovesToNext: boolean };
  showValid?: boolean;
  saveStatus?: 'inline' | 'toast' | 'bar';
  readonly?: boolean;
  editSwitch?: boolean;
  translate?: (text: string) => string;
} {
  const saveStatus = params.get('saveStatus');
  return {
    ...(params.get('translate') === 'fr' ? { translate: (text: string) => APP_CATALOG_FR[text] ?? text } : {}),
    ...(params.get('readonly') === '1' ? { readonly: true } : {}),
    ...(params.get('editSwitch') === '1' ? { editSwitch: true } : {}),
    ...(params.get('enterToNext') === '1' ? { keys: { enterMovesToNext: true } } : {}),
    ...(params.get('showValid') === '1' ? { showValid: true } : {}),
    ...(saveStatus === 'toast' || saveStatus === 'bar' ? { saveStatus } : {}),
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
export const relatedPages: Record<string, Page> = { partner: customer as Page };

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
const CURRENCIES: Record<number, string> = { 1: 'EGP', 2: 'JOD', 3: 'SAR' };

/** A customer to edit, and the records its relations point to. Sample data. */
export function sampleDataSource() {
  return createMemoryDataSource({
    lists: appLists,
    records: {
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
          service_ids: [{ id: 31, label: 'Design' }, { id: 32, label: 'Project management' }],
          source: { model: 'partner', id: 1, label: 'Nile Traders' },
          milestone_ids: [
            { key: 'm1', id: 51, values: { name: 'Site survey', due: '2026-10-15', hours: 12, amount: 45000, owner_id: { id: 21, label: 'Mona Adel' }, invoiced: true } },
            { key: 'm2', id: 52, values: { name: 'Design sign-off', due: '2026-11-05', hours: 64, amount: 380000, owner_id: { id: 22, label: 'Karim Fathy' }, invoiced: false } },
          ],
          contract: null,
          photo: [],
          // Two files already with the job, to open and go through.
          documents: [
            { name: 'Site survey notes.txt', type: 'text/plain', size: 137, data: 'U2l0ZSBzdXJ2ZXksIE5pbGUgVG93ZXJzIDEydGggZmxvb3IKCi0gRnJlaWdodCBsaWZ0IGJvb2tlZCAwODowMC0xMDowMAotIFNwcmlua2xlcnMgZml0dGVkIG9uIGV2ZXJ5IGZsb29yCi0gTWVldGluZyByb29tcyBmYWNlIHRoZSByaXZlcgo=' },
            { name: 'Floor plan, 12th floor.svg', type: 'image/svg+xml', size: 435, data: 'PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHZpZXdCb3g9JzAgMCAzMjAgMjAwJz48cmVjdCB3aWR0aD0nMzIwJyBoZWlnaHQ9JzIwMCcgZmlsbD0nI2Y0ZjFlYScvPjxnIGZpbGw9J25vbmUnIHN0cm9rZT0nIzJmNWQ4YScgc3Ryb2tlLXdpZHRoPSc0Jz48cmVjdCB4PScyMCcgeT0nMjAnIHdpZHRoPScyODAnIGhlaWdodD0nMTYwJy8+PHBhdGggZD0nTTE0MCAyMHY5MGgtMTIwTTE0MCAxMTBoNjB2NzBNMjAwIDcwaDEwMCcvPjwvZz48ZyBmb250LWZhbWlseT0nc2Fucy1zZXJpZicgZm9udC1zaXplPScxNCcgZmlsbD0nIzJmNWQ4YSc+PHRleHQgeD0nNDAnIHk9JzYwJz5PcGVuIHBsYW48L3RleHQ+PHRleHQgeD0nMjEyJyB5PSc1MCc+TWVldGluZzwvdGV4dD48dGV4dCB4PScyMTInIHk9JzE0MCc+S2l0Y2hlbjwvdGV4dD48L2c+PC9zdmc+' },
          ],
          settings: { badge_readers: 4, visitor_hours: '08:00-18:00', zones: ['reception', 'open-plan'] },
          door_schedule: { weekdays: '07:00-20:00', weekends: 'closed', holidays: ['2026-10-06'] },
          extra: { floor: 12, lift_access: 'Freight lift, 08:00-10:00', parking: 6, sprinklers: true, zone: 'b' },
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
  });
}
