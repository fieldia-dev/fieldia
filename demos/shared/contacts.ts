import type { DataSource, ListRequest, MemoryDataSource, Page, RecordPermissions, Values } from '@fieldia/core';
import contactsPage from '../../examples/pages/contacts.page.json';

/**
 * A list people bring in, take away and change in bulk: 1,284 contacts, made
 * the same way each time, so Import, "Select all 1,284 that match", Export and
 * Edit have a list worth them (Import's sample files: demos/samples). Some may not be changed by this person — Karim's are his
 * own, a blocked contact's status is the credit team's — so an Edit says what
 * it could not change, and why.
 *
 * The address can make the source behave as others do, for the browser tests
 * and for a person trying it: `allIds=1000` stops its ids at a thousand (a
 * source that gives fewer than match), `allIds=none` gives none (the list
 * pages through), `writeMany=none` leaves bulk writing out (the list saves
 * each in turn), `export=server` writes an export on the "server".
 */

export const CONTACTS = 1284;
const FIRST = ['Mona', 'Omar', 'Sara', 'Karim', 'Lina', 'Youssef', 'Hana', 'Tarek', 'Nour', 'Laila', 'Sami', 'Rania', 'Dina', 'Hassan', 'Maya', 'Adam', 'Lea', 'Jonas', 'Emma', 'Lucas', 'Chloé', 'Hugo', 'Inès', 'Ahmed', 'Fatima', 'Zaid', 'Reem', 'Bilal', 'Salma', 'Ivan', 'Anna', 'Marco', 'Giulia', 'Kenji', 'Aiko', 'Ravi', 'Priya', 'Chen', 'Wei', 'Amara'];
const LAST = ['Adel', 'Said', 'Haddad', 'Mansour', 'Khalil', 'Nasser', 'Farouk', 'Saleh', 'Aziz', 'Hamdan', 'Schmidt', 'Müller', 'Dubois', 'Martin', 'Rossi', 'Bianchi', 'Tanaka', 'Sato', 'Sharma', 'Patel', 'Li', 'Wang', 'García', 'López', 'Okafor', 'Mensah', 'Novak', 'Kowalski', 'Silva', 'Costa'];
const COMPANIES = ['Nile Traders', 'Amira Clinics', 'Bayt Interiors', 'Delta Foods', 'Giza Plaza', 'Maadi Labs', 'Nour Pharmacies', 'Sahel Resorts', 'Tahrir Books', 'Zamalek Studio', 'Petra Tours', 'Red Sea Divers', 'Cedar Logistics', 'Olive Grove Farms', 'Desert Rose Hotels', 'Falcon Air Cargo', 'Harbour Freight', 'Lotus Spa', 'Palm Court Dental', 'Atlas Builders', 'Sphinx Security', 'Oasis Water', 'Saffron Kitchens', 'Indigo Print', 'Jasmine Florists'];
/** The owners a contact may have: people who sell, as the app's users. */
export const OWNERS: Record<number, string> = { 9001: 'Mona Adel', 9002: 'Omar Said', 9003: 'Sara Haddad', 9004: 'Karim Nasser', 9005: 'Lina Khalil' };
const COUNTRIES: Record<number, { name: string; currency: number }> = { 1: { name: 'Egypt', currency: 1 }, 2: { name: 'Jordan', currency: 2 }, 3: { name: 'Saudi Arabia', currency: 3 } };
const CURRENCIES: Record<number, string> = { 1: 'EGP', 2: 'JOD', 3: 'SAR' };

/** Numbers that look at random, the same ones every time (mulberry32). */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Each country's mobile numbers: its dialling code, how a mobile starts and how many digits follow (Egypt's 10 1234 5678). */
const MOBILES: Record<number, { dial: string; starts: string[]; digits: number }> = {
  1: { dial: '20', starts: ['10', '11', '12', '15'], digits: 8 },
  2: { dial: '962', starts: ['77', '78', '79'], digits: 7 },
  3: { dial: '966', starts: ['50', '53', '55'], digits: 7 },
};

