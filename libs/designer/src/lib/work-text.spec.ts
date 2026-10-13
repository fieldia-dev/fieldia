import type { FieldNode, SectionNode } from '@fieldia/core';
import { blankPage, createDesigner, type Designer } from './designer';
import { DESIGNER_WORDS } from './designer-words';
import { mount, openTab } from './test-editor';
import { employeeDesigner, expectValid, nodeOf } from './test-layout';

/**
 * A work item's body in the designer: a group's own column widths and gap,
 * its fold control at its heading's end and its ⤢; words in a help box with
 * an icon; a formatted text's toolbar, tools and editors; a many2many as a
 * links box — each set, taken back, refused where it cannot be, kept valid.
 */

describe('a group’s own widths, gap, fold control and ⤢', () => {
  it('sets widths for each column and a gap, and takes them back', () => {
    const d = employeeDesigner();
    expect(d.setSectionLook('personal', { tracks: ['50%', '1fr', '1fr'], gap: 16 })).toBe(true);
    expect(nodeOf(d.getPage(), 'personal')).toEqual(expect.objectContaining({ tracks: ['50%', '1fr', '1fr'], gap: 16 }));
    expectValid(d.getPage());
    d.setSectionLook('personal', { tracks: null, gap: null });
    expect(nodeOf(d.getPage(), 'personal')).not.toHaveProperty('tracks');
    expect(nodeOf(d.getPage(), 'personal')).not.toHaveProperty('gap');
  });

  it('refuses a width for each column but one, a width that is none, and a gap past 48', () => {
    const d = employeeDesigner();
    expect(d.setSectionLook('personal', { tracks: ['50%', '1fr'] })).toBe(false);
    expect(d.getState().issues).toEqual(['The group has 3 columns and 2 widths: give one width for each column.']);
    expect(d.setSectionLook('personal', { tracks: ['50%', 'wide', '1fr'] })).toBe(false);
    expect(d.getState().issues).toEqual(['“wide” is no width: write pixels (274px), a share of the row (50%) or of what is left (1fr).']);
    expect(d.setSectionLook('personal', { gap: 49 })).toBe(false);
    expect(d.getState().issues).toEqual(['The gap between columns is a whole number of pixels from 0 to 48.']);
    expect(nodeOf(d.getPage(), 'personal')).not.toHaveProperty('tracks');
  });

  it('puts the fold control at the heading’s end of a group that folds, and its ⤢ on a group with a title', () => {
    const d = employeeDesigner();
    expect(d.setSectionLook('role', { foldAt: 'end' })).toBe(false);
    expect(d.getState().issues).toEqual(['Turn on folding first: the fold control’s place is a folding group’s.']);
    expect(d.setSectionLook('bank', { foldAt: 'end', maximise: true })).toBe(true);
    expect(nodeOf(d.getPage(), 'bank')).toEqual(expect.objectContaining({ foldAt: 'end', maximise: true }));
    expectValid(d.getPage());
    // Folding taken off takes its control's place with it.
    d.setFold('bank', 'no');
    expect(nodeOf(d.getPage(), 'bank')).not.toHaveProperty('foldAt');
    expectValid(d.getPage());
    d.setSectionLook('bank', { maximise: null });
    expect(nodeOf(d.getPage(), 'bank')).not.toHaveProperty('maximise');
    expect(d.setSectionLook('side-1', { maximise: true })).toBe(false);
    expect(d.getState().issues).toEqual(['Give the group a title first: it is maximised from its heading.']);
  });

  it('offers them on the Layout tab: widths and gap for parts side by side too, the fold control and ⤢ for a group', () => {
    const d = employeeDesigner();
    const { host } = mount(d, { mode: 'advanced' });
    const row = (name: string) => host.querySelector(`.fd-properties [role="tabpanel"]:not([hidden]) [data-setting="${name}"]`) as HTMLElement | null;
    d.select('side-1');
    openTab(host, 'Layout');
    expect(row('Column widths')?.hidden).toBe(false);
    expect(row('Gap between columns')).not.toBeNull();
    expect(row('Fold control')).toBeNull();
    const widths = row('Column widths')?.querySelector('input') as HTMLInputElement;
    widths.value = '274px 1fr';
    widths.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nodeOf(d.getPage(), 'side-1')?.['tracks']).toEqual(['274px', '1fr']);
    d.select('bank');
    openTab(host, 'Layout');
    expect(row('Fold control')?.hidden).toBe(false);
    [...(row('Fold control')?.querySelectorAll('button') ?? [])].find((b) => b.textContent === 'At the heading’s end')?.click();
    expect(nodeOf(d.getPage(), 'bank')?.['foldAt']).toBe('end');
    (row('Maximise')?.querySelector('[role="switch"]') as HTMLButtonElement).click();
    expect(nodeOf(d.getPage(), 'bank')?.['maximise']).toBe(true);
    expect(row('Maximise')?.querySelector('[role="switch"]')?.getAttribute('aria-checked')).toBe('true');
    expectValid(d.getPage());
  });
});

