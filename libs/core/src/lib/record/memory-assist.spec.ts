import type { Page } from '../format/page';
import type { SearchToFilterRequest, SuggestRequest } from './data-source';
import { assistStandIn, polishText, readSignature, standInNumber } from './memory-assist';
import { createMemoryDataSource } from './memory-data-source';

const SIGNATURE = ['Best regards,', '', 'Mona Adel', 'Sales Director | Nile Traders', 'T: +20 2 2345 6789', 'M: +20 100 123 4567', 'mona.adel@niletraders.example', 'www.niletraders.example', '12 Corniche St, Garden City, Cairo, Egypt', 'VAT: 312-645-987'].join('\n');

/** A company's card: its name, its ways to reach it, where it is, and its people as lines. */
const company: Page = {
  fieldia: '0.13',
  id: 'company',
  data: { kind: 'record', model: 'partner' },
  fields: {
    name: { type: 'char', label: 'Company' },
    email: { type: 'char', label: 'Email' },
    phone: { type: 'char', label: 'Phone' },
    website: { type: 'char', label: 'Website' },
    street: { type: 'char', label: 'Street' },
    city: { type: 'char', label: 'City' },
    country_id: { type: 'many2one', label: 'Country', relation: 'country' },
    vat: { type: 'char', label: 'Tax ID' },
    notes: { type: 'text', label: 'Notes' },
    contacts: {
      type: 'one2many',
      label: 'Contacts',
      relation: 'partner.contact',
      fields: { name: { type: 'char', label: 'Name' }, function: { type: 'char', label: 'Job title' }, email: { type: 'char', label: 'Email' }, mobile: { type: 'char', label: 'Mobile' } },
    },
  },
  layout: { type: 'sheet', id: 'sheet', children: [] },
};

const records = { country: { 1: { name: 'Egypt' }, 2: { name: 'Jordan' } }, 'home.amenity': { 1: { name: 'Garden' }, 2: { name: 'Pool' } } };

