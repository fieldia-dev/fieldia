import { fillValues, localizePage, pageJsonSchema, pageWords, splitValues, validatePage, valuesIn } from '../../index';
import { checkPage } from './check-page';
import type { Page } from './page';

/**
 * A page of responses' endings, and `{field}` words in its own words: each `{name}` a field of the page — an ending's
 * `{id}` the response's — a condition that reads, something to say, none after the default; only where something is
 * sent.
 */

const page = (more: Record<string, unknown> = {}, layout?: unknown): unknown => ({
  fieldia: '0.8',
  id: 'feedback',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name' },
    branch: { type: 'selection', label: 'Branch', options: [{ value: 'zamalek', label: 'Zamalek' }, { value: 'maadi', label: 'Maadi' }] },
    overall: { type: 'integer', label: 'How was your visit to {branch}?' },
  },
  layout: layout ?? {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-branch', field: 'branch' },
      { type: 'field', id: 'f-overall', field: 'overall' },
    ],
  },
  ...more,
});

const issues = (given: unknown) => {
  const result = validatePage(given);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

describe('a page’s endings', () => {
  it('take a condition, a title, words and the button again’s words, in every check', () => {
    const endings = [
      { when: 'overall <= 2', title: 'We are sorry, {name}', text: '{branch} will call you.', again: false },
      { title: 'Thank you', text: 'Your booking is {id}.', again: 'Book another' },
    ];
    expect(issues(page({ endings }))).toEqual([]);
    expect(checkPage(page({ endings }) as Page).ok).toBe(true);
  });

  it('are for a page of responses: a record’s page stays on its record', () => {
    const record = { ...(page({ endings: [{ title: 'Thanks' }] }) as object), data: { kind: 'record', model: 'feedback' } };
    expect(issues(record)).toEqual(['endings: endings are for a page of responses, shown once it is sent']);
  });

  it('refuse a {name} that is no field — {id} is the response’s — and a condition that reads none', () => {
    expect(issues(page({ endings: [{ when: 'rating > 2', title: 'Thanks {nam}' }, { text: 'Ref {id}' }] }))).toEqual([
      'endings[0].when: "rating > 2" reads "rating", which is not a field of this page',
      'endings[0].title: no field "nam"',
    ]);
  });

  it('refuse one that says nothing, one after the default, and shapes that are not an ending’s', () => {
    expect(issues(page({ endings: [{ title: 'Thanks' }, { when: 'overall < 2', title: 'Sorry' }, { when: 'overall > 4' }] }))).toEqual([
      'endings[1]: never shown: endings[0] has no when and comes first',
      'endings[2]: never shown: endings[0] has no when and comes first',
      'endings[2]: an ending needs a title or text',
    ]);
    expect(issues(page({ endings: [] })).join()).toMatch(/^endings:/);
    expect(issues(page({ endings: [{ title: 'Thanks', again: true }] })).join()).toMatch(/^endings\[0\]\.again:/);
    expect(issues(page({ endings: [{ title: ' ' }] })).join()).toMatch(/^endings\[0\]\.title:/);
    expect(issues(page({ endings: [{ title: 'Thanks', redirect: '/x' }] })).join()).toMatch(/redirect/);
  });

  it('are in the JSON Schema', () => {
    const schema = JSON.stringify(pageJsonSchema());
    expect(schema).toContain('"PageEnding"');
  });

  it('are words a translator works through, the button’s among them', () => {
    const endings = [{ title: 'Thank you', text: 'See you soon', again: 'Book another' }];
    expect(pageWords(page({ endings }) as Page)).toEqual(expect.arrayContaining(['Thank you', 'See you soon', 'Book another']));
    const arabic = localizePage(page({ endings, translations: { ar: { 'Thank you': 'شكرًا', 'Book another': 'احجز موعدًا آخر' } } }) as Page, 'ar');
    expect(arabic.endings).toEqual([{ title: 'شكرًا', text: 'See you soon', again: 'احجز موعدًا آخر' }]);
  });
});

describe('{field} words in a page’s own words', () => {
  it('may name the page’s fields in labels, help, choices, a field’s own label and help, steps and buttons', () => {
    const wizard = {
      type: 'wizard',
      id: 'wizard',
      finishLabel: 'Send to {branch}',
      children: [
        { type: 'step', id: 's1', label: 'You', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-branch', field: 'branch' }] },
        {
          type: 'step',
          id: 's2',
          label: 'Your visit to {branch}',
          description: 'Thank you, {name}.',
          children: [
            { type: 'field', id: 'f-overall', field: 'overall', label: 'Rate {branch}', help: 'Only {branch}’s team reads it' },
            { type: 'button', id: 'b-call', label: 'Call {branch}', steps: [{ do: 'say', message: 'Calling' }] },
          ],
        },
      ],
    };
    const more = {
      fields: {
        name: { type: 'char', label: 'Your name', help: 'As {branch} knows you' },
        branch: { type: 'selection', label: 'Branch', options: [{ value: 'zamalek', label: 'Zamalek' }] },
        overall: { type: 'selection', label: 'How was {branch}?', options: [{ value: 'good', label: 'Good, thanks to {name}' }] },
      },
    };
    expect(issues(page(more, wizard))).toEqual([]);
  });

  it('refuse a {name} that is no field of the page, wherever it is written', () => {
    const wizard = {
      type: 'wizard',
      id: 'wizard',
      nextLabel: 'On to {nxt}',
      children: [
        {
          type: 'step',
          id: 's1',
          label: 'Your visit to {brnch}',
          description: 'For {id}',
          children: [
            { type: 'field', id: 'f-overall', field: 'overall', label: 'Rate {x}', help: '{y}' },
            { type: 'field', id: 'f-branch', field: 'branch' },
            { type: 'button', id: 'b-call', label: 'Call {z}', steps: [{ do: 'say', message: 'Calling' }] },
          ],
        },
      ],
    };
    const more = {
      fields: {
        name: { type: 'char', label: 'Name' },
        branch: { type: 'selection', label: 'Branch {a}', help: '{b}', options: [{ value: 'zamalek', label: 'Zamalek {c}' }] },
        overall: { type: 'integer', label: 'Overall' },
      },
    };
    expect(issues(page(more, wizard))).toEqual([
      'fields.branch.label: no field "a"',
      'fields.branch.help: no field "b"',
      'fields.branch.options[0].label: no field "c"',
      'layout.nextLabel: no field "nxt"',
      'layout.children[0].label: no field "brnch"',
      'layout.children[0].description: no field "id"',
      'layout.children[0].children[0].label: no field "x"',
      'layout.children[0].children[0].help: no field "y"',
      'layout.children[0].children[2].label: no field "z"',
    ]);
  });

  it('take the words while an answer is empty after a bar, and still refuse a name that is no field', () => {
    const more = {
      fields: {
        name: { type: 'char', label: 'Your name' },
        branch: { type: 'selection', label: 'Branch', options: [{ value: 'zamalek', label: 'Zamalek' }] },
        overall: { type: 'integer', label: 'How was your visit to {branch|this branch}?', help: 'Thanks, {name|}.' },
      },
    };
    expect(issues(page(more))).toEqual([]);
    const wrong = { fields: { ...more.fields, overall: { type: 'integer', label: 'How was {brnch|this branch}?' } } };
    expect(issues(page(wrong))).toEqual(['fields.overall.label: no field "brnch"']);
    expect(issues(page({ endings: [{ title: 'Ref {id|to follow}' }] }))).toEqual([]);
  });

  it('leave braces round anything but a name alone, and a line’s own fields’ words as they are', () => {
    const more = {
      fields: {
        name: { type: 'char', label: 'Name {as on your ID}' },
        lines: { type: 'one2many', label: 'Lines', relation: 'line', fields: { qty: { type: 'integer', label: 'Qty {unit}' } } },
      },
    };
    const layout = { type: 'sections', id: 'root', children: [{ type: 'field', id: 'f-name', field: 'name' }, { type: 'field', id: 'f-lines', field: 'lines' }] };
    expect(issues(page(more, layout))).toEqual([]);
  });
});

describe('{field} words read and filled', () => {
  it('cut words at each name, with its words while empty after a bar', () => {
    expect(valuesIn('At {branch|this branch}, {name} and {x|}')).toEqual(['branch', 'name', 'x']);
    expect(splitValues('At {branch|this branch}.')).toEqual([{ text: 'At ' }, { text: '', field: 'branch', fallback: 'this branch' }, { text: '.' }]);
    expect(fillValues('At {branch|this branch}, {name|you}', (name) => (name === 'name' ? 'Mona' : ''))).toBe('At this branch, Mona');
    // Braces round anything but a name, with or without a bar, stay as written.
    expect(fillValues('{as on your ID} {a|b|c} {|x}', () => 'v')).toBe('{as on your ID} v {|x}');
  });
});
