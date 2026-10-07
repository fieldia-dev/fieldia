import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { validatePage } from '../format/validate';
import { createForm } from './form';
import type { DataSource, SearchRequest } from './data-source';
import type { Line } from './values';

/**
 * A table's line opened as a form of its own (`lineForm`), as Flectra's
 * contact's child address dialog and a survey question's own form: its parts
 * read the line, the record as `parent`; a line may hold lines of its own.
 */
const survey = {
  fieldia: '0.1',
  id: 'survey',
  title: 'Survey',
  data: { kind: 'record', model: 'survey.survey' },
  fields: {
    title: { type: 'char', label: 'Title' },
    scoring_type: { type: 'selection', label: 'Scoring', options: [{ value: 'no_scoring', label: 'No scoring' }, { value: 'scoring_with_answers', label: 'Scoring with answers' }] },
    question_ids: {
      type: 'one2many',
      label: 'Questions',
      relation: 'survey.question',
      fields: {
        title: { type: 'char', label: 'Question' },
        question_type: { type: 'selection', label: 'Type', options: [{ value: 'text_box', label: 'Multiple lines' }, { value: 'simple_choice', label: 'Single choice' }] },
        constr_mandatory: { type: 'boolean', label: 'Mandatory answer' },
        constr_error_msg: { type: 'char', label: 'Error message' },
        suggested_answer_ids: {
          type: 'one2many',
          label: 'Answers',
          relation: 'survey.question.answer',
          fields: { value: { type: 'char', label: 'Choice', required: true }, is_correct: { type: 'boolean', label: 'Correct' }, answer_score: { type: 'float', label: 'Score' } },
        },
      },
    },
  },
  layout: {
    type: 'sheet',
    id: 'sheet',
    children: [
      { type: 'field', id: 'f-title', field: 'title' },
      { type: 'field', id: 'f-scoring', field: 'scoring_type' },
      {
        type: 'field',
        id: 'f-questions',
        field: 'question_ids',
        columns: ['title', 'question_type', 'constr_mandatory'],
        lineForm: {
          children: [
            { type: 'field', id: 'q-title', field: 'title', required: true },
            { type: 'field', id: 'q-type', field: 'question_type', widget: 'radio' },
            {
              type: 'tabs',
              id: 'q-tabs',
              children: [
                {
                  type: 'tab',
                  id: 'q-answers',
                  label: 'Answers',
                  invisible: "question_type != 'simple_choice'",
                  children: [{ type: 'field', id: 'q-suggested', field: 'suggested_answer_ids', cells: { answer_score: { hidden: "parent.scoring_type == 'no_scoring'" } } }],
                },
                {
                  type: 'tab',
                  id: 'q-options',
                  label: 'Options',
                  children: [
                    { type: 'field', id: 'q-mandatory', field: 'constr_mandatory' },
                    { type: 'field', id: 'q-error', field: 'constr_error_msg', invisible: 'not constr_mandatory' },
                    { type: 'text', id: 'q-scored', text: 'Answers are scored', invisible: "parent.scoring_type == 'no_scoring'" },
                  ],
                },
              ],
            },
          ],
        },
      },
    ],
  },
} as unknown as Page;

const said = (result: { ok: boolean; issues?: { path: string; message: string }[] }) => (result.ok ? [] : (result.issues ?? []).map((issue) => `${issue.path}: ${issue.message}`));

