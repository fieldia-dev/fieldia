import type { FieldNode, Page, WizardNode } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';
import { checkJson, fixJson } from './json-checks';
import { pageToJson } from './page-json';

/** A survey: "Coming?" (yes or no) and "Why not?", shown when the answer is no. */
function survey() {
  const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
  const coming = designer.addQuestion('yes-no') as string;
  designer.updateQuestion(coming, { label: 'Coming?' });
  const why = designer.addQuestion('paragraph') as string;
  designer.updateQuestion(why, { label: 'Why not?' });
  const node = (page: Page, id: string) => (page.layout as WizardNode).children[0].children.find((n) => n.id === id) as FieldNode;
  designer.setCondition(why, { field: node(designer.getPage(), coming).field, equals: false });
  return { designer, coming, why, node };
}

const lineOf = (text: string, words: string) => text.split('\n').findIndex((l) => l.includes(words)) + 1;

describe('checking the page as JSON', () => {
  it('finds nothing in a page ready to go', () => {
    const { designer } = survey();
    expect(checkJson(designer.pageJson()).rows).toEqual([]);
  });

  it('says a mistake in the text, with nothing to fix it by', () => {
    const rows = checkJson('{\n  "fieldia": "0.1"\n  "id": "x"\n}').rows;
    expect(rows).toEqual([{ line: 3, column: 3, message: 'A comma is missing before this', severity: 'error' }]);
  });

  it('puts a rule on a field the page lacks on its line, with the check’s fix on it', () => {
    const { designer, why, node } = survey();
    const page = JSON.parse(designer.pageJson()) as Page;
    node(page, why).invisible = "colour != 'red'";
    const text = pageToJson(page);
    const { rows, errors } = checkJson(text);
    expect(errors).toBe(1);
    expect(rows.map((r) => [r.line, r.severity, r.message, r.fix?.label])).toEqual([
      [lineOf(text, '"invisible"'), 'error', `"colour != 'red'" reads "colour", which is not a field of this page`, 'Remove that rule'],
    ]);
  });

  it('fixes the text as the check says, the rest of it kept', () => {
    const { designer, why, node, coming } = survey();
    const page = JSON.parse(designer.pageJson()) as Page;
    const kept = node(page, why).invisible;
    node(page, why).invisible = `${kept} or colour != 'red'`;
    const text = pageToJson(page);
    const [row] = checkJson(text).rows;
    const fixed = fixJson(text, row.fix?.check ?? null) as string;
    expect(checkJson(fixed).rows).toEqual([]);
    expect(node(JSON.parse(fixed), why).invisible).toBe(kept);
    expect(node(JSON.parse(fixed), coming).field).toBe(node(page, coming).field);
    // The only rule gone: the question always shows.
    node(page, why).invisible = "colour != 'red'";
    const only = pageToJson(page);
    const again = fixJson(only, checkJson(only).rows[0].fix?.check ?? null) as string;
    expect('invisible' in node(JSON.parse(again), why)).toBe(false);
  });

  it('removes an empty page by its fix, and leaves text it cannot read alone', () => {
    const { designer } = survey();
    designer.addContainer('Page 2');
    const text = designer.pageJson();
    const row = checkJson(text).rows.find((r) => r.fix);
    expect([row?.severity, row?.message, row?.fix?.label, row?.line]).toEqual(['should', '“Page 2” has no questions: people would see an empty page.', 'Delete the page', lineOf(text, '"label": "Page 2"') - 3]);
    const fixed = fixJson(text, row?.fix?.check ?? null) as string;
    expect((JSON.parse(fixed).layout as WizardNode).children.map((s) => s.label)).toEqual(['Page 1']);
    expect(fixJson('{ broken', row?.fix?.check ?? null)).toBeNull();
    expect(fixJson(text, null)).toBeNull();
  });

  it('lists what only reads wrong too, where it is, each once', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
    designer.addQuestion('short-answer');
    const text = designer.pageJson();
    const rows = checkJson(text).rows;
    expect(rows.map((r) => [r.severity, r.message, r.line, r.fix])).toEqual([['should', 'A question has no words yet: people would read “Untitled question”.', lineOf(text, '"label": "Untitled question"'), undefined]]);
  });

  it('keeps going when a page is too broken to look over', () => {
    const rows = checkJson('{ "fieldia": "0.1", "layout": 3 }').rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.severity === 'error' && r.line === 1)).toBe(true);
  });
});
