import { validatePage, type Field, type WizardNode } from '@fieldia/core';
import { blankPage, createDesigner, pageChanges, type Designer } from './designer';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { mount, openTab, typeAndLeave } from './test-editor';

/**
 * When a form takes answers and how many (`limits`), Continue later (`continueLater`), and a choice's places (`seats` on
 * its options), as the designer sets them: on the screen's Rules tab of a form of responses — opens and closes typed in
 * the designer's own date box, the most responses, one per person, its words once something says when or how many —
 * Continue later on any screen people type in; places for each option in a choice's settings. A record's screen has
 * no such dates; a close before the open is refused, said. Each change one undo, listed as Publish lists it.
 */

let survey: SurveyEditorHandle | null = null;
afterEach(() => {
  survey?.destroy();
  survey = null;
  document.body.replaceChildren();
});

/** A screen of responses — an event's sign-up — as the screen editor shows it. */
function signup(): Designer {
  const page = blankPage('screen', 'Founders evening');
  page.data = { kind: 'responses' };
  const designer = createDesigner({ page });
  designer.select(null);
  return designer;
}
const rowOf = (panel: HTMLElement, name: string) => panel.querySelector(`[data-setting="${name}"]`) as HTMLElement;

describe('a form’s opening, closing and limits in the designer', () => {
  it('are set on a form of responses’ Rules tab: opens, closes, most responses, one per person and its words', () => {
    const designer = signup();
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    const box = (name: string) => rowOf(panel, name).querySelector('input, textarea') as HTMLInputElement;
    expect(rowOf(panel, 'Words while it takes none').hidden).toBe(true);
    typeAndLeave(box('Opens on'), '2026-11-01 09:00');
    expect(designer.getPage().limits).toEqual({ opens: '2026-11-01T09:00' });
    typeAndLeave(box('Closes on'), '2026-11-20 18:00');
    typeAndLeave(box('Most responses'), '200');
    box('One response per person').click();
    expect(rowOf(panel, 'Words while it takes none').hidden).toBe(false);
    const words = box('Words while it takes none');
    words.value = 'See you in December.';
    words.dispatchEvent(new Event('input', { bubbles: true }));
    expect(designer.getPage().limits).toEqual({ opens: '2026-11-01T09:00', closes: '2026-11-20T18:00', maxResponses: 200, onePerPerson: true, message: 'See you in December.' });
    expect(validatePage(designer.getPage()).ok).toBe(true);
    // A close before the open is refused, in words, and what was there stays.
    expect(designer.setPageLimits({ closes: '2026-10-30T09:00' })).toBe(false);
    expect(designer.getState().issues[0]).toBe('It would close before it opens: pick a closing time after the opening');
    expect(designer.getPage().limits?.closes).toBe('2026-11-20T18:00');
    // Each emptied takes itself away; the last takes the setting and its words.
    designer.undo();
    expect(designer.getPage().limits?.message).toBeUndefined();
    for (const key of ['opens', 'closes', 'maxResponses', 'onePerPerson'] as const) designer.setPageLimits({ [key]: null });
    expect(designer.getPage().limits).toBeUndefined();
  });

  it('offers Continue later, listed as Publish lists it; and no dates on a record’s screen', () => {
    const designer = signup();
    const before = designer.getPage();
    const { host } = mount(designer, { mode: 'advanced' });
    const panel = host.querySelector('.fd-properties') as HTMLElement;
    openTab(panel, 'Rules');
    (rowOf(panel, 'Continue later').querySelector('input') as HTMLInputElement).click();
    expect(designer.getPage().continueLater).toBe(true);
    designer.setPageLimits({ maxResponses: 50 });
    expect(pageChanges(before, designer.getPage())).toEqual(expect.arrayContaining(['It offers Continue later', 'It takes answers only when and as many as it says']));
    const sheet = createDesigner({ page: blankPage('screen', 'Customer') });
    expect(sheet.setPageLimits({ maxResponses: 5 })).toBe(false);
    expect(sheet.getState().issues[0]).toContain('for a form that collects responses');
    document.body.replaceChildren();
    sheet.select(null);
    const other = mount(sheet, { mode: 'advanced' }).host.querySelector('.fd-properties') as HTMLElement;
    openTab(other, 'Rules');
    expect(rowOf(other, 'Opens on').hidden).toBe(true);
    expect(rowOf(other, 'Continue later').hidden).toBe(false);
  });
});

describe('a choice’s places in the designer', () => {
  it('are given to each option, a box each, emptied to take one’s away; a matrix’s columns take none', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Sessions') });
    const id = designer.addQuestion('multiple-choice') as string;
    designer.setOptions(id, ['Morning', 'Afternoon']);
    designer.select(id);
    const host = document.createElement('div');
    document.body.append(host);
    survey = mountSurveyEditor(host, { designer });
    const card = () => host.querySelector('.fd-q-selected') as HTMLElement;
    const box = (name: string) => card().querySelector(`[aria-label="${name}"]`) as HTMLInputElement;
    const options = () => {
      const node = (designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === id) as { field: string };
      return (designer.getPage().fields[node.field] as Extract<Field, { type: 'selection' }>).options;
    };
    const give = card().querySelector('.fd-kind-give-places') as HTMLButtonElement;
    expect(give.hidden).toBe(false);
    give.click();
    expect(give.hidden).toBe(true);
    typeAndLeave(box('Places for Morning'), '30');
    typeAndLeave(box('Places for Afternoon'), '25');
    expect(options().map((o) => o.seats)).toEqual([30, 25]);
    typeAndLeave(box('Places for Afternoon'), '');
    expect(options()[1]).not.toHaveProperty('seats');
    typeAndLeave(box('Places for Morning'), '2.5');
    expect(options()[0].seats).toBe(30);
    expect(validatePage(designer.getPage()).ok).toBe(true);
    const matrix = designer.addQuestion('matrix') as string;
    expect(designer.setOptionDetails(matrix, 0, { seats: 3 })).toBe(false);
    expect(designer.getState().issues[0]).toBe('Places are for a choice’s options: a matrix’s columns take none');
  });
});
