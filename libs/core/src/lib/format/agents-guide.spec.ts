import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkPage } from './check-page';
import { wholeCheck } from './check-whole';
import { validatePage } from './validate';
import { stampPage } from './stamp';
import * as Viewer036 from './test-version-0.36';

/**
 * docs/agents.md, the guide for AI agents writing pages, says what the checks say: each mistake of its table refused
 * by `validatePage` and the whole check alike, in the very words the guide quotes; what a 0.37 viewer does with it —
 * refuses it before the draw as 0.35's did (`checkPage`), or takes it down as its whole check runs (0.36 drew it) — as
 * its table says; and
 * its worked example answered as it shows: the first page's four problems, the one the check before the draw refuses it
 * for, the second page passing, stamped "0.3".
 */
const GUIDE = readFileSync(join(__dirname, '..', '..', '..', '..', '..', 'docs', 'agents.md'), 'utf8');
const base = () => ({
  fieldia: '0.13',
  id: 'contact',
  title: 'Contact us',
  data: { kind: 'responses' },
  fields: {
    name: { type: 'char', label: 'Your name', required: true },
    email: { type: 'char', label: 'Email', required: true, pattern: '^[^@\\s]+@[^@\\s]+$' },
    topic: { type: 'selection', label: 'Topic', options: [{ value: 'sales', label: 'Sales' }, { value: 'support', label: 'Support' }] },
    seats: { type: 'integer', label: 'Seats', min: 1, max: 50 },
  },
  layout: {
    type: 'sections',
    id: 'root',
    children: [
      { type: 'field', id: 'f-name', field: 'name' },
      { type: 'field', id: 'f-email', field: 'email', autocomplete: 'email' },
      { type: 'field', id: 'f-topic', field: 'topic' },
      { type: 'field', id: 'f-seats', field: 'seats', invisible: "topic != 'sales'" },
    ],
  },
});
type Page = ReturnType<typeof base> & Record<string, unknown>;
const made = (change: (page: Page) => void) => {
  const page = base() as Page;
  change(page);
  return page;
};
const fields = (page: Page) => page.fields as Record<string, Record<string, unknown>>;
const parts = (page: Page) => page.layout.children as Record<string, unknown>[];

/** Each row of the guide's table, by the words it quotes, and the mistake it names. */
const MISTAKES: [string, Page][] = [
  ['fields.email.type: "type" is not one of the kinds allowed here', made((p) => (fields(p)['email']['type'] = 'email'))],
  ['fields.name.required: Invalid input: expected boolean, received string', made((p) => (fields(p)['name']['required'] = 'yes'))],
  ['fields.topic.options[0]: Invalid input: expected object, received string', made((p) => (fields(p)['topic']['options'] = ['sales', 'support']))],
  ['on.change.topic[0].do: "do" is not one of the kinds allowed here', made((p) => (p['on'] = { change: { topic: [{ do: 'setValue', field: 'seats', value: '1' }] } }))],
  ['fields.name: Unrecognized key: "read-only"', made((p) => (fields(p)['name']['read-only'] = true))],
  ['layout.children[0].id: Invalid input: expected string, received undefined', made((p) => delete parts(p)[0]['id'])],
  ['layout.children[1]: duplicate id "f-name", also used at layout.children[0]', made((p) => (parts(p)[1]['id'] = 'f-name'))],
  ['layout.children[4].field: no field "phone"', made((p) => parts(p).push({ type: 'field', id: 'f-phone', field: 'phone' }))],
  [`layout.children[3].invisible: "kind != 'sales'" reads "kind", which is not a field of this page`, made((p) => (parts(p)[3]['invisible'] = "kind != 'sales'"))],
  [`cannot read "topic === 'sales'": Unexpected "=" at character 9`, made((p) => (parts(p)[3]['invisible'] = "topic === 'sales'"))],
  ['on.change.topic[0].value: cannot read "hello world": Unexpected token at position 1', made((p) => (p['on'] = { change: { topic: [{ do: 'set', field: 'name', value: 'hello world' }] } }))],
  ['fields.seats.compute: cannot read "lenght(name)": no function "lenght": the functions are round, abs, min, max, len, …', made((p) => (fields(p)['seats']['compute'] = 'lenght(name)'))],
  ['fields.seats.min: the least (10) is more than the most (5): no value could be given', made((p) => Object.assign(fields(p)['seats'], { min: 10, max: 5 }))],
  [`fields.seats.default: "five" is not a whole number: an integer field's first value is one, written as a number`, made((p) => (fields(p)['seats']['default'] = 'five'))],
  [`fields.topic.default: "billing" is not one of the field's options: its first value is one of "sales", "support"`, made((p) => (fields(p)['topic']['default'] = 'billing'))],
  [`fields.topic.options[2].value: "sales" is the value of an option before it: each option's value once`, made((p) => (fields(p)['topic']['options'] as unknown[]).push({ value: 'sales', label: 'Sales again' }))],
  ['layout.columns[1]: "name" is a column before it: each column once', { ...(base() as Page), data: { kind: 'record', model: 'contact' }, layout: { type: 'list', id: 'list', columns: ['name', 'name'] } } as unknown as Page],
  ['layout.children[1].options.countries: countries is "list" (Fieldia’s own, found by typing) or "native" (the browser’s own list)', made((p) => Object.assign(parts(p)[1], { widget: 'phone', options: { countries: 'all' } }))],
  ['fieldia: "fieldia" says which format the page is written in: "0.14" for this Fieldia', made((p) => delete (p as Record<string, unknown>)['fieldia'])],
  ['fieldia: this page is in format 0.99, newer than this Fieldia reads (0.14): update Fieldia to show it', made((p) => (p.fieldia = '0.99'))],
];

