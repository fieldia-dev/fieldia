import { createForm, pageWords, translatePage, validatePage, type ActionRequest, type ListNode, type Page } from '../../index';

/**
 * A list people read anywhere and shape themselves: its records as cards on a
 * phone and in a gallery (`card`, `gallery`), the columns a person may show,
 * hide, order and size (`optionalColumns`), and each row's own tone, bold and
 * buttons (`rowTones`, `rowBold`, `rowButtons`). The page says it all by field
 * names, so a missing field, a picture that holds none or a column that is no
 * column is refused here, before anything draws.
 */

const fields = {
  name: { type: 'char', label: 'Home' },
  company: { type: 'char', label: 'Company' },
  photo: { type: 'image', label: 'Photo' },
  photo_url: { type: 'char', label: 'Photo address' },
  price: { type: 'monetary', label: 'Price', currency: 'EGP' },
  bedrooms: { type: 'integer', label: 'Bedrooms' },
  area_m2: { type: 'integer', label: 'Area' },
  state: { type: 'selection', label: 'Status', options: [{ value: 'open', label: 'Open' }, { value: 'sold', label: 'Sold' }] },
  listed: { type: 'date', label: 'Listed' },
};

const page = (list: Record<string, unknown>) => ({
  fieldia: '0.5',
  id: 'homes',
  title: 'Homes',
  data: { kind: 'record', model: 'home' },
  fields,
  layout: { type: 'list', id: 'list', columns: ['name', 'price', 'state', 'listed'], ...list },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};

describe('a list as cards and a gallery', () => {
  it('takes a card of fields — title, subtitle, picture, lines, status — and a gallery', () => {
    expect(
      problems(
        page({
          card: {
            title: 'name',
            subtitle: 'company',
            image: 'photo',
            status: 'state',
            fields: ['price', ['bedrooms', { field: 'area_m2', unit: 'm²' }]],
            labels: false,
            lead: true,
          },
          gallery: { opens: 'gallery', size: 'large' },
        })
      )
    ).toEqual([]);
    // Everything from the columns; a picture's address as text.
    expect(problems(page({ card: {}, gallery: {} }))).toEqual([]);
    expect(problems(page({ card: { image: 'photo_url' } }))).toEqual([]);
  });

  it('refuses a field the page lacks, a picture of another kind, and a size or an opening it does not know', () => {
    expect(problems(page({ card: { title: 'nope', subtitle: 'gone', status: 'missing', fields: ['price', ['bedrooms', { field: 'floors' }]] } }))).toEqual([
      'layout.card.title: no field "nope"',
      'layout.card.subtitle: no field "gone"',
      'layout.card.status: no field "missing"',
      'layout.card.fields[1][1].field: no field "floors"',
    ]);
    expect(problems(page({ card: { image: 'price' } }))).toEqual([
      `layout.card.image: "price" is a monetary; a card's picture is an image or binary field, or text holding a picture's address`,
    ]);
    expect(problems(page({ gallery: { size: 'huge' } })).length).toBe(1);
    expect(problems(page({ gallery: { opens: 'map' } })).length).toBe(1);
    expect(problems(page({ card: { colour: 'state' } })).length).toBe(1);
  });

  it('opens on one thing: its gallery, or its map or its calendar', () => {
    const map = { latitude: 'bedrooms', longitude: 'area_m2', view: 'map' };
    expect(problems(page({ gallery: { opens: 'gallery' }, map }))).toEqual(['layout.gallery.opens: the list opens on its map (map.view) and on its gallery: say one']);
    expect(problems(page({ gallery: { opens: 'gallery' }, calendar: { start: 'listed', title: 'name', opens: 'calendar' } }))).toEqual([
      'layout.gallery.opens: the list opens on its calendar and on its gallery: say one',
    ]);
    expect(problems(page({ gallery: { opens: 'list' }, map }))).toEqual([]);
  });
});

describe('columns a person chooses', () => {
  it('takes columns of the list, each shown or hidden at first', () => {
    expect(problems(page({ optionalColumns: { price: 'show', listed: 'hide' } }))).toEqual([]);
  });

  it('refuses a column the list does not have, and every column hidden', () => {
    expect(problems(page({ optionalColumns: { bedrooms: 'show' } }))).toEqual(['layout.optionalColumns.bedrooms: "bedrooms" is no column of this list: a person shows or hides its columns']);
    expect(problems(page({ optionalColumns: { name: 'hide', price: 'hide', state: 'hide', listed: 'hide' } }))).toEqual([
      'layout.optionalColumns: every column starts hidden: show one at least, as the list opens',
    ]);
    expect(problems(page({ optionalColumns: { price: 'maybe' } })).length).toBe(1);
  });
});

describe('a row’s own tone, bold and buttons', () => {
  const rows = {
    rowTones: [
      { tone: 'danger', when: "state == 'sold'" },
      { tone: 'muted', when: 'not listed' },
    ],
    rowBold: 'price > 1000000',
    rowButtons: [{ type: 'button', id: 'book', label: 'Book a viewing', action: 'book_viewing', invisible: "state == 'sold'" }],
  };

  it('reads each condition on the row’s record', () => {
    expect(problems(page(rows))).toEqual([]);
  });

  it('refuses a condition reading a field the record lacks, a button with nothing to do, and an id used twice', () => {
    expect(
      problems(
        page({
          rowTones: [{ tone: 'danger', when: 'floors > 3' }],
          rowBold: 'garden',
          rowButtons: [
            { type: 'button', id: 'list', label: 'Twice' },
            { type: 'button', id: 'call', label: 'Call', action: 'call', invisible: 'not phone' },
          ],
        })
      )
    ).toEqual([
      'layout.rowTones[0].when: "floors > 3" reads "floors", which is not a field of this page',
      'layout.rowBold: "garden" reads "garden", which is not a field of this page',
      'layout.rowButtons[0]: duplicate id "list", also used at layout',
      'layout.rowButtons[0]: a button needs steps, an action, or both',
      'layout.rowButtons[1].invisible: "not phone" reads "phone", which is not a field of this page',
    ]);
  });

  it('runs a row’s button with that record, its condition left to the list', async () => {
    const asked: ActionRequest[] = [];
    const form = createForm({ page: page(rows) as Page, onAction: (request) => void asked.push(request) });
    await form.load();
    // Hidden on a sold home, but the form holds no home: the list reads it on each row.
    expect(form.node('book').invisible).toBe(false);
    const result = await form.runAction('book', { recordIds: [7] });
    expect(result.done).toBe(true);
    expect(asked).toEqual([expect.objectContaining({ action: 'book_viewing', recordIds: [7] })]);
  });
});

describe('a card’s words', () => {
  it('translates the words after its lines’ values, never the fields it names', () => {
    const homes = page({ card: { title: 'name', subtitle: 'company', fields: [{ field: 'bedrooms', unit: { one: 'bed', other: 'beds' } }, { field: 'area_m2', unit: 'm²' }] } }) as unknown as Page;
    const words = pageWords(homes);
    expect(words).toEqual(expect.arrayContaining(['bed', 'beds', 'm²']));
    expect(words).not.toContain('company');
    const translated = translatePage(homes, (text) => `«${text}»`);
    const card = (translated.layout as ListNode).card;
    expect(card?.title).toBe('name');
    expect(card?.subtitle).toBe('company');
    expect(card?.fields).toEqual([{ field: 'bedrooms', unit: { one: '«bed»', other: '«beds»' } }, { field: 'area_m2', unit: '«m²»' }]);
  });
});

describe('a list’s record as its row’s conditions read it', () => {
  it('reads the person, the app’s context and the record’s own id beside its values, as the form’s own conditions do', () => {
    const page = {
      fieldia: '0.5',
      id: 'contacts',
      data: { kind: 'record', model: 'contact' },
      fields: { name: { type: 'char', label: 'Name' }, owner_id: { type: 'many2one', label: 'Owner', relation: 'res.users' } },
      layout: { type: 'list', id: 'list', columns: ['name', 'owner_id'], rowBold: 'owner_id == user.id' },
    } as unknown as Page;
    const form = createForm({ page, user: { id: 9001, name: 'Mona Adel', roles: ['sales'] }, context: { team: 'north' } });
    const read = form.recordReads(7, { name: 'Omar Said', owner_id: { id: 9001, label: 'Mona Adel' } });
    expect(read).toEqual(expect.objectContaining({ id: 7, name: 'Omar Said', owner_id: 9001, user: { id: 9001, name: 'Mona Adel', roles: ['sales'] }, context: { team: 'north' }, editing: false }));
    // No one signed in: no id, no roles, as a form's own conditions read it.
    expect(createForm({ page }).recordReads(7, {})['user']).toEqual({ id: null, name: null, roles: [] });
  });
});
