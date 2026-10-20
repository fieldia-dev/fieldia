import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import type { ResolvedFilter } from './data-source';
import { MESSAGES } from './messages';
import { hasLanguages } from './languages';
import { checkTranslated, languagesAtFault, textIn } from './languages-part';
import { isEmpty } from './values';

/**
 * One field holding its text in two languages, each typed by a person (`translate`): a listing's title in Arabic and
 * English, its description in both, a service's name — its value `{ ar, en }`, required in the languages the page says,
 * each language within the field's most characters, read in the reader's language else another's (said to be another's),
 * and found by a search in either. Nothing is translated by a machine.
 */

const listing = (more: Partial<Page> = {}, fields: Partial<Page['fields']> = {}): Page =>
  ({
    fieldia: '0.7',
    id: 'listing',
    data: { kind: 'record', model: 'listing' },
    fields: {
      title: { type: 'char', label: 'Title', translate: ['ar', 'en'], required: true, size: 20 },
      description: { type: 'text', label: 'Description', translate: ['ar', 'en'], required: true, requiredIn: ['en'] },
      notes: { type: 'html', label: 'Notes', translate: ['en', 'ar'] },
      price: { type: 'monetary', label: 'Price', currency: 'EGP' },
      ...fields,
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'f-title', field: 'title' },
        { type: 'field', id: 'f-description', field: 'description' },
        { type: 'field', id: 'f-notes', field: 'notes' },
        { type: 'field', id: 'f-price', field: 'price' },
      ],
    },
    ...more,
  }) as Page;

const issues = (page: unknown) => {
  const found = [validatePage(page), checkPage(page)].map((check) => (check.ok ? [] : check.issues.map((issue) => `${issue.path}: ${issue.message}`)));
  return found.flat();
};

