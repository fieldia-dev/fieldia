import { checkPage } from './check-page';
import { validatePage } from '../../index';

/**
 * A code scanned with the camera (`options.scan`): on a field, a table's column or a table counted, its settings known to
 * the format — formats it reads, a GS1 part's identifier, the fields a code fills, a link's code by a field of its
 * records — and checked against the page: a kind a code is written into, fields that are there and take what they are
 * given. A page that says none is read as before.
 */

const FIELDS = {
  lot: { type: 'char', label: 'Lot' },
  expiry: { type: 'date', label: 'Expiry' },
  product_id: { type: 'many2one', label: 'Product', relation: 'product' },
  done: { type: 'boolean', label: 'Done' },
  photo: { type: 'binary', label: 'Photo' },
  line_ids: {
    type: 'one2many',
    label: 'Lines',
    relation: 'line',
    fields: { product_id: { type: 'many2one', label: 'Product', relation: 'product' }, lot: { type: 'char', label: 'Lot' }, expiry: { type: 'date', label: 'Expiry' }, counted: { type: 'integer', label: 'Counted' }, note: { type: 'text', label: 'Note' } },
  },
};
const page = (node: Record<string, unknown>) => ({
  fieldia: '0.7',
  id: 'scan',
  data: { kind: 'record', model: 'treatment' },
  fields: FIELDS,
  layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'n', ...node }] },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
