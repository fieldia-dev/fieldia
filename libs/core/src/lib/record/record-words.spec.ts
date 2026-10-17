import { checkPage } from '../format/check-page';
import type { Page } from '../format/page';
import type { PageRecords } from '../format/records';
import { localizePage, pageWords } from '../format/translate';
import { FORMAT_VERSION } from '../format/version';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { MESSAGES } from './messages';
import { recordSentence } from './record-words';

/**
 * A page names its records (`records`): what one is called, what more are, and one with its article. Fieldia's own
 * sentences say them where they said "record" — the form's questions before Archive and Delete, why it may not, why a
 * run stopped, what letting changes go asks — and, without it, read as they did.
 */

const customers: PageRecords = { one: 'customer', other: 'customers', a: 'a customer' };

const customer: Page = {
  fieldia: FORMAT_VERSION,
  id: 'customer',
  title: 'Customer',
  data: { kind: 'record', model: 'partner' },
  fields: { name: { type: 'char', label: 'Name' }, active: { type: 'boolean', label: 'Active' } },
  layout: {
    type: 'sheet',
    id: 'sheet',
    toolbar: { menu: [{ id: 'm-archive', builtin: 'archive' }, { id: 'm-delete', builtin: 'delete' }] },
    children: [{ type: 'field', id: 'f-name', field: 'name' }],
  },
  records: customers,
};
const people = (can?: { edit?: boolean; delete?: boolean }) =>
  createMemoryDataSource({ records: { partner: { 1: { name: 'Nile Traders', active: true } } }, ...(can ? { can: { partner: () => can } } : {}) });

describe('a sentence in the words a page names its records by', () => {
  it('fills in one, more and one with its article, leaving the rest for its own fill', () => {
    expect(recordSentence(customers, 'Delete this {record}?', 'Delete this record?')).toBe('Delete this customer?');
    expect(recordSentence(customers, '{n} {records} imported.', '{n} records imported.')).toBe('{n} customers imported.');
    expect(recordSentence(customers, '{aRecord} with this {fields} already exists', 'A record with this {fields} already exists')).toBe('A customer with this {fields} already exists');
  });

  it('starts a sentence its noun begins with a capital, in the language’s own way', () => {
    expect(recordSentence(customers, '{records}', 'Records')).toBe('Customers');
    expect(recordSentence({ one: 'işlem', other: 'işlemler' }, '{records}', 'Kayıtlar', 'tr')).toBe('İşlemler');
    expect(recordSentence({ one: 'عميل', other: 'عملاء' }, '{records}', 'السجلات', 'ar')).toBe('عملاء');
  });

  it('is the plain sentence where the page names none, the language has none, or it needs an article the page left out', () => {
    expect(recordSentence(undefined, 'Delete this {record}?', 'Delete this record?')).toBe('Delete this record?');
    expect(recordSentence(customers, undefined, 'Delete this record?')).toBe('Delete this record?');
    expect(recordSentence({ one: 'invoice', other: 'invoices' }, '{aRecord} with this {fields} already exists', 'A record with this {fields} already exists')).toBe('A record with this {fields} already exists');
  });
});

describe('the page format: what its records are called', () => {
  it('is read with one and more, and with an article and small labels where given', () => {
    expect(validatePage(customer).ok).toBe(true);
    expect(validatePage({ ...customer, records: { ...customers, lowerLabels: true } }).ok).toBe(true);
  });

  it('refuses words for one or more left out or blank, in the full check and the quick one', () => {
    const blank = { ...customer, records: { one: ' ', other: 'customers' } } as unknown as Page;
    expect(validatePage(blank).ok).toBe(false);
    expect(validatePage({ ...customer, records: { one: 'customer' } } as unknown as Page).ok).toBe(false);
    const quick = checkPage({ ...customer, records: { one: 'customer', a: '' } } as unknown as Page);
    expect(quick.ok ? [] : quick.issues.map((issue) => issue.path)).toEqual(['records.other', 'records.a']);
  });

  it('is words to translate: listed for a translator, and shown in the page’s language', () => {
    expect(pageWords(customer)).toEqual(expect.arrayContaining(['customer', 'customers', 'a customer']));
    const arabic = localizePage({ ...customer, records: { ...customers, lowerLabels: true }, translations: { ar: { customer: 'عميل', customers: 'عملاء', 'a customer': 'عميل' } } }, 'ar');
    expect(arabic.records).toEqual({ one: 'عميل', other: 'عملاء', a: 'عميل', lowerLabels: true });
  });
});

describe('the form’s sentences on a page that names its records', () => {
  it('asks before it archives or deletes this customer', async () => {
    const asked: string[] = [];
    const form = createForm({ page: customer, dataSource: people(), recordId: 1, confirm: (message) => (asked.push(message), false) });
    await form.load();
    await form.runAction('m-archive');
    await form.runAction('m-delete');
    expect(asked).toEqual(['Are you sure that you want to archive this customer?', 'Are you sure you want to delete this customer?']);
  });

  it('says this customer may only be read, may not be deleted, and asks before changes to it go', async () => {
    const form = createForm({ page: customer, dataSource: people({ edit: false }), recordId: 1 });
    await form.load();
    expect(await form.save()).toBe(false);
    expect(form.getState().error).toBe('You can read this customer, but not change it.');
    const kept = createForm({ page: customer, dataSource: people({ delete: false }), recordId: 1 });
    await kept.load();
    expect((await kept.run([{ do: 'delete' }])).message).toBe('You cannot delete this customer.');
    // A change made while its save was on its way is the person's work, at risk: letting it go asks first.
    const asked: string[] = [];
    const source = people();
    let release = () => undefined as void;
    let reached = () => undefined as void;
    const onItsWay = new Promise<void>((resolve) => (reached = resolve));
    const held = {
      ...source,
      save: async (request: Parameters<NonNullable<typeof source.save>>[0]) => {
        reached();
        await new Promise<void>((resolve) => (release = resolve));
        return source.save!(request);
      },
    };
    const leaving = createForm({ page: customer, dataSource: held, recordId: 1, confirm: (message) => (asked.push(message), false) });
    await leaving.load();
    leaving.setValue('name', 'Nile Traders Co.');
    const saving = leaving.save();
    await onItsWay;
    leaving.setValue('name', 'Nile Traders Group');
    release();
    expect(await saving).toBe(true);
    expect(await leaving.leave()).toBe(false);
    expect(asked).toEqual(['Discard your changes to this customer?']);
  });

  it('reads as before without them, and in a language with no such sentence, its own', async () => {
    const asked: string[] = [];
    const plain = createForm({ page: { ...customer, records: undefined }, dataSource: people(), recordId: 1, confirm: (message) => (asked.push(message), false) });
    await plain.load();
    await plain.runAction('m-delete');
    const french = createForm({ page: customer, dataSource: people(), recordId: 1, messages: MESSAGES.fr, confirm: (message) => (asked.push(message), false) });
    await french.load();
    await french.runAction('m-delete');
    expect(asked).toEqual([MESSAGES.en.deleteConfirm, MESSAGES.fr.deleteConfirm]);
  });
});
