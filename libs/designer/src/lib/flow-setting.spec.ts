import { validatePage } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges } from './designer';
import { mount, openTab } from './test-editor';

/**
 * How a form of responses is gone through, as the designer sets it on its Rules tab: a review of the answers before
 * they are sent, with its own heading. A record's screen has none; each change is one undo, listed as Publish lists it.
 */

afterEach(() => document.body.replaceChildren());
const rowOf = (panel: HTMLElement, name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;

function responses() {
  const page = blankPage('screen', 'Clinic intake');
  page.data = { kind: 'responses' };
  const designer = createDesigner({ page });
  designer.select(null);
  const { host } = mount(designer, { mode: 'advanced' });
  const panel = host.querySelector('.fd-properties') as HTMLElement;
  openTab(panel, 'Rules');
  return { designer, panel };
}

describe('how a form is gone through, in the designer', () => {
  it('reviews the answers before sending, in Fieldia’s words or its own heading', () => {
    const { designer, panel } = responses();
    const before = designer.getPage();
    expect(rowOf(panel, 'Review’s heading').hidden).toBe(true);
    (rowOf(panel, 'Review before sending').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().review).toBe(true);
    expect(rowOf(panel, 'Review’s heading').hidden).toBe(false);
    const heading = rowOf(panel, 'Review’s heading').querySelector('input') as HTMLInputElement;
    heading.value = 'Before you send';
    heading.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().review).toEqual({ title: 'Before you send' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('It shows every answer before it is sent');
    heading.value = '';
    heading.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().review).toBe(true);
    (rowOf(panel, 'Review before sending').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().review).toBeUndefined();
    const sheet = createDesigner({ page: blankPage('screen', 'Customer') });
    expect(sheet.setFlowOne(true)).toBe(false);
    expect(sheet.getState().issues[0]).toBe('One question at a time is for a form that collects responses, in sections or pages');
    expect(sheet.setReview({})).toBe(false);
    expect(sheet.getState().issues[0]).toBe('A review before sending is for a form that collects responses: a record is saved as it is changed');
  });

  it('asks one question at a time', () => {
    const { designer, panel } = responses();
    const before = designer.getPage();
    (rowOf(panel, 'One question at a time').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().flow).toBe('one');
    expect(validatePage(designer.getPage()).ok).toBe(true);
    expect(pageChanges(before, designer.getPage())).toContain('It asks one question at a time');
    (rowOf(panel, 'One question at a time').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().flow).toBeUndefined();
  });
});