describe('words in a help box', () => {
  it('reads as help with an icon, which goes when the words are no longer help', () => {
    const d = employeeDesigner();
    expect(d.updateBlock('t-note', { style: 'help', icon: 'branch' })).toBe(true);
    expect(nodeOf(d.getPage(), 't-note')).toEqual(expect.objectContaining({ style: 'help', icon: 'branch' }));
    expectValid(d.getPage());
    d.updateBlock('t-note', { style: 'note' });
    expect(nodeOf(d.getPage(), 't-note')).not.toHaveProperty('icon');
    expect(d.updateBlock('t-note', { icon: 'info' })).toBe(false);
    expect(d.getState().issues).toEqual(['Only words in a help box have an icon.']);
  });

  it('offers Help box among the ways words read, and its icon once picked', () => {
    const d = employeeDesigner();
    const { host } = mount(d, { mode: 'advanced' });
    d.select('t-note');
    openTab(host, 'Content');
    const reads = host.querySelector('[data-setting="Reads as"]') as HTMLElement;
    [...reads.querySelectorAll('button')].find((b) => b.textContent === 'Help box')?.click();
    expect(nodeOf(d.getPage(), 't-note')?.['style']).toBe('help');
    const icon = host.querySelector('[data-setting="Icon"] select') as HTMLSelectElement;
    expect(icon.closest('[hidden]')).toBeNull();
    icon.value = 'info';
    icon.dispatchEvent(new Event('change', { bubbles: true }));
    expect(nodeOf(d.getPage(), 't-note')?.['icon']).toBe('info');
  });
});

function openScreen(kind: string) {
  const designer = createDesigner({ page: blankPage('screen', 'Visit') });
  const id = designer.addQuestion(kind, { parent: 'section-1' }) as string;
  const { host } = mount(designer, { mode: 'simple' });
  designer.select(id);
  const card = () => host.querySelector('.fd-canvas-field.fd-editing') as HTMLElement;
  const node = () => ((designer.getPage().layout as unknown as { children: SectionNode[] }).children[0].children as FieldNode[]).find((n) => n.id === id) as FieldNode;
  const seg = (name: string, words: string) => [...(card().querySelector(`[aria-label="${name}"]`)?.querySelectorAll('button') ?? [])].find((b) => b.textContent === words) as HTMLButtonElement;
  return { designer, id, card, node, seg };
}

