import type { FieldNode, Page, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryPageStore, type Designer } from './designer';
import type { GrafloriaWidget } from './grafloria';
import { button, choose, field, mount, tick, type, unmount } from './test-screen';
import { rowsOf } from './screen-layout';

const sectionsOf = (page: Page) => (page.layout as { children: SectionNode[] }).children;
const fieldsOf = (page: Page, section: number) => sectionsOf(page)[section].children as FieldNode[];
const cellsOf = (widgets: GrafloriaWidget[]) => widgets.map((w) => [w.id, w.x, w.y, w.span, w.rows]);
/** Rows a one-line field and a paragraph start with on the canvas. */
const LINE = rowsOf({ type: 'char', label: 'Line' }, { type: 'field', id: 'line', field: 'line' });
const PARAGRAPH = rowsOf({ type: 'text', label: 'Paragraph' }, { type: 'field', id: 'paragraph', field: 'paragraph' });

/** A visit report: "Visit" in two columns (customer, date, notes across both) and "Follow-up" in one. */
function visitReport(): { designer: Designer; ids: Record<string, string>; sections: [string, string] } {
  const designer = createDesigner({ page: blankPage('screen', 'Visit report'), store: createMemoryPageStore() });
  const visit = sectionsOf(designer.getPage())[0].id;
  designer.renameContainer(visit, 'Visit');
  designer.setColumns(visit, 2);
  const customer = designer.addQuestion('short-answer', { parent: visit }) as string;
  designer.updateQuestion(customer, { label: 'Customer' });
  const date = designer.addQuestion('date', { parent: visit }) as string;
  designer.updateQuestion(date, { label: 'Date' });
  const notes = designer.addQuestion('paragraph', { parent: visit }) as string;
  designer.updateQuestion(notes, { label: 'Notes' });
  designer.setColspan(notes, 2);
  const followUp = designer.addContainer('Follow-up') as string;
  designer.setColumns(followUp, 1);
  const next = designer.addQuestion('short-answer', { parent: followUp }) as string;
  designer.updateQuestion(next, { label: 'Next step' });
  designer.select(null);
  return { designer, ids: { customer, date, notes, next }, sections: [visit, followUp] };
}

describe('screen editor — the canvas', () => {
  it('draws one board per section, each field where the viewer will put it', () => {
    const { designer, ids, sections } = visitReport();
    const { host, live, boardOf } = mount(designer);
    expect(live()).toHaveLength(2);
    const visit = boardOf(sections[0]);
    expect(visit.options).toMatchObject({ columns: 2, float: true, sizing: 'grow' });
    expect(cellsOf(visit.options.widgets)).toEqual([
      [ids['customer'], 0, 0, 1, LINE],
      [ids['date'], 1, 0, 1, LINE],
      [ids['notes'], 0, LINE, 2, PARAGRAPH],
    ]);
    expect(boardOf(sections[1]).options.columns).toBe(1);
    const labels = [...host.querySelectorAll('.fd-canvas .fd-label')].map((l) => l.textContent);
    expect(labels).toEqual(['Customer', 'Date', 'Notes', 'Next step']);
  });

  it('draws each field with its real widget, which cannot be typed in on the canvas', () => {
    const { designer, ids, sections } = visitReport();
    const { boardOf } = mount(designer);
    const card = boardOf(sections[0]).hosts.get(ids['notes'])?.querySelector('.fd-canvas-field') as HTMLElement;
    expect(card.querySelector('textarea')).not.toBeNull();
    expect(card.hasAttribute('inert')).toBe(true);
  });

  it('turns a drag on the board into one edit, then lays the board out again', async () => {
    const { designer, ids, sections } = visitReport();
    const { boardOf } = mount(designer);
    const board = boardOf(sections[0]);
    // Notes dragged to the top; customer and date pushed below it.
    board.options.onLayoutChange?.('main', [
      { id: ids['customer'], x: 0, y: PARAGRAPH, span: 1, rows: LINE },
      { id: ids['date'], x: 1, y: PARAGRAPH, span: 1, rows: LINE },
      { id: ids['notes'], x: 0, y: 0, span: 2, rows: PARAGRAPH },
    ]);
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['notes'], ids['customer'], ids['date']]);
    await tick();
    expect(board.disposed).toBe(true);
    expect(cellsOf(boardOf(sections[0]).options.widgets)).toEqual([
      [ids['notes'], 0, 0, 2, PARAGRAPH],
      [ids['customer'], 0, PARAGRAPH, 1, LINE],
      [ids['date'], 1, PARAGRAPH, 1, LINE],
    ]);
    designer.undo();
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['customer'], ids['date'], ids['notes']]);
  });

  it('turns a resize into a width', async () => {
    const { designer, ids, sections } = visitReport();
    const { boardOf } = mount(designer);
    boardOf(sections[0]).options.onLayoutChange?.('main', [
      { id: ids['customer'], x: 0, y: 0, span: 2, rows: LINE },
      { id: ids['date'], x: 0, y: LINE, span: 1, rows: LINE },
      { id: ids['notes'], x: 0, y: 2 * LINE, span: 2, rows: PARAGRAPH },
    ]);
    expect(fieldsOf(designer.getPage(), 0)[0].colspan).toBe(2);
  });

  it('shows an empty section as a hint, with no board', () => {
    const { designer } = visitReport();
    const empty = designer.addContainer('Photos') as string;
    designer.select(null);
    const { host, live } = mount(designer);
    expect(live()).toHaveLength(2);
    expect(host.querySelector(`[data-node="${empty}"] .fd-canvas-empty`)?.textContent).toMatch(/No fields/);
  });

  it('removes every board when it is destroyed', () => {
    const { designer } = visitReport();
    const { live } = mount(designer);
    unmount();
    expect(live()).toHaveLength(0);
  });
});

