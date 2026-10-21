import type { Page } from '../format/page';
import { functionsPart } from '../expression/functions';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { Line } from './values';

/**
 * A value worked out from an answer the form refuses waits, as one worked out from text that does not read does
 * (0.25's `waitsFor`): a dash said in words, never the value worked out from what the form will not take. The owner's
 * walk of 0.27: an area of −50 gave a price per m² of −120,000.00; built on 2030, the building was −3 years old beside
 * "Built on can't be after today"; a handover −5 months away was a date already past; a birth date in 2030 gave an
 * age of −3 — whether the page works it out itself, with Fieldia's functions or with the app's own.
 */

const NOW = () => new Date('2026-10-20T12:00:00Z');

function listing(extra: Record<string, unknown> = {}): Page {
  const fields: Record<string, unknown> = {
    district: { type: 'char', label: 'District' },
    area: { type: 'float', label: 'Area (m²)', min: 0 },
    price: { type: 'monetary', label: 'Price', currency: 'EGP', min: 0 },
    price_per_meter: { type: 'monetary', label: 'Price per m²', currency: 'EGP', compute: "roundMoney(price / area, 'EGP')" },
    district_price: { type: 'monetary', label: 'The district’s average per m²', currency: 'EGP', compute: 'districtPrice(district)' },
    against_district: { type: 'integer', label: 'Against the district (%)', compute: 'if(price_per_meter and district_price, round((price_per_meter - district_price) / district_price * 100), None)' },
    listed_on: { type: 'date', label: 'Listed on' },
    handover_months: { type: 'integer', label: 'Handover in (months)', min: 0 },
    handover: { type: 'date', label: 'Handed over by', compute: 'if(handover_months, addMonths(listed_on, handover_months), None)' },
    built_on: { type: 'date', label: 'Built on', max: 'today' },
    building_age: { type: 'integer', label: 'The building’s age (years)', compute: 'years(built_on, today())' },
    vat: { type: 'monetary', label: 'VAT', currency: 'EGP', compute: 'vatOn(price)' },
    ...extra,
  };
  return {
    fieldia: '0.8',
    id: 'listing',
    data: { kind: 'record', model: 'listing' },
    fields,
    layout: { type: 'sections', id: 'root', children: Object.keys(fields).map((field) => ({ type: 'field', id: `f-${field}`, field })) },
  } as Page;
}

function form(page = listing()) {
  return createForm({
    page,
    dataSource: createMemoryDataSource(),
    now: NOW,
    functions: { districtPrice: (district: never) => (district ? 52000 : null), vatOn: (price: never) => (typeof price === 'number' ? Number(price) * 0.14 : null) },
  });
}

beforeAll(() => functionsPart.load());