describe('a formatted text’s settings', () => {
  it('sets when and where its toolbar shows, its editor and the switch between editors', () => {
    const { card, node, seg } = openScreen('rich-text');
    seg('Toolbar', 'While worked in').click();
    // While worked in, at its foot unless said.
    expect(seg('Toolbar at', 'The foot').getAttribute('aria-pressed')).toBe('true');
    seg('Toolbar at', 'The top').click();
    seg('Editor', 'Markdown').click();
    (card().querySelector('[aria-label="People can switch editors"]') as HTMLButtonElement).click();
    expect(node().options).toEqual({ toolbar: 'focus', toolbarAt: 'top', editor: 'markdown', switchEditor: true });
    seg('Editor', 'Rich text').click();
    seg('Toolbar', 'Always').click();
    expect(node().options).toEqual({ toolbarAt: 'top', switchEditor: true });
  });

  it('picks its tools, kept in the toolbar’s order, and the people and records linked in it', () => {
    const { card, node } = openScreen('rich-text');
    const tool = (name: string) => card().querySelector(`.fd-work-text [data-tool="${name}"]`) as HTMLButtonElement;
    tool('link').click();
    tool('bold').click();
    expect(node().options).toEqual({ tools: ['bold', 'link'] });
    expect(tool('bold').getAttribute('aria-pressed')).toBe('true');
    const mention = card().querySelector('[aria-label="People mentioned with @ are of"]') as HTMLInputElement;
    mention.value = 'res.users';
    mention.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node().options?.['mention']).toEqual({ model: 'res.users' });
    ([...card().querySelectorAll('button')].find((b) => b.textContent === 'Add a kind of record') as HTMLButtonElement).click();
    expect(node().options?.['references']).toEqual([{ key: '#', model: 'record', label: 'Record' }]);
    const model = card().querySelector('[aria-label="Model 1"]') as HTMLInputElement;
    model.value = 'work.item';
    model.dispatchEvent(new Event('change', { bubbles: true }));
    expect(node().options?.['references']).toEqual([{ key: '#', model: 'work.item', label: 'Record' }]);
    (card().querySelector('[aria-label="Remove the records linked by #"]') as HTMLButtonElement).click();
    expect(node().options?.['references']).toBeUndefined();
    tool('link').click();
    tool('bold').click();
    expect(node().options).toEqual({ mention: { model: 'res.users' } });
  });
});

describe('a links box’s settings', () => {
  it('shows a many2many as a links box with Add link, its words, help, icon and empty link', () => {
    const { card, node, seg, designer } = openScreen('links');
    seg('Shown as', 'Links with Add link').click();
    expect(node().widget).toBe('links');
    seg('Add link', 'A menu: Existing item or New item').click();
    const box = (name: string) => card().querySelector(`[aria-label="${name}"]`) as HTMLInputElement & HTMLSelectElement;
    for (const [name, value] of [['Its words', 'Link work'], ['A link in the empty box', 'Add an existing work item as a parent'], ['Help while empty', 'Link a [commit](https://example.com/commit).']]) {
      box(name).value = value;
      box(name).dispatchEvent(new Event('input', { bubbles: true }));
    }
    box('Help’s icon').value = 'branch';
    box('Help’s icon').dispatchEvent(new Event('change', { bubbles: true }));
    expect(node().options).toEqual({ add: 'menu', addLabel: 'Link work', emptyLink: 'Add an existing work item as a parent', help: 'Link a [commit](https://example.com/commit).', helpIcon: 'branch' });
    expect(card().querySelector('.fd-links-help a')?.textContent).toBe('commit');
    // The icon white on a tile: its colour shown once ticked, gone again when unticked.
    const tileWord = box('Tile’s colour').closest('label') as HTMLElement;
    expect(tileWord.hidden).toBe(true);
    box('Icon on a tile').click();
    expect(node().options?.['helpTile']).toBe('#d84a12');
    expect(tileWord.hidden).toBe(false);
    box('Tile’s colour').value = '#0078d4';
    box('Tile’s colour').dispatchEvent(new Event('input', { bubbles: true }));
    expect(node().options?.['helpTile']).toBe('#0078d4');
    expect(card().querySelector('.fd-links-help-tile')).not.toBeNull();
    box('Icon on a tile').click();
    expect(node().options?.['helpTile']).toBeUndefined();
    expectValid(designer.getPage());
    seg('Shown as', 'Tags').click();
    expect(node().widget).toBeUndefined();
  });
});

describe('the designer’s words for a work item', () => {
  it('are said in Arabic too, every one', () => {
    const en = DESIGNER_WORDS.en.workText as Record<string, unknown>;
    const ar = DESIGNER_WORDS.ar.workText as Record<string, unknown>;
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
    expect((ar['tracksCount'] as (c: number, w: number) => string)(3, 2)).toContain('3');
  });
});

export type { Designer };
