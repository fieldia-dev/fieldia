import type { Page } from '../format/page';
import { validatePage } from '../format/validate';
import { createForm } from './form';

/** Words in an empty box chosen by a condition, as Flectra's contact: a company's name or a person's. */
const contact = {
  fieldia: '0.1',
  id: 'contact',
  title: 'Contact',
  data: { kind: 'record', model: 'res.partner' },
  fields: {
    name: { type: 'char', label: 'Name' },
    is_company: { type: 'boolean', label: 'Is a company' },
    email: { type: 'char', label: 'Email' },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    title: { field: 'name', placeholder: 'e.g. Brandom Freeman', placeholderWhen: [{ when: 'is_company', text: 'e.g. Lumber Inc' }] },
    children: [
      { type: 'field', id: 'f-company', field: 'is_company' },
      { type: 'field', id: 'f-email', field: 'email', placeholderWhen: [{ when: 'is_company', text: 'info@company.example' }, { when: 'name', text: 'you@example.com' }] },
    ],
  },
} as unknown as Page;

describe('words in an empty box chosen by a condition', () => {
  it('are the first that holds, else the placeholder, again as the record changes', () => {
    expect(validatePage(contact)).toMatchObject({ ok: true });
    const form = createForm({ page: contact });
    expect(form.placeholder('#title')).toBe('e.g. Brandom Freeman');
    expect(form.placeholder('f-email')).toBeUndefined();
    form.setValue('name', 'Mona');
    expect(form.placeholder('f-email')).toBe('you@example.com');
    form.setValue('is_company', true);
    expect(form.placeholder('#title')).toBe('e.g. Lumber Inc');
    expect(form.placeholder('f-email')).toBe('info@company.example');
    expect(form.placeholder('f-company')).toBeUndefined();
  });

  it('read fields of the page, checked as any condition', () => {
    const bad = JSON.parse(JSON.stringify(contact));
    bad.layout.title.placeholderWhen[0].when = 'is_compny';
    expect(validatePage(bad)).toMatchObject({ ok: false, issues: [{ path: 'layout.title.placeholderWhen[0].when' }] });
  });
});
