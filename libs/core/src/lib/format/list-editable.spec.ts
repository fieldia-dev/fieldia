import { editableColumns, validatePage, type ListNode, type Page } from '../../index';

/**
 * A list whose cells are changed in place (`editable`, off unless given): with true, every column a box in a cell can
 * change; with `fields`, those of them; and the page check refuses a column it cannot change, one the list does not
 * show, one the page lacks, and true where no column can be changed.
 */

const fields = {
  name: { type: 'char', label: 'Service' },
  price: { type: 'monetary', label: 'Price', currency: 'EGP', min: 0 },
  minutes: { type: 'integer', label: 'Minutes' },
  per_hour: { type: 'float', label: 'Per hour', compute: 'price / minutes * 60' },
  code: { type: 'char', label: 'Code', readonly: true },
  lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { name: { type: 'char', label: 'Name' } } },
  photo: { type: 'image', label: 'Photo' },
  kind: { type: 'selection', label: 'Kind', options: [{ value: 'face', label: 'Face' }] },
  since: { type: 'date', label: 'Since' },
};

const page = (list: Record<string, unknown>, columns = ['name', 'price', 'minutes', 'per_hour', 'code', 'lines', 'photo', 'kind']) => ({
  fieldia: '0.7',
  id: 'prices',
  data: { kind: 'record', model: 'service' },
  fields,
  layout: { type: 'list', id: 'list', columns, ...list },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const changed = (list: Record<string, unknown>, columns?: string[]) => {
  const p = page(list, columns) as unknown as Page;
  return editableColumns(p, p.layout as ListNode);
};

describe('a list’s cells changed in place, as the page says them', () => {
  it('takes true, false, or its fields and whether a row is added', () => {
    expect(problems(page({ editable: true }))).toEqual([]);
    expect(problems(page({ editable: false }))).toEqual([]);
    expect(problems(page({ editable: { fields: ['price', 'minutes'] } }))).toEqual([]);
    expect(problems(page({ editable: { add: false } }))).toEqual([]);
    expect(problems(page({ editable: { fields: ['price'], add: true } }))).toEqual([]);
  });

  it('changes nothing unless asked; with true, every column a cell can change; with fields, those of them, in the list’s order', () => {
    expect(changed({})).toEqual([]);
    expect(changed({ editable: false })).toEqual([]);
    // Worked out, read-only, a table of lines, a picture: never changed in a cell.
    expect(changed({ editable: true })).toEqual(['name', 'price', 'minutes', 'kind']);
    expect(changed({ editable: { add: false } })).toEqual(['name', 'price', 'minutes', 'kind']);
    expect(changed({ editable: { fields: ['minutes', 'price'] } })).toEqual(['price', 'minutes']);
    // A field the list does not show is no cell of it.
    expect(changed({ editable: { fields: ['since', 'price'] } })).toEqual(['price']);
  });

  it('refuses a column a cell cannot change, one the list lacks, one named twice or no field at all', () => {
    expect(problems(page({ editable: { fields: ['per_hour', 'code', 'lines', 'photo', 'since', 'nope', 'price', 'price'] } }))).toEqual([
      'layout.editable.fields[0]: "per_hour" is worked out from other fields; a cell changes a field people can change',
      'layout.editable.fields[1]: "code" is read-only; a cell changes a field people can change',
      'layout.editable.fields[2]: "lines" is a one2many; a cell changes words, a number, money, a yes or no, a date, a choice, or a link or links',
      'layout.editable.fields[3]: "photo" is a image; a cell changes words, a number, money, a yes or no, a date, a choice, or a link or links',
      'layout.editable.fields[4]: "since" is no column of this list: a cell changed in place is one of its columns',
      expect.stringMatching(/^layout\.editable\.fields\[5\]: .*nope/),
      'layout.editable.fields[7]: "price" is named twice',
    ]);
  });

  it('never changes a text kept in several languages in a cell, and refuses one named, with words', () => {
    // Each of its languages a person's to type under its switch, on the record's page: a cell holds one box.
    const bilingual = { ...fields, title: { type: 'char', label: 'Title', translate: ['ar', 'en'] } };
    const listed = (list: Record<string, unknown>) => ({ ...page(list, ['title', 'price']), fields: bilingual });
    const p = listed({ editable: true }) as unknown as Page;
    expect(editableColumns(p, p.layout as ListNode)).toEqual(['price']);
    expect(problems(listed({ editable: true }))).toEqual([]);
    expect(problems(listed({ editable: { fields: ['title', 'price'] } }))).toEqual([
      'layout.editable.fields[0]: "title" is kept in several languages (translate); a cell holds one box, so its languages are typed on the record\'s page, under their switch',
    ]);
    // Alone, nothing a cell can change: true is refused as over any other such columns.
    expect(problems({ ...page({ editable: true }, ['title']), fields: bilingual })).toEqual([
      'layout.editable: its cells change the columns a box in a cell can, and none of these can: words, a number, money, yes or no, a date, a choice or a link people can change',
    ]);
  });

  it('refuses true over columns none of which a cell can change, and fields named none', () => {
    expect(problems(page({ editable: true }, ['per_hour', 'code', 'lines']))).toEqual([
      'layout.editable: its cells change the columns a box in a cell can, and none of these can: words, a number, money, yes or no, a date, a choice or a link people can change',
    ]);
    expect(problems(page({ editable: { fields: [] } })).length).toBeGreaterThan(0);
    expect(problems(page({ editable: { add: 'yes' } })).length).toBeGreaterThan(0);
  });
});