describe('the format: a text kept in several languages', () => {
  it('takes translate on a line, a paragraph and formatted text, requiredIn among its languages', () => {
    expect(issues(listing())).toEqual([]);
    expect(hasLanguages(listing())).toBe(true);
    expect(hasLanguages(listing({}, { title: { type: 'char', label: 'Title' }, description: { type: 'text', label: 'D' }, notes: { type: 'html', label: 'N' } }))).toBe(false);
  });

  it('refuses one language, a language twice, a tag that is none, and requiredIn outside its languages or without them', () => {
    expect(validatePage(listing({}, { title: { type: 'char', label: 'Title', translate: ['ar'] } })).ok).toBe(false);
    expect(issues(listing({}, { title: { type: 'char', label: 'Title', translate: ['ar', 'AR'] } }))).toContain('fields.title.translate: "AR" is named twice: each language once');
    expect(validatePage(listing({}, { title: { type: 'char', label: 'Title', translate: ['arabic', 'english'] } })).ok).toBe(false);
    expect(issues(listing({}, { title: { type: 'char', label: 'Title', translate: ['ar', 'en'], required: true, requiredIn: ['fr'] } }))).toContain('fields.title.requiredIn[0]: "fr" is not one of the languages it is kept in (translate)');
    expect(issues(listing({}, { title: { type: 'char', label: 'Title', required: true, requiredIn: ['en'] } }))).toContain('fields.title.requiredIn: requiredIn says which of a text’s languages are required: name them in translate');
  });

  it('keeps a table’s line in one language', () => {
    const page = listing({}, { rooms: { type: 'one2many', label: 'Rooms', relation: 'room', fields: { name: { type: 'char', label: 'Name', translate: ['ar', 'en'] } as never } } });
    expect(issues(page).join('\n')).toContain('a table’s line keeps its text in one language');
  });

  it('places it as words people type, never as an email or tags; requiredIn only on a required text', () => {
    const shown = listing({ layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-title', field: 'title', widget: 'email' }] } });
    expect(issues(shown)).toContain('layout.children[0].widget: "title" keeps its text in several languages, each typed by a person: it is a line, a paragraph or formatted text, never shown as email');
    const loose = listing({}, { description: { type: 'text', label: 'Description', translate: ['ar', 'en'], requiredIn: ['en'] } });
    expect(issues(loose)).toContain('fields.description.requiredIn: requiredIn says which languages a required answer is typed in: make it required, by the field or where it is placed');
    // Required where it is placed: requiredIn says the languages there.
    const placedRequired = listing({ layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-description', field: 'description', required: 'price > 0' }] } }, { description: { type: 'text', label: 'Description', translate: ['ar', 'en'], requiredIn: ['en'] } });
    expect(issues(placedRequired)).toEqual([]);
  });
});

describe('the demos’ pages', () => {
  it.each(['listing-languages', 'services-languages', 'service-languages'])('%s passes the format and its checks', (name) => {
    const page = JSON.parse(readFileSync(join(__dirname, `../../../../../examples/pages/${name}.page.json`), 'utf8'));
    expect(issues(page)).toEqual([]);
    expect(hasLanguages(page)).toBe(true);
  });
});

describe('a text in the reader’s language', () => {
  const title = { ar: 'فيلا على البحر', en: 'Sea-view villa' };

  it('is the reader’s where it was typed there, by its tag or the same language’s', () => {
    expect(textIn(title, 'ar')).toEqual({ text: 'فيلا على البحر', language: 'ar', other: false });
    expect(textIn(title, 'en-GB')).toEqual({ text: 'Sea-view villa', language: 'en', other: false });
  });

  it('else the first of the field’s languages typed, said to be another’s; a plain text itself; none for nothing', () => {
    expect(textIn({ en: 'Sea-view villa' }, 'ar', ['ar', 'en'])).toEqual({ text: 'Sea-view villa', language: 'en', other: true });
    expect(textIn(title, 'fr', ['en', 'ar'])).toEqual({ text: 'Sea-view villa', language: 'en', other: true });
    expect(textIn({ ar: '  ', en: 'Villa' }, 'ar')).toEqual({ text: 'Villa', language: 'en', other: true });
    expect(textIn('Villa', 'ar')).toEqual({ text: 'Villa', other: false });
    expect(textIn({}, 'ar')).toBeNull();
    expect(textIn(null, 'ar')).toBeNull();
  });
});

describe('a text in several languages, checked in each', () => {
  const page = listing();
  const def = page.fields['title'];

  it('is empty when typed in none of them', () => {
    expect(isEmpty(def, { ar: '', en: '  ' })).toBe(true);
    expect(isEmpty(def, {})).toBe(true);
    expect(isEmpty(def, { en: 'Villa' })).toBe(false);
  });

  it('is required in every language unless requiredIn says which, named in the page’s language', () => {
    expect(checkTranslated(def, { en: 'Sea-view villa' }, true)).toBe('Title is required in Arabic');
    expect(checkTranslated(def, { ar: 'فيلا', en: 'Villa' }, true)).toBeUndefined();
    expect(checkTranslated(def, {}, true)).toBe('Title is required');
    expect(checkTranslated(def, { en: 'Villa' }, false)).toBeUndefined();
    const description = page.fields['description'];
    expect(checkTranslated(description, { ar: 'وصف' }, true)).toBe('Description is required in English');
    expect(checkTranslated(description, { en: 'A villa' }, true)).toBeUndefined();
    const three = { ...def, translate: ['ar', 'en', 'fr'] } as typeof def;
    expect(checkTranslated(three, { en: 'Villa' }, true)).toBe('Title is required in Arabic and French');
    expect(checkTranslated(def, { en: 'Villa' }, true, MESSAGES.ar)).toBe('Title مطلوب باللغة العربية');
    expect(checkTranslated({ ...def, label: 'What is it called?' } as typeof def, { ar: 'فيلا' }, true)).toBe('Please answer “What is it called?” in English');
  });

  it('keeps each language within the field’s most characters, naming the language; a plain text is its first language’s', () => {
    expect(checkTranslated(def, { ar: 'فيلا', en: 'A sea-view villa in New Cairo' }, true)).toBe('Title (English) is 9 characters too long: shorten it to 20');
    expect(checkTranslated(def, 'فيلا', false)).toBeUndefined();
    expect(checkTranslated(def, { ar: 4 } as never, false)).toBe('Title must be text');
    expect(languagesAtFault(def, { en: 'A sea-view villa in New Cairo' }, true)).toEqual(['ar', 'en']);
    expect(languagesAtFault(def, { ar: 'فيلا', en: 'Villa' }, true)).toEqual([]);
  });

  it('is what a form says and refuses to save until each language a required answer needs is typed', async () => {
    const source = createMemoryDataSource({ records: { listing: {} } });
    const form = createForm({ page, dataSource: source });
    await form.settled();
    form.setValue('title', { en: 'Sea-view villa' });
    form.setValue('description', { en: 'Four bedrooms, a garden and a pool.' });
    await form.save();
    expect(form.getState().errors['title']).toBe('Title is required in Arabic');
    expect(source.calls.filter((call) => call.method === 'save')).toEqual([]);
    form.setValue('title', { ar: 'فيلا على البحر', en: 'Sea-view villa' });
    await form.save();
    expect(form.getState().errors).toEqual({});
    const [saved] = source.calls.filter((call) => call.method === 'save');
    expect((saved.request as { values: Record<string, unknown> }).values['title']).toEqual({ ar: 'فيلا على البحر', en: 'Sea-view villa' });
  });
});

describe('found in either language', () => {
  const homes = () =>
    createMemoryDataSource({
      records: {
        home: {
          1: { title: { ar: 'فيلا على البحر', en: 'Sea-view villa' }, address: { street: 'Nile St', city: 'Cairo' } },
          2: { title: { ar: 'شقة في الزمالك' }, address: null },
          3: { title: 'Studio in Maadi', address: null },
        },
      },
    });
  const found = async (filter: ResolvedFilter[]) => (await homes().list({ model: 'home', fields: ['title'], filter, sort: [], offset: 0, limit: 10 })).records.map((record) => record.id);

  it('a search’s words in either language, Arabic in any of its letters’ forms; a text in one language as before', async () => {
    expect(await found([{ field: 'title', op: 'ilike', value: 'villa' }])).toEqual([1]);
    expect(await found([{ field: 'title', op: 'ilike', value: 'فيلا' }])).toEqual([1]);
    expect(await found([{ field: 'title', op: 'ilike', value: 'الزمالك' }])).toEqual([2]);
    expect(await found([{ field: 'title', op: 'ilike', value: 'studio' }])).toEqual([3]);
    expect(await found([{ field: 'title', op: '=', value: 'Sea-view villa' }])).toEqual([1]);
    expect(await found([{ any: [{ field: 'title', op: 'ilike', value: 'شقة' }, { field: 'title', op: 'ilike', value: 'studio' }] }])).toEqual([2, 3]);
    // An address in parts is no text in languages: its parts are not languages' tags, and it is searched as before.
    expect(await found([{ field: 'address', op: 'ilike', value: 'Cairo' }])).toEqual([]);
  });

  it('a memory source’s list, its links’ names in its reader’s language, found by either, sorted in it', async () => {
    const source = createMemoryDataSource({
      language: 'ar',
      records: {
        service: {
          1: { name: { ar: 'تنظيف الأسنان', en: 'Teeth cleaning' } },
          2: { name: { ar: 'تبييض', en: 'Whitening' } },
          3: { name: { en: 'Check-up' } },
        },
      },
    });
    expect((await source.search({ model: 'service', query: 'whiten' })).map((found) => found.label)).toEqual(['تبييض']);
    expect((await source.search({ model: 'service', query: 'check' })).map((found) => found.label)).toEqual(['Check-up']);
    const listed = await source.list({ model: 'service', fields: ['name'], filter: [{ field: 'name', op: 'ilike', value: 'cleaning' }], sort: [], offset: 0, limit: 10 });
    expect(listed.records.map((record) => record.id)).toEqual([1]);
    const sorted = await source.list({ model: 'service', fields: ['name'], filter: [], sort: [{ field: 'name' }], offset: 0, limit: 10 });
    expect(sorted.records.map((record) => record.id)).toEqual([3, 2, 1]);
  });
});