describe('a value worked out from an answer the form refuses waits for it', () => {
  it('an area of −50: the price per m², and what is worked out from it in turn, wait for Area until it is put right', () => {
    const listingForm = form();
    listingForm.setValue('district', 'New Cairo');
    listingForm.setValue('price', 6000000);
    listingForm.setValue('area', 120);
    expect(listingForm.getState().values['price_per_meter']).toBe(50000);
    expect(listingForm.waitsFor('price_per_meter')).toBeNull();
    listingForm.setValue('area', -50);
    expect(listingForm.problem('area')).toBe('Area (m²) must be at least 0');
    expect(listingForm.waitsFor('price_per_meter')).toEqual({ field: 'area' });
    // Worked out from the price per m²: it waits for the area too, never a comparison with −120,000.
    expect(listingForm.waitsFor('against_district')).toEqual({ field: 'area' });
    // What reads no refused answer shows its value.
    expect(listingForm.waitsFor('district_price')).toBeNull();
    listingForm.setValue('area', 50);
    expect(listingForm.waitsFor('price_per_meter')).toBeNull();
    expect(listingForm.waitsFor('against_district')).toBeNull();
    expect(listingForm.getState().values['price_per_meter']).toBe(120000);
  });

  it('Fieldia’s functions: built on 2030 is no age, a handover −5 months away no date, until each is put right', () => {
    const listingForm = form();
    listingForm.setValue('built_on', '2030-01-01');
    expect(listingForm.problem('built_on')).toMatch(/^Built on can.t be after/);
    expect(listingForm.waitsFor('building_age')).toEqual({ field: 'built_on' });
    listingForm.setValue('built_on', '2015-06-01');
    expect(listingForm.waitsFor('building_age')).toBeNull();
    expect(listingForm.getState().values['building_age']).toBe(11);
    listingForm.setValue('listed_on', '2026-10-20');
    listingForm.setValue('handover_months', -5);
    expect(listingForm.waitsFor('handover')).toEqual({ field: 'handover_months' });
    listingForm.setValue('handover_months', 18);
    expect(listingForm.waitsFor('handover')).toBeNull();
    expect(listingForm.getState().values['handover']).toBe('2028-04-20');
  });

  it('the app’s own function: a VAT on a price the form refuses waits for the price', () => {
    const listingForm = form();
    listingForm.setValue('price', 1000);
    expect(listingForm.getState().values['vat']).toBe(140);
    listingForm.setValue('price', -1000);
    expect(listingForm.waitsFor('vat')).toEqual({ field: 'price' });
  });

  it('a birth date in 2030, then "yesterday" typed over it: the age waits for the date through both', () => {
    const visit = form({
      fieldia: '0.8',
      id: 'visit',
      data: { kind: 'responses' },
      fields: { birth_date: { type: 'date', label: 'Your date of birth', max: 'today' }, age_now: { type: 'integer', label: 'Your age', compute: 'age(birth_date)' } },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-birth', field: 'birth_date' }, { type: 'field', id: 'f-age', field: 'age_now' }] },
    } as Page);
    visit.setValue('birth_date', '2030-03-01');
    expect(visit.getState().values['age_now']).toBe(-3);
    expect(visit.waitsFor('age_now')).toEqual({ field: 'birth_date' });
    visit.setUnread('birth_date', { text: 'yesterday', message: 'Your date of birth: “yesterday” is not a whole date yet' });
    expect(visit.waitsFor('age_now')).toEqual({ field: 'birth_date' });
    visit.setValue('birth_date', '1990-10-21');
    expect(visit.getState().unread).toEqual({});
    expect(visit.waitsFor('age_now')).toBeNull();
    expect(visit.getState().values['age_now']).toBe(35);
  });

  it('an empty answer, or one no one is shown, is no refusal: nothing waits for it', () => {
    const page = listing({ area: { type: 'float', label: 'Area (m²)', min: 0, required: true } });
    const listingForm = form(page);
    listingForm.setValue('price', 6000000);
    // Required and empty: a save asks for it, but there is nothing worked out from it to wait.
    expect(listingForm.problem('area')).toBe('Area (m²) is required');
    expect(listingForm.waitsFor('price_per_meter')).toBeNull();
    // Hidden: the form never asks anything of it.
    const hidden = listing();
    (hidden.layout as { children: { id: string; invisible?: string }[] }).children.find((child) => child.id === 'f-area')!.invisible = 'True';
    const hiddenForm = form(hidden);
    hiddenForm.setValue('area', -50);
    expect(hiddenForm.problem('area')).toBeNull();
    expect(hiddenForm.waitsFor('price_per_meter')).toBeNull();
  });

  it('a table’s line whose cell the form refuses: the sum over the lines waits for that line, as for text that does not read', () => {
    const order = form({
      fieldia: '0.8',
      id: 'order',
      data: { kind: 'record', model: 'sale.order' },
      fields: {
        line_ids: {
          type: 'one2many',
          label: 'Order lines',
          relation: 'sale.order.line',
          fields: { name: { type: 'char', label: 'Description' }, qty: { type: 'float', label: 'Quantity', min: 0 }, price: { type: 'monetary', label: 'Unit price', currency: 'EGP' }, subtotal: { type: 'monetary', label: 'Subtotal', currency: 'EGP', compute: 'qty * price' } },
        },
        untaxed: { type: 'monetary', label: 'Untaxed', currency: 'EGP', compute: "sum(line_ids, 'subtotal')" },
      },
      layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-lines', field: 'line_ids' }, { type: 'field', id: 'f-untaxed', field: 'untaxed' }] },
    } as Page);
    const lines: Line[] = [
      { key: 'l1', values: { name: 'Office chair', qty: 12, price: 1890 } },
      { key: 'l2', values: { name: 'Standing desk', qty: 6, price: 6425 } },
    ];
    order.setValue('line_ids', lines);
    expect(order.waitsFor('untaxed')).toBeNull();
    order.updateLine('line_ids', 'l2', 'qty', -6);
    expect(order.waitsFor('untaxed')).toEqual({ field: 'line_ids', line: 2, column: 'qty' });
    order.updateLine('line_ids', 'l2', 'qty', 6);
    expect(order.waitsFor('untaxed')).toBeNull();
  });
});
