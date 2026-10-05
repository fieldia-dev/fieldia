import type { Page } from '@fieldia/core';
import { blankPage, createDesigner, createMemoryLookStore, type Designer, type SavedLook } from './designer';
import { LOOK_PRESETS } from './look-presets';
import { mountSurveyEditor, type SurveyEditorHandle } from './survey-editor';
import { button, field, mount, openTab, press, type } from './test-editor';

/**
 * Looks of one's own on the Look tab, as SurveyJS and Vueform save named
 * themes: a look made by hand is saved by a name typed on the page, shown
 * under “Your looks” after Fieldia's presets, and put on another page as a
 * preset is — one undo step, then shown picked. Each is renamed or removed
 * from a small menu on it, a removal with Undo at hand. The survey and screen
 * editors on one page share the looks; a store that fails is said in words.
 */

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const brandLook = { accent: '#c4320a', font: 'serif', density: 'compact' } as const;

function lookTab(options: { looks?: ReturnType<typeof createMemoryLookStore>; page?: Page } = {}) {
  const looks = options.looks ?? createMemoryLookStore();
  const designer = createDesigner({ page: options.page ?? blankPage('screen', 'Visit'), looks });
  designer.select(null);
  const { host } = mount(designer, { mode: 'advanced' });
  openTab(host, 'Look');
  return { designer, looks, host, ...lookRow(() => host.querySelector('.fd-properties [data-setting="Look presets"]') as HTMLElement) };
}

/** What a person finds in the row of looks: wherever it is drawn, the Look tab or the survey's sheet. */
function lookRow(row: () => HTMLElement) {
  const presets = () => row().querySelector('[role="group"][aria-label="Look presets"]') as HTMLElement;
  const yours = () => row().querySelector('[role="group"][aria-label="Your looks"]') as HTMLElement | null;
  const names = (group: HTMLElement | null) => [...(group?.querySelectorAll('.fd-look-preset-name') ?? [])].map((n) => n.textContent);
  const tile = (name: string) => [...(yours()?.querySelectorAll<HTMLButtonElement>('button[aria-pressed]') ?? [])].find((b) => b.textContent?.includes(name) && b.querySelector('.fd-look-preset-name')?.textContent === name);
  const pressed = () => [...row().querySelectorAll('button[aria-pressed="true"]')].map((b) => b.querySelector('.fd-look-preset-name')?.textContent);
  const saveButton = () => button(row(), 'Save this look…');
  const box = () => row().querySelector('.fd-look-name') as HTMLFormElement;
  const problem = () => box().querySelector('[role="alert"]') as HTMLElement;
  const status = () => row().querySelector('.fd-look-status') as HTMLElement;
  const trouble = () => row().querySelector('.fd-look-problem') as HTMLElement;
  /** Type a name in the box and press its button, as a person does. */
  async function name(words: string, label = 'Name this look', submit = 'Save') {
    type(field(row(), label), words);
    button(box(), submit)?.click();
    await flush();
  }
  async function saveAs(words: string) {
    saveButton()?.click();
    await name(words);
  }
  /** Open a saved look's menu and pick in it. */
  function menu(look: string, item: string) {
    const more = button(row(), `Rename or remove “${look}”`);
    if (!more) throw new Error(`No menu on “${look}”`);
    more.click();
    const found = [...document.querySelectorAll<HTMLButtonElement>('.fd-menu [role="menuitem"]')].find((b) => b.textContent === item);
    if (!found) throw new Error(`No “${item}” in the menu of “${look}”`);
    found.click();
  }
  return { row, presets, yours, names, tile, pressed, saveButton, box, problem, status, trouble, name, saveAs, menu };
}

/** A look of one's own on the page, by hand: none of the presets. */
const ownLook = (designer: Designer) => designer.setLook(brandLook);

