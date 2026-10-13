import { validatePage } from '../../index';
import { checkPage } from './check-page';

/**
 * The pickers' own settings in the page format, as a work tracker draws a
 * bug: Area and Iteration as path pickers, State's dots in exact colours with
 * a tick alone in its list, Priority in Fieldia's own list, and tags added
 * from a button. Each word is known to the format; each is for the kind of
 * field it names, checked before anything draws.
 */

const fields = {
  area: { type: 'many2one', label: 'Area', relation: 'work.area' },
  title: { type: 'char', label: 'Title' },
  keywords: { type: 'char', label: 'Keywords' },
  state: {
    type: 'selection',
    label: 'State',
    options: [
      { value: 'new', label: 'New' },
      { value: 'active', label: 'Active' },
    ],
  },
  sizes: { type: 'selection', label: 'Sizes', multiple: true, options: [{ value: 's', label: 'S' }] },
  tags: { type: 'many2many', label: 'Tags', relation: 'work.tag' },
};

const page = (...children: Record<string, unknown>[]) => ({
  fieldia: '0.1',
  id: 'bug',
  data: { kind: 'record', model: 'work.item' },
  fields,
  layout: { type: 'sections', id: 's', children: children.map((child, i) => ({ type: 'field', id: `n${i}`, ...child })) },
});
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const at = 'layout.children[0]';

describe('the pickers’ settings in the page format', () => {
  it('takes a path picker, its separator, how many it suggests and its tree', () => {
    expect(problems(page({ field: 'area', widget: 'path' }))).toEqual([]);
    expect(problems(page({ field: 'area', widget: 'path', options: { separator: '/', suggestions: 0, tree: false, avatar: false } }))).toEqual([]);
    expect(checkPage(page({ field: 'area', widget: 'path', options: { suggestions: 5 } })).ok).toBe(true);
  });

  it('refuses a path picker’s settings written wrong', () => {
    expect(problems(page({ field: 'area', widget: 'path', options: { suggestions: -1 } }))).toEqual([`${at}.options.suggestions: Too small: expected number to be >=0`]);
    expect(problems(page({ field: 'area', widget: 'path', options: { suggestions: 2.5 } }))).toHaveLength(1);
    expect(problems(page({ field: 'area', widget: 'path', options: { separator: '' } }))).toHaveLength(1);
    expect(problems(page({ field: 'area', widget: 'path', options: { tree: 'yes' } }))[0]).toMatch(/^layout\.children\[0\]\.options\.tree: /);
  });

  it('takes a state’s colours as #rrggbb, and its list with a tick alone', () => {
    expect(problems(page({ field: 'state', widget: 'dot', options: { colours: { new: '#b2b2b2', active: '#007acc' }, listDots: false, label: true } }))).toEqual([]);
    expect(problems(page({ field: 'state', widget: 'dot', options: { colours: { active: 'blue' } } }))).toEqual([`${at}.options.colours.active: a colour is #rrggbb, such as "#007acc"`]);
    expect(problems(page({ field: 'state', widget: 'dot', options: { listDots: 'no' } }))).toHaveLength(1);
  });

  it('names only a state’s own values in its colours', () => {
    expect(problems(page({ field: 'state', widget: 'dot', options: { colours: { resolved: '#ff9d00' } } }))).toEqual([`${at}.options.colours.resolved: "resolved" is not a value of "state"`]);
  });

  it('takes Fieldia’s own list for a choice of one, and nothing else by that word', () => {
    expect(problems(page({ field: 'state', options: { list: 'own' } }))).toEqual([]);
    expect(problems(page({ field: 'state', options: { list: 'native' } }))).toEqual([`${at}.options.list: list is "own": Fieldia’s own list in place of the browser’s`]);
    expect(problems(page({ field: 'sizes', options: { list: 'own' } }))).toEqual([`${at}.options.list: list "own" is for a choice of one drawn as a list, with no widget; "sizes" is a selection of several`]);
    expect(problems(page({ field: 'state', widget: 'radio', options: { list: 'own' } }))).toEqual([`${at}.options.list: list "own" is for a choice of one drawn as a list, with no widget; "state" is a selection drawn as radio`]);
    expect(problems(page({ field: 'title', options: { list: 'own' } }))).toEqual([`${at}.options.list: list "own" is for a choice of one drawn as a list, with no widget; "title" is a char`]);
  });

  it('takes a button adding tags, on tags', () => {
    expect(problems(page({ field: 'tags', options: { adder: 'button' } }, { field: 'keywords', widget: 'tags', options: { adder: 'button' } }))).toEqual([]);
    expect(problems(page({ field: 'tags', widget: 'tags', options: { adder: 'box' } }))).toEqual([`${at}.options.adder: adder is "button": tags added from a button that turns into the tag box`]);
    expect(problems(page({ field: 'title', options: { adder: 'button' } }))).toEqual([`${at}.options.adder: adder is for tags: a many2many, or a char field drawn as tags; "title" is a char`]);
    expect(problems(page({ field: 'tags', widget: 'checkboxes', options: { adder: 'button' } }))).toEqual([`${at}.options.adder: adder is for tags: a many2many, or a char field drawn as tags; "tags" is a many2many drawn as checkboxes`]);
  });

  it('keeps a path picker to a link', () => {
    expect(problems(page({ field: 'title', widget: 'path' }))).toEqual([`${at}.widget: path is for a many2one field; "title" is a char`]);
  });
});