/** The checks the one-tag script runs without the format's schemas: the same findings. */
const checked = (input: unknown) => {
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a field scanned into, in the format', () => {
  it('takes true, false or its settings on a char, a text, a link, a table counted and a table column', () => {
    expect(problems(page({ field: 'lot', options: { scan: true } }))).toEqual([]);
    expect(problems(page({ field: 'lot', options: { scan: false } }))).toEqual([]);
    expect(problems(page({ field: 'lot', options: { scan: { formats: ['data_matrix', 'qr_code'], part: '10', fills: { expiry: '17', product_id: { part: '01', by: 'gtin' } }, sound: false } } }))).toEqual([]);
    expect(problems(page({ field: 'product_id', options: { scan: { by: 'barcode' } } }))).toEqual([]);
    expect(problems(page({ field: 'line_ids', options: { scan: { field: 'product_id', count: 'counted', by: 'barcode', fills: { lot: '10' } } } }))).toEqual([]);
    expect(problems(page({ field: 'line_ids', cells: { lot: { options: { scan: { part: '10', fills: { expiry: '17', product_id: { part: '01', by: 'gtin' } } } } } } }))).toEqual([]);
    expect(problems(page({ field: 'lot', widget: 'email', options: { scan: true } }))).toEqual([]);
  });

  it('refuses a shape it does not know: a format, a part that is no identifier, a word it does not know', () => {
    expect(problems(page({ field: 'lot', options: { scan: 'yes' } }))).toEqual(['layout.children[0].options.scan: scan is true, or its settings: { "formats": […], "by": "barcode", "part": "10", "fills": {…} }']);
    expect(problems(page({ field: 'lot', options: { scan: { formats: ['pdf417'] } } }))).toEqual([
      'layout.children[0].options.scan.formats[0]: a format is one of qr_code, data_matrix, ean_13, ean_8, upc_a, upc_e, code_128, code_39',
    ]);
    expect(problems(page({ field: 'lot', options: { scan: { part: 'lot' } } }))).toEqual(['layout.children[0].options.scan.part: a GS1 part is its Application Identifier, two to four digits: "10" a lot, "17" an expiry, "01" a GTIN']);
    expect(problems(page({ field: 'lot', options: { scan: { camera: 'front' } } }))).toEqual(['layout.children[0].options.scan: Unrecognized key: "camera"']);
    expect(problems(page({ field: 'line_ids', cells: { lot: { options: { scan: { formats: [] } } } } }))).toEqual(['layout.children[0].cells.lot.options.scan.formats: Too small: expected array to have >=1 items']);
  });

  it('refuses a kind no code is written into, and settings the field cannot take', () => {
    const at = 'layout.children[0].options.scan';
    for (const check of [problems, checked]) {
      expect(check(page({ field: 'done', options: { scan: true } }))).toEqual([`${at}: scan is for a char, text or many2one field drawn as its box, or a table of lines that counts what is scanned; "done" is a boolean`]);
      expect(check(page({ field: 'lot', widget: 'tags', options: { scan: true } }))).toEqual([`${at}: scan is for a char, text or many2one field drawn as its box, or a table of lines that counts what is scanned; "lot" is a char drawn as tags`]);
      expect(check(page({ field: 'lot', options: { scan: { by: 'barcode' } } }))).toEqual([`${at}.by: by names the field holding a linked record's code: for a many2one; "lot" is a char`]);
      expect(check(page({ field: 'lot', options: { scan: { count: 'n' } } }))).toEqual([`${at}.count: count is for a table of lines that counts what is scanned; "lot" is a char`]);
    }
  });

  it("refuses fills that name no field, the field itself, or a field that cannot take a code's part", () => {
    const at = 'layout.children[0].options.scan.fills';
    for (const check of [problems, checked]) {
      expect(check(page({ field: 'lot', options: { scan: { fills: { expires: '17' } } } }))).toEqual([`${at}.expires: no field "expires"`]);
      expect(check(page({ field: 'lot', options: { scan: { fills: { lot: '10' } } } }))).toEqual([`${at}.lot: "lot" is the field scanned: its own part is "part"`]);
      expect(check(page({ field: 'lot', options: { scan: { fills: { photo: '21' } } } }))).toEqual([`${at}.photo: "photo" is a binary; a GS1 part is written into words, a number, a day or a link`]);
      expect(check(page({ field: 'lot', options: { scan: { fills: { expiry: { part: '17', by: 'code' } } } } }))).toEqual([`${at}.expiry.by: by names the field holding a linked record's code: for a many2one; "expiry" is a date`]);
    }
  });

  it('refuses a table counted without its column and its count, or by columns that cannot be', () => {
    const at = 'layout.children[0].options.scan';
    for (const check of [problems, checked]) {
      expect(check(page({ field: 'line_ids', options: { scan: true } }))).toEqual([`${at}: a table of lines scanned into counts what a code names: say its column ("field") and the column counted ("count")`]);
      expect(check(page({ field: 'line_ids', options: { scan: { field: 'item', count: 'counted' } } }))).toEqual([`${at}.field: no field "item"`]);
      expect(check(page({ field: 'line_ids', options: { scan: { field: 'expiry', count: 'counted' } } }))).toEqual([`${at}.field: "expiry" is a date; a code names words (a char column) or a record (a many2one)`]);
      expect(check(page({ field: 'line_ids', options: { scan: { field: 'product_id', count: 'lot' } } }))).toEqual([`${at}.count: "lot" is a char; what is counted is a number (an integer column)`]);
      expect(check(page({ field: 'line_ids', options: { scan: { field: 'product_id', count: 'counted', fills: { counted: '30' } } } }))).toEqual([`${at}.fills.counted: "counted" is the column counted`]);
    }
  });

  it("checks a table's column scanned into by the line's fields", () => {
    const at = 'layout.children[0].cells';
    for (const check of [problems, checked]) {
      expect(check(page({ field: 'line_ids', cells: { lot: { options: { scan: { fills: { expiry: '17', price: '392' } } } } } }))).toEqual([`${at}.lot.options.scan.fills.price: no field "price"`]);
      expect(check(page({ field: 'line_ids', cells: { expiry: { options: { scan: true } } } }))).toEqual([`${at}.expiry.options.scan: scan is for a char, text or many2one field drawn as its box, or a table of lines that counts what is scanned; "expiry" is a date`]);
    }
  });
});