describe('a look of one’s own with each kind of part’s', () => {
  it('is offered to save once a kind of part has a look of its own, is kept with it, and is shown picked only with it', async () => {
    const { designer, looks, saveButton, saveAs, tile, pressed } = lookTab();
    designer.setLookPreset('calm');
    expect(saveButton()).toBeUndefined();
    designer.setPartLook('inputs', { background: '#fff7e6', corners: 'round' });
    expect(pressed()).toEqual([]);
    expect(saveButton()).toBeDefined();
    await saveAs('Calm, cream boxes');
    const kept = [...looks.looks.values()][0];
    expect(kept.look).toEqual({ ...LOOK_PRESETS[1].look, parts: { inputs: { background: '#fff7e6', corners: 'round' } } });
    expect(pressed()).toEqual(['Calm, cream boxes']);
    designer.setLookPreset('calm');
    expect(designer.getPage().look?.parts).toBeUndefined();
    expect(pressed()).toEqual(['Calm']);
    tile('Calm, cream boxes')?.click();
    expect(designer.getPage().look?.parts).toEqual({ inputs: { background: '#fff7e6', corners: 'round' } });
    expect(pressed()).toEqual(['Calm, cream boxes']);
  });

  it('with only a kind of part’s look, is one’s own: a page as the skin draws it but for its buttons', () => {
    const { designer, saveButton, row } = lookTab();
    designer.setPartLook('buttons', { accent: '#6941c6' });
    expect(saveButton()).toBeDefined();
    expect(row().querySelector('.fd-look-own')?.textContent).toBe('Your own');
  });
});

