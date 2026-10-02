import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { validatePage, FORMAT_VERSION } from '../../index';

const EXAMPLES = join(__dirname, '..', '..', '..', '..', '..', 'examples', 'pages');

function example(name: string): Record<string, any> {
  return JSON.parse(readFileSync(join(EXAMPLES, `${name}.page.json`), 'utf8'));
}

/** Messages for every issue, so a failing assertion shows what the validator said. */
function messages(input: unknown): string[] {
  const result = validatePage(input);
  return result.ok ? [] : result.issues.map((i) => `${i.path}: ${i.message}`);
}

/** Every example page the demos and docs show. */
const EXAMPLE_NAMES = readdirSync(EXAMPLES).filter((f) => f.endsWith('.page.json')).map((f) => f.replace('.page.json', ''));

describe('validatePage — the example pages', () => {
  it('finds the example pages', () => {
    expect(EXAMPLE_NAMES).toEqual(expect.arrayContaining(['customer', 'fields', 'signup', 'survey']));
  });

  it.each(EXAMPLE_NAMES)('accepts the %s example', (name) => {
    expect(messages(example(name))).toEqual([]);
  });

  it('returns the page unchanged, and it survives a JSON round trip', () => {
    const input = example('customer');
    const result = validatePage(input);
    if (!result.ok) throw new Error(messages(input).join('\n'));
    expect(result.page).toEqual(input);
    expect(JSON.parse(JSON.stringify(result.page))).toEqual(result.page);
  });

  it('declares the format version it reads', () => {
    expect(example('customer')['fieldia']).toBe(FORMAT_VERSION);
  });
});

describe('validatePage — a page is data', () => {
  it('rejects a function hidden in a button', () => {
    const page = example('customer');
    page['layout'].buttons[0].onClick = () => 'side effect';
    expect(messages(page).join('\n')).toMatch(/layout\.buttons\[0\].*onClick/);
  });

  it('rejects a framework element used as an icon', () => {
    const page = example('customer');
    page['layout'].statButtons[0].icon = { $$typeof: Symbol.for('react.element'), type: 'svg', props: {} };
    expect(messages(page).join('\n')).toMatch(/layout\.statButtons\[0\]\.icon/);
  });

  it('rejects a Date object as a default value', () => {
    const page = example('survey');
    page['fields'].name.default = new Date();
    expect(messages(page).join('\n')).toMatch(/fields\.name\.default/);
  });

  it('rejects keys the format does not define', () => {
    const page = example('survey');
    page['fields'].rating.colour = 'red';
    expect(messages(page).join('\n')).toMatch(/fields\.rating.*colour/);
  });
});

describe('validatePage — structure', () => {
  it('rejects an unsupported format version', () => {
    const page = example('survey');
    page['fieldia'] = '9.0';
    expect(messages(page).join('\n')).toMatch(/^fieldia: /m);
  });

  it('rejects a selection without options', () => {
    const page = example('survey');
    page['fields'].uses_product.options = [];
    expect(messages(page).join('\n')).toMatch(/fields\.uses_product\.options/);
  });

  it('rejects a many2one without a relation', () => {
    const page = example('customer');
    delete page['fields'].country_id.relation;
    expect(messages(page).join('\n')).toMatch(/fields\.country_id\.relation/);
  });

  it('rejects a tab placed outside tabs', () => {
    const page = example('customer');
    page['layout'].children.push({ type: 'tab', id: 'stray', label: 'Stray', children: [] });
    expect(messages(page).length).toBeGreaterThan(0);
  });

  it('rejects a filter that has both value and valueFrom', () => {
    const page = example('customer');
    page['fields'].state_id.filter[0].value = 5;
    expect(messages(page).join('\n')).toMatch(/fields\.state_id\.filter\[0\]/);
  });

  it('rejects a root layout that is not a page layout', () => {
    const page = example('survey');
    page['layout'] = { type: 'field', id: 'only', field: 'name' };
    expect(messages(page).join('\n')).toMatch(/^layout/m);
  });
});