describe('docs/agents.md says what the checks say', () => {
  it.each(MISTAKES)('"%s": quoted in the guide, said by validatePage, refused by the whole check, a 0.37 viewer as it says', (words, page) => {
    expect(GUIDE).toContain(`\`${words}\``);
    const validated = validatePage(page);
    expect(validated.ok).toBe(false);
    const said = validated.ok ? '' : validated.issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n');
    // The guide may end a long one with "…": what it quotes is the start of what the check says.
    expect(said).toContain(words.replace(/, …$/, ''));
    expect(wholeCheck(page).ok).toBe(false);
    // Its row says what a 0.37 viewer does: refuses it as 0.35's did, or takes it down as its whole check runs.
    const row = GUIDE.split('\n').find((line) => line.startsWith('| ') && line.includes(`\`${words}\``)) ?? '';
    const viewer = row.split(/(?<!\\)\|/)[3]?.trim();
    expect(viewer).toBe(checkPage(page).ok ? 'takes it down (0.36 drew it)' : 'refuses it, as 0.35 did');
  });

  it('every row of its table is one of these', () => {
    const table = GUIDE.split('## The mistakes the checks catch')[1].split('\n## ')[0];
    const rows = table.split('\n').filter((line) => /^\| [^-|]/.test(line) && !line.startsWith('| Mistake'));
    expect(rows.length).toBe(MISTAKES.length);
  });

  it('what a copy keeps and filters in groups: each as the guide writes it, stamped 0.14, refused by a 0.36 viewer and by the checks as it quotes', () => {
    const section = GUIDE.split('## What a copy keeps, and filters in groups')[1].split('\n## ')[0];
    const bill = { ...base(), data: { kind: 'record', model: 'account.move' }, fields: { ...base().fields, state: { type: 'selection', label: 'Status', options: [{ value: 'draft', label: 'Draft' }, { value: 'posted', label: 'Posted' }], default: 'draft', copy: false } } };
    expect(section).toContain('"state": { "type": "selection", …, "default": "draft", "copy": false }');
    expect(validatePage(bill)).toMatchObject({ ok: true });
    expect(stampPage(bill).fieldia).toBe('0.14');
    const list = (group: string) => ({ ...base(), data: { kind: 'record', model: 'lead' }, layout: { type: 'list', id: 'leads', columns: ['name'], filters: [{ id: 'late', label: 'Late', filter: [{ field: 'seats', op: '>', value: 1 }], group }] } });
    expect(section).toContain('"group": "when"');
    expect(validatePage(list('when'))).toMatchObject({ ok: true });
    expect(stampPage(list('when')).fieldia).toBe('0.14');
    const refused = validatePage(list('due date'));
    const words = 'layout.filters[0].group: a filter’s group is named by one word, such as "when"';
    expect(section).toContain(`\`${words}\``);
    expect(refused.ok ? [] : refused.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual([words]);
    expect(wholeCheck(list('due date')).ok).toBe(false);
    // The words an older viewer says: the 0.36 viewer's own check, as it was released.
    expect(section).toContain(`\`${Viewer036.formatProblem('0.14', Viewer036.FORMAT_VERSIONS)}\``);
  });

  it('its worked example: the first page answered as the guide shows, the second passing, stamped "0.3"', () => {
    const blocks = [...GUIDE.matchAll(/```(json|text)\n([\s\S]*?)\n```/g)].map((match) => ({ lang: match[1], text: match[2] }));
    const example = GUIDE.split('## A worked example')[1];
    const [first, answer, fixed] = [...example.matchAll(/```(json|text)\n([\s\S]*?)\n```/g)].map((match) => match[2]);
    expect(blocks.length).toBeGreaterThan(3);
    const refused = validatePage(JSON.parse(first));
    expect(refused.ok ? [] : refused.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(answer.split('\n'));
    // The check before the draw refuses it for the one mistake the guide names; fixed alone, the whole check the rest.
    const before = checkPage(JSON.parse(first));
    expect(before.ok ? [] : before.issues.map((issue) => `${issue.path}: ${issue.message}`)).toEqual(['fields.email: a field needs a type Fieldia knows and a label']);
    expect(example).toContain('`fields.email: a field needs a type Fieldia knows and a label`');
    const emailFixed = JSON.parse(first);
    emailFixed.fields.email.type = 'char';
    expect(checkPage(emailFixed).ok).toBe(true);
    expect(wholeCheck(emailFixed).ok).toBe(false);
    const passed = validatePage(JSON.parse(fixed));
    expect(passed).toMatchObject({ ok: true });
    expect(passed.warnings).toBeUndefined();
    expect(stampPage(JSON.parse(fixed)).fieldia).toBe('0.3');
    expect(example).toContain('`stampPage` stamps the page `"0.3"`');
  });
});
