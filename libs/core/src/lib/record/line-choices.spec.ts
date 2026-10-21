import Ajv2020 from 'ajv/dist/2020';
import { checkPage, createForm, createMemoryDataSource, pageJsonSchema, validatePage, type DataSource, type Line, type Option, type OptionsRequest, type Page, type Values } from '../../index';

/**
 * A table line's choices from the app's lists: an agent's tools, each line's from the connection on that line — asked
 * by the line's values (its record as `parent`), shared by lines alike, asked again as that column changes on the
 * line, and a tool the new connection does not offer taken out and said, as every choice taken out is.
 */

const TOOLS: Record<string, Option[]> = {
  gmail: [
    { value: 'send_email', label: 'Send email' },
    { value: 'read_inbox', label: 'Read inbox' },
  ],
  slack: [
    { value: 'post_message', label: 'Post message' },
    { value: 'read_inbox', label: 'Read channel' },
  ],
};

const gmail = { id: 1, label: 'Gmail' };
const slack = { id: 2, label: 'Slack' };

function page(tool: Record<string, unknown> = {}, more: Record<string, unknown> = {}): Page {
  return {
    fieldia: '0.8',
    id: 'agent',
    data: { kind: 'record', model: 'agent' },
    fields: {
      name: { type: 'char', label: 'Name' },
      workspace: { type: 'char', label: 'Workspace' },
      tools: {
        type: 'one2many',
        label: 'Tools',
        relation: 'agent.tool',
        fields: {
          connection_id: { type: 'many2one', label: 'Connection', relation: 'connection' },
          tool: { type: 'selection', label: 'Tool', options: [], optionsFrom: { list: 'tools', dependsOn: ['connection_id'] }, ...tool },
          ask_first: { type: 'boolean', label: 'Ask first' },
        },
      },
      ...more,
    },
    layout: {
      type: 'sections',
      id: 'root',
      children: [
        { type: 'field', id: 'n', field: 'name' },
        { type: 'field', id: 't', field: 'tools' },
      ],
    },
  } as Page;
}

