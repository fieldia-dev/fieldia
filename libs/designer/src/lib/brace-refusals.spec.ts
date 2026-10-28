import { blankPage, createDesigner } from './designer';
import { elementFactory } from './chrome';
import { mountSurveyEditor } from './survey-editor';
import { tryIt } from './try-it';

/**
 * Words typed with a brace that names no field — " (as on the {customer} line)" in a question's words (0.36's walk of
 * the survey designer): the banner said `fields.name.label: no field "customer"`, Checks said "All clear" at the same
 * time, and Try it showed the words that last passed, half typed. Now the designer says it in its own words, with a
 * one-press fix that shows the braces as written; Checks lists it until it is put right; Try it says what it shows.
 */

function surveyWithName() {
  const designer = createDesigner({ page: blankPage('survey', 'Visit feedback') });
  const id = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(id, { label: 'Your name' });
  return { designer, id };
}
const labelOf = (designer: ReturnType<typeof createDesigner>, id: string) => {
  const page = designer.getPage();
  const node = JSON.stringify(page.layout).match(new RegExp(`"id":"${id}"[^}]*"field":"([^"]+)"`));
  return page.fields[node?.[1] ?? '']?.label;
};

describe('words whose braces name no field', () => {
  it('are refused in the designer’s words — whose words name what — never the check’s path', () => {
    const { designer, id } = surveyWithName();
    expect(designer.updateQuestion(id, { label: 'Your name (as on the {customer} line)' })).toBe(false);
    expect(designer.getState().issues).toEqual(['Your name’s words name {customer}, which is no field']);
    expect(designer.getState().issues.join(' ')).not.toMatch(/fields\.|no field "/);
  });

  it('are listed by Checks, with Show the braces as written, which keeps the words with their braces as words', () => {
    const { designer, id } = surveyWithName();
    designer.updateQuestion(id, { label: 'Your name (as on the {customer} line)' });
    const checks = designer.checks();
    // Never All clear while what was typed is refused.
    expect(checks[0]).toMatchObject({ severity: 'must', text: 'Your name’s words name {customer}, which is no field', fix: { label: 'Show the braces as written' } });
    expect(designer.fixCheck(checks[0])).toBe(true);
    expect(labelOf(designer, id)).toBe('Your name (as on the \\{customer} line)');
    expect(designer.getState().issues).toEqual([]);
    expect(designer.checks().some((check) => /customer/.test(check.text))).toBe(false);
    // One step Undo takes back.
    designer.undo();
    expect(labelOf(designer, id)).toBe('Your name');
  });

  it('a brace that names a field of the page is taken as it is: the field’s value in the words', () => {
    const { designer, id } = surveyWithName();
    const other = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(other, { label: 'Company' });
    const name = Object.entries(designer.getPage().fields).find(([, def]) => def.label === 'Company')?.[0] as string;
    expect(designer.updateQuestion(id, { label: `Your name at {${name}}` })).toBe(true);
    expect(designer.getState().issues).toEqual([]);
  });

  it('the bar offers the fix beside the refusal', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const { designer, id } = surveyWithName();
    const editor = mountSurveyEditor(host, { designer });
    designer.updateQuestion(id, { label: 'Your name (as on the {customer} line)' });
    const banner = host.querySelector('.fd-designer-issues') as HTMLElement;
    expect(banner.hidden).toBe(false);
    expect(banner.firstChild?.textContent).toBe('Your name’s words name {customer}, which is no field');
    const fix = [...banner.querySelectorAll('button')].find((button) => button.textContent === 'Show the braces as written');
    expect(fix).toBeDefined();
    fix?.click();
    expect(labelOf(designer, id)).toBe('Your name (as on the \\{customer} line)');
    expect(banner.hidden).toBe(true);
    editor.destroy();
    host.remove();
  });

  it('Try it says it shows the page as it was before the change refused, and why', () => {
    const { designer, id } = surveyWithName();
    designer.updateQuestion(id, { label: 'Your name (as on the {customer} line)' });
    const handle = tryIt({ el: elementFactory(document), doc: document, designer, skin: 'outlined', onChange: () => undefined });
    document.body.append(handle.toggle, handle.element);
    (handle.toggle.querySelector('button[data-mode="try"]') as HTMLButtonElement).click();
    expect(handle.element.querySelector('.fd-try-refused')?.textContent).toBe('Try it shows the page as it was before your last change, which the page cannot take: Your name’s words name {customer}, which is no field');
    expect(handle.element.querySelector('.fd-try-frame [data-field] .fd-label')?.textContent).toBe('Your name');
    handle.destroy();
    document.body.replaceChildren();
  });
});
