import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount, openTab } from './test-editor';

/** An offline outbox (`outbox`), as the designer sets it: on a page's Rules tab, listed as Publish lists it, refused on a list. */

afterEach(() => document.body.replaceChildren());

describe('sends without signal, in the designer', () => {
  it('keeps them on the device from the Rules tab', () => {
    const page = blankPage('screen', 'Site visit');
    page.data = { kind: 'responses' };
    const designer = createDesigner({ page });
    designer.select(null);
    const before = designer.getPage();
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    const row = panel.querySelector('[data-setting="Without signal"]') as HTMLElement;
    expect(row.hidden).toBe(false);
    (row.querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().outbox).toBe(true);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('It keeps sends made without signal on the device');
    (row.querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().outbox).toBeUndefined();
  });

  it('is refused on a list of records', () => {
    const list = createDesigner({ page: blankPage('list', 'Visits') });
    expect(list.setOutbox(true)).toBe(false);
    expect(list.getState().issues[0]).toBe('An outbox keeps a form’s sends made without signal: a list of records sends none');
  });
});
