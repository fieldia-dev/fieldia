import type { Page } from '../format/page';
import { createForm } from './form';
import { formLanguagesPart } from './languages';
import { createMemoryDataSource } from './memory-data-source';

/**
 * Before the languages part has come (languages.ts, `formLanguagesPart`): a text kept in several languages is checked
 * in each by a part a page with one asks for. A form made before it came says nothing of a language missing — never a
 * wrong word — and a save waits for it: never a listing saved without its Arabic title. This file starts with no part
 * loaded.
 */

const page = (translate = true): Page =>
  ({
    fieldia: '0.10',
    id: 'service',
    data: { kind: 'record', model: 'service' },
    fields: { name: { type: 'char', label: 'Service', required: true, ...(translate ? { translate: ['en', 'ar'] } : {}) } },
    layout: { type: 'sections', id: 's', children: [{ type: 'field', id: 'f-name', field: 'name' }] },
  }) as Page;

describe("a form's languages part", () => {
  it('a page with no text in several languages never asks for it', async () => {
    const form = createForm({ page: page(false), dataSource: createMemoryDataSource() });
    form.setValue('name', 'Teeth cleaning');
    await form.save();
    expect(formLanguagesPart.loaded).toBeUndefined();
  });

  it('a page with one asks for it as its form is made; a save waits for it, and is refused in the language missing', async () => {
    const source = createMemoryDataSource();
    const form = createForm({ page: page(), dataSource: source });
    form.setValue('name', { en: 'Teeth cleaning' });
    // Before it came, a check says nothing it cannot say rightly.
    expect(formLanguagesPart.loaded).toBeUndefined();
    expect(form.getState().errors['name']).toBeUndefined();
    await form.save();
    expect(formLanguagesPart.loaded).toBeDefined();
    expect(form.getState().errors['name']).toBe('Service is required in Arabic');
    expect(source.calls.filter((call) => call.method === 'save')).toEqual([]);
  });
});
