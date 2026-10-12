import { checkPage, localizePage, pageWords, SKINS, validatePage } from '../../index';

/**
 * The quiet look in the page's format: a page drawn in it whole (`look.skin`),
 * a section or a single field quiet on its own — or boxed again inside a quiet
 * page — and the plain words a lock says while a rule keeps a field read-only.
 */

const page = (layout: unknown, look?: unknown) => ({
  fieldia: '0.1',
  id: 'bug',
  data: { kind: 'record', model: 'bug' },
  fields: {
    state: { type: 'selection', label: 'State', options: [{ value: 'new', label: 'New' }, { value: 'active', label: 'Active' }] },
    reason: { type: 'char', label: 'Reason' },
    notes: { type: 'text', label: 'Notes' },
  },
  layout,
  ...(look === undefined ? {} : { look }),
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

describe('the quiet look in the page format', () => {
  it('names three skins, the quiet one last', () => {
    expect(SKINS).toEqual(['underline', 'outlined', 'quiet']);
  });

  it('lets a page name its skin, and refuses one there is not', () => {
    for (const skin of SKINS) expect(problems(page(sections(), { skin }))).toEqual([]);
    expect(problems(page(sections(), { skin: 'quiet', theme: 'fluent', density: 'compact' }))).toEqual([]);
    expect(problems(page(sections(), { skin: 'boxed' }))).toEqual([expect.stringMatching(/skin/)]);
  });

  it('lets a section, and a single field, be quiet on its own or boxed inside a quiet page', () => {
    const p = page(
      sections(
        {
          type: 'section', id: 'head', title: 'Header', quiet: true, labels: 'beside',
          children: [
            { type: 'field', id: 'f-state', field: 'state', widget: 'dot', options: { label: true } },
            { type: 'field', id: 'f-reason', field: 'reason', quiet: false },
          ],
        },
        { type: 'section', id: 'body', children: [{ type: 'field', id: 'f-notes', field: 'notes', quiet: true }] }
      ),
      { skin: 'outlined' }
    );
    expect(problems(p)).toEqual([]);
    expect(runtime(p)).toEqual([]);
  });

  it('wants quiet as yes or no', () => {
    const p = page(sections({ type: 'section', id: 's', quiet: 'yes', children: [{ type: 'field', id: 'f', field: 'reason', quiet: 1 }] }));
    expect(problems(p)).toEqual([expect.stringMatching(/^layout\.children\[0\]\.children\[0\]\.quiet:/), expect.stringMatching(/^layout\.children\[0\]\.quiet:/)]);
  });

  it('takes a reason in plain words for a field or a group read-only by a rule, never an empty one', () => {
    const p = page(
      sections({
        type: 'section', id: 's', readonly: "state == 'active'", readonlyReason: 'Locked while the bug is active',
        children: [{ type: 'field', id: 'f', field: 'reason', readonly: "state != 'new'", readonlyReason: 'Set by the workflow' }],
      })
    );
    expect(problems(p)).toEqual([]);
    expect(runtime(p)).toEqual([]);
    expect(problems(page(sections({ type: 'field', id: 'f', field: 'reason', readonlyReason: '' })))).toEqual([expect.stringMatching(/readonlyReason/)]);
  });

  it('lists the reason among the words a translator works through, and translates it', () => {
    const p = {
      ...page(sections({ type: 'field', id: 'f', field: 'reason', help: 'Why it moved', readonly: true, readonlyReason: 'Set by the workflow' })),
      translations: { ar: { 'Set by the workflow': 'يضبطه سير العمل' } },
    };
    expect(pageWords(p as never)).toEqual(['Reason', 'Why it moved', 'Set by the workflow', 'State', 'New', 'Active', 'Notes']);
    const shown = localizePage(p as never, 'ar');
    expect((shown.layout as { children: { readonlyReason?: string }[] }).children[0].readonlyReason).toBe('يضبطه سير العمل');
  });
});
