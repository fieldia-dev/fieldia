import type { Page } from './page';
import { checkPage } from './check-page';
import { validatePage } from './validate';
import { createForm } from '../record/form';

/** How a page of responses is gone through, as its check reads it: a review before sending on a page of responses only. */

const intake = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.12',
  id: 'intake',
  data: { kind: 'responses' },
  fields: { name: { type: 'char', label: 'Your name' } },
  layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'q-name', field: 'name' }] },
  ...more,
});
const issues = (page: Page) => (checkPage(page).ok ? [] : (checkPage(page) as { issues: { path: string; message: string }[] }).issues.map((issue) => `${issue.path}: ${issue.message}`));

describe('how a page of responses is gone through', () => {
  it('reviews its answers before sending: true, or its own heading and words; a record’s page none', () => {
    expect(validatePage(intake({ review: true })).ok).toBe(true);
    expect(validatePage(intake({ review: { title: 'Before you send', text: 'Press Edit to change one.' } })).ok).toBe(true);
    expect(validatePage(intake({ review: { title: '' } })).ok).toBe(false);
    expect(issues(intake({ review: true, data: { kind: 'record', model: 'lead' } }))).toEqual(['review: a review before sending is for a page of responses: a record is saved as it is changed']);
  });

  it('asks one question at a time on a page of responses in sections or steps', () => {
    expect(validatePage(intake({ flow: 'one' })).ok).toBe(true);
    expect(validatePage(intake({ flow: 'all' as 'one' })).ok).toBe(false);
    expect(issues(intake({ flow: 'one', data: { kind: 'record', model: 'lead' } }))).toEqual(['flow: one question at a time is for a page of responses in sections or steps: a record’s sheet shows its fields together']);
  });

  it('checks the answers inside one part alone: a step, a question shown on its own', () => {
    const page = intake({ fields: { name: { type: 'char', label: 'Your name', required: true }, phone: { type: 'char', label: 'Phone', required: true } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'q-name', field: 'name' }, { type: 'field', id: 'q-phone', field: 'phone' }] } });
    const form = createForm({ page });
    form.setValues({ name: 'Mona' });
    expect(form.validate('q-name')).toBe(true);
    expect(form.getState().errors).toEqual({});
    expect(form.validate('q-phone')).toBe(false);
    expect(Object.keys(form.getState().errors)).toEqual(['phone']);
    expect(form.validate()).toBe(false);
  });
});