describe('validatePage — modifiers are read before the page runs', () => {
  it('rejects a modifier that cannot be read', () => {
    const page = example('customer');
    page['layout'].buttons[0].invisible = "state != 'draft";
    expect(messages(page).join('\n')).toMatch(/layout\.buttons\[0\]\.invisible: cannot read "state != 'draft"/);
  });

  it('rejects a modifier that reads a field the page does not define', () => {
    const page = example('survey');
    page['layout'].children[2].invisible = "uses_produkt != 'yes'";
    expect(messages(page).join('\n')).toMatch(
      /layout\.children\[2\]\.invisible: "uses_produkt != 'yes'" reads "uses_produkt", which is not a field of this page/
    );
  });

  it('checks every place a modifier can sit', () => {
    const page = example('customer');
    const bad = 'ghost_field';
    page['layout'].children[0].children[1].readonly = bad;
    page['layout'].children[0].children[2].required = bad;
    page['layout'].children[1].children[0].invisible = bad;
    page['layout'].statButtons[0].invisible = bad;
    page['layout'].ribbon.invisible = bad;
    page['layout'].alerts[0].invisible = bad;
    page['layout'].sidePanel.invisible = bad;
    const paths = messages(page).map((m) => m.split(':')[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        'layout.children[0].children[1].readonly',
        'layout.children[0].children[2].required',
        'layout.children[1].children[0].invisible',
        'layout.statButtons[0].invisible',
        'layout.ribbon.invisible',
        'layout.alerts[0].invisible',
        'layout.sidePanel.invisible',
      ])
    );
  });

  it('accepts a dotted read by its first field, and constants', () => {
    const page = example('customer');
    page['layout'].children[0].children[5].invisible = 'not country_id.code or active == True';
    page['fields'].active = { type: 'boolean', label: 'Active' };
    expect(messages(page)).toEqual([]);
  });
});

describe('validatePage — filters', () => {
  const withFilter = (filter: unknown) => {
    const page = example('customer');
    page['fields'].state_id.filter = filter;
    return messages(page);
  };

  it('takes groups of any and all, nested, and the new ways to compare', () => {
    expect(
      withFilter([
        { any: [{ field: 'name', op: 'startswith', value: 'A' }, { all: [{ field: 'code', op: 'set' }, { field: 'size', op: 'between', value: [1, 9] }] }] },
        { field: 'country_id', op: '=', valueFrom: 'country_id' },
        { field: 'retired', op: 'notset' },
        { field: 'name', op: 'endswith', value: 'ia' },
      ])
    ).toEqual([]);
  });

  it('checks a valueFrom however deep its group, and says where', () => {
    expect(withFilter([{ any: [{ field: 'name', op: '=', value: 'x' }, { all: [{ field: 'country_id', op: '=', valueFrom: 'ghost_field' }] }] }]).join('\n')).toMatch(
      /fields\.state_id\.filter\[0\]\.any\[1\]\.all\[0\]\.valueFrom: no field "ghost_field"/
    );
  });

  it('refuses a value on set or notset, between without two ends, and an empty group', () => {
    expect(withFilter([{ field: 'code', op: 'set', value: true }]).join('\n')).toMatch(/set and notset take neither/);
    expect(withFilter([{ field: 'size', op: 'between', value: [1] }]).join('\n')).toMatch(/between takes value: \[low, high\]/);
    expect(withFilter([{ any: [] }]).length).toBeGreaterThan(0);
  });
});