describe('screen editor — selecting', () => {
  it('selects what is pressed on a board, and shows it in the properties', () => {
    const { designer, ids, sections } = visitReport();
    const { host, boardOf } = mount(designer);
    boardOf(sections[0]).options.onSelect?.(ids['date'], 'main');
    expect(designer.getState().selected).toBe(ids['date']);
    expect(field(host, 'Label').value).toBe('Date');
  });

  it('marks the selected field on its own board only', () => {
    const { designer, ids, sections } = visitReport();
    const { boardOf } = mount(designer);
    designer.select(ids['next']);
    expect(boardOf(sections[1]).selected).toBe(ids['next']);
    expect(boardOf(sections[0]).selected).toBeUndefined();
  });

  it('selects a section from its title', () => {
    const { designer, sections } = visitReport();
    const { host } = mount(designer);
    (host.querySelector(`[data-node="${sections[1]}"] .fd-canvas-section-title`) as HTMLElement).click();
    expect(designer.getState().selected).toBe(sections[1]);
    expect(field(host, 'Section title').value).toBe('Follow-up');
  });
});

describe('screen editor — adding and changing fields', () => {
  it('adds a field to the selected section and puts the cursor in its label', () => {
    const { designer, sections } = visitReport();
    const { host, boardOf } = mount(designer);
    designer.select(sections[1]);
    button(host.querySelector('.fd-palette') as Element, 'Date').click();
    const added = fieldsOf(designer.getPage(), 1)[1];
    expect(added.widget ?? designer.getPage().fields[added.field].type).toBe('date');
    expect(designer.getState().selected).toBe(added.id);
    expect(boardOf(sections[1]).options.widgets.map((w) => w.id)).toContain(added.id);
    const label = field(host, 'Label');
    expect(document.activeElement).toBe(label);
    expect([label.selectionStart, label.selectionEnd]).toEqual([0, label.value.length]);
  });

  it('puts the cursor in the new field’s label when another field was selected, so a run of them can be typed', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['customer']);
    button(host.querySelector('.fd-palette') as Element, 'Email').click();
    const added = designer.getState().selected as string;
    expect(added).not.toBe(ids['customer']);
    expect(document.activeElement).toBe(field(host, 'Label'));
    type(field(host, 'Label'), 'Email');
    expect(designer.getPage().fields[(fieldsOf(designer.getPage(), 0).find((n) => n.id === added) as FieldNode).field].label).toBe('Email');
  });

  it('edits the label, repainting the card without rebuilding the board', () => {
    const { designer, ids, sections } = visitReport();
    const { host, boards, boardOf } = mount(designer);
    designer.select(ids['customer']);
    const built = boards.length;
    type(field(host, 'Label'), 'Customer name');
    expect(designer.getPage().fields[fieldsOf(designer.getPage(), 0)[0].field].label).toBe('Customer name');
    expect(boards.length).toBe(built);
    expect(boardOf(sections[0]).hosts.get(ids['customer'])?.querySelector('.fd-label')?.textContent).toBe('Customer name');
    expect(document.activeElement).toBe(field(host, 'Label'));
  });

  it('sets the width, and moves a field to another section', () => {
    const { designer, ids, sections } = visitReport();
    const { host, boardOf } = mount(designer);
    designer.select(ids['customer']);
    const width = field(host, 'Width');
    expect([...width.options].map((o) => o.textContent)).toEqual(['1 column', '2 columns (full width)']);
    choose(width, '2');
    expect(fieldsOf(designer.getPage(), 0)[0].colspan).toBe(2);
    expect(boardOf(sections[0]).options.widgets[0].span).toBe(2);
    choose(field(host, 'Section'), sections[1]);
    expect(fieldsOf(designer.getPage(), 1).map((n) => n.id)).toEqual([ids['next'], ids['customer']]);
    expect(boardOf(sections[1]).options.widgets.map((w) => w.id)).toEqual([ids['next'], ids['customer']]);
  });

  it('changes the kind, giving a paragraph more room', () => {
    const { designer, ids, sections } = visitReport();
    const { host, boardOf } = mount(designer);
    designer.select(ids['next']);
    choose(field(host, 'Kind of field'), 'paragraph');
    expect(boardOf(sections[1]).options.widgets[0].rows).toBe(PARAGRAPH);
  });

  it('marks a field required and gives it help text', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['date']);
    field(host, 'Required').click();
    type(field(host, 'Help text'), 'The day of the visit');
    expect(designer.getPage().fields[fieldsOf(designer.getPage(), 0)[1].field]).toMatchObject({ required: true, help: 'The day of the visit' });
  });

  it('duplicates and deletes the selected field', () => {
    const { designer, ids } = visitReport();
    const { host } = mount(designer);
    designer.select(ids['date']);
    button(host.querySelector('.fd-properties') as Element, 'Duplicate').click();
    expect(fieldsOf(designer.getPage(), 0)).toHaveLength(4);
    button(host.querySelector('.fd-properties') as Element, 'Delete field').click();
    expect(fieldsOf(designer.getPage(), 0).map((n) => n.id)).toEqual([ids['customer'], ids['date'], ids['notes']]);
  });
});