describe('a line’s own form, as the page checks it', () => {
  it('is read against the line’s fields, the record as parent, and lines that hold lines', () => {
    expect(said(validatePage(survey))).toEqual([]);
    expect(said(checkPage(survey))).toEqual([]);
  });

  it('refuses a part naming a field the line lacks, a condition reading one, or a parent field the record lacks', () => {
    const bad = JSON.parse(JSON.stringify(survey));
    const form = bad.layout.children[2].lineForm.children;
    form.push({ type: 'field', id: 'q-scoring', field: 'scoring_type' });
    form[1].invisible = "scoring_type == 'no_scoring'";
    form[2].children[1].children[2].invisible = 'parent.nope';
    expect(said(validatePage(bad))).toEqual([
      'layout.children[2].lineForm.children[1].invisible: "scoring_type == \'no_scoring\'" reads "scoring_type", which is not a field of the lines of "question_ids"',
      'layout.children[2].lineForm.children[2].children[1].children[2].invisible: "parent.nope" reads "parent.nope": "nope" is not a field of this page',
      'layout.children[2].lineForm.children[3].field: no field "scoring_type"',
    ]);
  });

  it('refuses the lines a line holds as a column of its table, and lines held three deep', () => {
    const column = JSON.parse(JSON.stringify(survey));
    column.layout.children[2].columns.push('suggested_answer_ids');
    expect(said(validatePage(column))).toEqual(['layout.children[2].columns[3]: "suggested_answer_ids" holds lines of its own: they are edited in the line\'s form (lineForm), not drawn in its row']);
    const deep = JSON.parse(JSON.stringify(survey));
    deep.fields.question_ids.fields.suggested_answer_ids.fields.more = { type: 'one2many', label: 'More', relation: 'x', fields: {} };
    expect(validatePage(deep).ok).toBe(false);
  });
});

describe('a form of one line, its record its parent', () => {
  const linePage = (): Page => ({
    fieldia: '0.1',
    id: 'question',
    data: { kind: 'record', model: 'values' },
    fields: (survey.fields['question_ids'] as { fields: Page['fields'] }).fields,
    layout: { type: 'sections', id: 'root', children: (survey.layout as unknown as { children: { lineForm: { children: never[] } }[] }).children[2].lineForm.children },
  });

  it('reads the record as parent, in its conditions and in its lines’ rules', () => {
    const page = linePage();
    expect(said(checkPage(page))).not.toEqual([]);
    expect(said(checkPage(page, { parent: survey.fields }))).toEqual([]);
    const scored = createForm({ page, parent: { values: { scoring_type: 'scoring_with_answers' }, fields: survey.fields }, values: { question_type: 'simple_choice', suggested_answer_ids: [{ key: 'a1', values: { value: 'Yes', is_correct: true, answer_score: 1 } }] } as never });
    expect(scored.node('q-scored').invisible).toBe(false);
    expect(scored.columnHidden('q-suggested', 'answer_score')).toBe(false);
    const plain = createForm({ page, parent: { values: { scoring_type: 'no_scoring' }, fields: survey.fields } });
    expect(plain.node('q-scored').invisible).toBe(true);
    expect(plain.columnHidden('q-suggested', 'answer_score')).toBe(true);
  });

  it('keeps its lines’ lines as its own lines, a new one never taking a key one holds', () => {
    const page = linePage();
    const form = createForm({ page, parent: { values: {}, fields: survey.fields }, values: { suggested_answer_ids: [{ key: 'new-1', values: { value: 'Yes', is_correct: false, answer_score: 0 } }] } as never });
    const added = form.addLine('suggested_answer_ids', { value: 'No' });
    expect(added).not.toBe('new-1');
    expect((form.getState().values['suggested_answer_ids'] as Line[]).map((line) => line.values['value'])).toEqual(['Yes', 'No']);
    // An inner line asks for what it needs, as any line.
    form.updateLine('suggested_answer_ids', added, 'value', null);
    expect(form.validate()).toBe(false);
  });

  it('filters a link by its parent, as a line’s does', async () => {
    const asked: SearchRequest[] = [];
    const dataSource: DataSource = { search: async (request) => (asked.push(request), []) };
    const page: Page = { fieldia: '0.1', id: 'line', data: { kind: 'record', model: 'values' }, fields: { product_id: { type: 'many2one', label: 'Product', relation: 'product', filter: [{ field: 'company_id', op: '=', valueFrom: 'parent.company_id' }] } }, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-product', field: 'product_id' }] } };
    expect(said(checkPage(page, { parent: { company_id: { type: 'many2one', label: 'Company', relation: 'res.company' } } }))).toEqual([]);
    await createForm({ page, dataSource, parent: { values: { company_id: { id: 3, label: 'Nile' } }, fields: { company_id: { type: 'many2one', label: 'Company', relation: 'res.company' } } } }).search('product_id', '');
    expect(asked[0].filter).toEqual([{ field: 'company_id', op: '=', value: 3 }]);
  });
});
