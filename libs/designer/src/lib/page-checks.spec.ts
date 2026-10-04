import type { FieldNode, Page, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { pageChanges, pageChecks } from './page-checks';

/** A survey: "Coming?" (yes or no), "Role" (Developer, Manager), and "Why not?" shown for a "no". */
function survey() {
  const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
  const coming = designer.addQuestion('yes-no') as string;
  designer.updateQuestion(coming, { label: 'Coming?' });
  const role = designer.addQuestion('dropdown') as string;
  designer.updateQuestion(role, { label: 'Role' });
  designer.setOptions(role, ['Developer', 'Manager']);
  const why = designer.addQuestion('paragraph') as string;
  designer.updateQuestion(why, { label: 'Why not?' });
  designer.select(null);
  const field = (id: string) => ((designer.getPage().layout as WizardNode).children.flatMap((s) => s.children).find((n) => n.id === id) as FieldNode).field;
  return { designer, coming, role, why, field };
}
const texts = (page: Page) => pageChecks(page).map((c) => `${c.severity}: ${c.text}`);

describe('checks before publishing', () => {
  it('finds nothing on a survey ready to go', () => {
    expect(pageChecks(survey().designer.getPage())).toEqual([]);
  });

  it('stops a survey with nothing to answer', () => {
    expect(texts(blankPage('survey', 'Empty'))).toEqual(['must: The survey has no questions yet, so there is nothing to answer.']);
  });

  it('says what a question still lacks: its words, and options of its own', () => {
    const { designer } = survey();
    const fresh = designer.addQuestion('multiple-choice') as string;
    const checks = pageChecks(designer.getPage());
    expect(checks.map((c) => [c.severity, c.text, c.at, c.fix?.label])).toEqual([
      ['should', 'A question has no words yet: people would read “Untitled question”.', fresh, 'Type its words'],
      ['should', '“Untitled question” still offers Option 1 as its options.', fresh, 'Type its options'],
    ]);
    expect(checks[0].fix?.action).toEqual({ kind: 'go', id: fresh, part: 'label' });
    expect(checks[1].fix?.action).toEqual({ kind: 'go', id: fresh, part: 'options' });
  });

  it('finds a page with no questions, and offers to delete it', () => {
    const { designer } = survey();
    const empty = designer.addContainer('Page 2') as string;
    const [check] = pageChecks(designer.getPage());
    expect([check.severity, check.text, check.at]).toEqual(['should', '“Page 2” has no questions: people would see an empty page.', empty]);
    expect(check.fix).toEqual({ label: 'Delete the page', action: { kind: 'remove', id: empty } });
    expect(designer.fixCheck(check)).toBe(true);
    expect((designer.getPage().layout as WizardNode).children).toHaveLength(1);
  });

  it('says an only page or section is empty, with no fix to delete it', () => {
    const [check] = pageChecks(blankPage('screen', 'Visit'));
    expect([check.text, check.fix]).toEqual(['“Section 1” has no fields: it would show as an empty box.', undefined]);
  });

  it('stops a page written by hand that does not hold together, saying where', () => {
    const page = blankPage('screen', 'Visit');
    (page.layout as { children: { invisible?: string }[] }).children[0].invisible = "ghost == 'x'";
    const [check] = pageChecks(page);
    expect(check.severity).toBe('must');
    expect(check.text).toMatch(/ghost/);
  });

  it('finds an empty section on a screen', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Visit') });
    designer.addQuestion('short-answer', { parent: 'section-1' });
    designer.updateQuestion((designer.getPage().layout as { children: { children: { id: string }[] }[] }).children[0].children[0].id, { label: 'Customer' });
    const empty = designer.addContainer('Follow-up') as string;
    expect(pageChecks(designer.getPage()).map((c) => [c.text, c.fix?.label, c.at])).toEqual([['“Follow-up” has no fields: it would show as an empty box.', 'Delete the section', empty]]);
  });

  it('stops a rule that can never hold: an answer the question no longer offers', () => {
    const { designer, role, why, field } = survey();
    designer.setCondition(why, { field: field(role), equals: 'manager' });
    // Renamed, an option keeps its value, and the rule still holds for it.
    designer.setOptions(role, ['Developer', 'Lead']);
    expect(pageChecks(designer.getPage())).toEqual([]);
    designer.setOptions(role, ['Developer']);
    const [check] = pageChecks(designer.getPage());
    expect([check.severity, check.text, check.at]).toEqual(['must', '“Why not?” shows only when Role is “manager”, which Role no longer offers, so it never shows.', why]);
    expect(check.fix?.label).toBe('Remove that rule');
    expect(designer.fixCheck(check)).toBe(true);
    expect(pageChecks(designer.getPage())).toEqual([]);
  });

  it('says a rule among others that can never hold, and drops only that rule', () => {
    const { designer, coming, role, why, field } = survey();
    designer.setCondition(why, { join: 'any', rules: [{ field: field(role), op: 'is', value: 'manager' }, { field: field(coming), op: 'is', value: false }] });
    designer.setOptions(role, ['Developer']);
    const [check] = pageChecks(designer.getPage());
    // Another rule can still show it: it only reads wrong.
    expect([check.severity, check.text]).toEqual(['should', '“Why not?”: the rule “Role is manager” can never hold, as Role no longer offers it.']);
    designer.fixCheck(check);
    const node = (designer.getPage().layout as WizardNode).children[0].children.find((n) => n.id === why) as FieldNode;
    expect(node.invisible).toBe(`${field(coming)} != False`);
  });

  it('finds two questions asking the same thing', () => {
    const { designer } = survey();
    const again = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(again, { label: 'Role' });
    expect(pageChecks(designer.getPage()).map((c) => [c.severity, c.text, c.at, c.fix?.label])).toEqual([['should', 'Two questions read “Role”: people may not tell them apart.', again, 'Rename the second']]);
  });

  it('lists what stops people before what only looks wrong', () => {
    const { designer, role, why, field } = survey();
    designer.addContainer('Page 2');
    designer.setCondition(why, { field: field(role), equals: 'manager' });
    designer.setOptions(role, ['Developer']);
    expect(pageChecks(designer.getPage()).map((c) => c.severity)).toEqual(['must', 'should']);
  });
});

