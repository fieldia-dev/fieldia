import { readFileSync } from 'node:fs';
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

describe('validatePage — the two reference pages', () => {
  it.each(['customer', 'survey'])('accepts the %s example', (name) => {
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

describe('validatePage — references', () => {
  it('rejects two elements with the same id, naming both places', () => {
    const page = example('customer');
    page['layout'].children[0].children[1].id = 'f-is-company';
    const text = messages(page).join('\n');
    expect(text).toMatch(/duplicate id "f-is-company"/);
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
