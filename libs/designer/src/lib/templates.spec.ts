import { checkPage, validatePage, type FieldNode, type Page } from '@fieldia/core';
import { blankPage, createDesigner, pageChecks } from './designer';
import { kindOfField } from './kinds';
import { allIds } from './page-tree';
import { isBlank, SCREEN_TEMPLATES, SURVEY_TEMPLATES, templatesFor, type PageTemplate } from './templates';

/** The fields a page shows, in order. */
const shown = (page: Page): FieldNode[] => {
  const walk = (nodes: unknown[]): FieldNode[] =>
    (nodes as { type: string; children?: unknown[] }[]).flatMap((n) => (n.type === 'field' ? [n as FieldNode] : n.children ? walk(n.children) : []));
  return walk((page.layout as { children: unknown[] }).children);
};

const custom: PageTemplate = {
  id: 'site-check',
  title: 'Site check',
  description: 'What an inspector notes on a visit.',
  page: { fieldia: '0.1', id: 'site-check', title: 'Site check', data: { kind: 'record', model: 'site.check' }, fields: { site: { type: 'char', label: 'Site' } }, layout: { type: 'sections', id: 'sections', children: [{ type: 'section', id: 'main', children: [{ type: 'field', id: 'q-site', field: 'site' }] }] } },
};

describe('the templates a blank page starts from', () => {
  it.each([...SURVEY_TEMPLATES, ...SCREEN_TEMPLATES].map((t) => [t.id, t] as const))('%s is a page Fieldia reads, with nothing to fix before publishing', (_id, template) => {
    expect(validatePage(template.page)).toMatchObject({ ok: true });
    expect(checkPage(template.page)).toMatchObject({ ok: true });
    expect(pageChecks(template.page).filter((c) => c.severity === 'must')).toEqual([]);
    expect(template.title).toBe(template.page.title);
    expect(template.description).toMatch(/\.$/);
    // Every field is one of the designer's kinds, so it is edited as one.
    for (const node of shown(template.page)) expect(kindOfField(template.page.fields[node.field], node)).not.toBeNull();
    expect(shown(template.page).length).toBeGreaterThanOrEqual(4);
  });

  it('gives a survey surveys, and a screen screens', () => {
    expect(SURVEY_TEMPLATES.map((t) => t.id)).toEqual(['feedback', 'event-registration', 'job-application']);
    expect(SCREEN_TEMPLATES.map((t) => t.id)).toEqual(['contact', 'order-request']);
    for (const t of SURVEY_TEMPLATES) expect(t.page.layout.type).toBe('wizard');
    for (const t of SCREEN_TEMPLATES) expect(t.page.layout.type).toBe('sections');
    expect(templatesFor(blankPage('survey', 'S')).map((t) => t.id)).toEqual(['feedback', 'event-registration', 'job-application']);
    expect(templatesFor(blankPage('screen', 'S')).map((t) => t.id)).toEqual(['contact', 'order-request']);
  });

  it('adds the app’s own after Fieldia’s, where they fit', () => {
    expect(templatesFor(blankPage('screen', 'S'), [custom]).map((t) => t.id)).toEqual(['contact', 'order-request', 'site-check']);
    expect(templatesFor(blankPage('survey', 'S'), [custom]).map((t) => t.id)).toEqual(['feedback', 'event-registration', 'job-application']);
  });

  it('calls a page blank while it has no part of its own', () => {
    expect(isBlank(blankPage('survey', 'S'))).toBe(true);
    expect(isBlank(blankPage('screen', 'S'))).toBe(true);
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    designer.addContainer('Page 2');
    expect(isBlank(designer.getPage())).toBe(true);
    designer.addQuestion('short-answer');
    expect(isBlank(designer.getPage())).toBe(false);
    const screen = createDesigner({ page: blankPage('screen', 'S') });
    screen.addBlock('heading', { parent: 'section-1' });
    expect(isBlank(screen.getPage())).toBe(false);
    // A sheet has its title field from the start, and a list its columns: neither is started from a template.
    expect(isBlank(blankPage('sheet', 'S'))).toBe(false);
    expect(isBlank(blankPage('list', 'S'))).toBe(false);
  });
});

describe('starting from a template', () => {
  it('puts it in place of the blank page as one edit, keeping the page’s id and where its answers go', () => {
    const designer = createDesigner({ page: blankPage('screen', 'Supplier') });
    const before = designer.getPage();
    expect(designer.replacePage(SCREEN_TEMPLATES[0].page)).toBe(true);
    const page = designer.getPage();
    expect(page.id).toBe('supplier');
    expect(page.data).toEqual({ kind: 'record', model: 'supplier' });
    expect(page.title).toBe('Contact');
    expect(shown(page).map((n) => page.fields[n.field].label)).toEqual(shown(SCREEN_TEMPLATES[0].page).map((n) => SCREEN_TEMPLATES[0].page.fields[n.field].label));
    designer.undo();
    expect(designer.getPage()).toEqual(before);
    expect(designer.getState().canUndo).toBe(false);
  });

  it('leaves nothing picked, and the template as it was', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    designer.select('step-1');
    const copy = JSON.stringify(SURVEY_TEMPLATES[0]);
    designer.replacePage(SURVEY_TEMPLATES[0].page);
    expect(designer.getState().selected).toBeNull();
    expect(designer.getState().picked).toEqual([]);
    designer.updateQuestion(shown(designer.getPage())[0].id, { label: 'Changed' });
    expect(JSON.stringify(SURVEY_TEMPLATES[0])).toBe(copy);
  });

  it('refuses a page for the other editor, saying so', () => {
    const survey = createDesigner({ page: blankPage('survey', 'S') });
    expect(survey.replacePage(SCREEN_TEMPLATES[0].page)).toBe(false);
    expect(survey.getState().issues).toEqual(['A survey is made of pages of questions: this is a screen of sections']);
    const screen = createDesigner({ page: blankPage('screen', 'S') });
    expect(screen.replacePage(SURVEY_TEMPLATES[0].page)).toBe(false);
    expect(screen.getState().issues).toEqual(['A screen is made of sections: this is a survey’s pages of questions']);
    expect(isBlank(screen.getPage())).toBe(true);
  });

  it('refuses what is not a page, saying what is wrong with it', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    const broken = { ...SURVEY_TEMPLATES[0].page, layout: { type: 'wizard', id: 'steps', children: [{ type: 'step', id: 'a', label: 'A', children: [{ type: 'field', id: 'x', field: 'missing' }] }] } } as Page;
    expect(designer.replacePage(broken)).toBe(false);
    expect(designer.getState().issues[0]).toMatch(/^This is not a page the designer can open: .*missing/);
    expect(designer.replacePage('nothing' as unknown as Page)).toBe(false);
    expect(designer.getState().issues[0]).toMatch(/^This is not a page the designer can open/);
    expect(designer.getState().canUndo).toBe(false);
  });

  it('gives each part of the template ids the page can keep', () => {
    const designer = createDesigner({ page: blankPage('survey', 'S') });
    designer.replacePage(SURVEY_TEMPLATES[1].page);
    const ids = allIds(designer.getPage());
    // A question added after keeps clear of them.
    const added = designer.addQuestion('short-answer') as string;
    expect(ids.has(added)).toBe(false);
  });

  it('offers the designer’s templates: Fieldia’s for its page, then the app’s', () => {
    const designer = createDesigner({ page: blankPage('screen', 'S'), templates: [custom] });
    expect(designer.templates().map((t) => t.id)).toEqual(['contact', 'order-request', 'site-check']);
  });
});