describe('screen editor — sections', () => {
  it('renames a section and changes its columns', () => {
    const { designer, sections } = visitReport();
    const { host, boardOf } = mount(designer);
    designer.select(sections[1]);
    type(field(host, 'Section title'), 'Next steps');
    choose(field(host, 'Columns'), '3');
    expect(sectionsOf(designer.getPage())[1]).toMatchObject({ title: 'Next steps', columns: 3 });
    expect(boardOf(sections[1]).options.columns).toBe(3);
    expect(host.querySelector(`[data-node="${sections[1]}"] .fd-canvas-section-title`)?.textContent).toBe('Next steps');
  });

  it('adds a section and deletes one', () => {
    const { designer, sections } = visitReport();
    const { host } = mount(designer);
    button(host, 'Add section').click();
    expect(sectionsOf(designer.getPage())).toHaveLength(3);
    designer.select(sections[1]);
    button(host.querySelector('.fd-properties') as Element, 'Delete section').click();
    expect(sectionsOf(designer.getPage()).map((s) => s.id)).not.toContain(sections[1]);
    expect(host.querySelector(`[data-node="${sections[1]}"]`)).toBeNull();
  });
});

describe('screen editor — preview', () => {
  it('shows the screen as people will use it, and back', () => {
    const { designer } = visitReport();
    const { host } = mount(designer);
    button(host, 'Preview').click();
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(true);
    const preview = host.querySelector('.fd-screen-preview') as HTMLElement;
    expect([...preview.querySelectorAll('.fd-label')].map((l) => l.textContent)).toEqual(['Customer', 'Date', 'Notes', 'Next step']);
    expect(button(host, 'Preview').getAttribute('aria-pressed')).toBe('true');
    button(host, 'Preview').click();
    expect(preview.hidden).toBe(true);
    expect((host.querySelector('.fd-screen-body') as HTMLElement).hidden).toBe(false);
  });
});