const problems = (input: unknown) => {
  const result = validatePage(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};
const checked = (input: Page) => {
  const result = checkPage(input);
  return result.ok ? [] : result.issues.map((issue) => `${issue.path}: ${issue.message}`);
};

/** A data source whose list requests wait until the test lets each one answer. */
function lists() {
  const asked: (OptionsRequest & { answer(options: Option[]): void; fail(message: string): void })[] = [];
  const source: DataSource = {
    options: (request) =>
      new Promise<Option[]>((resolve, reject) => {
        asked.push({ ...request, answer: resolve, fail: (message) => reject(new Error(message)) });
      }),
  };
  return { source, asked };
}

const line = (key: string, values: Values): Line => ({ key, values });
const lineOf = (form: ReturnType<typeof createForm>, key: string) => ((form.getState().values['tools'] as Line[]).find((l) => l.key === key) as Line).values;

describe('a table line’s choices from the app’s lists, in the format', () => {
  it('takes a list by name on a line, changing with a column of the line or the record it is on', () => {
    expect(problems(page())).toEqual([]);
    expect(checkPage(page()).ok).toBe(true);
    const both = page({ optionsFrom: { list: 'tools', dependsOn: ['connection_id', 'parent.workspace'] } });
    expect(problems(both)).toEqual([]);
    expect(checkPage(both).ok).toBe(true);
  });

  it('still asks a line’s choice for written options when they are not from a list', () => {
    expect(problems(page({ optionsFrom: undefined }))).toEqual(['fields.tools.fields.tool.options: a choice needs its options, or a list of the app’s to take them from']);
  });

  it('refuses a column that is not the line’s, a record’s field it does not have, and the column itself', () => {
    const none = page({ optionsFrom: { list: 'tools', dependsOn: ['account_id'] } });
    expect(checked(none)).toEqual(['fields.tools.fields.tool.optionsFrom.dependsOn[0]: no field "account_id"']);
    const parent = page({ optionsFrom: { list: 'tools', dependsOn: ['parent.team'] } });
    expect(checked(parent)).toEqual(['fields.tools.fields.tool.optionsFrom.dependsOn[0]: "parent.team": "team" is not a field of this page']);
    const itself = page({ optionsFrom: { list: 'tools', dependsOn: ['tool'] } });
    expect(checked(itself)).toEqual(['fields.tools.fields.tool.optionsFrom.dependsOn[0]: "tool" cannot change with itself']);
  });

  it('keeps parent to a line: a page’s own field changes with its own fields', () => {
    const own = page({}, { city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities', dependsOn: ['parent.country'] } } });
    expect(problems(own)).toEqual([expect.stringMatching(/^fields\.city\.optionsFrom\.dependsOn\[0\]: /)]);
  });

  it('keeps a linked record’s choices written in the page', () => {
    const linked = page({}, {
      tag_ids: { type: 'many2many', label: 'Tags', relation: 'tag', fields: { kind: { type: 'selection', label: 'Kind', options: [], optionsFrom: { list: 'kinds' } } } },
    });
    expect(problems(linked)).toEqual([
      'fields.tag_ids.fields.kind.options: Too small: expected array to have >=1 items',
      'fields.tag_ids.fields.kind.optionsFrom: choices from the app’s lists are for the page’s own fields and a table’s lines, not a linked record’s',
    ]);
  });

  it('is the same optionsFrom as a page’s own choice’s — one schema, one check — a line’s carrying none from a question', () => {
    const schema = pageJsonSchema() as { $defs: Record<string, unknown> };
    expect(Object.keys(schema.$defs).filter((name) => /OptionsFrom/.test(name)).sort()).toEqual(['OptionsFrom', 'OptionsFromField', 'OptionsFromList']);
    const carried = page({ optionsFrom: { field: 'connection_id' } });
    expect(problems(carried)).toEqual(['fields.tools.fields.tool.optionsFrom.field: "tool": a line\'s choice carries no options from a question — its own, or one of the app\'s lists']);
    // A page's own choice from a list and a line's read alike: by the list's name, asked with the values it changes with.
    const own = page({}, { city: { type: 'selection', label: 'City', options: [], optionsFrom: { list: 'cities', dependsOn: ['workspace'] } } });
    expect(problems(own)).toEqual([]);
  });

  it('is in the JSON Schema, with the same rule for written options', () => {
    const validate = new Ajv2020({ allErrors: true, strict: false }).compile(pageJsonSchema());
    expect(validate(page())).toBe(true);
    expect(validate(page({ optionsFrom: { list: 'tools', dependsOn: ['parent.workspace'] } }))).toBe(true);
    expect(validate(page({ optionsFrom: undefined }))).toBe(false);
    expect(validate(page({ optionsFrom: { list: 'tools', dependsOn: ['parent.'] } }))).toBe(false);
  });
});

describe('a table line’s choices from the app’s lists, in a form', () => {
  it('asks by the line’s values, with the record it is on as parent, and keeps them by the cell’s path', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { name: 'Helper', tools: [line('a', { connection_id: gmail, tool: null })] } });
    form.loadChoices('tools.a.tool');
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: null, loading: true });
    expect(asked).toHaveLength(1);
    expect(asked[0].list).toBe('tools');
    expect(asked[0].values).toEqual({ connection_id: gmail, tool: null });
    expect(asked[0].parent?.['name']).toBe('Helper');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: TOOLS['gmail'] });
  });

  it('asks once for every line whose connection is the same, and once more for another', async () => {
    const { source, asked } = lists();
    const tools = [line('a', { connection_id: gmail }), line('b', { connection_id: { id: 1, label: 'Gmail (work)' } }), line('c', { connection_id: slack })];
    const form = createForm({ page: page(), dataSource: source, values: { tools } });
    for (const key of ['a', 'b', 'c']) form.loadChoices(`tools.${key}.tool`);
    expect(asked.map((a) => (a.values['connection_id'] as { id: number }).id)).toEqual([1, 2]);
    asked[0].answer(TOOLS['gmail']);
    asked[1].answer(TOOLS['slack']);
    await form.settled();
    expect(form.getState().choices['tools.b.tool'].options).toEqual(TOOLS['gmail']);
    expect(form.getState().choices['tools.c.tool'].options).toEqual(TOOLS['slack']);
    // Asked for, again, by a line alike: the answer it had.
    form.loadChoices('tools.a.tool');
    await form.settled();
    expect(asked).toHaveLength(2);
  });

  it('asks again as the line’s connection changes, and clears and names a tool the new one does not offer', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { tools: [line('a', { connection_id: gmail, tool: 'send_email' }), line('b', { connection_id: gmail, tool: 'read_inbox' })] } });
    const told: { value: unknown; by: string }[] = [];
    form.on('change', (event) => told.push({ value: event.value, by: event.by }));
    form.loadChoices('tools.a.tool');
    form.loadChoices('tools.b.tool');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    form.updateLine('tools', 'a', 'connection_id', slack);
    form.updateLine('tools', 'b', 'connection_id', slack);
    // Shared again: one ask for both.
    expect(asked).toHaveLength(2);
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: TOOLS['gmail'], loading: true });
    asked[1].answer(TOOLS['slack']);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toBeNull();
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: TOOLS['slack'] });
    expect(form.getState().takenOut['tools.a.tool']).toBe('Send email is no longer offered, so it was taken out');
    // One the new connection offers too stays.
    expect(lineOf(form, 'b')['tool']).toBe('read_inbox');
    expect(form.getState().choices['tools.b.tool']).toEqual({ options: TOOLS['slack'] });
    // Cleared as the person's change is worked out: told, never as the person's own.
    expect(told.at(-1)).toEqual({ value: expect.anything(), by: 'step' });
    expect(form.getState().dirty).toContain('tools');
    expect(form.getState().takenOut['tools.b.tool']).toBeUndefined();
    // Another tool chosen: what was taken out is said no more, nor once the person empties it again.
    form.updateLine('tools', 'a', 'tool', 'post_message');
    expect(form.getState().takenOut['tools.a.tool']).toBeUndefined();
    form.updateLine('tools', 'a', 'tool', null);
    expect(form.getState().takenOut['tools.a.tool']).toBeUndefined();
  });

  it('keeps the rest of several tools chosen, saying the one taken out until the choice changes', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page({ multiple: true }), dataSource: source, values: { tools: [line('a', { connection_id: gmail, tool: ['send_email', 'read_inbox'] })] } });
    form.loadChoices('tools.a.tool');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    form.updateLine('tools', 'a', 'connection_id', slack);
    asked[1].answer(TOOLS['slack']);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toEqual(['read_inbox']);
    expect(form.getState().takenOut['tools.a.tool']).toBe('Send email is no longer offered, so it was taken out');
    form.updateLine('tools', 'a', 'tool', ['read_inbox', 'post_message']);
    expect(form.getState().takenOut['tools.a.tool']).toBeUndefined();
  });

  it('asks nothing again when another column of the line changes', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { tools: [line('a', { connection_id: gmail, tool: 'send_email' })] } });
    form.loadChoices('tools.a.tool');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    form.updateLine('tools', 'a', 'ask_first', true);
    form.updateLine('tools', 'a', 'tool', 'read_inbox');
    form.addLine('tools', { connection_id: slack });
    expect(asked).toHaveLength(1);
  });

  it('judges only the latest answer when they come back out of order', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { tools: [line('a', { connection_id: gmail, tool: 'read_inbox' })] } });
    form.loadChoices('tools.a.tool');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    form.updateLine('tools', 'a', 'connection_id', slack);
    form.updateLine('tools', 'a', 'connection_id', { id: 3, label: 'Drive' });
    asked[2].answer([{ value: 'read_inbox', label: 'Read files' }]);
    asked[1].answer([]);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toBe('read_inbox');
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: [{ value: 'read_inbox', label: 'Read files' }] });
  });

  it('judges a line whose choices nobody asked for yet, so a form with no table drawn keeps none its connection does not offer', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { tools: [line('a', { connection_id: gmail, tool: 'send_email' }), line('b', { connection_id: gmail })] } });
    form.updateLine('tools', 'a', 'connection_id', slack);
    form.updateLine('tools', 'b', 'connection_id', slack);
    // The line holding no tool has nothing to judge.
    expect(asked).toHaveLength(1);
    asked[0].answer(TOOLS['slack']);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toBeNull();
    expect(form.getState().takenOut['tools.a.tool']).toBe('send_email is no longer offered, so it was taken out');
  });

  it('keeps a tool a record comes in with that its choices do not offer: the person decides, and a save says why', async () => {
    const { source, asked } = lists();
    source.load = async () => ({ tools: [line('a', { connection_id: slack, tool: 'send_email' })] });
    const form = createForm({ page: page(), dataSource: source, recordId: 4 });
    await form.load();
    form.loadChoices('tools.a.tool');
    asked[0].answer(TOOLS['slack']);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toBe('send_email');
    expect(form.getState().takenOut['tools.a.tool']).toBeUndefined();
    expect(form.validate()).toBe(false);
    expect(form.getState().errors['tools.a.tool']).toBe('Must be one of: Post message, Read channel');
    // A choice of them reads.
    form.updateLine('tools', 'a', 'tool', 'post_message');
    expect(form.validate()).toBe(true);
  });

  it('asks again by the values Discard brings back, clearing nothing', async () => {
    const { source, asked } = lists();
    source.load = async () => ({ tools: [line('a', { connection_id: gmail, tool: 'send_email' })] });
    const form = createForm({ page: page(), dataSource: source, recordId: 4 });
    await form.load();
    form.loadChoices('tools.a.tool');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    form.updateLine('tools', 'a', 'connection_id', slack);
    asked[1].answer(TOOLS['slack']);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toBeNull();
    form.reset();
    expect(lineOf(form, 'a')).toEqual({ connection_id: gmail, tool: 'send_email' });
    await form.settled();
    // Gmail's, as asked before: the same answer, and the tool it held is one of them.
    expect(asked).toHaveLength(2);
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: TOOLS['gmail'] });
    expect(lineOf(form, 'a')['tool']).toBe('send_email');
  });

  it('clears nothing on another record shown while the answer was on its way', async () => {
    const { source, asked } = lists();
    let record = 4;
    source.load = async () => ({ tools: [line('a', { connection_id: record === 4 ? gmail : slack, tool: 'send_email' })] });
    const form = createForm({ page: page(), dataSource: source, recordId: 4 });
    await form.load();
    form.loadChoices('tools.a.tool');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    form.updateLine('tools', 'a', 'connection_id', slack);
    // Another record, whose line has the same key and Slack already.
    record = 5;
    await form.openRecord(5);
    asked[1].answer(TOOLS['slack']);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toBe('send_email');
    expect(form.getState().takenOut['tools.a.tool']).toBeUndefined();
  });

  it('lets a line’s choices go with the line, and lays no late answer where it was', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { tools: [line('a', { connection_id: gmail })] } });
    form.loadChoices('tools.a.tool');
    form.removeLine('tools', 'a');
    expect(form.getState().choices['tools.a.tool']).toBeUndefined();
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    expect(form.getState().choices['tools.a.tool']).toBeUndefined();
  });

  it('follows the record it is on where the list says parent', async () => {
    const { source, asked } = lists();
    const form = createForm({
      page: page({ optionsFrom: { list: 'tools', dependsOn: ['connection_id', 'parent.workspace'] } }),
      dataSource: source,
      values: { workspace: 'north', tools: [line('a', { connection_id: gmail, tool: 'send_email' }), line('b', { connection_id: gmail })] },
    });
    form.loadChoices('tools.a.tool');
    form.loadChoices('tools.b.tool');
    asked[0].answer(TOOLS['gmail']);
    await form.settled();
    form.setValue('workspace', 'south');
    expect(asked.map((a) => a.parent?.['workspace'])).toEqual(['north', 'south']);
    asked[1].answer([{ value: 'read_inbox', label: 'Read inbox' }]);
    await form.settled();
    expect(lineOf(form, 'a')['tool']).toBeNull();
    expect(form.getState().takenOut['tools.a.tool']).toBe('Send email is no longer offered, so it was taken out');
  });

  it('says why a line’s choices did not load, and asks again when asked', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { tools: [line('a', { connection_id: gmail })] } });
    form.loadChoices('tools.a.tool');
    asked[0].fail('The server is away');
    await form.settled();
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: null, error: 'The server is away' });
    form.loadChoices('tools.a.tool');
    expect(asked).toHaveLength(2);
    asked[1].answer(TOOLS['gmail']);
    await form.settled();
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: TOOLS['gmail'] });
  });

  it('says so when the data source has no lists, and refuses a cell that is no line’s choice from them', async () => {
    const form = createForm({ page: page(), dataSource: {}, values: { tools: [line('a', { connection_id: gmail })] } });
    form.loadChoices('tools.a.tool');
    await form.settled();
    expect(form.getState().choices['tools.a.tool']).toEqual({ options: null, error: 'No list "tools"' });
    expect(() => form.loadChoices('tools.a.ask_first')).toThrow();
    expect(() => form.loadChoices('tools.zz.tool')).toThrow();
  });

  it('gives a line’s choices as asked for a row about to be pasted on it, or on a line not added yet', async () => {
    const { source, asked } = lists();
    const form = createForm({ page: page(), dataSource: source, values: { tools: [line('a', { connection_id: gmail })] } });
    const pasted = form.lineChoices('tools', 'a', 'tool', { connection_id: slack });
    const added = form.lineChoices('tools', null, 'tool', { connection_id: gmail });
    // The line's own values, or a new line's defaults, under the row's.
    expect(asked.map((a) => [(a.values['connection_id'] as { id: number }).id, a.values['ask_first']])).toEqual([
      [2, undefined],
      [1, false],
    ]);
    asked[0].answer(TOOLS['slack']);
    asked[1].answer(TOOLS['gmail']);
    expect(await pasted).toEqual(TOOLS['slack']);
    expect(await added).toEqual(TOOLS['gmail']);
    // Nothing of the form changed.
    expect(form.getState().choices).toEqual({});
    expect(() => form.lineChoices('tools', 'a', 'ask_first')).toThrow();
  });

  it('come from a memory data source, its list given the request with the record as parent', async () => {
    const seen: (string | undefined)[] = [];
    const source = createMemoryDataSource({
      lists: {
        tools: (values, request) => {
          seen.push(request.parent?.['name'] as string | undefined);
          return TOOLS[(values['connection_id'] as { id: number } | null)?.id === 2 ? 'slack' : 'gmail'];
        },
      },
    });
    const form = createForm({ page: page(), dataSource: source, values: { name: 'Helper', tools: [line('a', { connection_id: slack })] } });
    form.loadChoices('tools.a.tool');
    await form.settled();
    expect(form.getState().choices['tools.a.tool'].options).toEqual(TOOLS['slack']);
    expect(seen).toEqual(['Helper']);
  });

  it('asks a line’s own form’s choices with the record the line is on as parent', async () => {
    const { source, asked } = lists();
    const fields = (page().fields['tools'] as { fields: Record<string, unknown> }).fields;
    const dialog = createForm({
      page: { fieldia: '0.8', id: 'line', data: { kind: 'record', model: 'values' }, fields, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 't', field: 'tool' }] } } as Page,
      dataSource: source,
      values: { connection_id: gmail },
      parent: { values: { name: 'Helper' }, fields: page().fields },
    });
    dialog.loadChoices('tool');
    expect(asked[0].values['connection_id']).toEqual(gmail);
    expect(asked[0].parent).toEqual({ name: 'Helper' });
  });
});

describe('a line’s own form, its choices from the app’s lists', () => {
  const fields = (page().fields['tools'] as { fields: Record<string, unknown> }).fields;
  const dialogPage = { fieldia: '0.8', id: 'line', data: { kind: 'record', model: 'values' }, fields, layout: { type: 'sections', id: 'root', children: [{ type: 'field', id: 'c', field: 'connection_id' }, { type: 'field', id: 't', field: 'tool' }] } } as Page;

  it('takes out and says a tool its new connection does not offer, as the line’s row does', async () => {
    const { source, asked } = lists();
    const dialog = createForm({ page: dialogPage, dataSource: source, values: { connection_id: gmail, tool: 'send_email' }, parent: { values: { name: 'Helper' }, fields: page().fields } });
    dialog.loadChoices('tool');
    asked[0].answer(TOOLS['gmail']);
    await dialog.settled();
    dialog.setValue('connection_id', slack);
    asked[1].answer(TOOLS['slack']);
    await dialog.settled();
    expect(dialog.getState().values['tool']).toBeNull();
    expect(dialog.getState().choices['tool']).toEqual({ options: TOOLS['slack'] });
    expect(dialog.getState().takenOut['tool']).toBe('Send email is no longer offered, so it was taken out');
  });
});
