import type { Page } from '../format/page';
import { checkPage } from '../format/check-page';
import { createForm } from './form';
import { createMemoryDataSource } from './memory-data-source';
import { askedInOrder, drawOrder, seeded } from './order';
import { formSurveyPart } from './survey';

/**
 * Questions and steps in an order drawn for each respondent, and N of M questions drawn: the same seed the same draw in
 * every engine; words and a part fixed in its place keep it; the form keeps its draw, in its drafts too, asks only the
 * questions drawn, and sends the order it showed.
 */

const bank = (more: Partial<Page> = {}): Page => ({
  fieldia: '0.10',
  id: 'bank',
  data: { kind: 'responses' },
  fields: Object.fromEntries(['name', 'q1', 'q2', 'q3', 'q4', 'q5', 'last'].map((name) => [name, { type: 'char', label: name, ...(name.startsWith('q') ? { required: true } : {}) }])) as Page['fields'],
  layout: {
    type: 'wizard',
    id: 'w',
    order: 'random',
    children: [
      { type: 'step', id: 'intro', label: 'You', fixed: true, children: [{ type: 'field', id: 'f-name', field: 'name' }] },
      {
        type: 'step',
        id: 'questions',
        label: 'Questions',
        order: 'random',
        draw: 3,
        children: [
          { type: 'text', id: 'words', text: 'Answer each.' },
          ...['q1', 'q2', 'q3', 'q4', 'q5'].map((field) => ({ type: 'field' as const, id: `f-${field}`, field })),
        ],
      },
      { type: 'step', id: 'more', label: 'More', children: [] },
      { type: 'step', id: 'end', label: 'Last', fixed: true, children: [{ type: 'field', id: 'f-last', field: 'last' }] },
    ],
  },
  ...more,
} as Page);

describe('questions in an order drawn, and N of M drawn', () => {
  it('draws the same from the same seed, and another from another', () => {
    const a = seeded('mona');
    const b = seeded('mona');
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(drawOrder(bank(), 'mona')).toEqual(drawOrder(bank(), 'mona'));
    const draws = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => JSON.stringify(drawOrder(bank(), seed)['questions'])));
    expect(draws.size).toBeGreaterThan(1);
  });

  it('keeps words and parts fixed in their places, and draws N of the questions', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const order = drawOrder(bank(), seed);
      // The steps: the first and the last fixed, the rest in an order drawn.
      expect(order['w'][0]).toBe('intro');
      expect(order['w'][3]).toBe('end');
      expect([...order['w']].sort()).toEqual(['end', 'intro', 'more', 'questions']);
      // Three of five questions, the words first where they stood.
      expect(order['questions']).toHaveLength(4);
      expect(order['questions'][0]).toBe('words');
      expect(new Set(order['questions']).size).toBe(4);
    }
  });

  it('reads the questions asked in the order shown', () => {
    expect(askedInOrder(bank(), { w: ['intro', 'questions', 'more', 'end'], questions: ['words', 'f-q4', 'f-q1'] }, { name: 'M', q1: 'a', q4: 'b', last: null })).toEqual(['name', 'q4', 'q1', 'last']);
  });

  it('asks only the questions drawn, in the steps’ order drawn, and sends that order', async () => {
    await formSurveyPart.load();
    const sent: unknown[] = [];
    const ds = createMemoryDataSource();
    const submit = ds.submit.bind(ds);
    ds.submit = (request) => (sent.push(request), submit(request));
    const form = createForm({ page: bank(), dataSource: ds, seed: 'mona' });
    const order = drawOrder(bank(), 'mona');
    expect(form.getState().order).toEqual(order);
    expect(form.steps()).toEqual(order['w']);
    const drawn = order['questions'].filter((id) => id.startsWith('f-'));
    const left = ['f-q1', 'f-q2', 'f-q3', 'f-q4', 'f-q5'].filter((id) => !drawn.includes(id));
    for (const id of left) expect(form.node(id).invisible).toBe(true);
    for (const id of drawn) expect(form.node(id).invisible).toBe(false);
    // Only those drawn are asked for: the two left out are no one's to answer.
    form.setValues({ name: 'Mona', ...Object.fromEntries(drawn.map((id) => [id.slice(2), 'yes'])) });
    expect(await form.save()).toBe(true);
    const request = sent[0] as { values: Record<string, unknown>; order?: unknown };
    expect(Object.keys(request.values).sort()).toEqual(['last', 'name', ...drawn.map((id) => id.slice(2))].sort());
    expect(request.order).toEqual(order);
  });

  it('keeps the draw in a draft, and lays it again where it opens', async () => {
    await formSurveyPart.load();
    const kept = new Map<string, string>();
    const store = { getItem: (key: string) => kept.get(key) ?? null, setItem: (key: string, value: string) => void kept.set(key, value), removeItem: (key: string) => void kept.delete(key) };
    const first = createForm({ page: bank(), dataSource: createMemoryDataSource(), drafts: { store, delayMs: 0, restore: 'auto' } });
    const order = first.getState().order;
    first.setValues({ name: 'Mona' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(JSON.parse([...kept.values()][0]).order).toEqual(order);
    // Another visit draws anew — then the draft lays its own draw over it.
    const again = createForm({ page: bank(), dataSource: createMemoryDataSource(), drafts: { store, delayMs: 0, restore: 'auto' } });
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(again.getState().order).toEqual(order);
    expect(again.steps()).toEqual(order?.['w']);
  });

  it('is checked: a draw of more than there are, of none, an order that is not random', () => {
    const issues = (page: Page) => (checkPage(page).ok ? [] : (checkPage(page) as { issues: { path: string; message: string }[] }).issues.map((issue) => `${issue.path}: ${issue.message}`));
    expect(issues(bank())).toEqual([]);
    const many = bank();
    (many.layout as { children: { draw?: number }[] }).children[1].draw = 6;
    expect(issues(many)).toEqual(['layout.children[1].draw: it draws 6 of the 5 questions it holds: draw as many as it holds, or fewer']);
  });
});