/** The contacts, by id. */
export function sampleContacts(): Record<number, Values> {
  // Their phones from numbers of their own, so the rest is as it was before the contacts had phones.
  const dial = seeded(4242);
  const next = seeded(2026);
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)];
  const contacts: Record<number, Values> = {};
  for (let id = 1; id <= CONTACTS; id++) {
    // Each pair of names once in the first 1,200, scattered (769 and 1,200 share no factor); a few twice after.
    const pair = (id * 769) % (FIRST.length * LAST.length);
    const first = FIRST[pair % FIRST.length];
    const last = LAST[Math.floor(pair / FIRST.length)];
    const company = pick(COMPANIES);
    const country = next() < 0.6 ? 1 : next() < 0.5 ? 2 : 3;
    const roll = next();
    const state = roll < 0.45 ? 'customer' : roll < 0.8 ? 'lead' : roll < 0.95 ? 'inactive' : 'blocked';
    const owner = 9001 + Math.floor(next() * 5);
    const bought = state !== 'lead';
    // A day in the last three years, for those who bought.
    const day = new Date(Date.UTC(2026, 9, 1) - Math.floor(next() * 1095) * 86400000).toISOString().slice(0, 10);
    contacts[id] = {
      name: `${first} ${last}`,
      company,
      email: `${first}.${last}@${company.toLowerCase().replace(/[^a-z]+/g, '')}.example`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''),
      country_id: { id: country, label: COUNTRIES[country].name },
      state,
      owner_id: { id: owner, label: OWNERS[owner] },
      last_order: bought ? day : null,
      currency_id: { id: COUNTRIES[country].currency, label: CURRENCIES[COUNTRIES[country].currency] },
      lifetime_value: bought ? Math.round(next() * 500000) / (country === 2 ? 10 : 1) : null,
      newsletter: next() < 0.55,
      phone: phoneIn(country, dial),
      photo: null,
    };
  }
  return contacts;
}

/** A mobile number in a contact's country, as E.164; one in nine has none yet. */
function phoneIn(country: number, next: () => number): string | null {
  const mobile = MOBILES[country];
  const start = mobile.starts[Math.floor(next() * mobile.starts.length)];
  const digits = Array.from({ length: mobile.digits }, () => Math.floor(next() * 10)).join('');
  return next() < 1 / 9 ? null : `+${mobile.dial}${start}${digits}`;
}

/** What this person may do with a contact: Karim's are his alone; a blocked one's status is the credit team's. */
export function contactPermissions(values: Values): RecordPermissions | undefined {
  if ((values['owner_id'] as { id: number } | null)?.id === 9004) return { edit: false, reason: 'Only its owner, Karim Nasser, can change this contact.' };
  if (values['state'] === 'blocked') return { readonlyFields: ['state'], reason: 'A blocked contact’s status is changed by the credit team.' };
  return undefined;
}

/** One contact, on a page of its own: what a row of the list opens. */
export const contactPage: Page = {
  fieldia: '0.10',
  id: 'contact',
  title: 'Contact',
  data: { kind: 'record', model: 'crm.contact' },
  fields: (contactsPage as Page).fields,
  layout: {
    type: 'sections',
    id: 'contact',
    children: [
      {
        type: 'section',
        id: 'contact-main',
        columns: 2,
        children: ['name', 'company', 'email', 'phone', 'country_id', 'state', 'owner_id', 'last_order', 'lifetime_value', 'newsletter'].map((field) =>
          // A phone read the world over, with its call and WhatsApp links, as the list writes it.
          field === 'phone' ? { type: 'field' as const, id: `contact-${field}`, field, widget: 'phone', options: { shown: 'international' } } : { type: 'field' as const, id: `contact-${field}`, field }
        ),
      },
    ],
  },
};

/** The source made to behave as the address says (see above). */
export function contactsAsAsked(params: URLSearchParams, source: MemoryDataSource): void {
  const ids = params.get('allIds');
  if (ids) {
    const list = source.list.bind(source);
    source.list = async (request: ListRequest) => {
      const answer = await list(request);
      if (request.model !== 'crm.contact' || !answer.allIds) return answer;
      if (ids === 'none') {
        const { allIds: _ids, ...rest } = answer;
        return rest;
      }
      return { ...answer, allIds: answer.allIds.slice(0, Number(ids)) };
    };
  }
  if (params.get('writeMany') === 'none') delete (source as Partial<MemoryDataSource>).writeMany;
  if (params.get('export') === 'server') {
    // A server that emails a big export, writes a small CSV itself, and leaves a small workbook to the browser.
    source.exportRecords = async (request: Parameters<NonNullable<DataSource['exportRecords']>>[0]) => {
      if (request.count > 500) return { message: `${request.name} is being made on the server: it will be emailed to you.` };
      if (request.format === 'xlsx') return false;
      return { name: request.name.replace(/(\.\w+)$/, ' (server)$1'), type: 'text/csv', data: `${request.columns.map((column) => column.label).join(',')}\r\n` };
    };
  }
}
