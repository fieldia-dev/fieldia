import type { Page } from '@fieldia/core';
import { blankPage, createDesigner } from './designer';

function setup() {
  const designer = createDesigner({ page: { ...blankPage('screen', 'Site visit'), description: 'One visit, one record.' } });
  const id = designer.addQuestion('short-answer') as string;
  designer.updateQuestion(id, { label: 'Customer' });
  return { designer, id };
}

const failed = (result: ReturnType<ReturnType<typeof createDesigner>['setPageJson']>) => (result.ok ? [] : result.problems);

describe('the page as JSON', () => {
  it('is the page, two spaces deep, its keys in the order the page keeps them', () => {
    const { designer } = setup();
    const text = designer.pageJson();
    expect(text).toBe(JSON.stringify(designer.getPage(), null, 2));
    expect(text.split('\n')[1]).toBe('  "fieldia": "0.1",');
    expect(Object.keys(JSON.parse(text))).toEqual(Object.keys(designer.getPage()));
  });

  it('takes a page written as JSON as one edit, and undo brings the page back', () => {
    const { designer } = setup();
    const before = designer.getPage();
    const steps = () => designer.getState().canUndo;
    const text = designer.pageJson().replace('"Customer"', '"Client"');
    expect(designer.setPageJson(text)).toEqual({ ok: true });
    expect(Object.values(designer.getPage().fields).map((f) => f.label)).toEqual(['Client']);
    expect(designer.pageJson()).toBe(text);
    expect(steps()).toBe(true);
    designer.undo();
    expect(designer.getPage()).toEqual(before);
    designer.redo();
    expect(Object.values(designer.getPage().fields).map((f) => f.label)).toEqual(['Client']);
  });

  it('takes away what the text leaves out', () => {
    const { designer } = setup();
    const page = JSON.parse(designer.pageJson()) as Page;
    delete page.description;
    expect(designer.setPageJson(JSON.stringify(page))).toEqual({ ok: true });
    expect('description' in designer.getPage()).toBe(false);
  });

  it('makes no undo step when the text is the page as it is', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Site visit') });
    expect(designer.setPageJson(designer.pageJson())).toEqual({ ok: true });
    expect(designer.setPageJson(JSON.stringify(designer.getPage()))).toEqual({ ok: true });
    expect(designer.getState().canUndo).toBe(false);
  });

  it('refuses text that is not JSON, saying where, and keeps the page as it was', () => {
    const { designer } = setup();
    const page = designer.getPage();
    const listener = jest.fn();
    designer.subscribe(listener);
    const text = designer.pageJson().replace('"Customer"', '"Customer" "oops"');
    const line = text.split('\n').findIndex((l) => l.includes('oops')) + 1;
    const result = designer.setPageJson(text);
    expect(failed(result)).toEqual([{ line, column: expect.any(Number), message: 'A comma is missing before this' }]);
    expect(designer.getPage()).toBe(page);
    expect(listener).not.toHaveBeenCalled();
    expect(designer.getState().issues).toEqual([]);
  });

  it('refuses a page that breaks the format, each problem on the line it sits on', () => {
    const { designer } = setup();
    const page = designer.getPage();
    const draft = JSON.parse(designer.pageJson());
    const section = draft.layout.children[0];
    section.children[0].field = 'nope';
    section.children[0].invisible = "colour == 'red'";
    const text = JSON.stringify(draft, null, 2);
    const lineOf = (words: string) => text.split('\n').findIndex((l) => l.includes(words)) + 1;
    const problems = failed(designer.setPageJson(text));
    expect(problems).toEqual([
      { line: lineOf('"field": "nope"'), column: 13, path: 'layout.children[0].children[0].field', message: 'no field "nope"' },
      {
        line: lineOf('"invisible"'),
        column: 13,
        path: 'layout.children[0].children[0].invisible',
        message: `"colour == 'red'" reads "colour", which is not a field of this page`,
      },
    ]);
    expect(designer.getPage()).toBe(page);
  });

  it('says where a key the format does not know sits, and a page missing what it needs', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Site visit') });
    const draft = JSON.parse(designer.pageJson());
    delete draft.id;
    draft.layout.children[0].colour = 'red';
    const text = JSON.stringify(draft, null, 2);
    const problems = failed(designer.setPageJson(text));
    expect(problems.map((p) => [p.path, p.line])).toEqual([
      ['id', 1],
      ['layout.children[0]', text.split('\n').findIndex((l) => l.includes('"type": "section"')) ],
    ]);
  });
});