describe('validatePage — lists', () => {
  const list = (): Record<string, any> => ({
    fieldia: FORMAT_VERSION,
    id: 'customers',
    title: 'Customers',
    data: { kind: 'record', model: 'partner' },
    fields: {
      name: { type: 'char', label: 'Name' },
      email: { type: 'char', label: 'Email' },
      country_id: { type: 'many2one', label: 'Country', relation: 'country' },
      state: { type: 'selection', label: 'Status', options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }] },
      credit_limit: { type: 'monetary', label: 'Credit limit', currency: 'EGP' },
    },
    layout: {
      type: 'list',
      id: 'list',
      columns: ['name', 'email', 'country_id', 'state'],
      sort: [{ field: 'name' }],
      pageSize: 40,
      searchFields: ['name', 'email', 'country_id'],
      filters: [
        { id: 'active', label: 'Active', filter: [{ field: 'state', op: '=', value: 'active' }] },
        { id: 'big', label: 'Big accounts', filter: [{ field: 'credit_limit', op: '>=', value: 100000 }] },
      ],
      defaultFilters: ['active'],
      groupBy: ['country_id', 'state'],
      actions: [{ type: 'button', id: 'block-all', label: 'Block', action: 'block', style: 'danger', confirm: 'Block these customers?' }],
    },
  });

  it('takes a list: its columns, order, page size, filters, Group By and buttons for what is selected', () => {
    expect(messages(list())).toEqual([]);
  });

  it('names every field a list asks for that the page does not have', () => {
    const page = list();
    page['layout'].columns.push('phone');
    page['layout'].sort = [{ field: 'joined' }];
    page['layout'].groupBy = ['city'];
    page['layout'].searchFields = ['vat'];
    page['layout'].filters[0].filter = [{ any: [{ field: 'ghost', op: 'set' }] }];
    page['layout'].defaultFilters = ['nope'];
    const paths = messages(page).map((m) => m.split(':')[0]);
    expect(paths).toEqual(
      expect.arrayContaining([
        'layout.columns[4]',
        'layout.sort[0].field',
        'layout.groupBy[0]',
        'layout.searchFields[0]',
        'layout.filters[0].filter[0].any[0].field',
        'layout.defaultFilters[0]',
      ])
    );
  });

  it('refuses a list on a page that collects responses, and a filter that compares with a field', () => {
    const responses = list();
    responses['data'] = { kind: 'responses' };
    expect(messages(responses).join('\n')).toMatch(/a list shows records/);
    const page = list();
    page['layout'].filters[0].filter = [{ field: 'state', op: '=', valueFrom: 'name' }];
    expect(messages(page).join('\n')).toMatch(/layout\.filters\[0\]\.filter\[0\]\.valueFrom: a list's filter compares with values/);
  });
});

describe('validatePage — sheet and layout parts', () => {
  it('takes every part of a sheet, a section, a wizard and a page', () => {
    const page = example('customer');
    page['maxWidth'] = 'medium';
    page['actionsPosition'] = 'bottom';
    const main = page['layout'].children[0];
    Object.assign(main, { icon: 'user', readonly: "state == 'blocked'", columns: { wide: 3, medium: 2, narrow: 1 } });
    page['layout'].badges = [{ id: 'b-vip', label: 'VIP', tone: 'success', icon: 'star', invisible: 'not is_company' }];
    page['layout'].alerts[0].dismissible = true;
    page['layout'].title.above = [{ type: 'field', id: 't-company', field: 'is_company' }];
    page['layout'].title.below = [{ type: 'field', id: 't-tags', field: 'tag_ids' }];
    page['layout'].statusbar.position = 'title';
    expect(messages(page)).toEqual([]);

    const survey = example('survey');
    Object.assign(survey['layout'], { clickable: true, nextLabel: 'Continue', backLabel: 'Previous', finishLabel: 'Send my answers' });
    Object.assign(survey['layout'].children[1], { optional: true, icon: 'chart' });
    expect(messages(survey)).toEqual([]);
  });

  it('checks a section’s readonly, a badge, and the fields above and below the title', () => {
    const page = example('customer');
    page['layout'].children[0].readonly = 'ghost_field';
    page['layout'].badges = [{ id: 'f-email', label: 'Twin', invisible: 'ghost_field' }];
    page['layout'].title.above = [{ type: 'field', id: 't-ghost', field: 'ghost_field' }];
    const text = messages(page).join('\n');
    expect(text).toMatch(/layout\.children\[0\]\.readonly: "ghost_field" reads "ghost_field"/);
    expect(text).toMatch(/layout\.badges\[0\]\.invisible: "ghost_field" reads/);
    expect(text).toMatch(/duplicate id "f-email"/);
    expect(text).toMatch(/layout\.title\.above\[0\]\.field: no field "ghost_field"/);
  });

  it('rejects columns per width outside one to four, or without the wide count', () => {
    const page = example('signup');
    page['layout'].children[0].columns = { wide: 5 };
    expect(messages(page).join('\n')).toMatch(/layout\.children\[0\]\.columns/);
    page['layout'].children[0].columns = { medium: 2 };
    expect(messages(page).join('\n')).toMatch(/layout\.children\[0\]\.columns/);
  });

  it('rejects a page width or an actions place it does not know', () => {
    const page = example('signup');
    page['maxWidth'] = '900px';
    page['actionsPosition'] = 'left';
    const paths = messages(page).map((m) => m.split(':')[0]);
    expect(paths).toEqual(expect.arrayContaining(['maxWidth', 'actionsPosition']));
  });
});