describe('the stand-in for an app’s AI (no model, no keys)', () => {
  it('reads an e-mail signature by its patterns', () => {
    expect(readSignature(SIGNATURE)).toEqual({
      person: 'Mona Adel',
      title: 'Sales Director',
      company: 'Nile Traders',
      emails: ['mona.adel@niletraders.example'],
      phones: ['+20 2 2345 6789'],
      mobile: '+20 100 123 4567',
      website: 'https://www.niletraders.example',
      street: '12 Corniche St, Garden City',
      city: 'Cairo',
      place: 'Egypt',
      tax: '312-645-987',
    });
  });

  it('reads one copied on one line, its parts apart with a middle dot', () => {
    const found = readSignature('Lina Haddad · Head of Procurement, Amman Fresh Markets · M: +962 79 555 0142 · lina.haddad@ammanfresh.example · 21 Mecca St, Shmeisani, Amman, Jordan');
    expect(found).toMatchObject({ person: 'Lina Haddad', title: 'Head of Procurement', company: 'Amman Fresh Markets', mobile: '+962 79 555 0142', emails: ['lina.haddad@ammanfresh.example'], street: '21 Mecca St, Shmeisani', city: 'Amman', place: 'Jordan' });
  });

  it('fills a company’s card from it, its person as a contact line, and says it is a stand-in', async () => {
    const source = createMemoryDataSource({ records, assist: assistStandIn() });
    const request: SuggestRequest = { pageId: 'company', model: 'partner', recordId: null, page: company, values: {}, fields: ['name', 'email', 'phone', 'website', 'street', 'city', 'country_id', 'vat', 'contacts'], from: { text: SIGNATURE }, language: 'en' };
    const answer = await source.suggest?.(request);
    expect(answer?.values).toEqual({
      name: 'Nile Traders',
      email: 'mona.adel@niletraders.example',
      phone: '+20 2 2345 6789',
      website: 'https://www.niletraders.example',
      street: '12 Corniche St, Garden City',
      city: 'Cairo',
      country_id: { id: 1, label: 'Egypt' },
      vat: '312-645-987',
      contacts: [{ name: 'Mona Adel', function: 'Sales Director', email: 'mona.adel@niletraders.example', mobile: '+20 100 123 4567' }],
    });
    expect(answer?.why).toMatch(/^Stand-in AI, no model: read by its patterns — a company, an e-mail, a phone, a website, a street, a city, the country, a tax id and a line for Contacts\.$/);
    expect(source.calls.map((call) => call.method)).toEqual(['suggest']);
  });

  it('reads a text file it is given, and says which files it could not read', async () => {
    const file = (name: string, type: string, text: string) => ({ name, type, size: text.length, arrayBuffer: async () => new TextEncoder().encode(text).buffer as ArrayBuffer });
    const answer = await assistStandIn().suggest(
      { pageId: 'company', model: 'partner', recordId: null, page: company, values: {}, fields: ['email', 'city'], from: { files: [file('card.vcf', 'text/vcard', 'Karim Saleh\nkarim@delta.example\n4 Tahrir Sq, Dokki, Giza'), file('scan.pdf', 'application/pdf', '%PDF')] }, language: 'en' },
      records
    );
    expect(answer.values).toEqual({ email: 'karim@delta.example', city: 'Dokki' });
    expect(answer.why).toMatch(/It reads text files only: scan\.pdf not read\.$/);
  });

  it('adds the lines a message asks for: a quantity, a thing by its record, a price', async () => {
    const order: Page = { ...company, fields: { lines: { type: 'one2many', label: 'Lines', relation: 'order.line', fields: { product_id: { type: 'many2one', label: 'Product', relation: 'product' }, qty: { type: 'integer', label: 'Quantity' }, price: { type: 'monetary', label: 'Price' } } } } };
    const answer = await assistStandIn().suggest({ pageId: 'order', model: 'sale', recordId: null, page: order, values: {}, fields: ['lines'], from: { text: 'Please quote:\n2 x Dental chair @ 4,500\n- 10 pcs Gloves' }, language: 'en' }, { product: { 7: { name: 'Dental chair' } } });
    expect(answer.values['lines']).toEqual([
      { product_id: { id: 7, label: 'Dental chair' }, qty: 2, price: 4500 },
      { product_id: 'Gloves', qty: 10 },
    ]);
  });

  it('polishes words the same way every time', () => {
    expect(polishText('hi mona\n\nthx for ur msg.i can show u the villa tmrw at 5pm , pls confirm asap!!!\n\n\n\nregards')).toEqual({
      text: "Hi Mona,\n\nThanks for your message. I can show you the villa tomorrow at 5pm, please confirm as soon as possible!\n\nRegards,",
      did: ['tidied the spaces', 'one mark where there were several', 'wrote out shorthand', 'put capitals and full stops in'],
    });
    expect(polishText('All is ready.')).toEqual({ text: 'All is ready.', did: [] });
  });

  it('polishes names with the capitals the record writes them with, and the days and months', async () => {
    // The owner's walk of 0.29: "zamalek", "nile" and "thursday" were left in small letters.
    const enquiry: Page = { ...company, fields: { message: { type: 'text', label: 'Their message' }, reply: { type: 'text', label: 'Reply' } } };
    const message = 'Good morning. We are moving to Cairo in January and look for a flat in Zamalek. A Nile view would be lovely. Best, Omar';
    const ask = { pageId: 'enquiry', model: 'enquiry', recordId: 2, page: enquiry, values: { message }, field: 'reply', how: 'polish', text: 'hi omar\n\nwe have 2 flats in zamalek, one with a nile view. can u come on thursday? the good flat is ready in january, it may suit you.', language: 'en' };
    const polished = await assistStandIn().rewrite(ask, {});
    expect(polished.text).toBe('Hi Omar,\n\nWe have 2 flats in Zamalek, one with a Nile view. Can you come on Thursday? The good flat is ready in January, it may suit you.');
    expect(polished.why).toBe('Stand-in AI, no model: wrote out shorthand, put capitals and full stops in and wrote names with their capitals.');
  });

  it('drafts from the app’s template, else greets the person the record names; an html field in paragraphs', async () => {
    const enquiry: Page = { ...company, fields: { partner_name: { type: 'char', label: 'Buyer’s name' }, reply: { type: 'html', label: 'Reply' } } };
    const ask = { pageId: 'enquiry', model: 'enquiry', recordId: 3, page: enquiry, values: { partner_name: 'Hana Fouad' }, field: 'reply', how: 'draft', text: '', language: 'en' };
    expect((await assistStandIn().rewrite(ask, {})).text).toBe('<p>Dear Hana,</p><p>Thank you for your message. We have it, and will come back to you shortly with what you asked for.</p><p>Kind regards,</p>');
    const own = await assistStandIn({ drafts: { 'enquiry.reply': (values) => `Hello ${values['partner_name']}` } }).rewrite(ask, {});
    expect(own).toEqual({ text: '<p>Hello Hana Fouad</p>', why: 'Stand-in AI, no model: written from this record’s fields by a template.' });
  });

  it('reads a search in plain words as conditions on the list’s fields', async () => {
    const homes: Page = {
      ...company,
      fields: {
        kind: { type: 'selection', label: 'Type', options: [{ value: 'flat', label: 'Flat' }, { value: 'villa', label: 'Villa' }] },
        district: { type: 'selection', label: 'District', options: [{ value: 'garden_city', label: 'Garden City' }, { value: 'new_cairo', label: 'New Cairo' }] },
        price: { type: 'monetary', label: 'Price' },
        bedrooms: { type: 'integer', label: 'Bedrooms' },
        area_m2: { type: 'integer', label: 'Area, m²' },
        amenities: { type: 'many2many', label: 'Amenities', relation: 'home.amenity' },
      },
    };
    const read = (text: string) => assistStandIn().searchToFilter({ pageId: 'homes', model: 'home', page: homes, text, fields: Object.keys(homes.fields), language: 'en' } as SearchToFilterRequest, records);
    expect(await read('villas in New Cairo under 15M')).toEqual({
      filter: [
        { field: 'price', op: '<=', value: 15_000_000 },
        { field: 'kind', op: '=', value: 'villa' },
        { field: 'district', op: '=', value: 'new_cairo' },
      ],
      why: 'Stand-in AI, no model: read “under 15m”, “new cairo” and “villas” by their patterns.',
    });
    expect((await read('3+ bedrooms with a pool between 5m and 10.5m in garden city near the metro')).filter).toEqual([
      { field: 'price', op: 'between', value: [5_000_000, 10_500_000] },
      { field: 'bedrooms', op: '>=', value: 3 },
      { field: 'district', op: '=', value: 'garden_city' },
      { field: 'amenities', op: 'contains', value: { id: 2, label: 'Pool' } },
    ]);
    expect((await read('3+ bedrooms with a pool between 5m and 10.5m in garden city near the metro')).text).toBe('metro');
    expect((await read('3-bedroom flats')).filter).toEqual([
      { field: 'bedrooms', op: '=', value: 3 },
      { field: 'kind', op: '=', value: 'flat' },
    ]);
    expect((await read('flats or villas, 200 m²')).filter).toEqual([
      { field: 'area_m2', op: '=', value: 200 },
      { field: 'kind', op: 'in', value: ['flat', 'villa'] },
    ]);
    expect(await read('something nice')).toEqual({ filter: [], text: 'something nice', why: 'Stand-in AI, no model: found no field in these words.' });
    // The owner's walk of 0.29: "<25m" was read and set nothing; "apartments" matched no type.
    expect((await read('villa garden city <25m')).filter).toEqual([
      { field: 'price', op: '<=', value: 25_000_000 },
      { field: 'kind', op: '=', value: 'villa' },
      { field: 'district', op: '=', value: 'garden_city' },
    ]);
    expect((await read('flats >= 3m')).filter).toEqual([
      { field: 'price', op: '>=', value: 3_000_000 },
      { field: 'kind', op: '=', value: 'flat' },
    ]);
    expect((await read('apartments under 5 million with a pool')).filter).toEqual([
      { field: 'price', op: '<=', value: 5_000_000 },
      { field: 'kind', op: '=', value: 'flat' },
      { field: 'amenities', op: 'contains', value: { id: 2, label: 'Pool' } },
    ]);
    // A word holding "min" is no minimum: "admin 3" sets nothing.
    expect((await read('admin 3')).filter).toEqual([]);
  });

  it('reads numbers as people write them', () => {
    expect([standInNumber('15', 'M'), standInNumber('2.5', 'million'), standInNumber('800', 'k'), standInNumber('15,000,000'), standInNumber('1,5'), standInNumber('4,500')]).toEqual([15_000_000, 2_500_000, 800_000, 15_000_000, 1.5, 4500]);
  });

  it('gives a memory source only the members it is given', () => {
    expect(createMemoryDataSource().suggest).toBeUndefined();
    const some = createMemoryDataSource({ assist: { rewrite: () => ({ text: 'x' }) } });
    expect([typeof some.suggest, typeof some.rewrite, typeof some.searchToFilter]).toEqual(['undefined', 'function', 'undefined']);
  });
});
