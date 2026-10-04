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
      [lineOf(text, '"invisible"'), 'error', `"colour != 'red'" reads "colour", which is not a field of this page`, 'Remove the rule'],
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

  it('puts a question’s missing words where they are written: on the question when it has its own', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
    const id = designer.addQuestion('short-answer') as string;
    designer.updateQuestion(id, { label: 'Name' });
    const page = JSON.parse(designer.pageJson()) as Page;
    const node = (page.layout as WizardNode).children[0].children[0] as FieldNode & { label?: string };
    node.label = 'Untitled question';
    const text = pageToJson(page);
    const [row] = checkJson(text).rows;
    expect([row.message, row.line]).toEqual(['A question has no words yet: people would read “Untitled question”.', lineOf(text, '"label": "Untitled question"')]);
    expect(lineOf(text, '"label": "Untitled question"')).toBeGreaterThan(lineOf(text, '"layout"'));
  });

  it('lists every row in the order it sits in the text, the page’s errors and the checks alike', () => {
    const designer = createDesigner({ page: blankPage('survey', 'Event feedback') });
    designer.addQuestion('short-answer');
    const page = JSON.parse(designer.pageJson()) as Page;
    (page.layout as WizardNode).children[0].invisible = "ghost == 'x'";
    const text = pageToJson(page);
    const rows = checkJson(text).rows;
    // The rule on a field the page lacks: one row, the format's words with the check's fix.
    expect(rows.map((r) => [r.severity, r.fix?.label])).toEqual([
      ['should', undefined],
      ['error', 'Remove the rule'],
    ]);
    expect(rows.map((r) => r.line)).toEqual([...rows.map((r) => r.line)].sort((a, b) => a - b));
  });

  it('keeps going when a page is too broken to look over', () => {
    const rows = checkJson('{ "fieldia": "0.1", "layout": 3 }').rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.severity === 'error' && r.line === 1)).toBe(true);
  });
});

describe('the rules’ fixes, done on the JSON', () => {
  /** An order: Price and Quantity, a Total worked out from them, and Notes required when Price is filled. */
  function order() {
    const designer = createDesigner({ page: blankPage('screen', 'Order') });
    const add = (kind: string, label: string) => {
      const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
      designer.updateQuestion(id, { label });
      return id;
    };
    const price = add('number', 'Price');
    const qty = add('number', 'Quantity');
    const total = add('number', 'Total');
    const notes = add('paragraph', 'Notes');
    const name = (id: string) => (designer.getPage().layout as unknown as { children: { children: FieldNode[] }[] }).children[0].children.find((n) => n.id === id)!.field;
    expect(designer.setCompute(total, `${name(price)} * ${name(qty)}`)).toBe(true);
    expect(designer.setRule(notes, 'required', { field: name(price), equals: 0 })).toBe(true);
    return { designer, price, qty, total, notes, name };
  }
  const fixOf = (text: string, words: RegExp) => checkJson(text).rows.find((row) => words.test(row.message) && row.fix);

  it('takes away a formula that reads a field no longer on the page', () => {
    const { designer, qty, total, name } = order();
    designer.removeNode(qty);
    const text = designer.pageJson();
    const row = fixOf(text, /Quantity.*no longer on the page/);
    expect(row?.fix?.label).toBe('Remove the rule');
    const fixed = JSON.parse(fixJson(text, row?.fix?.check ?? null) as string) as Page;
    expect(fixed.fields[name(total)]).not.toHaveProperty('compute');
  });

  it('takes away “required when” that reads a field no longer on the page', () => {
    const { designer, price, notes } = order();
    designer.removeNode(price);
    const text = designer.pageJson();
    const row = checkJson(text).rows.find((r) => /Notes/.test(r.message) && /Price/.test(r.message) && r.fix);
    const fixed = JSON.parse(fixJson(text, row?.fix?.check ?? null) as string) as Page;
    const node = (fixed.layout as unknown as { children: { children: FieldNode[] }[] }).children[0].children.find((n) => n.id === notes)!;
    expect(node).not.toHaveProperty('required');
  });

  it('takes away an answer rule that checks nothing for what the field holds', () => {
    const { designer, total } = order();
    const page = JSON.parse(designer.pageJson()) as Page;
    const node = (page.layout as unknown as { children: { children: FieldNode[] }[] }).children[0].children.find((n) => n.id === total)!;
    node.validate = [{ minLength: 2 }];
    const text = JSON.stringify(page, null, 2);
    const row = fixOf(text, /checks nothing/);
    const fixed = JSON.parse(fixJson(text, row?.fix?.check ?? null) as string) as Page;
    expect((fixed.layout as unknown as { children: { children: FieldNode[] }[] }).children[0].children.find((n) => n.id === total)).not.toHaveProperty('validate');
  });
});