describe('validatePage — references', () => {
  it('rejects two elements with the same id, naming both places', () => {
    const page = example('customer');
    page['layout'].children[0].children[1].id = 'f-email';
    const text = messages(page).join('\n');
    expect(text).toMatch(/duplicate id "f-email"/);
    expect(text).toMatch(/layout\.children\[0\]\.children\[0\]/);
    expect(text).toMatch(/layout\.children\[0\]\.children\[1\]/);
  });

  it('rejects a collapsible section without a title to fold it by', () => {
    const page = example('survey');
    page['layout'].children[0].children = [{ type: 'section', id: 'loose', collapsible: true, children: [] }];
    expect(messages(page).join('\n')).toMatch(/layout\.children\[0\]\.children\[0\]: a collapsible section needs a title/);
  });

  it('rejects a section that starts collapsed but cannot fold', () => {
    const page = example('survey');
    page['layout'].children[0].children = [{ type: 'section', id: 'stuck', title: 'Stuck', collapsed: true, children: [] }];
    expect(messages(page).join('\n')).toMatch(/layout\.children\[0\]\.children\[0\]: collapsed needs collapsible: true/);
  });

  it('accepts a titled section that folds and starts folded', () => {
    const page = example('survey');
    page['layout'].children[0].children.push({ type: 'section', id: 'more', title: 'More', collapsible: true, collapsed: true, children: [] });
    expect(messages(page)).toEqual([]);
  });

  it('rejects a field node that points to an undefined field', () => {
    const page = example('survey');
    page['layout'].children[0].children[1].field = 'nickname';
    expect(messages(page).join('\n')).toMatch(/layout\.children\[0\]\.children\[1\]\.field: no field "nickname"/);
  });

  it('rejects a statusbar on a field that is not a selection or many2one', () => {
    const page = example('customer');
    page['layout'].statusbar.field = 'email';
    expect(messages(page).join('\n')).toMatch(/layout\.statusbar\.field: .*selection or many2one/);
  });

  it('rejects line kinds that point at fields the lines do not have', () => {
    const page = example('order');
    page['fields'].line_ids.lineKinds = { field: 'kind', text: 'title' };
    const text = messages(page).join('\n');
    expect(text).toMatch(/fields\.line_ids\.lineKinds\.field: "kind" is not a field of the lines of "line_ids"/);
    expect(text).toMatch(/fields\.line_ids\.lineKinds\.text: "title" is not a field of the lines of "line_ids"/);
  });

  it('rejects a line kind field that is not a selection or char, and text that is not char or text', () => {
    const page = example('order');
    page['fields'].line_ids.lineKinds = { field: 'qty', text: 'taxed' };
    const text = messages(page).join('\n');
    expect(text).toMatch(/fields\.line_ids\.lineKinds\.field: "qty" is a float; .*selection or char/);
    expect(text).toMatch(/fields\.line_ids\.lineKinds\.text: "taxed" is a boolean; .*char or text/);
  });

  it('rejects a selection kind field without the values that mark sections and notes', () => {
    const page = example('order');
    page['fields'].line_ids.lineKinds = { field: 'display_type', text: 'name', section: 'line_section' };
    expect(messages(page)).toEqual(['fields.line_ids.lineKinds.section: "display_type" has no option "line_section"']);
  });

  it('rejects a sequence field the lines do not have, or one that is not a whole number', () => {
    const page = example('order');
    page['fields'].line_ids.sequenceField = 'position';
    expect(messages(page)).toEqual(['fields.line_ids.sequenceField: "position" is not a field of the lines of "line_ids"']);
    page['fields'].line_ids.sequenceField = 'name';
    expect(messages(page)).toEqual(['fields.line_ids.sequenceField: "name" is a char; the field that keeps the order of lines must be an integer']);
  });

  it('rejects totals of fields the lines do not have, or that are not numbers', () => {
    const page = example('order');
    const lines = page['layout'].children[1].children[0].children[0];
    expect(lines.id).toBe('f-lines');
    lines.totals = ['weight', 'name'];
    expect(messages(page)).toEqual([
      'layout.children[1].children[0].children[0].totals[0]: "weight" is not a field of the lines of "line_ids"',
      'layout.children[1].children[0].children[0].totals[1]: "name" is a char; only integer, float and monetary columns add up',
    ]);
  });

  it('rejects totals on a field that has no lines', () => {
    const page = example('order');
    page['layout'].children[0].children[0].children[0].totals = ['qty'];
    expect(messages(page)).toEqual(['layout.children[0].children[0].children[0].totals: totals only apply to one2many fields; "partner_id" is a many2one']);
  });

  it('rejects optional columns the table does not show, and choices other than show or hide', () => {
    const page = example('order');
    const lines = page['layout'].children[1].children[0].children[0];
    lines.optionalColumns = { weight: 'show', qty: 'maybe' };
    expect(messages(page)).toEqual([
      'layout.children[1].children[0].children[0].optionalColumns.qty: Invalid option: expected one of "show"|"hide"',
    ]);
    lines.optionalColumns = { weight: 'show' };
    lines.columns = ['product_id', 'qty'];
    lines.totals = ['qty'];
    lines.optionalColumns = { weight: 'show', price: 'hide' };
    expect(messages(page)).toEqual([
      'layout.children[1].children[0].children[0].optionalColumns.weight: "weight" is not a column of "line_ids"',
      'layout.children[1].children[0].children[0].optionalColumns.price: "price" is not a column of "line_ids"',
    ]);
  });

  it('rejects optional columns on a field that has no lines', () => {
    const page = example('order');
    page['layout'].children[0].children[0].children[0].optionalColumns = { qty: 'show' };
    expect(messages(page)).toEqual(['layout.children[0].children[0].children[0].optionalColumns: optional columns only apply to one2many fields; "partner_id" is a many2one']);
  });

  it('rejects a way of editing lines on a field that has none, or one that is not cell or row', () => {
    const page = example('order');
    page['layout'].children[0].children[0].children[0].editMode = 'row';
    expect(messages(page)).toEqual(['layout.children[0].children[0].children[0].editMode: editMode only applies to one2many fields; "partner_id" is a many2one']);
    const other = example('order');
    other['layout'].children[1].children[0].children[0].editMode = 'page';
    expect(messages(other)).toEqual(['layout.children[1].children[0].children[0].editMode: Invalid option: expected one of "cell"|"row"']);
  });

  it('takes widget options, and checks that an option naming a field names one', () => {
    const page = example('fields');
    const progress = page['layout'].children.flatMap((s: any) => s.children ?? []).find((n: any) => n.id === 'f-progress');
    expect(progress.options).toBeDefined();
    progress.options = { max: 100, color: 'auto', maxField: 'nothing' };
    const text = messages(page).join('\n');
    expect(text).toMatch(/\.options\.maxField: no field "nothing"/);
    progress.options = 'big';
    expect(messages(page).join('\n')).toMatch(/\.options: /);
  });

  it('rejects a choice property without choices, and two properties of one name', () => {
    const page = example('fields');
    page['fields'].extra.definitions = [
      { name: 'zone', label: 'Zone', type: 'selection' },
      { name: 'floor', label: 'Floor', type: 'integer' },
      { name: 'floor', label: 'Level', type: 'integer' },
    ];
    expect(messages(page)).toEqual([
      'fields.extra.definitions[0].options: a choice property needs its choices',
      'fields.extra.definitions[2].name: "floor" is named twice',
    ]);
  });

  it('rejects one2many columns that are not among its line fields', () => {
    const page = example('customer');
    page['layout'].children[1].children[0].children[0].columns.push('fax');
    expect(messages(page).join('\n')).toMatch(/columns\[4\]: .*"fax"/);
  });

  it('rejects a currencyField that does not exist', () => {
    const page = example('customer');
    page['fields'].credit_limit.currencyField = 'money_kind';
    expect(messages(page).join('\n')).toMatch(/fields\.credit_limit\.currencyField: no field "money_kind"/);
  });

  it('rejects a filter whose valueFrom names an undefined field', () => {
    const page = example('customer');
    page['fields'].state_id.filter[0].valueFrom = 'nation_id';
    expect(messages(page).join('\n')).toMatch(/fields\.state_id\.filter\[0\]\.valueFrom: no field "nation_id"/);
  });

  it('rejects stat buttons and title fields that do not exist', () => {
    const page = example('customer');
    page['layout'].statButtons[1].field = 'bill_count';
    page['layout'].title.avatarField = 'logo';
    const text = messages(page).join('\n');
    expect(text).toMatch(/layout\.statButtons\[1\]\.field: no field "bill_count"/);
    expect(text).toMatch(/layout\.title\.avatarField: no field "logo"/);
  });
});
