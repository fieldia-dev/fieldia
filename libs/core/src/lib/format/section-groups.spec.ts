import { checkPage, localizePage, pageWords, validatePage } from '../../index';

/**
 * A work item's groups in the page's format: a row of columns of their own
 * widths and gap ("50% 1fr 1fr", 16px), groups that fold from their heading's
 * end and show alone over the body (⤢), help in a light box with an icon and
 * links in its words, and a links box's words translated with the page.
 */

const page = (layout: unknown, more: Record<string, unknown> = {}) => ({
  fieldia: '0.1',
  id: 'bug',
  data: { kind: 'record', model: 'bug' },
  fields: {
    steps: { type: 'html', label: 'Repro Steps' },
    hours: { type: 'float', label: 'Original Estimate' },
    related: { type: 'many2many', label: 'Related Work', relation: 'work.item' },
  },
  layout,
  ...more,
});
const sections = (...children: unknown[]) => ({ type: 'sections', id: 'root', children });
const problems = (input: unknown) => {
  const r = validatePage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const runtime = (input: unknown) => {
  const r = checkPage(input);
  return r.ok ? [] : r.issues.map((i) => `${i.path}: ${i.message}`);
};
const group = (more: Record<string, unknown>, children: unknown[] = [{ type: 'field', id: 'f-steps', field: 'steps', labels: 'hidden' }]) => ({ type: 'section', id: 'g', title: 'Repro Steps', style: 'line', children, ...more });

describe('a work item’s groups in the page format', () => {
  it('takes columns of their own widths and gap, and groups that fold at the heading’s end and maximise', () => {
    const p = page(
      sections({
        type: 'section', id: 'cols', style: 'plain', columns: 3, tracks: ['50%', '1fr', '1fr'], gap: 16,
        children: [
          group({ collapsible: true, foldAt: 'end', maximise: true }),
          { type: 'section', id: 'effort', title: 'Effort (Hours)', style: 'line', collapsible: true, collapsed: true, foldAt: 'end', children: [{ type: 'field', id: 'f-hours', field: 'hours' }] },
          { type: 'section', id: 'deploy', title: 'Deployment', style: 'line', children: [{ type: 'text', id: 'x-help', style: 'help', icon: 'info', text: 'Go to [Releases](https://example.com/releases) and turn on reporting.' }] },
        ],
      })
    );
    expect(problems(p)).toEqual([]);
    expect(runtime(p)).toEqual([]);
    for (const tracks of [['274px', '1fr'], ['12.5%', '87.5%'], ['2fr', '1fr']]) expect(problems(page(sections({ type: 'section', id: 's', columns: 2, tracks, children: [] })))).toEqual([]);
    expect(problems(page(sections({ type: 'section', id: 's', columns: 1, gap: 0, children: [] })))).toEqual([]);
  });

  it('refuses widths that are no widths, a gap past 48, a fold control in no place and an empty icon', () => {
    expect(problems(page(sections({ type: 'section', id: 's', columns: 2, tracks: ['auto', '1fr'], children: [] })))).toEqual([expect.stringMatching(/^layout\.children\[0\]\.tracks\[0\]: .*pixels/)]);
    expect(problems(page(sections({ type: 'section', id: 's', columns: 2, tracks: ['1 fr', '1fr'], children: [] })))).toEqual([expect.stringMatching(/tracks\[0\]/)]);
    expect(problems(page(sections({ type: 'section', id: 's', columns: 2, tracks: [], children: [] })))).toEqual([expect.stringMatching(/tracks/)]);
    expect(problems(page(sections({ type: 'section', id: 's', gap: 49, children: [] })))).toEqual([expect.stringMatching(/gap/)]);
    expect(problems(page(sections({ type: 'section', id: 's', gap: 4.5, children: [] })))).toEqual([expect.stringMatching(/gap/)]);
    expect(problems(page(sections(group({ collapsible: true, foldAt: 'middle' }))))).toEqual([expect.stringMatching(/foldAt/)]);
    expect(problems(page(sections(group({ maximise: 'yes' }))))).toEqual([expect.stringMatching(/maximise/)]);
    expect(problems(page(sections({ type: 'text', id: 't', style: 'help', icon: '', text: 'Help' })))).toEqual([expect.stringMatching(/icon/)]);
    expect(problems(page(sections({ type: 'text', id: 't', style: 'tip', text: 'Help' })))).toEqual([expect.stringMatching(/style/)]);
  });

  it('wants one width for each column, columns to give them to, and none on a line of parts', () => {
    expect(runtime(page(sections({ type: 'section', id: 's', columns: 3, tracks: ['50%', '1fr'], children: [] })))).toEqual(['layout.children[0].tracks: the group has 3 columns and 2 widths: give one width for each column']);
    expect(runtime(page(sections({ type: 'section', id: 's', columns: { wide: 2, medium: 1 }, tracks: ['274px', '1fr'], children: [] })))).toEqual([]);
    expect(runtime(page(sections({ type: 'section', id: 's', tracks: ['1fr'], children: [] })))).toEqual([expect.stringMatching(/^layout\.children\[0\]\.tracks: column widths need columns/)]);
    expect(runtime(page(sections({ type: 'section', id: 's', title: 'Line', style: 'inline', tracks: ['1fr'], children: [] })))).toEqual([expect.stringMatching(/one line take no column widths/)]);
    // The quick check reads widths too: the viewer never draws a broken grid.
    expect(runtime(page(sections({ type: 'section', id: 's', columns: 1, tracks: ['wide'], children: [] })))).toEqual([expect.stringMatching(/^layout\.children\[0\]\.tracks\[0\]: "wide" is no width/)]);
  });

  it('places the fold control only on a group that folds, and the ⤢ only on a group with a heading', () => {
    expect(runtime(page(sections(group({ foldAt: 'end' }))))).toEqual(['layout.children[0].foldAt: the fold control’s place needs a group that folds: collapsible: true']);
    expect(runtime(page(sections({ type: 'section', id: 's', maximise: true, children: [] })))).toEqual(['layout.children[0].maximise: a group is maximised from its heading: give it a title']);
    expect(runtime(page(sections(group({ collapsible: true, foldAt: 'start', maximise: true }))))).toEqual([]);
  });

  it('lists a help box’s words and a links box’s words for a translator, and translates them', () => {
    const p = page(
      sections(
        { type: 'text', id: 'x', style: 'help', icon: 'branch', text: 'Link a [commit](https://example.com/commit) to see its status.' },
        { type: 'field', id: 'f-related', field: 'related', widget: 'links', labels: 'hidden', options: { add: 'menu', addLabel: 'Add link', emptyLink: 'Add an existing work item as a parent', help: 'Link [work](https://example.com) here.', helpIcon: 'branch' } },
        { type: 'field', id: 'f-steps', field: 'steps', options: { editor: 'markdown', references: [{ key: '#', model: 'work.item', label: 'Work item', icon: 'hash' }] } }
      ),
      { translations: { fr: { 'Add link': 'Ajouter un lien', 'Add an existing work item as a parent': 'Ajouter un élément existant comme parent', 'Work item': 'Élément de travail', 'Link a [commit](https://example.com/commit) to see its status.': 'Liez un [commit](https://example.com/commit) pour voir son état.' } } }
    );
    expect(problems(p)).toEqual([]);
    const words = pageWords(p as never);
    expect(words).toEqual(expect.arrayContaining(['Link a [commit](https://example.com/commit) to see its status.', 'Add link', 'Add an existing work item as a parent', 'Link [work](https://example.com) here.', 'Work item']));
    // A widget's names stay names: the kind of link and its model, the icon.
    expect(words).not.toEqual(expect.arrayContaining(['menu', 'work.item', 'branch', '#', 'markdown']));
    const fr = localizePage(p as never, 'fr') as unknown as { layout: { children: { text?: string; options?: Record<string, unknown> }[] } };
    expect(fr.layout.children[0].text).toBe('Liez un [commit](https://example.com/commit) pour voir son état.');
    expect(fr.layout.children[1].options).toMatchObject({ add: 'menu', addLabel: 'Ajouter un lien', emptyLink: 'Ajouter un élément existant comme parent', helpIcon: 'branch' });
    expect(fr.layout.children[2].options).toEqual({ editor: 'markdown', references: [{ key: '#', model: 'work.item', label: 'Élément de travail', icon: 'hash' }] });
  });
});