describe('saving a look of one’s own', () => {
  it('is offered once the look is one’s own, in a box on the page, never a prompt', () => {
    const prompt = jest.spyOn(window, 'prompt').mockImplementation(() => null);
    const { designer, saveButton, box, row } = lookTab();
    // As the skin draws it, or a preset: nothing of one's own to save.
    expect(saveButton()).toBeUndefined();
    ownLook(designer);
    expect(saveButton()).toBeDefined();
    designer.setLookPreset('calm');
    expect(saveButton()).toBeUndefined();
    designer.setLook({ font: 'rounded' });
    saveButton()?.click();
    expect(box().hidden).toBe(false);
    expect(document.activeElement).toBe(field(row(), 'Name this look'));
    expect(saveButton()).toBeUndefined();
    expect(prompt).not.toHaveBeenCalled();
    prompt.mockRestore();
  });

  it('keeps it by its name, trimmed, under “Your looks” after Fieldia’s, picked', async () => {
    const { designer, looks, row, presets, yours, names, tile, pressed, box, saveButton, saveAs } = lookTab({ page: { ...blankPage('screen', 'Visit'), look: { labels: 'beside', labelWidth: 160 } } });
    expect(yours()).toBeNull();
    ownLook(designer);
    await saveAs('  Brand  ');
    const kept = [...looks.looks.values()];
    expect(kept).toEqual([{ id: expect.any(String), name: 'Brand', look: brandLook }]);
    expect(names(presets())).toEqual(LOOK_PRESETS.map((p) => p.name));
    expect(names(yours())).toEqual(['Brand']);
    expect(presets().compareDocumentPosition(yours() as HTMLElement) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(row().querySelector('.fd-look-saved-head')?.textContent).toBe('Your looks');
    expect(pressed()).toEqual(['Brand']);
    expect(row().querySelector('.fd-look-own')?.hasAttribute('hidden')).toBe(true);
    expect(box().hidden).toBe(true);
    expect(saveButton()).toBeUndefined();
    expect(document.activeElement).toBe(tile('Brand'));
    // The page itself is not changed by saving it.
    expect(designer.getState().canUndo).toBe(true);
    expect(designer.getPage().look).toEqual({ labels: 'beside', labelWidth: 160, ...brandLook });
  });

  it('is drawn as a preset is: its words in its font and accent', async () => {
    const { designer, tile, saveAs } = lookTab();
    designer.setLook({ ...brandLook, scheme: 'dark' });
    await saveAs('Ember');
    const sample = tile('Ember')?.querySelector('.fd-look-preset-sample') as HTMLElement;
    expect(sample.textContent).toBe('Aa');
    expect(sample.getAttribute('aria-hidden')).toBe('true');
    expect([sample.dataset['font'], sample.dataset['scheme']]).toEqual(['serif', 'dark']);
    expect(sample.style.getPropertyValue('--fd-preset-accent')).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('refuses a name empty, taken or too long, in words where it is typed', async () => {
    const { designer, looks, row, problem, name, saveAs, saveButton } = lookTab();
    ownLook(designer);
    saveButton()?.click();
    const box = () => field(row(), 'Name this look') as HTMLInputElement;
    for (const [words, refusal] of [
      ['', 'A look needs a name'],
      ['   ', 'A look needs a name'],
      ['calm', 'There is a look named “Calm” already'],
      ['x'.repeat(41), 'A name is 40 characters at most'],
    ]) {
      await name(words);
      expect(problem().hidden).toBe(false);
      expect(problem().textContent).toBe(refusal);
      expect(box().getAttribute('aria-invalid')).toBe('true');
      expect(box().getAttribute('aria-describedby')).toBe(problem().id);
      expect(looks.looks.size).toBe(0);
    }
    // Typing again: the refusal goes until the next try.
    type(box(), 'Bran');
    expect(problem().hidden).toBe(true);
    expect(box().hasAttribute('aria-invalid')).toBe(false);
    await name('x'.repeat(40));
    expect(looks.looks.size).toBe(1);
    // A name kept already, in any case.
    designer.setLook({ corners: 'round' });
    await saveAs(' X'.repeat(1) + 'x'.repeat(39) + ' ');
    expect(problem().textContent).toBe(`There is a look named “${'x'.repeat(40)}” already`);
  });

  it('closes on Escape or Cancel, keeping nothing, the cursor back on Save this look', async () => {
    const { designer, looks, row, box, saveButton } = lookTab();
    ownLook(designer);
    saveButton()?.click();
    type(field(row(), 'Name this look'), 'Brand');
    press('Escape');
    expect(box().hidden).toBe(true);
    expect(document.activeElement).toBe(saveButton());
    saveButton()?.click();
    expect((field(row(), 'Name this look') as HTMLInputElement).value).toBe('');
    button(box(), 'Cancel')?.click();
    expect(box().hidden).toBe(true);
    await flush();
    expect(looks.looks.size).toBe(0);
  });
});

describe('a look of one’s own, put on a page', () => {
  const kept: SavedLook[] = [
    { id: 'brand', name: 'Brand', look: { ...brandLook } },
    { id: 'ink', name: 'Ink', look: { accent: '#002855', scheme: 'dark' } },
  ];

  it('is listed by name, and shows picked when the page wears it', async () => {
    const { names, yours, pressed } = lookTab({ looks: createMemoryLookStore([kept[1], kept[0]]), page: { ...blankPage('screen', 'Visit'), look: { ...brandLook, accent: '#C4320A' } } });
    await flush();
    expect(names(yours())).toEqual(['Brand', 'Ink']);
    expect(pressed()).toEqual(['Brand']);
  });

  it('is put on as one undo step, as a preset is, and where labels sit is kept', async () => {
    const { designer, tile, pressed } = lookTab({ looks: createMemoryLookStore(kept), page: { ...blankPage('screen', 'Visit'), look: { labels: 'beside' } } });
    await flush();
    designer.setLookPreset('calm');
    expect(pressed()).toEqual(['Calm']);
    tile('Ink')?.click();
    expect(designer.getPage().look).toEqual({ labels: 'beside', accent: '#002855', scheme: 'dark' });
    expect(pressed()).toEqual(['Ink']);
    tile('Brand')?.click();
    expect(designer.getPage().look).toEqual({ labels: 'beside', ...brandLook });
    expect(pressed()).toEqual(['Brand']);
    designer.undo();
    expect(pressed()).toEqual(['Ink']);
    designer.undo();
    expect(pressed()).toEqual(['Calm']);
  });

  it('is renamed from its menu, in the box, keeping its id and its place', async () => {
    const { looks, menu, row, name, names, yours, problem, tile } = lookTab({ looks: createMemoryLookStore(kept) });
    await flush();
    const more = button(row(), 'Rename or remove “Brand”') as HTMLButtonElement;
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    menu('Brand', 'Rename…');
    const box = field(row(), 'New name for “Brand”') as HTMLInputElement;
    expect(box.value).toBe('Brand');
    expect(document.activeElement).toBe(box);
    await name('Ink', 'New name for “Brand”', 'Rename');
    expect(problem().textContent).toBe('There is a look named “Ink” already');
    await name('  Brand 2026 ', 'New name for “Brand”', 'Rename');
    expect(looks.looks.get('brand')).toEqual({ ...kept[0], name: 'Brand 2026' });
    expect(names(yours())).toEqual(['Brand 2026', 'Ink']);
    expect(document.activeElement).toBe(tile('Brand 2026'));
    // Its own name in another case is no clash.
    menu('Brand 2026', 'Rename…');
    await name('BRAND 2026', 'New name for “Brand 2026”', 'Rename');
    expect(looks.looks.get('brand')?.name).toBe('BRAND 2026');
  });

  it('is removed from its menu without asking, Undo at hand to bring it back', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockImplementation(() => true);
    const { looks, menu, names, yours, status } = lookTab({ looks: createMemoryLookStore(kept) });
    await flush();
    menu('Brand', 'Remove');
    await flush();
    expect([...looks.looks.keys()]).toEqual(['ink']);
    expect(names(yours())).toEqual(['Ink']);
    expect(status().hidden).toBe(false);
    expect(status().getAttribute('role')).toBe('status');
    expect(status().textContent).toBe('Removed “Brand”. Undo');
    const undo = button(status(), 'Undo') as HTMLButtonElement;
    expect(document.activeElement).toBe(undo);
    undo.click();
    await flush();
    expect(looks.looks.get('brand')).toEqual(kept[0]);
    expect(names(yours())).toEqual(['Brand', 'Ink']);
    expect(status().hidden).toBe(true);
    expect(confirm).not.toHaveBeenCalled();
    confirm.mockRestore();
  });

  it('removed while the page wears it, leaves the page’s look as it is: one’s own again', async () => {
    const { designer, menu, saveButton, row } = lookTab({ looks: createMemoryLookStore(kept), page: { ...blankPage('screen', 'Visit'), look: { ...brandLook } } });
    await flush();
    menu('Brand', 'Remove');
    await flush();
    expect(designer.getPage().look).toEqual(brandLook);
    expect(row().querySelector('.fd-look-own')?.textContent).toBe('Your own');
    expect(saveButton()).toBeDefined();
  });
});

describe('the looks, shared by the survey and screen editors on one page', () => {
  let survey: SurveyEditorHandle | null = null;
  afterEach(() => {
    survey?.destroy();
    survey = null;
  });

  it('offers a look saved in one in the other, at once', async () => {
    const looks = createMemoryLookStore();
    const screen = lookTab({ looks });
    const designer = createDesigner({ page: blankPage('survey', 'Feedback'), looks });
    const host = document.createElement('div');
    document.body.append(host);
    survey = mountSurveyEditor(host, { designer });
    (host.querySelector('.fd-designer-bar button[aria-label="Look"]') as HTMLButtonElement).click();
    const sheet = lookRow(() => host.querySelector('[role="dialog"][aria-label="Look"] [data-setting="Look presets"]') as HTMLElement);
    await flush();
    expect(sheet.yours()).toBeNull();
    ownLook(screen.designer);
    await screen.saveAs('Brand');
    expect(sheet.names(sheet.yours())).toEqual(['Brand']);
    // Put on the survey from its own sheet; renamed there, renamed here.
    sheet.tile('Brand')?.click();
    expect(designer.getPage().look).toEqual(brandLook);
    expect(sheet.pressed()).toEqual(['Brand']);
    sheet.menu('Brand', 'Rename…');
    await sheet.name('Brand 2026', 'New name for “Brand”', 'Rename');
    expect(screen.names(screen.yours())).toEqual(['Brand 2026']);
  });

  it('Escape in the sheet’s name box closes the box, not the sheet', async () => {
    const designer = createDesigner({ page: { ...blankPage('survey', 'Feedback'), look: { ...brandLook } }, looks: createMemoryLookStore() });
    const host = document.createElement('div');
    document.body.append(host);
    survey = mountSurveyEditor(host, { designer });
    (host.querySelector('.fd-designer-bar button[aria-label="Look"]') as HTMLButtonElement).click();
    const sheet = lookRow(() => host.querySelector('[role="dialog"][aria-label="Look"] [data-setting="Look presets"]') as HTMLElement);
    sheet.saveButton()?.click();
    press('Escape');
    expect(sheet.box().hidden).toBe(true);
    expect(host.querySelector('[role="dialog"][aria-label="Look"]')).not.toBeNull();
  });
});

describe('a store that fails', () => {
  const away = () => Promise.reject(new Error('The server is away'));

  it('saving: says so in the box, the name kept to try again', async () => {
    const looks = createMemoryLookStore();
    let fail = true;
    const save = looks.save;
    looks.save = (look) => (fail ? away() : save(look));
    const { designer, row, box, problem, saveAs, yours, name } = lookTab({ looks });
    ownLook(designer);
    await saveAs('Brand');
    expect(box().hidden).toBe(false);
    expect((field(row(), 'Name this look') as HTMLInputElement).value).toBe('Brand');
    expect(problem().textContent).toBe('Could not save “Brand”: The server is away');
    expect(yours()).toBeNull();
    fail = false;
    await name('Brand');
    expect(box().hidden).toBe(true);
    expect([...looks.looks.values()].map((l) => l.name)).toEqual(['Brand']);
  });

  it('listing: says the looks could not be loaded, with Try again', async () => {
    const looks = createMemoryLookStore([{ id: 'brand', name: 'Brand', look: { ...brandLook } }]);
    const list = looks.list;
    looks.list = away;
    const { trouble, yours, names } = lookTab({ looks });
    await flush();
    expect(trouble().hidden).toBe(false);
    expect(trouble().getAttribute('role')).toBe('alert');
    expect(trouble().textContent).toBe('Your looks could not be loaded: The server is away Try again');
    looks.list = list;
    button(trouble(), 'Try again')?.click();
    await flush();
    expect(trouble().hidden).toBe(true);
    expect(names(yours())).toEqual(['Brand']);
  });

  it('removing: says so, and the look stays', async () => {
    const looks = createMemoryLookStore([{ id: 'brand', name: 'Brand', look: { ...brandLook } }]);
    looks.remove = away;
    const { menu, trouble, names, yours, status } = lookTab({ looks });
    await flush();
    menu('Brand', 'Remove');
    await flush();
    expect(trouble().textContent).toBe('Could not remove “Brand”: The server is away Try again');
    expect(names(yours())).toEqual(['Brand']);
    expect(status().hidden).toBe(true);
  });

  it('with no words of its own: said plainly', async () => {
    const looks = createMemoryLookStore();
    looks.save = () => Promise.reject({ status: 500 });
    const { designer, problem, saveAs } = lookTab({ looks });
    ownLook(designer);
    await saveAs('Brand');
    expect(problem().textContent).toBe('Could not save “Brand”. Try again in a moment.');
  });
});