describe('what changed since the last version', () => {
  it('says the first version is the first', () => {
    expect(pageChanges(null, survey().designer.getPage())).toEqual(['The first version: 3 questions on 1 page']);
  });

  it('names each change in words: added, removed, renamed, required, kind, options, when it shows, moved', () => {
    const { designer, coming, role, why } = survey();
    const before = designer.getPage();
    const email = designer.addQuestion('email') as string;
    designer.updateQuestion(email, { label: 'Email' });
    designer.removeNode(coming);
    designer.updateQuestion(why, { label: 'Why are you not coming?', required: true });
    designer.changeKind(role, 'multiple-choice');
    designer.setOptions(role, ['Developer', 'Manager', 'Designer']);
    designer.setPageInfo({ title: 'Launch feedback' });
    const page2 = designer.addContainer('Details') as string;
    designer.placeNode(email, page2, 0);
    expect(pageChanges(before, designer.getPage())).toEqual([
      'Title: “Event feedback” → “Launch feedback”',
      'Added the page “Details”',
      'Added “Email”',
      'Removed “Coming?”',
      '“Role” is now Multiple choice',
      '“Role”: added the option “Designer”',
      'Renamed “Why not?” to “Why are you not coming?”',
      '“Why are you not coming?” is now required',
    ]);
    // Moving one is a change of its own.
    const moved = designer.getPage();
    designer.placeNode(why, page2, 0);
    expect(pageChanges(moved, designer.getPage())).toEqual(['Moved “Why are you not coming?” to “Details”']);
  });

  it('says when a question starts or stops showing for some answers only', () => {
    const { designer, coming, why, field } = survey();
    const before = designer.getPage();
    designer.setCondition(why, { field: field(coming), equals: false });
    expect(pageChanges(before, designer.getPage())).toEqual(['“Why not?” now shows only for some answers']);
    const after = designer.getPage();
    designer.setCondition(why, null);
    expect(pageChanges(after, designer.getPage())).toEqual(['“Why not?” now always shows']);
  });

  it('says nothing changed when nothing did', () => {
    const page = survey().designer.getPage();
    expect(pageChanges(page, page)).toEqual([]);
  });
});
